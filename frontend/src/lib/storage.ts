import type { Goal, Template, TeamMember, Project } from "../types";

const GOALS_KEY = "cascade_goals_v1";
const TEMPLATES_KEY = "cascade_templates_v1";
const MEMBERS_KEY = "cascade_members_v1";
const PROJECTS_KEY = "cascade_projects_v1";
const DARK_KEY = "cascade_dark_v1";
const LANG_KEY = "cascade_lang_v1";
const CURRENT_PROJECT_KEY = "cascade_current_project_v1";
const ROADMAP_OWNER_KEY = "cascade_roadmap_owner_v1";

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

// migrate legacy single `image` field on checklist items into the new `images` array
function migrateGoals(goals: Goal[]): Goal[] {
  return goals.map((g) => {
    if (!Array.isArray(g.checklist)) return g;
    let changed = false;
    const checklist = g.checklist.map((c) => {
      if (!c.images) {
        changed = true;
        return { ...c, images: c.image ? [c.image] : [] };
      }
      return c;
    });
    return changed ? { ...g, checklist } : g;
  });
}

export function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return [];
    return migrateGoals(JSON.parse(raw) as Goal[]);
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Template[];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: Template[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function loadDarkMode(): boolean {
  try {
    const raw = localStorage.getItem(DARK_KEY);
    if (raw === null) {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    }
    return raw === "true";
  } catch {
    return false;
  }
}

export function saveDarkMode(dark: boolean) {
  localStorage.setItem(DARK_KEY, String(dark));
}

export function loadLang(): "en" | "ar" {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    return (raw === "ar" || raw === "en") ? raw : "en";
  } catch {
    return "en";
  }
}

export function saveLang(lang: "en" | "ar") {
  localStorage.setItem(LANG_KEY, lang);
}

/** Remembers which project/workspace filter was active, so relaunching the
 *  app returns to the same place instead of resetting to "All Projects". */
export function loadCurrentProjectId(): string {
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || "all";
  } catch {
    return "all";
  }
}
export function saveCurrentProjectId(id: string) {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
  } catch {
    /* ignore (e.g. storage disabled/full) */
  }
}

/** Same idea for the roadmap-owner filter (team roadmap vs. a member's
 *  personal one). Stored as "team" for the null/team-wide case. */
export function loadRoadmapOwnerId(): string | null {
  try {
    const raw = localStorage.getItem(ROADMAP_OWNER_KEY);
    return raw && raw !== "team" ? raw : null;
  } catch {
    return null;
  }
}
export function saveRoadmapOwnerId(id: string | null) {
  try {
    localStorage.setItem(ROADMAP_OWNER_KEY, id ?? "team");
  } catch {
    /* ignore */
  }
}

export function loadMembers(): TeamMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeamMember[];
  } catch {
    return [];
  }
}

export function saveMembers(members: TeamMember[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

/**
 * Downloads a JSON backup of whatever is currently cached locally — but
 * only if there's actually something in it. Runs automatically right
 * before we ever wipe local data (login/register/logout), so nobody loses
 * work again just because it hadn't reached the server yet.
 */
function backupLocalDataIfAny(): void {
  const goals = loadGoals();
  const templates = loadTemplates();
  const members = loadMembers();
  const projects = loadProjects();

  const hasData =
    goals.length > 0 || templates.length > 0 || members.length > 0 || projects.length > 0;
  if (!hasData || typeof document === "undefined") return;

  const payload = {
    goals,
    templates,
    members,
    projects,
    backedUpAt: new Date().toISOString(),
    note: "نسخة احتياطية تلقائية قبل تسجيل دخول/خروج جديد",
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cascade-auto-backup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Wipes the locally-cached goals/templates/members/projects (but keeps
 * dark-mode/language prefs). Must run on login/register/logout so that
 * switching accounts on the same browser never carries over the previous
 * account's cached data — otherwise the "push local cache if the server
 * has nothing yet" step in store.tsx would try to re-insert entities that
 * already belong to someone else, which the database rejects (duplicate
 * id) and silently leaves you stuck in "offline" mode.
 *
 * Always backs up first (see backupLocalDataIfAny) so clearing never
 * means losing data that hadn't made it to the server yet.
 */
export function clearAllLocalData() {
  backupLocalDataIfAny();
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(TEMPLATES_KEY);
  localStorage.removeItem(MEMBERS_KEY);
  localStorage.removeItem(PROJECTS_KEY);
}
