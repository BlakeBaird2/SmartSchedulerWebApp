/**
 * The home page, in the app's own design: one line on what Schedule Smart does,
 * a way in, a picture of the calendar, and three steps. It renders on the server
 * so it shows up at once. Anyone who already has calendars set up skips it (see
 * the root layout) and goes straight to the app at /app.
 *
 * The same page is served at /about (`variant="about"`) for people who already use
 * Schedule Smart, where the main button opens the app instead of starting setup.
 */
import Link from "next/link";
import { PrototypeBadge } from "./Prototype";
import { SsIcon, type SsIconName } from "./SsIcon";

export type LandingVariant = "home" | "about";

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
        <section className="ss-home-hero" aria-labelledby="home-title">
          <span className="ss-eyebrow">
            <SsIcon name="spark" size={14} /> YOUR PERSONAL PLANNER
          </span>
          <h1 id="home-title">Plan your open time.</h1>
          <p>Your classes, assignments, work and plans on one calendar. Drag what&apos;s due into the free time you have.</p>
          <div className="ss-home-actions">
            <Link href="/app" className="ss-primary">
              {variant === "about" ? "Open Schedule Smart" : "Get started"} <SsIcon name="chevronRight" size={17} />
            </Link>
            {/* A full page load rather than next/link, so the app sees #demo as it starts. */}
            <a href="/app#demo" className="ss-home-quiet" data-smart-event="sample_data_started">
              Try it with sample data
            </a>
          </div>
          <p className="ss-home-note">Free · No account · Saved only in your browser</p>
        </section>

        <Preview />

        <ol className="ss-home-steps">
          <Step icon="calendar" title="Paste your calendar links">
            From Canvas, Learning Suite, Google, Outlook or Apple.
          </Step>
          <Step icon="list" title="See everything in one place">
            Classes, work and plans on one calendar, with what&apos;s due listed beside it.
          </Step>
          <Step icon="clock" title="Drag tasks into open time">
            Drop a task on the calendar and it takes as long as it needs.
          </Step>
        </ol>
      </main>

      <footer className="ss-home-foot">
        <span>Schedule Smart · an early prototype</span>
        <Link href="/app">Open Schedule Smart</Link>
      </footer>
    </div>
  );
}

function Step({ icon, title, children }: { icon: SsIconName; title: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="ss-home-step-icon">
        <SsIcon name={icon} size={19} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// A still of the calendar page, drawn with the app's own pieces.
// ---------------------------------------------------------------------------

const PLANNER = [
  { title: "Read Chapter 5", meta: "ACC 200 · Today", minutes: "30 min" },
  { title: "Problem Set 4", meta: "MATH 112 · Tomorrow", minutes: "1 hr" },
  { title: "Essay outline", meta: "WRTG 150 · Fri", minutes: "45 min" },
];

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
];

const HOUR = 46;

function Preview() {
  return (
    <div className="ss-home-preview" aria-hidden>
      <div className="ss-home-planner">
        <span className="ss-eyebrow">
          <SsIcon name="spark" size={12} /> PERSONAL PLANNER
        </span>
        <strong>Plan your open time</strong>
        <div className="ss-home-cards">
          {PLANNER.map((t) => (
            <div key={t.title} className="ss-mini-task">
              <span className="ss-grip">
                <SsIcon name="grip" size={16} />
              </span>
              <div className="min-w-0">
                <h3>{t.title}</h3>
                <p>{t.meta}</p>
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
        <div className="ss-home-week-body" style={{ height: HOUR * 5 }}>
          <div className="ss-home-hours">
            {["8 AM", "9 AM", "10 AM", "11 AM", "12 PM"].map((h, i) => (
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
