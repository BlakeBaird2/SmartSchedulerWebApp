import { TASKS, allQuestions, matchesPersona, type Question } from "./config";

/**
 * One participant's session, as saved while they take the test. Saved again at
 * every step, so someone who stops halfway still counts as a partial session.
 */
export interface StudyRecord {
  id: string;
  /** Short code shown at the end, for matching a participant to a sign-up sheet. */
  code: string;
  studyVersion: number;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** The last screen they reached. */
  step: string;
  /** A-first: the task in Schedule Smart, then the same goal recalled with their own tools. B-first: the reverse. */
  order: "A-first" | "B-first";
  device: { userAgent: string; screen: string; mobile: boolean };
  consent: boolean;
  recording: {
    /** What was recorded: their screen (this tab) and/or microphone. */
    kind: "screen+mic" | "screen" | "mic" | "none";
    mimeType: string | null;
    startedAt: string | null;
    endedAt: string | null;
    /** Pieces saved so far and their total size. */
    chunks: number;
    bytes: number;
    /** They stopped sharing their screen before the end. */
    stoppedEarly: boolean;
  };
  answers: Record<string, Answer>;
  tasks: Record<string, TaskResult>;
}

export type Answer = string | number | string[];

export interface TaskResult {
  startedAt: string;
  endedAt: string | null;
  /** What they said happened. */
  outcome: "done" | "gave_up" | null;
  /** Whether the app saw the action that completes the task (null for tasks it can't tell). */
  autoSuccess: boolean | null;
  /** Clicks and taps inside the app. */
  clicks: number;
  /** App actions during the task, in order (see components/smartEvents.ts). */
  events: { name: string; at: string }[];
  /** For tasks that ask for one. */
  answer: string;
}

/** Seconds between two ISO times, or null. */
export function secondsBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const s = (Date.parse(to) - Date.parse(from)) / 1000;
  return Number.isFinite(s) ? Math.round(s) : null;
}

/** "m:ss" into the recording at which `at` happened. */
export function recordingOffset(rec: StudyRecord, at: string | null | undefined): string {
  const s = secondsBetween(rec.recording.startedAt, at);
  if (s === null || s < 0) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Columns a question becomes in the export. */
function questionColumns(q: Question): string[] {
  if (q.kind === "pair") return [q.id, `${q.id}_why`];
  if (q.kind === "compare") return [`${q.id}_a`, `${q.id}_b`, `${q.id}_why`];
  return [q.id];
}

function taskColumns(id: string): string[] {
  return [
    `${id}_outcome`,
    `${id}_auto_success`,
    `${id}_seconds`,
    `${id}_clicks`,
    `${id}_answer`,
    `${id}_ease_a`,
    `${id}_ease_a_why`,
    `${id}_ease_b`,
    `${id}_ease_b_why`,
    `${id}_video_at`,
  ];
}

export function csvHeader(): string[] {
  return [
    "participant",
    "code",
    "status",
    "last_step",
    "started_at",
    "finished_at",
    "total_minutes",
    "study_version",
    "order",
    "matches_persona",
    "mobile",
    "screen",
    "recording",
    "recording_mb",
    "recording_stopped_early",
    ...allQuestions().flatMap(questionColumns),
    ...TASKS.flatMap((t) => taskColumns(t.id)),
    "user_agent",
  ];
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

export function csvRow(rec: StudyRecord, index: number): string[] {
  const a = rec.answers;
  const total = secondsBetween(rec.startedAt, rec.finishedAt ?? rec.updatedAt);
  const values: Record<string, unknown> = {
    participant: `P${String(index + 1).padStart(2, "0")}`,
    code: rec.code,
    status: rec.finishedAt ? "complete" : "partial",
    last_step: rec.step,
    started_at: rec.startedAt,
    finished_at: rec.finishedAt,
    total_minutes: total === null ? "" : (total / 60).toFixed(1),
    study_version: rec.studyVersion,
    order: rec.order,
    matches_persona: matchesPersona(a),
    mobile: rec.device.mobile,
    screen: rec.device.screen,
    recording: rec.recording.kind,
    recording_mb: (rec.recording.bytes / 1_048_576).toFixed(1),
    recording_stopped_early: rec.recording.stoppedEarly,
    user_agent: rec.device.userAgent,
  };
  for (const q of allQuestions()) for (const col of questionColumns(q)) values[col] = a[col];
  for (const t of TASKS) {
    const r = rec.tasks[t.id];
    values[`${t.id}_outcome`] = r?.outcome === "gave_up" ? "gave up" : r?.outcome;
    values[`${t.id}_auto_success`] = r?.autoSuccess;
    values[`${t.id}_seconds`] = r ? secondsBetween(r.startedAt, r.endedAt) : null;
    values[`${t.id}_clicks`] = r?.clicks;
    values[`${t.id}_answer`] = r?.answer;
    values[`${t.id}_ease_a`] = a[`${t.id}_ease_a`];
    values[`${t.id}_ease_a_why`] = a[`${t.id}_ease_a_why`];
    values[`${t.id}_ease_b`] = a[`${t.id}_ease_b`];
    values[`${t.id}_ease_b_why`] = a[`${t.id}_ease_b_why`];
    values[`${t.id}_video_at`] = r ? recordingOffset(rec, r.startedAt) : "";
  }
  return csvHeader().map((h) => cell(values[h]));
}

function escape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Every session as CSV, oldest first, one row per participant. Starts with a BOM so Excel reads the accents. */
export function toCsv(records: StudyRecord[]): string {
  const sorted = [...records].sort((x, y) => x.startedAt.localeCompare(y.startedAt));
  const lines = [csvHeader(), ...sorted.map(csvRow)].map((row) => row.map(escape).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Summary for the results page
// ---------------------------------------------------------------------------

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

const nums = (records: StudyRecord[], key: string) =>
  records.map((r) => r.answers[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

export interface Comparison {
  id: string;
  label: string;
  a: number | null;
  b: number | null;
  n: number;
}

/** Mean of each A/B pair: the compare questions and each task's ease ratings. */
export function comparisons(records: StudyRecord[]): Comparison[] {
  const out: Comparison[] = [];
  for (const q of allQuestions()) {
    if (q.kind !== "compare") continue;
    out.push({ id: q.id, label: q.prompt, a: mean(nums(records, `${q.id}_a`)), b: mean(nums(records, `${q.id}_b`)), n: nums(records, `${q.id}_a`).length });
  }
  for (const t of TASKS) {
    out.push({
      id: t.id,
      label: `Task: ${t.title} (ease 1–7)`,
      a: mean(nums(records, `${t.id}_ease_a`)),
      b: mean(nums(records, `${t.id}_ease_b`)),
      n: nums(records, `${t.id}_ease_a`).length,
    });
  }
  return out;
}

export interface TaskSummary {
  id: string;
  title: string;
  attempts: number;
  /** Share who said they did it. */
  doneRate: number | null;
  /** Share the app saw finish it, for tasks it can tell. */
  autoRate: number | null;
  medianSeconds: number | null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function taskSummaries(records: StudyRecord[]): TaskSummary[] {
  return TASKS.map((t) => {
    const results = records.map((r) => r.tasks[t.id]).filter((r): r is TaskResult => Boolean(r?.endedAt));
    const auto = results.filter((r) => r.autoSuccess !== null);
    const secs = results.map((r) => secondsBetween(r.startedAt, r.endedAt)).filter((s): s is number => s !== null);
    return {
      id: t.id,
      title: t.title,
      attempts: results.length,
      doneRate: results.length ? results.filter((r) => r.outcome === "done").length / results.length : null,
      autoRate: auto.length ? auto.filter((r) => r.autoSuccess).length / auto.length : null,
      medianSeconds: median(secs),
    };
  });
}

/** A record read back from storage, checked enough to show and export safely. */
export function readRecord(raw: unknown): StudyRecord | null {
  try {
    const r = (typeof raw === "string" ? JSON.parse(raw) : raw) as StudyRecord;
    if (!r || typeof r.id !== "string" || typeof r.startedAt !== "string") return null;
    return {
      ...r,
      answers: r.answers && typeof r.answers === "object" ? r.answers : {},
      tasks: r.tasks && typeof r.tasks === "object" ? r.tasks : {},
      device: r.device ?? { userAgent: "", screen: "", mobile: false },
      recording: r.recording ?? { kind: "none", mimeType: null, startedAt: null, endedAt: null, chunks: 0, bytes: 0, stoppedEarly: false },
    };
  } catch {
    return null;
  }
}
