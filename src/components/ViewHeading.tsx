"use client";

import { CalendarRange, ChevronLeft, CircleHelp, ListChecks, Settings } from "lucide-react";
import { useApp } from "./context";
import { SETTINGS_SECTIONS } from "./SettingsView";
import { PageHeader } from "./ui";

/**
 * The title block at the top of every main screen except Plan (which opens with
 * the capability sentence instead). Same icon as the screen's tab, so the menu and
 * the page confirm each other.
 */
export function ViewHeading() {
  const { view, settingsPanel, setSettingsPanel } = useApp();

  if (view === "calendar") {
    return <PageHeader icon={CalendarRange} title="Calendar" description="Your classes, events and planned work, by month, week or day. Click any free time to see what fits in it." />;
  }
  if (view === "upcoming") {
    return <PageHeader icon={ListChecks} title="Upcoming" description="Everything that's due, for all your classes or one at a time, and when SmartScheduler has planned it." />;
  }
  if (view === "help") {
    return <PageHeader icon={CircleHelp} title="Help" description="Your goal in this prototype, and the different ways to reach it." />;
  }
  if (view === "settings") {
    const section = SETTINGS_SECTIONS.find((s) => s.id === settingsPanel);
    const main = <PageHeader icon={Settings} title="Settings" description="Your calendars, your schedule and how SmartScheduler plans around them." />;
    if (!section) return main;
    // Computer: the sections stay in a sidebar, so the page keeps its "Settings" title.
    // Phone: each section is its own page, with a link back to the list.
    return (
      <>
        <div className="hidden md:block">{main}</div>
        <PageHeader
          className="md:hidden"
          icon={section.icon}
          title={section.label}
          description={section.hint}
          eyebrow={
            <button type="button" className="inline-flex items-center gap-0.5 hover:text-fg" onClick={() => setSettingsPanel("main")}>
              <ChevronLeft size={15} aria-hidden />
              Settings
            </button>
          }
        />
      </>
    );
  }
  return null;
}
