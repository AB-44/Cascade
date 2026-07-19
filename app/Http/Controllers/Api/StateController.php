<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class StateController extends Controller
{
    /**
     * Returns the full app state in the exact shape the React app expects,
     * so the frontend can hydrate its store in a single request.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $goals = $user->goals()
            ->with(['checklistItems', 'timeSessions'])
            ->orderBy('order_index')
            ->get()
            ->map(fn ($goal) => $this->goalToJson($goal));

        return response()->json([
            'goals' => $goals,
            'templates' => $user->templates()->orderBy('created_at')->get()
                ->map(fn ($t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'nodes' => $t->nodes ?? [],
                    'createdAt' => $t->created_at?->toIso8601String(),
                ]),
            'members' => $user->teamMembers()->with('linkedUser')->orderBy('created_at')->get()
                ->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                    'role' => $m->role ?? '',
                    'email' => $m->email ?? '',
                    'avatar' => $m->avatar ?? '',
                    'color' => $m->color ?? '',
                    'linkedAvatar' => $m->linkedUser?->avatar,
                    'linkedAvatarColor' => $m->linkedUser?->avatar_color,
                    'hasAccount' => $m->linked_user_id !== null,
                    'createdAt' => $m->created_at?->toIso8601String(),
                ]),
            'projects' => $user->projects()->orderBy('created_at')->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'description' => $p->description ?? '',
                    'color' => $p->color ?? '',
                    'memberIds' => $p->member_ids ?? [],
                    'sequentialLock' => (bool) $p->sequential_lock,
                    'createdAt' => $p->created_at?->toIso8601String(),
                ]),
        ]);
    }

    private function goalToJson($goal): array
    {
        return [
            'id' => $goal->id,
            'parentId' => $goal->parent_id,
            'roadmapOwnerId' => $goal->roadmap_owner_id,
            'projectId' => $goal->project_id,
            'name' => $goal->name,
            'requirements' => $goal->requirements ?? '',
            'notes' => $goal->notes ?? '',
            'assignedTo' => $goal->assigned_to ?? '',
            'priority' => $goal->priority,
            'progress' => $goal->progress,
            'autoProgress' => $goal->auto_progress,
            'deadline' => $goal->deadline?->toDateString(),
            'reminder' => $goal->reminder,
            'reminderAt' => $goal->reminder_at?->toIso8601String(),
            'reminderFired' => $goal->reminder_fired,
            'startedAt' => $goal->started_at?->toIso8601String(),
            'accumulatedMs' => (int) $goal->accumulated_ms,
            'timerPaused' => $goal->timer_paused,
            'estimatedMs' => $goal->estimated_ms !== null ? (int) $goal->estimated_ms : null,
            'estimatedTargetFired' => $goal->estimated_target_fired,
            'breakReminderFired' => $goal->break_reminder_fired,
            'status' => $goal->status,
            'tag' => $goal->tag ?? '',
            'color' => $goal->color ?? '',
            'dependsOn' => $goal->depends_on ?? [],
            'archived' => $goal->archived,
            'templateId' => $goal->template_id,
            'order' => $goal->order_index,
            'collapsed' => $goal->collapsed,
            'createdAt' => $goal->created_at?->toIso8601String(),
            'updatedAt' => $goal->updated_at?->toIso8601String(),
            'checklist' => $goal->checklistItems->map(fn ($item) => [
                'id' => $item->id,
                'text' => $item->text,
                'done' => $item->done,
                'images' => $item->images ?? [],
                'startedAt' => $item->started_at?->toIso8601String(),
                'accumulatedMs' => (int) $item->accumulated_ms,
                'timerPaused' => $item->timer_paused,
            ])->values(),
            'timeSessions' => $goal->timeSessions->map(fn ($s) => [
                'id' => $s->id,
                'start' => $s->start?->toIso8601String(),
                'end' => $s->end?->toIso8601String(),
                'durationMs' => (int) $s->duration_ms,
            ])->values(),
        ];
    }
}
