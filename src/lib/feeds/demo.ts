/**
 * Sample feeds, generated around today in the visitor's timezone.
 *
 * They are real iCalendar text and go through the same parser as any pasted link,
 * so demo mode exercises Canvas-style course detection, a single-course calendar,
 * weekly recurrence with an exception, and a personal calendar.
 */
import { safeTimezone, zonedTime } from "../tz";

export const DEMO_FEEDS = {
  "demo:canvas": "https://example.instructure.com/feeds/calendars/user_demo.ics",
  "demo:course": "https://courses.example.edu/ical/principles-of-accounting.ics",
  "demo:personal": "https://calendar.google.com/calendar/ical/demo/private-demo/basic.ics",
} as const;

export type DemoKey = keyof typeof DEMO_FEEDS;

export function isDemoKey(value: string): value is DemoKey {
  return value in DEMO_FEEDS;
}

interface LocalDay {
  y: number;
  m: number;
  d: number;
  /** 0 = Sunday */
  dow: number;
}

function today(now: Date, tz: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), dow };
}

function addDays(day: LocalDay, n: number): LocalDay {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const dateStamp = (day: LocalDay) => `${day.y}${pad(day.m)}${pad(day.d)}`;
const localStamp = (day: LocalDay, h: number, mi: number) => `${dateStamp(day)}T${pad(h)}${pad(mi)}00`;

function calendar(name: string, events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartScheduler//Demo//EN",
    `X-WR-CALNAME:${name}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function vevent(lines: string[]): string {
  return ["BEGIN:VEVENT", "DTSTAMP:20260101T000000Z", ...lines, "END:VEVENT"].join("\r\n");
}

/** Monday of the current week. */
function weekStart(t: LocalDay): LocalDay {
  return addDays(t, -((t.dow + 6) % 7));
}

function canvasFeed(t: LocalDay, tz: string): string {
  const origin = "https://example.instructure.com";
  const courses = [
    { id: "4101", code: "BUS 301" },
    { id: "4102", code: "CS 142" },
    { id: "4103", code: "WRTG 150" },
  ];
  const events: string[] = [];
  let n = 1;
  const assignment = (course: (typeof courses)[number], title: string, day: LocalDay, h: number, mi: number) => {
    const due = zonedTime(day.y, day.m, day.d, h, mi, 0, tz);
    const id = 90000 + n++;
    events.push(
      vevent([
        `UID:event-assignment-${id}`,
        `DTSTART:${utcStamp(due)}`,
        `DTEND:${utcStamp(due)}`,
        `SUMMARY:${title} [${course.code}]`,
        `URL;VALUE=URI:${origin}/calendar?include_contexts=course_${course.id}&month=${pad(day.m)}&year=${day.y}#assignment_${id}`,
        `DESCRIPTION:${title} for ${course.code}.`,
      ]),
    );
  };

  const mon = weekStart(t);
  for (let week = -1; week <= 3; week++) {
    const base = addDays(mon, week * 7);
    const [bus, cs, wrtg] = courses;
    assignment(bus, `Case Write-Up ${week + 3}`, addDays(base, 1), 9, 30);
    assignment(bus, `Reading: Chapter ${week + 4}`, addDays(base, 0), 8, 0);
    assignment(cs, `Lab ${week + 5}`, addDays(base, 2), 23, 59);
    assignment(cs, `Quiz ${week + 3}`, addDays(base, 4), 17, 0);
    if (week === 1) assignment(cs, "Project 2: Implementation", addDays(base, 4), 23, 59);
    assignment(wrtg, `Reading Response ${week + 4}`, addDays(base, 3), 11, 0);
    if (week === 2) assignment(wrtg, "Essay 1 Final Draft", addDays(base, 4), 23, 59);
    if (week === 2) assignment(bus, "Midterm Exam", addDays(base, 3), 20, 0);
  }

  // One professor posts class meetings on the Canvas calendar, as a weekly event.
  const firstMon = addDays(mon, -7);
  events.push(
    vevent([
      "UID:event-calendar-event-7001",
      `DTSTART;TZID=${tz}:${localStamp(firstMon, 14, 0)}`,
      `DTEND;TZID=${tz}:${localStamp(firstMon, 15, 15)}`,
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=30",
      "SUMMARY:Class [WRTG 150]",
      "LOCATION:JFSB 2104",
      `URL;VALUE=URI:${origin}/calendar?include_contexts=course_4103#calendar_event_7001`,
    ]),
  );
  return calendar("Demo Student", events);
}

function courseFeed(t: LocalDay, tz: string): string {
  const events: string[] = [];
  const mon = weekStart(t);
  let n = 1;
  for (let week = -1; week <= 3; week++) {
    const base = addDays(mon, week * 7);
    events.push(vevent([`UID:acc-${n++}@demo`, `DTSTART;VALUE=DATE:${dateStamp(addDays(base, 1))}`, `SUMMARY:Read Chapter ${week + 5}`]));
    events.push(vevent([`UID:acc-${n++}@demo`, `DTSTART;VALUE=DATE:${dateStamp(addDays(base, 3))}`, `SUMMARY:Problem Set ${week + 4}`]));
  }
  // Class meets Tuesday and Thursday.
  const firstTue = addDays(mon, -6);
  events.push(
    vevent([
      "UID:acc-class@demo",
      `DTSTART;TZID=${tz}:${localStamp(firstTue, 10, 0)}`,
      `DTEND;TZID=${tz}:${localStamp(firstTue, 11, 15)}`,
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=30",
      "SUMMARY:Lecture",
      "LOCATION:TNRB 120",
    ]),
  );
  // An in-class exam, which also becomes study time.
  const exam = addDays(mon, 8);
  events.push(
    vevent([
      "UID:acc-exam@demo",
      `DTSTART;TZID=${tz}:${localStamp(exam, 10, 0)}`,
      `DTEND;TZID=${tz}:${localStamp(exam, 11, 15)}`,
      "SUMMARY:Midterm Exam 1",
      "LOCATION:Testing Center",
    ]),
  );
  events.push(vevent([`UID:acc-break@demo`, `DTSTART;VALUE=DATE:${dateStamp(addDays(mon, 11))}`, "SUMMARY:No Class - Reading Day"]));
  return calendar("ACC 200 - Principles of Accounting", events);
}

function personalFeed(t: LocalDay, tz: string): string {
  const mon = weekStart(t);
  const firstTue = addDays(mon, -6);
  const firstMon = addDays(mon, -7);
  const events = [
    vevent([
      "UID:work@demo",
      `DTSTART;TZID=${tz}:${localStamp(firstTue, 13, 0)}`,
      `DTEND;TZID=${tz}:${localStamp(firstTue, 17, 0)}`,
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=30",
      "SUMMARY:Work shift",
      "LOCATION:Campus Bookstore",
    ]),
    vevent([
      "UID:gym@demo",
      `DTSTART;TZID=${tz}:${localStamp(firstMon, 7, 0)}`,
      `DTEND;TZID=${tz}:${localStamp(firstMon, 8, 0)}`,
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=45",
      "SUMMARY:Gym",
    ]),
    vevent([
      "UID:dinner@demo",
      `DTSTART;TZID=${tz}:${localStamp(addDays(mon, 4), 18, 30)}`,
      `DTEND;TZID=${tz}:${localStamp(addDays(mon, 4), 20, 30)}`,
      "SUMMARY:Dinner with roommates",
    ]),
    vevent(["UID:bday@demo", `DTSTART;VALUE=DATE:${dateStamp(addDays(mon, 5))}`, "SUMMARY:Mom's birthday", "RRULE:FREQ=YEARLY"]),
  ];
  return calendar("Personal", events);
}

export function demoFeedText(key: DemoKey, timezone: string, now = new Date()): string {
  const tz = safeTimezone(timezone);
  const t = today(now, tz);
  if (key === "demo:canvas") return canvasFeed(t, tz);
  if (key === "demo:course") return courseFeed(t, tz);
  return personalFeed(t, tz);
}
