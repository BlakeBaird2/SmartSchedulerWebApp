"use client";

import { ArrowLeft, ArrowRight, CalendarRange, LayoutGrid, ListChecks, Target } from "lucide-react";
import { GOAL_BODY, GOAL_EXAMPLE, GOAL_TITLE, openGoalNotice, openPrototypeNotice } from "./Prototype";
import { useApp } from "./context";
import { Button, Card, CardHeader } from "./ui";

/**
 * Help for the prototype goal: what to do, three routes that get there, and how
 * to reopen notices. Reachable from the header Help control and from Settings.
 */
export function HelpView() {
  const { setView, setSettingsPanel, setCalMode } = useApp();

  const go = (view: "plan" | "calendar" | "upcoming" | "classes") => {
    if (view === "calendar") setCalMode("week");
    setView(view);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button icon={ArrowLeft} onClick={() => setView("plan")}>
          Back to Plan
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
        <CardHeader level={2} title="Three ways to finish the goal" hint="Each path ends the same way: open a task, review it, mark it Done. Shared task state stays in sync everywhere." />
        <ol className="mt-4 space-y-3">
          <RouteRow icon={Target} title="Plan" steps="Find a free gap → open a planned task → review details → Done" onOpen={() => go("plan")} />
          <RouteRow
            icon={CalendarRange}
            title="Calendar"
            steps="Open week or day → pick a free gap or planned work → review → Done"
            onOpen={() => go("calendar")}
          />
          <RouteRow icon={ListChecks} title="Upcoming" steps="Open due work → review the task → Done" onOpen={() => go("upcoming")} />
          <RouteRow icon={LayoutGrid} title="Classes" steps="Open a class column → pick its work → review → Done" onOpen={() => go("classes")} />
        </ol>
      </Card>

      <Card>
        <CardHeader level={2} title="If something looks empty" hint="Sample data and real calendars both work. If a day has no free gaps, try tomorrow on Plan, or open Upcoming / Classes for work that is still due." />
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
    <li className="border border-line-strong p-3 flex items-start gap-3">
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden />
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
