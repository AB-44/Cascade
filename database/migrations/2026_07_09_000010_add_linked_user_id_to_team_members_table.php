<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Links a team_member "label" (a name/email a goal can be assigned to)
     * to a real registered User account, when one exists with a matching
     * email. This is what lets the assignee actually log in and see the
     * goals assigned to them, even though the goal itself still belongs
     * to whoever created it.
     */
    public function up(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->foreignId('linked_user_id')->nullable()->after('user_id')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->dropConstrainedForeignId('linked_user_id');
        });
    }
};
