<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checklist_items', function (Blueprint $table) {
            // Multiple free-form notes per checklist item (each with its own
            // title, body and images), replacing the single "notes"/"notes
            // images" pair as the primary notes UI on the frontend. The old
            // "notes" column is kept around and still used to seed the first
            // entry of notes_list on the client the first time the notes
            // modal is opened for an item that predates this column.
            $table->json('notes_list')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('checklist_items', function (Blueprint $table) {
            $table->dropColumn('notes_list');
        });
    }
};
