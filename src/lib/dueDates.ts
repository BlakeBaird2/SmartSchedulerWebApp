import type { AssignmentType, CalEvent, Task } from "./types";

/** One thing on the Due dates page: a piece of work, or an exam from a class calendar. */
export interface DueEntry {
  id: string;
  /** Opens the task, or the exam's event. */
  source: "task" | "event";
  title: string;
  type: AssignmentType;
  /** When it's due, or when the exam starts. */
  at: string;
  allDay: boolean;
  courseId: string | null;
  done: boolean;
  points: number | null;
  /** Minutes of work it needs; exams have none of their own. */
  estimate: number | null;
}

const TYPE_ORDER: Record<AssignmentType, number> = { exam: 0, quiz: 1, project: 2, assignment: 3, reading: 4 };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Everything with a date on the Due dates page. Work comes from its due date.
 * Exams often aren't assignments at all but a timed entry on the class calendar
 * (a midterm from 10 to 11:15), so those count too, at the time they start,
 * unless the same exam is already there as an assignment that day. Study time
 * Schedule Smart made up for an exam isn't a due date and is left out.
 */
export function dueEntries(tasks: Task[], events: CalEvent[]): DueEntry[] {
  const out: DueEntry[] = [];
  for (const t of tasks) {
    if (!t.dueAt || t.generated) continue;
    out.push({ id: t.id, source: "task", title: t.title, type: t.type, at: t.dueAt, allDay: t.allDay, courseId: t.courseId, done: t.done, points: t.points, estimate: t.estimate });
  }
  const day = (iso: string) => new Date(iso).toDateString();
  for (const e of events) {
    if (e.kind !== "exam") continue;
    const dupe = out.some((x) => x.type === "exam" && x.courseId === e.courseId && day(x.at) === day(e.start) && sameName(x.title, e.title));
    if (dupe) continue;
    out.push({ id: e.id, source: "event", title: e.title, type: "exam", at: e.start, allDay: e.allDay, courseId: e.courseId, done: false, points: null, estimate: null });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title));
}
