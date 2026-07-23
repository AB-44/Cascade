import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  X,
  Loader2,
  CheckSquare,
  Square,
  User,
  FolderDot,
  Lock,
  StickyNote,
  CheckCircle2,
  Clock,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  fetchAssignedToMe,
  updateAssignedGoal,
  updateAssignedChecklistItem,
  ApiError,
  type AssignedGoal,
} from "../lib/api";
import type { Priority } from "../types";
import { priorityColor } from "../lib/goals";
import { useClosing } from "../lib/useClosing";
import { Select } from "./ui";

const STATUS_OPTIONS: AssignedGoal["status"][] = ["Not Started", "In Progress", "Completed"];

const STATUS_LABEL: Record<AssignedGoal["status"], string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};

const PRIORITY_LABEL: Record<Priority, string> = { High: "عالية", Medium: "متوسطة", Low: "منخفضة" };
const PRIORITY_RANK: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysAgo(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}
function relativeDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return "اليوم";
  if (isSameDay(d, tomorrow)) return "غدًا";
  return d.toLocaleDateString("ar", { day: "numeric", month: "short" });
}

/** Breadcrumb badge: task name lives on the card title already, so this
 *  just traces (project ⬅ stage) — the two levels of context a bare task
 *  name would otherwise lose. */
function Breadcrumb({ goal }: { goal: AssignedGoal }) {
  if (!goal.projectName && !goal.stageName) return null;
  const Arrow = document.dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-ink-soft">
      {goal.projectName && (
        <span className="inline-flex items-center gap-1">
          <FolderDot size={11} /> {goal.projectName}
        </span>
      )}
      {goal.stageName && (
        <>
          <Arrow size={11} className="text-ink-soft/50" />
          <span>{goal.stageName}</span>
        </>
      )}
    </div>
  );
}

export default function AssignedToMeView({ onGotoDeadlines }: { onGotoDeadlines: () => void }) {
  const [goals, setGoals] = useState<AssignedGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailGoal, setDetailGoal] = useState<AssignedGoal | null>(null);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "in_progress" | "waiting" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [sortBy, setSortBy] = useState<"deadline" | "priority" | "name">("deadline");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const load = () => {
    setError(null);
    fetchAssignedToMe()
      .then((res) => setGoals(res.goals))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر جلب المهام"));
  };

  useEffect(() => {
    load();
  }, []);

  const patchLocal = (goalId: string, patch: Partial<AssignedGoal>) => {
    setGoals((prev) => prev?.map((g) => (g.id === goalId ? { ...g, ...patch } : g)) ?? null);
    setDetailGoal((prev) => (prev && prev.id === goalId ? { ...prev, ...patch } : prev));
  };

  const changeStatus = async (goal: AssignedGoal, status: AssignedGoal["status"]) => {
    setBusyId(goal.id);
    try {
      await updateAssignedGoal(goal.id, { status });
      patchLocal(goal.id, { status });
    } catch {
      setError("تعذّر تحديث الحالة");
    } finally {
      setBusyId(null);
    }
  };

  const moveToStage = async (goal: AssignedGoal, stageId: string) => {
    setBusyId(goal.id);
    try {
      await updateAssignedGoal(goal.id, { moveToStageId: stageId });
      const stage = goal.availableStages.find((s) => s.id === stageId);
      patchLocal(goal.id, { stageId, stageName: stage?.name ?? goal.stageName });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر نقل المهمة");
    } finally {
      setBusyId(null);
    }
  };

  const toggleItem = async (goal: AssignedGoal, itemId: string, done: boolean) => {
    setBusyId(goal.id);
    try {
      await updateAssignedChecklistItem(goal.id, itemId, { done });
      patchLocal(goal.id, { checklist: goal.checklist.map((it) => (it.id === itemId ? { ...it, done } : it)) });
    } catch {
      setError("تعذّر تحديث العنصر");
    } finally {
      setBusyId(null);
    }
  };

  // ---- stats (all computed from real data — nothing fabricated) ----
  const total = goals?.length ?? 0;
  const completed = goals?.filter((g) => g.status === "Completed").length ?? 0;
  const inProgress = goals?.filter((g) => g.status === "In Progress" && !g.locked).length ?? 0;
  const waiting = goals?.filter((g) => g.locked).length ?? 0;
  const overallProgress = total > 0 ? Math.round((goals ?? []).reduce((s, g) => s + g.progress, 0) / total) : 0;
  const dueToday =
    goals?.filter((g) => g.status === "In Progress" && g.deadline && isSameDay(new Date(g.deadline), new Date()))
      .length ?? 0;
  const completedThisWeek =
    goals?.filter((g) => g.status === "Completed" && daysAgo(g.updatedAt) <= 7).length ?? 0;

  const filtered = useMemo(() => {
    let list = goals ?? [];
    if (statusTab === "in_progress") list = list.filter((g) => g.status === "In Progress" && !g.locked);
    else if (statusTab === "waiting") list = list.filter((g) => g.locked);
    else if (statusTab === "completed") list = list.filter((g) => g.status === "Completed");
    if (priorityFilter !== "all") list = list.filter((g) => g.priority === priorityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === "priority") return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (sortBy === "name") return a.name.localeCompare(b.name, "ar");
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [goals, statusTab, priorityFilter, search, sortBy]);

  const upcoming = useMemo(
    () =>
      (goals ?? [])
        .filter((g) => g.deadline && g.status !== "Completed")
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 4),
    [goals],
  );

  const deadlineDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of goals ?? []) {
      if (!g.deadline) continue;
      const key = new Date(g.deadline).toDateString();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [goals]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
          <Inbox size={18} strokeWidth={2.25} />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight text-ink">المهام المسندة لي</h2>
          <p className="text-xs text-ink-soft">المهام والمشاريع المسندة إليك</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">{error}</p>}

      {goals === null && !error && (
        <div className="flex justify-center py-16 text-ink-soft/50">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {goals !== null && goals.length === 0 && (
        <div className="terrace-card border border-line bg-basin-2/40 py-16 text-center">
          <Inbox className="mx-auto mb-3 text-ink-soft/40" size={44} />
          <p className="text-sm text-ink-soft">ما فيه مهام مسندة لك حاليًا.</p>
        </div>
      )}

      {goals !== null && goals.length > 0 && (
        <>
          {/* stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="terrace-card flex items-center gap-3 border border-line bg-card p-4">
              <ProgressRing value={overallProgress} />
              <div className="min-w-0">
                <p className="font-mono-num text-lg font-semibold text-ink">{overallProgress}%</p>
                <p className="text-[11px] text-ink-soft">التقدم العام</p>
              </div>
            </div>
            <StatTile
              icon={CheckSquare}
              value={total}
              label="إجمالي المهام"
              sub={`${completed} مكتملة`}
              tint="text-terrace-600 bg-terrace-500/12"
            />
            <StatTile
              icon={Clock}
              value={inProgress}
              label="قيد التنفيذ"
              sub={dueToday > 0 ? `${dueToday} مهام مستحقة اليوم` : "لا مهام مستحقة اليوم"}
              tint="text-indigo-600 bg-indigo-500/12"
            />
            <StatTile
              icon={Lock}
              value={waiting}
              label="في الانتظار"
              sub="بانتظار مرحلة سابقة"
              tint="text-gold-600 bg-gold-500/12"
            />
            <StatTile
              icon={CheckCircle2}
              value={completed}
              label="مكتملة"
              sub={`${completedThisWeek} هذا الأسبوع`}
              tint="text-green-600 bg-green-500/12"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            {/* main column */}
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-line bg-card px-2.5 py-1.5">
                  <Select
                    value={priorityFilter}
                    onChange={(v) => setPriorityFilter(v as "all" | Priority)}
                    className="min-w-[7rem]"
                    options={[
                      { value: "all", label: "كل الأولويات" },
                      { value: "High", label: PRIORITY_LABEL.High },
                      { value: "Medium", label: PRIORITY_LABEL.Medium },
                      { value: "Low", label: PRIORITY_LABEL.Low },
                    ]}
                  />
                </div>
                <div className="rounded-lg border border-line bg-card px-2.5 py-1.5">
                  <Select
                    value={sortBy}
                    onChange={(v) => setSortBy(v as typeof sortBy)}
                    className="min-w-[8rem]"
                    options={[
                      { value: "deadline", label: "ترتيب: الموعد" },
                      { value: "priority", label: "ترتيب: الأولوية" },
                      { value: "name", label: "ترتيب: الاسم" },
                    ]}
                  />
                </div>
                <div className="relative min-w-[12rem] flex-1">
                  <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث عن مهمة..."
                    className="w-full rounded-lg border border-line bg-card py-2 ps-9 pe-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500"
                  />
                </div>
                <div className="flex flex-wrap rounded-lg border border-line bg-card p-1">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "in_progress", label: "قيد التنفيذ" },
                    { id: "waiting", label: "في الانتظار" },
                    { id: "completed", label: "مكتملة" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusTab(tab.id as typeof statusTab)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                        statusTab === tab.id ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-terrace-500/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="py-16 text-center text-sm text-ink-soft">ما فيه مهام تطابق البحث/الفلتر.</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((g) => (
                    <TaskRow key={g.id} goal={g} onOpen={() => setDetailGoal(g)} />
                  ))}
                </div>
              )}
            </div>

            {/* sidebar: calendar + upcoming */}
            <div className="space-y-4">
              <MiniCalendar month={calendarMonth} onChangeMonth={setCalendarMonth} deadlineDays={deadlineDays} />

              <div className="terrace-card border border-line bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">المواعيد القادمة</h3>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-ink-soft">ما فيه مواعيد قادمة.</p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setDetailGoal(g)}
                        className="flex w-full items-start gap-2.5 text-start"
                      >
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color || priorityColor(g.priority) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-terrace-600">{relativeDayLabel(g.deadline!)}</p>
                          <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                          {g.projectName && <p className="truncate text-[11px] text-ink-soft">{g.projectName}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={onGotoDeadlines}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/5"
                >
                  <CalendarIcon size={13} />
                  عرض جميع المواعيد
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {detailGoal && (
        <TaskDetailDrawer
          goal={detailGoal}
          busy={busyId === detailGoal.id}
          onClose={() => setDetailGoal(null)}
          onChangeStatus={(s) => changeStatus(detailGoal, s)}
          onToggleItem={(itemId, done) => toggleItem(detailGoal, itemId, done)}
          onMoveToStage={(stageId) => moveToStage(detailGoal, stageId)}
        />
      )}
    </div>
  );
}

function ProgressRing({ value, size = 44, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        stroke="var(--color-terrace-600)"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  sub,
  tint,
}: {
  icon: typeof CheckSquare;
  value: number;
  label: string;
  sub: string;
  tint: string;
}) {
  return (
    <div className="terrace-card flex items-start justify-between gap-2 border border-line bg-card p-4">
      <div className="min-w-0">
        <p className="font-mono-num text-xl font-semibold text-ink">{value}</p>
        <p className="text-[11px] text-ink-soft">{label}</p>
        <p className="mt-1 truncate text-[10px] text-ink-soft/70">{sub}</p>
      </div>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
        <Icon size={15} />
      </div>
    </div>
  );
}

const WEEKDAYS_AR = ["س", "ح", "ن", "ث", "ر", "خ", "ج"]; // Sat → Fri

function MiniCalendar({
  month,
  onChangeMonth,
  deadlineDays,
}: {
  month: Date;
  onChangeMonth: (d: Date) => void;
  deadlineDays: Map<string, number>;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstOfMonth = new Date(year, m, 1);
  // JS getDay(): 0=Sun..6=Sat. We want week to start Saturday → shift so Sat=0.
  const startOffset = (firstOfMonth.getDay() + 1) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1))];

  return (
    <div className="terrace-card border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onChangeMonth(new Date(year, m - 1, 1))}
          className="rounded-md p-1 text-ink-soft transition-colors duration-150 hover:bg-ink/5"
        >
          <ChevronRight size={15} />
        </button>
        <span className="text-sm font-semibold text-ink">
          {month.toLocaleDateString("ar", { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={() => onChangeMonth(new Date(year, m + 1, 1))}
          className="rounded-md p-1 text-ink-soft transition-colors duration-150 hover:bg-ink/5"
        >
          <ChevronLeft size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_AR.map((d, i) => (
          <span key={i} className="text-[10px] font-semibold text-ink-soft/70">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const isToday = isSameDay(d, today);
          const count = deadlineDays.get(d.toDateString()) ?? 0;
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono-num text-[11px] ${
                  isToday ? "bg-terrace-600 font-semibold text-white" : "text-ink"
                }`}
              >
                {d.getDate()}
              </span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${count > 0 ? "bg-gold-500" : "bg-transparent"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact list row matching the reference: priority + date on the start
 *  side, title/description/assignee in the middle, avatar + progress on
 *  the end side. */
function TaskRow({ goal, onOpen }: { goal: AssignedGoal; onOpen: () => void }) {
  const isOverdue =
    goal.status !== "Completed" && !!goal.deadline && new Date(goal.deadline).getTime() < new Date().setHours(0, 0, 0, 0);

  return (
    <button
      onClick={onOpen}
      className="terrace-card flex w-full items-center gap-3 border border-line bg-card p-3 text-start shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: goal.color || priorityColor(goal.priority) }}
    >
      <div className="hidden w-20 shrink-0 flex-col gap-1 sm:flex">
        <span
          className="w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: priorityColor(goal.priority) + "1f", color: priorityColor(goal.priority) }}
        >
          {PRIORITY_LABEL[goal.priority]}
        </span>
        {goal.deadline && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? "font-semibold text-red-600" : "text-ink-soft"}`}>
            <CalendarClock size={10} />
            {new Date(goal.deadline).toLocaleDateString("en-CA")}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {goal.projectName && (
            <span className="hidden shrink-0 rounded-full bg-basin-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft sm:inline-block">
              {goal.projectName}
            </span>
          )}
          {goal.locked && <Lock size={11} className="shrink-0 text-ink-soft" />}
        </div>
        <p className={`truncate font-medium text-ink ${goal.status === "Completed" ? "text-ink-soft line-through" : ""}`}>
          {goal.name}
        </p>
        {goal.requirements && <p className="truncate text-xs text-ink-soft">{goal.requirements}</p>}
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft">
          <User size={10} /> مسند من: {goal.ownerName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: goal.color || priorityColor(goal.priority) }}
        >
          {goal.ownerName.trim().charAt(0).toUpperCase() || "?"}
        </div>
        {goal.status === "Completed" ? (
          <CheckCircle2 size={20} className="text-green-600" />
        ) : (
          <ProgressRing value={goal.progress} size={32} stroke={3} />
        )}
      </div>
    </button>
  );
}

/** Side drawer with the full picture: requirements, notes, and checklist —
 *  everything the list view deliberately hides to stay uncluttered. */
function TaskDetailDrawer({
  goal,
  busy,
  onClose,
  onChangeStatus,
  onToggleItem,
  onMoveToStage,
}: {
  goal: AssignedGoal;
  busy: boolean;
  onClose: () => void;
  onChangeStatus: (status: AssignedGoal["status"]) => void;
  onToggleItem: (itemId: string, done: boolean) => void;
  onMoveToStage: (stageId: string) => void;
}) {
  const { closing, requestClose } = useClosing(onClose);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px] ${closing ? "" : "animate-fade-in"}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`terrace-card flex h-full w-full max-w-md flex-col overflow-hidden !rounded-none bg-card shadow-2xl ${closing ? "animate-panel-out" : "animate-panel-in"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-basin-2/50 px-5 py-4">
          <h2 className="font-display text-lg font-semibold leading-tight text-ink">{goal.name}</h2>
          <button onClick={requestClose} className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-terrace-500/10 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Breadcrumb goal={goal} />

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <User size={12} /> {goal.ownerName}
            </span>
            {goal.deadline && <span>· {new Date(goal.deadline).toLocaleDateString()}</span>}
          </div>

          {goal.locked && (
            <p className="flex items-center gap-1.5 rounded-lg bg-basin-2/60 px-2.5 py-1.5 text-xs text-ink-soft">
              <Lock size={12} />
              هذي المرحلة مقفلة إلى أن تكتمل المرحلة السابقة
            </p>
          )}

          <Select
            value={goal.status}
            disabled={busy || goal.locked}
            onChange={(v) => onChangeStatus(v as AssignedGoal["status"])}
            fullWidth
            className="w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-ink"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />

          {goal.availableStages.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-soft">نقل إلى مرحلة أخرى</p>
              <Select
                value={goal.stageId ?? ""}
                disabled={busy || goal.locked}
                onChange={(v) => v && onMoveToStage(v)}
                fullWidth
                className="w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-ink"
                options={goal.availableStages.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          )}

          {goal.requirements && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-soft">المتطلبات</p>
              <p className="whitespace-pre-line text-sm text-ink">{goal.requirements}</p>
            </div>
          )}

          {goal.notes && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-soft">
                <StickyNote size={12} /> ملاحظات
              </p>
              <p className="whitespace-pre-line text-sm text-ink">{goal.notes}</p>
            </div>
          )}

          {goal.checklist.length > 0 && (
            <div className="space-y-1 border-t border-line pt-3">
              <p className="mb-1 text-xs font-semibold text-ink-soft">قائمة المهام الفرعية</p>
              {goal.checklist.map((item) => (
                <button
                  key={item.id}
                  disabled={busy || goal.locked}
                  onClick={() => onToggleItem(item.id, !item.done)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start text-sm transition-colors hover:bg-terrace-500/10 disabled:opacity-60"
                >
                  {item.done ? (
                    <CheckSquare size={16} className="shrink-0 text-terrace-600" />
                  ) : (
                    <Square size={16} className="shrink-0 text-ink-soft/40" />
                  )}
                  <span className={item.done ? "text-ink-soft line-through" : "text-ink"}>{item.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
