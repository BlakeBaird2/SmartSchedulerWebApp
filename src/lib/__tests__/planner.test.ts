import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PREFS, MIN_CHUNK, buildPlan, findGaps, priorityOrder, type PlanTask } from "../planner";
import type { PlanPrefs } from "../types";

// Tests run with TZ=America/Denver. October 1, 2026 is a Thursday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const span = (d: { start: Date; end: Date }) => `${hhmm(d.start)}-${hhmm(d.end)}`;

const prefs = (over: Partial<PlanPrefs> = {}): PlanPrefs => ({ ...DEFAULT_PREFS, ...over });
const task = (id: string, estimate: number, due: Date | null, type: PlanTask["type"] = "assignment"): PlanTask => ({
  id,
  title: id,
  type,
  dueAt: due,
  estimate,
});

// ---------------------------------------------------------------------------
// Finding gaps
// ---------------------------------------------------------------------------

test("gaps are what is left of the day once padded events are removed", () => {
  const gaps = findGaps(
    at(1, 8).getTime(),
    at(1, 22).getTime(),
    [
      { start: at(1, 9), end: at(1, 10) },
      { start: at(1, 13), end: at(1, 14) },
    ],
    10,
    20,
  );
  assert.deepEqual(gaps.map(span), ["08:00-08:50", "10:10-12:50", "14:10-22:00"]);
  assert.deepEqual(gaps.map((g) => g.minutes), [50, 160, 470]);
});

test("gaps too short to use are dropped", () => {
  // 10:00 to 10:30 between classes, minus a 10 minute buffer each side, leaves 10 minutes.
  const gaps = findGaps(at(1, 9).getTime(), at(1, 12).getTime(), [
    { start: at(1, 9), end: at(1, 10) },
    { start: at(1, 10, 30), end: at(1, 12) },
  ], 10, 20);
  assert.deepEqual(gaps, []);
});

test("overlapping and touching events merge into one busy stretch", () => {
  const gaps = findGaps(at(1, 8).getTime(), at(1, 12).getTime(), [
    { start: at(1, 9), end: at(1, 10) },
    { start: at(1, 9, 30), end: at(1, 10, 30) },
    { start: at(1, 10, 30), end: at(1, 11) },
  ], 0, 20);
  assert.deepEqual(gaps.map(span), ["08:00-09:00", "11:00-12:00"]);
});

test("gap edges snap to five minute marks", () => {
  const gaps = findGaps(at(1, 8, 3).getTime(), at(1, 9, 58).getTime(), [], 0, 20);
  assert.deepEqual(gaps.map(span), ["08:05-09:55"]);
});

test("today's plan starts from now, not from the start of the day", () => {
  const plan = buildPlan({ now: at(1, 15, 2), tasks: [], busy: [], prefs: prefs(), days: 1 });
  assert.deepEqual(plan.days[0].gaps.map(span), ["15:05-22:00"]);
});

test("weekends can be kept free", () => {
  const plan = buildPlan({ now: at(2, 7), tasks: [], busy: [], prefs: prefs({ weekends: false }), days: 4 });
  // Fri, Sat, Sun, Mon
  assert.deepEqual(plan.days.map((d) => d.working), [true, false, false, true]);
  assert.equal(plan.days[1].freeMinutes, 0);
});

// ---------------------------------------------------------------------------
// Choosing what to do
// ---------------------------------------------------------------------------

test("the soonest deadline goes first", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("next-week", 60, at(8, 23, 59)), task("tomorrow", 60, at(2, 23, 59)), task("tonight", 30, at(1, 23, 59))],
    busy: [],
    prefs: prefs(),
    days: 1,
  });
  assert.deepEqual(plan.days[0].blocks.map((b) => b.taskId), ["tonight", "tomorrow", "next-week"]);
  assert.deepEqual(plan.days[0].blocks.map(span), ["08:00-08:30", "08:30-09:30", "09:30-10:30"]);
});

test("late work comes before anything else", () => {
  const order = priorityOrder([task("soon", 30, at(1, 20)), task("late", 30, at(1, 9))], at(1, 12));
  assert.deepEqual(order.map((t) => t.id), ["late", "soon"]);
});

test("work long past due is left out of the plan", () => {
  const plan = buildPlan({ now: at(20, 7), tasks: [task("ancient", 30, at(1, 9))], busy: [], prefs: prefs(), days: 1 });
  assert.deepEqual(plan.order, []);
});

test("when two things are due together, the exam comes first", () => {
  const due = at(3, 12);
  const order = priorityOrder([task("reading", 30, due, "reading"), task("exam", 30, due, "exam"), task("quiz", 30, due, "quiz")], at(1, 7));
  assert.deepEqual(order.map((t) => t.id), ["exam", "quiz", "reading"]);
});

test("a short gap is used for whatever fits, rather than wasted", () => {
  // A 30 minute gap before class. The urgent quiz takes 45, so it waits for the
  // afternoon and the 30 minute reading takes the short gap instead.
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("quiz", 45, at(1, 20), "quiz"), task("reading", 30, at(4, 23, 59), "reading")],
    busy: [{ start: at(1, 8, 30), end: at(1, 16) }],
    prefs: prefs({ buffer: 0 }),
    days: 1,
  });
  const blocks = plan.days[0].blocks;
  assert.deepEqual(blocks.map((b) => `${b.taskId} ${span(b)}`), ["reading 08:00-08:30", "quiz 16:00-16:45"]);
});

test("quizzes are never split, even when time is short", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("quiz", 60, at(1, 21), "quiz")],
    busy: [{ start: at(1, 8, 40), end: at(1, 21) }],
    prefs: prefs({ buffer: 0 }),
    days: 1,
  });
  assert.equal(plan.days[0].blocks.length, 0);
  assert.equal(plan.atRisk[0].taskId, "quiz");
  assert.equal(plan.atRisk[0].shortBy, 60);
});

test("long work is split across gaps and numbered", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("project", 150, at(2, 23, 59), "project")],
    busy: [
      { start: at(1, 9), end: at(1, 12) },
      { start: at(1, 13, 30), end: at(1, 22) },
    ],
    prefs: prefs({ buffer: 0 }),
    days: 2,
  });
  const blocks = plan.days.flatMap((d) => d.blocks);
  assert.deepEqual(blocks.map(span), ["08:00-09:00", "12:00-13:30"]);
  assert.deepEqual(blocks.map((b) => `${b.part}/${b.parts}`), ["1/2", "2/2"]);
  assert.equal(plan.planned.project, 150);
  assert.deepEqual(plan.atRisk, []);
});

test("a split never leaves a remainder too short to come back to", () => {
  // 100 minutes of work, 80 minute gap: taking all 80 would leave 20, so it takes 75.
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("paper", 100, at(3, 23), "assignment")],
    busy: [{ start: at(1, 9, 20), end: at(1, 22) }],
    prefs: prefs({ buffer: 0 }),
    days: 2,
  });
  const blocks = plan.days.flatMap((d) => d.blocks);
  assert.equal(blocks[0].minutes, 100 - MIN_CHUNK);
  assert.equal(blocks[1].minutes, MIN_CHUNK);
});

test("nothing is planned after its own due time", () => {
  // Due at 10:00, needs 90 minutes, and only 8:00 to 10:00 is before it.
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("due-at-ten", 90, at(1, 10)), task("later", 60, at(5, 12))],
    busy: [{ start: at(1, 8), end: at(1, 9) }],
    prefs: prefs({ buffer: 0 }),
    days: 1,
  });
  const dueAtTen = plan.days[0].blocks.filter((b) => b.taskId === "due-at-ten");
  assert.ok(dueAtTen.every((b) => b.end.getTime() <= at(1, 10).getTime()));
  const risk = plan.atRisk.find((r) => r.taskId === "due-at-ten")!;
  assert.equal(risk.planned + risk.shortBy, 90);
  assert.ok(risk.shortBy > 0);
});

test("work that cannot fit before its deadline is flagged with the shortfall", () => {
  const plan = buildPlan({
    now: at(1, 20),
    tasks: [task("essay", 240, at(1, 23, 59))],
    busy: [],
    prefs: prefs(),
    days: 1,
  });
  // Only 8:00pm to 10:00pm is left today.
  assert.equal(plan.days[0].plannedMinutes, 120);
  assert.deepEqual(plan.atRisk.map((r) => [r.taskId, r.shortBy]), [["essay", 120]]);
});

test("the daily limit spreads work out, but urgent work may go past it", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("due-tonight", 120, at(1, 23)), task("due-friday", 180, at(9, 23))],
    busy: [],
    prefs: prefs({ dailyMax: 120 }),
    days: 3,
  });
  // Tonight's work uses the whole limit; Friday's work waits for tomorrow.
  assert.deepEqual(plan.days[0].blocks.map((b) => b.taskId), ["due-tonight"]);
  assert.equal(plan.days[1].plannedMinutes, 120);
  assert.equal(plan.days[2].plannedMinutes, 60);

  const urgent = buildPlan({
    now: at(1, 7),
    tasks: [task("a", 120, at(1, 23)), task("b", 120, at(1, 23, 30))],
    busy: [],
    prefs: prefs({ dailyMax: 120 }),
    days: 1,
  });
  assert.equal(urgent.days[0].plannedMinutes, 240, "both are due today, so the limit gives way");
});

test("work with no due date only fills time left over", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("someday", 30, null), task("friday", 30, at(2, 12))],
    busy: [],
    prefs: prefs(),
    days: 1,
  });
  assert.deepEqual(plan.days[0].blocks.map((b) => b.taskId), ["friday", "someday"]);
});

test("totals compare free time with the work due", () => {
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [task("a", 60, at(2, 12)), task("b", 90, at(3, 12)), task("way-later", 600, at(30, 12))],
    busy: [{ start: at(1, 9), end: at(1, 17) }],
    prefs: prefs({ buffer: 0 }),
    days: 2,
  });
  assert.equal(plan.dueMinutes, 60, "only work due inside the two planned days counts as due");
  assert.equal(plan.days[0].freeMinutes, 60 + 300);
  assert.equal(plan.freeMinutes, plan.days[0].freeMinutes + plan.days[1].freeMinutes);
});

test("the same input always gives the same plan", () => {
  const input = {
    now: at(1, 7),
    tasks: [task("x", 45, at(2, 9)), task("y", 45, at(2, 9)), task("z", 120, at(4, 9), "project")],
    busy: [{ start: at(1, 10), end: at(1, 12) }],
    prefs: prefs(),
    days: 3,
  };
  assert.deepEqual(JSON.stringify(buildPlan(input)), JSON.stringify(buildPlan(input)));
});

test("a busy week is planned sensibly end to end", () => {
  // Classes MWF 9-10 and TTh 11-12:15, a work shift Tue 13-17, three kinds of work.
  const busy = [];
  for (const d of [1, 2, 5, 6, 7]) {
    const dow = new Date(2026, 9, d).getDay();
    if (dow === 1 || dow === 3 || dow === 5) busy.push({ start: at(d, 9), end: at(d, 10) });
    if (dow === 2 || dow === 4) busy.push({ start: at(d, 11), end: at(d, 12, 15) });
    if (dow === 2) busy.push({ start: at(d, 13), end: at(d, 17) });
  }
  const plan = buildPlan({
    now: at(1, 7),
    tasks: [
      task("reading", 30, at(2, 9), "reading"),
      task("quiz", 30, at(2, 17), "quiz"),
      task("case", 60, at(6, 9, 30)),
      task("study", 180, at(8, 10), "exam"),
    ],
    busy,
    prefs: prefs({ dailyMax: 150 }),
    days: 7,
  });
  assert.deepEqual(plan.atRisk, [], "everything fits");
  const every = plan.days.flatMap((d) => d.blocks);
  // No block overlaps a busy event or its buffer.
  for (const b of every) {
    for (const e of busy) {
      const clear = b.end.getTime() <= e.start.getTime() - 10 * 60_000 || b.start.getTime() >= e.end.getTime() + 10 * 60_000;
      assert.ok(clear, `${b.taskId} ${span(b)} collides with ${span(e)}`);
    }
  }
  // Nothing is planned after it is due.
  const due = { reading: at(2, 9), quiz: at(2, 17), case: at(6, 9, 30), study: at(8, 10) };
  for (const b of every) assert.ok(b.end.getTime() <= due[b.taskId as keyof typeof due].getTime(), `${b.taskId} planned late`);
  // No day goes over the limit except to finish something due within a day.
  assert.ok(plan.days.every((d) => d.plannedMinutes <= 150 + 60));
});

// ---------------------------------------------------------------------------
// Time set aside on the calendar (dragged there by the student)
// ---------------------------------------------------------------------------

const block = (taskId: string | null, start: Date, end: Date, id = `b-${taskId ?? "none"}`) => ({ id, taskId, start, end });

test("set-aside work stays where the student put it, and the rest is planned around it", () => {
  const plan = buildPlan({
    now: at(1, 8),
    prefs: prefs({ buffer: 0, dayStart: 9 * 60, dayEnd: 12 * 60 }),
    days: 1,
    busy: [],
    tasks: [task("essay", 60, at(3, 9)), task("quiz", 30, at(2, 9), "quiz")],
    fixed: [block("essay", at(1, 10), at(1, 11))],
  });
  const blocks = plan.days[0].blocks;
  assert.deepEqual(blocks.map((b) => `${b.taskId} ${span(b)}${b.pinned ? " pinned" : ""}`), [
    "quiz 09:00-09:30",
    "essay 10:00-11:00 pinned",
  ]);
  assert.equal(blocks[1].blockId, "b-essay");
  assert.deepEqual(plan.days[0].gaps.map(span), ["09:00-10:00", "11:00-12:00"], "the set-aside hour is no longer free");
  assert.equal(plan.atRisk.length, 0);
});

test("once all of a task's set-aside time has passed, it is planned again", () => {
  const plan = buildPlan({
    now: at(1, 12),
    prefs: prefs({ buffer: 0 }),
    days: 1,
    busy: [],
    tasks: [task("essay", 60, at(3, 9))],
    fixed: [block("essay", at(1, 9), at(1, 10))],
  });
  const [planned] = plan.days[0].blocks;
  assert.equal(planned.pinned, undefined);
  assert.equal(span(planned), "12:00-13:00");
});

test("set-aside work counts toward the day's limit", () => {
  const plan = buildPlan({
    now: at(1, 8),
    prefs: prefs({ buffer: 0, dailyMax: 60 }),
    days: 2,
    busy: [],
    tasks: [task("a", 60, at(5, 9)), task("b", 60, at(5, 9))],
    fixed: [block("b", at(1, 15), at(1, 16))],
  });
  assert.deepEqual(plan.days[0].blocks.map((b) => b.taskId), ["b"]);
  assert.deepEqual(plan.days[1].blocks.map((b) => b.taskId), ["a"]);
});

test("a set-aside block keeps its own length, and its task counts as scheduled even if the block is shorter", () => {
  const plan = buildPlan({
    now: at(1, 8),
    prefs: prefs({ buffer: 0 }),
    days: 1,
    busy: [],
    tasks: [task("essay", 120, at(3, 9))],
    fixed: [block("essay", at(1, 14), at(1, 14, 45))],
  });
  assert.deepEqual(plan.days[0].blocks.map((b) => `${b.taskId} ${span(b)} ${b.minutes}m`), ["essay 14:00-14:45 45m"]);
  assert.equal(plan.atRisk.length, 0);
});

test("set-aside time that isn't for a task is still busy", () => {
  const plan = buildPlan({
    now: at(1, 8),
    prefs: prefs({ buffer: 0, dayStart: 9 * 60, dayEnd: 12 * 60 }),
    days: 1,
    busy: [],
    tasks: [task("essay", 60, at(3, 9))],
    fixed: [block(null, at(1, 9), at(1, 11))],
  });
  assert.deepEqual(plan.days[0].gaps.map(span), ["11:00-12:00"]);
  assert.deepEqual(plan.days[0].blocks.map((b) => `${b.taskId} ${span(b)}`), ["essay 11:00-12:00"]);
});

test("work set aside beyond the two weeks the planner looks at is still scheduled, not planned twice", () => {
  const plan = buildPlan({
    now: at(1, 8),
    prefs: prefs({ buffer: 0 }),
    days: 3,
    busy: [],
    tasks: [task("paper", 60, at(30, 9))],
    fixed: [block("paper", at(25, 10), at(25, 11))],
  });
  assert.equal(plan.days.flatMap((d) => d.blocks).length, 0);
  assert.equal(plan.atRisk.length, 0);
});
