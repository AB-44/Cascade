import { useMemo } from "react";
import {
  ArrowRight,
  UserPlus,
  Settings2,
  FileDown,
  Users,
  Target as TargetIcon,
  AlertTriangle,
  Lock,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";
import type { Project } from "../types";
import { useStore } from "../store";
import { deadlineState, isBlocked } from "../lib/goals";
import { ProgressBar } from "./ui";
import { MemberAvatar } from "./TeamPanel";

interface Props {
  project: Project;
  onOpenRoadmap: () => void;
  onManageProject: () => void;
  onExportReport: () => void;
}

type Health = "onTrack" | "atRisk" | "delayed" | "unknown";

const HEALTH_META: Record<Health, { label: string; dot: string; classes: string }> = {
  onTrack: { label: "على المسار", dot: "#22c55e", classes: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  atRisk: { label: "في خطر", dot: "#f59e0b", classes: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  delayed: { label: "متأخر", dot: "#ef4444", classes: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  unknown: { label: "بدون موعد نهائي", dot: "#94a3b8", classes: "bg-basin-2 text-ink-soft" },
};

export default function ProjectDetailPage({ project, onOpenRoadmap, onManageProject, onExportReport }: Props) {
  const { goals, members } = useStore();

  const projectGoals = useMemo(
    () => goals.filter((g) => g.projectId === project.id && !g.archived),
    [goals, project.id],
  );

  const totalGoals = projectGoals.length;
  const completedGoals = projectGoals.filter((g) => g.status === "Completed").length;
  const progressPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const overdue = projectGoals.filter((g) => g.deadline && deadlineState(g.deadline, g.status) === "overdue");
  const blocked = projectGoals.filter((g) => isBlocked(goals, g) && g.status !== "Completed");

  // Health: compare actual progress to how much of the timeline (from the
  // project's creation to its furthest deadline) has elapsed. No goal has
  // a deadline at all → nothing to compare against, so it's just "unknown"
  // rather than guessing.
  const health = useMemo<Health>(() => {
    const deadlines = projectGoals.map((g) => g.deadline).filter((d): d is string => !!d);
    if (deadlines.length === 0) return "unknown";
    const latestDeadline = new Date(Math.max(...deadlines.map((d) => new Date(d).getTime())));
    const start = new Date(project.createdAt).getTime();
    const now = Date.now();
    const end = latestDeadline.getTime();

    if (now > end && progressPct < 100) return "delayed";

    const totalSpan = Math.max(end - start, 1);
    const idealPct = Math.min(100, Math.max(0, ((now - start) / totalSpan) * 100));
    if (progressPct + 15 < idealPct) return "atRisk";
    return "onTrack";
  }, [projectGoals, project.createdAt, progressPct]);

  const workload = useMemo(() => {
    const projectMembers = members.filter((m) => project.memberIds.includes(m.id));
    return projectMembers
      .map((m) => {
        const assigned = projectGoals.filter((g) => g.assignedTo === m.name);
        const done = assigned.filter((g) => g.status === "Completed").length;
        return { member: m, total: assigned.length, done };
      })
      .filter((w) => w.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [members, project.memberIds, projectGoals]);

  // Lightweight activity feed derived from each goal's own updatedAt —
  // there's no dedicated audit log yet, so this shows *what last changed
  // and when*, not a full who-did-what history.
  const recentActivity = useMemo(
    () =>
      [...projectGoals]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [projectGoals],
  );

  const healthMeta = HEALTH_META[health];

  return (
    <div>
      {/* Header */}
      <div className="terrace-card border border-line bg-card p-5" style={{ borderTopWidth: 3, borderTopColor: project.color || "var(--color-terrace-500)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink">{project.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${healthMeta.classes}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: healthMeta.dot }} />
                {healthMeta.label}
              </span>
            </div>
            {project.description && <p className="mt-1 text-sm text-ink-soft">{project.description}</p>}
          </div>
          <button
            onClick={onOpenRoadmap}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
          >
            خارطة الطريق
            <ArrowRight size={15} className="rtl:rotate-180" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <ProgressBar value={progressPct} color={project.color} />
          <span className="font-mono-num shrink-0 text-sm font-semibold text-ink-soft">{progressPct}%</span>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onManageProject}
            className="inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-terrace-700"
          >
            <UserPlus size={15} />
            دعوة متعاون
          </button>
          <button
            onClick={onManageProject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
          >
            <Settings2 size={15} />
            إعدادات المشروع
          </button>
          <button
            onClick={onExportReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
          >
            <FileDown size={15} />
            تصدير تقرير
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "إجمالي الأهداف", value: totalGoals, icon: TargetIcon },
          { label: "مكتمل", value: completedGoals, icon: CheckCircle2 },
          { label: "متأخر", value: overdue.length, icon: AlertTriangle },
          { label: "الأعضاء", value: workload.length, icon: Users },
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Workload analysis */}
        <div className="terrace-card border border-line bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 font-display text-base font-semibold text-ink">
            <Users size={16} className="text-terrace-600" />
            عبء العمل حسب العضو
          </h2>
          {workload.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">ما فيه مهام مسندة لأحد بعد.</p>
          ) : (
            <div className="space-y-3">
              {workload.map(({ member, total, done }) => (
                <div key={member.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
                      <MemberAvatar member={member} size={20} />
                      <span className="truncate">{member.name}</span>
                    </span>
                    <span className="font-mono-num shrink-0 text-xs text-ink-soft">
                      {done}/{total} مهمة
                    </span>
                  </div>
                  <ProgressBar value={total > 0 ? Math.round((done / total) * 100) : 0} color={member.color} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue & blocked */}
        <div className="terrace-card border border-line bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 font-display text-base font-semibold text-ink">
            <AlertTriangle size={16} className="text-red-500" />
            المهام المتأخرة والموقوفة
          </h2>
          {overdue.length === 0 && blocked.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">ما فيه أي مهام متأخرة أو موقوفة 🎉</p>
          ) : (
            <div className="space-y-2">
              {overdue.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 dark:bg-red-500/10">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
                    <Clock size={13} className="shrink-0 text-red-500" />
                    <span className="truncate">{g.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400">
                    {new Date(g.deadline!).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
              {blocked
                .filter((g) => !overdue.includes(g))
                .map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-2.5 py-2 dark:bg-rose-500/10">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
                      <Lock size={13} className="shrink-0 text-rose-500" />
                      <span className="truncate">{g.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-rose-600 dark:text-rose-400">موقوفة</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity stream */}
      <div className="terrace-card mt-4 border border-line bg-card p-4">
        <h2 className="mb-1 flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Clock size={16} className="text-terrace-600" />
          آخر التحديثات
        </h2>
        <p className="mb-3 text-xs text-ink-soft">أحدث الأهداف تحديثًا بالمشروع — للتفاصيل الكاملة افتح الهدف نفسه.</p>
        {recentActivity.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">ما فيه نشاط بعد.</p>
        ) : (
          <div className="space-y-1.5">
            {recentActivity.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-ink/5">
                <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                  {g.status === "Completed" ? (
                    <CheckCircle2 size={14} className="shrink-0 text-terrace-600" />
                  ) : g.status === "In Progress" ? (
                    <PlayCircle size={14} className="shrink-0 text-amber-500" />
                  ) : (
                    <Circle size={14} className="shrink-0 text-ink-soft/40" />
                  )}
                  <span className="truncate">{g.name}</span>
                  {g.assignedTo && <span className="shrink-0 text-xs text-ink-soft">· {g.assignedTo}</span>}
                </span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {new Date(g.updatedAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
