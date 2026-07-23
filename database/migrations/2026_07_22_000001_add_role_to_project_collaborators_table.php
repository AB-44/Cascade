<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Turns project_collaborators into the single source of truth for
     * "who has access to this project and how": every project owner now
     * gets a row here too (role=owner), alongside existing accepted
     * collaborators (role=collaborator). This lets the new full-page
     * project directory query one table instead of stitching together
     * `projects.user_id` ownership with a separate collaborators list.
     */
    public function up(): void
    {
        Schema::table('project_collaborators', function (Blueprint $table) {
            $table->string('role')->default('collaborator')->after('user_id');
        });

        // Backfill: every existing project's owner gets an explicit
        // owner row. Existing rows (all created via invitation-accept,
        // so all collaborators) already default to 'collaborator'.
        $projects = DB::table('projects')->select('id', 'user_id', 'created_at', 'updated_at')->get();
        foreach ($projects as $project) {
            DB::table('project_collaborators')->updateOrInsert(
                ['project_id' => $project->id, 'user_id' => $project->user_id],
                ['role' => 'owner', 'created_at' => $project->created_at, 'updated_at' => $project->updated_at]
            );
        }
    }

    public function down(): void
    {
        Schema::table('project_collaborators', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
