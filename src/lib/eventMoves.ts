import type { CalEvent } from "./types";

/**
 * Events the student dragged to another time. Calendar links are read-only, so a
 * move lives here, in Schedule Smart, and the calendar it came from keeps its own
 * time. Each move remembers when the calendar has the event (`from`–`fromEnd`):
 * if the calendar itself changes the event later, the move no longer matches and
 * the calendar's new time wins.
 */
export interface EventMove {
  /** When the calendar has it. */
  from: string;
  fromEnd: string;
  /** When the student put it. */
  start: string;
  end: string;
}

export type EventMoves = Record<string, EventMove>;

/** Events with the student's moves applied. A moved event keeps its calendar time in `original`. */
export function applyEventMoves(events: CalEvent[], moves: EventMoves): CalEvent[] {
  if (Object.keys(moves).length === 0) return events;
  return events.map((e) => {
    const m = moves[e.id];
    if (!m || e.allDay || m.from !== e.start || m.fromEnd !== e.end) return e;
    return { ...e, start: m.start, end: m.end, original: { start: e.start, end: e.end } };
  });
}

/** The moves after putting `event` at `start`–`end`. Back at its calendar time, it has no move. */
export function withEventAt(moves: EventMoves, event: CalEvent, start: Date, end: Date): EventMoves {
  const original = event.original ?? { start: event.start, end: event.end };
  const next = { ...moves };
  if (start.getTime() === Date.parse(original.start) && end.getTime() === Date.parse(original.end)) delete next[event.id];
  else next[event.id] = { from: original.start, fromEnd: original.end, start: start.toISOString(), end: end.toISOString() };
  return next;
}

/** Keeps only well-formed moves, so a damaged entry never breaks the calendar. */
export function sanitizeEventMoves(raw: unknown): EventMoves {
  const out: EventMoves = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 500)) {
    if (!v || typeof v !== "object") continue;
    const { from, fromEnd, start, end } = v as Record<string, unknown>;
    if (typeof from !== "string" || typeof fromEnd !== "string" || typeof start !== "string" || typeof end !== "string") continue;
    if ([from, fromEnd, start, end].some((x) => Number.isNaN(Date.parse(x))) || Date.parse(end) <= Date.parse(start)) continue;
    out[id] = { from, fromEnd, start, end };
  }
  return out;
}
