<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checklist_items', function (Blueprint $table) {
            // Separate from the general "notes" field: this holds the
            // user's own write-up of *how* they completed the task
            // ("طريقتي في إنجاز المهمة"), plus optional supporting images.
            $table->text('completion_note')->nullable()->after('notes');
            $table->json('completion_images')->nullable()->after('completion_note');
        });
    }

    public function down(): void
    {
        Schema::table('checklist_items', function (Blueprint $table) {
            $table->dropColumn(['completion_note', 'completion_images']);
        });
    }
};
