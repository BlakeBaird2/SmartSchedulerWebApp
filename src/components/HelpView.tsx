"use client";

import { ArrowLeft, ArrowRight, CalendarRange, ListChecks, Target } from "lucide-react";
import { GOAL_BODY, GOAL_EXAMPLE, GOAL_TITLE, openGoalNotice, openPrototypeNotice } from "./Prototype";
import { useApp } from "./context";
import { Button, Card, CardHeader } from "./ui";

/**
 * Help for the prototype goal: what to do, three routes that get there, and how
 * to reopen notices. Reachable from the header Help control and from Settings.
 */
export function HelpView() {
  const { setView, setSettingsPanel, setCalMode } = useApp();

  const go = (view: "calendar" | "tasks") => {
    if (view === "calendar") setCalMode("week");
    setView(view);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button icon={ArrowLeft} onClick={() => setView("calendar")}>
          Back to the calendar
        </Button>
        <Button
          onClick={() => {
            setSettingsPanel("about");
          }}
        >
          Settings
        </Button>
      </div>

      <Card>
        <CardHeader level={2} title={GOAL_TITLE} />
        <p className="mt-3 text-[0.9375rem] leading-relaxed">{GOAL_EXAMPLE}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{GOAL_BODY}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={Target} onClick={openGoalNotice}>
            Reopen goal instructions
          </Button>
          <Button onClick={openPrototypeNotice}>Prototype notice</Button>
        </div>
      </Card>

      <Card>
        <CardHeader level={2} title="Two ways to finish the goal" hint="Each path ends the same way: find the work, then tick it off. The planner, the calendar and Tasks always agree." />
        <ol className="mt-4 space-y-3">
          <RouteRow
            icon={CalendarRange}
            title="Calendar"
            steps="Drag the top item in “Plan your open time” onto a free time (or tap a free time → Put it here) → tick it off when it's done"
            onOpen={() => go("calendar")}
          />
          <RouteRow icon={ListChecks} title="Tasks" steps="Find the work (search, or pick Today or a class) → open it → Mark as done" onOpen={() => go("tasks")} />
        </ol>
      </Card>

      <Card>
        <CardHeader level={2} title="If something looks empty" hint="Sample data and real calendars both work. If a day has no free time, try the next day, or open Tasks for everything that is still due." />
        <Button
          className="mt-3"
          trailingIcon={ArrowRight}
          onClick={() => {
            setSettingsPanel("calendars");
          }}
        >
          Open calendar settings
        </Button>
      </Card>
    </div>
  );
}

function RouteRow({
  icon: Icon,
  title,
  steps,
  onOpen,
}: {
  icon: typeof Target;
  title: string;
  steps: string;
  onOpen: () => void;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface p-3 flex items-start gap-3 hover:border-line-strong transition">
      <span className="grid place-items-center h-9 w-9 shrink-0 rounded-lg bg-accent-soft text-accent" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-muted mt-0.5">{steps}</p>
      </div>
      <Button size="sm" onClick={onOpen}>
        Open
      </Button>
    </li>
  );
}
