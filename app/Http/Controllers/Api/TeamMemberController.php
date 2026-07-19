<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncTeamMembersRequest;
use App\Models\Goal;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TeamMemberController extends Controller
{
    public function sync(SyncTeamMembersRequest $request)
    {
        $user = $request->user();
        $incoming = collect($request->validated()['members']);

        DB::transaction(function () use ($user, $incoming) {
            $incomingIds = $incoming->pluck('id')->all();

            // Members being removed in this sync (present before, absent now).
            $removedIds = $user->teamMembers()
                ->whereNotIn('id', $incomingIds ?: ['__none__'])
                ->pluck('id');

            if ($removedIds->isNotEmpty()) {
                // Goals assigned to a member are only meaningful while that
                // member exists. Once removed, clear the link instead of
                // leaving a dangling assigned_to pointing at a deleted row —
                // otherwise re-adding the same person later creates a new
                // team_member id and the stale goal resurfaces as a
                // duplicate-looking task.
                Goal::where('user_id', $user->id)
                    ->whereIn('assigned_to', $removedIds)
                    ->update(['assigned_to' => null]);

                $user->teamMembers()->whereIn('id', $removedIds)->delete();
            }

            foreach ($incoming as $m) {
                $email = $m['email'] ?? '';

                // If this email belongs to a registered account, link it so
                // that person can see goals assigned to them when they log in.
                $linkedUserId = $email !== ''
                    ? User::whereRaw('LOWER(email) = ?', [strtolower($email)])->value('id')
                    : null;

                // Reuse an existing team_member id for this user+email if one
                // already exists (e.g. the person was removed and is being
                // re-added under a fresh client-generated id). This keeps a
                // single stable identity per person instead of spawning a new
                // row every time they're re-added.
                $existingId = $email !== ''
                    ? $user->teamMembers()->whereRaw('LOWER(email) = ?', [strtolower($email)])->value('id')
                    : null;

                $targetId = $existingId ?? $m['id'];

                TeamMember::updateOrCreate(
                    ['id' => $targetId, 'user_id' => $user->id],
                    [
                        'name' => $m['name'],
                        'role' => $m['role'] ?? '',
                        'email' => $email,
                        'avatar' => $m['avatar'] ?? null,
                        'color' => $m['color'] ?? '',
                        'linked_user_id' => $linkedUserId,
                    ]
                );
            }
        });

        // Return the authoritative post-sync list. IDs can differ from what
        // the client sent (see the reuse-existing-id logic above), so the
        // client must adopt this list rather than trust its own local ids.
        $members = $user->teamMembers()->with('linkedUser')->orderBy('created_at')->get()
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
            ]);

        return response()->json(['message' => 'تمت المزامنة', 'members' => $members]);
    }
}
