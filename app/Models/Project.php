<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'name', 'description', 'color', 'member_ids', 'sequential_lock'];

    protected $casts = [
        'member_ids' => 'array',
        'sequential_lock' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(ProjectInvitation::class);
    }

    /** Everyone with access to this project, owner included — tagged via
     *  pivot `role`. Powers the unified "my projects" directory. */
    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_collaborators')->withPivot('role')->withTimestamps();
    }

    /** Just the people the owner invited in — never includes the owner
     *  themselves. This is what the old "collaborators" meant; kept
     *  separate so the owner's own project never shows up in their own
     *  "who's on this project" list. */
    public function externalCollaborators(): BelongsToMany
    {
        return $this->collaborators()->wherePivot('role', '!=', 'owner');
    }
}
