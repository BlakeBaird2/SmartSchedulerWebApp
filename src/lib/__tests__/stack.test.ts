import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutStack, STACK_STEP_PX as S } from "../layout";

type Item = { id: string; s: number; e: number };
const r2 = (x: number) => Math.round(x * 100) / 100;
/** Minutes in; [left share, left px, width share, width px, z] out, with a 30-minute side-by-side window. */
const place = (items: Item[]) =>
  Object.fromEntries(
    layoutStack(items, (i) => i.s, (i) => i.e, 30).map((p) => [p.item.id, [r2(p.left), r2(p.leftPx), r2(p.width), r2(p.widthPx), p.z]]),
  );

test("items that don't overlap each take the full width", () => {
  const r = place([
    { id: "a", s: 0, e: 60 },
    { id: "b", s: 60, e: 120 },
  ]);
  assert.deepEqual(r.a.slice(0, 4), [0, 0, 1, 0]);
  assert.deepEqual(r.b.slice(0, 4), [0, 0, 1, 0]);
});

test("items starting together sit side by side, the longer one first", () => {
  const r = place([
    { id: "short", s: 0, e: 30 },
    { id: "long", s: 0, e: 120 },
  ]);
  assert.deepEqual(r.long.slice(0, 4), [0, 0, 0.5, 0]);
  assert.deepEqual(r.short.slice(0, 4), [0.5, 0, 0.5, 0]);
});

test("items starting within the window sit side by side too", () => {
  const r = place([
    { id: "a", s: 0, e: 120 },
    { id: "b", s: 15, e: 45 },
  ]);
  assert.deepEqual(r.b.slice(0, 4), [0.5, 0, 0.5, 0]);
});

test("an item starting inside a longer one goes on top, as wide as it but a few pixels in", () => {
  const r = place([
    { id: "long", s: 0, e: 180 },
    { id: "short", s: 60, e: 120 },
  ]);
  assert.deepEqual(r.long, [0, 0, 1, 0, 1]);
  assert.deepEqual(r.short, [0, S, 1, -S, 2]);
});

test("items inside the same one, starting together, share its width on top of it", () => {
  const r = place([
    { id: "long", s: 0, e: 180 },
    { id: "x", s: 60, e: 120 },
    { id: "y", s: 60, e: 90 },
  ]);
  assert.deepEqual(r.x.slice(0, 4), [0, S, 0.5, -S / 2]);
  assert.deepEqual(r.y.slice(0, 4), [0.5, S / 2, 0.5, -S / 2]);
});

test("each item further in the stack steps in again, up to a limit", () => {
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

test("an item on top of one of two side-by-side items stays as wide as that one", () => {
  const r = place([
    { id: "left", s: 0, e: 180 },
    { id: "right", s: 0, e: 40 },
    { id: "late", s: 90, e: 120 },
  ]);
  assert.deepEqual(r.late.slice(0, 4), [0, S, 0.5, -S]);
});

test("starting close to any item it overlaps puts it beside that one", () => {
  const r = place([
    { id: "a", s: 0, e: 300 },
    { id: "b", s: 60, e: 200 },
    { id: "c", s: 80, e: 120 },
  ]);
  assert.deepEqual(r.b.slice(0, 4), [0, S, 0.5, -S / 2]);
  assert.deepEqual(r.c.slice(0, 4), [0.5, S / 2, 0.5, -S / 2]);
});

test("once the ones it overlapped have ended, the next item takes the full width again", () => {
  const r = place([
    { id: "a", s: 0, e: 120 },
    { id: "b", s: 60, e: 90 },
    { id: "c", s: 150, e: 200 },
  ]);
  assert.deepEqual(r.c.slice(0, 4), [0, 0, 1, 0]);
});
