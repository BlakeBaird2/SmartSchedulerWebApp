/**
 * Merge the last snapshot of every feed with the user's own choices into the
 * classes, work and events the interface and planner use.
 */
import type { CalEvent, Course, FeedConfig, Snapshot, Task, WeeklyBlock, Workspace } from "./types";
import { normalizeType } from "./types";
import { meetingKey } from "./meetings";
import { seriesKey } from "./eventColors";

export const COURSE_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#0284c7", "#7c3aed", "#0d9488", "#ea580c", "#2563eb", "#c026d3"];
export const WEEKLY_COLOR = "#78716c";

const DAY = 86_400_000;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** A stable, collision-avoiding colour per class, unless the user picked one. */
function assignColors(ids: string[], chosen: Record<string, string | undefined>): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set(Object.values(chosen).filter(Boolean) as string[]);
  for (const id of [...ids].sort()) {
    const picked = chosen[id];
    if (picked) {
      out.set(id, picked);
      continue;
    }
    let idx = hashString(id) % COURSE_COLORS.length;
    for (let tries = 0; used.has(COURSE_COLORS[idx]) && tries < COURSE_COLORS.length; tries++) idx = (idx + 1) % COURSE_COLORS.length;
    used.add(COURSE_COLORS[idx]);
    out.set(id, COURSE_COLORS[idx]);
  }
  return out;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The weekly block and date a weekly event came from, from its id. */
export function parseWeeklyId(id: string): { blockId: string; date: string } | null {
  const m = id.match(/^weekly:(.+)@(\d{4}-\d{2}-\d{2})$/);
  return m ? { blockId: m[1], date: m[2] } : null;
}

/** Expand weekly blocks into dated busy events around today, leaving out skipped dates. */
export function expandWeekly(blocks: WeeklyBlock[], now: Date, pastDays = 14, futureDays = 120): CalEvent[] {
  const out: CalEvent[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - pastDays);
  for (let i = 0; i <= pastDays + futureDays; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dateKey(day);
    for (const block of blocks) {
      if (!block.days.includes(day.getDay()) || block.skip?.includes(key)) continue;
      const [sh, sm] = block.start.split(":").map(Number);
      const [eh, em] = block.end.split(":").map(Number);
      const s = new Date(day);
      s.setHours(sh, sm, 0, 0);
      const e = new Date(day);
      e.setHours(eh, em, 0, 0);
      out.push({
        id: `weekly:${block.id}@${key}`,
        feedId: null,
        courseId: block.courseId ?? null,
        title: block.label,
        start: s.toISOString(),
        end: e.toISOString(),
        allDay: false,
        busy: true,
        kind: block.courseId ? "class" : "event",
        location: block.location ?? null,
        url: null,
        color: WEEKLY_COLOR,
        source: "weekly",
      });
    }
  }
  return out;
}

export interface Model {
  courses: Course[];
  /** Classes the user has not hidden. */
  visibleCourses: Course[];
  tasks: Task[];
  events: CalEvent[];
  feeds: FeedConfig[];
  courseById: Map<string, Course>;
  feedById: Map<string, FeedConfig>;
}

export function buildModel(ws: Workspace, snapshot: Snapshot, now: Date): Model {
  const feeds = ws.feeds.filter((f) => f.enabled);
  const feedById = new Map(ws.feeds.map((f) => [f.id, f]));

  // Classes, from school feeds only.
  const rawCourses: Omit<Course, "color">[] = [];
  for (const feed of feeds) {
    const result = snapshot.feeds[feed.id]?.result;
    if (!result || feed.role !== "school") continue;
    for (const c of result.courses) {
      const id = `${feed.id}:${c.key}`;
      const edit = ws.courseEdits[id] ?? {};
      rawCourses.push({
        id,
        feedId: feed.id,
        code: edit.code ?? c.code,
        title: edit.title ?? c.title,
        url: c.url,
        hidden: edit.hidden === true,
      });
    }
  }
  const colors = assignColors(
    rawCourses.map((c) => c.id),
    Object.fromEntries(rawCourses.map((c) => [c.id, ws.courseEdits[c.id]?.color])),
  );
  const courses: Course[] = rawCourses
    .map((c) => ({ ...c, color: colors.get(c.id)! }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const hidden = new Set(courses.filter((c) => c.hidden).map((c) => c.id));

  const makeTask = (partial: Omit<Task, "estimate" | "customEstimate" | "estimateSource" | "done">): Task => {
    const custom = ws.estimates[partial.id];
    return {
      ...partial,
      estimate: custom?.minutes ?? ws.prefs.estimates[partial.type],
      customEstimate: custom !== undefined,
      estimateSource: custom?.source ?? "default",
      done: Boolean(ws.done[partial.id]),
    };
  };

  const tasks: Task[] = [];
  const events: CalEvent[] = [];
  for (const feed of feeds) {
    const result = snapshot.feeds[feed.id]?.result;
    if (!result) continue;
    const courseIdFor = (key: string | null) => (feed.role === "school" && key ? `${feed.id}:${key}` : null);

    if (feed.role === "school") {
      for (const t of result.tasks) {
        const courseId = courseIdFor(t.courseKey);
        if (courseId && hidden.has(courseId)) continue;
        tasks.push(
          makeTask({
            id: `${feed.id}:${t.uid}`,
            feedId: feed.id,
            courseId,
            title: t.title,
            type: normalizeType(t.type),
            dueAt: t.dueAt,
            allDay: t.allDay,
            url: t.url,
            description: t.description,
            manual: false,
            generated: t.generated ?? null,
          }),
        );
      }
    }

    for (const e of result.events) {
      const courseId = courseIdFor(e.courseKey);
      if (courseId && hidden.has(courseId)) continue;
      // A class meeting time the user corrected gives way to their own class time.
      const off = courseId ? ws.courseEdits[courseId]?.feedTimesOff : undefined;
      if (off?.length && e.kind === "class" && !e.allDay && off.includes(meetingKey(new Date(e.start), new Date(e.end)))) continue;
      events.push({
        id: `${feed.id}:${e.uid}`,
        feedId: feed.id,
        courseId,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        busy: e.busy,
        kind: e.kind,
        location: e.location,
        url: e.url,
        color: ws.eventColors[seriesKey(`${feed.id}:${e.uid}`)] ?? (courseId ? (courseById.get(courseId)?.color ?? feed.color) : feed.color),
        source: "feed",
      });
    }
  }

  for (const m of ws.manualTasks) {
    if (m.courseId && hidden.has(m.courseId)) continue;
    tasks.push(
      makeTask({
        id: `manual:${m.id}`,
        feedId: null,
        courseId: m.courseId && courseById.has(m.courseId) ? m.courseId : null,
        title: m.title,
        type: m.type,
        dueAt: m.dueAt,
        allDay: false,
        url: null,
        description: null,
        manual: true,
        generated: null,
      }),
    );
  }

  // Class times take the class's current name and colour, and go when the class does.
  for (const e of expandWeekly(ws.weekly, now)) {
    const picked = ws.eventColors[seriesKey(e.id)];
    if (!e.courseId) {
      events.push(picked ? { ...e, color: picked } : e);
      continue;
    }
    const course = courseById.get(e.courseId);
    if (!course || course.hidden) continue;
    events.push({ ...e, title: course.code, color: picked ?? course.color });
  }

  tasks.sort((a, b) => {
    const ad = a.dueAt ? Date.parse(a.dueAt) : Infinity;
    const bd = b.dueAt ? Date.parse(b.dueAt) : Infinity;
    return ad - bd || a.title.localeCompare(b.title);
  });
  events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  return {
    courses,
    visibleCourses: courses.filter((c) => !c.hidden),
    tasks,
    events,
    feeds: ws.feeds,
    courseById,
    feedById,
  };
}

/** Busy intervals for the planner. */
export function busyIntervals(events: CalEvent[]): { start: Date; end: Date }[] {
  return events.filter((e) => e.busy && !e.allDay).map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));
}

export { DAY };
