import { useRef, useState } from "react";
import {
  X,
  FolderDot,
  Camera,
  Check,
  Archive,
  Download,
  Trash2,
  Eye,
  Users,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../store";
import { useClosing } from "../lib/useClosing";
import { t } from "../lib/i18n";
import type { Project } from "../types";
import { getStoredUser, archiveProject, forceDeleteProject } from "../lib/api";
import { MemberAvatar } from "./TeamPanel";
import { Select } from "./ui";
import { PROJECT_COLORS, ProjectCollaboratorsSection } from "./ProjectsPanel";
import ConfirmModal from "./ConfirmModal";

interface Props {
  project: Project;
  onClose: () => void;
  onOpenProject: () => void;
  initialTab?: Tab;
}

type Tab = "general" | "members" | "roles";

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "paused", label: "متوقف مؤقتًا" },
  { value: "completed", label: "مكتمل" },
];

/**
 * Settings for one existing project — reachable from ProjectDetailPage's
 * quick actions. Not a create form (that's still ProjectsPanel's simpler
 * ProjectForm); this is the fuller "manage everything about this project"
 * surface, including permanently destructive actions.
 */
export default function ProjectSettingsModal({ project, onClose, onOpenProject, initialTab = "general" }: Props) {
  const { closing, requestClose } = useClosing(onClose);
  const { updateProject, archiveProjectLocally, goals, members, lang } = useStore();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [image, setImage] = useState<string | null>(project.image ?? null);
  const [isShared, setIsShared] = useState(project.isShared);
  const [lifecycleStatus, setLifecycleStatus] = useState(project.lifecycleStatus);
  const [showOnDashboard, setShowOnDashboard] = useState(project.showOnDashboard);
  const [allowNewGoals, setAllowNewGoals] = useState(project.allowNewGoals);
  const [memberIds, setMemberIds] = useState<string[]>(project.memberIds);

  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const projectGoals = goals.filter((g) => g.projectId === project.id);
  const totalGoals = projectGoals.length;
  const completedGoals = projectGoals.filter((g) => g.status === "Completed").length;
  const projectMembers = members.filter((m) => project.memberIds.includes(m.id));
  const owner = getStoredUser();

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setImage(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      color,
      image,
      isShared,
      lifecycleStatus,
      showOnDashboard,
      allowNewGoals,
      memberIds,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleArchive = async () => {
    setConfirmArchive(false);
    setArchiving(true);
    try {
      await archiveProject(project.id);
      archiveProjectLocally(project.id);
      requestClose();
    } catch {
      alert("تعذّرت أرشفة المشروع.");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await forceDeleteProject(project.id);
      archiveProjectLocally(project.id);
      requestClose();
    } catch {
      alert("تعذّر حذف المشروع.");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const payload = {
      project: { id: project.id, name: project.name, description: project.description },
      exportedAt: new Date().toISOString(),
      goals: projectGoals.map((g) => ({
        name: g.name,
        status: g.status,
        progress: g.progress,
        priority: g.priority,
        assignedTo: g.assignedTo,
        deadline: g.deadline,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden bg-card shadow-2xl ${closing ? "animate-scale-out" : "animate-scale-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <ShieldCheck size={19} className="text-terrace-600" />
            إعدادات المشروع
          </h2>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-ink/5">
            <X size={19} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="terrace-card border border-line bg-basin-2/40 p-4 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: color + "22" }}>
                {image ? (
                  <img src={image} className="h-full w-full object-cover" />
                ) : (
                  <FolderDot size={28} style={{ color }} />
                )}
              </div>
              <p className="truncate font-display text-base font-semibold text-ink">{project.name}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[11px] font-semibold text-terrace-700">
                <span className="h-1.5 w-1.5 rounded-full bg-terrace-500" />
                {STATUS_OPTIONS.find((s) => s.value === lifecycleStatus)?.label}
              </span>
              {project.description && <p className="mt-2 line-clamp-2 text-xs text-ink-soft">{project.description}</p>}

              <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-start text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">تاريخ الإنشاء</span>
                  <span className="text-ink">{new Date(project.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">مالك المشروع</span>
                  <span className="text-ink">{owner?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">عدد الأعضاء</span>
                  <span className="text-ink">{projectMembers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">المهام</span>
                  <span className="text-ink font-mono-num">
                    {completedGoals}/{totalGoals}
                  </span>
                </div>
              </div>

              <button
                onClick={onOpenProject}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/5"
              >
                <Eye size={13} />
                عرض المشروع
              </button>
            </div>

            <div className="terrace-card border border-line bg-card p-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">إجراءات المشروع</p>
              <button
                disabled={archiving}
                onClick={() => setConfirmArchive(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60"
              >
                {archiving ? <Loader2 size={16} className="animate-spin text-ink-soft" /> : <Archive size={16} className="text-ink-soft" />}
                <span>
                  أرشفة المشروع
                  <span className="block text-[11px] font-normal text-ink-soft">أرشفة المشروع مع الاحتفاظ بالبيانات</span>
                </span>
              </button>
              <button
                onClick={handleExport}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-ink transition-colors duration-150 hover:bg-ink/5"
              >
                <Download size={16} className="text-ink-soft" />
                <span>
                  تصدير المشروع
                  <span className="block text-[11px] font-normal text-ink-soft">تصدير بيانات المشروع كملف JSON</span>
                </span>
              </button>
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-clay transition-colors duration-150 hover:bg-clay/10 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>
                  حذف المشروع
                  <span className="block text-[11px] font-normal text-clay/70">حذف المشروع نهائيًا وجميع بياناته</span>
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0">
            <div className="mb-4 flex gap-1 border-b border-line">
              {([
                { id: "general", label: "عام" },
                { id: "members", label: "الأعضاء" },
                { id: "roles", label: "الأدوار والصلاحيات" },
              ] as { id: Tab; label: string }[]).map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    tab === tb.id ? "border-terrace-600 text-terrace-700" : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {tab === "general" && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>اسم المشروع</label>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>الوصف</label>
                  <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div>
                  <label className={labelCls}>صورة المشروع</label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-basin-2">
                      {image ? <img src={image} className="h-full w-full object-cover" /> : <FolderDot size={22} className="text-ink-soft" />}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                    >
                      <Camera size={13} />
                      اختر صورة
                    </button>
                    <p className="text-[11px] text-ink-soft">اختر صورة, GIF. الحد الأقصى 2MB</p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>هل المشروع مشترك أو خاص</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsShared(false)}
                      className={`flex items-start gap-2.5 rounded-lg border p-3 text-start transition-colors duration-150 ${
                        !isShared ? "border-terrace-500 bg-terrace-500/10" : "border-line hover:border-terrace-300 hover:bg-terrace-500/5"
                      }`}
                    >
                      <FolderDot size={16} className="mt-0.5 shrink-0 text-ink-soft" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{t(lang, "projectPrivate")}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{t(lang, "projectPrivateDesc")}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setIsShared(true)}
                      className={`flex items-start gap-2.5 rounded-lg border p-3 text-start transition-colors duration-150 ${
                        isShared ? "border-terrace-500 bg-terrace-500/10" : "border-line hover:border-terrace-300 hover:bg-terrace-500/5"
                      }`}
                    >
                      <Users size={16} className="mt-0.5 shrink-0 text-ink-soft" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{t(lang, "projectShared")}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{t(lang, "projectSharedDesc")}</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>اللون</label>
                  <div className="flex flex-wrap gap-2.5">
                    {PROJECT_COLORS.map((c) => {
                      const active = color === c;
                      return (
                        <button
                          key={c}
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

                <div className="terrace-card border border-line bg-basin-2/30 p-4">
                  <p className="mb-3 text-sm font-semibold text-ink">حالة المشروع</p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>حالة المشروع</label>
                      <Select
                        value={lifecycleStatus}
                        onChange={(v) => setLifecycleStatus(v as Project["lifecycleStatus"])}
                        options={STATUS_OPTIONS}
                        fullWidth
                      />
                      <p className="mt-1 text-[11px] text-ink-soft">تحديد ما إذا كان المشروع نشطًا أو مؤقتًا أو مكتملًا.</p>
                    </div>
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm text-ink">إظهار في لوحة التحكم</span>
                        <span className="block text-[11px] text-ink-soft">عرض المشروع في قائمة المشاريع باللوحة الرئيسية.</span>
                      </span>
                      <button
                        onClick={() => setShowOnDashboard((v) => !v)}
                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ${showOnDashboard ? "bg-terrace-600" : "bg-line"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${showOnDashboard ? "translate-x-0.5" : "translate-x-[18px]"}`}
                        />
                      </button>
                    </label>
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm text-ink">السماح بإنشاء مهام جديدة</span>
                        <span className="block text-[11px] text-ink-soft">السماح لأعضاء الفريق بإنشاء مهام جديدة داخل المشروع.</span>
                      </span>
                      <button
                        onClick={() => setAllowNewGoals((v) => !v)}
                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ${allowNewGoals ? "bg-terrace-600" : "bg-line"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${allowNewGoals ? "translate-x-0.5" : "translate-x-[18px]"}`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
                  >
                    حفظ التغييرات
                  </button>
                  {saved && <span className="text-xs font-medium text-terrace-600">تم الحفظ ✓</span>}
                </div>
              </div>
            )}

            {tab === "members" && (
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>أعضاء الفريق المسؤولون عن مهام هذا المشروع</label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const active = memberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMember(m.id)}
                          className={`flex items-center gap-1.5 rounded-full border py-1 ps-1 pe-2.5 text-xs font-medium transition-colors duration-150 ${
                            active ? "border-terrace-500 bg-terrace-500/10 text-terrace-700" : "border-line text-ink-soft hover:border-terrace-300"
                          }`}
                        >
                          <MemberAvatar member={m} size={18} />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSave}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
                  >
                    حفظ التغييرات
                  </button>
                </div>
                <div className="border-t border-line pt-4">
                  <label className={labelCls}>التعاون مع حسابات أخرى على المنصة</label>
                  <ProjectCollaboratorsSection projectId={project.id} />
                </div>
              </div>
            )}

            {tab === "roles" && (
              <div className="space-y-2.5">
                <p className="mb-3 text-xs text-ink-soft">
                  صلاحيات هذا المشروع بسيطة حاليًا: صاحب المشروع يملك تحكمًا كاملًا، والأعضاء المتعاونون يقدرون يشوفون كل شي ويعدّلون بس المهام المسندة إليهم.
                </p>
                <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-ink">
                    <ShieldCheck size={15} className="text-terrace-600" />
                    {owner?.name ?? "—"}
                  </span>
                  <span className="rounded-full bg-terrace-500/12 px-2 py-0.5 text-[11px] font-semibold text-terrace-700">مالك</span>
                </div>
                {projectMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <MemberAvatar member={m} size={18} />
                      {m.name}
                    </span>
                    <span className="rounded-full bg-basin-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft">عضو فريق</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmArchive && (
        <ConfirmModal
          icon={Archive}
          title="أرشفة المشروع"
          message={`أرشفة "${project.name}" وجميع مهامه؟ تقدر تسترجعه لاحقًا من الأرشيف.`}
          confirmLabel="أرشفة المشروع"
          cancelLabel="إلغاء"
          footnote="يمكنك استرجاع المشروع وأهدافه بالكامل من صفحة الأرشيف في أي وقت."
          onConfirm={handleArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          icon={Trash2}
          destructive
          title="حذف المشروع نهائيًا"
          message={`حذف "${project.name}" نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه — راح يمسح المشروع وكل مهامه من قاعدة البيانات نهائيًا.`}
          confirmLabel="حذف نهائي"
          cancelLabel="إلغاء"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
