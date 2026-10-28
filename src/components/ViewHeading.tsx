"use client";

import { ChevronLeft } from "lucide-react";
import { useApp } from "./context";
import { SETTINGS_SECTIONS } from "./SettingsView";

/**
 * The title at the top of Settings and Help, laid out like the prototype's Tasks
 * page: a small coloured eyebrow, a big title, and one line saying what is here.
 */
export function ViewHeading() {
  const { view, settingsPanel, setSettingsPanel } = useApp();

  if (view === "help") {
    return <Heading eyebrow="HELP" title="How Schedule Smart works." description="Your goal in this prototype, and the different ways to reach it." />;
  }
  if (view !== "settings") return null;
  const section = SETTINGS_SECTIONS.find((s) => s.id === settingsPanel);
  const main = <Heading eyebrow="SETTINGS" title="Your calendars and choices." description="The calendar links Schedule Smart reads, your hours, and how it orders your work." />;
  if (!section) return main;
  // Computer: the sections stay in a sidebar, so the page keeps its "Settings" title.
  // Phone: each section is its own page, with a link back to the list.
  return (
    <>
      <div className="hidden md:block">{main}</div>
      <div className="md:hidden">
        <button type="button" className="ss-eyebrow !text-[11px] mb-1" onClick={() => setSettingsPanel("main")}>
          <ChevronLeft size={14} aria-hidden />
          SETTINGS
        </button>
        <Heading title={section.label} description={section.hint} />
      </div>
    </>
  );
}

function Heading({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="ss-tasks-header">
      <div>
        {eyebrow ? <span className="ss-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
