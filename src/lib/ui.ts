import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { BookOpen, CircleQuestionMark, FolderKanban, GraduationCap, PenLine, type LucideIcon } from "lucide-react";
import { normalizeType, type AssignmentType, type Task } from "./types";

export interface TypeMeta {
  label: string;
  plural: string;
  icon: LucideIcon;
  chip: string;
  /** Loud types get a visible chip on every row. */
  loud: boolean;
}

export const TYPE_META: Record<AssignmentType, TypeMeta> = {
  exam: {
    label: "Exam",
    plural: "Exams",
    icon: GraduationCap,
    chip: "bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500",
    loud: true,
  },
  quiz: {
    label: "Quiz",
    plural: "Quizzes",
    icon: CircleQuestionMark,
    chip: "bg-amber-100 text-amber-900 border-amber-300/70 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/30",
    loud: true,
  },
  project: {
    label: "Project",
    plural: "Projects",
    icon: FolderKanban,
    chip: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-400/15 dark:text-teal-200 dark:border-teal-400/30",
    loud: false,
  },
  assignment: {
    label: "Assignment",
    plural: "Assignments",
    icon: PenLine,
    chip: "bg-surface-2 text-muted border-line",
    loud: false,
  },
  reading: {
    label: "Reading",
    plural: "Readings",
    icon: BookOpen,
    chip: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/30",
    loud: false,
  },
};

export function typeMeta(type: AssignmentType | string): TypeMeta {
  return TYPE_META[normalizeType(type)];
}

export function typeIconClass(type: AssignmentType): string {
  return type === "exam" ? "text-danger" : type === "quiz" ? "text-warn" : "text-muted";
}

export function dueDate(t: { dueAt: string | null }): Date | null {
  if (!t.dueAt) return null;
  const d = new Date(t.dueAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "45m", "1h", "2h 30m" */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function clock(d: Date): string {
  return format(d, d.getMinutes() === 0 ? "h a" : "h:mm a");
}

export function clockRange(start: Date, end: Date): string {
  const samePeriod = format(start, "a") === format(end, "a");
  const s = format(start, start.getMinutes() === 0 ? "h" : "h:mm") + (samePeriod ? "" : ` ${format(start, "a")}`);
  return `${s} – ${clock(end)}`;
}

export function formatDue(t: Pick<Task, "dueAt" | "allDay">, now: Date): string {
  const d = dueDate(t);
  if (!d) return "No due date";
  const days = differenceInCalendarDays(d, now);
  const time = t.allDay ? "" : ` ${clock(d)}`;
  if (days === 0) return t.allDay ? "Today" : `Today${time}`;
  if (days === 1) return `Tomorrow${time}`;
  if (days === -1) return `Yesterday${time}`;
  if (days > 1 && days < 7) return `${format(d, "EEEE")}${time}`;
  return `${format(d, d.getFullYear() === now.getFullYear() ? "EEE, MMM d" : "EEE, MMM d, yyyy")}${time}`;
}

/** "in 3 days", "tomorrow", "2 days late" */
export function relativeDue(d: Date, now: Date): string {
  const ms = d.getTime() - now.getTime();
  const days = differenceInCalendarDays(d, now);
  if (ms < 0) {
    if (days === 0) {
      const h = Math.floor(-ms / 3_600_000);
      return h < 1 ? "just now" : `${h}h late`;
    }
    return days === -1 ? "1 day late" : `${-days} days late`;
  }
  if (days === 0) {
    const h = Math.floor(ms / 3_600_000);
    return h < 1 ? `in ${Math.max(1, Math.floor(ms / 60_000))} min` : `in ${h}h`;
  }
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

export function dayHeading(d: Date, now: Date): { title: string; sub: string } {
  const days = differenceInCalendarDays(d, now);
  const full = format(d, "EEEE, MMMM d");
  if (days === 0) return { title: "Today", sub: full };
  if (days === 1) return { title: "Tomorrow", sub: full };
  if (days === -1) return { title: "Yesterday", sub: full };
  if (days > 1 && days < 7) return { title: format(d, "EEEE"), sub: format(d, "MMMM d") };
  return { title: format(d, "EEE, MMM d"), sub: format(d, "EEEE") };
}

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function timeAgo(iso: string | null | undefined, now: Date): string {
  if (!iso) return "never";
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "unknown";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function minutesLabel(minutes: number): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return minutes >= 24 * 60 ? "midnight" : clock(d);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export interface Filters {
  courses: string[] | null;
  types: AssignmentType[] | null;
  showCompleted: boolean;
}

export const DEFAULT_FILTERS: Filters = { courses: null, types: null, showCompleted: false };

export function applyFilters(list: Task[], f: Filters): Task[] {
  const courseSet = f.courses ? new Set(f.courses) : null;
  const typeSet = f.types ? new Set(f.types) : null;
  return list.filter((t) => {
    if (courseSet && (!t.courseId || !courseSet.has(t.courseId))) return false;
    if (typeSet && !typeSet.has(t.type)) return false;
    if (!f.showCompleted && t.done) return false;
    return true;
  });
}

/** "Today 2:10 PM", "Tomorrow 9 AM", "Tue 2:10 PM", "Oct 14 9 AM" */
export function whenLabel(d: Date, now: Date, withTime = true): string {
  const days = differenceInCalendarDays(d, now);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 && days < 7 ? format(d, "EEE") : format(d, "MMM d");
  return withTime ? `${day} ${clock(d)}` : day;
}

/** "due tomorrow", or "2 days late" once it has passed. */
export function dueIn(d: Date, now: Date): string {
  return d.getTime() < now.getTime() ? relativeDue(d, now) : `due ${relativeDue(d, now)}`;
}
