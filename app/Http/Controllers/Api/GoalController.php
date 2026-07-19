<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncGoalsRequest;
use App\Models\ChecklistItem;
use App\Models\Goal;
use App\Models\TimeSession;
use Illuminate\Support\Facades\DB;

class GoalController extends Controller
{
    /**
     * Replace the user's entire goal tree with the incoming payload.
     *
     * The frontend keeps one in-memory `goals` array and persists it as a
     * whole on every change, so the simplest and safest way to mirror that
     * on the server is a full "diff & replace" inside one transaction:
     * upsert everything present, delete anything no longer present.
     */
    public function sync(SyncGoalsRequest $request)
    {
        $user = $request->user();
        $incoming = collect($request->validated()['goals']);

        DB::transaction(function () use ($user, $incoming) {
            $incomingIds = $incoming->pluck('id')->all();

            // delete goals removed on the client (cascades to checklist_items/time_sessions)
            $user->goals()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

            foreach ($incoming as $g) {
                /** @var Goal $goal */
                $goal = Goal::updateOrCreate(
                    ['id' => $g['id'], 'user_id' => $user->id],
                    [
                        'parent_id' => $g['parentId'] ?? null,
                        'roadmap_owner_id' => $g['roadmapOwnerId'] ?? null,
                        'project_id' => $g['projectId'] ?? null,
                        'name' => $g['name'],
                        'requirements' => $g['requirements'] ?? '',
                        'notes' => $g['notes'] ?? '',
                        'assigned_to' => $g['assignedTo'] ?? '',
                        'priority' => $g['priority'],
                        'progress' => $g['progress'],
                        'auto_progress' => $g['autoProgress'],
                        'status' => $g['status'],
                        'deadline' => $g['deadline'] ?? null,
                        'reminder' => $g['reminder'] ?? false,
                        'reminder_at' => $g['reminderAt'] ?? null,
                        'reminder_fired' => $g['reminderFired'] ?? false,
                        'started_at' => $g['startedAt'] ?? null,
                        'accumulated_ms' => $g['accumulatedMs'] ?? 0,
                        'timer_paused' => $g['timerPaused'] ?? false,
                        'estimated_ms' => $g['estimatedMs'] ?? null,
                        'estimated_target_fired' => $g['estimatedTargetFired'] ?? false,
                        'break_reminder_fired' => $g['breakReminderFired'] ?? false,
                        'tag' => $g['tag'] ?? '',
                        'color' => $g['color'] ?? '',
                        'depends_on' => $g['dependsOn'] ?? [],
                        'archived' => $g['archived'] ?? false,
                        'template_id' => $g['templateId'] ?? null,
                        'order_index' => $g['order'],
                        'collapsed' => $g['collapsed'] ?? false,
                    ]
                );

                $this->syncChecklist($goal, $g['checklist'] ?? []);
                $this->syncTimeSessions($goal, $g['timeSessions'] ?? []);
            }
        });

        return response()->json(['message' => 'تمت المزامنة']);
    }

    private function syncChecklist(Goal $goal, array $items): void
    {
        $incomingIds = array_column($items, 'id');
        $goal->checklistItems()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

        foreach ($items as $index => $item) {
            ChecklistItem::updateOrCreate(
                ['id' => $item['id'], 'goal_id' => $goal->id],
                [
                    'text' => $item['text'],
                    'done' => $item['done'],
                    'images' => $item['images'] ?? [],
                    'order_index' => $index,
                    'started_at' => $item['startedAt'] ?? null,
                    'accumulated_ms' => $item['accumulatedMs'] ?? 0,
                    'timer_paused' => $item['timerPaused'] ?? false,
                ]
            );
        }
    }

    private function syncTimeSessions(Goal $goal, array $sessions): void
    {
        $incomingIds = array_column($sessions, 'id');
        $goal->timeSessions()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

        foreach ($sessions as $session) {
            TimeSession::updateOrCreate(
                ['id' => $session['id'], 'goal_id' => $goal->id],
                [
                    'start' => $session['start'],
                    'end' => $session['end'],
                    'duration_ms' => $session['durationMs'],
                ]
            );
        }
    }
}
