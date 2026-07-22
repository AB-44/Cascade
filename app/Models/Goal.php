<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Goal extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'user_id', 'parent_id', 'roadmap_owner_id', 'project_id',
        'name', 'requirements', 'notes', 'assigned_to', 'priority',
        'progress', 'auto_progress', 'status',
        'deadline', 'start_date', 'reminder', 'reminder_at', 'reminder_fired',
        'started_at', 'accumulated_ms', 'timer_paused',
        'estimated_ms', 'estimated_target_fired', 'break_reminder_fired',
        'tag', 'color', 'depends_on', 'archived', 'template_id',
        'order_index', 'collapsed',
    ];

    protected $casts = [
        'auto_progress' => 'boolean',
        'reminder' => 'boolean',
        'reminder_fired' => 'boolean',
        'timer_paused' => 'boolean',
        'estimated_target_fired' => 'boolean',
        'break_reminder_fired' => 'boolean',
        'archived' => 'boolean',
        'collapsed' => 'boolean',
        'deadline' => 'date:Y-m-d',
        'start_date' => 'date:Y-m-d',
        'reminder_at' => 'datetime',
        'started_at' => 'datetime',
        'depends_on' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->orderBy('order_index');
    }

    public function timeSessions(): HasMany
    {
        return $this->hasMany(TimeSession::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * `assigned_to` actually stores the team member's *name* (GoalForm sets
     * it to `m.name`, not `m.id` — see the matching logic in
     * AssignedGoalController/SharedProjectController, which check both to
     * stay safe). This relation is kept for convenience where the value
     * does happen to be an id, but don't rely on it alone.
     */
    public function assignedMember(): BelongsTo
    {
        return $this->belongsTo(TeamMember::class, 'assigned_to');
    }

    /**
     * True when this goal's stage (its top-level ancestor) is locked
     * because the project has sequential locking on and the stage right
     * before it isn't Completed yet. Used to gate writes both for
     * collaborators (SharedProjectController) and for the assignee acting
     * through AssignedGoalController — the owner's own PUT /goals stays
     * fully trusted, same as every other owner-only constraint.
     */
    public function isInLockedStage(): bool
    {
        $project = $this->project_id ? Project::find($this->project_id) : null;
        if (! $project || ! $project->sequential_lock) {
            return false;
        }

        $stage = $this;
        while ($stage->parent_id) {
            $parent = static::find($stage->parent_id);
            if (! $parent || $parent->id === $stage->id) {
                break; // no parent, or a corrupt cycle
            }
            $stage = $parent;
        }

        $stages = static::where('project_id', $project->id)
            ->whereNull('parent_id')
            ->orderBy('order_index')
            ->get(['id', 'status']);

        $position = $stages->search(fn ($s) => $s->id === $stage->id);
        if ($position === false || $position === 0) {
            return false; // first stage (or not part of a stage) is never locked
        }

        return $stages[$position - 1]->status !== 'Completed';
    }
}
