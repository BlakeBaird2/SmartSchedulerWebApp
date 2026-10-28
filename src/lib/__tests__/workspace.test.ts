import assert from "node:assert/strict";
import test from "node:test";
import { decodeSetup, defaultWorkspace, encodeSetup, pastDueIds, sanitizeWorkspace } from "../workspace";
import { buildModel, busyIntervals, expandWeekly, parseWeeklyId } from "../model";
import { daysLabel, meetingPatterns } from "../meetings";
import { diffFeed, mergeChanges } from "../changes";
import { syncAll } from "../sync";
import { feedIdFor } from "../feeds/url";
import type { FeedResult, Snapshot, Workspace } from "../types";

const NOW = new Date(2026, 9, 1, 12); // Thursday Oct 1, noon (TZ=America/Denver)

function feed(url: string, role: "school" | "personal" = "school") {
  return { id: feedIdFor(url), url, name: url, role, provider: "other" as const, color: "#64748b", enabled: true };
}

function result(over: Partial<FeedResult> = {}): FeedResult {
  return {
    url: "https://a.example/cal.ics",
    provider: "canvas",
    role: "school",
    calendarName: null,
    fetchedAt: NOW.toISOString(),
    courses: [
      { key: "course_1", code: "CS 260", title: "Web Programming", url: null },
      { key: "course_2", code: "MGMT 320", title: "MGMT 320", url: null },
    ],
    tasks: [
      { uid: "a1", courseKey: "course_1", title: "Quiz 3", type: "quiz", dueAt: "2026-10-02T23:00:00.000Z", allDay: false, url: null, description: null },
      { uid: "a2", courseKey: "course_2", title: "Case 1", type: "assignment", dueAt: "2026-10-03T16:00:00.000Z", allDay: false, url: null, description: null },
    ],
    events: [
      { uid: "e1", courseKey: "course_1", title: "Class", start: "2026-10-01T20:00:00.000Z", end: "2026-10-01T21:15:00.000Z", allDay: false, busy: true, kind: "class", location: null, url: null },
    ],
    skipped: 0,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Loading stored data safely
// ---------------------------------------------------------------------------

test("garbage and old data load as a usable workspace", () => {
  assert.deepEqual(sanitizeWorkspace(null), defaultWorkspace());
  assert.deepEqual(sanitizeWorkspace("nonsense"), defaultWorkspace());
  const ws = sanitizeWorkspace({
    feeds: [{ url: "https://a.example/cal.ics", role: "personal" }, { url: "" }, { url: "https://a.example/cal.ics" }],
    weekly: [
      { label: "Class", days: [1, 3, 9], start: "09:00", end: "09:50" },
      { label: "Backwards", days: [1], start: "10:00", end: "09:00" },
    ],
    estimates: { x: 45, y: -3, z: "60" },
    prefs: { dayStart: 900, dayEnd: 100, dailyMax: 99999, estimates: { quiz: 20 } },
  });
  assert.equal(ws.feeds.length, 1, "blank and duplicate links are dropped");
  assert.equal(ws.feeds[0].id, feedIdFor("https://a.example/cal.ics"), "ids come from the link, not stored data");
  assert.equal(ws.weekly.length, 1);
  assert.deepEqual(ws.weekly[0].days, [1, 3], "an impossible weekday is dropped");
  assert.deepEqual(ws.estimates, { x: { minutes: 45, source: "user" } }, "old bare minutes become the student's own estimate");
  assert.equal(ws.prefs.dayStart, 8 * 60, "an inverted working day falls back to the default");
  assert.equal(ws.prefs.dailyMax, 24 * 60);
  assert.equal(ws.prefs.estimates.quiz, 20);
  assert.equal(ws.prefs.estimates.exam, 180);
});

test("a setup link carries everything to another device", () => {
  const ws: Workspace = { ...defaultWorkspace(), feeds: [feed("https://a.example/cal.ics")], done: { "x:1": "2026-10-01T00:00:00Z" }, estimates: { "x:2": { minutes: 90, source: "user" } } };
  const back = decodeSetup(encodeSetup(ws))!;
  assert.deepEqual(back.feeds, ws.feeds);
  assert.deepEqual(back.done, ws.done);
  assert.deepEqual(back.estimates, ws.estimates);
  assert.equal(decodeSetup("not-a-setup"), null);
  assert.equal(decodeSetup(encodeSetup(defaultWorkspace())), null, "a setup with no calendars is not worth importing");
});

// ---------------------------------------------------------------------------
// Building the model
// ---------------------------------------------------------------------------

test("classes, work and busy time come together from every feed", () => {
  const school = feed("https://a.example/cal.ics");
  const personal = feed("https://p.example/cal.ics", "personal");
  const ws: Workspace = { ...defaultWorkspace(), feeds: [school, personal] };
  const snapshot: Snapshot = {
    at: null,
    feeds: {
      [school.id]: { result: result(), error: null, syncedAt: null },
      [personal.id]: {
        result: result({
          role: "personal",
          courses: [],
          tasks: [],
          events: [{ uid: "w", courseKey: null, title: "Work", start: "2026-10-01T15:00:00.000Z", end: "2026-10-01T19:00:00.000Z", allDay: false, busy: true, kind: "event", location: null, url: null }],
        }),
        error: null,
        syncedAt: null,
      },
    },
  };
  const m = buildModel(ws, snapshot, NOW);
  assert.deepEqual(m.courses.map((c) => c.code), ["CS 260", "MGMT 320"]);
  assert.notEqual(m.courses[0].color, m.courses[1].color, "every class gets its own colour");
  assert.equal(m.tasks.length, 2);
  assert.equal(m.tasks[0].id, `${school.id}:a1`);
  assert.equal(m.tasks[0].estimate, 30, "a quiz defaults to 30 minutes");
  assert.equal(m.events.length, 2);
  assert.equal(busyIntervals(m.events).length, 2);
  const classEvent = m.events.find((e) => e.courseId)!;
  assert.equal(classEvent.color, m.courseById.get(classEvent.courseId!)!.color, "class meetings wear their class colour");
});

test("the user's renames, estimates, done marks and hidden classes all apply", () => {
  const school = feed("https://a.example/cal.ics");
  const courseId = `${school.id}:course_2`;
  const ws: Workspace = {
    ...defaultWorkspace(),
    feeds: [school],
    courseEdits: { [courseId]: { title: "Organizational Effectiveness", color: "#123456" }, [`${school.id}:course_1`]: { hidden: true } },
    estimates: { [`${school.id}:a2`]: { minutes: 95, source: "user" } },
    done: { [`${school.id}:a2`]: NOW.toISOString() },
  };
  const m = buildModel(ws, { at: null, feeds: { [school.id]: { result: result(), error: null, syncedAt: null } } }, NOW);
  const hrm = m.courseById.get(courseId)!;
  assert.equal(hrm.title, "Organizational Effectiveness");
  assert.equal(hrm.color, "#123456");
  assert.deepEqual(m.visibleCourses.map((c) => c.id), [courseId]);
  assert.deepEqual(m.tasks.map((t) => t.title), ["Case 1"], "work from a hidden class disappears");
  assert.equal(m.tasks[0].estimate, 95);
  assert.equal(m.tasks[0].customEstimate, true);
  assert.equal(m.tasks[0].estimateSource, "user");
  assert.equal(m.tasks[0].done, true);
  assert.equal(m.events.length, 0, "and so do its class meetings");
});

test("a personal calendar never contributes homework, even if its feed has some", () => {
  const personal = feed("https://p.example/cal.ics", "personal");
  const ws: Workspace = { ...defaultWorkspace(), feeds: [personal] };
  const m = buildModel(ws, { at: null, feeds: { [personal.id]: { result: result(), error: null, syncedAt: null } } }, NOW);
  assert.equal(m.tasks.length, 0);
  assert.equal(m.courses.length, 0);
});

test("weekly blocks repeat on their days", () => {
  const events = expandWeekly([{ id: "w", label: "Work", days: [2, 4], start: "13:00", end: "17:00" }], NOW, 0, 7);
  assert.deepEqual(
    events.map((e) => new Date(e.start).toDateString()),
    ["Thu Oct 01 2026", "Tue Oct 06 2026", "Thu Oct 08 2026"],
  );
  assert.equal(new Date(events[0].start).getHours(), 13);
  assert.ok(events.every((e) => e.busy));
});

test("work added by hand joins the rest", () => {
  const ws: Workspace = { ...defaultWorkspace(), manualTasks: [{ id: "m1", title: "Midterm #1", courseId: null, type: "exam", dueAt: "2026-10-07T16:00:00.000Z" }] };
  const m = buildModel(ws, { at: null, feeds: {} }, NOW);
  assert.equal(m.tasks[0].id, "manual:m1");
  assert.equal(m.tasks[0].estimate, 180);
  assert.equal(m.tasks[0].manual, true);
});

// ---------------------------------------------------------------------------
// Noticing changes
// ---------------------------------------------------------------------------

test("a moved due date, new work and deleted work are all noticed", () => {
  const before = result();
  const after = result({
    tasks: [
      { ...before.tasks[0], dueAt: "2026-10-04T23:00:00.000Z" },
      { uid: "a3", courseKey: "course_2", title: "New case", type: "assignment", dueAt: "2026-10-05T16:00:00.000Z", allDay: false, url: null, description: null },
    ],
  });
  const changes = diffFeed("f1", before, after, NOW);
  assert.deepEqual(changes.map((c) => [c.kind, c.title]).sort(), [["added", "New case"], ["due_changed", "Quiz 3"], ["removed", "Case 1"]]);
  const moved = changes.find((c) => c.kind === "due_changed")!;
  assert.equal(moved.from, "2026-10-02T23:00:00.000Z");
  assert.equal(moved.to, "2026-10-04T23:00:00.000Z");
  assert.equal(moved.taskId, "f1:a1");
});

test("the first read of a feed, and generated study time, are not news", () => {
  assert.deepEqual(diffFeed("f1", null, result(), NOW), []);
  const withStudy = result({ tasks: [...result().tasks, { uid: "study:x", courseKey: "course_1", title: "Study for Exam", type: "exam", dueAt: "2026-10-03T16:00:00.000Z", allDay: false, url: null, description: null, generated: "study" }] });
  assert.deepEqual(diffFeed("f1", result(), withStudy, NOW), []);
});

test("changes are kept newest first and old ones expire", () => {
  const old = { id: "old", at: "2026-08-01T00:00:00.000Z", kind: "added" as const, taskId: "t", courseId: null, title: "Old", from: null, to: null };
  const fresh = { ...old, id: "fresh", at: NOW.toISOString(), title: "Fresh" };
  assert.deepEqual(mergeChanges([fresh], [old], NOW).map((c) => c.id), ["fresh"]);
});

// ---------------------------------------------------------------------------
// Syncing
// ---------------------------------------------------------------------------

test("a failing calendar keeps its last copy and the others still refresh", async () => {
  const good = feed("https://good.example/cal.ics");
  const bad = feed("https://bad.example/cal.ics");
  const ws: Workspace = { ...defaultWorkspace(), feeds: [good, bad] };
  const previous: Snapshot = { at: null, feeds: { [bad.id]: { result: result(), error: null, syncedAt: "2026-09-30T00:00:00.000Z" } } };
  const outcome = await syncAll(
    ws,
    previous,
    async (url) => {
      if (url.includes("bad")) throw new Error("That calendar no longer exists.");
      return result();
    },
    "America/Denver",
    NOW,
  );
  assert.equal(outcome.failed, 1);
  assert.equal(outcome.snapshot.feeds[good.id].error, null);
  assert.ok(outcome.snapshot.feeds[good.id].result);
  assert.equal(outcome.snapshot.feeds[bad.id].error, "That calendar no longer exists.");
  assert.ok(outcome.snapshot.feeds[bad.id].result, "the last good copy survives");
  assert.equal(outcome.snapshot.feeds[bad.id].syncedAt, "2026-09-30T00:00:00.000Z");
});

test("a removed calendar leaves nothing behind", async () => {
  const gone = feed("https://gone.example/cal.ics");
  const outcome = await syncAll(defaultWorkspace(), { at: null, feeds: { [gone.id]: { result: result(), error: null, syncedAt: null } } }, async () => result(), "UTC", NOW);
  assert.deepEqual(outcome.snapshot.feeds, {});
});

test("work already past due when a calendar is added is picked out by id", () => {
  const result = {
    tasks: [
      { uid: "a", dueAt: "2026-09-01T12:00:00.000Z" },
      { uid: "b", dueAt: "2026-10-01T12:00:00.000Z" },
    ],
  };
  assert.deepEqual(pastDueIds("f1", result, new Date("2026-09-15T00:00:00.000Z")), ["f1:a"]);
});

// ---------------------------------------------------------------------------
// Class times
// ---------------------------------------------------------------------------

test("class times keep their class, room and skipped days through storage", () => {
  const ws = sanitizeWorkspace({
    weekly: [{ id: "c1", label: "Class", courseId: "f:course_1", location: " TMCB 1170 ", days: [1, 3], start: "09:30", end: "10:45", skip: ["2026-11-26", "bad", "2026-11-26"] }],
  });
  assert.deepEqual(ws.weekly[0], { id: "c1", label: "Class", courseId: "f:course_1", location: "TMCB 1170", days: [1, 3], start: "09:30", end: "10:45", skip: ["2026-11-26"] });
});

test("a class time shows as that class, in its colour, and a skipped day is left out", () => {
  const school = feed("https://school.example/cal.ics");
  const courseId = `${school.id}:course_1`;
  const ws: Workspace = {
    ...defaultWorkspace(),
    feeds: [school],
    courseEdits: { [courseId]: { color: "#123456" } },
    weekly: [{ id: "c1", label: "Class", courseId, days: [1, 3], start: "09:30", end: "10:45", skip: ["2026-10-05"] }],
  };
  const snapshot = {
    at: null,
    feeds: {
      [school.id]: {
        result: { url: school.url, provider: "canvas" as const, role: "school" as const, calendarName: null, fetchedAt: NOW.toISOString(), courses: [{ key: "course_1", code: "NET 460", title: "Network Security", url: null }], tasks: [], events: [], skipped: 0 },
        error: null,
        syncedAt: null,
      },
    },
  };
  const m = buildModel(ws, snapshot, NOW);
  const meetings = m.events.filter((e) => e.source === "weekly" && new Date(e.start) >= NOW && new Date(e.start) < new Date(NOW.getTime() + 8 * 86_400_000));
  assert.deepEqual(meetings.map((e) => new Date(e.start).toDateString()), ["Wed Oct 07 2026"], "Monday Oct 5 was skipped");
  assert.equal(meetings[0].title, "NET 460");
  assert.equal(meetings[0].color, "#123456");
  assert.equal(meetings[0].kind, "class");
  assert.ok(busyIntervals(m.events).some((b) => b.start.getTime() === Date.parse(meetings[0].start)), "class time is busy for the planner");
  assert.deepEqual(parseWeeklyId(meetings[0].id), { blockId: "c1", date: "2026-10-07" });

  const hidden = buildModel({ ...ws, courseEdits: { [courseId]: { hidden: true } } }, snapshot, NOW);
  assert.equal(hidden.events.filter((e) => e.source === "weekly").length, 0, "a hidden class's times go with it");
});

test("meetings already on a class calendar are described in plain words", () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  const ev = (start: string, end: string) => ({ id: start, feedId: "f", courseId: "c", title: "Class", start, end, allDay: false, busy: true, kind: "class" as const, location: null, url: null, color: "#000000", source: "feed" as const });
  const events = [ev(at(5, 9, 30), at(5, 10, 45)), ev(at(7, 9, 30), at(7, 10, 45)), ev(at(12, 9, 30), at(12, 10, 45))];
  assert.deepEqual(meetingPatterns(events, "c", NOW), [{ days: [1, 3], start: 570, end: 645, count: 3, key: "570-645" }]);
  assert.equal(daysLabel([3, 1]), "Mon, Wed");
  assert.equal(daysLabel([0, 2, 4]), "Tue, Thu, Sun");
  assert.equal(daysLabel([1, 2, 3, 4, 5]), "Weekdays");
});

test("a corrected class time hides the calendar's wrong meetings, and only those", () => {
  const school = feed("https://school.example/cal.ics");
  const courseId = `${school.id}:course_1`;
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  const meeting = (uid: string, start: string, end: string) => ({ uid, courseKey: "course_1", title: "NET 460: Network Security", start, end, allDay: false, busy: true, kind: "class" as const, location: null, url: null });
  const snapshot = {
    at: null,
    feeds: {
      [school.id]: {
        result: {
          url: school.url, provider: "canvas" as const, role: "school" as const, calendarName: null, fetchedAt: NOW.toISOString(),
          courses: [{ key: "course_1", code: "NET 460", title: "NET 460", url: null }],
          tasks: [],
          events: [meeting("m1", at(5, 9, 30), at(5, 12, 30)), meeting("m2", at(7, 9, 30), at(7, 12, 30)), meeting("review", at(8, 18), at(8, 19))],
          skipped: 0,
        },
        error: null,
        syncedAt: null,
      },
    },
  };
  const ws: Workspace = {
    ...defaultWorkspace(),
    feeds: [school],
    courseEdits: { [courseId]: { feedTimesOff: ["570-750"] } },
    weekly: [{ id: "fix", label: "Class", courseId, days: [1, 3], start: "09:30", end: "10:45" }],
  };
  const m = buildModel(ws, snapshot, NOW);
  const feedMeetings = m.events.filter((e) => e.source === "feed").map((e) => e.id.split(":").pop());
  assert.deepEqual(feedMeetings, ["review"], "the 9:30-12:30 meetings are hidden; the one-off review stays");
  const mine = m.events.find((e) => e.source === "weekly" && e.start === at(5, 9, 30));
  assert.equal(mine?.end, at(5, 10, 45), "the corrected time stands in");
  assert.deepEqual(sanitizeWorkspace(ws).courseEdits[courseId].feedTimesOff, ["570-750"], "the correction survives storage");
});

test("set-aside time loads checked, and broken blocks are dropped", () => {
  const ws = sanitizeWorkspace({
    blocks: [
      { id: "b1", taskId: "f:a1", title: "Quiz 3", start: "2026-10-02T15:00:00.000Z", end: "2026-10-02T16:00:00.000Z", color: "#d50000", externalId: "gcal-1" },
      { id: "b2", taskId: null, title: "Gym", start: "2026-10-02T18:00:00Z", end: "2026-10-02T19:00:00Z", color: "red" },
      { id: "backwards", start: "2026-10-02T18:00:00Z", end: "2026-10-02T17:00:00Z" },
      { id: "no-start", end: "2026-10-02T17:00:00Z" },
      "nonsense",
    ],
  });
  assert.deepEqual(
    ws.blocks.map((b) => [b.id, b.taskId, b.color, b.externalId]),
    [
      ["b1", "f:a1", "#d50000", "gcal-1"],
      ["b2", null, null, null],
    ],
  );
  assert.equal(ws.blocks[0].updatedAt, "2026-10-02T16:00:00.000Z", "a block without a change time takes its end");
});

test("an older workspace's start times per task become blocks as long as their estimates", () => {
  const ws = sanitizeWorkspace({ pins: { "f:a1": "2026-10-02T15:00:00.000Z", "f:a2": "2026-10-03T15:00:00.000Z", broken: "never" }, estimates: { "f:a1": 90 } });
  assert.deepEqual(
    ws.blocks.map((b) => [b.taskId, b.start, b.end]),
    [
      ["f:a1", "2026-10-02T15:00:00.000Z", "2026-10-02T16:30:00.000Z"],
      ["f:a2", "2026-10-03T15:00:00.000Z", "2026-10-03T16:00:00.000Z"],
    ],
  );
});

test("set-aside time travels in a setup link", () => {
  const ws: Workspace = {
    ...defaultWorkspace(),
    feeds: [feed("https://a.example/cal.ics")],
    blocks: [{ id: "b1", taskId: "x", title: "Essay", start: "2026-10-02T15:00:00.000Z", end: "2026-10-02T16:00:00.000Z", color: null, externalId: null, updatedAt: "2026-10-01T12:00:00.000Z" }],
  };
  assert.deepEqual(decodeSetup(encodeSetup(ws))?.blocks, ws.blocks);
});

test("estimates say who set them, and bare minutes from before are the student's own", () => {
  const ws = sanitizeWorkspace({
    estimates: {
      old: 45,
      mine: { minutes: 90, source: "user", at: "2026-10-01T12:00:00Z" },
      suggested: { minutes: 30, source: "ai" },
      odd: { minutes: 30, source: "someone" },
      tooShort: 2,
      notANumber: "an hour",
    },
  });
  assert.deepEqual(ws.estimates, {
    old: { minutes: 45, source: "user" },
    mine: { minutes: 90, source: "user", at: "2026-10-01T12:00:00.000Z" },
    suggested: { minutes: 30, source: "ai" },
    odd: { minutes: 30, source: "user" },
  });
});

test("the class ranking loads as unique class ids, and travels in a setup link", () => {
  const ws = sanitizeWorkspace({ feeds: [feed("https://a.example/cal.ics")], classOrder: ["f:cs", "f:fin", "f:cs", 7, "", null, "f:art"] });
  assert.deepEqual(ws.classOrder, ["f:cs", "f:fin", "f:art"]);
  assert.deepEqual(sanitizeWorkspace({ classOrder: "f:cs" }).classOrder, [], "not a list");
  assert.deepEqual(defaultWorkspace().classOrder, []);
  assert.deepEqual(decodeSetup(encodeSetup(ws))?.classOrder, ["f:cs", "f:fin", "f:art"]);
});
