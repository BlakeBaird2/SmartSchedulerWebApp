"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Model } from "@/lib/model";
import type { Plan } from "@/lib/planner";
import type { PlanIndex } from "@/lib/schedule";
import type { Change, EstimateSource, FeedResult, FeedRole, Priority, Snapshot, Task, Workspace } from "@/lib/types";
import type { Filters } from "@/lib/ui";
import type { TodoScope, TodoSort } from "@/lib/todos";

/** The two main views of the prototype, plus Settings and Help from the profile menu. */
export type View = "calendar" | "tasks" | "due" | "settings" | "help";
/** On phones "week" shows three days at a time (one beside the open planner), as in the prototype. */
export type CalMode = "month" | "week" | "day";
/** Settings hub and focused sub-pages (reachable from Settings and Help). */
export type SettingsPanel = "main" | "calendars" | "classes" | "schedule" | "estimates" | "browser" | "about";
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
  /** Tasks added to a class calendar since the student last looked: "New" until opened or acted on. */
  newWork: Set<string>;
  now: Date;
  timezone: string;

  update: (fn: (ws: Workspace) => Workspace) => void;
  toggleDone: (task: Task) => void;
  /** Set a task's points or priority; undefined leaves that one as it was, null clears it. */
  setTaskMeta: (taskId: string, patch: { points?: number | null; priority?: Priority | null }) => void;
  /** Set how long a task needs (null goes back to the default for its kind). */
  setEstimate: (taskId: string, minutes: number | null, source?: EstimateSource) => void;
  /** Put a task on the calendar at `start`, for as long as it's expected to take. */
  scheduleTask: (task: Task, start: Date) => void;
  /** Put a task into a day's first free time that fits it (noon if none does): a drop on the month. */
  scheduleOnDay: (task: Task, day: Date) => void;
  /** Move scheduled time to a new start, keeping its length. */
  moveScheduled: (blockId: string, start: Date) => void;
  /** Change when scheduled time ends. */
  resizeScheduled: (blockId: string, end: Date) => void;
  /** Take scheduled time off the calendar; its work goes back on the to-do list. */
  unschedule: (blockId: string) => void;
  /** Answer "put this unfinished work back on the to-do list?" for these tasks. */
  answerUnfinished: (taskIds: string[], back: boolean) => void;

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
  /** Due dates: a day, a week (the default) or a month. */
  dueMode: CalMode;
  setDueMode: (m: CalMode) => void;
  calSidebar: boolean;
  /** The to-do list: everything, or school work only. */
  todoScope: TodoScope;
  setTodoScope: (scope: TodoScope) => void;
  /** The to-do list's order: most urgent first, or shortest first. */
  todoSort: TodoSort;
  setTodoSort: (sort: TodoSort) => void;
  setCalSidebar: (open: boolean) => void;
  /** Whether the planner lists up to 15 tasks rather than 5. */
  plannerMore: boolean;
  setPlannerMore: (more: boolean) => void;
  /** Whether the planner's filters (order, class, how many) are open or folded to one line. */
  plannerFilters: boolean;
  setPlannerFilters: (open: boolean) => void;
  /** Reopen the goal-setting instructions (same dialog as after the prototype notice). */
  openGoal: () => void;
  /** Mark done and optionally show the completion success panel. */
  completeTask: (task: Task, opts?: { celebrate?: boolean }) => void;
  calCursor: Date;
  setCalCursor: (d: Date) => void;
  /** Which day of the plan is open, as an offset from today. */
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;

  selected: Selection;
  select: (s: Selection) => void;
  /** Open a task on the day it is planned or due. */
  reveal: (taskId: string) => void;
  openAddTask: () => void;
  openClassTimes: () => void;
  /** Choose which classes from one school calendar (or all of them) are the student's. */
  openClassPicker: (feedId?: string | null) => void;
  /** Whether the "add your class times" suggestion was dismissed. */
  classTimesTipHidden: boolean;
  hideClassTimesTip: () => void;
  clearChanges: () => void;
  /** The student has seen these tasks, so they stop saying "New". */
  seeWork: (taskIds: string[]) => void;
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
