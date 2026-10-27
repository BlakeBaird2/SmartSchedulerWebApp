/**
 * The user's workspace: their calendar links and choices, kept in their browser.
 *
 * Stored data can come from an older version of the app, another device, or a
 * hand-edited setup link, so everything read back is checked field by field and
 * anything unusable falls back to a default instead of breaking the page.
 */
import { DEFAULT_PREFS } from "./planner";
import { ASSIGNMENT_TYPES, normalizeType, type CourseEdit, type FeedConfig, type FeedRole, type ManualTask, type PlanPrefs, type Provider, type ScheduledBlock, type WeeklyBlock, type Workspace } from "./types";
import { detectProvider, feedIdFor } from "./feeds/url";

export const PERSONAL_COLORS = ["#64748b", "#0f766e", "#b45309", "#9333ea", "#be185d", "#4d7c0f"];

export function defaultWorkspace(): Workspace {
  return {
    version: 1,
    feeds: [],
    weekly: [],
    manualTasks: [],
    done: {},
    estimates: {},
    blocks: [],
    courseEdits: {},
    prefs: { ...DEFAULT_PREFS, estimates: { ...DEFAULT_PREFS.estimates } },
    demo: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function sanitizePrefs(raw: unknown): PlanPrefs {
  const p = isObj(raw) ? raw : {};
  const d = DEFAULT_PREFS;
  let dayStart = num(p.dayStart, d.dayStart, 0, 23 * 60);
  let dayEnd = num(p.dayEnd, d.dayEnd, 60, 24 * 60);
  if (dayEnd <= dayStart) [dayStart, dayEnd] = [d.dayStart, d.dayEnd];
  const est = isObj(p.estimates) ? p.estimates : {};
  const estimates = Object.fromEntries(
    ASSIGNMENT_TYPES.map((t) => [t, num(est[t], d.estimates[t], 5, 24 * 60)]),
  ) as PlanPrefs["estimates"];
  return {
    dayStart,
    dayEnd,
    dailyMax: num(p.dailyMax, d.dailyMax, 30, 24 * 60),
    buffer: num(p.buffer, d.buffer, 0, 120),
    minGap: num(p.minGap, d.minGap, 5, 240),
    weekends: typeof p.weekends === "boolean" ? p.weekends : d.weekends,
    estimates,
  };
}

function sanitizeFeed(raw: unknown, index: number): FeedConfig | null {
  if (!isObj(raw)) return null;
  const url = str(raw.url).trim();
  if (!url) return null;
  const provider = str(raw.provider) as Provider;
  const role: FeedRole = raw.role === "personal" ? "personal" : "school";
  return {
    id: feedIdFor(url),
    url,
    name: str(raw.name).trim() || "Calendar",
    role,
    provider: ["canvas", "learningsuite", "google", "outlook", "icloud", "other"].includes(provider) ? provider : detectProvider(url),
    color: /^#[0-9a-f]{6}$/i.test(str(raw.color)) ? str(raw.color) : PERSONAL_COLORS[index % PERSONAL_COLORS.length],
    enabled: raw.enabled !== false,
  };
}

function sanitizeWeekly(raw: unknown): WeeklyBlock | null {
  if (!isObj(raw)) return null;
  const start = str(raw.start);
  const end = str(raw.end);
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  if (!HHMM.test(start) || !HHMM.test(end) || end <= start || days.length === 0) return null;
  const block: WeeklyBlock = { id: str(raw.id) || randomId(), label: str(raw.label).trim().slice(0, 60) || "Busy", days, start, end };
  const courseId = str(raw.courseId).trim();
  if (courseId) block.courseId = courseId;
  const location = str(raw.location).trim().slice(0, 80);
  if (location) block.location = location;
  if (Array.isArray(raw.skip)) {
    const skip = [...new Set(raw.skip.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-100);
    if (skip.length) block.skip = skip;
  }
  return block;
}

function sanitizeManual(raw: unknown): ManualTask | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title).trim();
  if (!title) return null;
  const dueAt = str(raw.dueAt);
  return {
    id: str(raw.id) || randomId(),
    title,
    courseId: str(raw.courseId) || null,
    type: normalizeType(raw.type),
    dueAt: dueAt && !Number.isNaN(Date.parse(dueAt)) ? dueAt : null,
  };
}

/** The most set-aside time kept, newest first, so stored data and setup links stay small. */
export const MAX_BLOCKS = 1000;
const ISO_OK = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

function sanitizeBlock(raw: unknown): ScheduledBlock | null {
  if (!isObj(raw) || !ISO_OK(raw.start) || !ISO_OK(raw.end)) return null;
  const start = new Date(raw.start as string);
  const end = new Date(raw.end as string);
  if (end.getTime() <= start.getTime() || end.getTime() - start.getTime() > 24 * 3_600_000) return null;
  const taskId = str(raw.taskId).trim() || null;
  return {
    id: str(raw.id).trim().slice(0, 64) || randomId(),
    taskId,
    title: str(raw.title).trim().slice(0, 200),
    start: start.toISOString(),
    end: end.toISOString(),
    color: /^#[0-9a-f]{6}$/i.test(str(raw.color)) ? str(raw.color) : null,
    externalId: str(raw.externalId).trim().slice(0, 1024) || null,
    updatedAt: ISO_OK(raw.updatedAt) ? new Date(raw.updatedAt as string).toISOString() : end.toISOString(),
  };
}

function sanitizeBlocks(raw: Record<string, unknown>): ScheduledBlock[] {
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).map(sanitizeBlock).filter((b): b is ScheduledBlock => b !== null);
  // An earlier version kept one start time per task ("pins"), as long as its estimate.
  if (isObj(raw.pins) && !Array.isArray(raw.blocks)) {
    const estimates = isObj(raw.estimates) ? raw.estimates : {};
    for (const [taskId, at] of Object.entries(raw.pins)) {
      if (!ISO_OK(at)) continue;
      const minutes = num(estimates[taskId], 60, 5, 24 * 60);
      const start = new Date(at);
      const block = sanitizeBlock({ id: randomId(), taskId, start: at, end: new Date(start.getTime() + minutes * 60_000).toISOString() });
      if (block) blocks.push(block);
    }
  }
  const unique = [...new Map(blocks.map((b) => [b.id, b])).values()];
  return unique.sort((a, b) => b.start.localeCompare(a.start)).slice(0, MAX_BLOCKS).reverse();
}

function sanitizeRecord<T>(raw: unknown, check: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (check(v)) out[k] = v;
  return out;
}

export function sanitizeWorkspace(raw: unknown): Workspace {
  if (!isObj(raw)) return defaultWorkspace();
  const feeds: FeedConfig[] = [];
  const seen = new Set<string>();
  (Array.isArray(raw.feeds) ? raw.feeds : []).forEach((f, i) => {
    const feed = sanitizeFeed(f, i);
    if (feed && !seen.has(feed.id)) {
      seen.add(feed.id);
      feeds.push(feed);
    }
  });
  const courseEdits: Record<string, CourseEdit> = {};
  if (isObj(raw.courseEdits)) {
    for (const [k, v] of Object.entries(raw.courseEdits)) {
      if (!isObj(v)) continue;
      const edit: CourseEdit = {};
      if (typeof v.code === "string" && v.code.trim()) edit.code = v.code.trim().slice(0, 24);
      if (typeof v.title === "string" && v.title.trim()) edit.title = v.title.trim().slice(0, 80);
      if (typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color)) edit.color = v.color;
      if (v.hidden === true) edit.hidden = true;
      if (Array.isArray(v.feedTimesOff)) {
        const off = [...new Set(v.feedTimesOff.filter((x): x is string => typeof x === "string" && /^\d{1,4}-\d{1,4}$/.test(x)))].slice(0, 20);
        if (off.length) edit.feedTimesOff = off;
      }
      if (Object.keys(edit).length) courseEdits[k] = edit;
    }
  }
  return {
    version: 1,
    feeds,
    weekly: (Array.isArray(raw.weekly) ? raw.weekly : []).map(sanitizeWeekly).filter((w): w is WeeklyBlock => w !== null),
    manualTasks: (Array.isArray(raw.manualTasks) ? raw.manualTasks : []).map(sanitizeManual).filter((m): m is ManualTask => m !== null),
    done: sanitizeRecord(raw.done, (v): v is string => typeof v === "string"),
    estimates: sanitizeRecord(raw.estimates, (v): v is number => typeof v === "number" && v >= 5 && v <= 24 * 60),
    blocks: sanitizeBlocks(raw),
    courseEdits,
    prefs: sanitizePrefs(raw.prefs),
    demo: raw.demo === true,
  };
}

export function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function nextPersonalColor(feeds: FeedConfig[]): string {
  const used = new Set(feeds.filter((f) => f.role === "personal").map((f) => f.color));
  return PERSONAL_COLORS.find((c) => !used.has(c)) ?? PERSONAL_COLORS[feeds.length % PERSONAL_COLORS.length];
}

// ---------------------------------------------------------------------------
// Moving a setup to another device
// ---------------------------------------------------------------------------

/**
 * A setup link carries the whole workspace in the URL fragment. Browsers never
 * send the fragment to a server, so the calendar links inside it only ever travel
 * between the user's own devices.
 */
export function encodeSetup(ws: Workspace): string {
  const payload = { ...ws, demo: false };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSetup(value: string): Workspace | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const ws = sanitizeWorkspace(JSON.parse(new TextDecoder().decode(bytes)));
    return ws.feeds.length > 0 ? ws : null;
  } catch {
    return null;
  }
}

/**
 * Work already past due when a calendar is first added.
 *
 * Calendar feeds say when things are due, not whether they were handed in, so a
 * Canvas feed added mid-semester would otherwise open with weeks of finished work
 * marked overdue and planned first. Anything due before `cutoff` at that moment is
 * assumed done; one tap undoes it for anything that really is still outstanding.
 */
export function pastDueIds(feedId: string, result: { tasks: { uid: string; dueAt: string }[] }, cutoff: Date): string[] {
  const t = cutoff.getTime();
  return result.tasks.filter((task) => Date.parse(task.dueAt) < t).map((task) => `${feedId}:${task.uid}`);
}
