<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncProjectsRequest;
use App\Models\Goal;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    /**
     * The unified project directory: everything this user has access to —
     * their own projects and every project they've been invited into and
     * accepted — each tagged with `role` (owner/collaborator/guest) so the
     * UI can badge them differently. One query against project_collaborators
     * instead of stitching together two separate lists.
     */
    public function myProjects(Request $request)
    {
        $user = $request->user();

        $projects = $user->allProjects()
            ->with(['user:id,name,avatar,avatar_color', 'collaborators:id,name,avatar,avatar_color'])
            ->withCount(['collaborators as member_count'])
            ->get();

        $goalStats = Goal::whereIn('project_id', $projects->pluck('id'))
            ->where('archived', false)
            ->selectRaw('project_id, count(*) as total, sum(case when status = ? then 1 else 0 end) as completed, max(deadline) as latest_deadline', ['Completed'])
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        return response()->json([
            'projects' => $projects->map(function (Project $project) use ($goalStats) {
                $stats = $goalStats->get($project->id);
                $total = (int) ($stats->total ?? 0);
                $completed = (int) ($stats->completed ?? 0);

                // Derived, not stored: a project with no tasks yet reads as
                // an "idea", one that's fully done reads as "completed",
                // anything in between is simply "in progress". This avoids
                // inventing a status field/value the owner never set.
                $status = $total === 0 ? 'idea' : ($completed === $total ? 'completed' : 'in_progress');

                // Owner first, then up to 4 collaborators — enough for a
                // small avatar stack without over-fetching.
                $avatars = collect([$project->user])
                    ->merge($project->collaborators)
                    ->filter()
                    ->unique('id')
                    ->take(5)
                    ->map(fn ($u) => [
                        'name' => $u->name,
                        'avatar' => $u->avatar,
                        'color' => $u->avatar_color,
                    ])
                    ->values();

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'description' => $project->description ?? '',
                    'color' => $project->color ?? '',
                    'role' => $project->pivot->role,
                    'ownerName' => $project->user?->name ?? '',
                    'memberCount' => $project->member_count,
                    'memberAvatars' => $avatars,
                    'goalCount' => $total,
                    'completedCount' => $completed,
                    'progressPct' => $total > 0 ? (int) round($completed / $total * 100) : 0,
                    'status' => $status,
                    'latestDeadline' => $stats->latest_deadline ?? null,
                    'createdAt' => $project->created_at?->toIso8601String(),
                ];
            })->values(),
        ]);
    }

    public function sync(SyncProjectsRequest $request)
    {
        $user = $request->user();
        $incoming = collect($request->validated()['projects']);

        DB::transaction(function () use ($user, $incoming) {
            $incomingIds = $incoming->pluck('id')->all();
            $user->projects()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

            foreach ($incoming as $p) {
                $project = Project::updateOrCreate(
                    ['id' => $p['id'], 'user_id' => $user->id],
                    [
                        'name' => $p['name'],
                        'description' => $p['description'] ?? '',
                        'color' => $p['color'] ?? '',
                        'member_ids' => $p['memberIds'] ?? [],
                        'sequential_lock' => $p['sequentialLock'] ?? false,
                    ]
                );

                // Keep project_collaborators as the single source of truth
                // for "who has access + what role" — every project needs
                // its owner row here too, alongside any invited
                // collaborators (see ProjectInvitationController).
                $project->collaborators()->syncWithoutDetaching([$user->id => ['role' => 'owner']]);
            }
        });

        return response()->json(['message' => 'تمت المزامنة']);
    }

    /**
     * Archived projects only (owner-only — an archived project drops out
     * of collaborators' access too, matching a trashed folder). Each row
     * carries what the archive page needs: live-computed progress (goals
     * themselves are untouched, just excluded from active queries — see
     * StateController/AssignedGoalController) plus the owner's name for
     * the "archived by" column, since this app has no separate admin role.
     */
    public function archivedIndex(Request $request)
    {
        $user = $request->user();

        $projects = Project::onlyTrashed()
            ->where('user_id', $user->id)
            ->orderByDesc('deleted_at')
            ->get();

        $goalStats = Goal::whereIn('project_id', $projects->pluck('id'))
            ->selectRaw('project_id, count(*) as total, sum(case when status = ? then 1 else 0 end) as completed', ['Completed'])
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        return response()->json([
            'projects' => $projects->map(function (Project $project) use ($goalStats, $user) {
                $stats = $goalStats->get($project->id);
                $total = (int) ($stats->total ?? 0);
                $completed = (int) ($stats->completed ?? 0);

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'description' => $project->description ?? '',
                    'color' => $project->color ?? '',
                    'goalCount' => $total,
                    'completedCount' => $completed,
                    'progressPct' => $total > 0 ? (int) round($completed / $total * 100) : 0,
                    'archivedByName' => $user->name,
                    'archivedAt' => $project->deleted_at?->toIso8601String(),
                ];
            })->values(),
        ]);
    }

    /**
     * Read-only fetch of one archived project plus its goals, for the
     * "عرض" (view) action in the archive page — the project is excluded
     * from every *active* query on purpose, so this is the one place that
     * deliberately reaches past that with onlyTrashed().
     */
    public function showArchived(Request $request, string $project)
    {
        $user = $request->user();
        $projectModel = Project::onlyTrashed()->where('user_id', $user->id)->findOrFail($project);

        $goals = Goal::where('project_id', $projectModel->id)
            ->with('checklistItems')
            ->orderBy('order_index')
            ->get()
            ->map(fn (Goal $g) => [
                'id' => $g->id,
                'parentId' => $g->parent_id,
                'name' => $g->name,
                'status' => $g->status,
                'progress' => $g->progress,
                'priority' => $g->priority,
                'color' => $g->color,
                'assignedTo' => $g->assigned_to ?? '',
                'checklist' => $g->checklistItems->map(fn ($item) => [
                    'id' => $item->id,
                    'text' => $item->text,
                    'done' => $item->done,
                ])->values(),
            ]);

        return response()->json([
            'project' => [
                'id' => $projectModel->id,
                'name' => $projectModel->name,
                'description' => $projectModel->description ?? '',
                'color' => $projectModel->color ?? '',
                'archivedAt' => $projectModel->deleted_at?->toIso8601String(),
            ],
            'goals' => $goals,
        ]);
    }

    public function archive(Request $request, string $project)
    {
        $user = $request->user();
        $projectModel = $user->projects()->findOrFail($project);
        $projectModel->delete(); // soft delete — see SoftDeletes on the model

        return response()->json(['message' => 'تمت الأرشفة']);
    }

    public function restore(Request $request, string $project)
    {
        $user = $request->user();
        $projectModel = Project::onlyTrashed()->where('user_id', $user->id)->findOrFail($project);
        $projectModel->restore();

        return response()->json(['message' => 'تمت الاستعادة']);
    }

    /**
     * Permanent, unrecoverable delete. Goals aren't soft-deleted (only
     * `archived` as a normal boolean, a different feature), so nothing
     * cascades at the DB level here — deleting the project's goals
     * explicitly first cascades to their checklist_items/time_sessions
     * via the FK on those tables.
     */
    public function forceDelete(Request $request, string $project)
    {
        $user = $request->user();
        $projectModel = Project::onlyTrashed()->where('user_id', $user->id)->findOrFail($project);

        DB::transaction(function () use ($projectModel) {
            Goal::where('project_id', $projectModel->id)->delete();
            $projectModel->forceDelete();
        });

        return response()->json(['message' => 'تم الحذف نهائيًا']);
    }
}
