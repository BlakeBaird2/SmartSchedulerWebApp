/**
 * Work that showed up since the student last looked. It says "New" on the to-do
 * list until they open it, schedule it, tick it off or change its estimate.
 *
 * Only work added to a class calendar after that calendar was first read counts,
 * by the same rules as the bell (see changes.ts): a calendar's first read, a
 * class appearing all at once, and study time SmartScheduler adds itself are
 * never new.
 */
import type { Change } from "./types";

/** taskId -> when it showed up. */
export type NewWork = Record<string, string>;

/** "New" fades on its own after two weeks, seen or not. */
export const NEW_RETENTION = 14 * 86_400_000;
export const MAX_NEW = 200;

const ISO_OK = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export function parseNewWork(raw: string | null): NewWork {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const out: NewWork = {};
    for (const [id, at] of Object.entries(value)) if (id && ISO_OK(at)) out[id] = at;
    return out;
  } catch {
    return {};
  }
}

/** Only the last two weeks, newest kept when there are too many. */
function trim(work: NewWork, now: Date): NewWork {
  const cutoff = now.getTime() - NEW_RETENTION;
  const kept = Object.entries(work)
    .filter(([, at]) => Date.parse(at) >= cutoff)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, MAX_NEW);
  return Object.fromEntries(kept);
}

/** Add the work a sync found added. Work already marked keeps when it first showed up. */
export function addNewWork(work: NewWork, changes: Change[], now: Date): NewWork {
  const next = { ...work };
  for (const c of changes) if (c.kind === "added" && !next[c.taskId]) next[c.taskId] = c.at;
  return trim(next, now);
}

/** The student has seen these. */
export function seeWork(work: NewWork, ids: string[]): NewWork {
  const next = { ...work };
  for (const id of ids) delete next[id];
  return next;
}

/** Which of these tasks are new, and still recent enough to say so. */
export function newIds(work: NewWork, now: Date): Set<string> {
  return new Set(Object.keys(trim(work, now)));
}
