import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Goal, Template, TemplateNode, TeamMember, Project } from "./types";
import {
  loadGoals,
  saveGoals,
  loadTemplates,
  saveTemplates,
  loadDarkMode,
  saveDarkMode,
  loadLang,
  saveLang,
  loadMembers,
  saveMembers,
  loadProjects,
  saveProjects,
  uid,
} from "./lib/storage";
import {
  fetchState,
  syncGoals,
  syncMembers,
  syncProjects,
  syncTemplates,
  getStoredUser,
  fetchMe,
} from "./lib/api";
import {
  computeProgress,
  getDescendants,
  newGoal,
  statusFromProgress,
  buildTree,
  type TreeNode,
} from "./lib/goals";
import { fireConfetti } from "./lib/confetti";

interface StoreCtx {
  goals: Goal[];
  templates: Template[];
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  lang: "en" | "ar";
  setLang: (v: "en" | "ar") => void;
  syncStatus: "syncing" | "synced" | "offline";
  addGoal: (g: Goal) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  reorderUnderParent: (id: string, parentId: string | null, beforeId: string | null) => void;
  archiveGoal: (id: string, archived: boolean) => void;
  saveAsTemplate: (rootId: string, name: string) => void;
  deleteTemplate: (id: string) => void;
  createFromTemplate: (templateId: string, parentId: string | null) => string | null;
  importData: (goals: Goal[], templates: Template[], members?: TeamMember[], projects?: Project[]) => void;
  replaceAll: (goals: Goal[]) => void;
  effProgress: (g: Goal) => number;
  completeAll: (roadmapOwnerId?: string | null) => void;
  // members
  members: TeamMember[];
  addMember: (m: Omit<TeamMember, "id" | "createdAt">) => TeamMember;
  updateMember: (id: string, patch: Partial<TeamMember>) => void;
  deleteMember: (id: string) => void;
  /** Re-fetches the member list from the server (used after accepting invitations). */
  refreshMembersFromServer: () => Promise<void>;
  // projects
  projects: Project[];
  addProject: (p: Omit<Project, "id" | "createdAt">) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function useDebouncedSync<T>(
  value: T,
  hydratedRef: React.MutableRefObject<boolean>,
  syncFn: (v: T) => Promise<void>,
  setSyncStatus: (s: "syncing" | "synced" | "offline") => void,
) {
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.clearTimeout(timerRef.current);
    setSyncStatus("syncing");
    timerRef.current = window.setTimeout(() => {
      syncFn(value)
        .then(() => setSyncStatus("synced"))
        .catch((e) => {
          console.error("sync failed, changes are still saved locally", e);
          setSyncStatus("offline");
        });
    }, 1200);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

// Like useDebouncedSync, but for members specifically: the server can
// reassign ids (reusing an existing team_member row for the same email
// instead of creating a new one), so the local state must be reconciled
// with whatever list the server actually persisted — otherwise a
// removed-then-re-added member keeps resurfacing as a stale duplicate.
//
// Also exposes `flushNow`, a way to push a specific snapshot immediately
// instead of waiting out the debounce. Deletion needs this: if the debounce
// window hasn't elapsed yet and the user switches browsers/devices or the
// tab closes, the delete never reaches the server and the "removed" member
// resurfaces there (e.g. in another collaborator's person-filter list).
function useDebouncedMembersSync(
  value: TeamMember[],
  hydratedRef: React.MutableRefObject<boolean>,
  syncFn: (v: TeamMember[]) => Promise<TeamMember[]>,
  setSyncStatus: (s: "syncing" | "synced" | "offline") => void,
  setMembers: (m: TeamMember[]) => void,
): { flushNow: (v: TeamMember[]) => void } {
  const timerRef = useRef<number | undefined>(undefined);

  const runSync = (v: TeamMember[]) => {
    setSyncStatus("syncing");
    syncFn(v)
      .then((serverMembers) => {
        setSyncStatus("synced");
        const changed =
          serverMembers.length !== v.length || serverMembers.some((m, i) => m.id !== v[i]?.id);
        if (changed) setMembers(serverMembers);
      })
      .catch((e) => {
        console.error("sync failed, changes are still saved locally", e);
        setSyncStatus("offline");
      });
  };

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.clearTimeout(timerRef.current);
    setSyncStatus("syncing");
    timerRef.current = window.setTimeout(() => runSync(value), 1200);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const flushNow = (v: TeamMember[]) => {
    if (!hydratedRef.current) return;
    window.clearTimeout(timerRef.current);
    runSync(v);
  };

  return { flushNow };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates());
  const [members, setMembers] = useState<TeamMember[]>(() => loadMembers());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [darkMode, setDarkModeState] = useState<boolean>(() => loadDarkMode());
  const [lang, setLangState] = useState<"en" | "ar">(() => loadLang());
  const [syncStatus, setSyncStatus] = useState<"syncing" | "synced" | "offline">("syncing");
  const hydratedRef = useRef(false);

  useEffect(() => saveGoals(goals), [goals]);
  useEffect(() => saveTemplates(templates), [templates]);
  useEffect(() => saveMembers(members), [members]);
  useEffect(() => saveProjects(projects), [projects]);
  useEffect(() => {
    saveDarkMode(darkMode);
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    saveLang(lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  // On first mount: pull the durable copy from the server. If the server has
  // nothing yet (first time this account connects), push whatever is cached
  // locally instead, so nothing gets silently wiped either direction.
  useEffect(() => {
    let cancelled = false;

    const ensureSelfMember = (list: TeamMember[], me: { name: string; email: string }) => {
      const already = list.some((m) => m.email.toLowerCase() === me.email.toLowerCase());
      if (already) return list;
      const self: TeamMember = {
        id: uid(),
        name: me.name,
        role: "",
        email: me.email,
        avatar: "",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      };
      return [self, ...list];
    };

    fetchState()
      .then(async (remote) => {
        if (cancelled) return;
        const remoteHasData =
          remote.goals.length > 0 ||
          remote.templates.length > 0 ||
          remote.members.length > 0 ||
          remote.projects.length > 0;

        const me = await fetchMe().catch(() => getStoredUser());

        if (remoteHasData) {
          setGoals(remote.goals);
          setTemplates(remote.templates);
          setMembers(me ? ensureSelfMember(remote.members, me) : remote.members);
          setProjects(remote.projects);
        } else {
          const localMembers = me ? ensureSelfMember(members, me) : members;
          if (localMembers !== members) setMembers(localMembers);
          Promise.all([
            syncGoals(goals),
            syncTemplates(templates),
            syncMembers(localMembers),
            syncProjects(projects),
          ]).catch((e) => console.error("initial push failed", e));
        }
        hydratedRef.current = true;
        setSyncStatus("synced");
      })
      .catch((e) => {
        console.error("failed to load remote state, working from local cache", e);
        hydratedRef.current = true;
        setSyncStatus("offline");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced push-to-server for each resource, only after initial hydration
  useDebouncedSync(goals, hydratedRef, syncGoals, setSyncStatus);
  useDebouncedSync(templates, hydratedRef, syncTemplates, setSyncStatus);
  const { flushNow: flushMembersNow } = useDebouncedMembersSync(
    members,
    hydratedRef,
    syncMembers,
    setSyncStatus,
    setMembers,
  );
  useDebouncedSync(projects, hydratedRef, syncProjects, setSyncStatus);

  const setDarkMode = useCallback((v: boolean) => setDarkModeState(v), []);
  const setLang = useCallback((v: "en" | "ar") => setLangState(v), []);

  const completeAll = useCallback((roadmapOwnerId: string | null = null) => {
    setGoals((prev) => {
      const result = prev.map((g) => {
        if (
          g.archived ||
          g.status === "Completed" ||
          (g.roadmapOwnerId ?? null) !== roadmapOwnerId
        ) {
          return g;
        }
        return touch({
          ...g,
          status: "Completed",
          progress: 100,
          checklist: g.checklist.map((c) => ({ ...c, done: true })),
        });
      });
      setTimeout(() => fireConfetti(0.5, 0.4), 50);
      return result;
    });
  }, []);

  const touch = (g: Goal): Goal => ({ ...g, updatedAt: new Date().toISOString() });

  const addGoal = useCallback((g: Goal) => {
    setGoals((prev) => [...prev, g]);
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setGoals((prev) => {
      const before = prev.find((g) => g.id === id);
      const next = prev.map((g) => (g.id === id ? touch({ ...g, ...patch }) : g));
      // celebrate when this goal hits 100 (manual progress) and wasn't there before
      if (before) {
        const beforeP = computeProgress(prev, before);
        const after = next.find((g) => g.id === id)!;
        const afterP = computeProgress(next, after);
        if (beforeP < 100 && afterP >= 100) {
          setTimeout(() => fireConfetti(), 50);
        }
      }
      return next;
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => {
      const desc = getDescendants(prev, id).map((g) => g.id);
      const remove = new Set([id, ...desc]);
      return prev
        .filter((g) => !remove.has(g.id))
        .map((g) => ({
          ...g,
          dependsOn: g.dependsOn.filter((d) => !remove.has(d)),
        }));
    });
  }, []);

  const archiveGoal = useCallback((id: string, archived: boolean) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? touch({ ...g, archived }) : g)));
  }, []);

  const reorderUnderParent = useCallback(
    (id: string, parentId: string | null, beforeId: string | null) => {
      setGoals((prev) => {
        // prevent dropping under own descendant
        const desc = new Set(getDescendants(prev, id).map((g) => g.id));
        if (parentId && (desc.has(parentId) || parentId === id)) return prev;
        let updated = prev.map((g) =>
          g.id === id ? touch({ ...g, parentId }) : g,
        );
        // recompute order among siblings
        const siblings = updated
          .filter((g) => g.parentId === parentId && g.id !== id)
          .sort((a, b) => a.order - b.order);
        const moved = updated.find((g) => g.id === id)!;
        const list = [...siblings];
        const insertIdx = beforeId
          ? list.findIndex((g) => g.id === beforeId)
          : list.length;
        if (insertIdx === -1) list.push(moved);
        else list.splice(insertIdx, 0, moved);
        const orderMap = new Map(list.map((g, i) => [g.id, i]));
        updated = updated.map((g) =>
          orderMap.has(g.id) ? { ...g, order: orderMap.get(g.id)! } : g,
        );
        return updated;
      });
    },
    [],
  );

  const saveAsTemplate = useCallback((rootId: string, name: string) => {
    setGoals((prevGoals) => {
      setTemplates((prev) => {
        const root = prevGoals.find((g) => g.id === rootId);
        if (!root) return prev;
        const subtree = [root, ...getDescendants(prevGoals, rootId)];
        const idMap = new Map<string, string>();
        for (const g of subtree) idMap.set(g.id, uid());
        const nodes: TemplateNode[] = subtree.map((g) => ({
          tempId: idMap.get(g.id)!,
          parentTempId:
            g.id === rootId ? null : idMap.get(g.parentId!) ?? null,
          name: g.name,
          requirements: g.requirements,
          notes: g.notes,
          priority: g.priority,
          tag: g.tag,
          color: g.color,
          checklist: g.checklist.map((c) => ({ text: c.text, done: false })),
        }));
        const tpl: Template = {
          id: uid(),
          name,
          nodes,
          createdAt: new Date().toISOString(),
        };
        return [...prev, tpl];
      });
      return prevGoals;
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const createFromTemplate = useCallback(
    (templateId: string, parentId: string | null): string | null => {
      let rootNewId: string | null = null;
      setTemplates((prevT) => {
        const tpl = prevT.find((t) => t.id === templateId);
        if (!tpl) return prevT;
        setGoals((prev) => {
          const idMap = new Map<string, string>();
          for (const n of tpl.nodes) idMap.set(n.tempId, uid());
          const created: Goal[] = tpl.nodes.map((n) => {
            const isRoot = n.parentTempId === null;
            const g = newGoal({
              id: idMap.get(n.tempId)!,
              parentId: isRoot ? parentId : idMap.get(n.parentTempId!)!,
              name: n.name,
              requirements: n.requirements,
              notes: n.notes,
              priority: n.priority,
              tag: n.tag,
              color: n.color,
              templateId: tpl.id,
              checklist: n.checklist.map((c) => ({
                id: uid(),
                text: c.text,
                done: c.done,
              })),
            });
            if (isRoot) rootNewId = g.id;
            return g;
          });
          return [...prev, ...created];
        });
        return prevT;
      });
      return rootNewId;
    },
    [],
  );

  const importData = useCallback((g: Goal[], t: Template[], m?: TeamMember[], p?: Project[]) => {
    setGoals(g);
    setTemplates(t);
    if (m) setMembers(m);
    if (p) setProjects(p);
  }, []);

  const addMember = useCallback(
    (m: Omit<TeamMember, "id" | "createdAt">) => {
      const newMember: TeamMember = {
        ...m,
        id: uid(),
        createdAt: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
      return newMember;
    },
    [],
  );

  const updateMember = useCallback((id: string, patch: Partial<TeamMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const deleteMember = useCallback(
    (id: string) => {
      // Deletion is destructive and must not wait out the debounce window:
      // if the user switches devices/browsers or closes the tab before it
      // elapses, the delete never reaches the server and the "removed"
      // person resurfaces there later (e.g. in another collaborator's
      // shared-project person filter).
      const next = members.filter((m) => m.id !== id);
      setMembers(next);
      flushMembersNow(next);
    },
    [members, flushMembersNow],
  );

  /**
   * Re-fetches the canonical member list from the server and reconciles it
   * with the local store. Called after a project invitation is accepted so
   * the newly-added TeamMember (created server-side) appears immediately in
   * GoalForm assignees and ProjectForm member-pickers without a page reload.
   */
  const refreshMembersFromServer = useCallback(async () => {
    try {
      const remote = await fetchState();
      if (remote.members.length > 0) {
        setMembers(remote.members);
      }
    } catch {
      // silent: the next periodic sync will catch it
    }
  }, []);

  const addProject = useCallback(
    (p: Omit<Project, "id" | "createdAt">) => {
      const newProject: Project = {
        ...p,
        id: uid(),
        createdAt: new Date().toISOString(),
      };
      setProjects((prev) => [...prev, newProject]);
      return newProject;
    },
    [],
  );

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setGoals((prevG) => prevG.map((g) => (g.projectId === id ? { ...g, projectId: null } : g)));
  }, []);

  const replaceAll = useCallback((g: Goal[]) => setGoals(g), []);

  const effProgress = useCallback((g: Goal) => computeProgress(goals, g), [goals]);

  // auto-sync status to progress for auto goals
  useEffect(() => {
    let changed = false;
    const updated = goals.map((g) => {
      const p = computeProgress(goals, g);
      const st = statusFromProgress(p);
      if (g.autoProgress) {
        if (g.progress !== p || g.status !== st) {
          changed = true;
          return { ...g, progress: p, status: st };
        }
      }
      return g;
    });
    if (changed) setGoals(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  const value = useMemo<StoreCtx>(
    () => ({
      goals,
      templates,
      darkMode,
      setDarkMode,
      lang,
      setLang,
      syncStatus,
      addGoal,
      updateGoal,
      deleteGoal,
      reorderUnderParent,
      archiveGoal,
      saveAsTemplate,
      deleteTemplate,
      createFromTemplate,
      importData,
      replaceAll,
      effProgress,
      completeAll,
      members,
      addMember,
      updateMember,
      deleteMember,
      refreshMembersFromServer,
      projects,
      addProject,
      updateProject,
      deleteProject,
    }),
    [
      goals,
      templates,
      darkMode,
      setDarkMode,
      lang,
      setLang,
      syncStatus,
      addGoal,
      updateGoal,
      deleteGoal,
      reorderUnderParent,
      archiveGoal,
      saveAsTemplate,
      deleteTemplate,
      createFromTemplate,
      importData,
      replaceAll,
      effProgress,
      completeAll,
      members,
      addMember,
      updateMember,
      deleteMember,
      refreshMembersFromServer,
      projects,
      addProject,
      updateProject,
      deleteProject,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useTree(includeArchived = false): TreeNode[] {
  const { goals } = useStore();
  return useMemo(() => buildTree(goals, includeArchived), [goals, includeArchived]);
}
