import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Handshake,
  FolderDot,
  Loader2,
  Users,
  Target as TargetIcon,
  Settings2,
  Plus,
  Search,
  LayoutGrid,
  Rows3,
  CalendarClock,
  Sparkles,
  Zap,
} from "lucide-react";
import { fetchMyProjects, ApiError, type MyProject } from "../lib/api";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import { ProgressBar, Select } from "./ui";
import { MemberAvatar } from "./TeamPanel";

type StatusFilter = "all" | "idea" | "in_progress" | "completed";
type RoleFilter = "all" | "owned" | "shared";

const STATUS_STYLE: Record<MyProject["status"], { bg: string; text: string }> = {
  idea: { bg: "bg-indigo-500/12", text: "text-indigo-500" },
  in_progress: { bg: "bg-gold-100", text: "text-gold-600" },
  completed: { bg: "bg-terrace-500/12", text: "text-terrace-700" },
};

export default function ProjectsPage({
  onOpenProject,
  onManage,
  onNewProject,
  refreshKey,
}: {
  onOpenProject: (projectId: string) => void;
  onManage: () => void;
  onNewProject?: () => void;
  refreshKey: number;
}) {
  const { lang } = useStore();
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchMyProjects()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر تحميل المشاريع"));
  }, [refreshKey]);

  const owned = projects?.filter((p) => p.role === "owner") ?? [];
  const shared = projects?.filter((p) => p.role !== "owner") ?? [];
  const totalGoals = projects?.reduce((sum, p) => sum + p.goalCount, 0) ?? 0;
  const totalCompleted = projects?.reduce((sum, p) => sum + p.completedCount, 0) ?? 0;
  const overallPct = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0;

  const filtered = useMemo(() => {
    if (!projects) return null;
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (roleFilter === "owned" && p.role !== "owner") return false;
      if (roleFilter === "shared" && p.role === "owner") return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, search, statusFilter, roleFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
            <FolderDot size={18} strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{t(lang, "projects")}</h1>
            <p className="text-xs text-ink-soft">مشاريعك الخاصة والمشاريع المشترَكة معك، في مكان واحد</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNewProject && (
            <button
              onClick={onNewProject}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-terrace-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
            >
              <Plus size={15} />
              {t(lang, "newProjectBtn")}
            </button>
          )}
          <button
            onClick={onManage}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-ink/5 active:scale-[0.97]"
          >
            <Settings2 size={15} />
            {t(lang, "manageProjects")}
          </button>
        </div>
      </div>

      {/* stat tiles */}
      {projects && projects.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={FolderDot} label={t(lang, "totalProjects")} value={projects.length} />
          <StatTile icon={Crown} label={t(lang, "myProjectsCount")} value={owned.length} />
          <StatTile icon={Handshake} label={t(lang, "sharedWithMeCount")} value={shared.length} />
          <StatTile
            icon={Zap}
            label={t(lang, "overallCompletion")}
            value={totalGoals > 0 ? `${overallPct}%` : "—"}
            progressBar={totalGoals > 0 ? overallPct : undefined}
          />
        </div>
      )}

      {/* filter / search toolbar */}
      {projects && projects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
              options={[
                { value: "all", label: t(lang, "allStatuses") },
                { value: "idea", label: t(lang, "projectStatusIdea") },
                { value: "in_progress", label: t(lang, "projectStatusInProgress") },
                { value: "completed", label: t(lang, "projectStatusCompleted") },
              ]}
            />
            <Select
              value={roleFilter}
              onChange={(v) => setRoleFilter(v as RoleFilter)}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
              options={[
                { value: "all", label: t(lang, "filterAll") },
                { value: "owned", label: t(lang, "filterOwnedOnly") },
                { value: "shared", label: t(lang, "filterSharedOnly") },
              ]}
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-none">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(lang, "searchProjectPlaceholder")}
                className="w-full rounded-lg border border-line bg-card py-2 ps-9 pe-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-1">
              <button
                onClick={() => setLayout("grid")}
                title={t(lang, "gridView")}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                  layout === "grid" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setLayout("list")}
                title={t(lang, "listView")}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                  layout === "list" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                <Rows3 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-clay/20 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
      )}

      {!projects && !error && (
        <div className="flex items-center justify-center gap-2 py-24 text-ink-soft">
          <Loader2 size={18} className="animate-spin" />
          جاري التحميل...
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-24 text-center">
          <div className="terrace-card mb-4 flex h-16 w-16 items-center justify-center bg-gradient-to-br from-terrace-600 to-terrace-800 text-terrace-50 shadow-lg">
            <FolderDot size={28} />
          </div>
          <h2 className="font-display text-2xl text-ink">{t(lang, "noProjectsYetTitle")}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{t(lang, "noProjectsYetDesc")}</p>
          <button
            onClick={onNewProject ?? onManage}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
          >
            <Plus size={15} />
            {t(lang, "newProjectBtn")}
          </button>
        </div>
      )}

      {projects && projects.length > 0 && filtered && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center">
          <Search size={32} className="mb-3 text-ink-soft/40" />
          <p className="text-sm text-ink-soft">ما فيه نتائج مطابقة</p>
        </div>
      )}

      {filtered && filtered.length > 0 && layout === "grid" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              lang={lang}
              onClick={() => onOpenProject(p.role === "owner" ? p.id : `shared:${p.id}`)}
            />
          ))}
        </div>
      )}

      {filtered && filtered.length > 0 && layout === "list" && (
        <div className="overflow-hidden rounded-xl border border-line">
          {filtered.map((p, i) => (
            <ProjectListRow
              key={p.id}
              project={p}
              lang={lang}
              isLast={i === filtered.length - 1}
              onClick={() => onOpenProject(p.role === "owner" ? p.id : `shared:${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  progressBar,
}: {
  icon: typeof FolderDot;
  label: string;
  value: number | string;
  progressBar?: number;
}) {
  return (
    <div className="terrace-card border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-terrace-600">
        <Icon size={15} />
        <span className="font-mono-num text-xl font-semibold text-ink">{value}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
      {progressBar !== undefined && (
        <div className="water-channel mt-2 h-1.5 rounded-full">
          <div className="water-fill rounded-full" style={{ width: `${progressBar}%`, background: "#17594B" }} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, lang }: { status: MyProject["status"]; lang: "en" | "ar" }) {
  const style = STATUS_STYLE[status];
  const label =
    status === "idea"
      ? t(lang, "projectStatusIdea")
      : status === "completed"
        ? t(lang, "projectStatusCompleted")
        : t(lang, "projectStatusInProgress");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
      {status === "idea" && <Sparkles size={10} />}
      {label}
    </span>
  );
}

function AvatarStack({ avatars, extra }: { avatars: MyProject["memberAvatars"]; extra: number }) {
  return (
    <div className="flex items-center -space-x-2 rtl:space-x-reverse">
      {avatars.map((a, i) => (
        <div key={i} className="ring-2 ring-card rounded-full">
          <MemberAvatar member={{ name: a.name, avatar: a.avatar ?? "", color: a.color ?? "#6366f1" }} size={26} />
        </div>
      ))}
      {extra > 0 && (
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-basin-2 text-[10px] font-semibold text-ink-soft ring-2 ring-card">
          +{extra}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, lang, onClick }: { project: MyProject; lang: "en" | "ar"; onClick: () => void }) {
  const isOwner = project.role === "owner";
  const shownAvatars = project.memberAvatars.slice(0, 3);
  const extra = Math.max(0, project.memberAvatars.length - shownAvatars.length);

  return (
    <button
      onClick={onClick}
      className="terrace-card group flex flex-col border border-line bg-card p-4 text-start shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderTopWidth: 3, borderTopColor: project.color || "var(--color-terrace-500)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: (project.color || "#1F6E5C") + "1f", color: project.color || "#1F6E5C" }}
        >
          <FolderDot size={16} />
        </div>
        <div className="flex items-center gap-1.5">
          {isOwner ? (
            <span title="مشروعك" className="shrink-0 text-gold-600">
              <Crown size={15} />
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[10px] font-semibold text-terrace-700">
              <Handshake size={11} />
              مشترك
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-3 min-w-0 truncate font-display text-lg font-semibold text-ink">{project.name}</h3>
      <div className="mt-1">
        <StatusBadge status={project.status} lang={lang} />
      </div>

      {!isOwner && <p className="mt-1.5 text-xs text-ink-soft">بواسطة {project.ownerName}</p>}
      {project.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono-num text-xs font-semibold text-ink-soft">{project.progressPct}%</span>
        <ProgressBar value={project.progressPct} color={project.color || "#1F6E5C"} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <TargetIcon size={12} />
          {project.completedCount}/{project.goalCount} مهمة
        </span>
        {shownAvatars.length > 0 ? (
          <AvatarStack avatars={shownAvatars} extra={extra} />
        ) : (
          <span className="inline-flex items-center gap-1">
            <Users size={12} />
            {project.memberCount}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-soft/70">
        <CalendarClock size={11} />
        {project.latestDeadline
          ? new Date(project.latestDeadline).toLocaleDateString()
          : t(lang, "noDueDate")}
      </div>
    </button>
  );
}

function ProjectListRow({
  project,
  lang,
  isLast,
  onClick,
}: {
  project: MyProject;
  lang: "en" | "ar";
  isLast: boolean;
  onClick: () => void;
}) {
  const isOwner = project.role === "owner";
  const shownAvatars = project.memberAvatars.slice(0, 3);
  const extra = Math.max(0, project.memberAvatars.length - shownAvatars.length);

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-wrap items-center gap-3 bg-card px-4 py-3.5 text-start transition-colors duration-150 hover:bg-basin-2/50 ${
        isLast ? "" : "border-b border-line"
      }`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: (project.color || "#1F6E5C") + "1f", color: project.color || "#1F6E5C" }}
      >
        <FolderDot size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-ink">{project.name}</h3>
          <StatusBadge status={project.status} lang={lang} />
          {isOwner ? (
            <span title="مشروعك" className="shrink-0 text-gold-600">
              <Crown size={13} />
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terrace-500/12 px-2 py-0.5 text-[10px] font-semibold text-terrace-700">
              <Handshake size={10} />
              مشترك
            </span>
          )}
        </div>
        {!isOwner && <p className="truncate text-xs text-ink-soft">بواسطة {project.ownerName}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-basin-2 px-3 py-1.5 text-xs font-medium text-ink-soft">
        <TargetIcon size={12} />
        {project.completedCount}/{project.goalCount}
      </div>

      <div className="order-last flex min-w-[140px] flex-1 items-center gap-2 sm:order-none">
        <div className="water-channel h-1.5 flex-1 rounded-full">
          <div className="water-fill rounded-full" style={{ width: `${project.progressPct}%`, background: "#17594B" }} />
        </div>
        <span className="font-mono-num text-xs font-semibold text-ink">{project.progressPct}%</span>
      </div>

      <div className="hidden shrink-0 items-center gap-1 text-[11px] text-ink-soft/70 sm:flex">
        <CalendarClock size={11} />
        {project.latestDeadline ? new Date(project.latestDeadline).toLocaleDateString() : t(lang, "noDueDate")}
      </div>

      {shownAvatars.length > 0 && <AvatarStack avatars={shownAvatars} extra={extra} />}
    </button>
  );
}
