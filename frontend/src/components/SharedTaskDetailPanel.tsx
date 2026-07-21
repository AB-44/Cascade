import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle,
  Circle,
  Plus,
  ListTodo,
  User,
  Image as ImageIcon,
  Trash2,
  Play,
  Pause,
  Lock,
  StickyNote,
} from "lucide-react";
import {
  updateSharedGoal,
  updateSharedChecklistItem,
  createSharedChecklistItem,
  deleteSharedChecklistItem,
  findSharedStage,
  isSharedStageLocked,
  type SharedProject,
  type SharedProjectGoal,
  type SharedProjectChecklistItem,
} from "../lib/api";
import { priorityColor } from "../lib/goals";
import { useClosing } from "../lib/useClosing";
import { ProgressBar, Select } from "./ui";
import { MemberAvatar } from "./TeamPanel";
import { fileToResizedDataUrl, formatElapsed } from "./TaskDetailPanel";

const STATUS_OPTIONS: SharedProjectGoal["status"][] = ["Not Started", "In Progress", "Completed"];
const STATUS_LABEL: Record<SharedProjectGoal["status"], string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};
const PRIORITY_LABEL: Record<string, string> = { High: "عالية", Medium: "متوسطة", Low: "منخفضة" };
const MAX_IMAGES_PER_ITEM = 6;

interface Props {
  project: SharedProject;
  goal: SharedProjectGoal;
  onClose: () => void;
  onProjectUpdate: (updater: (p: SharedProject) => SharedProject) => void;
}

/**
 * Same look as the owner's TaskDetailPanel, but talks to the shared-project
 * API instead of the local store — so it never touches `goals`/the
 * full-replace PUT /goals sync. Only the assignee can actually change
 * anything here (backend enforces this too); everyone else gets the same
 * rich view with every control disabled, so nobody can accidentally tick
 * off or edit a task that isn't theirs.
 */
export default function SharedTaskDetailPanel({ project, goal, onClose, onProjectUpdate }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  // assignedTo may be stored as member id or member name — match both.
  const assignee =
    project.members.find((m) => m.id === goal.assignedTo) ??
    project.members.find((m) => m.name === goal.assignedTo);
  const myMember = project.members.find((m) => m.id === project.myMemberId);
  const isAssignee =
    !!project.myMemberId &&
    (goal.assignedTo === project.myMemberId || goal.assignedTo === myMember?.name);
  const stage = findSharedStage(project, goal);
  const stageLocked = isSharedStageLocked(project, stage);
  const canManage = isAssignee && !stageLocked;

  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notesOpenIds, setNotesOpenIds] = useState<Set<string>>(new Set());
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const anyItemRunning = goal.checklist.some((c) => c.startedAt);
  useEffect(() => {
    if (!goal.startedAt && !anyItemRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [goal.startedAt, anyItemRunning]);

  const patchGoal = (goalId: string, patch: Parameters<typeof updateSharedGoal>[2]) =>
    onProjectUpdate((p) => ({
      ...p,
      goals: p.goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g)),
    }));

  const patchItem = (itemId: string, patch: Partial<SharedProjectChecklistItem>) =>
    onProjectUpdate((p) => ({
      ...p,
      goals: p.goals.map((g) =>
        g.id !== goal.id ? g : { ...g, checklist: g.checklist.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) },
      ),
    }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("تعذّر حفظ التغيير");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: SharedProjectGoal["status"]) =>
    run(async () => {
      await updateSharedGoal(project.id, goal.id, { status });
      patchGoal(goal.id, { status });
    });

  const startTask = () =>
    run(async () => {
      const startedAt = new Date().toISOString();
      await updateSharedGoal(project.id, goal.id, { startedAt, accumulatedMs: 0, timerPaused: false });
      patchGoal(goal.id, { startedAt, accumulatedMs: 0, timerPaused: false });
      setNow(Date.now());
    });

  const pauseTask = () =>
    run(async () => {
      if (!goal.startedAt) return;
      const runningMs = Date.now() - new Date(goal.startedAt).getTime();
      const accumulatedMs = (goal.accumulatedMs ?? 0) + runningMs;
      await updateSharedGoal(project.id, goal.id, { startedAt: null, accumulatedMs, timerPaused: true });
      patchGoal(goal.id, { startedAt: null, accumulatedMs, timerPaused: true });
    });

  /** Recalculate progress from the updated checklist and sync to backend. */
  const syncProgress = async (
    updatedChecklist: SharedProjectChecklistItem[]
  ) => {
    const total = updatedChecklist.length;
    const doneCount = updatedChecklist.filter((c) => c.done).length;
    const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    const status: SharedProjectGoal["status"] =
      progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
    await updateSharedGoal(project.id, goal.id, { progress, status });
    patchGoal(goal.id, { progress, status });
  };

  const toggleItem = (item: SharedProjectChecklistItem) =>
    run(async () => {
      const done = !item.done;
      await updateSharedChecklistItem(project.id, goal.id, item.id, { done });
      const updatedChecklist = goal.checklist.map((c) =>
        c.id === item.id ? { ...c, done } : c
      );
      patchItem(item.id, { done });
      await syncProgress(updatedChecklist);
    });

  const addItem = () =>
    run(async () => {
      const text = newItem.trim();
      if (!text) return;
      const res = await createSharedChecklistItem(project.id, goal.id, text);
      const updatedChecklist = [...goal.checklist, res.item];
      onProjectUpdate((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.id === goal.id ? { ...g, checklist: updatedChecklist } : g)),
      }));
      setNewItem("");
      await syncProgress(updatedChecklist);
    });

  const removeItem = (itemId: string) =>
    run(async () => {
      await deleteSharedChecklistItem(project.id, goal.id, itemId);
      const updatedChecklist = goal.checklist.filter((it) => it.id !== itemId);
      onProjectUpdate((p) => ({
        ...p,
        goals: p.goals.map((g) => (g.id !== goal.id ? g : { ...g, checklist: updatedChecklist })),
      }));
      await syncProgress(updatedChecklist);
    });

  const startItemTimer = (item: SharedProjectChecklistItem) =>
    run(async () => {
      const startedAt = new Date().toISOString();
      await updateSharedChecklistItem(project.id, goal.id, item.id, { startedAt, accumulatedMs: 0, timerPaused: false });
      patchItem(item.id, { startedAt, accumulatedMs: 0, timerPaused: false });
      setNow(Date.now());
    });

  const pauseItemTimer = (item: SharedProjectChecklistItem) =>
    run(async () => {
      if (!item.startedAt) return;
      const runningMs = Date.now() - new Date(item.startedAt).getTime();
      const accumulatedMs = (item.accumulatedMs ?? 0) + runningMs;
      await updateSharedChecklistItem(project.id, goal.id, item.id, { startedAt: null, accumulatedMs, timerPaused: true });
      patchItem(item.id, { startedAt: null, accumulatedMs, timerPaused: true });
    });

  const addImages = (item: SharedProjectChecklistItem, files: FileList) =>
    run(async () => {
      const room = MAX_IMAGES_PER_ITEM - item.images.length;
      if (room <= 0) {
        alert("وصلت للحد الأقصى من الصور لهذا العنصر");
        return;
      }
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > 5 * 1024 * 1024) continue;
        added.push(await fileToResizedDataUrl(file));
      }
      if (added.length === 0) return;
      const images = [...item.images, ...added];
      await updateSharedChecklistItem(project.id, goal.id, item.id, { images });
      patchItem(item.id, { images });
    });

  const removeImage = (item: SharedProjectChecklistItem, index: number) =>
    run(async () => {
      const images = item.images.filter((_, i) => i !== index);
      await updateSharedChecklistItem(project.id, goal.id, item.id, { images });
      patchItem(item.id, { images });
    });

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const commitNotes = (item: SharedProjectChecklistItem) => {
    const draft = notesDraft[item.id];
    if (draft === undefined || draft === (item.notes ?? "")) return;
    run(async () => {
      await updateSharedChecklistItem(project.id, goal.id, item.id, { notes: draft });
      patchItem(item.id, { notes: draft });
    });
  };

  const toggleNotesOpen = (itemId: string) => {
    setNotesOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const doneCount = goal.checklist.filter((c) => c.done).length;
  const elapsedMs = (goal.accumulatedMs ?? 0) + (goal.startedAt ? now - new Date(goal.startedAt).getTime() : 0);

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
          style={{ borderBottom: `3px solid ${goal.color || "#6366f1"}` }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: (goal.color || "#6366f1") + "1f" }}
            >
              <ListTodo size={19} strokeWidth={2.25} style={{ color: goal.color || "#6366f1" }} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-semibold leading-tight text-ink">{goal.name}</h2>
              {goal.tag && (
                <span className="rounded-full bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  {goal.tag}
                </span>
              )}
            </div>
          </div>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-line px-5 py-4">
            {!canManage && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-basin-2/60 px-2.5 py-1.5 text-xs text-ink-soft">
                <Lock size={12} />
                {stageLocked
                  ? "هذي المرحلة مقفلة إلى أن تكتمل المرحلة السابقة"
                  : assignee
                  ? `هذي المهمة مسندة لـ${assignee.name} — عرض فقط`
                  : "هذي المهمة غير مسندة لك — عرض فقط"}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priorityColor(goal.priority) }} />
                {PRIORITY_LABEL[goal.priority] || goal.priority}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {assignee ? <MemberAvatar member={assignee} size={18} /> : <User size={14} />}
                {assignee ? assignee.name : "غير مسندة"}
              </span>
            </div>

            {canManage && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {goal.startedAt ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-500/12 px-2.5 py-1.5 text-xs font-semibold text-terrace-700 font-mono-num">
                      {formatElapsed(elapsedMs)}
                    </span>
                    <button
                      disabled={busy}
                      onClick={pauseTask}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                    >
                      <Pause size={13} /> إيقاف مؤقت
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy}
                    onClick={startTask}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
                  >
                    <Play size={13} /> بدء المهمة
                  </button>
                )}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-soft">
                <span>التقدم</span>
                <span className="font-mono-num font-semibold text-ink">{goal.progress}%</span>
              </div>
              <ProgressBar value={goal.progress} color={goal.color} />
            </div>

            <Select
              value={goal.status}
              disabled={!canManage || busy}
              onChange={(v) => changeStatus(v as SharedProjectGoal["status"])}
              fullWidth
              className="mt-3 w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-ink disabled:opacity-60"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />

            {goal.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-basin-2/50 p-3 text-sm text-ink-soft">
                {goal.notes}
              </p>
            )}
          </div>

          {error && (
            <p className="mx-5 mt-3 rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">
              {error}
            </p>
          )}

          {/* checklist */}
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                قائمة المهام
                <span className="rounded-full bg-basin-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                  {doneCount}/{goal.checklist.length}
                </span>
              </span>
            </div>

            <div className="space-y-2">
              {goal.checklist.map((item) => (
                <div key={item.id} className="terrace-card border border-line bg-basin-2/30 p-2.5">
                  <div className="flex items-start gap-2">
                    <button disabled={!canManage || busy} onClick={() => toggleItem(item)} className="mt-0.5 shrink-0 transition-transform duration-150 active:scale-90 disabled:opacity-60">
                      {item.done ? (
                        <CheckCircle size={18} className="text-terrace-600" />
                      ) : (
                        <Circle size={18} className="text-ink-soft/40" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? "text-ink-soft line-through" : "text-ink"}`}>
                      {item.text}
                    </span>
                    {canManage && (
                      <>
                        <input
                          ref={(el) => {
                            fileInputs.current[item.id] = el;
                          }}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => e.target.files && addImages(item, e.target.files)}
                        />
                        <button
                          disabled={busy}
                          onClick={() => fileInputs.current[item.id]?.click()}
                          className="shrink-0 rounded-md p-1 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
                        >
                          <ImageIcon size={16} />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 rounded-md p-1 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleNotesOpen(item.id)}
                      title="ملاحظة"
                      className={`shrink-0 rounded-md p-1 transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600 ${
                        notesOpenIds.has(item.id) || item.notes ? "text-terrace-600" : "text-ink-soft"
                      }`}
                    >
                      <StickyNote size={16} />
                    </button>
                  </div>

                  {item.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 ps-6">
                      {item.images.map((src, i) => (
                        <div key={i} className="group relative">
                          <img
                            src={src}
                            onClick={() => setPreview({ images: item.images, index: i })}
                            className="h-12 w-12 cursor-pointer rounded-lg object-cover transition-transform duration-150 hover:scale-105"
                          />
                          {canManage && (
                            <button
                              onClick={() => removeImage(item, i)}
                              className="absolute -top-1 -end-1 hidden h-4 w-4 items-center justify-center rounded-full bg-clay text-white group-hover:flex"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {notesOpenIds.has(item.id) && (
                    <textarea
                      value={notesDraft[item.id] ?? item.notes ?? ""}
                      disabled={!canManage || busy}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                      onBlur={() => commitNotes(item)}
                      placeholder="أضف ملاحظة..."
                      rows={2}
                      className="mt-2 ms-6 w-[calc(100%-1.5rem)] resize-y rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink-soft outline-none transition-colors duration-150 placeholder:text-ink-soft/50 focus:border-terrace-400 disabled:opacity-60"
                    />
                  )}

                  {canManage && (
                    <div className="mt-1.5 ps-6">
                      {item.startedAt ? (
                        <button onClick={() => pauseItemTimer(item)} className="font-mono-num text-xs font-medium text-gold-600 transition-colors duration-150 hover:underline">
                          إيقاف ({formatElapsed((item.accumulatedMs ?? 0) + (now - new Date(item.startedAt).getTime()))})
                        </button>
                      ) : (
                        <button onClick={() => startItemTimer(item)} className="text-xs font-medium text-terrace-600 transition-colors duration-150 hover:underline">
                          بدء المهمة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={addItem}
                  disabled={busy || !newItem.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-terrace-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                >
                  <Plus size={15} /> إضافة
                </button>
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="إضافة مهمة جديدة..."
                  className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 animate-fade-in"
          onClick={() => setPreview(null)}
        >
          <img src={preview.images[preview.index]} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
          <button onClick={() => setPreview(null)} className="absolute end-4 top-4 text-white transition-transform duration-150 hover:scale-110">
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  );
}
