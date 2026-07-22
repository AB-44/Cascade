import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, BookmarkPlus, FileStack, UserCircle2, Check, Target } from "lucide-react";
import { MemberAvatar } from "./TeamPanel";
import { Select, ProgressBar } from "./ui";
import type { Goal, Priority } from "../types";
import { useStore } from "../store";
import { allAssignees, allTags, getDescendants, newGoal } from "../lib/goals";
import { uid } from "../lib/storage";
import { t } from "../lib/i18n";
import { cn } from "../utils/cn";

interface Props {
  goal: Goal | null;
  defaultParentId?: string | null;
  defaultRoadmapOwnerId?: string | null;
  defaultProjectId?: string | null;
  onClose: () => void;
}

const COLORS = [
  "#6366f1", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#64748b",
];

export default function GoalForm({
  goal,
  defaultParentId = null,
  defaultRoadmapOwnerId = null,
  defaultProjectId = null,
  onClose,
}: Props) {
  const { goals, addGoal, updateGoal, saveAsTemplate, templates, createFromTemplate, lang, members, projects } =
    useStore();
  const isEdit = !!goal;
  const defaultOwnerMember = members.find((m) => m.id === defaultRoadmapOwnerId);
  const [form, setForm] = useState<Goal>(() =>
    goal
      ? { ...goal }
      : newGoal({
          parentId: defaultParentId,
          roadmapOwnerId: defaultRoadmapOwnerId,
          projectId: defaultProjectId,
          assignedTo: defaultOwnerMember?.name ?? "",
        }),
  );
  const [newCheck, setNewCheck] = useState("");
  const [templateMode, setTemplateMode] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const assignees = useMemo(() => allAssignees(goals), [goals]);
  const tags = useMemo(() => allTags(goals), [goals]);

  const parentOptions = useMemo(() => {
    const exclude = new Set<string>();
    if (goal) {
      exclude.add(goal.id);
      for (const d of getDescendants(goals, goal.id)) exclude.add(d.id);
    }
    return goals.filter(
      (g) =>
        !exclude.has(g.id) &&
        !g.archived &&
        (g.roadmapOwnerId ?? null) === (form.roadmapOwnerId ?? null) &&
        (g.projectId ?? null) === (form.projectId ?? null),
    );
  }, [goals, goal, form.roadmapOwnerId, form.projectId]);

  const dependsOptions = parentOptions;

  const set = <K extends keyof Goal>(k: K, v: Goal[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addChecklist = () => {
    if (!newCheck.trim()) return;
    set("checklist", [...form.checklist, { id: uid(), text: newCheck.trim(), done: false }]);
    setNewCheck("");
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (isEdit) updateGoal(form.id, form);
    else addGoal(form);
    onClose();
  };

  const handleSaveTemplate = () => {
    if (!isEdit) return;
    const name = prompt(t(lang, "templateName"), form.name || t(lang, "defaultTemplateName"));
    if (name) {
      saveAsTemplate(form.id, name);
      alert(t(lang, "savedTemplate"));
    }
  };

  const applyTemplate = (templateId: string) => {
    const newId = createFromTemplate(templateId, form.parentId);
    if (newId) onClose();
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";
  const sectionCls = "rounded-xl border border-line bg-basin-2/40 p-4 space-y-4";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="terrace-card flex h-full w-full max-w-xl flex-col overflow-hidden !rounded-none bg-card shadow-2xl animate-panel-in">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
              <Target size={19} strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight text-ink">
                {isEdit ? t(lang, "editGoal") : t(lang, "createGoal")}
              </h2>
              {form.name.trim() && (
                <p className="mt-0.5 truncate text-xs text-ink-soft">{form.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
            title={t(lang, "cancel")}
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!isEdit && templates.length > 0 && (
            <div className="rounded-xl border border-gold-500/30 bg-gold-50 p-3">
              <button
                onClick={() => setTemplateMode((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-gold-600"
              >
                <FileStack size={16} /> {t(lang, "createFromTemplateTitle")}
              </button>
              {templateMode && (
                <div className="mt-2.5 flex flex-wrap gap-2 animate-slide-down">
                  {templates.map((tp) => (
                    <button
                      key={tp.id}
                      onClick={() => applyTemplate(tp.id)}
                      className="rounded-lg border border-gold-500/40 bg-card px-3 py-1.5 text-xs font-medium text-gold-600 transition-colors duration-150 hover:bg-gold-100"
                    >
                      {tp.name} <span className="opacity-60">({tp.nodes.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Basics */}
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>{t(lang, "name")} *</label>
              <input
                autoFocus
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t(lang, "namePlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls}>{t(lang, "estimatedTime")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.estimatedMs ? Math.floor(form.estimatedMs / 3600000) : ""}
                  onChange={(e) => {
                    const h = Math.max(0, Number(e.target.value) || 0);
                    const currentM = form.estimatedMs ? Math.floor((form.estimatedMs % 3600000) / 60000) : 0;
                    const totalMs = h * 3600000 + currentM * 60000;
                    set("estimatedMs", totalMs > 0 ? totalMs : null);
                  }}
                  placeholder={t(lang, "hours")}
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  className={inputCls}
                  value={form.estimatedMs ? Math.floor((form.estimatedMs % 3600000) / 60000) : ""}
                  onChange={(e) => {
                    const m = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                    const currentH = form.estimatedMs ? Math.floor(form.estimatedMs / 3600000) : 0;
                    const totalMs = currentH * 3600000 + m * 60000;
                    set("estimatedMs", totalMs > 0 ? totalMs : null);
                  }}
                  placeholder={t(lang, "minutes")}
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-soft/70">{t(lang, "estimatedTimeHint")}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>{t(lang, "priority")}</label>
                <Select
                  className={inputCls}
                  fullWidth
                  value={form.priority}
                  onChange={(v) => set("priority", v as Priority)}
                  options={[
                    { value: "High", label: t(lang, "high") },
                    { value: "Medium", label: t(lang, "medium") },
                    { value: "Low", label: t(lang, "low") },
                  ]}
                />
              </div>
              <div>
                <label className={labelCls}>{t(lang, "startDate")}</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.startDate ? form.startDate.slice(0, 10) : ""}
                  onChange={(e) => set("startDate", e.target.value || null)}
                />
              </div>
              <div>
                <label className={labelCls}>{t(lang, "deadline")}</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.deadline ? form.deadline.slice(0, 10) : ""}
                  onChange={(e) => set("deadline", e.target.value || null)}
                />
              </div>
            </div>
          </div>

          {/* Assignment & identity */}
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>{t(lang, "assignTo")}</label>
              {members.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => set("assignedTo", "")}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                      !form.assignedTo
                        ? "border-terrace-500 bg-terrace-500/10 text-terrace-700 shadow-sm"
                        : "border-line text-ink-soft hover:border-terrace-300 hover:bg-terrace-500/5"
                    }`}
                  >
                    <UserCircle2 size={14} /> {t(lang, "unassigned")}
                  </button>
                  {members.map((m) => {
                    const active = form.assignedTo === m.name;
                    const currentProject = projects.find((p) => p.id === form.projectId);
                    const isProjectMember = currentProject ? currentProject.memberIds.includes(m.id) : true;
                    if (form.projectId && !isProjectMember && !active) return null;

                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => set("assignedTo", m.name)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                          active
                            ? "border-terrace-500 bg-terrace-500/10 text-terrace-700 shadow-sm"
                            : "border-line text-ink-soft hover:border-terrace-300 hover:bg-terrace-500/5"
                        }`}
                      >
                        <MemberAvatar member={m} size={18} />
                        {m.name}
                        {active && <Check size={12} className="text-terrace-600" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                list="assignees"
                className={inputCls}
                value={form.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
                placeholder={
                  members.length > 0
                    ? `${t(lang, "or")} ${t(lang, "typeName")}…`
                    : t(lang, "teammateName")
                }
              />
              <datalist id="assignees">
                {assignees.map((a) => (
                  <option key={a} value={a} />
                ))}
                {members.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelCls}>{t(lang, "tagCategory")}</label>
              <input
                list="tags"
                className={inputCls}
                value={form.tag}
                onChange={(e) => set("tag", e.target.value)}
                placeholder={t(lang, "tagPlaceholder")}
              />
              <datalist id="tags">
                {tags.map((tg) => (
                  <option key={tg} value={tg} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelCls}>{t(lang, "color")}</label>
              <div className="flex flex-wrap gap-2.5">
                {COLORS.map((c) => {
                  const active = form.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("color", c)}
                      aria-label={c}
                      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
                      style={{
                        backgroundColor: c,
                        boxShadow: active ? `0 0 0 2px var(--color-basin-2), 0 0 0 4px ${c}` : "none",
                        transform: active ? "scale(1.1)" : undefined,
                      }}
                    >
                      {active && <Check size={15} className="text-white drop-shadow" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scope & hierarchy */}
          <div className={sectionCls}>
            {projects.length > 0 && (
              <div>
                <label className={labelCls}>{t(lang, "projectScope")}</label>
                <Select
                  className={inputCls}
                  fullWidth
                  value={form.projectId ?? "general"}
                  onChange={(v) => {
                    const nextProject = v === "general" ? null : v;
                    const currentParent = form.parentId
                      ? goals.find((g) => g.id === form.parentId)
                      : null;
                    setForm((f) => ({
                      ...f,
                      projectId: nextProject,
                      parentId:
                        currentParent && (currentParent.projectId ?? null) !== nextProject
                          ? null
                          : f.parentId,
                    }));
                  }}
                  options={[
                    { value: "general", label: t(lang, "generalGoal") },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>{t(lang, "roadmapScope")}</label>
              <Select
                className={inputCls}
                fullWidth
                value={form.roadmapOwnerId ?? "team"}
                onChange={(v) => {
                  const nextOwner = v === "team" ? null : v;
                  const currentParent = form.parentId
                    ? goals.find((g) => g.id === form.parentId)
                    : null;
                  setForm((f) => ({
                    ...f,
                    roadmapOwnerId: nextOwner,
                    parentId:
                      currentParent && (currentParent.roadmapOwnerId ?? null) !== nextOwner
                        ? null
                        : f.parentId,
                  }));
                }}
                options={[
                  { value: "team", label: t(lang, "teamRoadmap") },
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${t(lang, "personalRoadmap")} - ${member.name}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className={labelCls}>{t(lang, "parentGoal")}</label>
              <Select
                className={inputCls}
                fullWidth
                value={form.parentId ?? ""}
                onChange={(v) => set("parentId", v || null)}
                options={[
                  { value: "", label: t(lang, "topLevel") },
                  ...parentOptions.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            </div>
          </div>

          <div className={sectionCls}>
            <div>
              <label className={labelCls}>{t(lang, "requirements")}</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.requirements}
                onChange={(e) => set("requirements", e.target.value)}
                placeholder={t(lang, "requirementsPlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls}>{t(lang, "notes")}</label>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-line bg-basin-2/40 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.autoProgress}
                onChange={(e) => set("autoProgress", e.target.checked)}
                className="h-4 w-4 accent-terrace-500"
              />
              {t(lang, "autoProgress")}
            </label>
            {!form.autoProgress && (
              <div className="mt-3 animate-slide-down">
                <div className="mb-2 flex justify-between text-xs text-ink-soft">
                  <span>{t(lang, "progress")}</span>
                  <span className="font-mono-num font-semibold text-ink">{form.progress}%</span>
                </div>
                <ProgressBar value={form.progress} color={form.color} className="mb-2" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    set("progress", p);
                    set(
                      "status",
                      p >= 100 ? "Completed" : p > 0 ? "In Progress" : "Not Started",
                    );
                  }}
                  className="w-full accent-terrace-600"
                />
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <label className={labelCls}>{t(lang, "checklist")}</label>
            <div className="space-y-2">
              {form.checklist.map((c) => (
                <div key={c.id} className="group flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={(e) =>
                      set(
                        "checklist",
                        form.checklist.map((x) =>
                          x.id === c.id ? { ...x, done: e.target.checked } : x,
                        ),
                      )
                    }
                    className="h-4 w-4 shrink-0 accent-terrace-500"
                  />
                  <input
                    className={cn(inputCls, c.done && "text-ink-soft line-through decoration-ink-soft/50")}
                    value={c.text}
                    onChange={(e) =>
                      set(
                        "checklist",
                        form.checklist.map((x) =>
                          x.id === c.id ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      set("checklist", form.checklist.filter((x) => x.id !== c.id))
                    }
                    className="shrink-0 rounded-md p-1 text-ink-soft/60 opacity-0 transition-all duration-150 hover:bg-clay/10 hover:text-clay group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={newCheck}
                  onChange={(e) => setNewCheck(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklist())}
                  placeholder={t(lang, "addChecklist")}
                />
                <button
                  onClick={addChecklist}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-terrace-600 px-3 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700 active:scale-[0.97]"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Depends on */}
          <div>
            <label className={labelCls}>{t(lang, "dependsOn")}</label>
            <div className="flex flex-wrap gap-2">
              {dependsOptions.length === 0 && (
                <span className="text-xs text-ink-soft/70">{t(lang, "noOtherGoals")}</span>
              )}
              {dependsOptions.map((g) => {
                const active = form.dependsOn.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() =>
                      set(
                        "dependsOn",
                        active
                          ? form.dependsOn.filter((id) => id !== g.id)
                          : [...form.dependsOn, g.id],
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                      active
                        ? "border-clay/50 bg-clay/10 text-clay shadow-sm"
                        : "border-line text-ink-soft hover:border-clay/30 hover:bg-clay/5"
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reminder */}
          <div className="rounded-xl border border-line bg-basin-2/40 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.reminder}
                onChange={(e) => set("reminder", e.target.checked)}
                className="h-4 w-4 accent-terrace-500"
              />
              {t(lang, "setReminder")}
            </label>
            {form.reminder && (
              <input
                type="datetime-local"
                className={`${inputCls} mt-3 animate-slide-down`}
                value={form.reminderAt ? form.reminderAt.slice(0, 16) : ""}
                onChange={(e) =>
                  set(
                    "reminderAt",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
              />
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-line bg-basin-2/50 px-5 py-3.5">
          {isEdit ? (
            <button
              onClick={handleSaveTemplate}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
            >
              <BookmarkPlus size={16} /> {t(lang, "saveAsTemplate")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink active:scale-[0.97]"
            >
              {t(lang, "cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.name.trim()}
              className="rounded-lg bg-terrace-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
            >
              {isEdit ? t(lang, "saveChanges") : t(lang, "createGoalBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
