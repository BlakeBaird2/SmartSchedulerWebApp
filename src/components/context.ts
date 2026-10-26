"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Model } from "@/lib/model";
import type { Plan } from "@/lib/planner";
import type { PlanIndex } from "@/lib/schedule";
import type { Change, FeedResult, FeedRole, Snapshot, Task, Workspace } from "@/lib/types";
import type { Filters } from "@/lib/ui";

export type View = "plan" | "calendar" | "upcoming" | "settings" | "help";
/** "schedule" (an agenda list) and "3day" are the phone views, as in Google Calendar's app. */
export type CalMode = "month" | "week" | "day" | "3day" | "schedule";
/** Settings hub and focused sub-pages (reachable from Settings and Help). */
export type SettingsPanel = "main" | "calendars" | "schedule" | "estimates" | "browser" | "about";
export type Selection =
  | { kind: "task"; id: string }
  | { kind: "event"; id: string }
  /** Free-time gap on the plan, identified by a time inside the gap. */
  | { kind: "gap"; startMs: number }
  /** Why this task was planned into free time. */
  | { kind: "why"; id: string }
  /** Short success state after marking a task done toward the prototype goal. */
  | { kind: "completed"; id: string }
  | null;

export interface AppContextValue {
  ws: Workspace;
  snapshot: Snapshot;
  model: Model;
  plan: Plan;
  index: PlanIndex;
  changes: Change[];
  now: Date;
  timezone: string;

  update: (fn: (ws: Workspace) => Workspace) => void;
  toggleDone: (task: Task) => void;
  setEstimate: (taskId: string, minutes: number | null) => void;
  /**
   * Put a task at a time of the student's choosing (dragged onto the calendar or
   * picked in its details), or pass null to let SmartScheduler choose again.
   */
  planAt: (task: Task, start: Date | null) => void;

  /** Returns how many already-past items were marked done. */
  addFeed: (result: FeedResult) => number;
  removeFeed: (id: string) => void;
  setFeedRole: (id: string, role: FeedRole) => void;
  syncing: boolean;
  sync: () => Promise<void>;

  view: View;
  setView: (v: View) => void;
  settingsPanel: SettingsPanel;
  setSettingsPanel: (p: SettingsPanel) => void;
  calMode: CalMode;
  setCalMode: (m: CalMode) => void;
  calSidebar: boolean;
  setCalSidebar: (open: boolean) => void;
  /** Reopen the goal-setting instructions (same dialog as after the prototype notice). */
  openGoal: () => void;
  /** Mark done and optionally show the completion success panel. */
  completeTask: (task: Task, opts?: { celebrate?: boolean }) => void;
  calCursor: Date;
  setCalCursor: (d: Date) => void;
  /** Which day of the plan is open, as an offset from today. */
  planDay: number;
  setPlanDay: (i: number) => void;
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;

  selected: Selection;
  select: (s: Selection) => void;
  /** Open a task on the day it is planned or due. */
  reveal: (taskId: string) => void;
  openAddTask: () => void;
  openClassTimes: () => void;
  /** Whether the "add your class times" suggestion was dismissed. */
  classTimesTipHidden: boolean;
  hideClassTimesTip: () => void;
  clearChanges: () => void;
  /** Confirm what just happened. Pass `undo` when the action can be taken back; the message then offers Undo. */
  toast: (message: string, options?: { undo?: () => void }) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside App");
  return ctx;
}

/**
 * The colour a class or calendar is drawn in. The low-fidelity version turned
 * every colour into a grey; with more fidelity, classes get their real colours
 * back so each one is easy to follow across screens (Gestalt: similarity).
 * (Named for its old job so existing callers keep working.)
 */
export function wireGray(color: string | undefined | null): string {
  return color && color.trim() ? color : "#64748b";
}

export function courseStyle(color: string | undefined | null): React.CSSProperties {
  return { "--c": wireGray(color ?? "#64748b") } as React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Phone or not
// ---------------------------------------------------------------------------

const PHONE_QUERY = "(max-width: 767px)";

function subscribePhone(onChange: () => void) {
  const m = window.matchMedia(PHONE_QUERY);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/** True below 768px, where screens get their phone layout (bottom bar, agenda calendar, stacked classes). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
