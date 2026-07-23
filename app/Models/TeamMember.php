<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamMember extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'linked_user_id', 'joined_via_project', 'name', 'role', 'email', 'avatar', 'color'];

    protected $casts = [
        'joined_via_project' => 'boolean',
    ];

    /**
     * The account that owns/created this team-member entry.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The real registered account this member label resolves to (matched
     * by email), if that person has an account. Null if the person hasn't
     * registered yet, or the email doesn't match anyone.
     */
    public function linkedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_user_id');
    }
}
