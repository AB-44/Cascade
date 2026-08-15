<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistItem extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'goal_id', 'text', 'notes', 'done', 'images', 'order_index',
        'started_at', 'accumulated_ms', 'timer_paused',
        'completion_note', 'completion_images',
    ];

    protected $casts = [
        'done' => 'boolean',
        'images' => 'array',
        'timer_paused' => 'boolean',
        'started_at' => 'datetime',
        'completion_images' => 'array',
    ];

    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }
}
