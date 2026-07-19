import { useMemo } from "react";
import { CheckCircle2, Clock, AlertTriangle, Target, Flame } from "lucide-react";
import { useStore } from "../store";
import { deadlineState, priorityColor } from "../lib/goals";
import { t } from "../lib/i18n";

export default function Dashboard({
  roadmapOwnerId = null,
  currentProjectId = "all",
}: {
  roadmapOwnerId?: string | null;
  currentProjectId?: string;
}) {
  const { goals, effProgress, lang } = useStore();
  const active = useMemo(
    () =>
      goals.filter((g) => {
        if (g.archived || (g.roadmapOwnerId ?? null) !== roadmapOwnerId) return false;
        if (currentProjectId === "all") return true;
        if (currentProjectId === "general") return (g.projectId ?? null) === null;
        return g.projectId === currentProjectId;
      }),
    [goals, roadmapOwnerId, currentProjectId],
  );

  const stats = useMemo(() => {
    let completed = 0,
      inProgress = 0,
      notStarted = 0,
      overdue = 0;
    let high = 0,
      med = 0,
      low = 0;
    for (const g of active) {
      const p = effProgress(g);
      if (p >= 100 || g.status === "Completed") completed++;
      else if (p > 0 || g.status === "In Progress") inProgress++;
      else notStarted++;
      if (deadlineState(g.deadline, g.status) === "overdue") overdue++;
      if (g.priority === "High") high++;
      else if (g.priority === "Medium") med++;
      else low++;
    }
    const total = active.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, overdue, pct, high, med, low };
  }, [active, effProgress]);

  const cards: {
    labelKey: keyof typeof import("../lib/i18n").translations.en;
    value: number;
    icon: typeof Target;
    color: string;
    bg: string;
  }[] = [
    { labelKey: "totalGoals", value: stats.total, icon: Target, color: "text-terrace-600", bg: "bg-terrace-50" },
    { labelKey: "completedLabel", value: stats.completed, icon: CheckCircle2, color: "text-terrace-600", bg: "bg-terrace-50" },
    { labelKey: "inProgressLabel", value: stats.inProgress, icon: Clock, color: "text-gold-600", bg: "bg-gold-50" },
    { labelKey: "overdueGoals", value: stats.overdue, icon: AlertTriangle, color: "text-clay", bg: "bg-clay/10" },
  ];

  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segs = [
    { v: stats.completed, color: "#22c55e", key: "completedLabel" as const },
    { v: stats.inProgress, color: "#f59e0b", key: "inProgressLabel" as const },
    { v: stats.notStarted, color: "#cbd5e1", key: "notStarted" as const },
  ];
  let acc = 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.labelKey} className={`terrace-card border border-line p-5 ${card.bg}`}>
            <div className="flex items-center justify-between">
              <card.icon className={card.color} size={26} />
              <span className="font-mono-num text-3xl font-semibold text-ink">{card.value}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-ink-soft">{t(lang, card.labelKey)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="terrace-card border border-line bg-card p-6">
          <h3 className="mb-4 font-display text-xl text-ink">{t(lang, "completionOverview")}</h3>
          {stats.total === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">{t(lang, "noGoalsToSummarize")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <div className="relative">
                <svg width={size} height={size} className="-rotate-90">
                  {segs.map((s, i) => {
                    if (s.v === 0) return null;
                    const frac = s.v / stats.total;
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
                  <span className="font-mono-num text-3xl font-semibold text-ink">{stats.pct}%</span>
                  <span className="text-xs text-ink-soft">{t(lang, "complete")}</span>
                </div>
              </div>
              <div className="space-y-2">
                {segs.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-ink-soft">{t(lang, s.key)}</span>
                    <span className="font-mono-num font-semibold text-ink">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="terrace-card border border-line bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-display text-xl text-ink">
            <Flame size={18} className="text-gold-600" /> {t(lang, "priorityBreakdown")}
          </h3>
          {([
            { key: "high" as const, value: stats.high, p: "High" as const },
            { key: "medium" as const, value: stats.med, p: "Medium" as const },
            { key: "low" as const, value: stats.low, p: "Low" as const },
          ]).map((row) => {
            const max = Math.max(stats.high, stats.med, stats.low, 1);
            return (
              <div key={row.key} className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-soft">{t(lang, row.key)}</span>
                  <span className="font-mono-num font-semibold text-ink">{row.value}</span>
                </div>
                <div className="water-channel h-2.5 rounded-full">
                  <div
                    className="water-fill rounded-full"
                    style={{ width: `${(row.value / max) * 100}%`, background: priorityColor(row.p) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
