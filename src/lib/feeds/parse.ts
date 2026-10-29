/**
 * Turn an iCalendar feed into classes, things due, and busy time.
 *
 * Server only: it relies on node-ical. The same rules apply to every source, with
 * a few that only make sense for Canvas, whose feed format is known exactly (see
 * app/models/calendar_event.rb in instructure/canvas-lms):
 *   - assignments have UIDs "event-assignment-<id>" and start == end == due time
 *   - calendar events have UIDs "event-calendar-event-<id>"
 *   - the summary ends with " [<course code>]"
 *   - the URL names the course in include_contexts=course_<id>
 */
import ical, { type CalendarResponse, type VEvent } from "node-ical";
import type { EventKind, FeedCourse, FeedEvent, FeedResult, FeedRole, FeedTask, Provider } from "../types";
import { classify, isNoiseEvent, looksLikeExam } from "../classify";
import { courseLabels, findCourseCode } from "../courses";
import { htmlToText } from "../text";
import { safeTimezone, zonedEndOfDay, zonedStartOfDay } from "../tz";
import { PROVIDER_LABEL, defaultRole, detectProvider } from "./url";

const DAY = 86_400_000;
/** How far back and forward to look. Wide enough for a semester, small enough to stay fast. */
const EVENT_PAST = 35 * DAY;
const EVENT_FUTURE = 150 * DAY;
const TASK_PAST = 60 * DAY;
const TASK_FUTURE = 240 * DAY;
const MAX_OCCURRENCES = 8000;

/** All-day entries on a course calendar that are announcements, not homework. */
const NOT_WORK_RE = /\b(no class(es)?|class(es)? cancel+ed|holiday|recess|reading days?|spring break|fall break|winter break|thanksgiving|vacation|campus closed|last day of class(es)?|first day of class(es)?)\b/i;

export interface ParseOptions {
  url: string;
  /** "auto" picks a role from the source, falling back to the shape of the feed. */
  role: FeedRole | "auto";
  /** The student's IANA timezone, which decides what an all-day date means. */
  timezone: string;
  now?: Date;
}

interface Occurrence {
  uid: string;
  baseUid: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  description: string | null;
  rawDescription: string;
  location: string | null;
  url: string | null;
  transparent: boolean;
  categories: string;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "val" in (v as Record<string, unknown>)) return String((v as { val: unknown }).val ?? "");
  return String(v);
}

function httpUrl(value: string): string | null {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

/** The first web link inside a description, for feeds that put the link there. */
function linkIn(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'()\]]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
}

function isDate(v: unknown): v is Date & { dateOnly?: boolean } {
  return v instanceof Date && !Number.isNaN(v.getTime());
}

/** node-ical builds date-only values at local midnight, so read the date back with local getters. */
function dateParts(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

function occurrencesOf(ev: VEvent, from: Date, to: Date): Occurrence[] {
  const base = {
    baseUid: (ev.uid || "").trim(),
    categories: Array.isArray(ev.categories) ? ev.categories.map(String).join(" ") : "",
  };

  const build = (source: VEvent, start: Date, end: Date | null, allDay: boolean, uid: string): Occurrence => {
    const rawDescription = str(source.description);
    return {
      ...base,
      uid,
      title: str(source.summary).replace(/\s+/g, " ").trim(),
      start,
      end,
      allDay,
      description: htmlToText(rawDescription),
      rawDescription,
      location: str(source.location).trim() || null,
      url: httpUrl(str(source.url)) ?? linkIn(rawDescription),
      transparent: str((source as { transparency?: unknown }).transparency).toUpperCase() === "TRANSPARENT",
    };
  };

  if (ev.rrule) {
    const out: Occurrence[] = [];
    for (const inst of ical.expandRecurringEvent(ev, { from, to })) {
      if (!isDate(inst.start)) continue;
      const source = inst.event ?? ev;
      if (str((source as { status?: unknown }).status).toUpperCase() === "CANCELLED") continue;
      out.push(
        build(source, inst.start, isDate(inst.end) ? inst.end : null, inst.isFullDay, `${base.baseUid}@${inst.start.toISOString()}`),
      );
    }
    return out;
  }

  if (!isDate(ev.start)) return [];
  const allDay = ev.datetype === "date" || Boolean(ev.start.dateOnly);
  return [build(ev, ev.start, isDate(ev.end) ? ev.end : null, allDay, base.baseUid)];
}

/** Canvas-only: the course code in brackets at the end of every summary. */
function splitCanvasSummary(title: string): { title: string; code: string | null } {
  const m = title.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  return m ? { title: m[1].trim() || title, code: m[2].trim() } : { title, code: null };
}

/** Canvas-only: which course an entry belongs to, from its calendar link. */
function canvasContext(url: string | null): { origin: string; courseId: string | null } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const contexts = (u.searchParams.get("include_contexts") ?? "").split(",");
    const course = contexts.map((c) => c.trim().match(/^course_(\d+)$/)).find(Boolean);
    return { origin: u.origin, courseId: course ? course[1] : null };
  } catch {
    return null;
  }
}

/** Titles that read like coursework rather than life. */
const COURSEWORK_RE =
  /\b(homework|hw ?\d+|assignment|problem set|pset|quiz|exam|midterm|final exam|reading|chapter|ch\. ?\d+|lab ?\d+|essay|paper|project|lecture|discussion|module|syllabus|due)\b/i;

/**
 * For a link from an unknown site, decide whether it holds coursework or just
 * someone's time. Each event counts once, however often it repeats, so a weekly
 * lecture does not outvote a term's worth of deadlines.
 */
function guessRole(occurrences: Occurrence[], calendarName: string | null): FeedRole {
  if (findCourseCode(calendarName)) return "school";
  const events = new Map<string, Occurrence>();
  for (const o of occurrences) if (!events.has(o.baseUid || o.uid)) events.set(o.baseUid || o.uid, o);
  if (events.size === 0) return "personal";

  let timed = 0;
  let deadlines = 0;
  let coursework = 0;
  for (const o of events.values()) {
    const hasDuration = o.end !== null && o.end.getTime() > o.start.getTime();
    if (!o.allDay && hasDuration) timed++;
    else deadlines++;
    if (COURSEWORK_RE.test(o.title)) coursework++;
  }
  if (coursework * 3 >= events.size) return "school";
  return deadlines > timed ? "school" : "personal";
}

export function parseFeed(text: string, options: ParseOptions): FeedResult {
  const now = options.now ?? new Date();
  const tz = safeTimezone(options.timezone);

  let parsed: CalendarResponse;
  try {
    parsed = ical.sync.parseICS(text);
  } catch (e) {
    throw new Error(`That calendar could not be read: ${e instanceof Error ? e.message : String(e)}`);
  }

  const vcal = parsed.vcalendar as { prodid?: string; "WR-CALNAME"?: unknown } | undefined;
  const calendarName = str(vcal?.["WR-CALNAME"]).trim() || null;
  const provider: Provider = detectProvider(options.url, vcal?.prodid ?? null);

  const from = new Date(now.getTime() - Math.max(EVENT_PAST, TASK_PAST));
  const to = new Date(now.getTime() + Math.max(EVENT_FUTURE, TASK_FUTURE));

  let skipped = 0;
  const occurrences: Occurrence[] = [];
  for (const value of Object.values(parsed)) {
    if (!value || (value as { type?: string }).type !== "VEVENT") continue;
    const ev = value as VEvent;
    if (str((ev as { status?: unknown }).status).toUpperCase() === "CANCELLED") continue;
    try {
      occurrences.push(...occurrencesOf(ev, from, to));
    } catch {
      skipped++;
    }
    if (occurrences.length > MAX_OCCURRENCES) break;
  }

  const role: FeedRole = options.role === "auto" ? (defaultRole(provider) ?? guessRole(occurrences, calendarName)) : options.role;

  const courses = new Map<string, FeedCourse>();
  /** Canvas: a section name seen for each course, e.g. "NET 460-001: Network Security". */
  const sectionNames = new Map<string, string>();
  const tasks: FeedTask[] = [];
  const events: FeedEvent[] = [];
  const seen = new Set<string>();

  // Feeds other than Canvas describe a single class, named by the calendar itself.
  const singleCourseKey = role === "school" && provider !== "canvas" ? "main" : null;
  if (singleCourseKey) {
    const labels = courseLabels(calendarName ?? PROVIDER_LABEL[provider]);
    courses.set(singleCourseKey, { key: singleCourseKey, code: labels.code, title: labels.title, url: null });
  }

  const inTaskWindow = (d: Date) => d.getTime() >= now.getTime() - TASK_PAST && d.getTime() <= now.getTime() + TASK_FUTURE;
  const inEventWindow = (start: Date, end: Date) =>
    end.getTime() >= now.getTime() - EVENT_PAST && start.getTime() <= now.getTime() + EVENT_FUTURE;

  const addTask = (task: FeedTask) => {
    if (seen.has(`t:${task.uid}`) || !inTaskWindow(new Date(task.dueAt))) return;
    seen.add(`t:${task.uid}`);
    tasks.push(task);
  };
  const addEvent = (event: FeedEvent) => {
    if (seen.has(`e:${event.uid}`) || !inEventWindow(new Date(event.start), new Date(event.end))) return;
    seen.add(`e:${event.uid}`);
    events.push(event);
  };

  /** Busy time before an exam is not the whole story: studying for it is work too. */
  const addStudyTask = (o: Occurrence, title: string, courseKey: string | null) =>
    addTask({
      uid: `study:${o.uid}`,
      courseKey,
      title: `Study for ${title}`,
      type: "exam",
      dueAt: o.start.toISOString(),
      allDay: false,
      url: o.url,
      description: null,
      generated: "study",
    });

  const allDayBounds = (o: Occurrence): { start: Date; end: Date } => {
    const [y, m, d] = dateParts(o.start);
    const start = zonedStartOfDay(y, m, d, tz);
    let end: Date;
    if (o.end && o.end.getTime() > o.start.getTime()) {
      const [ey, em, ed] = dateParts(o.end);
      end = zonedStartOfDay(ey, em, ed, tz);
    } else {
      end = new Date(start.getTime() + DAY);
    }
    if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + DAY);
    return { start, end };
  };

  const endOfDate = (o: Occurrence): Date => {
    const [y, m, d] = dateParts(o.start);
    return zonedEndOfDay(y, m, d, tz);
  };

  const timedEvent = (o: Occurrence, title: string, courseKey: string | null, kind: EventKind, busy: boolean, url = o.url) =>
    addEvent({
      uid: o.uid,
      courseKey,
      title,
      start: o.start.toISOString(),
      end: (o.end ?? o.start).toISOString(),
      allDay: false,
      busy,
      kind,
      location: o.location,
      url,
    });

  const allDayEvent = (o: Occurrence, title: string, courseKey: string | null) => {
    const { start, end } = allDayBounds(o);
    addEvent({
      uid: o.uid,
      courseKey,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: true,
      busy: false,
      kind: "event",
      location: o.location,
      url: o.url,
    });
  };

  for (const o of occurrences) {
    try {
      if (!o.title) continue;
      const hasDuration = !o.allDay && o.end !== null && o.end.getTime() > o.start.getTime();

      if (role === "personal") {
        if (o.allDay) allDayEvent(o, o.title, null);
        else timedEvent(o, o.title, null, "event", hasDuration && !o.transparent);
        continue;
      }

      if (provider === "canvas") {
        const split = splitCanvasSummary(o.title);
        let title = split.title;
        const code = split.code;
        const ctx = canvasContext(o.url);
        const courseKey = ctx?.courseId ? `course_${ctx.courseId}` : null;

        // A due date set for one section has its own UID and ends with the
        // section's name, e.g. "Lab 3 (NET 460-001: Network Security)". That
        // name is often the only place the real course code appears.
        const override = o.baseUid.startsWith("event-assignment-override-");
        if (override) {
          const section = title.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
          if (section && findCourseCode(section[2])) {
            title = section[1];
            if (courseKey && !sectionNames.has(courseKey)) sectionNames.set(courseKey, section[2].trim());
          }
        }
        if (courseKey && !courses.has(courseKey)) {
          const labels = courseLabels(code ?? `Course ${ctx!.courseId}`, code);
          courses.set(courseKey, {
            key: courseKey,
            code: labels.code,
            title: labels.title,
            url: `${ctx!.origin}/courses/${ctx!.courseId}`,
          });
        }

        const assignmentId = override ? (o.url?.match(/#assignment_(\d+)/)?.[1] ?? null) : (o.baseUid.match(/^event-(?:sub-)?assignment-(\d+)/)?.[1] ?? null);
        if (assignmentId || override) {
          // The feed links to the calendar; rebuild the link to the assignment itself.
          const direct =
            ctx?.courseId && assignmentId && !o.baseUid.startsWith("event-sub-")
              ? `${ctx.origin}/courses/${ctx.courseId}/assignments/${assignmentId}`
              : o.url;
          addTask({
            // Keyed by the assignment, so a section date appearing or going away keeps done marks.
            uid: override && assignmentId ? `event-assignment-${assignmentId}` : o.uid,
            courseKey,
            title,
            type: classify({ title }),
            // Canvas sends work due at 11:59 PM as a date with no time. That means the
            // end of that day where the student is, not its first moment (which, read
            // on a server in UTC, is the evening before in the Americas).
            dueAt: (o.allDay ? endOfDate(o) : o.start).toISOString(),
            allDay: false,
            url: direct,
            description: o.description,
          });
          continue;
        }

        if (o.allDay) {
          allDayEvent(o, title, courseKey);
        } else if (hasDuration) {
          const exam = looksLikeExam(title);
          timedEvent(o, title, courseKey, exam ? "exam" : courseKey ? "class" : "event", !o.transparent);
          if (exam) addStudyTask(o, title, courseKey);
        } else {
          timedEvent(o, title, courseKey, "event", false);
        }
        continue;
      }

      // Any other course calendar, such as Learning Suite.
      const courseKey = singleCourseKey;
      if (o.allDay) {
        const multiDay = o.end !== null && o.end.getTime() - o.start.getTime() > DAY;
        if (multiDay || NOT_WORK_RE.test(o.title)) {
          allDayEvent(o, o.title, courseKey);
        } else if (!isNoiseEvent(o.title)) {
          addTask({
            uid: o.uid,
            courseKey,
            title: o.title,
            type: classify({ title: o.title, groupName: o.categories || null }),
            dueAt: endOfDate(o).toISOString(),
            allDay: true,
            url: o.url,
            description: o.description,
          });
        }
      } else if (!hasDuration) {
        addTask({
          uid: o.uid,
          courseKey,
          title: o.title,
          type: classify({ title: o.title, groupName: o.categories || null }),
          dueAt: o.start.toISOString(),
          allDay: false,
          url: o.url,
          description: o.description,
        });
      } else {
        const exam = looksLikeExam(o.title);
        timedEvent(o, o.title, courseKey, exam ? "exam" : "class", !o.transparent);
        if (exam) addStudyTask(o, o.title, courseKey);
      }
    } catch {
      skipped++;
    }
  }

  // Canvas only puts a course's code in its entries, and some courses have a code
  // like "All Sections". A section name found above can name the class properly.
  for (const [key, section] of sectionNames) {
    const course = courses.get(key);
    if (!course) continue;
    const fromSection = courseLabels(section);
    const known = findCourseCode(course.code);
    if (!known || (known === fromSection.code && course.title === course.code)) {
      courses.set(key, { ...course, code: fromSection.code, title: fromSection.title });
    }
  }

  tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title));
  events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  return {
    url: options.url,
    provider,
    role,
    calendarName,
    fetchedAt: now.toISOString(),
    courses: [...courses.values()],
    tasks,
    events,
    skipped,
  };
}
