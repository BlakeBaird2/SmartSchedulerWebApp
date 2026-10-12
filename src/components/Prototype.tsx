"use client";

/**
 * First-visit notices shared by every entry screen:
 *
 * - EntryNotices: prototype notice first, then the goal-setting pop-up. Each dismissal
 *   is remembered in this browser (localStorage) so returning users are not interrupted.
 * - PrototypeBadge / GoalBadge: reopen each notice from headers and Help/Settings.
 * - CapabilityHero / WirePlaceholder: shared entry-screen pieces.
 * - DevStateSwitcher: development-only shortcuts to each entry state.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Compass, FlaskConical, Target } from "lucide-react";
import { usePathname } from "next/navigation";
import { startTour } from "./AppTour";
import { KEYS, readStored, useHydrated, useStored, writeStored } from "./store";
import { Button, Dialog } from "./ui";

export const CAPABILITY = "See exactly what to work on in every free gap of your day.";
export const PROTOTYPE_MESSAGE = "This is an early prototype. Some things are placeholders, and nothing is saved to an account.";
export const GOAL_TITLE = "Your goal in this prototype";
export const GOAL_EXAMPLE = "You have 45 minutes between class and work. Find something productive to work on and mark it done.";
export const GOAL_BODY =
  "SmartScheduler finds free gaps on your day and fills them with the work that is due soonest. Use Plan, Calendar, Upcoming, or Classes — any path that gets you to a task and a Done mark counts.";

const OPEN_PROTO = "prio:open-prototype-notice";
const OPEN_GOAL = "prio:open-goal-notice";

/** Shows the prototype notice again, from anywhere. */
export function openPrototypeNotice() {
  window.dispatchEvent(new Event(OPEN_PROTO));
}

/** Shows the goal instructions again, from anywhere. */
export function openGoalNotice() {
  window.dispatchEvent(new Event(OPEN_GOAL));
}

/**
 * One welcome pop-up on the first visit, whichever page someone lands on. It does
 * the two jobs the prototype has to do up front, in one place rather than a chain
 * of pop-ups: say plainly that this is an early prototype, and give the goal to try.
 *
 * Inside the app it also offers an optional walkthrough ("Show me around"); the
 * main button just starts. The Prototype and Goal tags, Help and Settings all
 * reopen it. Returning visitors see nothing.
 */
export function EntryNotices() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const protoDismissed = useStored(KEYS.prototypeNotice);
  const goalDismissed = useStored(KEYS.goalNotice);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(OPEN_PROTO, onOpen);
    window.addEventListener(OPEN_GOAL, onOpen);
    return () => {
      window.removeEventListener(OPEN_PROTO, onOpen);
      window.removeEventListener(OPEN_GOAL, onOpen);
    };
  }, []);

  if (!hydrated) return null;
  if (!reopened && protoDismissed !== null && goalDismissed !== null) return null;

  const inApp = pathname?.startsWith("/app") ?? false;
  const close = () => {
    const at = new Date().toISOString();
    writeStored(KEYS.prototypeNotice, at);
    writeStored(KEYS.goalNotice, at);
    setReopened(false);
  };

  return (
    <Dialog elevated label="Welcome to SmartScheduler" onClose={close} size="md" className="!p-6">
      <span className="proto-badge pointer-events-none" aria-hidden>
        <FlaskConical size={14} />
        Prototype
      </span>
      <h2 className="mt-3 text-2xl font-bold leading-snug">This is an early prototype.</h2>
      <p className="mt-1 text-base text-muted leading-relaxed">
        Some things are placeholders and nothing is saved to an account, but it really works: it plans your free time from your calendars or from sample data.
      </p>

      <div className="mt-5 rounded-xl border border-accent/30 bg-accent-soft p-4">
        <span className="section-title inline-flex items-center gap-1.5">
          <Target size={14} aria-hidden />
          Your goal
        </span>
        <p className="mt-1.5 text-lg font-semibold leading-snug">{GOAL_EXAMPLE}</p>
        <p className="mt-1.5 text-sm text-muted leading-relaxed">Any route works: Plan, Calendar, Upcoming or Classes.</p>
      </div>

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        {inApp ? (
          <Button
            icon={Compass}
            onClick={() => {
              close();
              startTour();
            }}
          >
            Show me around
          </Button>
        ) : null}
        <Button variant="primary" className="ml-auto" trailingIcon={ArrowRight} onClick={close} data-autofocus>
          {inApp ? "Start" : "Got it"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">Reopen this any time from the Prototype tag or Help.</p>
    </Dialog>
  );
}

/** @deprecated Prefer EntryNotices — kept for older imports. */
export function PrototypeNotice() {
  return <EntryNotices />;
}

export function PrototypeBadge({ className = "" }: { className?: string }) {
  return (
    <button type="button" className={`proto-badge ${className}`} onClick={openPrototypeNotice} title="About this prototype" aria-haspopup="dialog">
      <FlaskConical size={14} className="hidden sm:block" aria-hidden />
      Prototype
    </button>
  );
}

export function GoalBadge({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`proto-badge hidden sm:inline-flex ${className}`}
      onClick={openGoalNotice}
      title="Your goal in this prototype"
      aria-haspopup="dialog"
    >
      <Target size={14} className="hidden sm:block" aria-hidden />
      Goal
    </button>
  );
}

const HERO_SIZE = {
  page: "text-[2.5rem] sm:text-6xl lg:text-7xl",
  app: "text-3xl sm:text-[2.6rem]",
} as const;

export function CapabilityHero({
  size = "app",
  id,
  className = "",
  children,
}: {
  size?: keyof typeof HERO_SIZE;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <h1 id={id} className={`capability ${HERO_SIZE[size]}`}>
        {CAPABILITY}
      </h1>
      {children}
    </div>
  );
}

export function WirePlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`wire-placeholder ${className}`} role="img" aria-label={`Placeholder: ${label}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </svg>
      <span>[image: {label}]</span>
    </div>
  );
}

function clearPrioStorage({ keepNotices }: { keepNotices: boolean }) {
  const theme = readStored(KEYS.theme);
  for (const key of Object.values(KEYS)) {
    if (key === KEYS.theme) continue;
    if (keepNotices && (key === KEYS.prototypeNotice || key === KEYS.goalNotice || key === KEYS.tour)) continue;
    writeStored(key, null);
  }
  if (theme) writeStored(KEYS.theme, theme);
}

function markNoticesRead() {
  const now = new Date().toISOString();
  writeStored(KEYS.prototypeNotice, now);
  writeStored(KEYS.goalNotice, now);
}

export function DevStateSwitcher() {
  const hydrated = useHydrated();
  if (process.env.NODE_ENV !== "development" || !hydrated) return null;

  const go = (url: string) => {
    window.location.assign(url);
    if (new URL(url, window.location.href).pathname === window.location.pathname) window.location.reload();
  };

  const states: { label: string; run: () => void }[] = [
    {
      label: "First visit (blank, notices show)",
      run: () => {
        clearPrioStorage({ keepNotices: false });
        go("/");
      },
    },
    {
      label: "New user at /app (notices already read)",
      run: () => {
        clearPrioStorage({ keepNotices: true });
        markNoticesRead();
        go("/app");
      },
    },
    {
      label: "Sample data at /app#demo",
      run: () => {
        clearPrioStorage({ keepNotices: true });
        markNoticesRead();
        go("/app#demo");
      },
    },
    {
      label: "Returning user at /app (keeps current data)",
      run: () => {
        markNoticesRead();
        go("/app");
      },
    },
    {
      label: "Show the walkthrough",
      run: () => {
        markNoticesRead();
        go("/app#tour");
      },
    },
    {
      label: "Show the welcome pop-up on next load",
      run: () => {
        writeStored(KEYS.prototypeNotice, null);
        writeStored(KEYS.goalNotice, null);
        window.location.reload();
      },
    },
  ];

  return (
    <details className="fixed bottom-3 left-3 z-[70] max-w-[calc(100vw-1.5rem)] border border-dashed border-fg bg-surface text-sm">
      <summary className="cursor-pointer select-none px-2 py-1">Dev: entry states</summary>
      <div className="flex flex-col gap-1 p-2 pt-0">
        <p className="text-xs text-muted">Development only. Not shown in production.</p>
        {states.map((s) => (
          <button key={s.label} type="button" className="btn justify-start" onClick={s.run}>
            {s.label}
          </button>
        ))}
      </div>
    </details>
  );
}
