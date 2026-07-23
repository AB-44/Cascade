export type Priority = "High" | "Medium" | "Low";
export type Status = "Not Started" | "In Progress" | "Completed";

export interface TimeSession {
  id: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  durationMs: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  image?: string | null; // data URL (legacy, kept for backward compatibility)
  images?: string[]; // data URLs - multiple images per task item
  notes?: string; // free-form notes, typically jotted down once the step is done
  startedAt?: string | null; // ISO datetime - focus timer running segment start
  accumulatedMs?: number; // total focus time accumulated on this item, in ms
  timerPaused?: boolean; // true if the focus timer was started then paused
}

export interface Goal {
  id: string;
  parentId: string | null;
  roadmapOwnerId?: string | null;
  projectId?: string | null;
  name: string;
  requirements: string;
  notes: string;
  assignedTo: string;
  priority: Priority;
  progress: number; // 0-100
  autoProgress: boolean; // if true, calculated from children/checklist
  deadline: string | null; // ISO date
  startDate: string | null; // ISO date - planned/scheduled start (not the timer's startedAt)
  reminder: boolean;
  reminderAt: string | null; // ISO datetime
  reminderFired?: boolean;
  startedAt: string | null; // ISO datetime - when the current running segment began (null if not running)
  accumulatedMs?: number; // total elapsed time from previous running segments, in ms
  timerPaused?: boolean; // true if the timer was started before but is currently paused
  estimatedMs?: number | null; // target/estimated duration for this task, in ms
  estimatedTargetFired?: boolean; // whether the "target reached" prompt already fired for the current run
  timeSessions?: TimeSession[]; // log of completed work sessions for reporting
  breakReminderFired?: boolean; // whether the 1-hour break reminder already fired
  status: Status;
  checklist: ChecklistItem[];
  tag: string;
  color: string;
  dependsOn: string[];
  archived: boolean;
  templateId: string | null;
  order: number;
  collapsed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  // a snapshot subtree: list of goal-like nodes with relative parent refs
  nodes: TemplateNode[];
  createdAt: string;
}

export interface TemplateNode {
  tempId: string;
  parentTempId: string | null;
  name: string;
  requirements: string;
  notes: string;
  priority: Priority;
  tag: string;
  color: string;
  checklist: { text: string; done: boolean }[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string; // data URL or empty
  color: string;
  createdAt: string;
  /** If this member's email matches a registered account, that account's
   *  own profile photo/color — takes priority over `avatar`/`color` so the
   *  person's real profile picture shows up everywhere they're referenced. */
  linkedAvatar?: string | null;
  linkedAvatarColor?: string | null;
  /** True once this member's email matches a registered Cascade account. */
  hasAccount?: boolean;
  /** True if this row was auto-created because the person accepted an
   *  invite to one of your projects, rather than being someone you added
   *  yourself as a regular teammate. Server-controlled — the client can't
   *  set or change this. */
  joinedViaProject?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  memberIds: string[]; // Team members associated with this project
  sequentialLock: boolean; // lock stage N+1 until stage N is Completed
  createdAt: string;
}

export interface AppState {
  goals: Goal[];
  templates: Template[];
  members: TeamMember[];
  projects: Project[];
  darkMode: boolean;
  view: "tree" | "roadmap" | "dashboard";
}
