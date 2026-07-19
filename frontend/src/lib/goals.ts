import type { Goal, Priority, Status } from "../types";
import { uid } from "./storage";

export interface TreeNode {
  goal: Goal;
  children: TreeNode[];
}

export function buildTree(goals: Goal[], includeArchived = false): TreeNode[] {
  const filtered = includeArchived ? goals : goals.filter((g) => !g.archived);
  const byParent = new Map<string | null, Goal[]>();
  for (const g of filtered) {
    const key = g.parentId;
    // ensure parent exists in filtered list, else treat as root
    const parentExists = g.parentId
      ? filtered.some((p) => p.id === g.parentId)
      : true;
    const pk = parentExists ? key : null;
    if (!byParent.has(pk)) byParent.set(pk, []);
    byParent.get(pk)!.push(g);
  }
  const build = (parentId: string | null): TreeNode[] => {
    const list = (byParent.get(parentId) || []).slice().sort((a, b) => a.order - b.order);
    return list.map((goal) => ({ goal, children: build(goal.id) }));
  };
  return build(null);
}

export function getChildren(goals: Goal[], parentId: string): Goal[] {
  return goals.filter((g) => g.parentId === parentId);
}

export function getDescendants(goals: Goal[], id: string): Goal[] {
  const out: Goal[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const g of goals) {
      if (g.parentId === cur) {
        out.push(g);
        stack.push(g.id);
      }
    }
  }
  return out;
}

// Compute effective progress: if autoProgress, derive from children + checklist
export function computeProgress(goals: Goal[], goal: Goal): number {
  if (!goal.autoProgress) return goal.progress;
  const children = goals.filter((g) => g.parentId === goal.id && !g.archived);
  const parts: number[] = [];
  for (const c of children) parts.push(computeProgress(goals, c));
  if (goal.checklist.length > 0) {
    const done = goal.checklist.filter((c) => c.done).length;
    parts.push((done / goal.checklist.length) * 100);
  }
  if (parts.length === 0) return goal.progress;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function statusFromProgress(p: number): Status {
  if (p >= 100) return "Completed";
  if (p > 0) return "In Progress";
  return "Not Started";
}

export function isBlocked(goals: Goal[], goal: Goal): boolean {
  if (!goal.dependsOn || goal.dependsOn.length === 0) return false;
  return goal.dependsOn.some((depId) => {
    const dep = goals.find((g) => g.id === depId);
    return dep && computeProgress(goals, dep) < 100;
  });
}

export function blockingGoals(goals: Goal[], goal: Goal): Goal[] {
  return (goal.dependsOn || [])
    .map((id) => goals.find((g) => g.id === id))
    .filter((g): g is Goal => !!g && computeProgress(goals, g) < 100);
}

export type DeadlineState = "overdue" | "today" | "soon" | "none" | "future";

export function deadlineState(deadline: string | null, status: Status): DeadlineState {
  if (!deadline) return "none";
  if (status === "Completed") return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "future";
}

export function priorityColor(p: Priority): string {
  switch (p) {
    case "High":
      return "#ef4444";
    case "Medium":
      return "#f59e0b";
    case "Low":
      return "#22c55e";
  }
}

export function newGoal(partial: Partial<Goal> = {}): Goal {
  const now = new Date().toISOString();
  return {
    id: uid(),
    parentId: null,
    roadmapOwnerId: null,
    projectId: null,
    name: "",
    requirements: "",
    notes: "",
    assignedTo: "",
    priority: "Medium",
    progress: 0,
    autoProgress: false,
    deadline: null,
    reminder: false,
    reminderAt: null,
    reminderFired: false,
    startedAt: null,
    accumulatedMs: 0,
    timerPaused: false,
    estimatedMs: null,
    estimatedTargetFired: false,
    timeSessions: [],
    breakReminderFired: false,
    status: "Not Started",
    checklist: [],
    tag: "",
    color: "#6366f1",
    dependsOn: [],
    archived: false,
    templateId: null,
    order: Date.now(),
    collapsed: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/**
 * True when `stageGoal` (a top-level goal / roadmap "stage") should stay
 * locked because the project has sequential locking on and the stage
 * right before it isn't Completed yet. Scoped to stages within the same
 * project — order is irrelevant across different projects.
 */
export function isStageLocked(goals: Goal[], stageGoal: Goal, sequentialLock: boolean): boolean {
  if (!sequentialLock) return false;

  const siblings = goals
    .filter((g) => !g.parentId && g.projectId === stageGoal.projectId)
    .sort((a, b) => a.order - b.order);

  const index = siblings.findIndex((g) => g.id === stageGoal.id);
  if (index <= 0) return false;

  return siblings[index - 1].status !== "Completed";
}

export function allAssignees(goals: Goal[]): string[] {
  const set = new Set<string>();
  for (const g of goals) if (g.assignedTo.trim()) set.add(g.assignedTo.trim());
  return Array.from(set);
}

export function allTags(goals: Goal[]): string[] {
  const set = new Set<string>();
  for (const g of goals) if (g.tag.trim()) set.add(g.tag.trim());
  return Array.from(set);
}
