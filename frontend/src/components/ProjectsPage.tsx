import { useEffect, useState } from "react";
import { Crown, Handshake, FolderDot, Loader2, Users, Target as TargetIcon, Settings2 } from "lucide-react";
import { fetchMyProjects, ApiError, type MyProject } from "../lib/api";
import { useStore } from "../store";
import { t } from "../lib/i18n";
import { ProgressBar } from "./ui";

export default function ProjectsPage({
  onOpenProject,
  onManage,
  refreshKey,
}: {
  onOpenProject: (projectId: string) => void;
  onManage: () => void;
  refreshKey: number;
}) {
  const { lang } = useStore();
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyProjects()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر تحميل المشاريع"));
  }, [refreshKey]);

  const owned = projects?.filter((p) => p.role === "owner") ?? [];
  const shared = projects?.filter((p) => p.role !== "owner") ?? [];
  const totalGoals = projects?.reduce((sum, p) => sum + p.goalCount, 0) ?? 0;
  const totalCompleted = projects?.reduce((sum, p) => sum + p.completedCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
            <FolderDot size={18} strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{t(lang, "projects")}</h1>
            <p className="text-xs text-ink-soft">مشاريعك الخاصة والمشاريع المشترَكة معك، في مكان واحد</p>
          </div>
        </div>
        <button
          onClick={onManage}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-terrace-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
        >
          <Settings2 size={15} />
          إدارة المشاريع
        </button>
      </div>

      {/* stat tiles */}
      {projects && projects.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "إجمالي المشاريع", value: projects.length, icon: FolderDot },
            { label: "مشاريعي", value: owned.length, icon: Crown },
            { label: "مشترَك معي", value: shared.length, icon: Handshake },
            {
              label: "إنجاز عام",
              value: totalGoals > 0 ? `${Math.round((totalCompleted / totalGoals) * 100)}%` : "—",
              icon: TargetIcon,
            },
          ].map((card) => (
            <div key={card.label} className="terrace-card border border-line bg-card p-4">
              <div className="flex items-center gap-2 text-terrace-600">
                <card.icon size={15} />
                <span className="font-mono-num text-xl font-semibold text-ink">{card.value}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{card.label}</p>
            </div>
          ))}
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
          <h2 className="font-display text-2xl text-ink">ما فيه مشاريع بعد</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-soft">
            أنشئ مشروعك الأول، أو انتظر دعوة من شخص ثاني للانضمام لمشروعه.
          </p>
          <button
            onClick={onManage}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
          >
            <Settings2 size={15} />
            إنشاء مشروع جديد
          </button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => onOpenProject(p.role === "owner" ? p.id : `shared:${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: MyProject; onClick: () => void }) {
  const isOwner = project.role === "owner";

  return (
    <button
      onClick={onClick}
      className="terrace-card group flex flex-col border border-line bg-card p-4 text-start shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderTopWidth: 3, borderTopColor: project.color || "var(--color-terrace-500)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">{project.name}</h3>
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

      {!isOwner && <p className="mt-0.5 text-xs text-ink-soft">بواسطة {project.ownerName}</p>}
      {project.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={project.progressPct} color={project.color || "#1F6E5C"} />
        <span className="font-mono-num text-xs font-semibold text-ink-soft">{project.progressPct}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <TargetIcon size={12} />
          {project.completedCount}/{project.goalCount} هدف
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {project.memberCount}
        </span>
      </div>
    </button>
  );
}
