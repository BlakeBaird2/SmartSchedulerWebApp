import assert from "node:assert/strict";
import test from "node:test";
import { ALL, deletedOnes, deleteEvent, MAX_DELETED, sanitizeDeletedEvents, sanitizeDeletedTasks, withoutDeleted } from "../deleted";
import type { CalEvent } from "../types";

// Tests run with TZ=America/Denver.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const event = (id: string, d: number, h: number): CalEvent => ({
  id, feedId: "c", courseId: "c:cs", title: "CS 142", start: at(d, h).toISOString(), end: at(d, h + 1).toISOString(),
  allDay: false, busy: true, kind: "class", location: null, url: null, color: "#000", source: "feed",
});
const mon = event("c:cs@2026-11-02", 2, 11);
const wed = event("c:cs@2026-11-04", 4, 11);
const party = event("c:party", 6, 19);

test("deleting one meeting of a class leaves the others", () => {
  assert.deepEqual(withoutDeleted([mon, wed, party], deleteEvent({}, mon)), [wed, party]);
});

test("deleting every one takes the whole series and nothing else", () => {
  const deleted = deleteEvent({}, mon, "all");
  assert.deepEqual(deleted, { "c:cs": ALL });
  assert.deepEqual(withoutDeleted([mon, wed, party], deleted), [party]);
  assert.deepEqual(deletedOnes([mon, wed, party], deleted), [{ event: mon, key: "c:cs", all: true }]);
});

test("an event that doesn't repeat is deleted on its own, even when every one is asked for", () => {
  const deleted = deleteEvent({}, party, "all");
  assert.equal(deleted[party.id], party.start);
  assert.deepEqual(withoutDeleted([mon, party], deleted), [mon]);
  assert.deepEqual(deletedOnes([mon, party], deleted), [{ event: party, key: party.id, all: false }]);
});

test("a deleted event shows again if its calendar moves it", () => {
  const moved = { ...mon, start: at(2, 14).toISOString(), end: at(2, 15).toISOString() };
  assert.deepEqual(withoutDeleted([moved], deleteEvent({}, mon)), [moved]);
});

test("an event moved in Schedule Smart is deleted at its calendar time", () => {
  const moved = { ...mon, start: at(2, 14).toISOString(), end: at(2, 15).toISOString(), original: { start: mon.start, end: mon.end } };
  assert.equal(deleteEvent({}, moved)[mon.id], mon.start);
  assert.deepEqual(withoutDeleted([mon], deleteEvent({}, moved)), []);
});

test("damaged entries are dropped, series are kept, and the newest single events are kept", () => {
  assert.deepEqual(sanitizeDeletedEvents(null), {});
  assert.deepEqual(sanitizeDeletedEvents([1]), {});
  assert.deepEqual(sanitizeDeletedEvents({ a: "nope", b: 3, "": at(2, 1).toISOString(), ok: at(2, 1).toISOString(), s: ALL }), { ok: at(2, 1).toISOString(), s: ALL });
  const many: Record<string, string> = Object.fromEntries(Array.from({ length: MAX_DELETED + 5 }, (_, i) => [`e${i}`, new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString()]));
  many.series = ALL;
  const kept = sanitizeDeletedEvents(many);
  assert.equal(Object.keys(kept).length, MAX_DELETED);
  assert.equal(kept.series, ALL, "series kept");
  assert.ok(kept[`e${MAX_DELETED + 4}`], "newest kept");
  assert.equal(kept.e0, undefined, "oldest dropped");
});

test("deleted tasks keep only real times", () => {
  assert.deepEqual(sanitizeDeletedTasks({ a: at(2, 1).toISOString(), b: "x", c: 4 }), { a: at(2, 1).toISOString() });
});
