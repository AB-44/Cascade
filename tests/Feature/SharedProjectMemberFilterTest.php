<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharedProjectMemberFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_shared_project_returns_only_members_associated_with_the_project(): void
    {
        $owner = User::factory()->create();
        $collaborator = User::factory()->create();

        // Create team members for owner's account
        $memberInProject = TeamMember::create([
            'id' => 'mem-1',
            'user_id' => $owner->id,
            'name' => 'Member In Project',
        ]);

        $memberNotInProject = TeamMember::create([
            'id' => 'mem-2',
            'user_id' => $owner->id,
            'name' => 'Unrelated Member',
        ]);

        // Create a project owned by $owner, shared with $collaborator
        $project = Project::create([
            'id' => 'proj-1',
            'user_id' => $owner->id,
            'name' => 'Shared Test Project',
            'is_shared' => true,
            'member_ids' => [$memberInProject->id],
        ]);

        $project->collaborators()->attach($collaborator->id, ['role' => 'collaborator']);

        $response = $this->actingAs($collaborator)
            ->getJson('/api/shared-projects');

        $response->assertStatus(200);

        $data = $response->json('projects.0.members');
        $memberIds = array_column($data, 'id');

        $this->assertContains('mem-1', $memberIds);
        $this->assertNotContains('mem-2', $memberIds);
    }
}
