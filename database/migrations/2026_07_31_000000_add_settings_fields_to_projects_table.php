<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->longText('image')->nullable()->after('color');
            $table->string('status', 20)->default('active')->after('is_shared');
            $table->boolean('show_on_dashboard')->default(true)->after('status');
            $table->boolean('allow_new_goals')->default(true)->after('show_on_dashboard');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['image', 'status', 'show_on_dashboard', 'allow_new_goals']);
        });
    }
};
