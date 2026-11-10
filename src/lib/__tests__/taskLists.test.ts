import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LISTS, LIST_COLORS, MAX_LISTS, inAreas, inDays, listColor, newList, parseLists } from "../taskLists";
import type { Task } from "../types";

// Tests run with TZ=America/Denver. October 1, 2026 is a Thursday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const NOW = at(1, 12);

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t",
    feedId: "f",
    courseId: "f:cs",
    title: "t",
    type: "assignment",
    dueAt: null,
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

test("split view starts with school for the week beside life's plan", () => {
  assert.deepEqual(
    DEFAULT_LISTS.map((l) => [l.name, l.areas, l.show, l.days]),
    [
      ["School", ["school"], "all", 7],
      ["Life", ["personal"], "planned", 7],
    ],
  );
});

test("stored lists are checked, and capped", () => {
  assert.deepEqual(parseLists(undefined), DEFAULT_LISTS);
  assert.deepEqual(parseLists([]), DEFAULT_LISTS);
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `l${i}`, name: `L${i}`, show: "planned", areas: null, days: 14 }));
  assert.equal(parseLists(many).length, MAX_LISTS);
  const [l] = parseLists([{ id: "x", name: 5, show: "nope", areas: [], days: 3 }, { id: "x" }, null]);
  assert.deepEqual(l, { id: "x", name: "List", show: "all", areas: null, days: 7, color: null });
  assert.equal(parseLists([{ id: "y", days: null }])[0].days, null, "any time");
  assert.equal(parseLists([{ id: "y", color: LIST_COLORS[2] }])[0].color, LIST_COLORS[2]);
  assert.equal(parseLists([{ id: "y", color: "url(x)" }])[0].color, null, "only the list colours");
});

test("a new list gets a name not already taken", () => {
  assert.equal(newList(DEFAULT_LISTS, "n").name, "List 3");
  assert.equal(newList([...DEFAULT_LISTS, { ...DEFAULT_LISTS[0], id: "z", name: "List 3" }], "n").name, "List 4");
});

test("lists pick work by class, all of school, or personal", () => {
  const cs = task();
  const mine = task({ manual: true, courseId: null });
  const forClass = task({ manual: true, courseId: "f:bio" });
  assert.equal(inAreas(null, mine), true);
  assert.equal(inAreas(["school"], cs), true);
  assert.equal(inAreas(["school"], forClass), true, "added by hand for a class");
  assert.equal(inAreas(["school"], mine), false);
  assert.equal(inAreas(["personal"], mine), true);
  assert.equal(inAreas(["personal"], cs), false);
  assert.equal(inAreas(["f:bio"], cs), false);
  assert.equal(inAreas(["f:bio", "personal"], forClass), true);
});

test("a list's days count today as the first; earlier and undated work always shows", () => {
  assert.equal(inDays(at(7, 23).toISOString(), NOW, 7), true);
  assert.equal(inDays(at(8, 0).toISOString(), NOW, 7), false);
  assert.equal(inDays(at(20, 9).toISOString(), NOW, 30), true);
  assert.equal(inDays(at(1, 8).toISOString(), NOW, 7), true, "earlier today");
  assert.equal(inDays(null, NOW, 7), true, "no date");
  assert.equal(inDays(at(30, 0).toISOString(), NOW, null), true, "any time");
});

test("each list has a colour of its own: the one picked, or the one for its place", () => {
  const [a, b] = DEFAULT_LISTS;
  assert.equal(listColor(a, 0), LIST_COLORS[0]);
  assert.equal(listColor(b, 1), LIST_COLORS[1]);
  assert.notEqual(listColor(a, 0), listColor(b, 1));
  assert.equal(listColor({ ...a, color: LIST_COLORS[3] }, 0), LIST_COLORS[3]);
});
