import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Trash2,
  Search,
  LayoutGrid,
  List as ListIcon,
  FolderDot,
  ChevronLeft,
  ChevronRight,
  Eye,
  CalendarClock,
} from "lucide-react";
import { useStore } from "../store";
import { priorityColor } from "../lib/goals";
import { Select } from "./ui";
import { MemberAvatar } from "./TeamPanel";
import TaskDetailPanel from "./TaskDetailPanel";
import type { Goal, Status } from "../types";

const STATUS_LABEL: Record<Status, string> = {
  "Not Started": "لم يبدأ",
  "In Progress": "قيد التنفيذ",
  Completed: "مكتمل",
};

const PAGE_SIZE = 8;

export default function ArchivePage() {
  const { goals, projects, members, archiveGoal, deleteGoal } = useStore();
  const archived = useMemo(
    () =>
      goals
        .filter((g) => g.archived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [goals],
  );

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);

  const projectName = (id?: string | null) => projects.find((p) => p.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    return archived.filter((g) => {
      if (projectFilter !== "all" && g.projectId !== projectFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (search.trim() && !g.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [archived, projectFilter, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const projectOptions = [
    { value: "all", label: "كل المشاريع" },
    { value: "", label: "بدون مشروع" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terrace-500/12 text-terrace-600">
          <Archive size={18} strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">الأرشيف</h1>
          <p className="text-xs text-ink-soft">الأهداف التي أُنجزت أو أُرشفت من خارطة الطريق</p>
        </div>
      </div>

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-24 text-center">
          <div className="terrace-card mb-4 flex h-16 w-16 items-center justify-center bg-gradient-to-br from-terrace-600 to-terrace-800 text-terrace-50 shadow-lg">
            <Archive size={28} />
          </div>
          <h2 className="font-display text-2xl text-ink">الأرشيف فاضي</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-soft">
            الأهداف اللي تؤرشفها من خارطة الطريق أو الشجرة تظهر هنا.
          </p>
        </div>
      ) : (
        <>
          {/* toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="ابحث في الأرشيف..."
                className="w-full rounded-lg border border-line bg-card py-2 ps-9 pe-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500"
              />
            </div>
            <div className="rounded-lg border border-line bg-card px-2.5 py-1.5">
              <Select
                value={projectFilter}
                onChange={(v) => {
                  setProjectFilter(v);
                  setPage(1);
                }}
                className="min-w-[9rem]"
                options={projectOptions}
              />
            </div>
            <div className="rounded-lg border border-line bg-card px-2.5 py-1.5">
              <Select
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                className="min-w-[8rem]"
                options={[
                  { value: "all", label: "كل الحالات" },
                  { value: "Not Started", label: STATUS_LABEL["Not Started"] },
                  { value: "In Progress", label: STATUS_LABEL["In Progress"] },
                  { value: "Completed", label: STATUS_LABEL.Completed },
                ]}
              />
            </div>
            <div className="ms-auto flex rounded-lg border border-line bg-card p-1">
              <button
                onClick={() => setLayout("list")}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${layout === "list" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-terrace-500/10"}`}
              >
                <ListIcon size={14} />
              </button>
              <button
                onClick={() => setLayout("grid")}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${layout === "grid" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-terrace-500/10"}`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-soft">ما فيه أهداف مؤرشفة تطابق البحث/الفلتر.</p>
          ) : layout === "list" ? (
            <div className="overflow-hidden rounded-xl border border-line bg-card">
              <div className="hidden grid-cols-[1fr_10rem_9rem_9rem_11rem] gap-3 border-b border-line bg-basin-2/50 px-4 py-2.5 text-[11px] font-semibold text-ink-soft sm:grid">
                <span>الهدف</span>
                <span>الحالة</span>
                <span>آخر تحديث</span>
                <span>المسؤول</span>
                <span>الإجراءات</span>
              </div>
              {pageItems.map((g) => (
                <ArchiveRow
                  key={g.id}
                  goal={g}
                  projectLabel={projectName(g.projectId)}
                  memberFor={(name) => members.find((m) => m.name === name)}
                  onView={() => setViewingGoal(g)}
                  onRestore={() => archiveGoal(g.id, false)}
                  onDelete={() => confirm(`حذف "${g.name}" نهائيًا؟`) && deleteGoal(g.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {pageItems.map((g) => (
                <ArchiveCard
                  key={g.id}
                  goal={g}
                  projectLabel={projectName(g.projectId)}
                  memberFor={(name) => members.find((m) => m.name === name)}
                  onView={() => setViewingGoal(g)}
                  onRestore={() => archiveGoal(g.id, false)}
                  onDelete={() => confirm(`حذف "${g.name}" نهائيًا؟`) && deleteGoal(g.id)}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors duration-150 hover:bg-ink/5 disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-terrace-600 px-2 font-mono-num text-sm font-semibold text-white">
                {pageSafe}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={pageSafe >= pageCount}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors duration-150 hover:bg-ink/5 disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs text-ink-soft">
                عرض {pageItems.length} من {filtered.length} هدف مؤرشف
              </span>
            </div>
          )}
        </>
      )}

      {viewingGoal && <TaskDetailPanel goal={viewingGoal} onClose={() => setViewingGoal(null)} />}
    </div>
  );
}

function StatusRing({ progress, color }: { progress: number; color: string }) {
  const size = 40;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, progress)) / 100) * c;
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono-num text-[10px] font-semibold text-ink">{progress}%</span>
    </div>
  );
}

interface RowProps {
  goal: Goal;
  projectLabel: string;
  memberFor: (name: string) => { name: string; avatar: string; color: string } | undefined;
  onView: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function ArchiveRow({ goal, projectLabel, memberFor, onView, onRestore, onDelete }: RowProps) {
  const member = goal.assignedTo ? memberFor(goal.assignedTo) : undefined;
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_10rem_9rem_9rem_11rem] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: (goal.color || "#1F6E5C") + "1f" }}
        >
          <FolderDot size={16} style={{ color: goal.color || "#1F6E5C" }} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{goal.name}</p>
          <div className="flex items-center gap-1.5">
            {projectLabel && <span className="truncate text-xs text-ink-soft">{projectLabel}</span>}
            {goal.tag && (
              <span className="shrink-0 rounded-full bg-basin-2 px-1.5 py-0.5 text-[10px] text-ink-soft">{goal.tag}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusRing progress={goal.progress} color={goal.color || priorityColor(goal.priority)} />
        <span className="text-xs text-ink-soft sm:hidden">{STATUS_LABEL[goal.status]}</span>
        <span className="hidden text-xs text-ink-soft sm:inline">{STATUS_LABEL[goal.status]}</span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
        <CalendarClock size={12} />
        {new Date(goal.updatedAt).toLocaleDateString("en-CA")}
      </span>
      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
        {goal.assignedTo ? (
          <>
            {member ? <MemberAvatar member={member} size={22} /> : <span className="h-[22px] w-[22px] rounded-full bg-basin-2" />}
            <span className="truncate">{goal.assignedTo}</span>
          </>
        ) : (
          <span className="text-ink-soft/60">—</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
        >
          <Eye size={13} /> عرض
        </button>
        <button
          onClick={onRestore}
          title="استرجاع"
          className="rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
        >
          <ArchiveRestore size={15} />
        </button>
        <button
          onClick={onDelete}
          title="حذف نهائي"
          className="rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function ArchiveCard({ goal, projectLabel, memberFor, onView, onRestore, onDelete }: RowProps) {
  const member = goal.assignedTo ? memberFor(goal.assignedTo) : undefined;
  return (
    <div
      className="terrace-card flex flex-col border border-line bg-card p-4 shadow-sm"
      style={{ borderTopWidth: 3, borderTopColor: goal.color || "var(--color-terrace-500)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: (goal.color || "#1F6E5C") + "1f" }}
        >
          <FolderDot size={18} style={{ color: goal.color || "#1F6E5C" }} />
        </div>
        <StatusRing progress={goal.progress} color={goal.color || priorityColor(goal.priority)} />
      </div>
      <h3 className="mt-3 truncate font-display text-base font-semibold text-ink">{goal.name}</h3>
      <div className="mt-1 flex items-center gap-1.5">
        {projectLabel && <span className="truncate text-xs text-ink-soft">{projectLabel}</span>}
        {goal.tag && <span className="shrink-0 rounded-full bg-basin-2 px-1.5 py-0.5 text-[10px] text-ink-soft">{goal.tag}</span>}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{STATUS_LABEL[goal.status]}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <CalendarClock size={12} />
          {new Date(goal.updatedAt).toLocaleDateString("en-CA")}
        </span>
        {goal.assignedTo && member && <MemberAvatar member={member} size={22} />}
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-3">
        <button
          onClick={onView}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
        >
          <Eye size={13} /> عرض
        </button>
        <button
          onClick={onRestore}
          title="استرجاع"
          className="rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
        >
          <ArchiveRestore size={15} />
        </button>
        <button
          onClick={onDelete}
          title="حذف نهائي"
          className="rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
