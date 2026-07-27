<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            // Archiving a project = soft delete. Its goals stay in the
            // database untouched (still tied to project_id) but get
            // excluded from every active-workspace query the moment the
            // project is trashed — see the `whereHas('project')` guards
            // added to StateController/AssignedGoalController/
            // SharedProjectController. Nothing about a goal itself changes,
            // so restoring the project brings everything straight back.
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
