import { useMemo, useState } from "react";
import { User, ChevronDown, ChevronRight, ListChecks, Lock } from "lucide-react";
import { isSharedStageLocked, type SharedProject, type SharedProjectGoal } from "../lib/api";
import { priorityColor } from "../lib/goals";
import { ProgressBar, Select } from "./ui";
import { MemberAvatar } from "./TeamPanel";
import SharedTaskDetailPanel from "./SharedTaskDetailPanel";

const STATUS_LABEL: Record<SharedProjectGoal["status"], string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};
const STATUS_DOT: Record<SharedProjectGoal["status"], string> = {
  "Not Started": "#94a3b8",
  "In Progress": "#f59e0b",
  Completed: "#22c55e",
};

interface Props {
  project: SharedProject;
  onProjectUpdate: (updater: (p: SharedProject) => SharedProject) => void;
}

/**
 * Read-mostly board for a project someone else owns and invited me into.
 * Deliberately separate from the main TreeView/RoadmapView + store: it
 * never touches the local `goals` array or the full-replace PUT /goals
 * sync, which only the owner's data should drive.
 *
 * The board itself only ever *displays* status/assignee/progress — actually
 * changing anything (status, checklist, notes, timer) only happens inside
 * SharedTaskDetailPanel, which the backend gates to the goal's assignee.
 * That split is what stops any collaborator from ticking off someone
 * else's task straight from the board.
 */
export default function SharedProjectRoadmap({ project, onProjectUpdate }: Props) {
  const [personFilter, setPersonFilter] = useState<string>("");
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);

  const visibleIds = useMemo(() => {
    if (!personFilter) return null;
    // personFilter is a member id (from the Select's value={m.id}).
    // assignedTo may be stored as the member's name (GoalForm saves m.name)
    // OR as the member id — handle both cases.
    const filterMember = project.members.find((m) => m.id === personFilter);
    const byId = new Map(project.goals.map((g) => [g.id, g]));
    const visible = new Set<string>();
    for (const g of project.goals) {
      const matchesId = g.assignedTo === personFilter;
      const matchesName = filterMember ? g.assignedTo === filterMember.name : false;
      if (!matchesId && !matchesName) continue;
      let current: SharedProjectGoal | undefined = g;
      while (current && !visible.has(current.id)) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return visible;
  }, [project.goals, personFilter, project.members]);

  const visibleStages = useMemo(() => {
    const allStages = project.goals.filter((g) => !g.parentId);
    if (!visibleIds) return allStages;
    return allStages.filter((stage) => visibleIds.has(stage.id));
  }, [project.goals, visibleIds]);

  const childrenOf = (id: string) => {
    const kids = project.goals.filter((g) => g.parentId === id);
    if (!visibleIds) return kids;
    return kids.filter((g) => visibleIds.has(g.id));
  };

  const openGoal = project.goals.find((g) => g.id === openGoalId) || null;

  if (project.goals.length === 0) {
    return <div className="py-20 text-center text-sm text-ink-soft">ما فيه أهداف بهذا المشروع بعد.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <User size={12} /> مشروع {project.ownerName} · بس صاحب كل مهمة يقدر يعدّلها
        </div>
        {project.members.length > 0 && (
          <Select
            value={personFilter}
            onChange={setPersonFilter}
            className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink"
            options={[
              { value: "", label: "خارطة طريق الفريق" },
              ...project.members.map((m) => ({ value: m.id, label: `شخصية: ${m.name}` })),
            ]}
          />
        )}
      </div>

      {visibleStages.length === 0 ? (
        <div className="py-20 text-center text-sm text-ink-soft">ما فيه أهداف مسندة لهذا الشخص بعد.</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))" }}>
          {visibleStages.map((stage, i) => {
            const locked = isSharedStageLocked(project, stage);
            return (
              <div
                key={stage.id}
                className={`terrace-card flex min-w-0 flex-col overflow-hidden border border-line bg-card shadow-sm transition-opacity duration-150 ${
                  locked ? "opacity-60" : ""
                }`}
                style={{ borderTopWidth: 3, borderTopColor: stage.color || "var(--color-terrace-500)" }}
              >
                <button
                  onClick={() => !locked && setOpenGoalId(stage.id)}
                  className="border-b border-line bg-basin-2/50 px-4 py-3 text-start"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      المرحلة {i + 1}
                    </span>
                    {locked && <Lock size={13} className="text-ink-soft" />}
                  </div>
                  <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(stage.priority) }} />
                    <span className="truncate">{stage.name}</span>
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={stage.progress} color={stage.color} />
                    <span className="font-mono-num text-xs font-semibold text-ink-soft">{stage.progress}%</span>
                  </div>
                  {!locked && <AssigneeAndStatus project={project} goal={stage} />}
                </button>

                <div className="flex-1 space-y-1.5 p-2.5">
                  {locked ? (
                    <p className="flex items-center justify-center gap-1.5 py-4 text-center text-xs text-ink-soft">
                      <Lock size={12} />
                      مقفلة إلى أن تكتمل المرحلة السابقة
                    </p>
                  ) : (
                    childrenOf(stage.id).map((child) => (
                      <GoalNode
                        key={child.id}
                        goal={child}
                        depth={0}
                        project={project}
                        childrenOf={childrenOf}
                        onOpen={setOpenGoalId}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openGoal && (
        <SharedTaskDetailPanel
          project={project}
          goal={openGoal}
          onClose={() => setOpenGoalId(null)}
          onProjectUpdate={onProjectUpdate}
        />
      )}
    </div>
  );
}

function AssigneeAndStatus({ project, goal }: { project: SharedProject; goal: SharedProjectGoal }) {
  // assignedTo may hold either a member id OR a member name depending on
  // which path created the goal — match on both to be safe.
  const assignee =
    project.members.find((m) => m.id === goal.assignedTo) ??
    project.members.find((m) => m.name === goal.assignedTo);
  const canManage =
    !!project.myMemberId &&
    (goal.assignedTo === project.myMemberId ||
      goal.assignedTo ===
      project.members.find((m) => m.id === project.myMemberId)?.name);
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
        {assignee ? (
          <>
            <MemberAvatar member={assignee} size={16} />
            {assignee.name}
          </>
        ) : (
          <>
            <User size={12} /> غير مسندة
          </>
        )}
        {!canManage && <Lock size={11} className="opacity-60" />}
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[goal.status] }} />
        {STATUS_LABEL[goal.status]}
      </span>
    </div>
  );
}

function GoalNode({
  goal,
  depth,
  project,
  childrenOf,
  onOpen,
}: {
  goal: SharedProjectGoal;
  depth: number;
  project: SharedProject;
  childrenOf: (id: string) => SharedProjectGoal[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const kids = childrenOf(goal.id);
  const doneCount = goal.checklist.filter((c) => c.done).length;

  return (
    <div
      className="rounded-lg border border-line bg-basin-2/40"
      style={{ marginInlineStart: depth * 12, borderInlineStartWidth: 3, borderInlineStartColor: goal.color || priorityColor(goal.priority) }}
    >
      <button onClick={() => onOpen(goal.id)} className="w-full p-2.5 text-start">
        <div className="flex items-center gap-1">
          {kids.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              className="shrink-0 text-ink-soft transition-colors duration-150 hover:text-ink"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          <p className="mb-0 flex-1 truncate text-sm font-medium text-ink">{goal.name}</p>
          {goal.checklist.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">
              <ListChecks size={12} />
              {doneCount}/{goal.checklist.length}
            </span>
          )}
        </div>
        <AssigneeAndStatus project={project} goal={goal} />
      </button>
      {open && kids.length > 0 && (
        <div className="space-y-1.5 p-2.5 pt-0">
          {kids.map((k) => (
            <GoalNode key={k.id} goal={k} depth={depth + 1} project={project} childrenOf={childrenOf} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
