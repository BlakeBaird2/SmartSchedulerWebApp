import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PREFS, buildPlan } from "../planner";
import { buildDaySchedule, nowStatus } from "../timeline";
import type { CalEvent, Task } from "../types";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

const event = (id: string, start: Date, end: Date, busy = true, allDay = false): CalEvent => ({
  id, feedId: "f", courseId: null, title: id, start: start.toISOString(), end: end.toISOString(), allDay, busy, kind: "class", location: null, url: null, color: "#000000", source: "feed",
});
const task = (id: string, estimate: number, due: Date, allDay = false): Task => ({
  id, feedId: "f", courseId: null, title: id, type: "assignment", dueAt: due.toISOString(), allDay, url: null, description: null, estimate, customEstimate: false, estimateSource: "default", done: false, manual: false, generated: null,
});

function setup(now: Date) {
  const events = [event("Class", at(1, 10), at(1, 11)), event("Work", at(1, 13), at(1, 17)), event("Birthday", at(1, 0), at(2, 0), false, true)];
  const tasks = [task("Reading", 30, at(1, 23, 59), true), task("Quiz", 30, at(1, 18)), task("Essay", 60, at(3, 12))];
  const plan = buildPlan({
    now,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, type: t.type, dueAt: new Date(t.dueAt!), estimate: t.estimate })),
    busy: events.filter((e) => e.busy).map((e) => ({ start: new Date(e.start), end: new Date(e.end) })),
    prefs: { ...DEFAULT_PREFS, buffer: 0 },
    days: 2,
  });
  return { events, tasks, plan };
}

test("a day reads in order: events, and free stretches holding the work planned in them", () => {
  const { events, tasks, plan } = setup(at(1, 7));
  const day = buildDaySchedule(at(1, 0), plan.days[0], events, tasks);
  assert.deepEqual(day.allDayEvents.map((e) => e.id), ["Birthday"]);
  assert.deepEqual(day.dueAllDay.map((t) => t.id), ["Reading"]);
  assert.deepEqual(
    day.items.map((i) => `${i.kind}:${hhmm(i.start)}${i.kind === "free" ? "[" + i.work.map((w) => w.task.id).join(",") + "]" : ""}`),
    ["free:08:00[Quiz,Reading,Essay]", "event:10:00", "free:11:00[]", "event:13:00", "free:17:00[]", "due:18:00"],
  );
  const first = day.items[0];
  assert.ok(first.kind === "free" && first.minutes === 120 && first.leftover === 0, "8 to 10 is filled by 30 + 30 + 60 minutes");
});

test("right now: free time says what to do and until when", () => {
  const { events, tasks, plan } = setup(at(1, 8, 2));
  const s = nowStatus(plan, events, tasks, at(1, 8, 2));
  assert.equal(s.state, "free");
  if (s.state !== "free") return;
  assert.equal(hhmm(s.until), "10:00");
  assert.equal(s.nextEvent?.id, "Class");
  assert.deepEqual(s.work.map((w) => w.task.id), ["Quiz", "Reading", "Essay"].slice(0, s.work.length));
  assert.ok(s.work.length >= 2);
});

test("right now: during a class it points at the next free stretch", () => {
  const { events, tasks, plan } = setup(at(1, 10, 20));
  const s = nowStatus(plan, events, tasks, at(1, 10, 20));
  assert.equal(s.state, "busy");
  if (s.state !== "busy") return;
  assert.equal(s.event.id, "Class");
  assert.equal(hhmm(s.next!.start), "11:00");
});

test("right now: before the working day starts, the first stretch is next", () => {
  const { events, tasks, plan } = setup(at(1, 6, 30));
  assert.equal(nowStatus(plan, events, tasks, at(1, 6, 30)).state, "later");
});

test("right now: after the working day, there is nothing left", () => {
  const { events, tasks, plan } = setup(at(1, 22, 30));
  assert.equal(nowStatus(plan, events, tasks, at(1, 22, 30)).state, "done");
});
