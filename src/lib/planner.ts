/**
 * SmartScheduler's plan builder: find free gaps, then fill them by soonest deadline.
 *
 * Two steps, both deliberately simple so the result is easy to trust:
 *
 * 1. Find the gaps. Each day has a working window (say 8am to 10pm). Busy events,
 *    padded by a small buffer for travel and breathing room, are cut out of it.
 *    Whatever is left, and long enough to be useful, is free time.
 *
 * 2. Fill the gaps, earliest deadline first. Walking through the gaps in order,
 *    each slot goes to the most urgent unfinished task that fits in it. If the most
 *    urgent task does not fit (a 60 minute quiz in a 30 minute gap), the slot goes
 *    to the next task that does, so short gaps still get used. Long work can be
 *    split across gaps; quizzes and short tasks are never split. Nothing is placed
 *    after its own due time.
 *
 * Work the student put at a time themselves (by dragging it onto the calendar)
 * is "pinned": it stays exactly there, that time stops being free, and the rest
 * is planned around it. A pinned time that has already passed is let go, so the
 * task is planned again instead of being lost.
 *
 * Earliest-deadline-first is the classic answer to "what should I do now so that
 * nothing is late", and it is predictable: the plan never reshuffles for reasons
 * a person could not explain.
 *
 * Everything here uses the runtime's local time, which in the browser is the
 * student's own timezone.
 */
import type { AssignmentType, PlanPrefs } from "./types";

export const MIN_CHUNK = 25; // shortest piece of a split task worth sitting down for
const SPLIT_THRESHOLD = 50; // tasks shorter than this are done in one sitting
const SLOT = 5; // plans snap to five minute marks
const OVERDUE_GRACE_DAYS = 7; // late work older than this is left out of the plan
const MINUTE = 60_000;
const DAY = 86_400_000;

export interface PlanTask {
  id: string;
  title: string;
  type: AssignmentType;
  dueAt: Date | null;
  /** Minutes still needed. */
  estimate: number;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface Gap {
  start: Date;
  end: Date;
  minutes: number;
}

export interface PlannedBlock {
  taskId: string;
  start: Date;
  end: Date;
  minutes: number;
  /** 1-based piece number when a task is split across several blocks. */
  part: number;
  parts: number;
  /** Put at this time by the student, rather than chosen by the planner. */
  pinned?: boolean;
}

export interface DayPlan {
  /** Local midnight. */
  date: Date;
  /** Whether work is planned on this day at all. */
  working: boolean;
  gaps: Gap[];
  blocks: PlannedBlock[];
  freeMinutes: number;
  plannedMinutes: number;
}

export interface AtRisk {
  taskId: string;
  dueAt: Date | null;
  /** Minutes that could not be fitted before the due time. */
  shortBy: number;
  planned: number;
  overdue: boolean;
}

export interface Plan {
  days: DayPlan[];
  /** Unfinished work that will not fit before it is due, most urgent first. */
  atRisk: AtRisk[];
  /** Task ids in the order the planner considered them. */
  order: string[];
  /** Minutes planned for each task. */
  planned: Record<string, number>;
  /** Free minutes across the whole horizon. */
  freeMinutes: number;
  /** Minutes of work due inside the horizon, including recent overdue work. */
  dueMinutes: number;
}

export interface PlanInput {
  now: Date;
  tasks: PlanTask[];
  busy: BusyInterval[];
  prefs: PlanPrefs;
  /** How many days to plan, starting today. */
  days: number;
  /** taskId -> when the student chose to start it. */
  pins?: Record<string, Date>;
}

/** Higher runs first when two things are due at the same moment. */
const TYPE_WEIGHT: Record<AssignmentType, number> = { exam: 5, project: 4, quiz: 3, assignment: 2, reading: 1 };

const floorTo = (ms: number) => Math.floor(ms / (SLOT * MINUTE)) * SLOT * MINUTE;
const ceilTo = (ms: number) => Math.ceil(ms / (SLOT * MINUTE)) * SLOT * MINUTE;
const minutesBetween = (a: number, b: number) => Math.round((b - a) / MINUTE);

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addLocalDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function atMinutes(day: Date, minutes: number): number {
  const x = new Date(day);
  x.setHours(0, 0, 0, 0);
  x.setMinutes(Math.max(0, Math.min(24 * 60, minutes)));
  return x.getTime();
}

/** Merge overlapping intervals, which must already be sorted by start. */
function merge(intervals: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, e] of intervals) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Free stretches inside [windowStart, windowEnd] once padded busy time is removed. */
export function findGaps(windowStart: number, windowEnd: number, busy: BusyInterval[], buffer: number, minGap: number): Gap[] {
  if (windowEnd <= windowStart) return [];
  const pad = buffer * MINUTE;
  const blocked = merge(
    busy
      .map((b): [number, number] => [b.start.getTime() - pad, b.end.getTime() + pad])
      .filter(([s, e]) => e > windowStart && s < windowEnd)
      .map(([s, e]): [number, number] => [Math.max(s, windowStart), Math.min(e, windowEnd)])
      .sort((a, b) => a[0] - b[0]),
  );

  const gaps: Gap[] = [];
  let cursor = windowStart;
  const push = (s: number, e: number) => {
    const start = ceilTo(s);
    const end = floorTo(e);
    const minutes = minutesBetween(start, end);
    if (minutes >= minGap) gaps.push({ start: new Date(start), end: new Date(end), minutes });
  };
  for (const [s, e] of blocked) {
    if (s > cursor) push(cursor, s);
    cursor = Math.max(cursor, e);
  }
  if (cursor < windowEnd) push(cursor, windowEnd);
  return gaps;
}

function isSplittable(task: PlanTask): boolean {
  return task.type !== "quiz" && task.estimate >= SPLIT_THRESHOLD;
}

/** The order in which work is considered: late work first, then soonest due. */
export function priorityOrder(tasks: PlanTask[], now: Date): PlanTask[] {
  const t = now.getTime();
  return [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? a.dueAt.getTime() : Infinity;
    const bDue = b.dueAt ? b.dueAt.getTime() : Infinity;
    const aLate = aDue < t;
    const bLate = bDue < t;
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (aDue !== bDue) return aDue - bDue;
    if (TYPE_WEIGHT[a.type] !== TYPE_WEIGHT[b.type]) return TYPE_WEIGHT[b.type] - TYPE_WEIGHT[a.type];
    if (a.estimate !== b.estimate) return a.estimate - b.estimate;
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

export function buildPlan(input: PlanInput): Plan {
  const { now, prefs } = input;
  const nowMs = now.getTime();
  const today = startOfLocalDay(now);
  const horizonEnd = addLocalDays(today, input.days).getTime();

  // Work worth planning: unfinished, has time left, and not long past due.
  const pins = input.pins ?? {};
  const candidates = priorityOrder(
    input.tasks.filter(
      (task) =>
        task.estimate > 0 &&
        (!task.dueAt || task.dueAt.getTime() >= nowMs - OVERDUE_GRACE_DAYS * DAY || pins[task.id] !== undefined),
    ),
    now,
  );
  const remaining = new Map(candidates.map((task) => [task.id, Math.round(task.estimate)]));

  // Pinned work goes in first, exactly where the student put it, and counts as busy.
  const pinned: PlannedBlock[] = [];
  for (const task of candidates) {
    const at = pins[task.id]?.getTime();
    if (at === undefined || !Number.isFinite(at)) continue;
    const start = floorTo(at);
    const minutes = Math.round(task.estimate);
    const end = start + minutes * MINUTE;
    // Let go of a time that has passed or falls outside the plan; the task is planned as usual.
    if (end <= nowMs || start < today.getTime() || start >= horizonEnd) continue;
    pinned.push({ taskId: task.id, start: new Date(start), end: new Date(end), minutes, part: 0, parts: 0, pinned: true });
    remaining.set(task.id, 0);
  }
  const busy = [...input.busy, ...pinned.map((b) => ({ start: b.start, end: b.end }))];

  const days: DayPlan[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addLocalDays(today, i);
    const dow = date.getDay();
    const working = prefs.weekends || (dow !== 0 && dow !== 6);
    let windowStart = atMinutes(date, prefs.dayStart);
    const windowEnd = atMinutes(date, prefs.dayEnd);
    if (i === 0) windowStart = Math.max(windowStart, ceilTo(nowMs));
    const gaps = working ? findGaps(windowStart, windowEnd, busy, prefs.buffer, prefs.minGap) : [];
    const dayEnd = addLocalDays(date, 1).getTime();
    const mine = pinned.filter((b) => b.start.getTime() >= date.getTime() && b.start.getTime() < dayEnd);
    days.push({
      date,
      working,
      gaps,
      blocks: mine,
      freeMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
      plannedMinutes: mine.reduce((sum, b) => sum + b.minutes, 0),
    });
  }

  for (const day of days) {
    for (const gap of day.gaps) {
      let cursor = gap.start.getTime();
      const gapEnd = gap.end.getTime();

      for (;;) {
        const available = minutesBetween(cursor, gapEnd);
        if (available < SLOT) break;

        let chosen: { task: PlanTask; minutes: number } | null = null;
        for (const task of candidates) {
          const left = remaining.get(task.id) ?? 0;
          if (left <= 0) continue;

          const due = task.dueAt?.getTime() ?? Infinity;
          const overdue = due < nowMs;
          // Never plan work after it is due, except work that is already late.
          const usable = overdue ? available : Math.min(available, Math.floor((due - cursor) / (SLOT * MINUTE)) * SLOT);
          if (usable < SLOT) continue;

          // Keep to the daily limit, unless the work is late or due within a day.
          const urgent = overdue || due - cursor <= DAY;
          const capLeft = urgent ? Infinity : prefs.dailyMax - day.plannedMinutes;
          const room = Math.min(usable, capLeft);
          if (room < SLOT) continue;

          if (!isSplittable(task)) {
            if (left <= room) {
              chosen = { task, minutes: left };
              break;
            }
            continue;
          }

          if (left <= room) {
            chosen = { task, minutes: left };
            break;
          }
          let piece = Math.floor(room / SLOT) * SLOT;
          // Don't strand a remainder too short to be worth coming back to.
          if (left - piece < MIN_CHUNK) piece = left - MIN_CHUNK;
          if (piece >= MIN_CHUNK) {
            chosen = { task, minutes: piece };
            break;
          }
        }

        if (!chosen) break;
        const start = cursor;
        const end = cursor + chosen.minutes * MINUTE;
        day.blocks.push({
          taskId: chosen.task.id,
          start: new Date(start),
          end: new Date(end),
          minutes: chosen.minutes,
          part: 0,
          parts: 0,
        });
        remaining.set(chosen.task.id, (remaining.get(chosen.task.id) ?? 0) - chosen.minutes);
        day.plannedMinutes += chosen.minutes;
        cursor = end;
      }
    }
  }

  for (const day of days) day.blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Number the pieces of split tasks.
  const pieces = new Map<string, PlannedBlock[]>();
  for (const day of days) for (const block of day.blocks) pieces.set(block.taskId, [...(pieces.get(block.taskId) ?? []), block]);
  const planned: Record<string, number> = {};
  for (const [taskId, blocks] of pieces) {
    blocks.forEach((b, i) => {
      b.part = i + 1;
      b.parts = blocks.length;
    });
    planned[taskId] = blocks.reduce((sum, b) => sum + b.minutes, 0);
  }

  const atRisk: AtRisk[] = [];
  let dueMinutes = 0;
  for (const task of candidates) {
    const due = task.dueAt?.getTime() ?? Infinity;
    const dueInHorizon = due < horizonEnd;
    if (dueInHorizon) dueMinutes += Math.round(task.estimate);
    const left = remaining.get(task.id) ?? 0;
    if (left > 0 && dueInHorizon) {
      atRisk.push({ taskId: task.id, dueAt: task.dueAt, shortBy: left, planned: planned[task.id] ?? 0, overdue: due < nowMs });
    }
  }

  return {
    days,
    atRisk,
    order: candidates.map((task) => task.id),
    planned,
    freeMinutes: days.reduce((sum, d) => sum + d.freeMinutes, 0),
    dueMinutes,
  };
}

export const DEFAULT_PREFS: PlanPrefs = {
  dayStart: 8 * 60,
  dayEnd: 22 * 60,
  dailyMax: 4 * 60,
  buffer: 10,
  minGap: 20,
  weekends: true,
  estimates: { exam: 180, project: 120, assignment: 60, quiz: 30, reading: 30 },
};
