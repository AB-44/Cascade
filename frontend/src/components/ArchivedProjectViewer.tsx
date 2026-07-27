import { useEffect, useState } from "react";
import { X, AlertTriangle, Loader2, CheckCircle2, Circle, PlayCircle, ChevronRight, ChevronDown } from "lucide-react";
import { useClosing } from "../lib/useClosing";
import { priorityColor } from "../lib/goals";
import { fetchArchivedProjectDetail, type ArchivedGoal, type ArchivedProjectSummary } from "../lib/api";

interface Props {
  projectId: string;
  onClose: () => void;
}

/**
 * Read-only, by construction: there is no click handler anywhere in this
 * component that mutates anything, no "+" to add a goal, nothing
 * draggable. The banner up top is the only thing telling the user why —
 * everything else enforces it just by not existing.
 */
export default function ArchivedProjectViewer({ projectId, onClose }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  const [data, setData] = useState<{ project: ArchivedProjectSummary; goals: ArchivedGoal[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArchivedProjectDetail(projectId)
      .then((res) => setData(res))
      .catch(() => setError("تعذّر تحميل المشروع."));
  }, [projectId]);

  const stages = data?.goals.filter((g) => !g.parentId) ?? [];
  const childrenOf = (id: string) => data?.goals.filter((g) => g.parentId === id) ?? [];

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-lg flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold text-ink">{data?.project.name ?? "..."}</h2>
          <button onClick={requestClose} className="shrink-0 rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-sm">هذا المشروع مؤرشف للقراءة فقط. لاستئناف العمل، قم باستعادته أولاً.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="py-10 text-center text-sm text-ink-soft">{error}</p>}
          {!data && !error && (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-ink-soft" size={24} />
            </div>
          )}
          {data && stages.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">ما فيه أهداف بهذا المشروع.</p>}
          <div className="space-y-3">
            {stages.map((stage) => (
              <StageBlock key={stage.id} goal={stage} childrenOf={childrenOf} depth={0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageBlock({ goal, childrenOf, depth }: { goal: ArchivedGoal; childrenOf: (id: string) => ArchivedGoal[]; depth: number }) {
  const [open, setOpen] = useState(true);
  const kids = childrenOf(goal.id);

  return (
    <div
      className="rounded-lg border border-line"
      style={{ marginInlineStart: depth * 14, borderInlineStartWidth: 3, borderInlineStartColor: goal.color || priorityColor(goal.priority) }}
    >
      <div className="flex items-center gap-2 p-2.5">
        {kids.length > 0 && (
          <button onClick={() => setOpen(!open)} className="shrink-0 text-ink-soft hover:text-ink">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {goal.status === "Completed" ? (
          <CheckCircle2 size={15} className="shrink-0 text-terrace-600" />
        ) : goal.status === "In Progress" ? (
          <PlayCircle size={15} className="shrink-0 text-amber-500" />
        ) : (
          <Circle size={15} className="shrink-0 text-ink-soft/40" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{goal.name}</span>
        <span className="shrink-0 text-xs text-ink-soft">{goal.progress}%</span>
      </div>
      {goal.checklist.length > 0 && (
        <div className="space-y-1 border-t border-line px-2.5 py-2">
          {goal.checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              {item.done ? (
                <CheckCircle2 size={12} className="shrink-0 text-terrace-600" />
              ) : (
                <Circle size={12} className="shrink-0 text-ink-soft/40" />
              )}
              <span className={item.done ? "text-ink-soft line-through" : "text-ink"}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
      {open && kids.length > 0 && (
        <div className="space-y-2 p-2.5 pt-0">
          {kids.map((k) => (
            <StageBlock key={k.id} goal={k} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
