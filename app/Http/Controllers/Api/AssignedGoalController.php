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
            ->get()
            ->map(fn (Goal $goal) => $this->goalToJson($goal));

        return response()->json(['goals' => $goals]);
    }

    /**
     * The assignee can update how the work is going (status/progress/notes)
     * and run the timer, but can't touch anything structural (name,
     * deadline, who it's assigned to, hierarchy, etc.) — that stays under
     * the owner's control via PUT /api/goals.
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
        ]);

        $goalModel->update([
            'status' => $data['status'] ?? $goalModel->status,
            'progress' => $goalModel->auto_progress ? $goalModel->progress : ($data['progress'] ?? $goalModel->progress),
            'notes' => $data['notes'] ?? $goalModel->notes,
            'started_at' => array_key_exists('startedAt', $data) ? $data['startedAt'] : $goalModel->started_at,
            'accumulated_ms' => $data['accumulatedMs'] ?? $goalModel->accumulated_ms,
            'timer_paused' => $data['timerPaused'] ?? $goalModel->timer_paused,
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
            'startedAt' => ['sometimes', 'nullable', 'date'],
            'accumulatedMs' => ['sometimes', 'integer', 'min:0'],
            'timerPaused' => ['sometimes', 'boolean'],
        ]);

        $checklistItem->update([
            'done' => $data['done'] ?? $checklistItem->done,
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

    private function goalToJson(Goal $goal): array
    {
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
            'tag' => $goal->tag ?? '',
            'color' => $goal->color ?? '',
            'startedAt' => $goal->started_at?->toIso8601String(),
            'accumulatedMs' => (int) $goal->accumulated_ms,
            'timerPaused' => $goal->timer_paused,
            'ownerName' => $goal->user?->name ?? '',
            'projectName' => $goal->project?->name ?? null,
            'projectColor' => $goal->project?->color ?? null,
            'locked' => $goal->isInLockedStage(),
            'createdAt' => $goal->created_at?->toIso8601String(),
            'updatedAt' => $goal->updated_at?->toIso8601String(),
            'checklist' => $goal->checklistItems->map(fn ($item) => [
                'id' => $item->id,
                'text' => $item->text,
                'done' => $item->done,
                'startedAt' => $item->started_at?->toIso8601String(),
                'accumulatedMs' => (int) $item->accumulated_ms,
                'timerPaused' => $item->timer_paused,
            ])->values(),
        ];
    }
}
