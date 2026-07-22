import { CalendarClock, User } from "lucide-react";
import type { Goal } from "../types";
import { useStore } from "../store";
import { priorityColor } from "../lib/goals";
import { DeadlineBadge } from "./GoalBadges";
import { Badge } from "./ui";
import { t } from "../lib/i18n";

/**
 * Table of every in-scope goal that has a deadline, soonest first.
 * Reuses the same `filter` predicate the Tree/Roadmap views take, so it
 * automatically respects the current project scope, roadmap owner, search,
 * and filter-panel selections — no separate filtering logic to keep in sync.
 */
export default function DeadlinesView({
  filter,
  onEdit,
}: {
  filter: (g: Goal) => boolean;
  onEdit: (g: Goal) => void;
}) {
  const { goals, members, lang } = useStore();

  const rows = goals
    .filter((g) => !g.archived && g.deadline && filter(g))
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const statusLabel = (s: Goal["status"]) => {
    if (s === "Completed") return t(lang, "completed");
    if (s === "In Progress") return t(lang, "inProgress");
    return t(lang, "notStarted");
  };

  const statusClass = (s: Goal["status"]) => {
    if (s === "Completed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    if (s === "In Progress") return "bg-terrace-100 text-terrace-700 dark:bg-terrace-500/20 dark:text-terrace-300";
    return "bg-basin-2 text-ink-soft";
  };

  if (rows.length === 0) {
    return (
      <div className="terrace-card flex flex-col items-center gap-2 border border-line bg-card px-4 py-16 text-center">
        <CalendarClock size={28} className="text-ink-soft" />
        <p className="text-sm text-ink-soft">{t(lang, "noDeadlines")}</p>
      </div>
    );
  }

  return (
    <div className="terrace-card overflow-hidden border border-line bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-start text-xs text-ink-soft">
            <th className="px-4 py-3 text-start font-medium">{t(lang, "name")}</th>
            <th className="px-4 py-3 text-start font-medium">{t(lang, "deadline")}</th>
            <th className="px-4 py-3 text-start font-medium">{t(lang, "status")}</th>
            <th className="px-4 py-3 text-start font-medium">{t(lang, "assignTo")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const member = members.find((m) => m.name === g.assignedTo);
            return (
              <tr
                key={g.id}
                onClick={() => onEdit(g)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-basin-2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: priorityColor(g.priority) }}
                    />
                    <span className={`min-w-0 truncate text-ink ${g.status === "Completed" ? "line-through opacity-60" : ""}`}>
                      {g.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <DeadlineBadge goal={g} />
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusClass(g.status)}>{statusLabel(g.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {g.assignedTo ? (
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: member?.color || "var(--color-terrace-500)" }}
                      >
                        {member?.avatar ? (
                          <img src={member.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <User size={11} />
                        )}
                      </span>
                      <span className="truncate">{g.assignedTo}</span>
                    </span>
                  ) : (
                    <span className="text-ink-soft/50">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
