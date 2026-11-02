import assert from "node:assert/strict";
import test from "node:test";
import { cancelEvent, MAX_CANCELLED, sanitizeCancelled, withoutCancelled } from "../cancelled";
import type { CalEvent } from "../types";

// Tests run with TZ=America/Denver.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const event = (id: string, d: number, h: number): CalEvent => ({
  id, feedId: "c", courseId: "c:cs", title: "CS 142", start: at(d, h).toISOString(), end: at(d, h + 1).toISOString(),
  allDay: false, busy: true, kind: "class", location: null, url: null, color: "#000", source: "feed",
});

test("cancelling one meeting of a class leaves the others", () => {
  const mon = event("c:cs@2026-11-02", 2, 11);
  const wed = event("c:cs@2026-11-04", 4, 11);
  const cancelled = cancelEvent({}, mon);
  assert.deepEqual(withoutCancelled([mon, wed], cancelled), [wed]);
});

test("a cancelled event shows again if its calendar moves it", () => {
  const mon = event("c:cs@2026-11-02", 2, 11);
  const cancelled = cancelEvent({}, mon);
  const moved = { ...mon, start: at(2, 14).toISOString(), end: at(2, 15).toISOString() };
  assert.deepEqual(withoutCancelled([moved], cancelled), [moved]);
});

test("an event moved in Schedule Smart is cancelled at its calendar time", () => {
  const mon = event("c:cs@2026-11-02", 2, 11);
  const moved = { ...mon, start: at(2, 14).toISOString(), end: at(2, 15).toISOString(), original: { start: mon.start, end: mon.end } };
  assert.equal(cancelEvent({}, moved)[mon.id], mon.start);
  assert.deepEqual(withoutCancelled([mon], cancelEvent({}, moved)), []);
});

test("damaged entries are dropped and the newest are kept", () => {
  assert.deepEqual(sanitizeCancelled(null), {});
  assert.deepEqual(sanitizeCancelled([1]), {});
  assert.deepEqual(sanitizeCancelled({ a: "nope", b: 3, "": at(2, 1).toISOString(), ok: at(2, 1).toISOString() }), { ok: at(2, 1).toISOString() });
  const many = Object.fromEntries(Array.from({ length: MAX_CANCELLED + 5 }, (_, i) => [`e${i}`, new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString()]));
  const kept = sanitizeCancelled(many);
  assert.equal(Object.keys(kept).length, MAX_CANCELLED);
  assert.ok(kept[`e${MAX_CANCELLED + 4}`], "newest kept");
  assert.equal(kept.e0, undefined, "oldest dropped");
});
