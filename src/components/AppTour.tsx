"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Check, CircleAlert, LayoutGrid, ListChecks, Plus, Settings, Target } from "lucide-react";
import { useApp } from "./context";
import { KEYS, writeStored } from "./store";
import { DaySketch, Sketch } from "./LandingSketches";
import { ClassChip, SectionLabel, Tour, type TourStep } from "./ui";

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

/** Step 3: what's due, with one task that won't fit. */
function DuePicture() {
  const row = (title: string, code: string, color: string, note: React.ReactNode) => (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
      <span className="w-4 h-4 rounded border border-line-strong shrink-0" aria-hidden />
      <span className="font-semibold truncate">{title}</span>
      <ClassChip code={code} color={color} />
      <span className="ml-auto text-xs shrink-0">{note}</span>
    </div>
  );
  return (
    <Sketch label="The Due this week list: each task says when it's planned, and one says it won't fit in time." className="h-full p-4">
      <div className="font-bold">Due this week</div>
      <SectionLabel className="mt-2 mb-1">Tomorrow</SectionLabel>
      <div className="space-y-1.5">
        {row("Lab 6", "CS 142", "#d97706", "Planned today 2:30")}
        {row("Case Write-Up 4", "BUS 301", "#2563eb", "Planned today 4 PM")}
        {row(
          "Project 2",
          "CS 142",
          "#d97706",
          <span className="inline-flex items-center gap-1 font-bold">
            <CircleAlert size={12} aria-hidden />
            Won&apos;t fit in time
          </span>,
        )}
      </div>
    </Sketch>
  );
}

/** Step 4: where the other screens are. */
function NavPicture() {
  const tab = (Icon: typeof Target, label: string, on = false) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm ${on ? "rounded-md bg-surface text-accent font-semibold shadow-[var(--shadow-sm)]" : "text-muted"}`}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
  return (
    <Sketch
      label="The bar at the top of the app: Plan, Calendar, Upcoming and Classes, with Add task and Settings on the right."
      className="h-full p-4 flex flex-col justify-center gap-4"
    >
      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1 flex-wrap">
        {tab(Target, "Plan", true)}
        {tab(CalendarRange, "Calendar")}
        {tab(ListChecks, "Upcoming")}
        {tab(LayoutGrid, "Classes")}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm">
          <Plus size={14} aria-hidden />
          Add task
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm">
          <Settings size={14} aria-hidden />
          Settings
        </span>
      </div>
    </Sketch>
  );
}

/**
 * Four steps, in the order the Plan screen answers its questions: what to do now,
 * the rest of today, what's due, and where everything else lives.
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
    title: "See what's due, and what won't fit",
    body: "Due this week lists everything coming up and when it's planned. If something can't fit before it's due, it tells you early.",
    picture: <DuePicture />,
  },
  {
    title: "Everything else is one click away",
    body: "Calendar shows your week, Upcoming lists everything due, and Classes shows each class. You can replay this walkthrough in Settings.",
    picture: <NavPicture />,
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
