/**
 * The to-do list beside the calendar: every piece of work, school and personal,
 * that is not done and not yet on the calendar, in the order to plan it.
 *
 * Putting work on the calendar takes it off the list, so the next thing to plan
 * moves up to the top. What happens to work whose time passes without it being
 * done is a choice (see `UnfinishedPolicy`), so other behaviours can be swapped in
 * without touching the list itself.
 */
import type { AssignmentType, ScheduledBlock, Task } from "./types";

export type TodoScope = "all" | "school";
export type TodoSort = "due" | "duration";

/**
 * What happens to work whose scheduled time passed without it being done.
 * - ask: each morning, ask whether to put yesterday's unfinished work back on the list.
 * - midnight: put it back on its own once the day it was scheduled for is over.
 * - keep: scheduling never takes work off the list; it stays until it is ticked off.
 */
export type UnfinishedPolicy = "ask" | "midnight" | "keep";

/** The answer given about one task when asked whether to put it back on the list. */
export interface UnfinishedAnswer {
  at: string;
  back: boolean;
}

/** Where a task stands: on the list, on the calendar, waiting to be asked about, or done. */
export type TodoState = "todo" | "scheduled" | "unfinished" | "done";

const DAY = 86_400_000;

/** School work comes from a school calendar, or was added by hand for a class. */
export function isSchoolWork(task: Task): boolean {
  return !task.manual || task.courseId !== null;
}

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function todoState(
  task: Task,
  blocks: ScheduledBlock[],
  now: Date,
  policy: UnfinishedPolicy = "ask",
  answer?: UnfinishedAnswer,
): TodoState {
  if (task.done) return "done";
  if (policy === "keep" || blocks.length === 0) return "todo";
  const nowMs = now.getTime();
  const lastEnd = Math.max(...blocks.map((b) => Date.parse(b.end)));
  if (lastEnd > nowMs) return "scheduled";
  if (policy === "midnight") return lastEnd <= startOfLocalDay(now) ? "todo" : "unfinished";
  // An answer only counts for time that had passed when it was given.
  if (answer && Date.parse(answer.at) >= lastEnd) return answer.back ? "todo" : "unfinished";
  return "unfinished";
}

/** Each task's blocks, so the list doesn't scan every block for every task. */
export function blocksByTask(blocks: ScheduledBlock[]): Map<string, ScheduledBlock[]> {
  const out = new Map<string, ScheduledBlock[]>();
  for (const b of blocks) {
    if (!b.taskId) continue;
    const list = out.get(b.taskId);
    if (list) list.push(b);
    else out.set(b.taskId, [b]);
  }
  return out;
}

/**
 * Work whose scheduled time all ended before today and hasn't been asked about:
 * what the morning question covers. Work from earlier today waits for tomorrow.
 */
export function unfinishedToAsk(
  tasks: Task[],
  blocks: Map<string, ScheduledBlock[]>,
  now: Date,
  answers: Record<string, UnfinishedAnswer>,
): Task[] {
  const today = startOfLocalDay(now);
  return tasks.filter((t) => {
    const mine = blocks.get(t.id) ?? [];
    if (todoState(t, mine, now, "ask", answers[t.id]) !== "unfinished") return false;
    const lastEnd = Math.max(...mine.map((b) => Date.parse(b.end)));
    const answered = answers[t.id] && Date.parse(answers[t.id].at) >= lastEnd;
    return !answered && lastEnd <= today;
  });
}

/**
 * Class priority as a sort key: the class's place in the student's ranking, with
 * unranked classes after every ranked one, and work with no class last.
 */
export function classRank(order: string[]): (courseId: string | null) => number {
  const pos = new Map(order.map((id, i) => [id, i]));
  return (courseId) => (courseId === null ? Number.MAX_SAFE_INTEGER : (pos.get(courseId) ?? order.length));
}

/** Bigger things first when two are due at the same moment, as the planner does. */
const TYPE_WEIGHT: Record<AssignmentType, number> = { exam: 5, project: 4, quiz: 3, assignment: 2, reading: 1 };

/**
 * Most urgent first: late work, then by due time. Work due at the same moment is
 * ordered by class priority, then by kind (exams first). Work with no due date
 * comes last.
 */
export function byUrgency(rank: (courseId: string | null) => number): (a: Task, b: Task) => number {
  return (a, b) => {
    const ad = a.dueAt ? Date.parse(a.dueAt) : Infinity;
    const bd = b.dueAt ? Date.parse(b.dueAt) : Infinity;
    if (ad !== bd) return ad - bd;
    const ar = rank(a.courseId);
    const br = rank(b.courseId);
    if (ar !== br) return ar - br;
    if (TYPE_WEIGHT[a.type] !== TYPE_WEIGHT[b.type]) return TYPE_WEIGHT[b.type] - TYPE_WEIGHT[a.type];
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  };
}

export function sortTodos(tasks: Task[], sort: TodoSort, rank: (courseId: string | null) => number): Task[] {
  const urgency = byUrgency(rank);
  if (sort === "due") return [...tasks].sort(urgency);
  // Shortest first, to fill a gap of a given size; the most urgent of equal length first.
  return [...tasks].sort((a, b) => a.estimate - b.estimate || urgency(a, b));
}

export interface TodoListInput {
  tasks: Task[];
  blocks: ScheduledBlock[];
  now: Date;
  scope: TodoScope;
  sort: TodoSort;
  classOrder: string[];
  policy?: UnfinishedPolicy;
  answers?: Record<string, UnfinishedAnswer>;
}

/** The list as shown: on the list, in scope, in order. */
export function todoList(input: TodoListInput): Task[] {
  const mine = blocksByTask(input.blocks);
  const answers = input.answers ?? {};
  const open = input.tasks.filter(
    (t) => (input.scope === "all" || isSchoolWork(t)) && todoState(t, mine.get(t.id) ?? [], input.now, input.policy, answers[t.id]) === "todo",
  );
  return sortTodos(open, input.sort, classRank(input.classOrder));
}

// ---------------------------------------------------------------------------
// Colour by how soon something is due
// ---------------------------------------------------------------------------

/** How far ahead the colour runs: due a week or more from now is as yellow as it gets. */
export const URGENCY_SPAN = 7 * DAY;

/** Bright red (due now, or late) through orange to yellow (most time left), as OKLCH. */
const RED = { l: 0.63, c: 0.24, h: 27 };
const YELLOW = { l: 0.86, c: 0.17, h: 92 };
/** Work with no due date: no urgency, so no colour of its own. */
export const NO_DUE_COLOR = "#94a3b8";

/** 0 for due now or late, rising to 1 at a week or more away. */
export function urgency(dueAt: string | null, now: Date): number | null {
  if (!dueAt) return null;
  const left = Date.parse(dueAt) - now.getTime();
  if (!Number.isFinite(left)) return null;
  return Math.min(1, Math.max(0, left / URGENCY_SPAN));
}

/** The colour for work due at `dueAt`: a CSS colour the app's `--c` styles accept. */
export function urgencyColor(dueAt: string | null, now: Date): string {
  const t = urgency(dueAt, now);
  if (t === null) return NO_DUE_COLOR;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return `oklch(${mix(RED.l, YELLOW.l).toFixed(3)} ${mix(RED.c, YELLOW.c).toFixed(3)} ${mix(RED.h, YELLOW.h).toFixed(1)})`;
}
