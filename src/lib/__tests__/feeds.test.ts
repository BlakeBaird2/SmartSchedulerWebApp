import assert from "node:assert/strict";
import test from "node:test";
import { parseFeed } from "../feeds/parse";
import { detectProvider, feedIdFor, normalizeFeedUrl } from "../feeds/url";
import { DEMO_FEEDS, demoFeedText } from "../feeds/demo";
import { FeedFetchError, assertPublicUrl, explainProblem, fetchFeedText, isPrivateAddress } from "../server/fetchFeed";

const TZ = "America/Denver";
const NOW = new Date("2026-10-01T18:00:00Z"); // Thursday, noon in Denver

const cal = (name: string, events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", `X-WR-CALNAME:${name}`, ...events, "END:VCALENDAR"].join("\r\n");
const ev = (lines: string[]) => ["BEGIN:VEVENT", "DTSTAMP:20260901T000000Z", ...lines, "END:VEVENT"].join("\r\n");

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

test("pasted links are normalized to https", () => {
  assert.equal(normalizeFeedUrl("webcal://p01-caldav.icloud.com/published/2/abc"), "https://p01-caldav.icloud.com/published/2/abc");
  assert.equal(normalizeFeedUrl("  https://example.edu/cal.ics  "), "https://example.edu/cal.ics");
  assert.equal(normalizeFeedUrl("example.edu/cal.ics"), "https://example.edu/cal.ics");
  assert.equal(normalizeFeedUrl("https://example.edu/cal.ics#frag"), "https://example.edu/cal.ics");
  assert.throws(() => normalizeFeedUrl(""), /Paste a calendar link/);
  assert.throws(() => normalizeFeedUrl("ftp://example.edu/cal.ics"), /Only web links/);
  assert.throws(() => normalizeFeedUrl("https://nodots/cal.ics"), /missing its website/);
});

test("the service behind a link is recognized", () => {
  assert.equal(detectProvider("https://byu.instructure.com/feeds/calendars/user_abc.ics"), "canvas");
  assert.equal(detectProvider("https://learningsuite.byu.edu/iCalFeed/ical.php?courseID=x"), "learningsuite");
  assert.equal(detectProvider("https://calendar.google.com/calendar/ical/a/private-b/basic.ics"), "google");
  assert.equal(detectProvider("https://outlook.office365.com/owa/calendar/x/y/calendar.ics"), "outlook");
  assert.equal(detectProvider("https://p01-caldav.icloud.com/published/2/abc"), "icloud");
  assert.equal(detectProvider("https://example.edu/cal.ics"), "other");
});

test("a feed id is stable for the same link and differs between links", () => {
  const a = "https://example.edu/a.ics";
  assert.equal(feedIdFor(a), feedIdFor(a));
  assert.notEqual(feedIdFor(a), feedIdFor("https://example.edu/b.ics"));
  assert.match(feedIdFor(a), /^f[0-9a-f]{16}$/);
});

// ---------------------------------------------------------------------------
// Refusing private addresses
// ---------------------------------------------------------------------------

test("private and special addresses are recognized", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "142.250.72.14", "2607:f8b0:4005:80a::200e", "::ffff:8.8.8.8"]) {
    assert.ok(!isPrivateAddress(ip), `${ip} should be public`);
  }
});

test("links to private hosts are refused before any request is made", async () => {
  const lookup = (host: string) =>
    Promise.resolve(host === "evil.example" ? [{ address: "169.254.169.254" }] : [{ address: "93.184.216.34" }]);
  await assert.rejects(assertPublicUrl(new URL("http://localhost/x"), lookup), FeedFetchError);
  await assert.rejects(assertPublicUrl(new URL("http://127.0.0.1/x"), lookup), FeedFetchError);
  await assert.rejects(assertPublicUrl(new URL("http://[::1]/x"), lookup), FeedFetchError);
  await assert.rejects(assertPublicUrl(new URL("https://evil.example/cal.ics"), lookup), /private address/);
  await assertPublicUrl(new URL("https://calendar.example/cal.ics"), lookup);
});

test("a redirect to a private address is refused", async () => {
  const lookup = (host: string) => Promise.resolve([{ address: host === "public.example" ? "93.184.216.34" : "10.0.0.5" }]);
  const fetchImpl = (async () =>
    new Response(null, { status: 302, headers: { location: "https://internal.example/secret" } })) as typeof fetch;
  await assert.rejects(fetchFeedText("https://public.example/cal.ics", { lookup, fetchImpl }), /private address/);
});

test("a web page is not accepted as a calendar", async () => {
  const lookup = () => Promise.resolve([{ address: "93.184.216.34" }]);
  const fetchImpl = (async () => new Response("<html>Sign in</html>", { status: 200 })) as typeof fetch;
  await assert.rejects(fetchFeedText("https://public.example/page", { lookup, fetchImpl }), /web page, not a calendar/);
});

test("a private calendar explains itself", async () => {
  const lookup = () => Promise.resolve([{ address: "93.184.216.34" }]);
  const fetchImpl = (async () => new Response("nope", { status: 403 })) as typeof fetch;
  await assert.rejects(fetchFeedText("https://public.example/cal.ics", { lookup, fetchImpl }), /subscription link/);
});

test("a calendar that passes the checks comes back as text", async () => {
  const lookup = () => Promise.resolve([{ address: "93.184.216.34" }]);
  const body = cal("OK", []);
  const fetchImpl = (async () => new Response(body, { status: 200 })) as typeof fetch;
  assert.equal(await fetchFeedText("https://public.example/cal.ics", { lookup, fetchImpl }), body);
});

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const CANVAS_URL = "https://byu.instructure.com/feeds/calendars/user_abc.ics";
const canvasFeed = cal("Blake Student", [
  ev([
    "UID:event-assignment-555",
    "DTSTART:20261003T055900Z",
    "DTEND:20261003T055900Z",
    "SUMMARY:Case Write-Up 3: A Hard Choice [MGMT 320]",
    "URL;VALUE=URI:https://byu.instructure.com/calendar?include_contexts=course_1234&month=10&year=2026#assignment_555",
    "DESCRIPTION:Answer the three questions.",
  ]),
  ev([
    "UID:event-assignment-556",
    "DTSTART:20261006T160000Z",
    "DTEND:20261006T160000Z",
    "SUMMARY:Quiz 4 [CS260-F26]",
    "URL:https://byu.instructure.com/calendar?include_contexts=course_2222#assignment_556",
  ]),
  ev([
    "UID:event-calendar-event-900",
    "DTSTART;TZID=America/Denver:20260928T140000",
    "DTEND;TZID=America/Denver:20260928T151500",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10",
    "SUMMARY:Class [CS260-F26]",
    "URL:https://byu.instructure.com/calendar?include_contexts=course_2222#calendar_event_900",
  ]),
  ev([
    "UID:event-calendar-event-901",
    "DTSTART:20261002T180000Z",
    "DTEND:20261002T180000Z",
    "SUMMARY:Reminder [MGMT 320]",
    "URL:https://byu.instructure.com/calendar?include_contexts=course_1234#calendar_event_901",
  ]),
]);

test("Canvas: classes come from the course code and course link", () => {
  const r = parseFeed(canvasFeed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.provider, "canvas");
  assert.equal(r.role, "school");
  const byKey = Object.fromEntries(r.courses.map((c) => [c.key, c]));
  assert.equal(byKey.course_1234.code, "MGMT 320");
  assert.equal(byKey.course_2222.code, "CS 260", "a term-tagged code is cleaned up");
  assert.equal(byKey.course_1234.url, "https://byu.instructure.com/courses/1234");
});

test("Canvas: assignments lose the bracket and link straight to the assignment", () => {
  const r = parseFeed(canvasFeed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW });
  const caseWriteUp = r.tasks.find((t) => t.uid === "event-assignment-555")!;
  assert.equal(caseWriteUp.title, "Case Write-Up 3: A Hard Choice");
  assert.equal(caseWriteUp.courseKey, "course_1234");
  assert.equal(caseWriteUp.url, "https://byu.instructure.com/courses/1234/assignments/555");
  assert.equal(caseWriteUp.dueAt, "2026-10-03T05:59:00.000Z");
  assert.equal(caseWriteUp.description, "Answer the three questions.");
  assert.equal(r.tasks.find((t) => t.uid === "event-assignment-556")!.type, "quiz");
});

test("Canvas: work due at 11:59 PM, sent as a date with no time, is due at the end of that day where the student is", () => {
  const feed = cal("Blake Student", [
    ev([
      "UID:event-assignment-700",
      "DTSTART;VALUE=DATE:20261030",
      "DTEND;VALUE=DATE:20261030",
      "SUMMARY:RDS Lab [IS 531]",
      "URL:https://byu.instructure.com/calendar?include_contexts=course_531#assignment_700",
    ]),
  ]);
  const lab = parseFeed(feed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW }).tasks.find((t) => t.uid === "event-assignment-700")!;
  // 11:59:59 PM on Friday, October 30 in Denver (MDT, UTC-6), never the evening before.
  assert.equal(lab.dueAt, "2026-10-31T05:59:59.000Z");
  assert.equal(lab.allDay, false, "it's due at 11:59 PM, so it shows that time");
  const tokyo = parseFeed(feed, { url: CANVAS_URL, role: "auto", timezone: "Asia/Tokyo", now: NOW }).tasks[0];
  assert.equal(tokyo.dueAt, "2026-10-30T14:59:59.000Z", "the end of the 30th in the student's own zone");
});

test("Canvas: weekly class meetings become busy time, one entry per meeting", () => {
  const r = parseFeed(canvasFeed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW });
  const classes = r.events.filter((e) => e.uid.startsWith("event-calendar-event-900"));
  assert.equal(classes.length, 10, "every meeting of a COUNT=10 series");
  assert.ok(classes.every((e) => e.busy && e.kind === "class" && e.courseKey === "course_2222"));
  assert.equal(classes[0].title, "Class");
  assert.equal(classes[0].start, "2026-09-28T20:00:00.000Z");
  assert.equal(classes[0].end, "2026-09-28T21:15:00.000Z");
  // A zero-length calendar entry is a note, not a block of time.
  const note = r.events.find((e) => e.uid === "event-calendar-event-901")!;
  assert.equal(note.busy, false);
});

// ---------------------------------------------------------------------------
// A single-course calendar, like Learning Suite
// ---------------------------------------------------------------------------

const LS_URL = "https://learningsuite.byu.edu/iCalFeed/ical.php?courseID=abc";
const lsFeed = cal("ECON 110 - Principles of Economics", [
  ev(["UID:ls-1", "DTSTART;VALUE=DATE:20261002", "SUMMARY:Chapter 4", "DESCRIPTION:Read it here: https://learningsuite.byu.edu/x/reading/4."]),
  ev(["UID:ls-2", "DTSTART;VALUE=DATE:20261005", "SUMMARY:Problem Set 3", "URL;VALUE=URI:https://learningsuite.byu.edu/x/assignment/3"]),
  ev(["UID:ls-3", "DTSTART;VALUE=DATE:20261009", "SUMMARY:No Class - Fall Break"]),
  ev([
    "UID:ls-lecture",
    "DTSTART;TZID=America/Denver:20260929T100000",
    "DTEND;TZID=America/Denver:20260929T111500",
    "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=8",
    "SUMMARY:Lecture",
  ]),
  ev([
    "UID:ls-exam",
    "DTSTART;TZID=America/Denver:20261008T100000",
    "DTEND;TZID=America/Denver:20261008T111500",
    "SUMMARY:Midterm Exam",
    "LOCATION:Testing Center",
  ]),
]);

test("single-course calendar: the calendar's own name becomes the class", () => {
  const r = parseFeed(lsFeed, { url: LS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.provider, "learningsuite");
  assert.equal(r.role, "school");
  assert.equal(r.courses.length, 1);
  assert.equal(r.courses[0].code, "ECON 110");
  assert.equal(r.courses[0].title, "Principles of Economics");
  assert.ok(r.tasks.every((t) => t.courseKey === "main"));
});

test("single-course calendar: all-day entries are due at the end of that day", () => {
  const r = parseFeed(lsFeed, { url: LS_URL, role: "auto", timezone: TZ, now: NOW });
  const chapter = r.tasks.find((t) => t.uid === "ls-1")!;
  assert.equal(chapter.allDay, true);
  assert.equal(chapter.type, "reading");
  assert.equal(chapter.dueAt, "2026-10-03T05:59:59.000Z", "23:59:59 in Denver on Oct 2");
});

test("single-course calendar: links are found in either place a feed puts them", () => {
  const r = parseFeed(lsFeed, { url: LS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.tasks.find((t) => t.uid === "ls-2")!.url, "https://learningsuite.byu.edu/x/assignment/3", "a URL tagged as a URI");
  assert.equal(r.tasks.find((t) => t.uid === "ls-1")!.url, "https://learningsuite.byu.edu/x/reading/4", "a link inside the description");
});

test("single-course calendar: announcements are not homework", () => {
  const r = parseFeed(lsFeed, { url: LS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.ok(!r.tasks.some((t) => t.uid === "ls-3"));
  const noClass = r.events.find((e) => e.uid === "ls-3")!;
  assert.equal(noClass.allDay, true);
  assert.equal(noClass.busy, false);
});

test("single-course calendar: lectures are busy time and an exam also means studying", () => {
  const r = parseFeed(lsFeed, { url: LS_URL, role: "auto", timezone: TZ, now: NOW });
  const lectures = r.events.filter((e) => e.uid.startsWith("ls-lecture@"));
  assert.equal(lectures.length, 8);
  assert.ok(lectures.every((e) => e.busy && e.kind === "class"));

  const exam = r.events.find((e) => e.uid === "ls-exam")!;
  assert.equal(exam.kind, "exam");
  assert.equal(exam.busy, true);
  assert.equal(exam.location, "Testing Center");

  const study = r.tasks.find((t) => t.uid === "study:ls-exam")!;
  assert.equal(study.title, "Study for Midterm Exam");
  assert.equal(study.type, "exam");
  assert.equal(study.generated, "study");
  assert.equal(study.dueAt, exam.start);
});

// ---------------------------------------------------------------------------
// Personal calendars
// ---------------------------------------------------------------------------

const personalFeed = cal("Personal", [
  ev([
    "UID:work@x",
    "DTSTART;TZID=America/Denver:20260929T090000",
    "DTEND;TZID=America/Denver:20260929T130000",
    "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T000000Z",
    "EXDATE;TZID=America/Denver:20261006T090000",
    "SUMMARY:Work shift",
  ]),
  ev([
    "UID:work@x",
    "RECURRENCE-ID;TZID=America/Denver:20261008T090000",
    "DTSTART;TZID=America/Denver:20261008T120000",
    "DTEND;TZID=America/Denver:20261008T160000",
    "SUMMARY:Work shift (moved)",
  ]),
  ev(["UID:coffee@x", "DTSTART;TZID=America/Denver:20261007T150000", "DTEND;TZID=America/Denver:20261007T160000", "TRANSP:TRANSPARENT", "SUMMARY:Maybe coffee"]),
  ev(["UID:bday@x", "DTSTART;VALUE=DATE:20261010", "SUMMARY:Mom's birthday", "RRULE:FREQ=YEARLY"]),
]);

test("personal calendar: nothing becomes homework, and no classes appear", () => {
  const r = parseFeed(personalFeed, { url: "https://calendar.google.com/calendar/ical/a/private-b/basic.ics", role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.role, "personal");
  assert.equal(r.tasks.length, 0);
  assert.equal(r.courses.length, 0);
});

test("personal calendar: repeats, skipped dates and moved dates are all honoured", () => {
  const r = parseFeed(personalFeed, { url: "https://calendar.google.com/calendar/ical/a/private-b/basic.ics", role: "auto", timezone: TZ, now: NOW });
  const shifts = r.events.filter((e) => e.uid.startsWith("work@x@")).map((e) => e.start);
  assert.ok(shifts.includes("2026-10-01T15:00:00.000Z"), "Thursday Oct 1");
  assert.ok(!shifts.some((s) => s.startsWith("2026-10-06")), "Tuesday Oct 6 was cancelled");
  const moved = r.events.find((e) => e.start === "2026-10-08T18:00:00.000Z")!;
  assert.equal(moved.title, "Work shift (moved)");
  assert.ok(moved.busy);
});

test("personal calendar: free and all-day entries do not block time", () => {
  const r = parseFeed(personalFeed, { url: "https://calendar.google.com/calendar/ical/a/private-b/basic.ics", role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.events.find((e) => e.uid === "coffee@x")!.busy, false);
  const bday = r.events.find((e) => e.uid.startsWith("bday@x@"))!;
  assert.equal(bday.allDay, true);
  assert.equal(bday.busy, false);
  assert.equal(bday.start, "2026-10-10T06:00:00.000Z", "midnight in Denver");
});

test("an unknown source is sorted by its shape", () => {
  const meetings = cal("Club", [
    ev(["UID:m1", "DTSTART:20261002T010000Z", "DTEND:20261002T020000Z", "SUMMARY:Club meeting"]),
    ev(["UID:m2", "DTSTART:20261009T010000Z", "DTEND:20261009T020000Z", "SUMMARY:Club meeting"]),
  ]);
  assert.equal(parseFeed(meetings, { url: "https://club.example/cal.ics", role: "auto", timezone: TZ, now: NOW }).role, "personal");
  const deadlines = cal("Course", [ev(["UID:d1", "DTSTART;VALUE=DATE:20261002", "SUMMARY:Homework 1"])]);
  assert.equal(parseFeed(deadlines, { url: "https://course.example/cal.ics", role: "auto", timezone: TZ, now: NOW }).role, "school");
});

test("a chosen role overrides the default", () => {
  const r = parseFeed(personalFeed, { url: "https://calendar.google.com/x/basic.ics", role: "school", timezone: TZ, now: NOW });
  assert.equal(r.role, "school");
});

test("entries far outside the semester window are dropped", () => {
  const r = parseFeed(
    cal("Old", [ev(["UID:old", "DTSTART;VALUE=DATE:20200101", "SUMMARY:Ancient homework"]), ev(["UID:new", "DTSTART;VALUE=DATE:20261002", "SUMMARY:Homework"])]),
    { url: "https://course.example/cal.ics", role: "school", timezone: TZ, now: NOW },
  );
  assert.deepEqual(r.tasks.map((t) => t.uid), ["new"]);
});

test("the sample feeds read cleanly through the real parser", () => {
  for (const [key, url] of Object.entries(DEMO_FEEDS)) {
    const r = parseFeed(demoFeedText(key as keyof typeof DEMO_FEEDS, TZ, NOW), { url, role: "auto", timezone: TZ, now: NOW });
    assert.equal(r.skipped, 0, `${key} skipped entries`);
    assert.ok(r.events.length + r.tasks.length > 5, `${key} has content`);
  }
  const canvas = parseFeed(demoFeedText("demo:canvas", TZ, NOW), { url: DEMO_FEEDS["demo:canvas"], role: "auto", timezone: TZ, now: NOW });
  assert.equal(canvas.courses.length, 3);
});

test("a weekly lecture does not make a course calendar look personal", () => {
  const course = cal("Principles of Accounting", [
    ev(["UID:lec", "DTSTART;TZID=America/Denver:20260901T100000", "DTEND;TZID=America/Denver:20260901T111500", "RRULE:FREQ=WEEKLY;BYDAY=TU,TH", "SUMMARY:Lecture"]),
    ev(["UID:r1", "DTSTART;VALUE=DATE:20261002", "SUMMARY:Read Chapter 4"]),
    ev(["UID:r2", "DTSTART;VALUE=DATE:20261009", "SUMMARY:Problem Set 3"]),
  ]);
  const r = parseFeed(course, { url: "https://courses.example.edu/acc.ics", role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.role, "school");
  assert.equal(r.courses.length, 1);
  assert.ok(r.tasks.some((t) => t.title === "Problem Set 3"));
});

test("a calendar named for a course is school even when it only has meetings", () => {
  const meetings = cal("ECON 110 - Principles of Economics", [
    ev(["UID:x1", "DTSTART:20261002T160000Z", "DTEND:20261002T171500Z", "SUMMARY:Class"]),
  ]);
  assert.equal(parseFeed(meetings, { url: "https://school.example/fin.ics", role: "auto", timezone: TZ, now: NOW }).role, "school");
});

test("a personal calendar from an unknown site stays personal", () => {
  assert.equal(parseFeed(personalFeed, { url: "https://cal.example.net/me.ics", role: "auto", timezone: TZ, now: NOW }).role, "personal");
});

test("canvas: a section's due date is work, and its section name names an 'All Sections' class", () => {
  const feed = cal("Student", [
    ev([
      "UID:event-assignment-700",
      "DTSTART:20261003T055900Z",
      "DTEND:20261003T055900Z",
      "SUMMARY:Kali Linux Setup [All Sections]",
      "URL:https://byu.instructure.com/calendar?include_contexts=course_3707#assignment_700",
    ]),
    ev([
      "UID:event-assignment-override-2358",
      "DTSTART:20261009T140500Z",
      "DTEND:20261009T140500Z",
      "SUMMARY:Diceware (in-class activity) (NET 460-001: Network Security) [All Sections]",
      "URL:https://byu.instructure.com/calendar?include_contexts=course_3707#assignment_701",
    ]),
  ]);
  const r = parseFeed(feed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.deepEqual(
    r.courses.map((c) => [c.code, c.title]),
    [["NET 460", "Network Security"]],
  );
  const override = r.tasks.find((t) => t.title === "Diceware (in-class activity)");
  assert.ok(override, "the section's due date became a task, without the section name in its title");
  assert.equal(override!.uid, "event-assignment-701");
  assert.equal(override!.url, "https://byu.instructure.com/courses/3707/assignments/701");
  assert.equal(r.events.length, 0);
});

test("canvas: without a section name, an 'All Sections' class keeps the label Canvas gave it", () => {
  const feed = cal("Student", [
    ev([
      "UID:event-assignment-700",
      "DTSTART:20261003T055900Z",
      "DTEND:20261003T055900Z",
      "SUMMARY:Kali Linux Setup [All Sections]",
      "URL:https://byu.instructure.com/calendar?include_contexts=course_3707#assignment_700",
    ]),
  ]);
  const r = parseFeed(feed, { url: CANVAS_URL, role: "auto", timezone: TZ, now: NOW });
  assert.equal(r.courses.length, 1);
  assert.equal(r.courses[0].code, "All Sections");
});

test("a failed link says what to do for the service it came from", async () => {
  const lookup = async () => [{ address: "93.184.216.34" }];
  const notFound = (async () => new Response("Not Found", { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(
    fetchFeedText("https://calendar.google.com/calendar/ical/me%40gmail.com/public/basic.ics", { lookup, fetchImpl: notFound }),
    /Secret address in iCal format/,
  );
  assert.match(explainProblem(new URL("https://learningsuite.byu.edu/student/schedule"), "webpage"), /iCalFeed\/ical\.php/);
  assert.match(explainProblem(new URL("https://byu.instructure.com/calendar"), "webpage"), /Calendar Feed/);
  assert.match(explainProblem(new URL("https://example.org/cal.ics"), "missing"), /Copy a fresh link/);
});
