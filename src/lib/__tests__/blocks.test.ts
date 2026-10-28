import assert from "node:assert/strict";
import test from "node:test";
import { blockMinutes, dropBlock, makeBlock, moveBlock, putBlock, resizeBlock, snapMinutes } from "../blocks";

// Tests run with TZ=America/Denver. October 1, 2026 is a Thursday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const NOW = at(1, 8);
const task = { id: "f:essay", title: "Essay draft" };

test("times snap to the nearest quarter hour", () => {
  assert.equal(snapMinutes(9 * 60 + 7), 9 * 60);
  assert.equal(snapMinutes(9 * 60 + 8), 9 * 60 + 15);
  assert.equal(snapMinutes(9 * 60 + 52), 9 * 60 + 45);
});

test("new time for a task is as long as its estimate, and looks like a calendar event", () => {
  const b = makeBlock("b1", task, at(1, 14), 90, NOW);
  assert.deepEqual(b, {
    id: "b1",
    taskId: "f:essay",
    title: "Essay draft",
    start: at(1, 14).toISOString(),
    end: at(1, 15, 30).toISOString(),
    color: null,
    externalId: null,
    updatedAt: NOW.toISOString(),
  });
  assert.equal(blockMinutes(makeBlock("b2", task, at(1, 14), 5, NOW)), 15, "never shorter than a quarter hour");
});

test("moving keeps the length; resizing keeps the start", () => {
  const b = makeBlock("b1", task, at(1, 14), 60, NOW);
  const later = at(1, 9);
  const moved = moveBlock(b, at(2, 10, 15), later);
  assert.equal(moved.start, at(2, 10, 15).toISOString());
  assert.equal(blockMinutes(moved), 60);
  assert.equal(moved.updatedAt, later.toISOString());

  const longer = resizeBlock(b, at(1, 16), later);
  assert.equal(longer.start, b.start);
  assert.equal(blockMinutes(longer), 120);
  assert.equal(blockMinutes(resizeBlock(b, at(1, 13), later)), 15, "dragging the end above the start leaves the shortest block");
});

test("a changed block replaces the old one; a new one is added; a removed one goes", () => {
  const a = makeBlock("a", task, at(1, 9), 60, NOW);
  const b = makeBlock("b", task, at(1, 11), 60, NOW);
  const moved = moveBlock(a, at(1, 10), NOW);
  assert.deepEqual(putBlock([a, b], moved).map((x) => x.start), [moved.start, b.start]);
  assert.equal(putBlock([a], b).length, 2);
  assert.deepEqual(dropBlock([a, b], "a").map((x) => x.id), ["b"]);
});
