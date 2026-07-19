<?php

namespace App\Console\Commands;

use App\Models\Goal;
use App\Models\TeamMember;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-off cleanup for history predating the "reuse existing team_member id"
 * fix in TeamMemberController::sync. Before that fix, removing and re-adding
 * the same person (by email) created a brand new team_member row each time,
 * leaving older rows as orphaned duplicates — with old goals still pointing
 * at whichever row id was current when they were assigned. This command:
 *
 *   1. Groups team_members by (user_id, lower(email)) for members that have
 *      an email set (members without an email can't be safely merged).
 *   2. Keeps the most recently created row per group as the canonical one.
 *   3. Repoints any Goal.assigned_to referencing an older duplicate in the
 *      group to the canonical row's id.
 *   4. Deletes the now-unreferenced duplicate rows.
 *
 * Safe to run multiple times; groups with only one member are left alone.
 * Run with --dry-run first to see what would change without writing.
 */
class MergeDuplicateTeamMembers extends Command
{
    protected $signature = 'team-members:merge-duplicates {--dry-run : Show what would change without writing}';

    protected $description = 'Merge duplicate team_member rows for the same person (by email) into one, repointing assigned goals';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $groups = TeamMember::whereNotNull('email')
            ->where('email', '!=', '')
            ->get()
            ->groupBy(fn (TeamMember $m) => $m->user_id.'|'.strtolower($m->email));

        $mergedGroups = 0;
        $reassignedGoals = 0;
        $deletedMembers = 0;

        foreach ($groups as $key => $members) {
            if ($members->count() < 2) {
                continue;
            }

            $sorted = $members->sortByDesc(fn (TeamMember $m) => $m->created_at);
            $canonical = $sorted->first();
            $duplicates = $sorted->slice(1);
            $duplicateIds = $duplicates->pluck('id')->all();

            $this->line(sprintf(
                '[%s] canonical=%s (%s), duplicates=%s',
                $key,
                $canonical->id,
                $canonical->name,
                implode(', ', $duplicateIds)
            ));

            $affectedGoals = Goal::whereIn('assigned_to', $duplicateIds)->count();
            $this->line("  -> would repoint {$affectedGoals} goal(s) to {$canonical->id}");

            if (! $dryRun) {
                DB::transaction(function () use ($canonical, $duplicateIds) {
                    Goal::whereIn('assigned_to', $duplicateIds)->update(['assigned_to' => $canonical->id]);
                    TeamMember::whereIn('id', $duplicateIds)->delete();
                });
            }

            $mergedGroups++;
            $reassignedGoals += $affectedGoals;
            $deletedMembers += count($duplicateIds);
        }

        if ($mergedGroups === 0) {
            $this->info('No duplicate team_member groups found.');
            return self::SUCCESS;
        }

        $verb = $dryRun ? 'Would merge' : 'Merged';
        $this->info("{$verb} {$mergedGroups} group(s): {$reassignedGoals} goal(s) repointed, {$deletedMembers} duplicate member row(s) ".($dryRun ? 'to remove' : 'removed').'.');

        if ($dryRun) {
            $this->comment('Run again without --dry-run to apply.');
        }

        return self::SUCCESS;
    }
}
