import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  FolderDot,
  FolderOpen,
  Users,
  Target as TargetIcon,
  UserPlus,
  Loader2,
  Check,
  Lock,
} from "lucide-react";
import { useStore } from "../store";
import { t, tFormat } from "../lib/i18n";
import { useClosing } from "../lib/useClosing";
import type { Project, TeamMember } from "../types";
import { MemberAvatar } from "./TeamPanel";
import {
  inviteToProject,
  fetchProjectInvitations,
  removeProjectCollaborator,
  ApiError,
  type ProjectCollaboratorInfo,
  type ProjectInvitationInfo,
} from "../lib/api";

interface Props {
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
}

const PROJECT_COLORS = [
  "#6366f1", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#64748b",
];

export default function ProjectsPanel({ onClose, onOpenProject }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  const { projects, addProject, updateProject, deleteProject, goals, members, lang } = useStore();
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  const goalsByProject = (projectId: string) =>
    goals.filter((g) => !g.archived && g.projectId === projectId).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-lg flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <FolderDot size={18} strokeWidth={2.25} />
            </div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold leading-tight text-ink">
              {t(lang, "projects")}
              <span className="rounded-full bg-terrace-500/12 px-2 py-0.5 text-xs font-medium text-terrace-700">
                {projects.length}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setCreating(true);
                setEditing(null);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
            >
              <Plus size={16} /> {t(lang, "addProject")}
            </button>
            <button
              onClick={requestClose}
              className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {projects.length === 0 && !creating && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-terrace-500/12 text-terrace-600">
                <FolderDot size={32} />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">
                {t(lang, "noProjectsYet")}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">
                {t(lang, "noProjectsDesc")}
              </p>
              <button
                onClick={() => setCreating(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-terrace-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98]"
              >
                <Plus size={16} /> {t(lang, "addFirstProject")}
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {projects.map((project) => {
              const assignedCount = goalsByProject(project.id);
              const projectMembers = project.memberIds
                .map((id) => members.find((m) => m.id === id))
                .filter(Boolean) as TeamMember[];

              return (
                <div
                  key={project.id}
                  className="group terrace-card flex flex-col gap-3 border border-line bg-basin-2/40 p-4 transition-all duration-150 hover:border-terrace-500/40 hover:bg-basin-2/70"
                  style={{ borderInlineStartWidth: 3, borderInlineStartColor: project.color }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-bold text-ink">
                          {project.name}
                        </h3>
                        {assignedCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[10px] font-medium text-terrace-700"
                            title={t(lang, "assignedGoals")}
                          >
                            <TargetIcon size={10} /> {assignedCount}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        onClick={() => onOpenProject(project.id)}
                        title={t(lang, "openProject")}
                        className="rounded-md p-1.5 text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/10"
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(project);
                          setCreating(false);
                        }}
                        title={t(lang, "edit")}
                        className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(tFormat(lang, "confirmDeleteProject", { name: project.name }))) {
                            deleteProject(project.id);
                          }
                        }}
                        title={t(lang, "delete")}
                        className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Project members */}
                  {projectMembers.length > 0 && (
                    <div className="flex items-center gap-1.5 border-t border-line pt-2.5">
                      <Users size={12} className="text-ink-soft" />
                      <div className="flex flex-wrap gap-1">
                        {projectMembers.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full bg-basin-2 py-0.5 ps-1 pe-2 text-[11px] font-medium text-ink-soft"
                          >
                            <MemberAvatar member={m} size={14} />
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(creating || editing) && (
          <ProjectForm
            project={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={(data) => {
              if (editing) {
                updateProject(editing.id, data);
              } else {
                addProject(data);
              }
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ProjectForm({
  project,
  onClose,
  onSave,
}: {
  project: Project | null;
  onClose: () => void;
  onSave: (data: Omit<Project, "id" | "createdAt">) => void;
}) {
  const { members, lang } = useStore();
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [color, setColor] = useState(
    project?.color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
  );
  const [memberIds, setMemberIds] = useState<string[]>(project?.memberIds || []);
  const [sequentialLock, setSequentialLock] = useState(project?.sequentialLock ?? false);

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), color, memberIds, sequentialLock });
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="terrace-card flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden bg-card shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-line bg-basin-2/50 px-5 py-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {project ? t(lang, "editProject") : t(lang, "newProject")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <label className={labelCls}>{t(lang, "projectName")} *</label>
            <input
              autoFocus
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "projectNamePlaceholder")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "projectDesc")}</label>
            <textarea
              className={inputCls}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(lang, "projectDescPlaceholder")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "color")}</label>
            <div className="flex flex-wrap gap-2.5">
              {PROJECT_COLORS.map((c) => {
                const active = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: c,
                      boxShadow: active ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c}` : "none",
                      transform: active ? "scale(1.1)" : undefined,
                    }}
                  >
                    {active && <Check size={15} className="text-white drop-shadow" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>{t(lang, "projectMembers")}</label>
            {members.length === 0 ? (
              <p className="text-xs text-ink-soft/70">{t(lang, "noMembersYet")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const active = memberIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                        active
                          ? "border-terrace-500 bg-terrace-500/10 text-terrace-700 shadow-sm"
                          : "border-line text-ink-soft hover:border-terrace-300 hover:bg-terrace-500/5"
                      }`}
                    >
                      <MemberAvatar member={m} size={16} />
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setSequentialLock((v) => !v)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-start transition-colors duration-150 ${
                sequentialLock
                  ? "border-terrace-500 bg-terrace-500/10"
                  : "border-line hover:border-terrace-300 hover:bg-terrace-500/5"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
                  sequentialLock ? "border-terrace-600 bg-terrace-600" : "border-line"
                }`}
              >
                {sequentialLock && <Check size={13} className="text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Lock size={14} />
                  {t(lang, "sequentialLock")}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{t(lang, "sequentialLockDesc")}</span>
              </span>
            </button>
          </div>

          {project ? (
            <ProjectCollaboratorsSection projectId={project.id} />
          ) : (
            <p className="text-[11px] text-ink-soft/70">
              احفظ المشروع أول، وبعدين افتح تعديله عشان تقدر تدعو أشخاص من المنصة ينضمون له.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-basin-2/50 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
          >
            {t(lang, "cancel")}
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-lg bg-terrace-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {t(lang, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCollaboratorsSection({ projectId }: { projectId: string }) {
  const [collaborators, setCollaborators] = useState<ProjectCollaboratorInfo[] | null>(null);
  const [invitations, setInvitations] = useState<ProjectInvitationInfo[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const { goals, members, updateGoal } = useStore();

  const load = () => {
    fetchProjectInvitations(projectId)
      .then((res) => {
        setCollaborators(res.collaborators);
        setInvitations(res.invitations);
      })
      .catch(() => setCollaborators([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const sendInvite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await inviteToProject(projectId, email.trim());
      setEmail("");
      setOkMsg("تم إرسال الدعوة");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إرسال الدعوة");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: number) => {
    setBusy(true);
    try {
      const removedCollaborator = collaborators?.find((c) => c.id === userId);
      await removeProjectCollaborator(projectId, userId);

      // The server clears assignedTo on affected goals, but the local store
      // already has the old value cached — reconcile it here so the goal
      // shows as unassigned immediately instead of only after a reload.
      if (removedCollaborator) {
        const memberId = members.find(
          (m) => m.email.toLowerCase() === removedCollaborator.email.toLowerCase(),
        )?.id;
        if (memberId) {
          goals
            .filter((g) => g.projectId === projectId && g.assignedTo === memberId)
            .forEach((g) => updateGoal(g.id, { assignedTo: "" }));
        }
      }

      load();
    } catch {
      setError("تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        دعوة أشخاص من المنصة
      </label>
      <div className="flex gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), sendInvite())}
          placeholder="بريد الشخص المسجّل على المنصة"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15"
        />
        <button
          type="button"
          onClick={sendInvite}
          disabled={busy || !email.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          دعوة
        </button>
      </div>

      {error && <p className="mt-1.5 text-[11px] text-clay">{error}</p>}
      {okMsg && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-terrace-600"><Check size={12} /> {okMsg}</p>}

      {collaborators === null ? (
        <div className="mt-2 flex justify-center py-3 text-ink-soft/50">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        (collaborators.length > 0 || invitations.length > 0) && (
          <div className="mt-2.5 space-y-1.5 animate-slide-down">
            {collaborators.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-terrace-500/10 px-2.5 py-1.5 text-xs"
              >
                <span className="text-terrace-700">{c.name} · عضو بالمشروع</span>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded-md p-0.5 text-terrace-600 transition-colors duration-150 hover:bg-terrace-500/15"
                  title="إزالة"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {invitations.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg bg-gold-500/10 px-2.5 py-1.5 text-xs"
              >
                <span className="text-gold-600">{i.inviteeEmail} · بانتظار الرد</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
