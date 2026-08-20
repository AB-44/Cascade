<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            // Multiple free-form notes on the goal/stage itself — same shape
            // and UI (NotesModal) as checklist_items.notes_list. The old
            // "notes" text column is kept and still used to seed the first
            // entry of notes_list on the client the first time the notes
            // modal is opened for a goal that predates this column.
            $table->json('notes_list')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn('notes_list');
        });
    }
};
