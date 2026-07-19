<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('goal_id');
            $table->foreign('goal_id')->references('id')->on('goals')->cascadeOnDelete();

            $table->dateTime('start');
            $table->dateTime('end');
            $table->unsignedBigInteger('duration_ms');

            $table->timestamps();

            $table->index('goal_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_sessions');
    }
};
