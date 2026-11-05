/**
 * The home page, in the app's own design: a tagline, then the picture (the
 * calendars a student juggles, arrows into Schedule Smart on a laptop), then
 * what it does and a way in. It renders on the server
 * so it shows up at once. Anyone who already has calendars set up skips it (see
 * the root layout) and goes straight to the app at /app.
 *
 * The same page is served at /about (`variant="about"`) for people who already use
 * Schedule Smart, where the main button opens the app instead of starting setup.
 */
import "@fontsource-variable/nunito";
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

        <section className="ss-home-hero" aria-labelledby="home-title">
          <span className="ss-eyebrow">
            <SsIcon name="spark" size={14} /> YOUR PERSONAL PLANNER
          </span>
          <h2 id="home-title">
            Plan your{" "}
            <span className="ss-home-scribble">
              open time
              <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
                <path d="M4 15 C 60 6, 120 20, 180 11 S 270 8, 296 13" />
              </svg>
            </span>{" "}
            with confidence.
          </h2>
          <p>Your classes, assignments, work and plans on one calendar. Drag what&apos;s due into the free time you have.</p>
          {/* How it works, in one picture: drag a task from the planner into a free gap. Then the way in, under it. */}
          <figure className="ss-home-how">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/drag-to-plan.webp"
              alt="Dragging a task, Study for exam (1 hour), from the planner into a free hour on the calendar, where it becomes a 10:00 to 11:00 AM block."
              width={1429}
              height={923}
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="ss-home-actions">
            {/* One more hand-drawn arrow, like the ones above, pointing to where to start. */}
            <svg className="ss-home-pointer" viewBox="0 0 120 70" aria-hidden>
              <path d="M6 8 C 20 50, 60 60, 104 46" />
              <path d="M90 34 L 105 46 L 88 56" />
            </svg>
            <Link href="/app" className="ss-primary">
              {variant === "about" ? "Open Schedule Smart" : "Get started"} <SsIcon name="chevronRight" size={17} />
            </Link>
            {/* A full page load rather than next/link, so the app sees #demo as it starts. */}
            <a href="/app#demo" className="ss-home-quiet" data-smart-event="sample_data_started">
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

/** The calendar page on a laptop, hand-drawn like the icons above it, so it's plainly a picture rather than something to click. */
function Preview() {
  return (
    <figure className="ss-devices">
      {/* Plain <img>: one fixed drawing; nothing for the image optimiser to do. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ss-devices-art"
        src="/landing/laptop.webp"
        alt="Schedule Smart on a laptop: a week of classes, work and the gym, with tasks from the planner dragged into the free time between them."
        width={1864}
        height={1196}
        decoding="async"
      />
    </figure>
  );
}
