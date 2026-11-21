import assert from "node:assert/strict";
import test from "node:test";
import { dueWords, fitsIn, nextUpReason, openSlots, pickNextUp, slotWhen } from "../nextUp";
import type { Gap } from "../planner";
import type { Task } from "../types";

// Tests run with TZ=America/Denver. October 1, 2026 is a Thursday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const NOW = at(1, 12, 5);

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
    priority: "low",
    customPriority: false,
    ...over,
  };
}

const gap = (start: Date, end: Date): Gap => ({ start, end, minutes: (end.getTime() - start.getTime()) / 60_000 });
// Free 2:00-2:45 today, 4:00-7:00 today, and 9:00-12:00 tomorrow.
const GAPS = [gap(at(1, 14), at(1, 14, 45)), gap(at(1, 16), at(1, 19)), gap(at(2, 9), at(2, 12))];

test("free time starts on the next quarter hour from now", () => {
  const slots = openSlots([gap(at(1, 12, 5), at(1, 13)), ...GAPS], NOW);
  assert.equal(slots[0].start.getTime(), at(1, 12, 15).getTime());
  assert.equal(slots[0].minutes, 45);
  assert.equal(slots.length, 4);
});

test("work fits a free stretch when it's long enough and done before it's due", () => {
  const [short, long] = openSlots(GAPS, NOW);
  assert.equal(fitsIn(task("a", { estimate: 45 }), short, NOW), true);
  assert.equal(fitsIn(task("a", { estimate: 60 }), short, NOW), false);
  assert.equal(fitsIn(task("a", { estimate: 60, dueAt: at(1, 16, 30).toISOString() }), long, NOW), false, "would end after it's due");
  assert.equal(fitsIn(task("a", { estimate: 60, dueAt: at(1, 9).toISOString() }), long, NOW), true, "late work fits anywhere");
  assert.equal(fitsIn(task("a", { estimate: 60, dueAt: null }), long, NOW), true);
});

test("next up is the soonest due, in the next free stretch", () => {
  const n = pickNextUp([task("later", { dueAt: at(5, 9).toISOString(), estimate: 30 }), task("soon", { dueAt: at(2, 9).toISOString(), estimate: 30 })], GAPS, NOW)!;
  assert.equal(n.task.id, "soon");
  assert.equal(n.slot?.start.getTime(), at(1, 14).getTime());
});

test("among work due the same day, what fits the next free stretch comes first", () => {
  const n = pickNextUp(
    [task("big", { dueAt: at(2, 9).toISOString(), estimate: 120 }), task("small", { dueAt: at(2, 22).toISOString(), estimate: 30 })],
    GAPS,
    NOW,
  )!;
  assert.equal(n.task.id, "small");
});

test("a sooner day still wins over a better fit, and goes in the first stretch it fits", () => {
  const n = pickNextUp([task("big", { dueAt: at(2, 9).toISOString(), estimate: 120 }), task("small", { dueAt: at(3, 9).toISOString(), estimate: 30 })], GAPS, NOW)!;
  assert.equal(n.task.id, "big");
  assert.equal(n.slot?.start.getTime(), at(1, 16).getTime());
});

test("late work comes first; work with no due date last", () => {
  const n = pickNextUp([task("none", { dueAt: null }), task("today", { dueAt: at(1, 20).toISOString() }), task("late", { dueAt: new Date(2026, 8, 30, 9).toISOString() })], GAPS, NOW)!;
  assert.equal(n.task.id, "late");
  assert.equal(pickNextUp([task("none", { dueAt: null }), task("friday", { dueAt: at(2, 20).toISOString() })], GAPS, NOW)!.task.id, "friday");
  assert.equal(pickNextUp([], GAPS, NOW), null);
});

test("no free stretch long enough: still next up, with nowhere to put it", () => {
  const n = pickNextUp([task("huge", { estimate: 600 })], GAPS, NOW)!;
  assert.equal(n.slot, null);
  assert.equal(nextUpReason(n, NOW), "Due Saturday · ~10 hr · no free stretch that long before it's due");
});

test("the one-line reason", () => {
  const n = pickNextUp([task("lab", { dueAt: at(2, 23, 59).toISOString(), estimate: 45 })], GAPS, NOW)!;
  assert.equal(nextUpReason(n, NOW), "Due tomorrow · ~45 min · fits your 2 PM gap");
  assert.equal(slotWhen(at(2, 9, 30), NOW), "9:30 AM tomorrow");
  assert.equal(nextUpReason({ ...n, slot: { start: at(2, 9), end: at(2, 12), minutes: 180 } }, NOW), "Due tomorrow · ~45 min · fits your 9 AM gap tomorrow");
  assert.equal(nextUpReason({ ...n, slot: { start: at(5, 9, 30), end: at(5, 12), minutes: 150 } }, NOW), "Due tomorrow · ~45 min · fits your Mon 9:30 AM gap");
  assert.equal(slotWhen(at(5, 9), NOW), "Mon 9 AM");
  assert.equal(dueWords(task("a", { dueAt: at(1, 18).toISOString() }), NOW), "Due today");
  assert.equal(dueWords(task("a", { dueAt: at(1, 9).toISOString() }), NOW), "Due earlier today");
  assert.equal(dueWords(task("a", { dueAt: at(1, 9).toISOString() }), at(3, 12)), "Overdue 2 days");
  assert.equal(dueWords(task("a", { dueAt: at(30, 9).toISOString() }), NOW), "Due Oct 30");
  assert.equal(dueWords(task("a", { dueAt: null }), NOW), "No due date");
});
