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
            ->with('user:id,name')
            ->withCount(['collaborators as member_count'])
            ->get();

        $goalStats = Goal::whereIn('project_id', $projects->pluck('id'))
            ->where('archived', false)
            ->selectRaw('project_id, count(*) as total, sum(case when status = ? then 1 else 0 end) as completed', ['Completed'])
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        return response()->json([
            'projects' => $projects->map(function (Project $project) use ($goalStats) {
                $stats = $goalStats->get($project->id);
                $total = (int) ($stats->total ?? 0);
                $completed = (int) ($stats->completed ?? 0);

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'description' => $project->description ?? '',
                    'color' => $project->color ?? '',
                    'role' => $project->pivot->role,
                    'ownerName' => $project->user?->name ?? '',
                    'memberCount' => $project->member_count,
                    'goalCount' => $total,
                    'completedCount' => $completed,
                    'progressPct' => $total > 0 ? (int) round($completed / $total * 100) : 0,
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
}
