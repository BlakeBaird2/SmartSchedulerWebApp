import assert from "node:assert/strict";
import test from "node:test";
import { applyEventMoves, sanitizeEventMoves, withEventAt } from "../eventMoves";
import type { CalEvent } from "../types";

// Tests run with TZ=America/Denver.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const gym: CalEvent = {
  id: "g:gym@1", feedId: "g", courseId: null, title: "Gym", start: at(3, 7).toISOString(), end: at(3, 8).toISOString(),
  allDay: false, busy: true, kind: "event", location: null, url: null, color: "#000", source: "feed",
};

test("a moved event shows at its new time and remembers its calendar time", () => {
  const moves = withEventAt({}, gym, at(3, 15), at(3, 16));
  const [moved] = applyEventMoves([gym], moves);
  assert.equal(moved.start, at(3, 15).toISOString());
  assert.equal(moved.end, at(3, 16).toISOString());
  assert.deepEqual(moved.original, { start: gym.start, end: gym.end });
});

test("moving it again keeps the calendar time, and putting it back forgets the move", () => {
  let moves = withEventAt({}, gym, at(3, 15), at(3, 16));
  const [moved] = applyEventMoves([gym], moves);
  moves = withEventAt(moves, moved, at(4, 9), at(4, 10, 30));
  assert.equal(moves[gym.id].from, gym.start, "still the calendar's time");
  const [again] = applyEventMoves([gym], moves);
  moves = withEventAt(moves, again, at(3, 7), at(3, 8));
  assert.deepEqual(moves, {});
});

test("when the calendar itself changes the event, the calendar's new time wins", () => {
  const moves = withEventAt({}, gym, at(3, 15), at(3, 16));
  const changed = { ...gym, start: at(3, 9).toISOString(), end: at(3, 10).toISOString() };
  const [shown] = applyEventMoves([changed], moves);
  assert.equal(shown.start, changed.start);
  assert.equal(shown.original, undefined);
});

test("all-day events aren't moved, and damaged moves are dropped", () => {
  const allDay = { ...gym, allDay: true };
  assert.equal(applyEventMoves([allDay], withEventAt({}, gym, at(3, 15), at(3, 16)))[0].start, gym.start);
  const clean = sanitizeEventMoves({ ok: { from: gym.start, fromEnd: gym.end, start: at(3, 15).toISOString(), end: at(3, 16).toISOString() }, bad: { from: "x" }, backwards: { from: gym.start, fromEnd: gym.end, start: at(3, 16).toISOString(), end: at(3, 15).toISOString() } });
  assert.deepEqual(Object.keys(clean), ["ok"]);
});
