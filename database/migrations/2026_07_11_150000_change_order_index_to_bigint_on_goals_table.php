<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * الفرونت اند يحط order = Date.now() لأي مهمة جديدة (رقم بـ 13 خانة)
 * عشان تنزل آخر القائمة تلقائيًا بدون ما يحسب أكبر order بين الإخوة.
 * عمود order_index كان INT عادي (حده الأقصى ~2.1 مليار) فكان يفيض مع
 * أي timestamp حقيقي على MySQL. SQLite ما يتأثر (typing ديناميكي)،
 * فالتعديل مربوط بـ MySQL فقط.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE goals MODIFY order_index BIGINT NOT NULL DEFAULT 0');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE goals MODIFY order_index INT NOT NULL DEFAULT 0');
        }
    }
};
