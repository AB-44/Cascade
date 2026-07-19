<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            // When true, stage N+1 stays locked in the UI until stage N's
            // status is "Completed" — a workflow guide, not a hard data
            // constraint (the owner can still always edit their own goals
            // directly; only collaborators are actually blocked server-side,
            // see SharedProjectController).
            $table->boolean('sequential_lock')->default(false)->after('member_ids');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('sequential_lock');
        });
    }
};
