/**
 * "Next up" at the top of the planner: the one unscheduled task to do next, and
 * the free time it goes in.
 *
 * Ranked by due date first, by day: late work, then work due today, tomorrow and
 * so on, with work that has no due date last. Among work due the same day, what
 * fits the next free stretch comes first, so the next free hour gets used; then
 * the soonest due. (The calendar feeds carry no point values or weights, so
 * those can't count.)
 *
 * It goes in the next free stretch if it fits there, otherwise the first one it
 * fits before it's due.
 */
import { differenceInCalendarDays, format } from "date-fns";
import type { Gap } from "./planner";
import { byUrgency, classRank } from "./todos";
import type { Task } from "./types";
import { clock } from "./ui";

const MINUTE = 60_000;
/** Work goes in on a quarter hour, as when it's dropped on a day (see scheduleOnDay). */
const QUARTER = 15 * MINUTE;

/** A stretch of free time from now on, starting on a quarter hour. */
export interface Slot {
  start: Date;
  end: Date;
  minutes: number;
}

export interface NextUp {
  task: Task;
  /** The free stretch it goes in, or null when none is long enough before it's due. */
  slot: Slot | null;
}

/** The planner's free gaps from now on, each starting on the next quarter hour. */
export function openSlots(gaps: Gap[], now: Date): Slot[] {
  const out: Slot[] = [];
  for (const g of gaps) {
    const start = Math.ceil(Math.max(g.start.getTime(), now.getTime()) / QUARTER) * QUARTER;
    const minutes = Math.floor((g.end.getTime() - start) / MINUTE);
    if (minutes > 0) out.push({ start: new Date(start), end: g.end, minutes });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function isLate(task: Task, now: Date): boolean {
  return task.dueAt !== null && Date.parse(task.dueAt) < now.getTime();
}

/** Whether a task fits in a free stretch, finishing before it's due (late work and work with no due date fit anywhere long enough). */
export function fitsIn(task: Task, slot: Slot, now: Date): boolean {
  if (task.estimate > slot.minutes) return false;
  if (!task.dueAt || isLate(task, now)) return true;
  return slot.start.getTime() + task.estimate * MINUTE <= Date.parse(task.dueAt);
}

/** Work due the same day ranks together: late work first, then by the day it's due, then no due date. */
function dueTier(task: Task, now: Date): number {
  if (!task.dueAt) return Number.MAX_SAFE_INTEGER;
  if (isLate(task, now)) return -1;
  return differenceInCalendarDays(new Date(task.dueAt), now);
}

/** The task to do next from `tasks` (work still to schedule), and where it goes. */
export function pickNextUp(tasks: Task[], gaps: Gap[], now: Date): NextUp | null {
  if (tasks.length === 0) return null;
  const slots = openSlots(gaps, now);
  const first = slots[0];
  const fitsNext = (t: Task) => (first && fitsIn(t, first, now) ? 1 : 0);
  const urgency = byUrgency(classRank([]));
  let best = tasks[0];
  for (const t of tasks.slice(1)) {
    const order = dueTier(t, now) - dueTier(best, now) || fitsNext(best) - fitsNext(t) || urgency(t, best);
    if (order < 0) best = t;
  }
  return { task: best, slot: slots.find((s) => fitsIn(best, s, now)) ?? null };
}

/** "45 min", "1 hr", "1.5 hr". */
function length(m: number): string {
  return m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} hr`;
}

/** When a free stretch starts, as said in a sentence: "2 PM", "2 PM tomorrow", "Mon 9 AM". */
export function slotWhen(start: Date, now: Date): string {
  const days = differenceInCalendarDays(start, now);
  if (days === 0) return clock(start);
  if (days === 1) return `${clock(start)} tomorrow`;
  return `${format(start, "EEE")} ${clock(start)}`;
}

/** When it's due, in a few words: "Overdue 2 days", "Due today", "Due tomorrow", "Due Friday", "Due Dec 4". */
export function dueWords(task: Task, now: Date): string {
  if (!task.dueAt) return "No due date";
  const due = new Date(task.dueAt);
  const days = differenceInCalendarDays(due, now);
  if (due.getTime() < now.getTime()) return days === 0 ? "Due earlier today" : days === -1 ? "Was due yesterday" : `Overdue ${-days} days`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due ${format(due, "EEEE")}`;
  return `Due ${format(due, "MMM d")}`;
}

/** The free stretch, as said in the reason: "your 2 PM gap", "your 8 AM gap tomorrow", "your Mon 9 AM gap". */
function gapWords(start: Date, now: Date): string {
  const days = differenceInCalendarDays(start, now);
  if (days === 0) return `your ${clock(start)} gap`;
  if (days === 1) return `your ${clock(start)} gap tomorrow`;
  return `your ${format(start, "EEE")} ${clock(start)} gap`;
}

/** Why it's next, in one line: "Due tomorrow · ~45 min · fits your 2 PM gap". */
export function nextUpReason({ task, slot }: NextUp, now: Date): string {
  const fit = slot ? `fits ${gapWords(slot.start, now)}` : task.dueAt && !isLate(task, now) ? "no free stretch that long before it's due" : "no free stretch that long";
  return `${dueWords(task, now)} · ~${length(task.estimate)} · ${fit}`;
}
