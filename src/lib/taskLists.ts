/**
 * Split view on Tasks: several lists side by side, each with its own name and
 * filters, such as "School, the next 7 days" next to "Life, what's planned".
 *
 * A list picks which work it shows by area: every class ("school"), one class
 * by its id, or work that isn't a class's ("personal"). It can stop a set number
 * of days ahead: planned work counts by when it's planned, other work by when
 * it's due. Late work and work with no date always show.
 */
import { isSchoolWork, windowEnd } from "./todos";
import type { Task } from "./types";

export type ListShow = "planned" | "unplanned" | "all";

export interface TaskListConfig {
  id: string;
  name: string;
  show: ListShow;
  /** null for everything; otherwise "school", "personal" and class ids. */
  areas: string[] | null;
  /** How many days ahead, counting today, or null for any time. */
  days: number | null;
  /** The list's colour, or null for the one its place gives it. */
  color: string | null;
}

/**
 * Each list's colour, so lists side by side are easy to tell apart. A list
 * takes the one for its place unless another is picked.
 */
export const LIST_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777"];

/** The colour a list shows: the one picked, or the one for its place. */
export function listColor(list: TaskListConfig, index: number): string {
  return list.color ?? LIST_COLORS[index % LIST_COLORS.length];
}

/** Room for this many lists side by side, and no more, to keep them easy to read. */
export const MAX_LISTS = 4;
/** How far ahead a list can look. */
export const LIST_WINDOWS: (number | null)[] = [7, 14, 30, null];

const SHOWS: ListShow[] = ["planned", "unplanned", "all"];

/** What split view starts with: school work for the week, and life's plan for the week. */
export const DEFAULT_LISTS: TaskListConfig[] = [
  { id: "school", name: "School", show: "all", areas: ["school"], days: 7, color: null },
  { id: "life", name: "Life", show: "planned", areas: ["personal"], days: 7, color: null },
];

/** A new list: everything for the week, with a name not already taken. */
export function newList(lists: TaskListConfig[], id: string): TaskListConfig {
  const names = new Set(lists.map((l) => l.name.trim().toLowerCase()));
  let n = lists.length + 1;
  while (names.has(`list ${n}`)) n++;
  return { id, name: `List ${n}`, show: "all", areas: null, days: 7, color: null };
}

/** Lists as stored, checked: anything damaged is dropped, and there are never more than the cap. */
export function parseLists(raw: unknown): TaskListConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_LISTS;
  const out: TaskListConfig[] = [];
  const ids = new Set<string>();
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const { id, name, show, areas, days, color } = l as Partial<TaskListConfig>;
    if (typeof id !== "string" || !id || ids.has(id)) continue;
    ids.add(id);
    out.push({
      id,
      name: typeof name === "string" ? name.slice(0, 40) : "List",
      show: SHOWS.includes(show as ListShow) ? (show as ListShow) : "all",
      areas: Array.isArray(areas) && areas.length && areas.every((a) => typeof a === "string") ? areas : null,
      days: days === null || LIST_WINDOWS.includes(days as number) ? (days as number | null) : 7,
      color: typeof color === "string" && LIST_COLORS.includes(color) ? color : null,
    });
    if (out.length === MAX_LISTS) break;
  }
  return out.length ? out : DEFAULT_LISTS;
}

/** The area a piece of work belongs to: its class, or "personal". */
export function areaOf(task: Task): string {
  return isSchoolWork(task) && task.courseId ? task.courseId : "personal";
}

/** Whether a list that shows `areas` includes this work. */
export function inAreas(areas: string[] | null, task: Task): boolean {
  if (!areas) return true;
  if (areas.includes(areaOf(task))) return true;
  return areas.includes("school") && isSchoolWork(task) && task.courseId !== null;
}

/**
 * Whether work is in a list's days: planned work by when it's next planned,
 * other work by when it's due. Anything before today (missed or late) and
 * anything with no date always is.
 */
export function inDays(when: string | null, now: Date, days: number | null): boolean {
  if (days === null || !when) return true;
  return Date.parse(when) < windowEnd(now, days).getTime();
}
