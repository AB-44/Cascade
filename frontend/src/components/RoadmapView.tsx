import { useState } from "react";
import { Pencil, Plus, Trash2, User, ListTodo, ChevronLeft, Lock } from "lucide-react";
import type { Goal } from "../types";
import { useStore, useTree } from "../store";
import { priorityColor, isStageLocked } from "../lib/goals";
import type { TreeNode } from "../lib/goals";
import { ProgressBar } from "./ui";
import { BlockedBadge, DeadlineBadge } from "./GoalBadges";
import { isBlocked } from "../lib/goals";
import TaskDetailPanel from "./TaskDetailPanel";
import { t, tFormat } from "../lib/i18n";
import { MemberAvatar } from "./TeamPanel";
import ConfirmModal from "./ConfirmModal";

interface Props {
  onEdit: (g: Goal) => void;
  onAddChild: (parentId: string) => void;
  filter: (g: Goal) => boolean;
  sequentialLock?: boolean;
  allowNewGoals?: boolean;
}

function filterTree(nodes: TreeNode[], filter: (g: Goal) => boolean): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    const children = filterTree(n.children, filter);
    if (filter(n.goal) || children.length > 0) {
      out.push({ goal: n.goal, children });
    }
  }
  return out;
}

const CARDS_PAGE_SIZE = 10;

export default function RoadmapView({ onEdit, onAddChild, filter, sequentialLock = false, allowNewGoals = true }: Props) {
  const tree = useTree(false);
  const { goals, effProgress, lang, deleteGoal } = useStore();
  const stages = filterTree(tree, filter);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<Goal | null>(null);
  // How many cards are currently shown per stage — keyed by stage goal id,
  // since each column's "show more" is independent of the others. A stage
  // not in this map just uses the default page size.
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  if (stages.length === 0) return null;

  return (
    <>
      <div className="flex items-start overflow-x-auto pb-2">
        {stages.map((stage, i) => {
        const stageProgress = effProgress(stage.goal);
        const locked = isStageLocked(goals, stage.goal, sequentialLock);
        return (
          <div key={stage.goal.id} className="flex shrink-0 items-start">
            {i > 0 && (
              <div className="flex h-10 shrink-0 items-center self-center px-2 text-ink-soft/40">
                <ChevronLeft size={18} className="roadmap-arrow" />
              </div>
            )}
            <div
              data-goal-id={stage.goal.id}
              className={`terrace-card flex w-[272px] shrink-0 flex-col overflow-hidden border border-line bg-card shadow-sm transition-opacity duration-150 ${locked ? "opacity-60" : ""
                }`}
              style={{ borderTopWidth: 3, borderTopColor: stage.goal.color || "var(--color-terrace-500)" }}
            >
              {/* stage header */}
              <div className="border-b border-line bg-basin-2/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    {t(lang, "stage")} {i + 1}
                  </span>
                  {locked ? (
                    <Lock size={14} className="text-ink-soft" />
                  ) : (
                    <div className="flex">
                      {allowNewGoals && (
                        <button
                          onClick={() => onAddChild(stage.goal.id)}
                          title={t(lang, "addSubGoal")}
                          className="rounded p-1 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(stage.goal)}
                        title={t(lang, "edit")}
                        className="rounded p-1 text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteStage(stage.goal)}
                        title={t(lang, "delete")}
                        className="rounded p-1 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(stage.goal.priority) }} />
                  <span className="truncate">{stage.goal.name}</span>
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={stageProgress} color={stage.goal.color} />
                  <span className="font-mono-num text-xs font-semibold text-ink-soft">{stageProgress}%</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isBlocked(goals, stage.goal) && <BlockedBadge />}
                  <DeadlineBadge goal={stage.goal} />
                </div>
              </div>
              {/* sub goals */}
              <div className="flex-1 space-y-2 p-3">
                {locked ? (
                  <p className="flex items-center justify-center gap-1.5 py-4 text-center text-xs text-ink-soft">
                    <Lock size={12} />
                    {t(lang, "stageLocked")}
                  </p>
                ) : (
                  <>
                    {stage.children.length === 0 && (
                      <p className="py-4 text-center text-xs text-ink-soft">{t(lang, "noSubGoals")}</p>
                    )}
                    {(() => {
                      const visibleCount = visibleCounts[stage.goal.id] ?? CARDS_PAGE_SIZE;
                      const visibleChildren = stage.children.slice(0, visibleCount);
                      const remaining = stage.children.length - visibleChildren.length;
                      return (
                        <>
                          {visibleChildren.map((c) => (
                            <RoadmapCard key={c.goal.id} node={c} onEdit={onEdit} onDelete={deleteGoal} onAddChild={allowNewGoals ? onAddChild : undefined} depth={0} />
                          ))}
                          {remaining > 0 && (
                            <button
                              onClick={() =>
                                setVisibleCounts((prev) => ({
                                  ...prev,
                                  [stage.goal.id]: visibleCount + CARDS_PAGE_SIZE,
                                }))
                              }
                              className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-terrace-300 hover:bg-terrace-500/5 hover:text-terrace-700"
                            >
                              {t(lang, "showMore")} ({remaining})
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>

      {confirmDeleteStage && (
        <ConfirmModal
          icon={Trash2}
          destructive
          title={t(lang, "delete")}
          message={tFormat(lang, "confirmDelete", { name: confirmDeleteStage.name })}
          confirmLabel={t(lang, "delete")}
          cancelLabel={t(lang, "cancel")}
          onConfirm={() => {
            deleteGoal(confirmDeleteStage.id);
            setConfirmDeleteStage(null);
          }}
          onCancel={() => setConfirmDeleteStage(null)}
        />
      )}
    </>
  );
}

function RoadmapCard({
  node,
  onEdit,
  onDelete,
  onAddChild,
  depth,
}: {
  node: TreeNode;
  onEdit: (g: Goal) => void;
  onDelete?: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  depth: number;
}) {
  const [showTasks, setShowTasks] = useState(false);
  const { effProgress, members } = useStore();
  const { goal, children } = node;
  const progress = effProgress(goal);
  const member = members.find((m) => m.name === goal.assignedTo);
  return (
    <div style={{ marginLeft: depth * 8 }} data-goal-id={goal.id}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowTasks(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShowTasks(true);
          }
        }}
        className="w-full cursor-pointer rounded-lg border border-line bg-basin-2/40 p-2.5 text-left transition-colors duration-150 hover:border-terrace-300 hover:bg-basin-2"
        style={{ borderInlineStartWidth: 3, borderInlineStartColor: goal.color }}
      >
        <div className="flex w-full items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(goal.priority) }} />
          <span className={`truncate text-sm font-medium text-ink ${goal.status === "Completed" ? "line-through opacity-60" : ""}`}>
            {goal.name}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={progress} color={goal.color} />
          <span className="font-mono-num text-[10px] font-semibold text-ink-soft">{progress}%</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {goal.assignedTo && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-soft">
              {member ? <MemberAvatar member={member} size={14} /> : <User size={10} />}
              {goal.assignedTo}
            </span>
          )}
          {goal.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
              <ListTodo size={11} />
              {goal.checklist.filter((c) => c.done).length}/{goal.checklist.length}
            </span>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((c) => (
            <RoadmapCard key={c.goal.id} node={c} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} depth={depth + 1} />
          ))}
        </div>
      )}

      {showTasks && (
        <TaskDetailPanel goal={goal} onClose={() => setShowTasks(false)} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
      )}
    </div>
  );
}
