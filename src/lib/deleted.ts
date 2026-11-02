import { repeats, seriesKey } from "./eventColors";
import type { CalEvent } from "./types";

/**
 * Events and work the student deleted. Calendar links are read-only, so a
 * deletion lives here, in Schedule Smart: the event or task leaves the app, its
 * time is free for the planner, and the calendar it came from keeps it. Each can
 * be put back from Settings.
 */

/**
 * Deleted events. An entry is either one event, by id, with the start time its
 * calendar gave it, or every event of a series, by series key, with `ALL`. A
 * single event its calendar later moves no longer matches and shows again, so a
 * deletion never hides a time the student hasn't seen.
 */
export type DeletedEvents = Record<string, string>;
export const ALL = "all";

/** Deleted work: task id -> when it was deleted. */
export type DeletedTasks = Record<string, string>;

function isDeleted(e: Pick<CalEvent, "id" | "start">, deleted: DeletedEvents): boolean {
  return deleted[e.id] === e.start || (repeats(e.id) && deleted[seriesKey(e.id)] === ALL);
}

/** Events without the deleted ones. Takes events at their calendar times, before moves. */
export function withoutDeleted<T extends Pick<CalEvent, "id" | "start">>(events: T[], deleted: DeletedEvents): T[] {
  if (Object.keys(deleted).length === 0) return events;
  return events.filter((e) => !isDeleted(e, deleted));
}

/** The deleted events, split into single ones and whole series (one event standing for each series). */
export function deletedOnes<T extends Pick<CalEvent, "id" | "start">>(events: T[], deleted: DeletedEvents): { event: T; key: string; all: boolean }[] {
  const out: { event: T; key: string; all: boolean }[] = [];
  const series = new Set<string>();
  for (const e of events) {
    if (repeats(e.id) && deleted[seriesKey(e.id)] === ALL) {
      if (series.has(seriesKey(e.id))) continue;
      series.add(seriesKey(e.id));
      out.push({ event: e, key: seriesKey(e.id), all: true });
    } else if (deleted[e.id] === e.start) out.push({ event: e, key: e.id, all: false });
  }
  return out;
}

/**
 * The deletions after deleting `event`: just this one, or every one of its
 * series. A moved event is deleted at its calendar time.
 */
export function deleteEvent(deleted: DeletedEvents, event: Pick<CalEvent, "id" | "start" | "original">, scope: "one" | "all" = "one"): DeletedEvents {
  if (scope === "all" && repeats(event.id)) return { ...deleted, [seriesKey(event.id)]: ALL };
  return { ...deleted, [event.id]: event.original?.start ?? event.start };
}

/** The most kept of each. Old single events go first; they are long past by then. */
export const MAX_DELETED = 500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const okKey = (k: string) => k.length > 0 && k.length <= 400;

/** Keeps only well-formed entries: whole series first, then the newest single events. */
export function sanitizeDeletedEvents(raw: unknown): DeletedEvents {
  if (!isObj(raw)) return {};
  const entries = Object.entries(raw).filter((e): e is [string, string] => okKey(e[0]) && typeof e[1] === "string" && (e[1] === ALL || Number.isFinite(Date.parse(e[1]))));
  const all = entries.filter(([, v]) => v === ALL);
  const single = entries.filter(([, v]) => v !== ALL).sort((a, b) => b[1].localeCompare(a[1]));
  return Object.fromEntries([...all, ...single].slice(0, MAX_DELETED));
}

/** Keeps only well-formed entries, the most recently deleted when there are too many. */
export function sanitizeDeletedTasks(raw: unknown): DeletedTasks {
  if (!isObj(raw)) return {};
  const entries = Object.entries(raw).filter((e): e is [string, string] => okKey(e[0]) && typeof e[1] === "string" && Number.isFinite(Date.parse(e[1])));
  return Object.fromEntries(entries.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_DELETED));
}
