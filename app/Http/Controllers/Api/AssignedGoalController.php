<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChecklistItem;
use App\Models\Goal;
use App\Models\TeamMember;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AssignedGoalController extends Controller
{
    /**
     * Every goal (owned by anyone) that's assigned to a team-member label
     * linked to the current account. Read-only view of someone else's
     * data, scoped down to just the tasks that concern this user.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Collect every TeamMember row that maps to the current account.
        $myMembers = TeamMember::where('linked_user_id', $user->id)
            ->orWhereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->get(['id', 'name']);

        $memberIds   = $myMembers->pluck('id')->all();
        $memberNames = $myMembers->pluck('name')->all();

        // GoalForm persists assignedTo as the member's *name* (m.name), so we
        // must match on both the TeamMember UUID and the display name.
        $goals = Goal::where(function ($q) use ($memberIds, $memberNames) {
                $q->whereIn('assigned_to', $memberIds);
                if ($memberNames) {
                    $q->orWhereIn('assigned_to', $memberNames);
                }
            })
            ->where('user_id', '!=', $user->id)
            ->where('archived', false)
            ->with(['checklistItems', 'user:id,name', 'project:id,name,color'])
            ->orderByRaw("deadline is null, deadline asc")
            ->get();

        // Breadcrumb support: for every distinct project these goals belong
        // to, pull a lightweight (id, parent_id, name) map of *all* goals in
        // that project so we can walk each goal's ancestor chain up to its
        // top-level stage in memory, in one query per project instead of
        // one query per goal.
        $projectIds = $goals->pluck('project_id')->filter()->unique()->values();
        $nodesByProject = Goal::whereIn('project_id', $projectIds)
            ->get(['id', 'parent_id', 'name'])
            ->keyBy('id');

        // Move-to-stage support: every top-level goal (a "stage") in each of
        // these projects, grouped by project_id, so each task can offer the
        // list of stages it's allowed to move between.
        $stagesByProject = Goal::whereIn('project_id', $projectIds)
            ->whereNull('parent_id')
            ->get(['id', 'project_id', 'name'])
            ->groupBy('project_id');

        $goals = $goals->map(fn (Goal $goal) => $this->goalToJson($goal, $nodesByProject, $stagesByProject));

        return response()->json(['goals' => $goals->values()]);
    }

    /**
     * The assignee can update how the work is going (status/progress/notes)
     * and run the timer, and — as a narrow, deliberate exception — move the
     * task to a *different top-level stage within the same project* via
     * `moveToStageId`. Anything else structural (name, deadline, who it's
     * assigned to, cross-project moves, re-parenting under a non-stage
     * node) still stays under the owner's control via PUT /api/goals.
     */
    public function update(Request $request, string $goal)
    {
        $goalModel = $this->findAssignedGoal($request, $goal);
        $this->assertStageUnlocked($goalModel);

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['Not Started', 'In Progress', 'Completed'])],
            'progress' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'startedAt' => ['sometimes', 'nullable', 'date'],
            'accumulatedMs' => ['sometimes', 'integer', 'min:0'],
            'timerPaused' => ['sometimes', 'boolean'],
            'moveToStageId' => ['sometimes', 'nullable', 'string'],
        ]);

        if (array_key_exists('moveToStageId', $data) && $data['moveToStageId']) {
            $newStage = Goal::where('id', $data['moveToStageId'])
                ->where('project_id', $goalModel->project_id)
                ->whereNull('parent_id')
                ->first();

            if (! $newStage) {
                abort(422, 'المرحلة المطلوبة غير موجودة في هذا المشروع.');
            }

            $goalModel->parent_id = $newStage->id;

            // Re-check against the *destination* stage before committing —
            // moving a task into a still-locked stage would just trade one
            // lock violation for another.
            if ($goalModel->isInLockedStage()) {
                abort(423, 'لا يمكن نقل المهمة إلى مرحلة مقفلة.');
            }
        }

        $goalModel->update([
            'status' => $data['status'] ?? $goalModel->status,
            'progress' => $goalModel->auto_progress ? $goalModel->progress : ($data['progress'] ?? $goalModel->progress),
            'notes' => $data['notes'] ?? $goalModel->notes,
            'started_at' => array_key_exists('startedAt', $data) ? $data['startedAt'] : $goalModel->started_at,
            'accumulated_ms' => $data['accumulatedMs'] ?? $goalModel->accumulated_ms,
            'timer_paused' => $data['timerPaused'] ?? $goalModel->timer_paused,
            'parent_id' => $goalModel->parent_id,
        ]);

        return response()->json(['message' => 'تم التحديث']);
    }

    /**
     * Toggle / update a single checklist item on an assigned goal.
     */
    public function updateChecklistItem(Request $request, string $goal, string $item)
    {
        $goalModel = $this->findAssignedGoal($request, $goal);
        $this->assertStageUnlocked($goalModel);

        $checklistItem = ChecklistItem::where('id', $item)->where('goal_id', $goalModel->id)->first();

        if (! $checklistItem) {
            throw new NotFoundHttpException('Checklist item not found.');
        }

        $data = $request->validate([
            'done' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'startedAt' => ['sometimes', 'nullable', 'date'],
            'accumulatedMs' => ['sometimes', 'integer', 'min:0'],
            'timerPaused' => ['sometimes', 'boolean'],
        ]);

        $checklistItem->update([
            'done' => $data['done'] ?? $checklistItem->done,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $checklistItem->notes,
            'started_at' => array_key_exists('startedAt', $data) ? $data['startedAt'] : $checklistItem->started_at,
            'accumulated_ms' => $data['accumulatedMs'] ?? $checklistItem->accumulated_ms,
            'timer_paused' => $data['timerPaused'] ?? $checklistItem->timer_paused,
        ]);

        return response()->json(['message' => 'تم التحديث']);
    }

    private function assertStageUnlocked(Goal $goal): void
    {
        if ($goal->isInLockedStage()) {
            abort(423, 'المرحلة السابقة لازم تكتمل أول.');
        }
    }

    private function findAssignedGoal(Request $request, string $goalId): Goal
    {
        $user = $request->user();

        $myMembers   = TeamMember::where('linked_user_id', $user->id)
            ->orWhereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->get(['id', 'name']);

        $memberIds   = $myMembers->pluck('id')->all();
        $memberNames = $myMembers->pluck('name')->all();

        $goal = Goal::where('id', $goalId)
            ->where(function ($q) use ($memberIds, $memberNames) {
                $q->whereIn('assigned_to', $memberIds);
                if ($memberNames) {
                    $q->orWhereIn('assigned_to', $memberNames);
                }
            })
            ->first();

        if (! $goal) {
            throw new NotFoundHttpException('Goal not found or not assigned to you.');
        }

        return $goal;
    }

    /**
     * Walks up the goal's parent_id chain (using the pre-loaded, per-project
     * node map) to find the id+name of its top-level ancestor — the "stage".
     * Returns null when the goal itself is already a top-level stage, since
     * there's nothing more specific to show in the breadcrumb.
     */
    private function stageFor(Goal $goal, \Illuminate\Support\Collection $nodesByProject): ?array
    {
        $node = $nodesByProject->get($goal->id);
        if (! $node || ! $node->parent_id) {
            return null;
        }

        $seen = [];
        while ($node->parent_id && ! in_array($node->parent_id, $seen, true)) {
            $seen[] = $node->parent_id;
            $parent = $nodesByProject->get($node->parent_id);
            if (! $parent) {
                break;
            }
            $node = $parent;
        }

        return ['id' => $node->id, 'name' => $node->name];
    }

    private function goalToJson(Goal $goal, ?\Illuminate\Support\Collection $nodesByProject = null, ?\Illuminate\Support\Collection $stagesByProject = null): array
    {
        $stages = $goal->project_id && $stagesByProject
            ? $stagesByProject->get($goal->project_id, collect())
                ->map(fn (Goal $s) => ['id' => $s->id, 'name' => $s->name])
                ->values()
            : collect();

        $stage = $nodesByProject ? $this->stageFor($goal, $nodesByProject) : null;

        return [
            'id' => $goal->id,
            'name' => $goal->name,
            'requirements' => $goal->requirements ?? '',
            'notes' => $goal->notes ?? '',
            'priority' => $goal->priority,
            'progress' => $goal->progress,
            'autoProgress' => $goal->auto_progress,
            'status' => $goal->status,
            'deadline' => $goal->deadline?->toDateString(),
            'startDate' => $goal->start_date?->toDateString(),
            'tag' => $goal->tag ?? '',
            'color' => $goal->color ?? '',
            'startedAt' => $goal->started_at?->toIso8601String(),
            'accumulatedMs' => (int) $goal->accumulated_ms,
            'timerPaused' => $goal->timer_paused,
            'ownerName' => $goal->user?->name ?? '',
            'projectName' => $goal->project?->name ?? null,
            'projectColor' => $goal->project?->color ?? null,
            'stageId' => $stage['id'] ?? null,
            'stageName' => $stage['name'] ?? null,
            'availableStages' => $stages,
            'locked' => $goal->isInLockedStage(),
            'createdAt' => $goal->created_at?->toIso8601String(),
            'updatedAt' => $goal->updated_at?->toIso8601String(),
            'checklist' => $goal->checklistItems->map(fn ($item) => [
                'id' => $item->id,
                'text' => $item->text,
                'notes' => $item->notes ?? '',
                'done' => $item->done,
                'startedAt' => $item->started_at?->toIso8601String(),
                'accumulatedMs' => (int) $item->accumulated_ms,
                'timerPaused' => $item->timer_paused,
            ])->values(),
        ];
    }
}
