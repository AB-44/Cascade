import type { Goal, Template, TeamMember, Project, Priority, Status } from "../types";
import { clearAllLocalData } from "./storage";

const TOKEN_KEY = "cascade_api_token";

// Point this at your Laravel backend. Configure via a `.env` file:
// VITE_API_URL=http://127.0.0.1:8000/api
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    setToken(null);
    throw new ApiError("انتهت الجلسة، سجّل الدخول من جديد", 401);
  }

  if (!res.ok) {
    let message = `فشل الطلب (${res.status})`;
    try {
      const body = await res.json();
      const firstFieldError = body.errors && Object.values(body.errors)[0];
      message = (Array.isArray(firstFieldError) ? firstFieldError[0] : undefined) ?? body.message ?? message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  avatar_color?: string | null;
  created_at?: string;
}

const USER_KEY = "cascade_user";

function setStoredUser(user: CurrentUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): CurrentUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

/** Refreshes the cached user from the server (e.g. name/email changed elsewhere). */
export async function fetchMe(): Promise<CurrentUser> {
  const user = await request<CurrentUser>("/me");
  setStoredUser(user);
  return user;
}

export interface ProfilePatch {
  name: string;
  email: string;
  avatar?: string | null;
  avatar_color?: string | null;
}

export async function updateProfile(patch: ProfilePatch): Promise<CurrentUser> {
  const user = await request<CurrentUser>("/me", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  setStoredUser(user);
  return user;
}

export function updatePassword(currentPassword: string, password: string, confirmation: string): Promise<void> {
  return request<void>("/me/password", {
    method: "PUT",
    body: JSON.stringify({
      current_password: currentPassword,
      password,
      password_confirmation: confirmation,
    }),
  });
}

export async function login(email: string, password: string): Promise<void> {
  const data = await request<{ token: string; user: CurrentUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_name: "cascade-web" }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  clearAllLocalData();
}

export async function register(name: string, email: string, password: string): Promise<void> {
  const data = await request<{ token: string; user: CurrentUser }>("/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, device_name: "cascade-web" }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  clearAllLocalData();
}

export async function logout(): Promise<void> {
  try {
    await request("/logout", { method: "POST" });
  } finally {
    setToken(null);
    setStoredUser(null);
    clearAllLocalData();
  }
}

export interface RemoteState {
  goals: Goal[];
  templates: Template[];
  members: TeamMember[];
  projects: Project[];
}

export function fetchState(): Promise<RemoteState> {
  return request<RemoteState>("/state");
}

export function syncGoals(goals: Goal[]): Promise<void> {
  return request("/goals", { method: "PUT", body: JSON.stringify({ goals }) });
}

// The server may reuse an existing team_member id instead of the client's
// freshly-generated one (e.g. re-adding someone by the same email after
// removal), so it returns the authoritative post-sync list.
export function syncMembers(members: TeamMember[]): Promise<TeamMember[]> {
  return request<{ members: TeamMember[] }>("/team-members", {
    method: "PUT",
    body: JSON.stringify({ members }),
  }).then((res) => res.members);
}

export function syncProjects(projects: Project[]): Promise<void> {
  return request("/projects", { method: "PUT", body: JSON.stringify({ projects }) });
}

export function syncTemplates(templates: Template[]): Promise<void> {
  return request("/templates", { method: "PUT", body: JSON.stringify({ templates }) });
}

// --- Tasks other people assigned to me ---

export interface AssignedChecklistItem {
  id: string;
  text: string;
  notes: string;
  done: boolean;
  startedAt: string | null;
  accumulatedMs: number;
  timerPaused: boolean;
}

export interface AssignedGoal {
  id: string;
  name: string;
  requirements: string;
  notes: string;
  priority: Priority;
  progress: number;
  autoProgress: boolean;
  status: Status;
  deadline: string | null;
  tag: string;
  color: string;
  startedAt: string | null;
  accumulatedMs: number;
  timerPaused: boolean;
  ownerName: string;
  projectName: string | null;
  projectColor: string | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  checklist: AssignedChecklistItem[];
}

export function fetchAssignedToMe(): Promise<{ goals: AssignedGoal[] }> {
  return request("/assigned-to-me");
}

export interface AssignedGoalPatch {
  status?: Status;
  progress?: number;
  notes?: string;
  startedAt?: string | null;
  accumulatedMs?: number;
  timerPaused?: boolean;
}

export function updateAssignedGoal(goalId: string, patch: AssignedGoalPatch): Promise<void> {
  return request(`/assigned-to-me/${goalId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export interface AssignedChecklistPatch {
  done?: boolean;
  notes?: string;
  startedAt?: string | null;
  accumulatedMs?: number;
  timerPaused?: boolean;
}

export function updateAssignedChecklistItem(
  goalId: string,
  itemId: string,
  patch: AssignedChecklistPatch,
): Promise<void> {
  return request(`/assigned-to-me/${goalId}/checklist/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export { ApiError };

// --- Inviting people to collaborate on one specific project ---

export function inviteToProject(projectId: string, email: string): Promise<void> {
  return request(`/projects/${projectId}/invite`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export interface ProjectCollaboratorInfo {
  id: number;
  name: string;
  email: string;
}

export interface ProjectInvitationInfo {
  id: string;
  projectId: string;
  inviteeEmail: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

export function fetchProjectInvitations(
  projectId: string,
): Promise<{ collaborators: ProjectCollaboratorInfo[]; invitations: ProjectInvitationInfo[] }> {
  return request(`/projects/${projectId}/invitations`);
}

export function removeProjectCollaborator(projectId: string, userId: number): Promise<void> {
  return request(`/projects/${projectId}/collaborators/${userId}`, { method: "DELETE" });
}

export interface MyInvitation {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  inviterName: string;
  createdAt: string;
}

export function fetchMyInvitations(): Promise<{ invitations: MyInvitation[] }> {
  return request("/invitations");
}

export function acceptInvitation(invitationId: string): Promise<void> {
  return request(`/invitations/${invitationId}/accept`, { method: "POST" });
}

export function declineInvitation(invitationId: string): Promise<void> {
  return request(`/invitations/${invitationId}/decline`, { method: "POST" });
}

// --- Projects someone else invited me into ---

export interface SharedProjectChecklistItem {
  id: string;
  text: string;
  notes: string;
  done: boolean;
  images: string[];
  startedAt: string | null;
  accumulatedMs: number;
  timerPaused: boolean;
}

export interface SharedProjectGoal {
  id: string;
  parentId: string | null;
  name: string;
  requirements: string;
  notes: string;
  assignedTo: string;
  priority: Priority;
  progress: number;
  autoProgress: boolean;
  status: Status;
  deadline: string | null;
  tag: string;
  color: string;
  startedAt: string | null;
  accumulatedMs: number;
  timerPaused: boolean;
  createdAt: string;
  updatedAt: string;
  checklist: SharedProjectChecklistItem[];
}

export interface SharedProjectMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface SharedProject {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerName: string;
  goals: SharedProjectGoal[];
  members: SharedProjectMember[];
  myMemberId: string | null;
  sequentialLock: boolean;
}

/** Walks up to the top-level stage a goal belongs to. */
export function findSharedStage(project: SharedProject, goal: SharedProjectGoal): SharedProjectGoal {
  const byId = new Map(project.goals.map((g) => [g.id, g]));
  let current = goal;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

/** Same rule as the backend (SharedProjectController::assertStageUnlocked):
 * a stage is locked if the project has sequential locking on and the
 * stage right before it isn't Completed yet. */
export function isSharedStageLocked(project: SharedProject, stage: SharedProjectGoal): boolean {
  if (!project.sequentialLock) return false;
  const topLevel = project.goals.filter((g) => !g.parentId);
  const index = topLevel.findIndex((g) => g.id === stage.id);
  if (index <= 0) return false;
  return topLevel[index - 1].status !== "Completed";
}

export function fetchSharedProjects(): Promise<{ projects: SharedProject[] }> {
  return request("/shared-projects");
}

export function updateSharedGoal(
  projectId: string,
  goalId: string,
  patch: AssignedGoalPatch,
): Promise<void> {
  return request(`/shared-projects/${projectId}/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface SharedChecklistPatch {
  done?: boolean;
  notes?: string;
  images?: string[];
  startedAt?: string | null;
  accumulatedMs?: number;
  timerPaused?: boolean;
}

export function updateSharedChecklistItem(
  projectId: string,
  goalId: string,
  itemId: string,
  patch: SharedChecklistPatch,
): Promise<void> {
  return request(`/shared-projects/${projectId}/goals/${goalId}/checklist/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function createSharedChecklistItem(
  projectId: string,
  goalId: string,
  text: string,
): Promise<{ item: SharedProjectChecklistItem }> {
  return request(`/shared-projects/${projectId}/goals/${goalId}/checklist`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function deleteSharedChecklistItem(projectId: string, goalId: string, itemId: string): Promise<void> {
  return request(`/shared-projects/${projectId}/goals/${goalId}/checklist/${itemId}`, {
    method: "DELETE",
  });
}
