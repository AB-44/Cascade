import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  X,
  Loader2,
  CheckSquare,
  Square,
  User,
  FolderDot,
  Lock,
  StickyNote,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchAssignedToMe,
  updateAssignedGoal,
  updateAssignedChecklistItem,
  ApiError,
  type AssignedGoal,
} from "../lib/api";
import { priorityColor } from "../lib/goals";
import { useClosing } from "../lib/useClosing";
import { Select } from "./ui";

const STATUS_OPTIONS: AssignedGoal["status"][] = ["Not Started", "In Progress", "Completed"];

const STATUS_LABEL: Record<AssignedGoal["status"], string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};

type Bucket = "overdue" | "today" | "upcoming" | "noDate";

function bucketOf(g: AssignedGoal): Bucket {
  if (!g.deadline) return "noDate";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(g.deadline);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "upcoming";
}

const SECTIONS: { id: Bucket; label: string; icon: typeof AlertTriangle; color: string }[] = [
  { id: "overdue", label: "متأخرة", icon: AlertTriangle, color: "text-red-600" },
  { id: "today", label: "اليوم", icon: CalendarClock, color: "text-terrace-600" },
  { id: "upcoming", label: "قادمة", icon: CalendarClock, color: "text-ink-soft" },
  { id: "noDate", label: "بدون تاريخ", icon: CalendarX2, color: "text-ink-soft" },
];

/**
 * Breadcrumb badge: task name lives on the card title already, so this just
 * traces (project ⬅ stage) — the two levels of context a bare task name
 * would otherwise lose.
 */
function Breadcrumb({ goal }: { goal: AssignedGoal }) {
  if (!goal.projectName && !goal.stageName) return null;
  const Arrow = document.dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-ink-soft">
      {goal.projectName && (
        <span className="inline-flex items-center gap-1">
          <FolderDot size={11} /> {goal.projectName}
        </span>
      )}
      {goal.stageName && (
        <>
          <Arrow size={11} className="text-ink-soft/50" />
          <span>{goal.stageName}</span>
        </>
      )}
    </div>
  );
}

export default function AssignedToMeView() {
  const [goals, setGoals] = useState<AssignedGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailGoal, setDetailGoal] = useState<AssignedGoal | null>(null);

  const load = () => {
    setError(null);
    fetchAssignedToMe()
      .then((res) => setGoals(res.goals))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر جلب المهام"));
  };

  useEffect(() => {
    load();
  }, []);

  const patchLocal = (goalId: string, patch: Partial<AssignedGoal>) => {
    setGoals((prev) => prev?.map((g) => (g.id === goalId ? { ...g, ...patch } : g)) ?? null);
    setDetailGoal((prev) => (prev && prev.id === goalId ? { ...prev, ...patch } : prev));
  };

  const changeStatus = async (goal: AssignedGoal, status: AssignedGoal["status"]) => {
    setBusyId(goal.id);
    try {
      await updateAssignedGoal(goal.id, { status });
      patchLocal(goal.id, { status });
    } catch {
      setError("تعذّر تحديث الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const moveToStage = async (goal: AssignedGoal, stageId: string) => {
    setBusyId(goal.id);
    try {
      await updateAssignedGoal(goal.id, { moveToStageId: stageId });
      const stage = goal.availableStages.find((s) => s.id === stageId);
      patchLocal(goal.id, { stageId, stageName: stage?.name ?? goal.stageName });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر نقل المهمة");
    } finally {
      setBusyId(null);
    }
  };

  const toggleItem = async (goal: AssignedGoal, itemId: string, done: boolean) => {
    setBusyId(goal.id);
    try {
      await updateAssignedChecklistItem(goal.id, itemId, { done });
      patchLocal(goal.id, { checklist: goal.checklist.map((it) => (it.id === itemId ? { ...it, done } : it)) });
    } catch {
      setError("تعذّر تحديث العنصر");
    } finally {
      setBusyId(null);
    }
  };

  const grouped = useMemo(() => {
    const active = (goals ?? []).filter((g) => g.status !== "Completed");
    const done = (goals ?? []).filter((g) => g.status === "Completed");
    const buckets: Record<Bucket, AssignedGoal[]> = { overdue: [], today: [], upcoming: [], noDate: [] };
    for (const g of active) buckets[bucketOf(g)].push(g);
    return { buckets, done };
  }, [goals]);

  const totalActive = goals ? goals.filter((g) => g.status !== "Completed").length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
            <Inbox size={18} strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">المهام المسندة لي</h2>
            <p className="text-xs text-ink-soft">
              {goals ? `${totalActive} مهمة نشطة` : "جارِ التحميل..."}
            </p>
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">{error}</p>}

      {goals === null && !error && (
        <div className="flex justify-center py-16 text-ink-soft/50">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {goals !== null && goals.length === 0 && (
        <div className="terrace-card border border-line bg-basin-2/40 py-16 text-center">
          <Inbox className="mx-auto mb-3 text-ink-soft/40" size={44} />
          <p className="text-sm text-ink-soft">ما فيه مهام مسندة لك حاليًا.</p>
        </div>
      )}

      {goals !== null && goals.length > 0 && (
        <div className="space-y-7">
          {SECTIONS.map((section) => {
            const items = grouped.buckets[section.id];
            if (items.length === 0) return null;
            return (
              <div key={section.id}>
                <div className={`mb-2.5 flex items-center gap-2 text-sm font-semibold ${section.color}`}>
                  <section.icon size={15} />
                  {section.label}
                  <span className="text-ink-soft/60">({items.length})</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((g) => (
                    <TaskCard
                      key={g.id}
                      goal={g}
                      busy={busyId === g.id}
                      onOpen={() => setDetailGoal(g)}
                      onChangeStatus={(s) => changeStatus(g, s)}
                      onComplete={() => changeStatus(g, "Completed")}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {grouped.done.length > 0 && (
            <details className="group">
              <summary className="mb-2.5 flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
                <CheckCircle2 size={15} className="text-green-600" />
                مكتملة
                <span className="text-ink-soft/60">({grouped.done.length})</span>
              </summary>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.done.map((g) => (
                  <TaskCard
                    key={g.id}
                    goal={g}
                    busy={busyId === g.id}
                    onOpen={() => setDetailGoal(g)}
                    onChangeStatus={(s) => changeStatus(g, s)}
                    onComplete={() => changeStatus(g, "Completed")}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {detailGoal && (
        <TaskDetailDrawer
          goal={detailGoal}
          busy={busyId === detailGoal.id}
          onClose={() => setDetailGoal(null)}
          onChangeStatus={(s) => changeStatus(detailGoal, s)}
          onToggleItem={(itemId, done) => toggleItem(detailGoal, itemId, done)}
          onMoveToStage={(stageId) => moveToStage(detailGoal, stageId)}
        />
      )}
    </div>
  );
}

/**
 * Focus-mode card: title, breadcrumb, priority/deadline, and one-tap quick
 * actions only. No requirements text, no checklist, no notes here — those
 * only show once the user opens the detail drawer.
 */
function TaskCard({
  goal,
  busy,
  onOpen,
  onChangeStatus,
  onComplete,
}: {
  goal: AssignedGoal;
  busy: boolean;
  onOpen: () => void;
  onChangeStatus: (status: AssignedGoal["status"]) => void;
  onComplete: () => void;
}) {
  const bucket = bucketOf(goal);
  const deadlineColor =
    bucket === "overdue" && goal.status !== "Completed" ? "text-red-600" : "text-ink-soft";

  return (
    <div
      className="terrace-card cursor-pointer border border-line bg-basin-2/40 p-3 transition-shadow hover:shadow-md"
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: goal.color || priorityColor(goal.priority) }}
      onClick={onOpen}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={`font-medium text-ink ${goal.status === "Completed" ? "text-ink-soft line-through" : ""}`}>
          {goal.name}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: priorityColor(goal.priority) + "22", color: priorityColor(goal.priority) }}
        >
          {goal.priority}
        </span>
      </div>

      <Breadcrumb goal={goal} />

      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <User size={11} /> {goal.ownerName}
        </span>
        {goal.deadline && (
          <span className={`inline-flex items-center gap-1 font-medium ${deadlineColor}`}>
            <CalendarClock size={11} /> {new Date(goal.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {goal.locked && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-basin-2/60 px-2.5 py-1.5 text-[11px] text-ink-soft">
          <Lock size={11} />
          هذي المرحلة مقفلة إلى أن تكتمل المرحلة السابقة
        </p>
      )}

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Select
          value={goal.status}
          disabled={busy || goal.locked}
          onChange={(v) => onChangeStatus(v as AssignedGoal["status"])}
          fullWidth
          className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink"
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        {goal.status !== "Completed" && (
          <button
            onClick={onComplete}
            disabled={busy || goal.locked}
            title="وضع علامة مكتمل"
            className="shrink-0 rounded-lg border border-line p-1.5 text-ink-soft transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Side drawer with the full picture: requirements, notes, and checklist —
 * everything the list view deliberately hides to stay uncluttered.
 */
function TaskDetailDrawer({
  goal,
  busy,
  onClose,
  onChangeStatus,
  onToggleItem,
  onMoveToStage,
}: {
  goal: AssignedGoal;
  busy: boolean;
  onClose: () => void;
  onChangeStatus: (status: AssignedGoal["status"]) => void;
  onToggleItem: (itemId: string, done: boolean) => void;
  onMoveToStage: (stageId: string) => void;
}) {
  const { closing, requestClose } = useClosing(onClose);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-md flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <h2 className="font-display text-lg font-semibold leading-tight text-ink">{goal.name}</h2>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Breadcrumb goal={goal} />

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <User size={12} /> {goal.ownerName}
            </span>
            {goal.deadline && <span>· {new Date(goal.deadline).toLocaleDateString()}</span>}
          </div>

          {goal.locked && (
            <p className="flex items-center gap-1.5 rounded-lg bg-basin-2/60 px-2.5 py-1.5 text-xs text-ink-soft">
              <Lock size={12} />
              هذي المرحلة مقفلة إلى أن تكتمل المرحلة السابقة
            </p>
          )}

          <Select
            value={goal.status}
            disabled={busy || goal.locked}
            onChange={(v) => onChangeStatus(v as AssignedGoal["status"])}
            fullWidth
            className="w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-ink"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />

          {goal.availableStages.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-soft">نقل إلى مرحلة أخرى</p>
              <Select
                value={goal.stageId ?? ""}
                disabled={busy || goal.locked}
                onChange={(v) => v && onMoveToStage(v)}
                fullWidth
                className="w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-ink"
                options={goal.availableStages.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          )}

          {goal.requirements && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-soft">المتطلبات</p>
              <p className="whitespace-pre-line text-sm text-ink">{goal.requirements}</p>
            </div>
          )}

          {goal.notes && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-soft">
                <StickyNote size={12} /> ملاحظات
              </p>
              <p className="whitespace-pre-line text-sm text-ink">{goal.notes}</p>
            </div>
          )}

          {goal.checklist.length > 0 && (
            <div className="space-y-1 border-t border-line pt-3">
              <p className="mb-1 text-xs font-semibold text-ink-soft">قائمة المهام الفرعية</p>
              {goal.checklist.map((item) => (
                <button
                  key={item.id}
                  disabled={busy || goal.locked}
                  onClick={() => onToggleItem(item.id, !item.done)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start text-sm transition-colors hover:bg-terrace-500/10 disabled:opacity-60"
                >
                  {item.done ? (
                    <CheckSquare size={16} className="shrink-0 text-terrace-600" />
                  ) : (
                    <Square size={16} className="shrink-0 text-ink-soft/40" />
                  )}
                  <span className={item.done ? "text-ink-soft line-through" : "text-ink"}>{item.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
