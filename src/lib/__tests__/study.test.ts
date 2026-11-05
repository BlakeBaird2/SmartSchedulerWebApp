import assert from "node:assert/strict";
import test from "node:test";
import { TASKS, matchesPersona } from "../study/config";
import { comparisons, csvHeader, recordingOffset, taskSummaries, toCsv, type StudyRecord } from "../study/results";

function record(overrides: Partial<StudyRecord> = {}): StudyRecord {
  return {
    id: "abc",
    code: "K7P2QX",
    studyVersion: 1,
    startedAt: "2026-11-05T18:00:00.000Z",
    updatedAt: "2026-11-05T18:10:00.000Z",
    finishedAt: "2026-11-05T18:10:00.000Z",
    step: "finish",
    order: "A-first",
    device: { userAgent: "UA", screen: "1440x900", mobile: false },
    consent: true,
    recording: { kind: "screen+mic", mimeType: "video/webm", startedAt: "2026-11-05T18:01:00.000Z", endedAt: null, chunks: 3, bytes: 2_097_152, stoppedEarly: false },
    answers: {
      s_student: "Yes, full-time",
      s_commitments: "11–20 hours",
      s_tools: ["Canvas", "Google Calendar"],
      s_struggle: 4,
      s_struggle_why: 'I check Canvas, then "guess", then panic',
      o_minutes_a: 2,
      o_minutes_b: 12,
      t1_plan_ease_a: 6,
      t1_plan_ease_b: 3,
    },
    tasks: {
      t1_plan: { startedAt: "2026-11-05T18:02:05.000Z", endedAt: "2026-11-05T18:03:05.000Z", outcome: "done", autoSuccess: true, clicks: 9, events: [], answer: "" },
    },
    ...overrides,
  };
}

test("the persona needs a student who juggles and struggles", () => {
  assert.ok(matchesPersona(record().answers));
  assert.ok(!matchesPersona({ ...record().answers, s_student: "Not currently a student" }));
  assert.ok(!matchesPersona({ ...record().answers, s_struggle: 1 }));
  assert.ok(!matchesPersona({ ...record().answers, s_commitments: "None", s_tools: ["Canvas"] }));
});

test("the CSV has one row per session, with quotes escaped", () => {
  const csv = toCsv([record(), record({ id: "b", startedAt: "2026-11-04T18:00:00.000Z", finishedAt: null })]);
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], csvHeader().join(","));
  assert.ok(lines[1].startsWith("P01,K7P2QX,partial"), "oldest first");
  assert.ok(lines[2].includes('"I check Canvas, then ""guess"", then panic"'));
  assert.ok(lines[2].includes("Canvas; Google Calendar"));
  for (const t of TASKS) assert.ok(csvHeader().includes(`${t.id}_ease_b`));
});

test("task times line up with the recording", () => {
  assert.equal(recordingOffset(record(), "2026-11-05T18:02:05.000Z"), "1:05");
  assert.equal(recordingOffset(record({ recording: { ...record().recording, startedAt: null } }), "2026-11-05T18:02:05.000Z"), "");
});

test("summaries compare A with B", () => {
  const minutes = comparisons([record()]).find((c) => c.id === "o_minutes")!;
  assert.deepEqual([minutes.a, minutes.b, minutes.n], [2, 12, 1]);
  const t1 = taskSummaries([record()])[0];
  assert.deepEqual([t1.doneRate, t1.autoRate, t1.medianSeconds], [1, 1, 60]);
});
