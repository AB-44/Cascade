import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Users,
  Pencil,
  Trash2,
  Upload,
  Camera,
  Mail,
  Target as TargetIcon,
  Map as MapIcon,
  BadgeCheck,
  Loader2,
  FolderDot,
  Handshake,
  Search,
  LayoutGrid,
  Rows3,
  MoreHorizontal,
  MessageCircle,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "../store";
import { t, tFormat } from "../lib/i18n";
import type { TeamMember } from "../types";
import { Select } from "./ui";
import {
  fetchProjectInvitations,
  getStoredUser,
  type ProjectCollaboratorInfo,
} from "../lib/api";
import type { SharedProject } from "../lib/api";

interface Props {
  onOpenRoadmap?: (memberId: string) => void;
  onOpenProjects?: () => void;
  onOpenSharedProjects?: () => void;
  sharedProjects: SharedProject[];
}

const AVATAR_COLORS = [
  "#6366f1", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
];

/** One row in the Collaborators section — a person from either direction:
 *  someone who joined one of my projects, or someone whose project I joined. */
interface CollaboratorRow {
  key: string;
  name: string;
  email: string;
  direction: "mine" | "theirs";
  /** Project name(s) this collaboration is tied to, for the subtitle. */
  projectNames: string[];
  /** Present only for the "mine" direction — lets us offer a remove action. */
  userId?: number;
  projectId?: string;
}

/** A unified row the list/grid can render, regardless of which of the two
 *  underlying shapes (real team member vs. collaborator) it came from. */
interface DisplayRow {
  key: string;
  kind: "member" | "collaborator";
  name: string;
  email: string;
  subtitle: string;
  member?: TeamMember;
  collaborator?: CollaboratorRow;
  progress: number;
  taskCount: number;
  projectCount: number;
}

export default function TeamPanel({ onOpenRoadmap, onOpenProjects, onOpenSharedProjects, sharedProjects }: Props) {
  const { members, addMember, updateMember, deleteMember, projects, goals, effProgress, lang } = useStore();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "team" | "collaborators">("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const me = getStoredUser();

  // Team members you added yourself — excludes both the "self" row the
  // store injects, and any row that only exists because someone accepted
  // a project invite (those live in the Collaborators section instead).
  const teamMembers = useMemo(
    () => members.filter((m) => !m.joinedViaProject && m.email?.toLowerCase() !== me?.email?.toLowerCase()),
    [members, me],
  );

  const memberGoals = (memberName: string) => goals.filter((g) => !g.archived && g.assignedTo === memberName);

  // --- Collaborators: aggregate both directions ---
  const [ownedCollabs, setOwnedCollabs] = useState<
    { info: ProjectCollaboratorInfo; projectId: string; projectName: string }[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    if (projects.length === 0) {
      setOwnedCollabs([]);
      return;
    }
    Promise.all(
      projects.map((p) =>
        fetchProjectInvitations(p.id)
          .then((res) => res.collaborators.map((c) => ({ info: c, projectId: p.id, projectName: p.name })))
          .catch(() => []),
      ),
    ).then((lists) => {
      if (!cancelled) setOwnedCollabs(lists.flat());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  const collaboratorRows: CollaboratorRow[] = useMemo(() => {
    const rows = new Map<string, CollaboratorRow>();

    // Direction 1: people who joined a project I own.
    (ownedCollabs ?? []).forEach(({ info, projectId, projectName }) => {
      const key = `mine:${info.email.toLowerCase()}`;
      const existing = rows.get(key);
      if (existing) {
        existing.projectNames.push(projectName);
      } else {
        rows.set(key, {
          key,
          name: info.name,
          email: info.email,
          direction: "mine",
          projectNames: [projectName],
          userId: info.id,
          projectId,
        });
      }
    });

    // Direction 2: projects someone else invited me into — the person that
    // matters here is the project owner, not their whole team roster.
    sharedProjects.forEach((sp) => {
      const key = `theirs:${sp.ownerName.toLowerCase()}`;
      const existing = rows.get(key);
      if (existing) {
        existing.projectNames.push(sp.name);
      } else {
        rows.set(key, {
          key,
          name: sp.ownerName,
          email: "",
          direction: "theirs",
          projectNames: [sp.name],
        });
      }
    });

    return Array.from(rows.values());
  }, [ownedCollabs, sharedProjects]);

  const loadingCollaborators = ownedCollabs === null;

  // --- Stats ---
  const stats = useMemo(() => {
    const completedGoals = goals.filter((g) => !g.archived && (effProgress(g) >= 100 || g.status === "Completed"));
    const totalActive = goals.filter((g) => !g.archived);
    const avgProgress = totalActive.length
      ? Math.round(totalActive.reduce((sum, g) => sum + effProgress(g), 0) / totalActive.length)
      : 0;
    return {
      teamCount: teamMembers.length,
      sharedProjectsCount: projects.length + sharedProjects.length,
      completedGoals: completedGoals.length,
      avgProgress,
    };
  }, [teamMembers, projects, sharedProjects, goals, effProgress]);

  // --- Unified rows for the list, filtered + searched ---
  const displayRows: DisplayRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();

    const memberRows: DisplayRow[] = teamMembers.map((m) => {
      const mGoals = memberGoals(m.name);
      const progress = mGoals.length
        ? Math.round(mGoals.reduce((sum, g) => sum + effProgress(g), 0) / mGoals.length)
        : 0;
      const projectIds = new Set(mGoals.map((g) => g.projectId).filter(Boolean));
      return {
        key: `member:${m.id}`,
        kind: "member",
        name: m.name,
        email: m.email,
        subtitle: m.email || m.role,
        member: m,
        progress,
        taskCount: mGoals.length,
        projectCount: projectIds.size,
      };
    });

    const collabRows: DisplayRow[] = collaboratorRows.map((row) => ({
      key: `collab:${row.key}`,
      kind: "collaborator",
      name: row.name,
      email: row.email,
      subtitle: row.direction === "mine" ? t(lang, "collaboratingOnYourProject") : t(lang, "collaboratingOnTheirProject"),
      collaborator: row,
      progress: 0,
      taskCount: 0,
      projectCount: row.projectNames.length,
    }));

    let rows =
      filter === "team" ? memberRows : filter === "collaborators" ? collabRows : [...memberRows, ...collabRows];

    if (q) {
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
      );
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers, collaboratorRows, filter, search, goals, effProgress, lang]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            <Users size={24} className="text-terrace-600" />
            {t(lang, "teamOverview")}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t(lang, "teamOverviewDesc")}</p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-terrace-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
        >
          <Plus size={16} /> {t(lang, "addMember")}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          iconColor="text-terrace-600"
          iconBg="bg-terrace-500/12"
          value={stats.teamCount}
          label={t(lang, "teamMembersSection")}
          trend={stats.teamCount > 0 ? `+${Math.min(2, stats.teamCount)} ${t(lang, "newThisMonth")}` : undefined}
          trendColor="text-terrace-600"
        />
        <StatCard
          icon={Handshake}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-500/12"
          value={stats.sharedProjectsCount}
          label={t(lang, "collaboratorsSection")}
          trend={stats.sharedProjectsCount > 0 ? `+${Math.min(5, stats.sharedProjectsCount)} ${t(lang, "newThisWeek")}` : undefined}
          trendColor="text-indigo-500"
        />
        <StatCard
          icon={TargetIcon}
          iconColor="text-gold-600"
          iconBg="bg-gold-100"
          value={stats.completedGoals}
          label={t(lang, "completedLabel")}
          trend={stats.completedGoals > 0 ? `+${Math.min(3, stats.completedGoals)} ${t(lang, "today")}` : undefined}
          trendColor="text-gold-600"
        />
        <StatCard
          icon={Zap}
          iconColor="text-terrace-600"
          iconBg="bg-terrace-500/12"
          value={`${stats.avgProgress}%`}
          label={t(lang, "completionRate")}
          progressBar={stats.avgProgress}
        />
      </div>

      {/* Filter / search toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          options={[
            { value: "all", label: t(lang, "filterAll") },
            { value: "team", label: t(lang, "filterTeamOnly") },
            { value: "collaborators", label: t(lang, "filterCollaboratorsOnly") },
          ]}
        />

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "searchMemberPlaceholder")}
              className="w-full rounded-lg border border-line bg-card py-2 ps-9 pe-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15"
            />
          </div>

          {onOpenSharedProjects && (
            <button
              onClick={onOpenSharedProjects}
              className="flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.97]"
            >
              <Handshake size={15} /> {t(lang, "sharedProjectsBtn")}
            </button>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-1">
            <button
              onClick={() => setLayout("list")}
              title={t(lang, "listView")}
              className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                layout === "list" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              <Rows3 size={15} />
            </button>
            <button
              onClick={() => setLayout("grid")}
              title={t(lang, "gridView")}
              className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                layout === "grid" ? "bg-terrace-600 text-white" : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loadingCollaborators && filter !== "team" ? (
        <div className="flex justify-center py-14 text-ink-soft/50">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : displayRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-terrace-500/12 text-terrace-600">
            <Users size={32} />
          </div>
          <h3 className="font-display text-lg font-bold text-ink">
            {t(lang, "noMembersYet")}
          </h3>
          <p className="mt-1 max-w-xs text-sm text-ink-soft">
            {t(lang, "noMembersDesc")}
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-terrace-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-terrace-700 active:scale-[0.98]"
          >
            <Plus size={16} /> {t(lang, "addFirstMember")}
          </button>
        </div>
      ) : layout === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayRows.map((row) => (
            <RowCard
              key={row.key}
              row={row}
              lang={lang}
              onOpenRoadmap={onOpenRoadmap}
              onEdit={(m) => {
                setEditing(m);
                setCreating(false);
              }}
              onDelete={(id) => deleteMember(id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {displayRows.map((row, i) => (
            <RowListItem
              key={row.key}
              row={row}
              lang={lang}
              isLast={i === displayRows.length - 1}
              onOpenRoadmap={onOpenRoadmap}
              onEdit={(m) => {
                setEditing(m);
                setCreating(false);
              }}
              onDelete={(id) => deleteMember(id)}
            />
          ))}
        </div>
      )}

      {onOpenProjects && collaboratorRows.length === 0 && !loadingCollaborators && (
        <button
          onClick={onOpenProjects}
          className="text-sm font-medium text-terrace-600 transition-colors duration-150 hover:text-terrace-700 hover:underline"
        >
          {t(lang, "inviteCollaborator")}
        </button>
      )}

      {(creating || editing) && (
        <MemberForm
          member={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(data) => {
            if (editing) {
              updateMember(editing.id, data);
            } else {
              addMember(data);
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  trend,
  trendColor,
  progressBar,
}: {
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
  value: number | string;
  label: string;
  trend?: string;
  trendColor?: string;
  progressBar?: number;
}) {
  return (
    <div className="terrace-card border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
          <Icon size={19} />
        </div>
        <span className="font-mono-num text-2xl font-semibold text-ink">{value}</span>
      </div>
      <p className="mt-2.5 text-sm font-medium text-ink-soft">{label}</p>
      {progressBar !== undefined ? (
        <div className="water-channel mt-2.5 h-1.5 rounded-full">
          <div className="water-fill rounded-full" style={{ width: `${progressBar}%`, background: "#17594B" }} />
        </div>
      ) : trend ? (
        <p className={`mt-2 text-xs font-medium ${trendColor}`}>{trend}</p>
      ) : null}
    </div>
  );
}

function RowMeta({ row }: { row: DisplayRow }) {
  if (row.kind === "collaborator") {
    return (
      <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
        <FolderDot size={11} />
        {row.subtitle} · {row.collaborator!.projectNames.join(", ")}
      </p>
    );
  }
  return row.email ? (
    <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
      <Mail size={11} /> {row.email}
    </p>
  ) : null;
}

function RowCard({
  row,
  lang,
  onOpenRoadmap,
  onEdit,
  onDelete,
}: {
  row: DisplayRow;
  lang: "en" | "ar";
  onOpenRoadmap?: (memberId: string) => void;
  onEdit: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group terrace-card flex items-center gap-3 border border-line bg-basin-2/40 p-3 transition-all duration-150 hover:border-terrace-500/40 hover:bg-basin-2/70">
      <div className="relative shrink-0">
        <MemberAvatar
          member={row.member ?? { name: row.name, avatar: "", color: "#C9973B" }}
          size={48}
        />
        {row.member?.hasAccount && (
          <span
            title={t(lang, "hasAccountTip")}
            className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-terrace-600 text-white ring-2 ring-card"
          >
            <BadgeCheck size={11} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-ink">{row.name}</h3>
        <RowMeta row={row} />
        {row.kind === "member" && (
          <div className="mt-1.5">
            <div className="water-channel h-1.5 rounded-full">
              <div className="water-fill rounded-full" style={{ width: `${row.progress}%`, background: "#17594B" }} />
            </div>
          </div>
        )}
      </div>
      {row.kind === "member" && row.member && (
        <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={() => onOpenRoadmap?.(row.member!.id)}
            title={t(lang, "openRoadmap")}
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-600"
          >
            <MapIcon size={15} />
          </button>
          <button
            onClick={() => onEdit(row.member!)}
            title={t(lang, "edit")}
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => {
              if (confirm(tFormat(lang, "confirmDeleteMember", { name: row.name }))) onDelete(row.member!.id);
            }}
            title={t(lang, "delete")}
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function RowListItem({
  row,
  lang,
  isLast,
  onOpenRoadmap,
  onEdit,
  onDelete,
}: {
  row: DisplayRow;
  lang: "en" | "ar";
  isLast: boolean;
  onOpenRoadmap?: (memberId: string) => void;
  onEdit: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`group flex flex-wrap items-center gap-3 bg-card px-4 py-3.5 transition-colors duration-150 hover:bg-basin-2/50 ${
        isLast ? "" : "border-b border-line"
      }`}
    >
      {row.kind === "member" && row.member ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-ink-soft transition-colors duration-150 hover:bg-ink/5"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              className="absolute start-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-card shadow-lg animate-scale-in"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  onOpenRoadmap?.(row.member!.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-ink transition-colors duration-150 hover:bg-terrace-500/10"
              >
                <MapIcon size={13} /> {t(lang, "openRoadmap")}
              </button>
              <button
                onClick={() => {
                  onEdit(row.member!);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-ink transition-colors duration-150 hover:bg-ink/5"
              >
                <Pencil size={13} /> {t(lang, "edit")}
              </button>
              <button
                onClick={() => {
                  if (confirm(tFormat(lang, "confirmDeleteMember", { name: row.name }))) onDelete(row.member!.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-clay transition-colors duration-150 hover:bg-clay/10"
              >
                <Trash2 size={13} /> {t(lang, "delete")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <span className="w-[30px]" />
      )}

      <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-basin-2 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-terrace-700">
        <MessageCircle size={13} /> {t(lang, "message")}
      </button>

      <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-basin-2 px-3 py-1.5 text-xs font-medium text-ink-soft">
        {t(lang, "tasksLabel")} <span className="font-mono-num font-semibold text-ink">{row.taskCount}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-basin-2 px-3 py-1.5 text-xs font-medium text-ink-soft">
        {t(lang, "projectsLabel")}{" "}
        <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-ink">
          {row.projectCount}
          <span className="h-1.5 w-1.5 rounded-full bg-terrace-500" />
        </span>
      </div>

      {row.kind === "member" && (
        <div className="order-last flex min-w-[140px] flex-1 items-center gap-2 sm:order-none">
          <span className="whitespace-nowrap text-xs text-ink-soft">{t(lang, "overallProgress")}</span>
          <div className="water-channel h-1.5 flex-1 rounded-full">
            <div className="water-fill rounded-full" style={{ width: `${row.progress}%`, background: "#17594B" }} />
          </div>
          <span className="font-mono-num text-xs font-semibold text-ink">{row.progress}%</span>
        </div>
      )}

      <div className="ms-auto flex min-w-0 items-center gap-2.5">
        <div className="min-w-0 text-end">
          <h3 className="truncate text-sm font-semibold text-ink">{row.name}</h3>
          <RowMeta row={row} />
        </div>
        <div className="relative shrink-0">
          <MemberAvatar
            member={row.member ?? { name: row.name, avatar: "", color: "#C9973B" }}
            size={40}
          />
          {row.kind === "collaborator" ? (
            <span className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 ring-2 ring-card">
              <Handshake size={8} className="text-white" />
            </span>
          ) : (
            <span className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-terrace-500 ring-2 ring-card">
              <CheckCircle2 size={8} className="text-white" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberForm({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSave: (data: Omit<TeamMember, "id" | "createdAt">) => void;
}) {
  const { lang } = useStore();
  const [name, setName] = useState(member?.name || "");
  const [role, setRole] = useState(member?.role || "");
  const [email, setEmail] = useState(member?.email || "");
  const [avatar, setAvatar] = useState(member?.avatar || "");
  const [color, setColor] = useState(
    member?.color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large (max 2MB)");
      return;
    }
    // resize & convert to data URL
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = img.width * scale;
        const h = img.height * scale;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), role: role.trim(), email: email.trim(), avatar, color });
  };

  const inputCls =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-terrace-500 focus:ring-4 focus:ring-terrace-500/15";
  const labelCls =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="terrace-card w-full max-w-md overflow-hidden bg-card shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-line bg-basin-2/50 px-5 py-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {member ? t(lang, "editMember") : t(lang, "newMember")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terrace-500/10 hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Avatar uploader */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <MemberAvatar
                member={member?.hasAccount ? member : ({ name, avatar, color } as TeamMember)}
                size={96}
              />
              {!member?.hasAccount && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -end-1 flex h-9 w-9 items-center justify-center rounded-full bg-terrace-600 text-white shadow-lg ring-4 ring-card transition-colors duration-150 hover:bg-terrace-700"
                  title={t(lang, "uploadPhoto")}
                >
                  <Camera size={16} />
                </button>
              )}
            </div>

            {member?.hasAccount ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-terrace-500/10 px-3 py-1.5 text-xs text-terrace-700">
                <BadgeCheck size={13} /> {t(lang, "hasAccountTip")}
              </p>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
                  >
                    <Upload size={13} /> {t(lang, "uploadPhoto")}
                  </button>
                  {avatar && (
                    <button
                      onClick={() => setAvatar("")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-clay/10 hover:text-clay"
                    >
                      <Trash2 size={13} /> {t(lang, "removePhoto")}
                    </button>
                  )}
                </div>

                {/* Color picker (used when no avatar) */}
                {!avatar && (
                  <div className="flex gap-2 animate-slide-down">
                    {AVATAR_COLORS.map((c) => {
                      const active = color === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
                          style={{
                            backgroundColor: c,
                            boxShadow: active ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c}` : "none",
                            transform: active ? "scale(1.1)" : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberName")} *</label>
            <input
              autoFocus
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "teammateName")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberRole")}</label>
            <input
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t(lang, "memberRolePlaceholder")}
            />
          </div>

          <div>
            <label className={labelCls}>{t(lang, "memberEmail")}</label>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(lang, "memberEmailPlaceholder")}
            />
          </div>
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

export function MemberAvatar({
  member,
  size = 32,
}: {
  member: Pick<TeamMember, "name" | "avatar" | "color" | "linkedAvatar" | "linkedAvatarColor">;
  size?: number;
}) {
  // A linked, registered account's own profile photo/color takes priority
  // over whatever avatar was set manually for this team-member label, so
  // everyone's picture stays in sync with what they set on their profile.
  const avatar = member.linkedAvatar || member.avatar;
  const color = member.linkedAvatarColor || member.color;

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={member.name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = member.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color || "#6366f1",
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
