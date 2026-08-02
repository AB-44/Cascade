import { useEffect, useRef, useState } from "react";
import { Timer, Pause, ChevronDown, ArrowLeft } from "lucide-react";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import { uid } from "../lib/storage";
import { formatElapsed } from "./TaskDetailPanel";
import type { Goal, TimeSession } from "../types";

/** Replaces the old header-wide "Complete All" button. Surfaces whatever
 *  goals currently have a running focus timer (goal.startedAt set), lets
 *  the person pause any of them right from the header, and jumps to the
 *  full task list for anything deeper. Purely goal-level timers here —
 *  a checklist item running inside a goal doesn't count as a separate
 *  "active task" for this summary. */
export default function ActiveTasksMenu({ onGotoTasks }: { onGotoTasks: () => void }) {
  const { goals, updateGoal, lang } = useStore();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const activeGoals = goals
    .filter((g) => !g.archived && g.startedAt)
    .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (activeGoals.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoals.length]);

  if (activeGoals.length === 0) return null;

  const elapsedFor = (g: Goal) =>
    (g.accumulatedMs ?? 0) + (g.startedAt ? now - new Date(g.startedAt).getTime() : 0);

  const pause = (g: Goal) => {
    if (!g.startedAt) return;
    const endNow = Date.now();
    const runningMs = endNow - new Date(g.startedAt).getTime();
    const session: TimeSession = {
      id: uid(),
      start: g.startedAt,
      end: new Date(endNow).toISOString(),
      durationMs: runningMs,
    };
    updateGoal(g.id, {
      startedAt: null,
      accumulatedMs: (g.accumulatedMs ?? 0) + runningMs,
      timerPaused: true,
      timeSessions: [...(g.timeSessions ?? []), session],
    });
  };

  const featured = activeGoals[0];

  const formatClock = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-lg border border-terrace-500/30 bg-terrace-500/10 px-3 text-sm transition-colors duration-150 hover:bg-terrace-500/15"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-terrace-500" />
        <span className="max-w-[160px] truncate font-medium text-terrace-700">{featured.name}</span>
        <span className="font-mono-num text-xs font-semibold text-terrace-600">{formatClock(elapsedFor(featured))}</span>
        <ChevronDown size={14} className={`shrink-0 text-terrace-600 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-menu-in">
          <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
            <Timer size={15} className="text-terrace-600" />
            <span className="text-sm font-bold text-ink">{t(lang, "activeTasks")}</span>
            <span className="rounded-full bg-terrace-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-terrace-700">
              {activeGoals.length}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {activeGoals.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-basin-2"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-terrace-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                  <p className="font-mono-num text-xs text-ink-soft">{formatElapsed(elapsedFor(g))}</p>
                </div>
                <button
                  onClick={() => pause(g)}
                  title={t(lang, "pauseTask")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                >
                  <Pause size={13} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onGotoTasks();
            }}
            className="flex w-full items-center justify-center gap-1 border-t border-line py-2.5 text-sm font-medium text-terrace-600 transition-colors duration-150 hover:bg-basin-2 hover:text-terrace-700"
          >
            {t(lang, "viewAllTasks")}
            <ArrowLeft size={13} className="rtl:rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}
