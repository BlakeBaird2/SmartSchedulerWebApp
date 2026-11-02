import type { CalEvent } from "./types";

/**
 * Single events the student cancelled, such as one class that isn't meeting
 * today. Calendar links are read-only, so the cancellation lives here, in
 * Schedule Smart: the event leaves the calendar and its time is free for the
 * planner. Each entry is the event's id and the start time its calendar gave
 * it. If the calendar later moves that event, it no longer matches and shows
 * again, so a cancellation never hides a time the student hasn't seen.
 *
 * Weekly times entered in Schedule Smart are cancelled with their own `skip`
 * dates instead (see WeeklyBlock).
 */
export type CancelledEvents = Record<string, string>;

/** Events without the ones the student cancelled. Takes events at their calendar times, before moves. */
export function withoutCancelled<T extends Pick<CalEvent, "id" | "start">>(events: T[], cancelled: CancelledEvents): T[] {
  if (Object.keys(cancelled).length === 0) return events;
  return events.filter((e) => cancelled[e.id] !== e.start);
}

/** The cancellations after cancelling `event`. A moved event is cancelled at its calendar time. */
export function cancelEvent(cancelled: CancelledEvents, event: Pick<CalEvent, "id" | "start" | "original">): CancelledEvents {
  return { ...cancelled, [event.id]: event.original?.start ?? event.start };
}

/** The most kept. Old ones go first; they are long past by then. */
export const MAX_CANCELLED = 500;

/** Keeps only well-formed entries, newest kept when there are too many. */
export function sanitizeCancelled(raw: unknown): CancelledEvents {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const kept = Object.entries(raw as Record<string, unknown>).filter(
    (e): e is [string, string] => e[0].length > 0 && e[0].length <= 400 && typeof e[1] === "string" && Number.isFinite(Date.parse(e[1])),
  );
  return Object.fromEntries(kept.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_CANCELLED));
}
