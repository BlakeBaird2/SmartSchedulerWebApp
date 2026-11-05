"use client";

/**
 * Pieces shared by every entry screen:
 *
 * - PrototypeBadge: the "Prototype" tag in each header, saying this is an early version.
 * - CapabilityHero / WirePlaceholder: shared entry-screen pieces.
 * - DevStateSwitcher: development-only shortcuts to each entry state.
 *
 * (There is no longer a welcome pop-up with a goal to try; the tag says it's a prototype.)
 */
import { FlaskConical } from "lucide-react";
import { KEYS, readStored, useHydrated, writeStored } from "./store";

export const CAPABILITY = "See exactly what to work on in every free gap of your day.";

export function PrototypeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`proto-badge pointer-events-none ${className}`} title="An early prototype">
      <FlaskConical size={14} className="hidden sm:block" aria-hidden />
      Prototype
    </span>
  );
}

const HERO_SIZE = {
  page: "text-[2.5rem] sm:text-6xl lg:text-7xl",
  app: "text-[1.75rem] leading-[1.1] sm:text-[2.6rem]",
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

function clearPrioStorage({ keepTour }: { keepTour: boolean }) {
  const theme = readStored(KEYS.theme);
  for (const key of Object.values(KEYS)) {
    if (key === KEYS.theme) continue;
    if (keepTour && key === KEYS.tour) continue;
    writeStored(key, null);
  }
  if (theme) writeStored(KEYS.theme, theme);
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
      label: "First visit (blank)",
      run: () => {
        clearPrioStorage({ keepTour: false });
        go("/");
      },
    },
    {
      label: "New user at /app",
      run: () => {
        clearPrioStorage({ keepTour: true });
        go("/app");
      },
    },
    {
      label: "Sample data at /app#demo",
      run: () => {
        clearPrioStorage({ keepTour: true });
        go("/app#demo");
      },
    },
    {
      label: "Returning user at /app (keeps current data)",
      run: () => go("/app"),
    },
    {
      label: "Show the walkthrough",
      run: () => go("/app#tour"),
    },
  ];

  return (
    <details className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-3 left-3 z-[70] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface shadow-[var(--shadow-md)] text-sm">
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
