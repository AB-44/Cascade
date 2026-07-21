import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle,
  Circle,
  Plus,
  CheckCheck,
  ListTodo,
  User,
  CalendarClock,
  Image as ImageIcon,
  Trash2,
  Play,
  Pause,
  Timer,
  RotateCcw,
  Target,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  StickyNote,
} from "lucide-react";
import type { Goal, ChecklistItem, TimeSession } from "../types";
import { useStore } from "../store";
import { deadlineState, priorityColor } from "../lib/goals";
import { uid } from "../lib/storage";
import { t } from "../lib/i18n";
import { useClosing } from "../lib/useClosing";
import { MemberAvatar } from "./TeamPanel";

interface Props {
  goal: Goal;
  onClose: () => void;
}

const MAX_IMAGES_PER_ITEM = 6;

// Helper: compress an uploaded file to a data URL with a max dimension
export function fileToResizedDataUrl(
  file: File,
  maxDim = 500,
  quality = 0.78,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = (h * maxDim) / w;
          w = maxDim;
        } else if (h > maxDim) {
          w = (w * maxDim) / h;
          h = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TaskDetailPanel({ goal, onClose }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  const { updateGoal, effProgress, lang, members } = useStore();
  const member = members.find((m) => m.name === goal.assignedTo);
  const [newItem, setNewItem] = useState("");
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null);
  const progress = effProgress(goal);
  const doneItems = goal.checklist.filter((c) => c.done).length;
  const totalItems = goal.checklist.length;
  const [now, setNow] = useState(Date.now());

  const [showTargetModal, setShowTargetModal] = useState(false);

  const anyItemRunning = goal.checklist.some((c) => c.startedAt);

  // tick while the panel is open so elapsed time stays fresh
  // (more frequent when a target duration is set, to detect it promptly)
  useEffect(() => {
    if (!goal.startedAt && !anyItemRunning) return;
    const ms = goal.estimatedMs ? 5000 : 30000;
    const interval = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(interval);
  }, [goal.startedAt, goal.estimatedMs, anyItemRunning]);

  const startTask = () => {
    updateGoal(goal.id, {
      startedAt: new Date().toISOString(),
      accumulatedMs: 0,
      timerPaused: false,
      estimatedTargetFired: false,
      breakReminderFired: false,
    });
    setNow(Date.now());
  };

  const pauseTask = () => {
    if (!goal.startedAt) return;
    const endNow = Date.now();
    const runningMs = endNow - new Date(goal.startedAt).getTime();
    const session: TimeSession = {
      id: uid(),
      start: goal.startedAt,
      end: new Date(endNow).toISOString(),
      durationMs: runningMs,
    };
    updateGoal(goal.id, {
      startedAt: null,
      accumulatedMs: (goal.accumulatedMs ?? 0) + runningMs,
      timerPaused: true,
      timeSessions: [...(goal.timeSessions ?? []), session],
    });
  };

  const resumeTask = () => {
    updateGoal(goal.id, {
      startedAt: new Date().toISOString(),
      timerPaused: false,
      breakReminderFired: false,
    });
    setNow(Date.now());
  };

  const elapsedMs =
    (goal.accumulatedMs ?? 0) + (goal.startedAt ? now - new Date(goal.startedAt).getTime() : 0);
  const breakDue = goal.startedAt && elapsedMs >= 60 * 60 * 1000;

  // auto-pause when the estimated target duration is reached
  useEffect(() => {
    if (!goal.startedAt || !goal.estimatedMs || goal.estimatedTargetFired) return;
    const runningMs = now - new Date(goal.startedAt).getTime();
    const elapsed = (goal.accumulatedMs ?? 0) + runningMs;
    if (elapsed < goal.estimatedMs) return;
    const endNow = Date.now();
    const actualRunningMs = endNow - new Date(goal.startedAt).getTime();
    const session: TimeSession = {
      id: uid(),
      start: goal.startedAt,
      end: new Date(endNow).toISOString(),
      durationMs: actualRunningMs,
    };
    updateGoal(goal.id, {
      startedAt: null,
      accumulatedMs: (goal.accumulatedMs ?? 0) + actualRunningMs,
      timerPaused: true,
      estimatedTargetFired: true,
      timeSessions: [...(goal.timeSessions ?? []), session],
    });
    setShowTargetModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, goal.startedAt, goal.estimatedMs, goal.estimatedTargetFired]);

  const patchList = (next: ChecklistItem[]) => {
    updateGoal(goal.id, { checklist: next });
  };

  const toggleCheck = (itemId: string) => {
    const nowMs = Date.now();
    patchList(
      goal.checklist.map((c) => {
        if (c.id !== itemId) return c;
        const willBeDone = !c.done;
        // stop the focus timer automatically when the item is marked done
        if (willBeDone && c.startedAt) {
          const runningMs = nowMs - new Date(c.startedAt).getTime();
          return {
            ...c,
            done: willBeDone,
            startedAt: null,
            accumulatedMs: (c.accumulatedMs ?? 0) + runningMs,
            timerPaused: true,
          };
        }
        return { ...c, done: willBeDone };
      }),
    );
  };

  const updateText = (itemId: string, text: string) => {
    patchList(goal.checklist.map((c) => (c.id === itemId ? { ...c, text } : c)));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    patchList(goal.checklist.map((c) => (c.id === itemId ? { ...c, notes } : c)));
  };

  const addImagesToItem = async (itemId: string, files: FileList) => {
    const item = goal.checklist.find((c) => c.id === itemId);
    const existing = item?.images ?? (item?.image ? [item.image] : []);
    const room = MAX_IMAGES_PER_ITEM - existing.length;
    if (room <= 0) {
      alert(t(lang, "maxImagesReached"));
      return;
    }
    const toProcess = Array.from(files).slice(0, room);
    const added: string[] = [];
    for (const file of toProcess) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t(lang, "imageTooLarge"));
        continue;
      }
      try {
        added.push(await fileToResizedDataUrl(file));
      } catch (e) {
        console.error(e);
        alert(t(lang, "imageAddFailed"));
      }
    }
    if (added.length === 0) return;
    patchList(
      goal.checklist.map((c) =>
        c.id === itemId ? { ...c, images: [...existing, ...added] } : c,
      ),
    );
  };

  const removeImage = (itemId: string, index: number) => {
    patchList(
      goal.checklist.map((c) => {
        if (c.id !== itemId) return c;
        const existing = c.images ?? (c.image ? [c.image] : []);
        return { ...c, images: existing.filter((_, i) => i !== index), image: null };
      }),
    );
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = {
      id: uid(),
      text: newItem.trim(),
      done: false,
      images: [],
    };
    patchList([...goal.checklist, item]);
    setNewItem("");
  };

  const removeItem = (itemId: string) => {
    patchList(goal.checklist.filter((c) => c.id !== itemId));
  };

  // focus timer per checklist item — starting one auto-pauses any other running item
  const startItemTimer = (itemId: string) => {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    patchList(
      goal.checklist.map((c) => {
        if (c.id === itemId) {
          return { ...c, startedAt: nowIso, accumulatedMs: 0, timerPaused: false };
        }
        if (c.startedAt) {
          const runningMs = nowMs - new Date(c.startedAt).getTime();
          return {
            ...c,
            startedAt: null,
            accumulatedMs: (c.accumulatedMs ?? 0) + runningMs,
            timerPaused: true,
          };
        }
        return c;
      }),
    );
    setNow(nowMs);
  };

  const pauseItemTimer = (itemId: string) => {
    const nowMs = Date.now();
    patchList(
      goal.checklist.map((c) => {
        if (c.id !== itemId || !c.startedAt) return c;
        const runningMs = nowMs - new Date(c.startedAt).getTime();
        return {
          ...c,
          startedAt: null,
          accumulatedMs: (c.accumulatedMs ?? 0) + runningMs,
          timerPaused: true,
        };
      }),
    );
  };

  const resumeItemTimer = (itemId: string) => {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    patchList(
      goal.checklist.map((c) => {
        if (c.id === itemId) return { ...c, startedAt: nowIso, timerPaused: false };
        if (c.startedAt) {
          const runningMs = nowMs - new Date(c.startedAt).getTime();
          return {
            ...c,
            startedAt: null,
            accumulatedMs: (c.accumulatedMs ?? 0) + runningMs,
            timerPaused: true,
          };
        }
        return c;
      }),
    );
    setNow(nowMs);
  };

  const reorderChecklist = (draggedId: string, beforeId: string | null) => {
    if (draggedId === beforeId) return;
    const list = [...goal.checklist];
    const fromIdx = list.findIndex((c) => c.id === draggedId);
    if (fromIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    const toIdx = beforeId ? list.findIndex((c) => c.id === beforeId) : -1;
    if (toIdx === -1) list.push(moved);
    else list.splice(toIdx, 0, moved);
    patchList(list);
  };

  const markAllDone = () => {
    patchList(goal.checklist.map((c) => ({ ...c, done: true })));
  };

  const ds = deadlineState(goal.deadline, goal.status);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-lg flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        {/* header */}
        <div
          className="flex items-center justify-between bg-basin-2/50 px-5 py-4"
          style={{ borderBottom: `3px solid ${goal.color}` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: goal.color + "1f" }}
              >
                <ListTodo size={19} strokeWidth={2.25} style={{ color: goal.color }} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl font-semibold leading-tight text-ink">
                  {goal.name}
                </h2>
                {goal.tag && (
                  <span className="rounded-full bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                    {goal.tag}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* goal info summary */}
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: priorityColor(goal.priority) }}
                />
                {t(lang, goal.priority.toLowerCase() as "high" | "medium" | "low")}
              </span>
              {goal.assignedTo && (
                <span className="inline-flex items-center gap-1.5">
                  {member ? <MemberAvatar member={member} size={18} /> : <User size={14} />}
                  {goal.assignedTo}
                </span>
              )}
              {goal.deadline && (
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    ds === "overdue"
                      ? "text-clay"
                      : ds === "today"
                        ? "text-gold-600"
                        : ""
                  }`}
                >
                  <CalendarClock size={14} />
                  {new Date(goal.deadline).toLocaleDateString()}
                  {ds === "overdue" && ` ${t(lang, "overdueParen")}`}
                  {ds === "today" && ` ${t(lang, "todayParen")}`}
                </span>
              )}
            </div>

            {/* task timer / start button */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {goal.startedAt ? (
                <>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold font-mono-num ${
                      breakDue
                        ? "bg-gold-100 text-gold-600"
                        : "bg-terrace-500/12 text-terrace-700"
                    }`}
                  >
                    <Timer size={14} />
                    {t(lang, "elapsedSince")}: {formatElapsed(elapsedMs)}
                    {goal.estimatedMs ? ` / ${formatElapsed(goal.estimatedMs)}` : ""}
                  </span>
                  {breakDue && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-600">
                      ☕ {t(lang, "breakReminderToast")}
                    </span>
                  )}
                  <button
                    onClick={pauseTask}
                    title={t(lang, "pauseTask")}
                    className="inline-flex items-center gap-1 rounded-lg bg-gold-100 px-2 py-1.5 text-xs font-medium text-gold-600 transition-colors duration-150 hover:bg-gold-100/70"
                  >
                    <Pause size={13} />
                    {t(lang, "pauseTask")}
                  </button>
                  <button
                    onClick={startTask}
                    title={t(lang, "restartTask")}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                  >
                    <RotateCcw size={13} />
                    {t(lang, "restartTask")}
                  </button>
                </>
              ) : goal.timerPaused ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-basin-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft font-mono-num">
                    <Timer size={14} />
                    {t(lang, "elapsedSince")}: {formatElapsed(elapsedMs)}
                    {goal.estimatedMs ? ` / ${formatElapsed(goal.estimatedMs)}` : ""} ({t(lang, "paused")})
                  </span>
                  <button
                    onClick={resumeTask}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
                  >
                    <Play size={13} />
                    {t(lang, "resumeTask")}
                  </button>
                  <button
                    onClick={startTask}
                    title={t(lang, "restartTask")}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                  >
                    <RotateCcw size={13} />
                    {t(lang, "restartTask")}
                  </button>
                </>
              ) : (
                <button
                  onClick={startTask}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
                >
                  <Play size={13} />
                  {t(lang, "startTask")}
                </button>
              )}
            </div>

            {/* time report */}
            {(goal.timeSessions?.length ?? 0) > 0 && (
              <TimeReport sessions={goal.timeSessions!} estimatedMs={goal.estimatedMs} lang={lang} />
            )}

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-ink-soft">
                <span>{t(lang, "progress")}</span>
                <span className="font-mono-num font-semibold text-ink">{progress}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-basin-2">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%`, backgroundColor: goal.color }}
                />
              </div>
            </div>
            {goal.requirements && (
              <p className="mt-3 text-xs text-ink-soft">
                {goal.requirements}
              </p>
            )}
          </div>

          {/* checklist section */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <CheckCheck size={18} className="text-terrace-600" />
                {t(lang, "taskList")}
                {totalItems > 0 && (
                  <span className="rounded-full bg-terrace-500/12 px-2 py-0.5 text-[11px] font-medium text-terrace-700">
                    {doneItems}/{totalItems}
                  </span>
                )}
              </h3>
              {totalItems > 0 && doneItems < totalItems && (
                <button
                  onClick={markAllDone}
                  className="text-xs font-medium text-terrace-600 transition-colors duration-150 hover:text-terrace-700"
                >
                  {t(lang, "markAllDone")}
                </button>
              )}
            </div>

            {totalItems === 0 ? (
              <div className="my-8 flex flex-col items-center text-center">
                <ListTodo size={40} className="text-ink-soft/30" />
                <p className="mt-3 text-sm font-medium text-ink-soft">
                  {t(lang, "noTasksYet")}
                </p>
                <p className="mt-1 text-xs text-ink-soft/70">
                  {t(lang, "noTasksYetHint")}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {goal.checklist.map((item) => (
                  <TaskItem
                    key={item.id}
                    item={item}
                    onToggle={() => toggleCheck(item.id)}
                    onTextChange={(text) => updateText(item.id, text)}
                    onNotesChange={(notes) => updateItemNotes(item.id, notes)}
                    onAddImages={(files) => addImagesToItem(item.id, files)}
                    onRemoveImage={(idx) => removeImage(item.id, idx)}
                    onDelete={() => removeItem(item.id)}
                    onOpenPreview={(images, index) => setPreview({ images, index })}
                    onReorder={reorderChecklist}
                    onStartTimer={() => startItemTimer(item.id)}
                    onPauseTimer={() => pauseItemTimer(item.id)}
                    onResumeTimer={() => resumeItemTimer(item.id)}
                    now={now}
                    lang={lang}
                  />
                ))}
                <ListEndDropZone onDrop={(id) => reorderChecklist(id, null)} />
              </div>
            )}

            {/* add new task */}
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
                  placeholder={t(lang, "addNewTask")}
                  className="flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15"
                />
                <button
                  onClick={() => addItem()}
                  disabled={!newItem.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                >
                  <Plus size={16} /> {t(lang, "addBtn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-6 animate-fade-in"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview.images[preview.index]}
            alt=""
            className="max-h-full max-w-full rounded-xl shadow-2xl"
          />
          {preview.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview((p) =>
                    p
                      ? { ...p, index: (p.index - 1 + p.images.length) % p.images.length }
                      : p,
                  );
                }}
                className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/20"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview((p) =>
                    p ? { ...p, index: (p.index + 1) % p.images.length } : p,
                  );
                }}
                className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/20"
              >
                <ChevronRight size={22} />
              </button>
              <div className="absolute bottom-6 start-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
                {preview.index + 1} / {preview.images.length}
              </div>
            </>
          )}
          <button
            onClick={() => setPreview(null)}
            className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/20"
          >
            <X size={22} />
          </button>
        </div>
      )}

      {/* Estimated target reached modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-6 animate-fade-in">
          <div className="terrace-card w-full max-w-sm bg-card p-5 text-center shadow-2xl animate-scale-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-100 text-gold-600">
              <Target size={22} />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">
              {t(lang, "targetReachedTitle")}
            </h3>
            <p className="mt-1.5 text-sm text-ink-soft">
              {t(lang, "targetReachedBody")}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowTargetModal(false)}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 active:scale-[0.97]"
              >
                {t(lang, "stopHere")}
              </button>
              <button
                onClick={() => {
                  resumeTask();
                  setShowTargetModal(false);
                }}
                className="flex-1 rounded-lg bg-terrace-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
              >
                {t(lang, "continueWorking")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  done,
}: {
  value: string;
  onChange: (text: string) => void;
  done: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={`flex-1 resize-none overflow-hidden break-words bg-transparent px-1 py-1 text-sm outline-none transition-colors duration-150 ${
        done
          ? "text-terrace-700 line-through"
          : "text-ink"
      }`}
    />
  );
}

function TaskItem({
  item,
  onToggle,
  onTextChange,
  onNotesChange,
  onAddImages,
  onRemoveImage,
  onDelete,
  onOpenPreview,
  onReorder,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  now,
  lang,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onNotesChange: (notes: string) => void;
  onAddImages: (files: FileList) => void;
  onRemoveImage: (index: number) => void;
  onDelete: () => void;
  onOpenPreview: (images: string[], index: number) => void;
  onReorder: (draggedId: string, beforeId: string | null) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  now: number;
  lang: "en" | "ar";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notesOpen, setNotesOpen] = useState(!!item.notes);
  const images = item.images ?? (item.image ? [item.image] : []);
  const canAddMore = images.length < MAX_IMAGES_PER_ITEM;
  const itemElapsedMs =
    (item.accumulatedMs ?? 0) + (item.startedAt ? now - new Date(item.startedAt).getTime() : 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/checklistItemId");
        if (id && id !== item.id) onReorder(id, item.id);
      }}
      className={`rounded-xl border p-3 transition-colors duration-150 ${
        dragOver
          ? "border-terrace-500 ring-2 ring-terrace-500/30"
          : item.startedAt
            ? "border-terrace-400 ring-2 ring-terrace-400/25"
            : item.done
              ? "border-terrace-200 bg-terrace-500/5"
              : "border-line bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/checklistItemId", item.id);
          }}
          className="mt-1.5 shrink-0 cursor-grab touch-none text-ink-soft/40 transition-colors duration-150 hover:text-ink-soft active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </span>
        <button
          onClick={onToggle}
          className={`mt-1 shrink-0 transition-all duration-150 active:scale-90 ${
            item.done
              ? "text-terrace-600"
              : "text-ink-soft/40 hover:text-terrace-500"
          }`}
        >
          {item.done ? <CheckCircle size={22} /> : <Circle size={22} />}
        </button>
        <AutoGrowTextarea
          value={item.text}
          onChange={onTextChange}
          done={item.done}
        />
        <div className="flex items-center gap-1 opacity-70 transition-opacity duration-150 hover:opacity-100">
          <button
            onClick={() => setNotesOpen((v) => !v)}
            title={t(lang, "itemNotes")}
            className={`rounded-md p-1.5 transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600 ${
              notesOpen || item.notes ? "text-terrace-600" : "text-ink-soft"
            }`}
          >
            <StickyNote size={15} />
          </button>
          {canAddMore && (
            <button
              onClick={() => fileRef.current?.click()}
              title={t(lang, "addImage")}
              className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
            >
              <ImageIcon size={15} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onAddImages(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={onDelete}
            title={t(lang, "delete")}
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {images.map((src, i) => (
            <div key={i} className="group/image relative">
              <img
                src={src}
                alt=""
                onClick={() => onOpenPreview(images, i)}
                className="h-14 w-14 cursor-zoom-in rounded-lg border border-line object-cover transition-transform duration-150 hover:scale-105"
              />
              <button
                onClick={() => onRemoveImage(i)}
                className="absolute -end-1 -top-1 rounded-full bg-ink/60 p-0.5 text-white opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 hover:bg-clay"
                title={t(lang, "removeImage")}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {canAddMore && (
            <button
              onClick={() => fileRef.current?.click()}
              title={t(lang, "addImage")}
              className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-line text-ink-soft/50 transition-colors duration-150 hover:border-terrace-400 hover:text-terrace-500"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      )}

      {notesOpen && (
        <div className="mt-2">
          <textarea
            value={item.notes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t(lang, "itemNotesPlaceholder")}
            rows={2}
            className="w-full resize-y rounded-lg border border-line bg-basin-2/40 px-2.5 py-1.5 text-xs text-ink-soft outline-none transition-colors duration-150 placeholder:text-ink-soft/50 focus:border-terrace-400"
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          {item.startedAt ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-terrace-500/12 px-2 py-1 text-[11px] font-semibold text-terrace-700 font-mono-num">
                <Timer size={11} />
                {formatElapsed(itemElapsedMs)}
              </span>
              <button
                onClick={onPauseTimer}
                title={t(lang, "pauseTask")}
                className="inline-flex items-center gap-1 rounded-lg bg-gold-100 px-2 py-1 text-[11px] font-medium text-gold-600 transition-colors duration-150 hover:bg-gold-100/70"
              >
                <Pause size={11} />
              </button>
            </div>
          ) : item.done && item.timerPaused ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-basin-2 px-2 py-1 text-[11px] font-semibold text-ink-soft font-mono-num">
              <Timer size={11} />
              {formatElapsed(itemElapsedMs)}
            </span>
          ) : item.timerPaused ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-basin-2 px-2 py-1 text-[11px] font-semibold text-ink-soft font-mono-num">
                <Timer size={11} />
                {formatElapsed(itemElapsedMs)}
              </span>
              <button
                onClick={onResumeTimer}
                title={t(lang, "resumeTask")}
                className="inline-flex items-center gap-1 rounded-lg bg-terrace-600 px-2 py-1 text-[11px] font-medium text-white transition-colors duration-150 hover:bg-terrace-700"
              >
                <Play size={11} />
                {t(lang, "resumeTask")}
              </button>
            </div>
          ) : !item.done ? (
            <button
              onClick={onStartTimer}
              title={t(lang, "focusOnTask")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/10"
            >
              <Play size={11} />
              {t(lang, "startTask")}
            </button>
          ) : null}
        </div>
        <button
          onClick={onToggle}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
            item.done
              ? "bg-terrace-500/12 text-terrace-700 hover:bg-terrace-500/20"
              : "bg-terrace-600 text-white hover:bg-terrace-700"
          }`}
        >
          <CheckCircle size={12} />
          {item.done ? t(lang, "doneBtn") : t(lang, "markDone")}
        </button>
      </div>
    </div>
  );
}

function ListEndDropZone({ onDrop }: { onDrop: (draggedId: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/checklistItemId");
        if (id) onDrop(id);
      }}
      className={`h-3 rounded-full transition-colors duration-150 ${dragOver ? "bg-terrace-400/30 ring-2 ring-terrace-400" : ""}`}
    />
  );
}

function TimeReport({
  sessions,
  estimatedMs,
  lang,
}: {
  sessions: TimeSession[];
  estimatedMs?: number | null;
  lang: "en" | "ar";
}) {
  const [open, setOpen] = useState(false);
  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const overBudget = estimatedMs ? totalMs > estimatedMs : false;

  return (
    <div className="mt-3 rounded-xl border border-line bg-basin-2/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
      >
        <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
          <Target size={13} />
          {t(lang, "timeReport")} · {sessions.length} {t(lang, "sessions")}
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold font-mono-num ${
            overBudget
              ? "bg-clay/10 text-clay"
              : "bg-terrace-500/12 text-terrace-700"
          }`}
        >
          {overBudget && <AlertTriangle size={12} />}
          {formatElapsed(totalMs)}
          {estimatedMs ? ` / ${formatElapsed(estimatedMs)}` : ""}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line px-3 py-2 animate-slide-down">
          {sessions
            .slice()
            .reverse()
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-[11px] text-ink-soft"
              >
                <span>
                  {new Date(s.start).toLocaleDateString(lang === "ar" ? "ar-EG" : undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(s.start).toLocaleTimeString(lang === "ar" ? "ar-EG" : undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-mono-num font-medium text-ink">
                  {formatElapsed(s.durationMs)}
                </span>
              </div>
            ))}
          {estimatedMs && (
            <p
              className={`mt-1 border-t border-line pt-1.5 text-[11px] font-medium ${
                overBudget ? "text-clay" : "text-terrace-600"
              }`}
            >
              {overBudget
                ? `${t(lang, "overBudgetBy")} ${formatElapsed(totalMs - estimatedMs)}`
                : `${t(lang, "withinBudget")} (${formatElapsed(estimatedMs - totalMs)} ${t(lang, "remaining")})`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
