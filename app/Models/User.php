<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'avatar', 'avatar_color'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function goals()
    {
        return $this->hasMany(Goal::class);
    }

    public function teamMembers()
    {
        return $this->hasMany(TeamMember::class);
    }

    public function projects()
    {
        return $this->hasMany(Project::class);
    }

    public function templates()
    {
        return $this->hasMany(GoalTemplate::class);
    }

    /** Projects owned by someone else that this user was invited into and
     *  accepted — excludes my own projects even though they now share the
     *  same underlying pivot table (see role != owner). */
    public function projectCollaborations()
    {
        return $this->belongsToMany(Project::class, 'project_collaborators')
            ->withPivot('role')
            ->wherePivot('role', '!=', 'owner')
            ->withTimestamps();
    }

    /** Every project I have any access to (own + collaborations), each
     *  tagged with my `role` — powers the unified project directory page. */
    public function allProjects()
    {
        return $this->belongsToMany(Project::class, 'project_collaborators')
            ->withPivot('role')
            ->withTimestamps();
    }
}
