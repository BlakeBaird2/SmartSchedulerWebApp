import assert from "node:assert/strict";
import test from "node:test";
import { dueEntries } from "../dueDates";
import type { CalEvent, Task } from "../types";

// Tests run with TZ=America/Denver.
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, feedId: "f", courseId: "f:is531", title: id, type: "assignment", dueAt: at(30, 23, 59), allDay: false, url: null, description: null,
  estimate: 60, customEstimate: false, estimateSource: "default", done: false, manual: false, generated: null, points: null, priority: "low", customPriority: false, ...over,
});
const event = (id: string, over: Partial<CalEvent> = {}): CalEvent => ({
  id, feedId: "f", courseId: "f:is531", title: id, start: at(31, 10), end: at(31, 11, 15), allDay: false, busy: true, kind: "exam", location: null, url: null, color: "#000", source: "feed", ...over,
});

test("work is listed at its due date, in order", () => {
  const list = dueEntries([task("RDS Lab", { dueAt: at(30, 23, 59) }), task("Reading Quiz", { type: "quiz", dueAt: at(30, 9) })], []);
  assert.deepEqual(list.map((e) => [e.title, e.source, e.at]), [["Reading Quiz", "task", at(30, 9)], ["RDS Lab", "task", at(30, 23, 59)]]);
});

test("an exam that's only on the class calendar is listed, at the time it starts", () => {
  const list = dueEntries([], [event("Midterm 2")]);
  assert.deepEqual(list.map((e) => [e.title, e.type, e.source, e.at]), [["Midterm 2", "exam", "event", at(31, 10)]]);
});

test("the same exam as an assignment and a calendar entry is listed once", () => {
  const list = dueEntries([task("Online Midterm", { type: "exam", dueAt: at(31, 23, 59) })], [event("Online Midterm", { start: at(31, 10) })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].source, "task");
});

test("study time, class meetings and things with no date aren't due dates", () => {
  const list = dueEntries(
    [task("Study for Midterm", { generated: "study" }), task("Someday", { dueAt: null })],
    [event("Lecture", { kind: "class" }), event("Club social", { kind: "event" })],
  );
  assert.equal(list.length, 0);
});
