import { useMemo, useState } from "react";
import {
  ArrowRight,
  Users,
  Target as TargetIcon,
  AlertTriangle,
  Lock,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  CalendarClock,
  Star,
  Handshake,
  FileX,
  UserCircle2,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { leaveProject, isSharedStageLocked, type SharedProject, type SharedProjectGoal } from "../lib/api";
import { deadlineState, priorityColor } from "../lib/goals";
import { ProgressBar, ProgressRing } from "./ui";
import { MemberAvatar } from "./TeamPanel";
import ConfirmModal from "./ConfirmModal";

interface Props {
  project: SharedProject;
  onOpenRoadmap: () => void;
  onBack?: () => void;
  onLeft?: () => void;
}

type Health = "onTrack" | "atRisk" | "delayed" | "unknown";
type Tab = "overview" | "tasks" | "files" | "activity";

const HEALTH_META: Record<Health, { label: string; hint: string; dot: string; classes: string; icon: typeof AlertTriangle }> = {
  onTrack: { label: "على المسار", hint: "المشروع يسير حسب الخطة", dot: "#22c55e", classes: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300", icon: CheckCircle2 },
  atRisk: { label: "في خطر", hint: "يحتاج إلى اهتمام", dot: "#f59e0b", classes: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", icon: AlertTriangle },
  delayed: { label: "متأخر", hint: "تجاوز الموعد النهائي", dot: "#ef4444", classes: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", icon: AlertTriangle },
  unknown: { label: "بدون موعد نهائي", hint: "أضف مواعيد للمهام لمتابعة الأداء", dot: "#94a3b8", classes: "bg-basin-2 text-ink-soft", icon: Clock },
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "نظرة عامة" },
  { id: "tasks", label: "المهام" },
  { id: "files", label: "الملفات" },
  { id: "activity", label: "النشاط" },
];

/**
 * Same visual shell as ProjectDetailPage, but for a project someone else
 * owns and invited me into. Deliberately excludes every owner-only action
 * (manage/settings, archive, invite, remove-member) — this is display +
 * "leave" only, matching what the backend actually authorizes a
 * collaborator to do. Sourced entirely from the SharedProject payload,
 * never the local `goals`/`projects` store.
 */
export default function SharedProjectDetailPage({ project, onOpenRoadmap, onBack, onLeft }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveProject(project.id);
      onLeft ? onLeft() : onBack?.();
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  const projectGoals = project.goals;
  const totalGoals = projectGoals.length;
  const completedGoals = projectGoals.filter((g) => g.status === "Completed").length;
  const inProgressGoals = projectGoals.filter((g) => g.status === "In Progress").length;
  const progressPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const overdue = projectGoals.filter((g) => g.deadline && deadlineState(g.deadline, g.status) === "overdue");

  // "Blocked/waiting" here means sitting inside a sequentially-locked stage
  // — shared projects don't have the local depends-on graph, only stage
  // locking (see isSharedStageLocked).
  const lockedStageIds = useMemo(() => {
    const topLevel = projectGoals.filter((g) => !g.parentId);
    return new Set(topLevel.filter((s) => isSharedStageLocked(project, s)).map((s) => s.id));
  }, [project, projectGoals]);
  const stageOf = (g: SharedProjectGoal): string | null => {
    let current: SharedProjectGoal | undefined = g;
    const byId = new Map(projectGoals.map((x) => [x.id, x]));
    while (current?.parentId) current = byId.get(current.parentId);
    return current && current.id !== g.id ? current.id : g.parentId ? null : current?.id ?? null;
  };
  const blocked = projectGoals.filter((g) => g.status !== "Completed" && lockedStageIds.has(g.parentId ? (stageOf(g) ?? "") : g.id));
  const waitingGoals = blocked.length;
  const notStartedGoals = projectGoals.filter((g) => g.status === "Not Started" && !blocked.includes(g)).length;

  const latestDeadline = useMemo(() => {
    if (project.deadline) {
      return new Date(project.deadline.includes("T") ? project.deadline : project.deadline + "T23:59:59");
    }
    const deadlines = projectGoals.map((g) => g.deadline).filter((d): d is string => !!d);
    if (deadlines.length === 0) return null;
    return new Date(Math.max(...deadlines.map((d) => new Date(d).getTime())));
  }, [projectGoals, project.deadline]);

  const health = useMemo<Health>(() => {
    if (!latestDeadline) return "unknown";
    const start = 0; // no per-project createdAt on SharedProject — fall back to a pure deadline check
    const now = Date.now();
    const end = latestDeadline.getTime();
    if (now > end && progressPct < 100) return "delayed";
    if (start === 0) return progressPct >= 60 ? "onTrack" : "atRisk";
    return "onTrack";
  }, [latestDeadline, progressPct]);

  const topPriority = useMemo(() => {
    const active = projectGoals.filter((g) => g.status !== "Completed");
    if (active.some((g) => g.priority === "High")) return "High" as const;
    if (active.some((g) => g.priority === "Medium")) return "Medium" as const;
    if (active.some((g) => g.priority === "Low")) return "Low" as const;
    return null;
  }, [projectGoals]);

  const daysLeft = useMemo(() => {
    if (!latestDeadline) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(latestDeadline);
    deadlineDate.setHours(0, 0, 0, 0);
    return Math.round((deadlineDate.getTime() - now.getTime()) / 86400000);
  }, [latestDeadline]);

  const workload = useMemo(() => {
    return project.members
      .map((m) => {
        const assigned = projectGoals.filter((g) => g.assignedTo === m.id || g.assignedTo === m.name);
        const done = assigned.filter((g) => g.status === "Completed").length;
        return { member: m, total: assigned.length, done };
      })
      .sort((a, b) => b.total - a.total);
  }, [project.members, projectGoals]);

  const recentActivity = useMemo(
    () => [...projectGoals].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8),
    [projectGoals],
  );

  const healthMeta = HEALTH_META[health];

  const donutSegs = [
    { v: completedGoals, color: "#22c55e", label: "مكتملة" },
    { v: inProgressGoals, color: "#f59e0b", label: "قيد التنفيذ" },
    { v: waitingGoals, color: "#ef4444", label: "في الانتظار" },
    { v: notStartedGoals, color: "#94a3b8", label: "لم تبدأ" },
  ];
  const size = 160;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
        >
          <ChevronLeft size={15} className="rtl:rotate-180" />
          العودة إلى المشاريع
        </button>
      )}

      {/* Header */}
      <div className="terrace-card border border-line bg-card p-5" style={{ borderTopWidth: 3, borderTopColor: project.color || "var(--color-terrace-500)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${healthMeta.classes}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: healthMeta.dot }} />
                {healthMeta.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-terrace-500/12 px-2.5 py-1 text-xs font-semibold text-terrace-700">
                <Handshake size={12} /> مشترك
              </span>
              <h1 className="font-display text-2xl font-semibold text-ink">{project.name}</h1>
            </div>
            {project.description && <p className="mt-1 text-sm text-ink-soft">{project.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <UserCircle2 size={13} /> {project.ownerName}
              </span>
              <span className="inline-flex items-center gap-1">
                <PlayCircle size={13} /> {totalGoals === 0 ? "لم يبدأ بعد" : progressPct === 100 ? "مكتمل" : "قيد التنفيذ"}
              </span>
            </div>
          </div>
          <button
            onClick={onOpenRoadmap}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
          >
            خارطة الطريق
            <ArrowRight size={15} className="rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="terrace-card border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <ProgressRing value={progressPct} size={44} stroke={5} color={project.color || "#1F6E5C"} />
            <div className="min-w-0">
              <p className="font-mono-num text-lg font-semibold text-ink">{progressPct}%</p>
              <p className="text-[11px] text-ink-soft">من الهدف</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">{completedGoals}/{totalGoals} مهمة</p>
        </div>

        <div className="terrace-card border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <healthMeta.icon size={18} style={{ color: healthMeta.dot }} />
            <p className="text-sm font-semibold text-ink">{healthMeta.label}</p>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">{healthMeta.hint}</p>
          <button onClick={() => setTab("tasks")} className="mt-2 text-xs font-semibold text-terrace-600 hover:underline">
            عرض التفاصيل
          </button>
        </div>

        <div className="terrace-card border border-line bg-card p-4">
          <div className="flex items-center gap-2 text-terrace-600">
            <CalendarClock size={17} />
            <span className="font-mono-num text-lg font-semibold text-ink">
              {daysLeft === null ? "—" : daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` : daysLeft === 0 ? "اليوم" : `${daysLeft} يوم`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">الموعد النهائي</p>
          <p className="mt-1 text-xs text-ink-soft">{latestDeadline ? latestDeadline.toLocaleDateString() : "غير محدد"}</p>
        </div>

        <div className="terrace-card border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <Star size={17} style={{ color: topPriority ? priorityColor(topPriority) : "#94a3b8" }} />
            <span className="text-sm font-semibold text-ink">{topPriority ?? "—"}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">أعلى أولوية للمهام النشطة</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Project details */}
        <div className="terrace-card flex flex-col justify-between border border-line bg-card p-4">
          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">تفاصيل المشروع</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">صاحب المشروع</dt>
                <dd className="font-medium text-ink">{project.ownerName}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">الموعد النهائي</dt>
                <dd className="font-medium text-ink">{latestDeadline ? latestDeadline.toLocaleDateString() : "غير محدد"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">نوع المشروع</dt>
                <dd className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <Handshake size={13} className="text-terrace-600" /> مشروع مشترك
                </dd>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <dt className="text-ink-soft">التقدم العام</dt>
                  <dd className="font-mono-num font-medium text-ink">{progressPct}%</dd>
                </div>
                <ProgressBar value={progressPct} color={project.color} />
              </div>
              {project.description && (
                <div className="border-t border-line pt-2.5">
                  <dt className="mb-1 text-ink-soft">الوصف</dt>
                  <dd className="text-ink">{project.description}</dd>
                </div>
              )}
            </dl>
          </div>

          <button
            onClick={() => setConfirmLeave(true)}
            disabled={leaving}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-clay/30 px-3 py-2 text-sm font-semibold text-clay transition-colors duration-150 hover:bg-clay/10 disabled:opacity-60"
          >
            <LogOut size={15} />
            {leaving ? "جارٍ الخروج..." : "الخروج من المشروع"}
          </button>
        </div>

        {/* Team */}
        <div className="terrace-card border border-line bg-card p-4">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">فريق المشروع</h2>
          {project.members.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">ما فيه أعضاء مرتبطون بهذا المشروع بعد.</p>
          ) : (
            <div className="space-y-1">
              {[...project.members]
                .sort((a, b) => {
                  const aIsOwner = a.name.trim().toLowerCase() === project.ownerName.trim().toLowerCase();
                  const bIsOwner = b.name.trim().toLowerCase() === project.ownerName.trim().toLowerCase();
                  if (aIsOwner) return -1;
                  if (bIsOwner) return 1;
                  return 0;
                })
                .map((m) => {
                  const isOwner = m.name.trim().toLowerCase() === project.ownerName.trim().toLowerCase();
                  const isMe = m.id === project.myMemberId;
                  const roleText = isOwner ? (isMe ? "مالك المشروع (أنت)" : "مالك المشروع") : isMe ? "أنت" : "عضو";

                  return (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-2">
                      <div className="relative shrink-0">
                        <MemberAvatar member={m} size={32} />
                        <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                        <p className="truncate text-xs text-ink-soft">{roleText}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="mb-3 flex rounded-xl border border-line bg-card p-1">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === tb.id ? "bg-terrace-600 text-white shadow-sm" : "text-ink-soft hover:bg-ink/5"}`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="terrace-card border border-line bg-card p-4">
              <h2 className="mb-4 flex items-center gap-1.5 font-display text-base font-semibold text-ink">
                <TargetIcon size={16} className="text-terrace-600" />
                تقدم المهام
              </h2>
              {totalGoals === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">ما فيه مهام بهذا المشروع بعد.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-8">
                  <div className="relative shrink-0">
                    <svg width={size} height={size} className="-rotate-90">
                      {donutSegs.map((s, i) => {
                        if (s.v === 0) return null;
                        const frac = s.v / totalGoals;
                        const dash = frac * c;
                        const offset = -acc * c;
                        acc += frac;
                        return (
                          <circle
                            key={i}
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={stroke}
                            strokeDasharray={`${dash} ${c - dash}`}
                            strokeDashoffset={offset}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono-num text-2xl font-semibold text-ink">{progressPct}%</span>
                      <span className="text-[11px] text-ink-soft">مكتمل</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {donutSegs.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-ink-soft">{s.label}</span>
                        <span className="font-mono-num font-semibold text-ink">{s.v}</span>
                        <span className="text-xs text-ink-soft">({totalGoals > 0 ? Math.round((s.v / totalGoals) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={onOpenRoadmap}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-ink/5"
              >
                <TargetIcon size={14} />
                عرض جميع المهام
              </button>
            </div>
          )}

          {tab === "tasks" && (
            <div className="space-y-4">
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
            </div>
          )}

          {tab === "files" && (
            <div className="terrace-card flex flex-col items-center justify-center border border-line bg-card px-4 py-16 text-center">
              <FileX className="mb-3 text-ink-soft/40" size={38} />
              <p className="text-sm text-ink-soft">لا توجد ملفات مرتبطة بهذا المشروع بعد.</p>
            </div>
          )}

          {tab === "activity" && (
            <div className="terrace-card border border-line bg-card p-4">
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
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {new Date(g.updatedAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmLeave && (
        <ConfirmModal
          icon={LogOut}
          destructive
          title="الخروج من المشروع"
          message={`الخروج من "${project.name}"؟ راح تفقد الوصول له، وتقدر ترجع بس إذا صاحب المشروع يدعوك مرة ثانية.`}
          confirmLabel={leaving ? "جارٍ الخروج..." : "الخروج"}
          cancelLabel="إلغاء"
          onConfirm={handleLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}
