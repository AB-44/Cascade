import { useEffect, useRef, useState } from "react";
import { Timer, Pause, Play, X, ChevronDown, ArrowLeft } from "lucide-react";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import { uid } from "../lib/storage";
import { formatElapsed } from "./TaskDetailPanel";
import type { Goal, TimeSession } from "../types";

/** Replaces the old header-wide "Complete All" button. Surfaces every
 *  goal that's part of an active focus session — either running right
 *  now (goal.startedAt set) or paused mid-session (timerPaused, with
 *  time already accumulated) — so pausing a task doesn't make it vanish
 *  from here; it just switches to a resume button. The only way a task
 *  leaves this list is the explicit dismiss (X), which clears the
 *  session tracking without touching the goal's own progress/status. A
 *  checklist item running inside a goal doesn't count as a separate
 *  "active task" for this summary — goal-level timers only. */
export default function ActiveTasksMenu({ onGotoTasks, onGoto }: { onGotoTasks: () => void; onGoto: (id: string) => void }) {
  const { goals, updateGoal, lang } = useStore();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const trackedGoals = goals
    .filter((g) => !g.archived && (g.startedAt || (g.timerPaused && (g.accumulatedMs ?? 0) > 0)))
    .sort((a, b) => {
      // Running tasks first, most recently started first; paused ones
      // after, most recently paused first (best-effort via updatedAt).
      if (!!a.startedAt !== !!b.startedAt) return a.startedAt ? -1 : 1;
      const aTime = a.startedAt ?? a.updatedAt ?? "";
      const bTime = b.startedAt ?? b.updatedAt ?? "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hasRunning = trackedGoals.some((g) => g.startedAt);

  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  if (trackedGoals.length === 0) return null;

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

  const resume = (g: Goal) => {
    updateGoal(g.id, {
      startedAt: new Date().toISOString(),
      timerPaused: false,
      breakReminderFired: false,
    });
  };

  // Just clears this task's session tracking so it drops off the list —
  // never touches progress, status, or the checklist itself.
  const dismiss = (g: Goal) => {
    updateGoal(g.id, {
      startedAt: null,
      accumulatedMs: 0,
      timerPaused: false,
    });
  };

  const featured = trackedGoals.find((g) => g.startedAt) ?? trackedGoals[0];

  const formatClock = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <div className="flex h-9 items-center rounded-lg border border-terrace-500/30 bg-terrace-500/10 text-sm transition-colors duration-150 hover:bg-terrace-500/15">
        <button
          onClick={() => {
            setOpen(false);
            onGoto(featured.id);
          }}
          className="flex h-full items-center gap-2 rounded-s-lg ps-3 pe-1.5"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-terrace-500" />
          <span className="max-w-[160px] truncate font-medium text-terrace-700">{featured.name}</span>
          <span className="font-mono-num text-xs font-semibold text-terrace-600">{formatClock(elapsedFor(featured))}</span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          title={t(lang, "activeTasks")}
          className="flex h-full items-center rounded-e-lg ps-1 pe-2.5"
        >
          <ChevronDown size={14} className={`shrink-0 text-terrace-600 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-menu-in">
          <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
            <Timer size={15} className="text-terrace-600" />
            <span className="text-sm font-bold text-ink">{t(lang, "activeTasks")}</span>
            <span className="rounded-full bg-terrace-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-terrace-700">
              {trackedGoals.length}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {trackedGoals.map((g) => (
              <div
                key={g.id}
                className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-basin-2"
              >
                <button
                  onClick={() => {
                    setOpen(false);
                    onGoto(g.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${g.startedAt ? "bg-terrace-500" : "bg-ink-soft/40"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                    <p className="font-mono-num text-xs text-ink-soft">{formatElapsed(elapsedFor(g))}</p>
                  </div>
                </button>
                <button
                  onClick={() => (g.startedAt ? pause(g) : resume(g))}
                  title={t(lang, g.startedAt ? "pauseTask" : "resumeTask")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                >
                  {g.startedAt ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  onClick={() => dismiss(g)}
                  title={t(lang, "removeFromActiveTasks")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-soft/60 opacity-0 transition-colors duration-150 hover:bg-clay/10 hover:text-clay group-hover:opacity-100"
                >
                  <X size={13} />
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
