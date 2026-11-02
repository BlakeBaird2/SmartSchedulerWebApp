import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutStack } from "../layout";

type Item = { id: string; s: number; e: number };
/** Minutes in, [left, width, z] out (rounded), with a 30-minute side-by-side window. */
const place = (items: Item[]) =>
  Object.fromEntries(
    layoutStack(items, (i) => i.s, (i) => i.e, 30).map((p) => [p.item.id, [Math.round(p.left * 100) / 100, Math.round(p.width * 100) / 100, p.z]]),
  );

test("items that don't overlap each take the full width", () => {
  const r = place([
    { id: "a", s: 0, e: 60 },
    { id: "b", s: 60, e: 120 },
  ]);
  assert.deepEqual(r.a.slice(0, 2), [0, 1]);
  assert.deepEqual(r.b.slice(0, 2), [0, 1]);
});

test("items starting together sit side by side, the longer one first", () => {
  const r = place([
    { id: "short", s: 0, e: 30 },
    { id: "long", s: 0, e: 120 },
  ]);
  assert.deepEqual(r.long.slice(0, 2), [0, 0.5]);
  assert.deepEqual(r.short.slice(0, 2), [0.5, 0.5]);
});

test("items starting within the window sit side by side too", () => {
  const r = place([
    { id: "a", s: 0, e: 120 },
    { id: "b", s: 15, e: 45 },
  ]);
  assert.deepEqual(r.a.slice(0, 2), [0, 0.5]);
  assert.deepEqual(r.b.slice(0, 2), [0.5, 0.5]);
});

test("a shorter item starting inside a longer one goes on top of it, nearly full width", () => {
  const r = place([
    { id: "long", s: 0, e: 180 },
    { id: "short", s: 60, e: 120 },
  ]);
  assert.deepEqual(r.long, [0, 1, 1]);
  assert.deepEqual(r.short, [0.15, 0.85, 2]);
});

test("items inside the same one, starting together, share the space on top of it", () => {
  const r = place([
    { id: "long", s: 0, e: 180 },
    { id: "x", s: 60, e: 120 },
    { id: "y", s: 60, e: 90 },
  ]);
  assert.deepEqual(r.x.slice(0, 2), [0.15, 0.43]);
  assert.deepEqual(r.y.slice(0, 2), [0.57, 0.43]);
});

test("each item further in the stack sits a little further in, up to a limit", () => {
  const r = place([
    { id: "a", s: 0, e: 600 },
    { id: "b", s: 60, e: 600 },
    { id: "c", s: 120, e: 600 },
    { id: "d", s: 180, e: 600 },
    { id: "e", s: 240, e: 600 },
  ]);
  assert.deepEqual(r.b.slice(0, 2), [0.15, 0.85]);
  assert.deepEqual(r.c.slice(0, 2), [0.3, 0.7]);
  assert.deepEqual(r.d.slice(0, 2), [0.45, 0.55]);
  assert.deepEqual(r.e.slice(0, 2), [0.45, 0.55]);
  assert.ok(r.e[2] > r.d[2] && r.d[2] > r.c[2]);
});

test("a long item starting inside a short one only steps in once, and keeps that width", () => {
  const r = place([
    { id: "short", s: 0, e: 60 },
    { id: "long", s: 45, e: 300 },
  ]);
  assert.deepEqual(r.long.slice(0, 2), [0.15, 0.85]);
});

test("starting close to any item it overlaps puts it beside that one", () => {
  const r = place([
    { id: "a", s: 0, e: 300 },
    { id: "b", s: 60, e: 200 },
    { id: "c", s: 80, e: 120 },
  ]);
  assert.deepEqual(r.b.slice(0, 2), [0.15, 0.43]);
  assert.deepEqual(r.c.slice(0, 2), [0.57, 0.43]);
});

test("once the ones it overlapped have ended, the next item takes the full width again", () => {
  const r = place([
    { id: "a", s: 0, e: 120 },
    { id: "b", s: 60, e: 90 },
    { id: "c", s: 150, e: 200 },
  ]);
  assert.deepEqual(r.c.slice(0, 2), [0, 1]);
});
