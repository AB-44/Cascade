<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goals', function (Blueprint $table) {
            $table->string('id')->primary(); // client-generated id (uid())
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // hierarchy
            $table->string('parent_id')->nullable();
            $table->string('roadmap_owner_id')->nullable();
            $table->string('project_id')->nullable();

            // core fields
            $table->string('name');
            $table->text('requirements')->nullable();
            $table->text('notes')->nullable();
            $table->string('assigned_to')->nullable(); // team_member id
            $table->enum('priority', ['High', 'Medium', 'Low'])->default('Medium');
            $table->unsignedTinyInteger('progress')->default(0);
            $table->boolean('auto_progress')->default(true);
            $table->enum('status', ['Not Started', 'In Progress', 'Completed'])->default('Not Started');

            // deadline & reminders
            $table->date('deadline')->nullable();
            $table->boolean('reminder')->default(false);
            $table->dateTime('reminder_at')->nullable();
            $table->boolean('reminder_fired')->default(false);

            // goal-level timer
            $table->dateTime('started_at')->nullable();
            $table->unsignedBigInteger('accumulated_ms')->default(0);
            $table->boolean('timer_paused')->default(false);
            $table->unsignedBigInteger('estimated_ms')->nullable();
            $table->boolean('estimated_target_fired')->default(false);
            $table->boolean('break_reminder_fired')->default(false);

            // misc
            $table->string('tag')->nullable();
            $table->string('color')->nullable();
            $table->json('depends_on')->nullable(); // array of goal ids
            $table->boolean('archived')->default(false);
            $table->string('template_id')->nullable();
            $table->integer('order_index')->default(0);
            $table->boolean('collapsed')->default(false);

            $table->timestamps();

            $table->index('parent_id');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goals');
    }
};
