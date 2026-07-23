<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marks a team_member row that was auto-created because someone
     * accepted a project invitation (see ProjectInvitationController::accept),
     * as opposed to a row the owner typed in themselves as a regular
     * teammate. This is what lets the UI split "team members" from
     * "project collaborators" reliably, instead of guessing from
     * linked_user_id (which is also set for regular members who simply
     * happen to have a Cascade account).
     */
    public function up(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->boolean('joined_via_project')->default(false)->after('linked_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->dropColumn('joined_via_project');
        });
    }
};
