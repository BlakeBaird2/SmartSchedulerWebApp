"use client";

import { CalendarRange, CircleHelp, LayoutGrid, ListChecks, Plus, RefreshCw, Settings, Target } from "lucide-react";
import { timeAgo } from "@/lib/ui";
import { pageWidth, useApp, type View } from "./context";
import { ChangesPopover } from "./ChangesPopover";
import { PrototypeBadge } from "./Prototype";
import { Button, SegmentedControl, Wordmark } from "./ui";

const TABS: { id: View; label: string; icon: typeof ListChecks }[] = [
  { id: "plan", label: "Plan", icon: Target },
  { id: "calendar", label: "Calendar", icon: CalendarRange },
  { id: "upcoming", label: "Upcoming", icon: ListChecks },
  { id: "classes", label: "Classes", icon: LayoutGrid },
];

/**
 * Laid out the way most web apps are, so nothing has to be learned: name on the
 * left (goes to your plan), the main views next to it, tools on the right.
 *
 * It has to fit every width without anything falling off the edge:
 * - wide screens (lg+): one row; the views sit beside the name
 * - tablets and phones: the views move to a second, full-width row
 * - tool labels show only where there is room (xl+); below that each tool is an
 *   icon with its name on hover and for screen readers
 * - phones: Help moves into Settings, so the first row is just the name, the
 *   Prototype tag and three tools
 * - the goal lives in the Prototype tag's pop-up, not a tag of its own
 */
export function Header() {
  const { view, setView, snapshot, now, syncing, sync, openAddTask } = useApp();
  const status = syncing ? "Syncing…" : snapshot.at ? `Synced ${timeAgo(snapshot.at, now)}` : "Not synced yet";
  const current = TABS.some((t) => t.id === view) ? view : "plan";

  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-line">
      <div className={`${pageWidth(view)} mx-auto px-4 sm:px-6 h-14 flex items-center gap-2`}>
        <button type="button" onClick={() => setView("plan")} className="shrink-0" aria-label="SmartScheduler, go to your plan" title="Go to your plan">
          <Wordmark collapse />
        </button>
        <PrototypeBadge />

        <nav className="ml-3 hidden lg:block" aria-label="Main">
          <SegmentedControl label="Main views" options={TABS} value={current} onChange={setView} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5" role="group" aria-label="Calendar updates">
            <Button
              iconOnly
              icon={RefreshCw}
              label={`Refresh calendars now (${status.toLowerCase()})`}
              onClick={() => void sync()}
              disabled={syncing}
              className={syncing ? "is-syncing" : ""}
            />
            <span className="sr-only" aria-live="polite">
              {status}
            </span>
            <span className="mx-1 h-6 w-px bg-line-strong" aria-hidden />
          </div>
          <Button icon={Plus} onClick={openAddTask} className="min-w-9 px-2 xl:px-3" title="Add a task that isn't on any calendar" aria-label="Add task">
            <span className="hidden xl:inline">Add task</span>
          </Button>
          <ChangesPopover />
          <Button
            icon={CircleHelp}
            onClick={() => setView("help")}
            aria-label="Help and goal"
            title="Help and goal"
            aria-pressed={view === "help"}
            className={`min-w-9 px-2 2xl:px-3 !hidden sm:!inline-flex ${view === "help" ? "!bg-surface-2 underline underline-offset-4" : ""}`}
          >
            <span className="hidden 2xl:inline">Help</span>
          </Button>
          <Button
            icon={Settings}
            onClick={() => setView("settings")}
            aria-label="Settings"
            title="Settings"
            aria-pressed={view === "settings"}
            className={`min-w-9 px-2 2xl:px-3 ${view === "settings" ? "!bg-surface-2 underline underline-offset-4" : ""}`}
          >
            <span className="hidden 2xl:inline">Settings</span>
          </Button>
        </div>
      </div>
      <nav className={`lg:hidden px-4 sm:px-6 pb-2 ${pageWidth(view)} mx-auto`} aria-label="Main">
        <SegmentedControl label="Main views" options={TABS} value={current} onChange={setView} stretch />
      </nav>
    </header>
  );
}
