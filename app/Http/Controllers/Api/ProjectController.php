<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncProjectsRequest;
use App\Models\Project;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function sync(SyncProjectsRequest $request)
    {
        $user = $request->user();
        $incoming = collect($request->validated()['projects']);

        DB::transaction(function () use ($user, $incoming) {
            $incomingIds = $incoming->pluck('id')->all();
            $user->projects()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

            foreach ($incoming as $p) {
                Project::updateOrCreate(
                    ['id' => $p['id'], 'user_id' => $user->id],
                    [
                        'name' => $p['name'],
                        'description' => $p['description'] ?? '',
                        'color' => $p['color'] ?? '',
                        'member_ids' => $p['memberIds'] ?? [],
                        'sequential_lock' => $p['sequentialLock'] ?? false,
                    ]
                );
            }
        });

        return response()->json(['message' => 'تمت المزامنة']);
    }
}
