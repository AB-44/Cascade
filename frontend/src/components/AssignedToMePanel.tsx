import { useEffect, useState } from "react";
import { Inbox, X, Loader2, CheckSquare, Square, User, FolderDot, Lock } from "lucide-react";
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

export default function AssignedToMePanel({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const [goals, setGoals] = useState<AssignedGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchAssignedToMe()
      .then((res) => setGoals(res.goals))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر جلب المهام"));
  };

  useEffect(() => {
    load();
  }, []);

  const changeStatus = async (goal: AssignedGoal, status: AssignedGoal["status"]) => {
    setBusyId(goal.id);
    try {
      await updateAssignedGoal(goal.id, { status });
      setGoals((prev) => prev?.map((g) => (g.id === goal.id ? { ...g, status } : g)) ?? null);
    } catch {
      setError("تعذّر تحديث الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const toggleItem = async (goal: AssignedGoal, itemId: string, done: boolean) => {
    setBusyId(goal.id);
    try {
      await updateAssignedChecklistItem(goal.id, itemId, { done });
      setGoals(
        (prev) =>
          prev?.map((g) =>
            g.id === goal.id
              ? { ...g, checklist: g.checklist.map((it) => (it.id === itemId ? { ...it, done } : it)) }
              : g,
          ) ?? null,
      );
    } catch {
      setError("تعذّر تحديث العنصر");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-md flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <Inbox size={18} strokeWidth={2.25} />
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">
              المهام المسندة لي {goals ? <span className="text-ink-soft">({goals.length})</span> : ""}
            </h2>
          </div>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">
              {error}
            </p>
          )}

          {goals === null && !error && (
            <div className="flex justify-center py-16 text-ink-soft/50">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}

          {goals !== null && goals.length === 0 && (
            <div className="py-16 text-center">
              <Inbox className="mx-auto mb-3 text-ink-soft/40" size={44} />
              <p className="text-sm text-ink-soft">ما فيه مهام مسندة لك حاليًا.</p>
            </div>
          )}

          {goals?.map((g) => (
            <div
              key={g.id}
              className="terrace-card border border-line bg-basin-2/40 p-3"
              style={{ borderInlineStartWidth: 3, borderInlineStartColor: g.color || priorityColor(g.priority) }}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{g.name}</p>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: priorityColor(g.priority) + "22", color: priorityColor(g.priority) }}
                >
                  {g.priority}
                </span>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <User size={11} /> {g.ownerName}
                </span>
                {g.projectName && (
                  <span className="inline-flex items-center gap-1">
                    <FolderDot size={11} /> {g.projectName}
                  </span>
                )}
                {g.deadline && <span>· {new Date(g.deadline).toLocaleDateString()}</span>}
              </div>

              {g.locked && (
                <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-basin-2/60 px-2.5 py-1.5 text-[11px] text-ink-soft">
                  <Lock size={11} />
                  هذي المرحلة مقفلة إلى أن تكتمل المرحلة السابقة
                </p>
              )}

              {g.requirements && (
                <p className="mb-2 whitespace-pre-line text-xs text-ink-soft">{g.requirements}</p>
              )}

              <Select
                value={g.status}
                disabled={busyId === g.id || g.locked}
                onChange={(v) => changeStatus(g, v as AssignedGoal["status"])}
                fullWidth
                className="mb-2 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />

              {g.checklist.length > 0 && (
                <div className="space-y-1 border-t border-line pt-2">
                  {g.checklist.map((item) => (
                    <button
                      key={item.id}
                      disabled={busyId === g.id || g.locked}
                      onClick={() => toggleItem(g, item.id, !item.done)}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-start text-xs transition-colors duration-150 hover:bg-terrace-500/10 disabled:opacity-60"
                    >
                      {item.done ? (
                        <CheckSquare size={15} className="shrink-0 text-terrace-600" />
                      ) : (
                        <Square size={15} className="shrink-0 text-ink-soft/40" />
                      )}
                      <span className={item.done ? "text-ink-soft line-through" : "text-ink"}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
