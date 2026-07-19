import { useEffect, useMemo } from "react";
import { useStore } from "../store";
import { deadlineState } from "./goals";
import type { Goal } from "../types";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export interface ReminderItem {
  goal: Goal;
  kind: "overdue" | "today" | "soon" | "reminder" | "break";
  text: string;
}

const reminderPrefix = (lang: Lang) => (lang === "ar" ? "تذكير: " : "Reminder: ");
const overdueText = (lang: Lang, name: string) =>
  lang === "ar" ? `${name} متأخر` : `${name} is overdue`;
const todayText = (lang: Lang, name: string) =>
  lang === "ar" ? `${name} يستحق اليوم` : `${name} is due today`;
const soonText = (lang: Lang, name: string) =>
  lang === "ar" ? `${name} يستحق قريبًا` : `${name} is due soon`;
const breakText = (lang: Lang, name: string) =>
  lang === "ar"
    ? `لقد مضت ساعة على بدء "${name}" — وقت أخذ استراحة قصيرة`
    : `It's been an hour on "${name}" — time for a short break`;

const ONE_HOUR_MS = 60 * 60 * 1000;

function totalElapsedMs(g: Goal, now: number): number {
  const accumulated = g.accumulatedMs ?? 0;
  return accumulated + (g.startedAt ? now - new Date(g.startedAt).getTime() : 0);
}

export function useReminders() {
  const { goals, updateGoal, lang } = useStore();

  const items = useMemo<ReminderItem[]>(() => {
    const out: ReminderItem[] = [];
    const now = Date.now();
    for (const g of goals) {
      if (g.archived || g.status === "Completed") continue;
      const ds = deadlineState(g.deadline, g.status);
      if (ds === "overdue") out.push({ goal: g, kind: "overdue", text: overdueText(lang, g.name) });
      else if (ds === "today") out.push({ goal: g, kind: "today", text: todayText(lang, g.name) });
      else if (ds === "soon") out.push({ goal: g, kind: "soon", text: soonText(lang, g.name) });
      if (g.reminder && g.reminderAt && new Date(g.reminderAt).getTime() <= now) {
        out.push({ goal: g, kind: "reminder", text: reminderPrefix(lang) + g.name });
      }
      if (
        g.startedAt &&
        !g.breakReminderFired &&
        totalElapsedMs(g, now) >= ONE_HOUR_MS
      ) {
        out.push({ goal: g, kind: "break", text: breakText(lang, g.name) });
      }
    }
    return out;
  }, [goals, lang]);

  // fire browser notifications for due reminders not yet fired
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const now = Date.now();
    for (const g of goals) {
      if (g.reminder && g.reminderAt && !g.reminderFired && new Date(g.reminderAt).getTime() <= now) {
        try {
          new Notification(t(lang, "appTitle"), { body: g.name });
        } catch {
          /* noop */
        }
        updateGoal(g.id, { reminderFired: true });
      }
      if (
        g.startedAt &&
        !g.breakReminderFired &&
        !g.archived &&
        g.status !== "Completed" &&
        totalElapsedMs(g, now) >= ONE_HOUR_MS
      ) {
        try {
          new Notification(t(lang, "appTitle"), { body: breakText(lang, g.name) });
        } catch {
          /* noop */
        }
        updateGoal(g.id, { breakReminderFired: true });
      }
    }
  }, [goals, updateGoal, lang]);

  // poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const g of goals) {
        if (g.reminder && g.reminderAt && !g.reminderFired && new Date(g.reminderAt).getTime() <= now) {
          updateGoal(g.id, {});
          break;
        }
        if (
          g.startedAt &&
          !g.breakReminderFired &&
          !g.archived &&
          g.status !== "Completed" &&
          totalElapsedMs(g, now) >= ONE_HOUR_MS
        ) {
          updateGoal(g.id, {});
          break;
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [goals, updateGoal]);

  return items;
}

export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}
