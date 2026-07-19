import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Archive,
  GripVertical,
  User,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import type { Goal } from "../types";
import type { TreeNode } from "../lib/goals";
import { useStore, useTree } from "../store";
import { blockingGoals, isBlocked, priorityColor } from "../lib/goals";
import { ProgressBar, ProgressRing } from "./ui";
import { BlockedBadge, DeadlineBadge } from "./GoalBadges";
import TaskDetailPanel from "./TaskDetailPanel";
import { t, tFormat } from "../lib/i18n";
import { MemberAvatar } from "./TeamPanel";

interface Props {
  onEdit: (g: Goal) => void;
  onAddChild: (parentId: string) => void;
  filter: (g: Goal) => boolean;
}

export default function TreeView({ onEdit, onAddChild, filter }: Props) {
  const tree = useTree(false);
  const visible = filterTree(tree, filter);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visible.map((node) => (
        <NodeRow key={node.goal.id} node={node} depth={0} onEdit={onEdit} onAddChild={onAddChild} filter={filter} />
      ))}
    </div>
  );
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

function NodeRow({
  node,
  depth,
  onEdit,
  onAddChild,
  filter,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (g: Goal) => void;
  onAddChild: (parentId: string) => void;
  filter: (g: Goal) => boolean;
}) {
  const { goal, children } = node;
  const { goals, updateGoal, deleteGoal, archiveGoal, reorderUnderParent, effProgress, lang, members } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState<"" | "into" | "before">("");
  const [showTasks, setShowTasks] = useState(false);

  const progress = effProgress(goal);
  const blocked = isBlocked(goals, goal);
  const blockers = blockingGoals(goals, goal);
  const hasChildren = children.length > 0;

  const doneChecks = goal.checklist.filter((c) => c.done).length;

  const toggleComplete = () => {
    if (goal.status === "Completed") {
      updateGoal(goal.id, { status: "In Progress", progress: goal.autoProgress ? goal.progress : Math.min(goal.progress, 90) });
    } else {
      if (blocked) {
        alert(tFormat(lang, "blockedAlert", { blockers: blockers.map((b) => b.name).join(", ") }));
        return;
      }
      updateGoal(goal.id, { status: "Completed", progress: 100 });
    }
  };

  return (
    <div className="relative" style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      {/* connector line for nested */}
      {depth > 0 && (
        <span className="absolute -left-3 top-0 h-full w-px bg-gradient-to-b from-terrace-300 to-line" />
      )}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/goalId", goal.id);
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const rel = (e.clientY - rect.top) / rect.height;
          setDragOver(rel > 0.6 ? "into" : "before");
        }}
        onDragLeave={() => setDragOver("")}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = e.dataTransfer.getData("text/goalId");
          if (id && id !== goal.id) {
            if (dragOver === "into") {
              reorderUnderParent(id, goal.id, null);
            } else {
              reorderUnderParent(id, goal.parentId, goal.id);
            }
          }
          setDragOver("");
        }}
        className={`terrace-card group relative border bg-card p-3 shadow-sm transition ${
          dragOver === "into"
            ? "border-terrace-500 ring-2 ring-terrace-400/40"
            : dragOver === "before"
              ? "border-t-2 border-t-terrace-500 border-line"
              : "border-line"
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: goal.color }}
      >
        <div className="flex items-start gap-2">
          {/* drag + collapse */}
          <div className="flex flex-col items-center pt-0.5">
            <GripVertical size={14} className="cursor-grab text-line" />
          </div>

          <button
            onClick={() => hasChildren && setCollapsed((v) => !v)}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${hasChildren ? "text-ink-soft hover:bg-terrace-50" : "text-transparent"}`}
          >
            {hasChildren ? collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} /> : <span className="h-1 w-1 rounded-full bg-line" />}
          </button>

          {/* main content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={toggleComplete} title="Toggle complete" className="shrink-0">
                <CheckCircle2
                  size={18}
                  className={goal.status === "Completed" ? "text-terrace-600" : "text-line hover:text-terrace-400"}
                />
              </button>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: priorityColor(goal.priority) }}
                title={`${goal.priority} priority`}
              />
              <button
                onClick={() => setShowTasks(true)}
                className={`truncate text-left font-semibold text-ink transition hover:text-terrace-600 ${goal.status === "Completed" ? "line-through opacity-60" : ""}`}
              >
                {goal.name}
              </button>
              {goal.tag && (
                <span className="rounded-full bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  {goal.tag}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {blocked && <BlockedBadge />}
              <DeadlineBadge goal={goal} />
              {goal.assignedTo && (() => {
                const member = members.find((m) => m.name === goal.assignedTo);
                return (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-terrace-50 py-0.5 ps-0.5 pe-2 text-[11px] font-medium text-terrace-700">
                    {member ? (
                      <MemberAvatar member={member} size={16} />
                    ) : (
                      <User size={11} className="ms-1" />
                    )}
                    {goal.assignedTo}
                  </span>
                );
              })()}
              {goal.checklist.length > 0 && (
                <button
                  onClick={() => setShowTasks(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-basin-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-terrace-100 hover:text-terrace-700"
                >
                  <ListTodo size={11} /> {doneChecks}/{goal.checklist.length}
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={progress} color={goal.color} className="max-w-xs" />
              <span className="font-mono-num text-xs font-semibold text-ink-soft">{progress}%</span>
            </div>

            {(goal.requirements || goal.notes) && (
              <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">
                {goal.requirements || goal.notes}
              </p>
            )}
          </div>

            {/* task list button */}
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => setShowTasks(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-basin-2 px-3 py-1.5 text-[11px] font-medium text-ink-soft transition hover:bg-terrace-100 hover:text-terrace-700"
              >
                <ListTodo size={14} /> {t(lang, "tasksBtn")}
                {goal.checklist.length > 0 && <span className="rounded-full bg-terrace-500 px-1.5 text-[9px] text-white">{goal.checklist.length}</span>}
              </button>
            </div>

            {/* ring + actions */}
            <div className="flex flex-col items-end gap-1">
              <div className="relative hidden sm:block">
                <ProgressRing value={progress} color={goal.color} />
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[10px] font-bold text-ink-soft">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={toggleComplete}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    goal.status === "Completed"
                      ? "bg-terrace-100 text-terrace-700 hover:bg-terrace-200"
                      : "bg-terrace-600 text-white hover:bg-terrace-700"
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {goal.status === "Completed" ? t(lang, "completed") : t(lang, "markComplete")}
                </button>
                <button onClick={() => onAddChild(goal.id)} title={t(lang, "addSubGoal")} className="rounded p-1.5 text-ink-soft hover:bg-terrace-50 hover:text-terrace-600">
                  <Plus size={15} />
                </button>
                <button onClick={() => onEdit(goal)} title={t(lang, "edit")} className="rounded p-1.5 text-ink-soft hover:bg-basin-2 hover:text-ink">
                  <Pencil size={15} />
                </button>
                <button onClick={() => archiveGoal(goal.id, true)} title={t(lang, "archiveGoal")} className="rounded p-1.5 text-ink-soft hover:bg-gold-50 hover:text-gold-600">
                  <Archive size={15} />
                </button>
                <button
                  onClick={() => confirm(tFormat(lang, "confirmDelete", { name: goal.name })) && deleteGoal(goal.id)}
                  title={t(lang, "delete")}
                  className="rounded p-1.5 text-ink-soft hover:bg-clay/10 hover:text-clay"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
        </div>
      </div>

      {/* children */}
      {hasChildren && !collapsed && (
        <div className="mt-3 space-y-3 animate-slide-down">
          {children.map((c) => (
            <NodeRow key={c.goal.id} node={c} depth={depth + 1} onEdit={onEdit} onAddChild={onAddChild} filter={filter} />
          ))}
        </div>
      )}

      {/* task detail panel */}
      {showTasks && (
        <TaskDetailPanel goal={goal} onClose={() => setShowTasks(false)} />
      )}
    </div>
  );
}
