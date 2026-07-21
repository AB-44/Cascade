<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChecklistItem;
use App\Models\Goal;
use App\Models\Project;
use App\Models\TeamMember;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SharedProjectController extends Controller
{
    /**
     * Projects someone else owns that I accepted an invite to, each with
     * its full goal list plus the project's member roster. Collaborators
     * see everything in the project and can filter by person on the client
     * (see `members`), rather than being scoped to only their own goals.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $projects = $user->projectCollaborations()
            ->with(['user:id,name'])
            ->get()
            ->map(function (Project $project) use ($user) {
                $goals = Goal::where('project_id', $project->id)
                    ->where('archived', false)
                    ->with('checklistItems')
                    ->orderBy('order_index')
                    ->get()
                    ->map(fn (Goal $g) => $this->goalToJson($g));

                // Everyone the owner can assign goals to in this project,
                // so any collaborator can filter the roadmap by person —
                // including people added after they themselves joined.
                $members = TeamMember::where('user_id', $project->user_id)
                    ->orderBy('created_at')
                    ->get(['id', 'name', 'avatar', 'color'])
                    ->map(fn (TeamMember $m) => [
                        'id' => $m->id,
                        'name' => $m->name,
                        'avatar' => $m->avatar ?? '',
                        'color' => $m->color ?? '',
                    ]);

                // Which of those member cards is *me* in this owner's roster
                // (if any) — the client uses this to decide which goals I'm
                // allowed to actually edit vs. just view.
                $myMemberId = TeamMember::where('user_id', $project->user_id)
                    ->where(function ($q) use ($user) {
                        $q->where('linked_user_id', $user->id)
                            ->orWhereRaw('LOWER(email) = ?', [strtolower($user->email)]);
                    })
                    ->value('id');

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'description' => $project->description,
                    'color' => $project->color,
                    'ownerName' => $project->user?->name ?? '',
                    'goals' => $goals,
                    'members' => $members,
                    'myMemberId' => $myMemberId,
                    'sequentialLock' => (bool) $project->sequential_lock,
                ];
            });

        return response()->json(['projects' => $projects]);
    }

    /**
     * A collaborator sees the whole project, but can only actually move
     * a goal forward (status/progress/notes/timer) if it's assigned to
     * them — same rule TeamMemberController/AssignedGoalController use to
     * link a team-member card to a real account. Everyone else gets a
     * 403, and the frontend renders those goals read-only.
     */
    public function updateGoal(Request $request, string $project, string $goal)
    {
        $goalModel = $this->findSharedGoal($request, $project, $goal);
        $this->assertIsAssignee($request, $goalModel);
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
            'status'         => $data['status'] ?? $goalModel->status,
            // If the caller explicitly sends a progress value (e.g. computed
            // from checklist completion on the frontend), always apply it —
            // auto_progress only blocks the full-replace PUT /goals sync.
            'progress'       => array_key_exists('progress', $data) ? $data['progress'] : $goalModel->progress,
            'notes'          => $data['notes'] ?? $goalModel->notes,
            'started_at'     => array_key_exists('startedAt', $data) ? $data['startedAt'] : $goalModel->started_at,
            'accumulated_ms' => $data['accumulatedMs'] ?? $goalModel->accumulated_ms,
            'timer_paused'   => $data['timerPaused'] ?? $goalModel->timer_paused,
        ]);

        return response()->json(['message' => 'تم التحديث']);
    }

    public function updateChecklistItem(Request $request, string $project, string $goal, string $item)
    {
        $goalModel = $this->findSharedGoal($request, $project, $goal);
        $this->assertIsAssignee($request, $goalModel);
        $this->assertStageUnlocked($goalModel);

        $checklistItem = ChecklistItem::where('id', $item)->where('goal_id', $goalModel->id)->first();
        if (! $checklistItem) {
            throw new NotFoundHttpException('Checklist item not found.');
        }

        $data = $request->validate([
            'done' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['string'],
            'startedAt' => ['sometimes', 'nullable', 'date'],
            'accumulatedMs' => ['sometimes', 'integer', 'min:0'],
            'timerPaused' => ['sometimes', 'boolean'],
        ]);

        $checklistItem->update([
            'done' => $data['done'] ?? $checklistItem->done,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $checklistItem->notes,
            'images' => $data['images'] ?? $checklistItem->images,
            'started_at' => array_key_exists('startedAt', $data) ? $data['startedAt'] : $checklistItem->started_at,
            'accumulated_ms' => $data['accumulatedMs'] ?? $checklistItem->accumulated_ms,
            'timer_paused' => $data['timerPaused'] ?? $checklistItem->timer_paused,
        ]);

        return response()->json(['message' => 'تم التحديث']);
    }

    /**
     * Add a new checklist item — only the assignee can grow their own
     * task's checklist; nobody else gets to add work to it.
     */
    public function storeChecklistItem(Request $request, string $project, string $goal)
    {
        $goalModel = $this->findSharedGoal($request, $project, $goal);
        $this->assertIsAssignee($request, $goalModel);
        $this->assertStageUnlocked($goalModel);

        $data = $request->validate([
            'text' => ['required', 'string', 'max:500'],
        ]);

        $nextOrder = (int) $goalModel->checklistItems()->max('order_index') + 1;

        $item = $goalModel->checklistItems()->create([
            'id' => (string) Str::uuid(),
            'text' => $data['text'],
            'done' => false,
            'images' => [],
            'order_index' => $nextOrder,
        ]);

        return response()->json([
            'item' => [
                'id' => $item->id,
                'text' => $item->text,
                'notes' => $item->notes ?? '',
                'done' => $item->done,
                'images' => $item->images ?? [],
                'startedAt' => null,
                'accumulatedMs' => 0,
                'timerPaused' => false,
            ],
        ]);
    }

    public function destroyChecklistItem(Request $request, string $project, string $goal, string $item)
    {
        $goalModel = $this->findSharedGoal($request, $project, $goal);
        $this->assertIsAssignee($request, $goalModel);
        $this->assertStageUnlocked($goalModel);

        $goalModel->checklistItems()->where('id', $item)->delete();

        return response()->json(['message' => 'تم الحذف']);
    }

    /**
     * If the project has sequential stage locking on, a goal inside stage N
     * can't be touched until stage N-1 is Completed. Only enforced here
     * (server-side, for collaborators) — the owner's own PUT /goals stays
     * fully trusted, same as every other owner-only constraint in this app.
     */
    private function assertStageUnlocked(Goal $goal): void
    {
        if ($goal->isInLockedStage()) {
            abort(423, 'المرحلة السابقة لازم تكتمل أول.');
        }
    }

    private function findSharedGoal(Request $request, string $projectId, string $goalId): Goal
    {
        $user = $request->user();
        $isCollaborator = $user->projectCollaborations()->where('projects.id', $projectId)->exists();

        if (! $isCollaborator) {
            throw new NotFoundHttpException('Project not found or not shared with you.');
        }

        $goal = Goal::where('id', $goalId)->where('project_id', $projectId)->first();
        if (! $goal) {
            throw new NotFoundHttpException('Goal not found.');
        }

        return $goal;
    }

    private function assertIsAssignee(Request $request, Goal $goal): void
    {
        $user = $request->user();

        if (! $goal->assigned_to) {
            abort(403, 'هذه المهمة مو مسندة لك.');
        }

        // assigned_to may be stored as the TeamMember id OR as the member's
        // name (GoalForm stores m.name). Strategy:
        //   1. Find all TeamMember rows that match either id or name.
        //   2. For each candidate, check if it is linked to the current user
        //      via linked_user_id, or if the user's email matches the member's
        //      email, or if the owner created a *separate* linked member with
        //      the same name after the invite was accepted.
        $candidates = TeamMember::where('id', $goal->assigned_to)
            ->orWhere('name', $goal->assigned_to)
            ->get(['id', 'name', 'email', 'linked_user_id']);

        $isAssignee = $candidates->contains(function ($member) use ($user) {
            // Direct link set at invite-acceptance time
            if ($member->linked_user_id && $member->linked_user_id == $user->id) {
                return true;
            }
            // Email match (member may have been created manually with email)
            if ($member->email && strtolower($member->email) === strtolower($user->email)) {
                return true;
            }
            return false;
        });

        if (! $isAssignee) {
            abort(403, 'هذه المهمة مو مسندة لك.');
        }
    }

    private function goalToJson(Goal $goal): array
    {
        return [
            'id' => $goal->id,
            'parentId' => $goal->parent_id,
            'name' => $goal->name,
            'requirements' => $goal->requirements ?? '',
            'notes' => $goal->notes ?? '',
            'assignedTo' => $goal->assigned_to ?? '',
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
            'createdAt' => $goal->created_at?->toIso8601String(),
            'updatedAt' => $goal->updated_at?->toIso8601String(),
            'checklist' => $goal->checklistItems->map(fn ($item) => [
                'id' => $item->id,
                'text' => $item->text,
                'notes' => $item->notes ?? '',
                'done' => $item->done,
                'images' => $item->images ?? [],
                'startedAt' => $item->started_at?->toIso8601String(),
                'accumulatedMs' => (int) $item->accumulated_ms,
                'timerPaused' => $item->timer_paused,
            ])->values(),
        ];
    }
}
