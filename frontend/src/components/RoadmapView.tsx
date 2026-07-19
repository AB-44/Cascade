import { useState } from "react";
import { Pencil, Plus, User, ListTodo, ChevronLeft, Lock, CheckCircle2 } from "lucide-react";
import type { Goal } from "../types";
import { useStore, useTree } from "../store";
import { priorityColor, isStageLocked, blockingGoals } from "../lib/goals";
import type { TreeNode } from "../lib/goals";
import { ProgressBar } from "./ui";
import { BlockedBadge, DeadlineBadge } from "./GoalBadges";
import { isBlocked } from "../lib/goals";
import TaskDetailPanel from "./TaskDetailPanel";
import { t, tFormat } from "../lib/i18n";
import { MemberAvatar } from "./TeamPanel";

interface Props {
  onEdit: (g: Goal) => void;
  onAddChild: (parentId: string) => void;
  filter: (g: Goal) => boolean;
  sequentialLock?: boolean;
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

export default function RoadmapView({ onEdit, onAddChild, filter, sequentialLock = false }: Props) {
  const tree = useTree(false);
  const { goals, effProgress, lang, updateGoal } = useStore();
  const stages = filterTree(tree, filter);

  if (stages.length === 0) return null;

  const toggleComplete = (goal: Goal) => {
    if (goal.status === "Completed") {
      updateGoal(goal.id, { status: "In Progress", progress: goal.autoProgress ? goal.progress : Math.min(goal.progress, 90) });
      return;
    }
    const blockers = blockingGoals(goals, goal);
    if (blockers.length > 0) {
      alert(tFormat(lang, "blockedAlert", { blockers: blockers.map((b) => b.name).join(", ") }));
      return;
    }
    updateGoal(goal.id, { status: "Completed", progress: 100 });
  };

  return (
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
              className={`terrace-card flex w-[272px] shrink-0 flex-col overflow-hidden border border-line bg-card shadow-sm transition-opacity duration-150 ${
                locked ? "opacity-60" : ""
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
                    <button
                      onClick={() => onAddChild(stage.goal.id)}
                      title={t(lang, "addSubGoal")}
                      className="rounded p-1 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => onEdit(stage.goal)}
                      title={t(lang, "edit")}
                      className="rounded p-1 text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                    >
                      <Pencil size={14} />
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
                  {stage.children.map((c) => (
                    <RoadmapCard key={c.goal.id} node={c} onEdit={onEdit} depth={0} />
                  ))}
                  <button
                    onClick={() => toggleComplete(stage.goal)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-colors duration-150 ${
                      stage.goal.status === "Completed"
                        ? "border-terrace-500/40 bg-terrace-500/10 text-terrace-700"
                        : "border-line text-ink-soft hover:border-terrace-300 hover:bg-terrace-500/10 hover:text-terrace-700"
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    {stage.goal.status === "Completed" ? t(lang, "completed") : t(lang, "markComplete")}
                  </button>
                </>
              )}
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoadmapCard({ node, onEdit, depth }: { node: TreeNode; onEdit: (g: Goal) => void; depth: number }) {
  const [showTasks, setShowTasks] = useState(false);
  const { effProgress, members } = useStore();
  const { goal, children } = node;
  const progress = effProgress(goal);
  const member = members.find((m) => m.name === goal.assignedTo);
  return (
    <div style={{ marginLeft: depth * 8 }}>
      <div
        className="w-full rounded-lg border border-line bg-basin-2/40 p-2.5 text-left transition-colors duration-150 hover:border-terrace-300 hover:bg-basin-2"
        style={{ borderInlineStartWidth: 3, borderInlineStartColor: goal.color }}
      >
        <button
          onClick={() => setShowTasks(true)}
          className="flex w-full items-center gap-2"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(goal.priority) }} />
          <span className={`truncate text-sm font-medium text-ink ${goal.status === "Completed" ? "line-through opacity-60" : ""}`}>
            {goal.name}
          </span>
        </button>
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
          <button
            onClick={() => setShowTasks(true)}
            className="inline-flex items-center gap-1 rounded bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft transition-colors duration-150 hover:bg-terrace-100 hover:text-terrace-700"
          >
            <ListTodo size={11} />
            {goal.checklist.filter((c) => c.done).length}/{goal.checklist.length}
          </button>
        </div>
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((c) => (
            <RoadmapCard key={c.goal.id} node={c} onEdit={onEdit} depth={depth + 1} />
          ))}
        </div>
      )}

      {showTasks && (
        <TaskDetailPanel goal={goal} onClose={() => setShowTasks(false)} />
      )}
    </div>
  );
}
