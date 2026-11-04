/**
 * The home page, in the app's own design: a tagline, then the picture (the
 * calendars a student juggles, arrows into Schedule Smart on a laptop and
 * phone), then what it does and a way in. It renders on the server
 * so it shows up at once. Anyone who already has calendars set up skips it (see
 * the root layout) and goes straight to the app at /app.
 *
 * The same page is served at /about (`variant="about"`) for people who already use
 * Schedule Smart, where the main button opens the app instead of starting setup.
 */
import "@fontsource-variable/fredoka";
import "@fontsource-variable/caveat";
import Link from "next/link";
import { CalendarFunnel } from "./CalendarFunnel";
import { PrototypeBadge } from "./Prototype";
import { SsIcon } from "./SsIcon";

export type LandingVariant = "home" | "about";

/** Whether this deployment offers signing in to sync devices (see cloud.ts). */
const SYNCABLE = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

export function Landing({ variant = "home" }: { variant?: LandingVariant }) {
  return (
    <div className="ss-home">
      <header className="ss-home-bar">
        <Link href="/" className="ss-brand" aria-label="Schedule Smart, home">
          <span>Schedule Smart</span>
        </Link>
        <PrototypeBadge />
        <Link href="/app" className="ss-home-quiet ss-home-open">
          Open app
        </Link>
      </header>

      <main>
        {/* First thing on the page: the problem, then the picture of it being solved. */}
        <h1 className="ss-home-tagline">
          Too many calendars? <span>Regain control with one tool.</span>
        </h1>

        <CalendarFunnel>
          <Preview />
        </CalendarFunnel>

        {/* Where they act: a bright card, with a doodle or two to match the icons above. */}
        <section className="ss-home-hero" aria-labelledby="home-title">
          <Doodles />
          <span className="ss-home-kicker">
            <SsIcon name="spark" size={14} /> YOUR PERSONAL PLANNER
          </span>
          <h2 id="home-title">
            Plan your{" "}
            <span className="ss-home-scribble">
              open time.
              <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
                <path d="M4 15 C 60 6, 120 20, 180 11 S 270 8, 296 13" />
              </svg>
            </span>
          </h2>
          <p>Your classes, assignments, work and plans on one calendar. Drag what&apos;s due into the free time you have.</p>
          <div className="ss-home-actions">
            <span className="ss-home-handnote" aria-hidden>
              it&apos;s free!
              <svg viewBox="0 0 90 50">
                <path d="M6 12 C 30 4, 62 10, 80 34" />
                <path d="M68 32 L 81 36 L 82 22" />
              </svg>
            </span>
            <Link href="/app" className="ss-home-go">
              {variant === "about" ? "Open Schedule Smart" : "Get started"} <SsIcon name="chevronRight" size={18} />
            </Link>
            {/* A full page load rather than next/link, so the app sees #demo as it starts. */}
            <a href="/app#demo" className="ss-home-try" data-smart-event="sample_data_started">
              Try it with sample data
            </a>
          </div>
          <p className="ss-home-note">{SYNCABLE ? "Free · No account needed · Sign in to sync your phone and laptop" : "Free · No account · Saved only in your browser"}</p>
        </section>
      </main>

      <footer className="ss-home-foot">
        <span>Schedule Smart · an early prototype</span>
        <Link href="/app">Open Schedule Smart</Link>
      </footer>
    </div>
  );
}

/** A few hand-drawn sparkles and loops in the card's corners, like the icons' marker lines. */
function Doodles() {
  return (
    <>
      <svg className="ss-doodle ss-doodle-star" viewBox="0 0 40 40" aria-hidden>
        <path d="M20 3 C 21 14, 26 19, 37 20 C 26 21, 21 26, 20 37 C 19 26, 14 21, 3 20 C 14 19, 19 14, 20 3 Z" />
      </svg>
      <svg className="ss-doodle ss-doodle-star-small" viewBox="0 0 40 40" aria-hidden>
        <path d="M20 3 C 21 14, 26 19, 37 20 C 26 21, 21 26, 20 37 C 19 26, 14 21, 3 20 C 14 19, 19 14, 20 3 Z" />
      </svg>
      <svg className="ss-doodle ss-doodle-loop" viewBox="0 0 120 50" aria-hidden>
        <path d="M4 36 C 20 8, 40 8, 44 26 C 48 44, 26 44, 32 26 C 38 8, 70 6, 78 28 C 84 44, 62 44, 68 26 C 74 8, 104 10, 116 20" />
      </svg>
      <svg className="ss-doodle ss-doodle-dots" viewBox="0 0 60 20" aria-hidden>
        <circle cx="8" cy="10" r="3.5" />
        <circle cx="30" cy="10" r="3.5" />
        <circle cx="52" cy="10" r="3.5" />
      </svg>
    </>
  );
}

// ---------------------------------------------------------------------------
// A still of the calendar page, drawn with the app's own pieces and shown on a
// laptop, with an iPhone beside it showing the phone layout, so it's plainly a
// picture of the website rather than something to click. The caption points to
// the sample data for that.
// ---------------------------------------------------------------------------

/** The planner's cards, each striped in its class's colour (from the app's class colours). */
const PLANNER = [
  { title: "Read Chapter 5", code: "ACC 200", when: "Today", minutes: "30 min", color: "#e11d48" },
  { title: "Problem Set 4", code: "MATH 112", when: "Tomorrow", minutes: "1 hr", color: "#059669" },
  { title: "Essay outline", code: "WRTG 150", when: "Fri", minutes: "45 min", color: "#d97706" },
  { title: "Lab report draft", code: "CS 142", when: "Mon", minutes: "1 hr", color: "#4f46e5" },
];

const taskColor = (color: string) => ({ "--task": color }) as React.CSSProperties;

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

/** Each event: its day, start hour (8 am is 0) and length in hours. */
const EVENTS: { day: number; at: number; hours: number; kind: "school" | "work" | "personal" | "planned"; title: string; time: string }[] = [
  { day: 0, at: 1, hours: 1.25, kind: "school", title: "CS 142", time: "9:00 – 10:15" },
  { day: 2, at: 1, hours: 1.25, kind: "school", title: "CS 142", time: "9:00 – 10:15" },
  { day: 1, at: 0.5, hours: 3, kind: "work", title: "Work", time: "8:30 – 11:30" },
  { day: 3, at: 0.5, hours: 3, kind: "work", title: "Work", time: "8:30 – 11:30" },
  { day: 0, at: 3, hours: 1, kind: "planned", title: "Lab 5", time: "11:00 · 1 hr" },
  { day: 2, at: 3.5, hours: 1, kind: "planned", title: "Quiz 3 prep", time: "11:30 · 1 hr" },
  { day: 4, at: 2, hours: 1.5, kind: "personal", title: "Gym", time: "10:00 – 11:30" },
  { day: 0, at: 5, hours: 1.25, kind: "school", title: "ACC 200", time: "1:00 – 2:15" },
  { day: 2, at: 5, hours: 1.25, kind: "school", title: "ACC 200", time: "1:00 – 2:15" },
  { day: 1, at: 5, hours: 1.5, kind: "planned", title: "Homework", time: "1:00 · 1.5 hr" },
  { day: 3, at: 5.5, hours: 1, kind: "planned", title: "Reading", time: "1:30 · 1 hr" },
  { day: 4, at: 4.5, hours: 3.5, kind: "work", title: "Work", time: "12:30 – 4:00" },
  { day: 1, at: 7, hours: 1, kind: "personal", title: "Study group", time: "3:00 – 4:00" },
];

/** The hours down the side: 8 AM to 4 PM, a working day as it would show on a laptop. */
const HOURS = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM"];

const HOUR = 46;

function Preview() {
  return (
    <figure className="ss-devices">
      <div
        className="ss-devices-stage"
        role="img"
        aria-label="Schedule Smart on a laptop and an iPhone: a week of classes, work and the gym, with tasks dragged into the free time between them."
      >
        <div className="ss-laptop" aria-hidden>
          <div className="ss-laptop-lid">
            <span className="ss-laptop-camera" />
            <div className="ss-laptop-screen">
              <div className="ss-laptop-canvas">
                <AppBar />
                <Still />
              </div>
            </div>
          </div>
          <div className="ss-laptop-base" />
        </div>
        <div className="ss-iphone" aria-hidden>
          <div className="ss-iphone-screen">
            <div className="ss-iphone-canvas">
              <span className="ss-iphone-island" />
              <div className="ss-iphone-status">
                <b>9:41</b>
                <span>
                  <i className="ss-iphone-signal" />
                  <i className="ss-iphone-battery" />
                </span>
              </div>
              <AppBar />
              <PhoneStill />
              <span className="ss-iphone-home" />
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** The app's top bar, as on both screens. */
function AppBar() {
  return (
    <div className="ss-laptop-appbar">
      <span>Schedule Smart</span>
      <nav>
        <b>
          <SsIcon name="calendar" size={12} /> Calendar
        </b>
        <span>
          <SsIcon name="list" size={12} /> Tasks
        </span>
      </nav>
      <i>SS</i>
    </div>
  );
}

/** The phone's hours: the same working day, taller, as the app shows it on a phone. */
const PHONE_HOUR = 66;

/** What's on the iPhone's screen: the planner beside today, as the app is on a phone. */
function PhoneStill() {
  const today = EVENTS.filter((e) => e.day === 2);
  return (
    <div className="ss-iphone-app">
      <div className="ss-iphone-planner">
        <span className="ss-eyebrow">
          <SsIcon name="spark" size={12} /> PLANNER
        </span>
        <strong>Plan your open time</strong>
        {PLANNER.map((t) => (
          <div key={t.title} className="ss-iphone-task" style={taskColor(t.color)}>
            <h3>{t.title}</h3>
            <p>
              <b>{t.code}</b> · {t.when}
            </p>
            <span className="ss-minutes">
              <SsIcon name="clock" size={12} /> {t.minutes}
            </span>
          </div>
        ))}
      </div>
      <div className="ss-iphone-day">
        <div className="ss-iphone-day-head">
          WED <b>14</b>
        </div>
        <div className="ss-iphone-day-body" style={{ height: PHONE_HOUR * HOURS.length }}>
          {HOURS.map((h, i) => (
            <span key={h} className="ss-iphone-hour" style={{ top: i * PHONE_HOUR }}>
              {h}
            </span>
          ))}
          {today.map((e) => (
            <div
              key={e.title + e.at}
              className={`ss-event ss-${e.kind}`}
              style={{ top: e.at * PHONE_HOUR + 2, height: e.hours * PHONE_HOUR - 4, left: 40, right: 4 }}
            >
              <strong>{e.title}</strong>
              <span>{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What's on the laptop's screen: the planner beside a week. */
function Still() {
  return (
    <div className="ss-home-preview">
      <div className="ss-home-planner">
        <span className="ss-eyebrow">
          <SsIcon name="spark" size={12} /> PERSONAL PLANNER
        </span>
        <strong>Plan your open time</strong>
        <div className="ss-home-cards">
          {PLANNER.map((t) => (
            <div key={t.title} className="ss-mini-task" style={taskColor(t.color)}>
              <div className="min-w-0">
                <h3>{t.title}</h3>
                <p>
                  <b>{t.code}</b> · {t.when}
                </p>
              </div>
              <span className="ss-minutes">
                <SsIcon name="clock" size={13} /> {t.minutes}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="ss-home-week">
        <div className="ss-home-week-head">
          <span />
          {DAYS.map((d, i) => (
            <span key={d} data-today={i === 2 || undefined}>
              {d} <b>{12 + i}</b>
            </span>
          ))}
        </div>
        <div className="ss-home-week-body" style={{ height: HOUR * HOURS.length }}>
          <div className="ss-home-hours">
            {HOURS.map((h, i) => (
              <span key={h} style={{ top: i * HOUR }}>
                {h}
              </span>
            ))}
          </div>
          {DAYS.map((d, day) => (
            <div key={d} className="ss-home-day">
              {EVENTS.filter((e) => e.day === day).map((e) => (
                <div
                  key={e.title + e.at}
                  className={`ss-event ss-${e.kind === "planned" ? "planned" : e.kind}`}
                  style={{ top: e.at * HOUR + 2, height: e.hours * HOUR - 4, left: 4, right: 4 }}
                >
                  <strong>{e.title}</strong>
                  <span>{e.time}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
