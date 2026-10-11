"use client";

import { createContext, useContext } from "react";
import type { Model } from "@/lib/model";
import type { Plan } from "@/lib/planner";
import type { PlanIndex } from "@/lib/schedule";
import type { Change, FeedResult, FeedRole, Snapshot, Task, Workspace } from "@/lib/types";
import type { Filters } from "@/lib/ui";

export type View = "plan" | "calendar" | "upcoming" | "classes" | "settings" | "help";
export type CalMode = "month" | "week" | "day";
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
 * The prototype is drawn as a grayscale wireframe, so every class and calendar
 * colour is shown as a grey of the same lightness. Classes keep distinct shades,
 * and the colour each one is saved with is untouched, so a full-colour design can
 * come back by returning `color` unchanged here.
 */
export function wireGray(color: string | undefined | null): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((color ?? "").trim());
  if (!m) return color && color.startsWith("var(") ? color : "#6b6b6b";
  const n = parseInt(m[1], 16);
  const y = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  const h = Math.min(255, Math.max(0, y)).toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

export function courseStyle(color: string | undefined | null): React.CSSProperties {
  return { "--c": wireGray(color ?? "#64748b") } as React.CSSProperties;
}
