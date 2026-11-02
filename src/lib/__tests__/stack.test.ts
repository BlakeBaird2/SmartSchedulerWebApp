import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutStack, STACK_STEP_PX as S } from "../layout";

type Item = { id: string; s: number; e: number };
const r2 = (x: number) => Math.round(x * 100) / 100;
/** Minutes in; [left share, left px, width share, width px, z] out, with a 42-minute side-by-side window. */
const place = (items: Item[]) =>
  Object.fromEntries(
    layoutStack(items, (i) => i.s, (i) => i.e, 42).map((p) => [p.item.id, [r2(p.left), r2(p.leftPx), r2(p.width), r2(p.widthPx), p.z]]),
  );

test("items that don't overlap each take the full width", () => {
  const r = place([
    { id: "a", s: 0, e: 60 },
    { id: "b", s: 60, e: 120 },
  ]);
  assert.deepEqual(r.a.slice(0, 4), [0, 0, 1, 0]);
  assert.deepEqual(r.b.slice(0, 4), [0, 0, 1, 0]);
});

// Google Calendar, Monday: Work 1:50-5, two items at 2:30, then one at 3:30 inside Work.
test("items starting close together share columns, each reaching under the next", () => {
  const r = place([
    { id: "work", s: 110, e: 300 },
    { id: "video", s: 150, e: 165 },
    { id: "zions", s: 150, e: 170 },
    { id: "shirt", s: 210, e: 270 },
  ]);
  assert.deepEqual(r.work.slice(0, 4), [0, 0, 0.57, 0]);
  assert.deepEqual(r.zions.slice(0, 4), [0.33, 0, 0.57, 0]);
  assert.deepEqual(r.video.slice(0, 4), [0.67, 0, 0.33, 0]);
  assert.ok(r.video[4] > r.zions[4] && r.zions[4] > r.work[4]);
});

test("an item starting later, inside another, goes on top of it and runs to the right edge", () => {
  const r = place([
    { id: "work", s: 110, e: 300 },
    { id: "video", s: 150, e: 165 },
    { id: "zions", s: 150, e: 170 },
    { id: "shirt", s: 210, e: 270 },
  ]);
  assert.deepEqual(r.shirt, [0, S, 1, -S, 4]);
});

// Google Calendar, Tuesday: an interview at 3:30-4:30 beside two half-hour ones.
test("a column is reused once its item has ended", () => {
  const r = place([
    { id: "ncino", s: 0, e: 60 },
    { id: "first", s: 0, e: 30 },
    { id: "second", s: 30, e: 60 },
  ]);
  assert.deepEqual(r.ncino.slice(0, 4), [0, 0, 0.85, 0]);
  assert.deepEqual(r.first.slice(0, 4), [0.5, 0, 0.5, 0]);
  assert.deepEqual(r.second.slice(0, 4), [0.5, 0, 0.5, 0]);
});

test("items starting together sit in columns, the longer one first", () => {
  const r = place([
    { id: "short", s: 0, e: 30 },
    { id: "long", s: 0, e: 120 },
  ]);
  assert.deepEqual(r.long.slice(0, 4), [0, 0, 0.85, 0]);
  assert.deepEqual(r.short.slice(0, 4), [0.5, 0, 0.5, 0]);
});

test("items starting together on top of another share the space from just inside it to the right edge", () => {
  const r = place([
    { id: "long", s: 0, e: 180 },
    { id: "x", s: 60, e: 120 },
    { id: "y", s: 60, e: 90 },
  ]);
  assert.deepEqual(r.x.slice(0, 4), [0, S, 0.85, -0.85 * S]);
  assert.deepEqual(r.y.slice(0, 4), [0.5, S / 2, 0.5, -S / 2]);
});

test("each item further up the stack steps in again, up to a limit", () => {
  const r = place([
    { id: "a", s: 0, e: 600 },
    { id: "b", s: 60, e: 600 },
    { id: "c", s: 120, e: 600 },
    { id: "d", s: 180, e: 600 },
    { id: "e", s: 240, e: 600 },
    { id: "f", s: 300, e: 600 },
  ]);
  assert.deepEqual(r.c.slice(0, 4), [0, 2 * S, 1, -2 * S]);
  assert.deepEqual(r.e.slice(0, 4), [0, 4 * S, 1, -4 * S]);
  assert.deepEqual(r.f.slice(0, 4), [0, 4 * S, 1, -4 * S]);
  assert.ok(r.f[4] > r.e[4] && r.e[4] > r.d[4]);
});

test("on top of the right-hand of two columns, it starts just inside that one", () => {
  const r = place([
    { id: "left", s: 0, e: 180 },
    { id: "right", s: 0, e: 150 },
    { id: "late", s: 90, e: 120 },
  ]);
  assert.deepEqual(r.late.slice(0, 4), [0.5, S, 0.5, -S]);
});

test("once the ones it overlapped have ended, the next item takes the full width again", () => {
  const r = place([
    { id: "a", s: 0, e: 120 },
    { id: "b", s: 60, e: 90 },
    { id: "c", s: 150, e: 200 },
  ]);
  assert.deepEqual(r.c.slice(0, 4), [0, 0, 1, 0]);
});
