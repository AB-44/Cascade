<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Named GoalTemplate (not Template) to avoid clashing with common framework names.
class GoalTemplate extends Model
{
    protected $table = 'templates';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'name', 'nodes'];

    protected $casts = [
        'nodes' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
