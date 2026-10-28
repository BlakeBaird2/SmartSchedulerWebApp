import assert from "node:assert/strict";
import test from "node:test";
import { addNewWork, MAX_NEW, newIds, parseNewWork, seeWork, NEW_RETENTION } from "../newWork";
import { diffFeed } from "../changes";
import type { Change, FeedResult } from "../types";

const NOW = new Date(2026, 9, 1, 12);
const iso = (d: Date) => d.toISOString();

function change(kind: Change["kind"], taskId: string, at = NOW): Change {
  return { id: `${kind}:${taskId}:${iso(at)}`, at: iso(at), kind, taskId, courseId: "f:cs", title: taskId, from: null, to: iso(at) };
}

function feedResult(tasks: { uid: string; courseKey?: string; generated?: "study" }[]): FeedResult {
  return {
    url: "https://a.example/cal.ics",
    provider: "canvas",
    role: "school",
    name: "Canvas",
    fetchedAt: iso(NOW),
    courses: [],
    events: [],
    tasks: tasks.map((t) => ({
      uid: t.uid,
      courseKey: t.courseKey ?? "cs",
      title: t.uid,
      type: "assignment",
      dueAt: iso(new Date(2026, 9, 5, 23, 59)),
      allDay: false,
      url: null,
      description: null,
      ...(t.generated ? { generated: t.generated } : {}),
    })),
    warnings: [],
  } as unknown as FeedResult;
}

test("work a sync adds is new; due date moves and removals are not", () => {
  const work = addNewWork({}, [change("added", "f:a"), change("due_changed", "f:b"), change("removed", "f:c")], NOW);
  assert.deepEqual(Object.keys(work), ["f:a"]);
  assert.deepEqual([...newIds(work, NOW)], ["f:a"]);
});

test("only work added after a calendar's first read counts, as with the bell", () => {
  const first = diffFeed("f", null, feedResult([{ uid: "a" }, { uid: "b" }]), NOW);
  assert.deepEqual(addNewWork({}, first, NOW), {}, "the first read brings nothing new");
  const later = diffFeed("f", feedResult([{ uid: "a" }]), feedResult([{ uid: "a" }, { uid: "b" }, { uid: "x", courseKey: "brand-new-class" }]), NOW);
  assert.deepEqual(Object.keys(addNewWork({}, later, NOW)), ["f:b"], "a whole new class isn't news");
});

test("work keeps when it first showed up", () => {
  const earlier = new Date(NOW.getTime() - 86_400_000);
  const work = addNewWork({ "f:a": iso(earlier) }, [change("added", "f:a")], NOW);
  assert.equal(work["f:a"], iso(earlier));
});

test("seeing work clears it", () => {
  const work = addNewWork({}, [change("added", "f:a"), change("added", "f:b")], NOW);
  assert.deepEqual(Object.keys(seeWork(work, ["f:a", "f:unknown"])), ["f:b"]);
});

test("new fades after two weeks, and the list is capped", () => {
  const old = new Date(NOW.getTime() - NEW_RETENTION - 60_000);
  const work = { "f:old": iso(old), "f:fresh": iso(NOW) };
  assert.deepEqual([...newIds(work, NOW)], ["f:fresh"]);
  const many = Array.from({ length: MAX_NEW + 5 }, (_, i) => change("added", `f:${i}`, new Date(NOW.getTime() - i * 60_000)));
  const capped = addNewWork({}, many, NOW);
  assert.equal(Object.keys(capped).length, MAX_NEW);
  assert.ok(capped["f:0"] && !capped[`f:${MAX_NEW + 4}`], "the newest are kept");
});

test("stored new work loads checked", () => {
  assert.deepEqual(parseNewWork(null), {});
  assert.deepEqual(parseNewWork("not json"), {});
  assert.deepEqual(parseNewWork("[1,2]"), {});
  assert.deepEqual(parseNewWork(JSON.stringify({ "f:a": iso(NOW), "f:b": "yesterday", "f:c": 5 })), { "f:a": iso(NOW) });
});
