<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_items', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('goal_id');
            $table->foreign('goal_id')->references('id')->on('goals')->cascadeOnDelete();

            $table->text('text');
            $table->boolean('done')->default(false);
            $table->json('images')->nullable(); // array of data URLs
            $table->integer('order_index')->default(0);

            // per-item focus timer
            $table->dateTime('started_at')->nullable();
            $table->unsignedBigInteger('accumulated_ms')->default(0);
            $table->boolean('timer_paused')->default(false);

            $table->timestamps();

            $table->index('goal_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_items');
    }
};
