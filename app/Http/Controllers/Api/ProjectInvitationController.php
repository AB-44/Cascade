<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\Project;
use App\Models\ProjectInvitation;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectInvitationController extends Controller
{
    /**
     * Invite someone (by email) to collaborate on one specific project.
     * They must already have a Cascade account — invites aren't emailed out,
     * they show up as a notification inside the app for that account.
     */
    public function store(Request $request, string $project)
    {
        $owner = $request->user();
        $projectModel = $owner->projects()->find($project);

        if (! $projectModel) {
            throw new NotFoundHttpException('Project not found.');
        }

        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        if (strcasecmp($data['email'], $owner->email) === 0) {
            throw ValidationException::withMessages(['email' => ['ما تقدر تدعو نفسك.']]);
        }

        $invitee = User::whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->first();
        if (! $invitee) {
            throw ValidationException::withMessages([
                'email' => ['ما فيه حساب مسجّل بهذا البريد على المنصة.'],
            ]);
        }

        $alreadyCollaborator = $projectModel->collaborators()->where('users.id', $invitee->id)->exists();
        if ($alreadyCollaborator) {
            throw ValidationException::withMessages(['email' => ['هذا الشخص عضو بالمشروع أصلاً.']]);
        }

        // لو فيه دعوة معلّقة لنفس الشخص من قبل، نلغيها ونسوي دعوة جديدة
        // بدل ما نمنع المستخدم من إعادة الإرسال.
        $projectModel->invitations()
            ->where('invitee_email', $invitee->email)
            ->where('status', 'pending')
            ->delete();

        $invitation = ProjectInvitation::create([
            'id' => (string) Str::uuid(),
            'project_id' => $projectModel->id,
            'inviter_id' => $owner->id,
            'invitee_email' => $invitee->email,
            'status' => 'pending',
        ]);

        return response()->json($this->invitationToJson($invitation->fresh(), $projectModel), 201);
    }

    /**
     * Owner's view: who's already a collaborator, and who has a pending invite.
     */
    public function indexForProject(Request $request, string $project)
    {
        $owner = $request->user();
        $projectModel = $owner->projects()->find($project);

        if (! $projectModel) {
            throw new NotFoundHttpException('Project not found.');
        }

        return response()->json([
            'collaborators' => $projectModel->collaborators()->get(['users.id', 'users.name', 'users.email']),
            'invitations' => $projectModel->invitations()
                ->where('status', 'pending')
                ->get()
                ->map(fn ($i) => $this->invitationToJson($i, $projectModel)),
        ]);
    }

    /**
     * My pending invites — from anyone, for any of their projects.
     */
    public function indexForMe(Request $request)
    {
        $user = $request->user();

        $invitations = ProjectInvitation::where('invitee_email', $user->email)
            ->where('status', 'pending')
            ->with(['project:id,name,color', 'inviter:id,name'])
            ->latest()
            ->get()
            ->map(fn (ProjectInvitation $i) => [
                'id' => $i->id,
                'projectId' => $i->project_id,
                'projectName' => $i->project?->name ?? '',
                'projectColor' => $i->project?->color ?? '',
                'inviterName' => $i->inviter?->name ?? '',
                'createdAt' => $i->created_at?->toIso8601String(),
            ]);

        return response()->json(['invitations' => $invitations]);
    }

    public function accept(Request $request, string $invitation)
    {
        $invitationModel = $this->findMine($request, $invitation);
        $collaborator = $request->user();
        $owner = $invitationModel->project->user;

        $invitationModel->project->collaborators()->syncWithoutDetaching([$collaborator->id]);
        $invitationModel->update(['status' => 'accepted']);

        // So the owner can assign goals to this person: give them a
        // team_member "label" in the owner's list too, linked to their
        // real account (same auto-link-by-email the sync endpoint uses).
        TeamMember::firstOrCreate(
            ['user_id' => $owner->id, 'email' => $collaborator->email],
            [
                'id' => (string) Str::uuid(),
                'name' => $collaborator->name,
                'role' => '',
                'avatar' => null,
                'color' => '#6366f1',
                'linked_user_id' => $collaborator->id,
            ]
        );

        return response()->json(['message' => 'انضممت للمشروع']);
    }

    public function decline(Request $request, string $invitation)
    {
        $invitationModel = $this->findMine($request, $invitation);
        $invitationModel->update(['status' => 'declined']);

        return response()->json(['message' => 'تم رفض الدعوة']);
    }

    /**
     * Owner cancels a pending invite, or removes an existing collaborator.
     */
    public function destroy(Request $request, string $project, string $userId)
    {
        $owner = $request->user();
        $projectModel = $owner->projects()->find($project);

        if (! $projectModel) {
            throw new NotFoundHttpException('Project not found.');
        }

        $projectModel->collaborators()->detach($userId);

        $target = User::find($userId);
        if ($target) {
            $projectModel->invitations()
                ->where('invitee_email', $target->email)
                ->where('status', 'pending')
                ->update(['status' => 'declined']);

            // The removed collaborator may still have goals in this project
            // assigned to them (via their team_member label). Once they're
            // no longer a collaborator, that assignment is stale — clear it
            // so the goal stays in the project unassigned, instead of
            // silently re-appearing as "assigned to them" if they're
            // invited back later.
            $memberIds = TeamMember::where('user_id', $owner->id)
                ->where('linked_user_id', $target->id)
                ->pluck('id');

            if ($memberIds->isNotEmpty()) {
                Goal::where('project_id', $projectModel->id)
                    ->whereIn('assigned_to', $memberIds)
                    ->update(['assigned_to' => null]);
            }
        }

        return response()->json(['message' => 'تمت الإزالة']);
    }

    private function findMine(Request $request, string $invitationId): ProjectInvitation
    {
        $invitation = ProjectInvitation::where('id', $invitationId)
            ->where('invitee_email', $request->user()->email)
            ->where('status', 'pending')
            ->with('project')
            ->first();

        if (! $invitation) {
            throw new NotFoundHttpException('Invitation not found.');
        }

        return $invitation;
    }

    private function invitationToJson(ProjectInvitation $invitation, Project $project): array
    {
        return [
            'id' => $invitation->id,
            'projectId' => $project->id,
            'inviteeEmail' => $invitation->invitee_email,
            'status' => $invitation->status,
            'createdAt' => $invitation->created_at?->toIso8601String(),
        ];
    }
}
