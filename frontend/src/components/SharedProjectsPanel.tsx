import { useEffect, useState } from "react";
import { Share2, X, Loader2, CheckSquare, Square, User, ChevronDown } from "lucide-react";
import {
  fetchSharedProjects,
  updateSharedGoal,
  updateSharedChecklistItem,
  ApiError,
  type SharedProject,
  type SharedProjectGoal,
} from "../lib/api";
import { priorityColor } from "../lib/goals";
import { useClosing } from "../lib/useClosing";
import { Select } from "./ui";

const STATUS_OPTIONS: SharedProjectGoal["status"][] = ["Not Started", "In Progress", "Completed"];
const STATUS_LABEL: Record<SharedProjectGoal["status"], string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};

export default function SharedProjectsPanel({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useClosing(onClose);
  const [projects, setProjects] = useState<SharedProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedProjects()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0) setOpenProjectId(res.projects[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر جلب المشاريع"));
  }, []);

  const changeStatus = async (project: SharedProject, goal: SharedProjectGoal, status: SharedProjectGoal["status"]) => {
    setBusyId(goal.id);
    try {
      await updateSharedGoal(project.id, goal.id, { status });
      setProjects(
        (prev) =>
          prev?.map((p) =>
            p.id !== project.id
              ? p
              : { ...p, goals: p.goals.map((g) => (g.id === goal.id ? { ...g, status } : g)) },
          ) ?? null,
      );
    } catch {
      setError("تعذّر تحديث الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const toggleItem = async (project: SharedProject, goal: SharedProjectGoal, itemId: string, done: boolean) => {
    setBusyId(goal.id);
    try {
      await updateSharedChecklistItem(project.id, goal.id, itemId, { done });
      setProjects(
        (prev) =>
          prev?.map((p) =>
            p.id !== project.id
              ? p
              : {
                  ...p,
                  goals: p.goals.map((g) =>
                    g.id !== goal.id
                      ? g
                      : { ...g, checklist: g.checklist.map((it) => (it.id === itemId ? { ...it, done } : it)) },
                  ),
                },
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
              <Share2 size={18} strokeWidth={2.25} />
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">مشاريع مشترَكة معي</h2>
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

          {projects === null && !error && (
            <div className="flex justify-center py-16 text-ink-soft/50">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}

          {projects !== null && projects.length === 0 && (
            <div className="py-16 text-center">
              <Share2 className="mx-auto mb-3 text-ink-soft/40" size={44} />
              <p className="text-sm text-ink-soft">ما انضممت لأي مشروع مشترَك بعد.</p>
            </div>
          )}

          {projects?.map((project) => {
            const open = openProjectId === project.id;
            return (
              <div key={project.id} className="terrace-card overflow-hidden border border-line">
                <button
                  onClick={() => setOpenProjectId(open ? null : project.id)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-3 transition-colors duration-150"
                  style={{ backgroundColor: (project.color || "#6366f1") + "15" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color || "#6366f1" }}
                    />
                    <div className="min-w-0 text-start">
                      <p className="truncate text-sm font-semibold text-ink">
                        {project.name}
                      </p>
                      <p className="flex items-center gap-1 truncate text-[11px] text-ink-soft">
                        <User size={10} /> {project.ownerName} · {project.goals.length} هدف
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="space-y-2 bg-basin-2/30 p-3 animate-slide-down">
                    {project.goals.length === 0 && (
                      <p className="py-4 text-center text-xs text-ink-soft/70">ما فيه أهداف بهذا المشروع بعد.</p>
                    )}
                    {project.goals.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-lg border border-line bg-card p-2.5"
                        style={{ borderInlineStartWidth: 3, borderInlineStartColor: g.color || priorityColor(g.priority) }}
                      >
                        <p className="mb-1.5 text-sm font-medium text-ink">{g.name}</p>
                        <Select
                          value={g.status}
                          disabled={busyId === g.id}
                          onChange={(v) => changeStatus(project, g, v as SharedProjectGoal["status"])}
                          fullWidth
                          className="mb-1.5 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink"
                          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                        />
                        {g.checklist.length > 0 && (
                          <div className="space-y-1 border-t border-line pt-1.5">
                            {g.checklist.map((item) => (
                              <button
                                key={item.id}
                                disabled={busyId === g.id}
                                onClick={() => toggleItem(project, g, item.id, !item.done)}
                                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-start text-xs transition-colors duration-150 hover:bg-terrace-500/10"
                              >
                                {item.done ? (
                                  <CheckSquare size={14} className="shrink-0 text-terrace-600" />
                                ) : (
                                  <Square size={14} className="shrink-0 text-ink-soft/40" />
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
