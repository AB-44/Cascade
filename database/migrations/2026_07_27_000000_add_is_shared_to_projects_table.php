<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            // Explicit classification chosen at creation time, instead of
            // inferring "shared" from collaborator count or assignee — see
            // AssignedGoalController, which uses this to decide whether a
            // project's goals belong on the owner's "my tasks" page (private
            // projects only) or not (shared ones, even if self-assigned).
            $table->boolean('is_shared')->default(false)->after('sequential_lock');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('is_shared');
        });
    }
};
