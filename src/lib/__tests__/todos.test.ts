import assert from "node:assert/strict";
import test from "node:test";
import { autoPriority, blocksByTask, classRank, isSchoolWork, sortTodos, todoList, todoState, unfinishedToAsk, urgency, urgencyColor, weekLoad, NO_DUE_COLOR } from "../todos";
import { approxDuration, dueLabel } from "../ui";
import type { ScheduledBlock, Task } from "../types";

// Tests run with TZ=America/Denver. October 1, 2026 is a Thursday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const NOW = at(1, 12);

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    feedId: "f",
    courseId: "f:cs",
    title: id,
    type: "assignment",
    dueAt: at(3, 23, 59).toISOString(),
    allDay: false,
    url: null,
    description: null,
    estimate: 60,
    customEstimate: false,
    estimateSource: "default",
    done: false,
    manual: false,
    generated: null,
    points: null,
    priority: "low",
    customPriority: false,
    ...over,
  };
}

function block(taskId: string, start: Date, end: Date): ScheduledBlock {
  return { id: `b:${taskId}:${start.getTime()}`, taskId, title: taskId, start: start.toISOString(), end: end.toISOString(), color: null, externalId: null, updatedAt: start.toISOString() };
}

// ---------------------------------------------------------------------------
// What is on the list
// ---------------------------------------------------------------------------

test("school work is anything from a school calendar, or added by hand for a class", () => {
  assert.equal(isSchoolWork(task("canvas")), true);
  assert.equal(isSchoolWork(task("study", { generated: "study" })), true);
  assert.equal(isSchoolWork(task("lab report", { manual: true, courseId: "f:cs" })), true);
  assert.equal(isSchoolWork(task("read scriptures", { manual: true, courseId: null, feedId: null })), false);
});

test("scheduling work takes it off the list until its time has passed", () => {
  const t = task("essay");
  assert.equal(todoState(t, [], NOW), "todo");
  assert.equal(todoState(t, [block("essay", at(1, 15), at(1, 16))], NOW), "scheduled");
  assert.equal(todoState(t, [block("essay", at(1, 9), at(1, 10)), block("essay", at(2, 9), at(2, 10))], NOW), "scheduled", "any time still to come keeps it scheduled");
  assert.equal(todoState(t, [block("essay", at(1, 9), at(1, 10))], NOW), "unfinished");
  assert.equal(todoState({ ...t, done: true }, [block("essay", at(1, 15), at(1, 16))], NOW), "done");
});

test("unfinished work: asked about, put back at midnight, or never taken off the list", () => {
  const t = task("essay");
  const yesterday = [block("essay", at(0, 9), at(0, 10))];
  const thisMorning = [block("essay", at(1, 9), at(1, 10))];
  // ask: off the list until the answer is yes
  assert.equal(todoState(t, yesterday, NOW, "ask"), "unfinished");
  assert.equal(todoState(t, yesterday, NOW, "ask", { at: NOW.toISOString(), back: true }), "todo");
  assert.equal(todoState(t, yesterday, NOW, "ask", { at: NOW.toISOString(), back: false }), "unfinished");
  assert.equal(todoState(t, [block("essay", at(1, 13), at(1, 14))], at(1, 15), "ask", { at: NOW.toISOString(), back: true }), "unfinished", "an old answer doesn't cover newer time");
  // midnight: back once the day is over
  assert.equal(todoState(t, yesterday, NOW, "midnight"), "todo");
  assert.equal(todoState(t, thisMorning, NOW, "midnight"), "unfinished");
  assert.equal(todoState(t, thisMorning, NOW, "midnight", { at: NOW.toISOString(), back: true }), "todo", "put back by hand before midnight");
  // keep: scheduling never takes it off
  assert.equal(todoState(t, [block("essay", at(1, 15), at(1, 16))], NOW, "keep"), "todo");
});

test("the morning question covers work from before today that hasn't been answered", () => {
  const tasks = [task("yesterday"), task("this morning"), task("answered"), task("still to come"), task("done", { done: true })];
  const blocks = blocksByTask([
    block("yesterday", at(0, 9), at(0, 10)),
    block("this morning", at(1, 9), at(1, 10)),
    block("answered", at(0, 9), at(0, 10)),
    block("still to come", at(0, 9), at(0, 10)),
    block("still to come", at(2, 9), at(2, 10)),
    block("done", at(0, 9), at(0, 10)),
  ]);
  const ask = unfinishedToAsk(tasks, blocks, NOW, { answered: { at: at(1, 7).toISOString(), back: false } });
  assert.deepEqual(ask.map((t) => t.id), ["yesterday"]);
});

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

test("by due date: late work first, then soonest, with class priority breaking ties", () => {
  const due = at(2, 23, 59).toISOString();
  const tasks = [
    task("later", { dueAt: at(5, 9).toISOString() }),
    task("finance", { courseId: "f:fin", dueAt: due }),
    task("cs", { courseId: "f:cs", dueAt: due }),
    task("late", { dueAt: at(1, 9).toISOString() }),
    task("someday", { dueAt: null }),
    task("unranked", { courseId: "f:art", dueAt: due }),
  ];
  const rank = classRank(["f:fin", "f:cs"]);
  assert.deepEqual(sortTodos(tasks, "due", rank).map((t) => t.id), ["late", "finance", "cs", "unranked", "later", "someday"]);
  assert.deepEqual(
    sortTodos(tasks, "due", classRank(["f:cs", "f:fin"])).map((t) => t.id).slice(1, 3),
    ["cs", "finance"],
    "re-ranking the classes changes the tie",
  );
});

test("by duration: shortest first, and the most urgent of equal length first", () => {
  const tasks = [
    task("two hours", { estimate: 120 }),
    task("five minutes", { estimate: 5 }),
    task("half hour, due later", { estimate: 30, dueAt: at(9, 9).toISOString() }),
    task("half hour, due soon", { estimate: 30, dueAt: at(2, 9).toISOString() }),
  ];
  assert.deepEqual(sortTodos(tasks, "duration", classRank([])).map((t) => t.id), ["five minutes", "half hour, due soon", "half hour, due later", "two hours"]);
});

test("the list leaves out scheduled and done work, and can show school work only", () => {
  const tasks = [task("essay"), task("scriptures", { manual: true, courseId: null, feedId: null, dueAt: null }), task("scheduled"), task("done", { done: true })];
  const blocks = [block("scheduled", at(1, 15), at(1, 16))];
  const base = { tasks, blocks, now: NOW, sort: "due" as const, classOrder: [] };
  assert.deepEqual(todoList({ ...base, scope: "all" }).map((t) => t.id), ["essay", "scriptures"]);
  assert.deepEqual(todoList({ ...base, scope: "school" }).map((t) => t.id), ["essay"]);
  assert.deepEqual(todoList({ ...base, scope: "personal" }).map((t) => t.id), ["scriptures"]);
});

// ---------------------------------------------------------------------------
// Colour and duration labels
// ---------------------------------------------------------------------------

test("colour runs from bright red when due now or late to yellow a week or more out", () => {
  assert.equal(urgency(null, NOW), null);
  assert.equal(urgencyColor(null, NOW), NO_DUE_COLOR);
  assert.equal(urgency(at(1, 9).toISOString(), NOW), 0, "late is as urgent as it gets");
  assert.equal(urgency(at(30, 9).toISOString(), NOW), 1);
  const hue = (c: string) => Number(c.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/)![1]);
  const soon = hue(urgencyColor(at(1, 18).toISOString(), NOW));
  const mid = hue(urgencyColor(at(4, 12).toISOString(), NOW));
  const far = hue(urgencyColor(at(20, 12).toISOString(), NOW));
  assert.equal(hue(urgencyColor(at(1, 9).toISOString(), NOW)), 27, "red");
  assert.equal(far, 92, "yellow");
  assert.ok(soon < mid && mid < far, "hue moves steadily from red through orange to yellow");
});

test("estimates read at a glance", () => {
  assert.equal(approxDuration(5), "~5 min");
  assert.equal(approxDuration(45), "~45 min");
  assert.equal(approxDuration(60), "~1 hr");
  assert.equal(approxDuration(90), "~1.5 hrs");
  assert.equal(approxDuration(80), "~1.5 hrs");
  assert.equal(approxDuration(120), "~2 hrs");
});

test("priority follows the due date unless the student set it", () => {
  assert.equal(autoPriority("assignment", at(0, 9).toISOString(), NOW), "high", "late");
  assert.equal(autoPriority("assignment", at(2, 9).toISOString(), NOW), "high", "within a day");
  assert.equal(autoPriority("assignment", at(3, 23, 59).toISOString(), NOW), "medium", "within three days");
  assert.equal(autoPriority("exam", at(3, 23, 59).toISOString(), NOW), "high", "an exam within three days");
  assert.equal(autoPriority("assignment", at(9, 9).toISOString(), NOW), "low");
  assert.equal(autoPriority("assignment", null, NOW), "low", "no due date");
});

test("sorting by points puts what's worth the most first", () => {
  const tasks = [task("none"), task("ten", { points: 10 }), task("fifty", { points: 50 }), task("zero", { points: 0 })];
  assert.deepEqual(sortTodos(tasks, "points", classRank([])).map((t) => t.id), ["fifty", "ten", "zero", "none"]);
});

test("due dates read the planner's way", () => {
  assert.deepEqual(dueLabel(at(1, 18), NOW), { text: "Today", late: false });
  assert.deepEqual(dueLabel(at(2, 9), NOW), { text: "Tomorrow", late: false });
  assert.deepEqual(dueLabel(at(5, 9), NOW), { text: "Mon, Oct 5", late: false });
  assert.deepEqual(dueLabel(at(0, 9), NOW), { text: "1 day late", late: true });
  assert.deepEqual(dueLabel(null, NOW), { text: "No due date", late: false });
});

test("the week at a glance adds up each day's work by its estimate, and what of it is done", () => {
  // Monday, September 28 to Sunday, October 4 (October 1 is the Thursday).
  const days = weekLoad(
    [
      task("essay", { dueAt: at(1, 23, 59).toISOString(), estimate: 120 }),
      task("reading", { dueAt: at(1, 9).toISOString(), estimate: 30, done: true }),
      task("quiz", { dueAt: at(4, 23, 59).toISOString(), estimate: 45, done: true }),
      task("next week", { dueAt: at(5, 0, 1).toISOString() }),
      task("last week", { dueAt: new Date(2026, 8, 27, 23, 59).toISOString() }),
      task("no date", { dueAt: null }),
    ],
    new Date(2026, 8, 28),
  );
  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((d) => [d.date.getDate(), d.items, d.done, d.minutes, d.doneMinutes]),
    [
      [28, 0, 0, 0, 0],
      [29, 0, 0, 0, 0],
      [30, 0, 0, 0, 0],
      [1, 2, 1, 150, 30],
      [2, 0, 0, 0, 0],
      [3, 0, 0, 0, 0],
      [4, 1, 1, 45, 45],
    ],
  );
});
