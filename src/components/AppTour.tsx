"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "./context";
import { KEYS, writeStored } from "./store";
import { DaySketch, Sketch } from "./LandingSketches";
import { ClassChip, DueBadge, PlannedBadge, SectionLabel, Tour, type TourStep } from "./ui";

const START_EVENT = "prio:start-tour";

/** Shows the walkthrough again, from Settings or the development shortcuts. */
export function startTour() {
  pending = true;
  window.dispatchEvent(new Event(START_EVENT));
}

/** Asked for before the app was on screen (from the welcome pop-up during setup); runs once it is. */
let pending = false;

/** Step 1: the "work on now" card, drawn the way the Plan screen draws it. */
function NowPicture() {
  return (
    <Sketch label="The card at the top of the Plan screen: the task to work on now, and its Done button." className="h-full p-4 flex items-center">
      <div className="w-full rounded-xl border-2 border-accent/50 bg-surface p-4 shadow-[var(--shadow-md)]">
        <div className="text-sm">Free until 3:15 PM · 45m</div>
        <SectionLabel className="mt-2">Work on</SectionLabel>
        <div className="mt-1 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold leading-snug">Lab 6</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <ClassChip variant="tag" code="CS 142" color="#d97706" />
              45m · due tomorrow
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-4 py-2 font-semibold">
            <Check size={16} strokeWidth={3} aria-hidden />
            Done
          </span>
        </div>
      </div>
    </Sketch>
  );
}

/** Step 3: today's goal, a ring that fills as tasks are ticked off. */
function GoalPicture() {
  const size = 96;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Sketch label="Today's goal: a ring showing 2 of 4 planned tasks done, with 1 hour 30 minutes of work left." className="h-full p-4 flex items-center justify-center">
      <div className="flex items-center gap-4">
        <div className="relative grid place-items-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface)" strokeWidth={10} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ok)" strokeWidth={10} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c / 2} />
          </svg>
          <span className="absolute text-xl font-bold tabular-nums">
            2<span className="text-muted">/4</span>
          </span>
        </div>
        <div>
          <SectionLabel>Today&apos;s goal</SectionLabel>
          <div className="font-semibold">Finish today&apos;s plan</div>
          <div className="text-sm text-muted">2 of 4 done · 1h 30m left</div>
        </div>
      </div>
    </Sketch>
  );
}

/** Step 4: Upcoming, filtered to one class, with planned (green) and due (amber) side by side. */
function UpcomingPicture() {
  const row = (title: string, code: string, color: string, planned: string, due: string) => (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
      <span className="w-4 h-4 rounded border border-line-strong shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block font-semibold truncate">{title}</span>
        <span className="flex items-center gap-1.5 mt-0.5">
          <ClassChip code={code} color={color} />
          <PlannedBadge>{planned}</PlannedBadge>
        </span>
      </span>
      <span className="ml-auto shrink-0">
        <DueBadge>{due}</DueBadge>
      </span>
    </div>
  );
  return (
    <Sketch label="Upcoming with class tabs at the top. Each task shows when it's planned in green and when it's due in amber." className="h-full p-4 space-y-2.5">
      <div className="flex gap-1.5 text-xs">
        <span className="rounded-full border border-line bg-surface px-2 py-1 text-muted">All classes</span>
        <span className="rounded-full border-2 border-[#2563eb] bg-surface px-2 py-1 font-bold">BUS 301</span>
        <span className="rounded-full border border-line bg-surface px-2 py-1 text-muted">CS 142</span>
      </div>
      {row("Case Write-Up 4", "BUS 301", "#2563eb", "Planned today 4 PM", "Due Tue")}
      {row("Reading: Ch. 6", "BUS 301", "#2563eb", "Planned Mon 6 PM", "Due Wed")}
    </Sketch>
  );
}

/**
 * Four steps: what to do now, the rest of today, today's goal, and everything
 * that's due (by class) on Upcoming.
 */
const STEPS: TourStep[] = [
  {
    title: "Start with the task in front of you",
    body: "The top of the Plan screen shows the one task to work on in your free time right now. Press Done when you finish, and the next one moves up.",
    picture: <NowPicture />,
  },
  {
    title: "Your free time, already filled",
    body: "Every gap between your classes and work is filled with what's due soonest, so you never have to decide what to do next.",
    picture: <DaySketch filled className="h-full" />,
  },
  {
    title: "Watch today's goal fill up",
    body: "The ring shows how much of today's plan is done. If something can't fit before it's due, it warns you early.",
    picture: <GoalPicture />,
  },
  {
    title: "Everything that's due, by class",
    body: "Upcoming lists all your work. Pick a class at the top to see just that class. Green says when it's planned; amber says when it's due.",
    picture: <UpcomingPicture />,
  },
];

/**
 * The walkthrough runs only when asked for: "Show me around" in the welcome pop-up,
 * Settings, or /app#tour. Nobody gets it on top of the welcome pop-up uninvited.
 */
export function AppTour({ blocked }: { blocked: boolean }) {
  const { setView } = useApp();
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    const onStart = () => {
      pending = false;
      setAsked(true);
    };
    if (window.location.hash === "#tour") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      pending = true;
    }
    if (pending) onStart();
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  if (blocked || !asked) return null;

  return (
    <Tour
      steps={STEPS}
      finishLabel="Show my plan"
      onClose={() => {
        writeStored(KEYS.tour, new Date().toISOString());
        setAsked(false);
        setView("plan");
      }}
    />
  );
}
