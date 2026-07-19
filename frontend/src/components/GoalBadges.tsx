import { AlertTriangle, CalendarClock, Lock } from "lucide-react";
import { Badge } from "./ui";
import type { Goal } from "../types";
import { deadlineState } from "../lib/goals";
import { useStore } from "../store";
import { t } from "../lib/i18n";

export function DeadlineBadge({ goal }: { goal: Goal }) {
  const { lang } = useStore();
  if (!goal.deadline) return null;
  const state = deadlineState(goal.deadline, goal.status);
  const date = new Date(goal.deadline).toLocaleDateString(lang === "ar" ? "ar-EG" : undefined, {
    month: "short",
    day: "numeric",
  });
  if (state === "overdue")
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
        <AlertTriangle size={11} /> {t(lang, "overdue")} · {date}
      </Badge>
    );
  if (state === "today")
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        <CalendarClock size={11} /> {t(lang, "dueToday")}
      </Badge>
    );
  if (state === "soon")
    return (
      <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
        <CalendarClock size={11} /> {t(lang, "dueSoon")} · {date}
      </Badge>
    );
  return (
    <Badge className="bg-basin-2 text-ink-soft">
      <CalendarClock size={11} /> {date}
    </Badge>
  );
}

export function BlockedBadge() {
  const { lang } = useStore();
  return (
    <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
      <Lock size={11} /> {t(lang, "blocked")}
    </Badge>
  );
}
