import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Moon,
  Sun,
  Search,
  Download,
  Upload,
  GitBranch,
  Map,
  LayoutDashboard,
  Archive,
  FileStack,
  Image as ImageIcon,
  FileText,
  Printer,
  ChevronDown,
  Target,
  Filter,
  Globe,
  CheckCircle,
  Users,
  FolderDot,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Inbox,
  Mail,
  Share2,
  Waves,
} from "lucide-react";
import { StoreProvider, useStore } from "./store";
import type { Goal } from "./types";
import { loadTemplates, loadCurrentProjectId, saveCurrentProjectId } from "./lib/storage";
import { isLoggedIn, fetchMyInvitations, fetchSharedProjects, type SharedProject } from "./lib/api";
import UserProfileMenu from "./components/UserProfileMenu";
import ProfilePanel from "./components/ProfilePanel";
import { Select, useMountTransition, type SelectGroup, type SelectOption } from "./components/ui";
import LoginScreen from "./components/LoginScreen";
import GoalForm from "./components/GoalForm";
import TreeView from "./components/TreeView";
import RoadmapView from "./components/RoadmapView";
import Dashboard from "./components/Dashboard";
import TemplatesPanel from "./components/TemplatesPanel";
import ArchivePanel from "./components/ArchivePanel";
import NotificationBell from "./components/NotificationBell";
import TeamPanel from "./components/TeamPanel";
import ProjectsPanel from "./components/ProjectsPanel";
import AssignedToMePanel from "./components/AssignedToMePanel";
import InvitationsPanel from "./components/InvitationsPanel";
import SharedProjectsPanel from "./components/SharedProjectsPanel";
import SharedProjectRoadmap from "./components/SharedProjectRoadmap";
import Sidebar from "./components/Sidebar";
import { allAssignees, allTags } from "./lib/goals";
import { exportPDF, exportPNG, printElement } from "./lib/exporter";
import { t, tFormat } from "./lib/i18n";
import type { Lang } from "./lib/i18n";

type View = "tree" | "roadmap" | "dashboard";

function Shell() {
  const { goals, darkMode, setDarkMode, importData, lang, setLang, completeAll, members, projects, syncStatus } = useStore();
  const [view, setView] = useState<View>("roadmap");
  const [formGoal, setFormGoal] = useState<Goal | null>(null);
  const [formParent, setFormParent] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showSharedProjects, setShowSharedProjects] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [sharedProjectsLoaded, setSharedProjectsLoaded] = useState(false);
  const [roadmapOwnerId, setRoadmapOwnerId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => loadCurrentProjectId());
  const [exportOpen, setExportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRowMounted = useMountTransition(filterOpen, 150);
  const [langOpen, setLangOpen] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fTag, setFTag] = useState("");

  const captureRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll for pending project invitations so the badge count stays fresh
  // even if the invite arrived while this tab was already open.
  useEffect(() => {
    let cancelled = false;
    const loadCount = () => {
      fetchMyInvitations()
        .then((res) => {
          if (!cancelled) setPendingInvitationsCount(res.invitations.length);
        })
        .catch(() => {
          // silent: badge just won't update this cycle
        });
    };
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Projects someone else invited me into — kept fully separate from the
  // local `goals`/`projects` store (never touched by the full-replace
  // PUT /goals or PUT /projects sync) so a collaborator's browser can
  // never overwrite or delete another account's data.
  const loadSharedProjects = () => {
    fetchSharedProjects()
      .then((res) => {
        setSharedProjects(res.projects);
        setSharedProjectsLoaded(true);
      })
      .catch(() => {
        // silent: list just won't update this cycle
      });
  };

  useEffect(() => {
    loadSharedProjects();
    const interval = setInterval(loadSharedProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    saveCurrentProjectId(currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    if (!sharedProjectsLoaded) return;
    if (currentProjectId.startsWith("shared:")) {
      const targetId = currentProjectId.substring(7);
      const exists = sharedProjects.some((p) => p.id === targetId);
      if (!exists) {
        alert("تم إخراجك من هذا المشروع");
        setCurrentProjectId("all");
      }
    }
  }, [sharedProjects, sharedProjectsLoaded, currentProjectId]);

  const assignees = useMemo(() => allAssignees(goals), [goals]);
  const tags = useMemo(() => allTags(goals), [goals]);

  const currentRoadmapMember = members.find((m) => m.id === roadmapOwnerId);
  const currentRoadmapLabel = currentRoadmapMember
    ? tFormat(lang, "personalFor", { name: currentRoadmapMember.name })
    : t(lang, "teamRoadmap");

  const activeProject = projects.find((p) => p.id === currentProjectId);
  const isSharedView = currentProjectId.startsWith("shared:");
  const activeSharedProject = isSharedView
    ? sharedProjects.find((p) => `shared:${p.id}` === currentProjectId) ?? null
    : null;
  const currentProjectLabel =
    currentProjectId === "all"
      ? t(lang, "allProjectsAndGeneral")
      : currentProjectId === "general"
        ? t(lang, "generalWorkspace")
        : isSharedView
          ? activeSharedProject
            ? `${activeSharedProject.name} · ${activeSharedProject.ownerName}`
            : t(lang, "projectScope")
          : activeProject?.name || t(lang, "projectScope");

  const projectFilter = (g: Goal) => {
    if (currentProjectId === "all") return true;
    if (currentProjectId === "general") return (g.projectId ?? null) === null;
    return g.projectId === currentProjectId;
  };

  const activeGoals = goals.filter(
    (g) => !g.archived && (g.roadmapOwnerId ?? null) === roadmapOwnerId && projectFilter(g),
  );
  const incompleteCount = activeGoals.filter((g) => g.status !== "Completed").length;
  const hasGoals = activeGoals.length > 0;

  const filterFn = (g: Goal) => {
    if ((g.roadmapOwnerId ?? null) !== roadmapOwnerId) return false;
    if (!projectFilter(g)) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (fAssignee && g.assignedTo !== fAssignee) return false;
    if (fPriority && g.priority !== fPriority) return false;
    if (fStatus && g.status !== fStatus) return false;
    if (fTag && g.tag !== fTag) return false;
    return true;
  };

  const activeFilterCount = [fAssignee, fPriority, fStatus, fTag].filter(Boolean).length;

  const openNew = (parentId: string | null = null) => {
    setFormGoal(null);
    setFormParent(parentId);
    setShowForm(true);
  };
  const openEdit = (g: Goal) => {
    setFormGoal(g);
    setShowForm(true);
  };

  const handleExportData = () => {
    const data = { goals, templates: loadTemplates(), members, projects, version: 3 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cascade-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.goals)) {
          if (confirm(t(lang, "confirmReplace"))) {
            importData(data.goals, data.templates || [], data.members || [], data.projects || []);
          }
        } else alert(t(lang, "invalidBackup"));
      } catch {
        alert(t(lang, "couldNotRead"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const doExport = async (kind: "pdf" | "png" | "print") => {
    setExportOpen(false);
    if (kind === "print") return printElement();
    if (!captureRef.current) return;
    const name = `cascade-${view}`;
    if (kind === "pdf") await exportPDF(captureRef.current, name);
    else await exportPNG(captureRef.current, name);
  };

  const gotoGoal = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (g) openEdit(g);
  };

  const selectCls =
    "rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-terrace-500";

  const switchLang = (l: Lang) => {
    setLang(l);
    setLangOpen(false);
  };

  const handleCompleteAll = () => {
    if (incompleteCount === 0) return;
    if (confirm(tFormat(lang, "confirmCompleteAll", { count: incompleteCount }))) {
      completeAll(roadmapOwnerId);
    }
  };

  const clearFilters = () => {
    setFAssignee("");
    setFPriority("");
    setFStatus("");
    setFTag("");
    setSearch("");
  };

  const viewTabs: { id: View; icon: typeof GitBranch; key: keyof typeof import("./lib/i18n") extends never ? never : any }[] = [
    { id: "roadmap", icon: Map, key: "roadmap" },
    { id: "tree", icon: GitBranch, key: "tree" },
  ];

  const sidebarItems = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t(lang, "dashboard"),
      active: !isSharedView && view === "dashboard",
      onClick: () => setView("dashboard"),
    },
    {
      id: "team",
      icon: Users,
      label: t(lang, "teamMembers"),
      active: showTeam,
      onClick: () => setShowTeam(true),
    },
    {
      id: "projects",
      icon: FolderDot,
      label: t(lang, "projects"),
      active: showProjects,
      onClick: () => setShowProjects(true),
    },
    {
      id: "archive",
      icon: Archive,
      label: t(lang, "archive"),
      active: showArchive,
      onClick: () => setShowArchive(true),
    },
    {
      id: "templates",
      icon: FileStack,
      label: t(lang, "templates"),
      active: showTemplates,
      onClick: () => setShowTemplates(true),
    },
  ];

  return (
    <div className="min-h-screen bg-basin text-ink">
      <Sidebar items={sidebarItems} />
      {/* Header */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-basin/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:ps-24">
          <div className="flex items-center gap-2.5">
            <div className="terrace-card flex h-9 w-9 items-center justify-center bg-terrace-700 text-terrace-50 shadow-sm">
              <Waves size={18} />
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{t(lang, "appTitle")}</h1>
              <p className="hidden text-[11px] text-ink-soft sm:block">{t(lang, "appSubtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Complete All */}
            {incompleteCount > 0 && view !== "dashboard" && (
              <button
                onClick={handleCompleteAll}
                title={t(lang, "completeAll")}
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 text-sm font-semibold text-green-700 transition hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300 dark:hover:bg-green-500/20"
              >
                <CheckCircle size={16} />
                {t(lang, "completeAll")} ({incompleteCount})
              </button>
            )}

            <NotificationBell onGoto={gotoGoal} />
            <button
              onClick={() => setShowInvitations(true)}
              title="دعوات المشاريع"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-terrace-50"
            >
              <Mail size={19} />
              {pendingInvitationsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingInvitationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSharedProjects(true)}
              title="مشاريع مشتركة معي"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-terrace-50"
            >
              <Share2 size={19} />
            </button>
            <button
              onClick={() => setShowAssignedToMe(true)}
              title="المهام المسندة لي"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-terrace-50"
            >
              <Inbox size={19} />
            </button>
            <span
              title={
                syncStatus === "syncing"
                  ? t(lang, "syncingNow")
                  : syncStatus === "offline"
                    ? t(lang, "syncOffline")
                    : t(lang, "syncedOk")
              }
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${syncStatus === "offline" ? "text-clay" : "text-ink-soft"
                }`}
            >
              {syncStatus === "syncing" ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : syncStatus === "offline" ? (
                <CloudOff size={17} />
              ) : (
                <CloudCheck size={17} />
              )}
            </span>
            <div className="ms-1">
              <UserProfileMenu lang={lang} onOpenProfile={() => setShowProfile(true)} />
            </div>

            {/* Language Toggle */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((v) => !v)}
                title={t(lang, "language")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-terrace-50"
              >
                <Globe size={19} />
              </button>
              {langOpen && (
                <div className="absolute end-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-scale-in">
                  <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                    {t(lang, "language")}
                  </div>
                  <button
                    onClick={() => switchLang("en")}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm font-medium transition hover:bg-terrace-50 ${lang === "en" ? "text-terrace-600 dark:text-terrace-400" : "text-ink"
                      }`}
                  >
                    <span className="text-base">🇺🇸</span> {t(lang, "english")}
                  </button>
                  <button
                    onClick={() => switchLang("ar")}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm font-medium transition hover:bg-terrace-50 ${lang === "ar" ? "text-terrace-600 dark:text-terrace-400" : "text-ink"
                      }`}
                  >
                    <span className="text-base">🇸🇦</span> {t(lang, "arabic")}
                  </button>
                </div>
              )}
            </div>

            {/* Dark Mode */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title="Theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-terrace-50"
            >
              {darkMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            {/* New Goal */}
            {!isSharedView && (
              <button
                onClick={() => openNew(null)}
                className="ms-1 inline-flex items-center gap-1.5 rounded-lg bg-terrace-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terrace-700"
              >
                <Plus size={17} />
                <span className="hidden sm:inline">{t(lang, "newGoal")}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="no-print mx-auto max-w-7xl px-4 pt-5 sm:ps-24">
        <div className="flex flex-wrap items-center gap-2">
          {/* view switcher */}
          {!isSharedView && (
            <div className="flex rounded-xl border border-line bg-card p-1">
              {viewTabs.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === v.id
                      ? "bg-terrace-600 text-white shadow-sm"
                      : "text-ink-soft hover:bg-terrace-50"
                    }`}
                >
                  <v.icon size={16} />
                  <span className="hidden sm:inline">{t(lang, v.key as any)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1">
            <FolderDot size={15} className="text-ink-soft" />
            <Select
              value={currentProjectId}
              onChange={(v) => {
                setCurrentProjectId(v);
                setFStatus("");
                setFAssignee("");
              }}
              title={t(lang, "chooseProject")}
              groups={[
                {
                  label: "",
                  options: [
                    { value: "all", label: t(lang, "allProjectsAndGeneral") },
                    { value: "general", label: t(lang, "generalWorkspace") },
                    ...projects.map((p): SelectOption => ({ value: p.id, label: p.name })),
                  ],
                },
                ...(sharedProjects.length > 0
                  ? [
                    {
                      label: "مشاريع مشتركة معي",
                      options: sharedProjects.map(
                        (p): SelectOption => ({
                          value: `shared:${p.id}`,
                          label: `${p.name} · ${p.ownerName}`,
                        }),
                      ),
                    } satisfies SelectGroup,
                  ]
                  : []),
              ]}
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1">
            <Map size={15} className="text-ink-soft" />
            <Select
              value={roadmapOwnerId ?? "team"}
              onChange={(v) => {
                setRoadmapOwnerId(v === "team" ? null : v);
                setFStatus("");
                setFAssignee("");
              }}
              title={t(lang, "chooseRoadmap")}
              options={[
                { value: "team", label: t(lang, "teamRoadmap") },
                ...members
                  .filter((m) => {
                    if (currentProjectId === "all" || currentProjectId === "general") return true;
                    const proj = projects.find((p) => p.id === currentProjectId);
                    return proj ? proj.memberIds.includes(m.id) : true;
                  })
                  .map(
                    (member): SelectOption => ({
                      value: member.id,
                      label: tFormat(lang, "personalFor", { name: member.name }),
                    }),
                  ),
              ]}
            />
          </div>

          {view !== "dashboard" && (
            <>
              <div className="relative min-w-[160px] flex-1 sm:flex-none">
                <Search
                  size={16}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(lang, "searchPlaceholder")}
                  className="w-full rounded-lg border border-line bg-card py-2 ps-9 pe-3 text-sm text-ink outline-none focus:border-terrace-500"
                />
              </div>

              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors active:scale-[0.97] ${filterOpen || activeFilterCount
                    ? "border-terrace-400 bg-terrace-50 text-terrace-700 dark:bg-terrace-500/15 dark:text-terrace-300"
                    : "border-line text-ink-soft"
                  }`}
                style={{ transition: "transform 120ms var(--ease-out), background-color 150ms, color 150ms, border-color 150ms" }}
              >
                <Filter
                  size={15}
                  className="transition-transform duration-200"
                  style={{ transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)", transitionTimingFunction: "var(--ease-out)" }}
                />
                {t(lang, "filters")}
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-terrace-600 px-1.5 text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </>
          )}

          <div className="ms-auto flex items-center gap-2">
            {/* export */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-terrace-50"
              >
                <Download size={15} /> {t(lang, "export")} <ChevronDown size={14} />
              </button>
              {exportOpen && (
                <div className="absolute end-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-card shadow-xl animate-scale-in">
                  <button
                    onClick={() => doExport("pdf")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm hover:bg-terrace-50"
                  >
                    <FileText size={15} /> {t(lang, "exportPdf")}
                  </button>
                  <button
                    onClick={() => doExport("png")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm hover:bg-terrace-50"
                  >
                    <ImageIcon size={15} /> {t(lang, "exportImage")}
                  </button>
                  <button
                    onClick={() => doExport("print")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm hover:bg-terrace-50"
                  >
                    <Printer size={15} /> {t(lang, "print")}
                  </button>
                </div>
              )}
            </div>
            {/* backup */}
            <button
              onClick={handleExportData}
              title={t(lang, "backup")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-terrace-50"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title={t(lang, "restoreData")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-terrace-50"
            >
              <Upload size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportData}
            />
          </div>
        </div>

        {/* filter row */}
        {filterRowMounted && view !== "dashboard" && (
          <div
            className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3 ${filterOpen ? "animate-slide-down" : "animate-slide-up-out"
              }`}
          >
            <Select
              value={fAssignee}
              onChange={setFAssignee}
              className={selectCls}
              options={[
                { value: "", label: t(lang, "allAssignees") },
                ...assignees.map((a): SelectOption => ({ value: a, label: a })),
              ]}
            />
            <Select
              value={fPriority}
              onChange={setFPriority}
              className={selectCls}
              options={[
                { value: "", label: t(lang, "allPriorities") },
                { value: "High", label: t(lang, "high") },
                { value: "Medium", label: t(lang, "medium") },
                { value: "Low", label: t(lang, "low") },
              ]}
            />
            <Select
              value={fStatus}
              onChange={setFStatus}
              className={selectCls}
              options={[
                { value: "", label: t(lang, "allStatuses") },
                { value: "Not Started", label: t(lang, "notStarted") },
                { value: "In Progress", label: t(lang, "inProgress") },
                { value: "Completed", label: t(lang, "completed") },
              ]}
            />
            <Select
              value={fTag}
              onChange={setFTag}
              className={selectCls}
              options={[
                { value: "", label: t(lang, "allTags") },
                ...tags.map((tg): SelectOption => ({ value: tg, label: tg })),
              ]}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-terrace-600 hover:underline dark:text-terrace-400"
              >
                {t(lang, "clear")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:ps-24">
        <div className="no-print mb-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-ink-soft">
          <span className="flex items-center gap-1.5"><FolderDot size={16} className="text-terrace-500" /> {currentProjectLabel}</span>
          <span className="text-line">|</span>
          <span className="flex items-center gap-1.5"><Map size={16} className="text-ink-soft" /> {currentRoadmapLabel}</span>
        </div>
        <div ref={captureRef} className="print-area">
          {isSharedView ? (
            activeSharedProject ? (
              <SharedProjectRoadmap
                project={activeSharedProject}
                onProjectUpdate={(updater) =>
                  setSharedProjects((prev) => prev.map((p) => (p.id === activeSharedProject.id ? updater(p) : p)))
                }
              />
            ) : (
              <div className="py-20 text-center text-sm text-ink-soft">جاري التحميل...</div>
            )
          ) : view === "dashboard" ? (
            <Dashboard roadmapOwnerId={roadmapOwnerId} currentProjectId={currentProjectId} />
          ) : !hasGoals ? (
            <EmptyState onNew={() => openNew(null)} onTemplates={() => setShowTemplates(true)} lang={lang} />
          ) : (
            <>
              {view === "tree" ? (
                <TreeView onEdit={openEdit} onAddChild={(p) => openNew(p)} filter={filterFn} />
              ) : (
                <RoadmapView
                  onEdit={openEdit}
                  onAddChild={(p) => openNew(p)}
                  filter={filterFn}
                  sequentialLock={activeProject?.sequentialLock ?? false}
                />
              )}
              {(search || activeFilterCount > 0) &&
                !goals.some((g) => !g.archived && filterFn(g)) && (
                  <div className="py-20 text-center">
                    <Search
                      className="mx-auto mb-3 text-ink-soft"
                      size={42}
                    />
                    <p className="font-medium text-ink-soft">
                      {t(lang, "noGoalsMatch")}
                    </p>
                    <button
                      onClick={clearFilters}
                      className="mt-2 text-sm font-medium text-terrace-600 hover:underline dark:text-terrace-400"
                    >
                      {t(lang, "clearFilters")}
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      </main>

      {showForm && (
        <GoalForm
          goal={formGoal}
          defaultParentId={formParent}
          defaultRoadmapOwnerId={roadmapOwnerId}
          defaultProjectId={currentProjectId === "all" || currentProjectId === "general" || isSharedView ? null : currentProjectId}
          onClose={() => setShowForm(false)}
        />
      )}
      {showProjects && (
        <ProjectsPanel
          onClose={() => setShowProjects(false)}
          onOpenProject={(projectId) => {
            setCurrentProjectId(projectId);
            setShowProjects(false);
            clearFilters();
          }}
        />
      )}
      {showTemplates && <TemplatesPanel onClose={() => setShowTemplates(false)} />}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      {showArchive && <ArchivePanel onClose={() => setShowArchive(false)} />}
      {showAssignedToMe && <AssignedToMePanel onClose={() => setShowAssignedToMe(false)} />}
      {showInvitations && (
        <InvitationsPanel
          onClose={() => {
            setShowInvitations(false);
            // refresh the badge count in case something was accepted/declined
            fetchMyInvitations()
              .then((res) => setPendingInvitationsCount(res.invitations.length))
              .catch(() => { });
          }}
          onAccepted={loadSharedProjects}
        />
      )}
      {showSharedProjects && <SharedProjectsPanel onClose={() => setShowSharedProjects(false)} />}
      {showTeam && (
        <TeamPanel
          onClose={() => setShowTeam(false)}
          onOpenRoadmap={(memberId) => {
            setRoadmapOwnerId(memberId);
            setView("roadmap");
            setShowTeam(false);
            clearFilters();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  onNew,
  onTemplates,
  lang,
}: {
  onNew: () => void;
  onTemplates: () => void;
  lang: Lang;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line py-24 text-center">
      <div className="terrace-card mb-4 flex h-20 w-20 items-center justify-center bg-gradient-to-br from-terrace-600 to-terrace-800 text-terrace-50 shadow-lg">
        <Target size={36} />
      </div>
      <h2 className="font-display text-3xl text-ink">{t(lang, "noGoals")}</h2>
      <p className="mt-2 max-w-sm text-ink-soft">{t(lang, "noGoalsDesc")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-xl bg-terrace-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-terrace-700"
        >
          <Plus size={18} /> {t(lang, "createFirstGoal")}
        </button>
        <button
          onClick={onTemplates}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-2.5 font-semibold text-ink hover:bg-terrace-50"
        >
          <FileStack size={18} /> {t(lang, "useTemplate")}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
