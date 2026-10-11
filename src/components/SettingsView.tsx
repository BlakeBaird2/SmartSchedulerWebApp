"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, Copy, Info, LayoutTemplate, Moon, RefreshCw, RotateCcw, Sparkles, Sun, Target } from "lucide-react";
import { encodeSetup } from "@/lib/workspace";
import { ASSIGNMENT_TYPES, type AssignmentType } from "@/lib/types";
import { duration, typeIconClass, typeMeta } from "@/lib/ui";
import { useApp, type SettingsPanel } from "./context";
import { FeedAdder, FeedList, ProviderHelp } from "./Feeds";
import { HoursForm, WeeklyEditor } from "./ScheduleSettings";
import { ClassTimesEditor } from "./ClassTimes";
import { openGoalNotice } from "./Prototype";
import { resetEverything, useTheme } from "./store";
import { startTour } from "./AppTour";
import { Button, ButtonLink, Card, CardHeader, SegmentedControl, TextButton } from "./ui";

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader level={3} title={title} hint={hint} />
      <div className="mt-4">{children}</div>
    </Card>
  );
}

const ESTIMATE_OPTIONS = [15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];

const NAV: { id: SettingsPanel; label: string; hint: string }[] = [
  { id: "calendars", label: "Calendars & class times", hint: "Links SmartScheduler reads, and when classes meet" },
  { id: "schedule", label: "Schedule", hint: "Working hours and weekly busy times" },
  { id: "estimates", label: "How long things take", hint: "Default estimates by kind of work" },
  { id: "browser", label: "This browser", hint: "Theme, another device, start over" },
  { id: "about", label: "About, Help & walkthrough", hint: "Goal instructions, tour, design library" },
];

export function SettingsView() {
  const { settingsPanel, setSettingsPanel, setView } = useApp();

  if (settingsPanel !== "main") {
    return (
      <div className="max-w-3xl space-y-4">
        <Button icon={ArrowLeft} onClick={() => setSettingsPanel("main")}>
          All settings
        </Button>
        {settingsPanel === "calendars" ? <CalendarsPanel /> : null}
        {settingsPanel === "schedule" ? <SchedulePanel /> : null}
        {settingsPanel === "estimates" ? <EstimatesPanel /> : null}
        {settingsPanel === "browser" ? <BrowserPanel /> : null}
        {settingsPanel === "about" ? <AboutPanel /> : null}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="sr-only">Settings</h1>
      <Card>
        <CardHeader level={2} title="Settings" hint="Open a section below. Help and the prototype goal are also available from the header." />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button trailingIcon={ArrowRight} onClick={() => setView("help")}>
            Open Help
          </Button>
          <Button icon={Target} onClick={openGoalNotice}>
            Reopen goal
          </Button>
        </div>
      </Card>

      <nav className="space-y-2" aria-label="Settings sections">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className="card p-4 w-full text-left flex items-center gap-3 hover:bg-surface-2 transition"
            onClick={() => setSettingsPanel(item.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{item.label}</div>
              <p className="text-sm text-muted mt-0.5">{item.hint}</p>
            </div>
            <ArrowRight size={16} className="text-faint shrink-0" aria-hidden />
          </button>
        ))}
      </nav>
    </div>
  );
}

function CalendarsPanel() {
  const { ws, sync, syncing } = useApp();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Section
        title="Calendars"
        hint={
          ws.demo
            ? "You're looking at sample calendars."
            : "SmartScheduler re-reads these when you open it, when you come back to the tab, and every 30 minutes while it's open."
        }
      >
        {ws.demo ? (
          <div className="space-y-3">
            <FeedList />
            <Button variant="primary" icon={Sparkles} onClick={resetEverything}>
              Start with my own calendars
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <FeedList manage />
            <FeedAdder />
            <div className="flex items-center gap-3 flex-wrap">
              <Button size="sm" icon={RefreshCw} onClick={() => void sync()} disabled={syncing} className={syncing ? "is-syncing" : ""}>
                {syncing ? "Refreshing…" : "Refresh now"}
              </Button>
              <TextButton className="text-sm text-muted" onClick={() => setHelpOpen((o) => !o)} aria-expanded={helpOpen}>
                {helpOpen ? "Hide help" : "Where do I find a calendar link?"}
              </TextButton>
            </div>
            {helpOpen ? <ProviderHelp /> : null}
            <p className="text-xs text-muted leading-relaxed">
              <b className="font-medium text-fg">School</b> calendars bring in classes and assignments. <b className="font-medium text-fg">Personal</b>{" "}
              calendars only tell SmartScheduler when you&apos;re busy; their events never turn into homework.
            </p>
          </div>
        )}
      </Section>
      <Section title="Class times" hint="When each class meets. Class calendars rarely include this, so add it here and SmartScheduler plans around it.">
        <ClassTimesEditor />
      </Section>
    </div>
  );
}

function SchedulePanel() {
  return (
    <div className="space-y-4">
      <Section title="Your schedule" hint="SmartScheduler plans work inside these hours and around everything on your calendars.">
        <HoursForm advanced />
      </Section>
      <Section title="Other weekly busy times" hint="Things that happen every week but aren't on a calendar you added, like a job or practice.">
        <WeeklyEditor />
      </Section>
    </div>
  );
}

function EstimatesPanel() {
  const { ws, update } = useApp();
  const setTypeEstimate = (type: AssignmentType, minutes: number) =>
    update((w) => ({ ...w, prefs: { ...w.prefs, estimates: { ...w.prefs.estimates, [type]: minutes } } }));

  return (
    <Section title="How long things take" hint="Starting estimates for each kind of work. Change any single item by opening it.">
      <div className="divide-y divide-line">
        {ASSIGNMENT_TYPES.map((t) => {
          const meta = typeMeta(t);
          return (
            <div key={t} className="flex items-center gap-3 py-2">
              <meta.icon size={16} className={typeIconClass(t)} />
              <span className="text-sm font-medium flex-1">{meta.plural}</span>
              <select
                className="input input-sm"
                aria-label={`Time for ${meta.plural.toLowerCase()}`}
                value={ws.prefs.estimates[t]}
                onChange={(e) => setTypeEstimate(t, Number(e.target.value))}
              >
                {[...new Set([...ESTIMATE_OPTIONS, ws.prefs.estimates[t]])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {duration(m)}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Exams also get study time before them, planned like any other work.</p>
    </Section>
  );
}

function BrowserPanel() {
  const { ws, setSettingsPanel } = useApp();
  const { theme, toggle } = useTheme();
  const [copied, setCopied] = useState(false);

  const copySetup = async () => {
    const link = `${window.location.origin}/app#setup=${encodeSetup(ws)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", link);
    }
  };

  return (
    <div className="space-y-4">
      {!ws.demo ? (
        <Section
          title="Use SmartScheduler on another device"
          hint="Copy a setup link and open it on your phone or laptop. It holds your private calendar links, so only send it to yourself. Prototype note: nothing is uploaded to a server account."
        >
          <Button icon={Copy} onClick={copySetup} aria-live="polite">
            {copied ? "Copied to clipboard" : "Copy setup link"}
          </Button>
        </Section>
      ) : (
        <Section title="Use SmartScheduler on another device" hint="Sample data isn't meant to move between devices. Add your own calendars first.">
          <Button trailingIcon={ArrowRight} onClick={() => setSettingsPanel("calendars")}>
            Open calendars
          </Button>
        </Section>
      )}

      <Section title="Appearance" hint="Light or dark. Everything else stays the same.">
        <SegmentedControl
          label="Theme"
          value={theme}
          onChange={(t) => (t !== theme ? toggle() : undefined)}
          options={[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
          ]}
        />
      </Section>

      <Section title="Start over" hint="Removes your calendars and everything you've set from this browser. Nothing is stored anywhere else.">
        <Button
          variant="danger"
          icon={RotateCcw}
          onClick={() => {
            if (window.confirm("Remove all calendars and settings from this browser? This can't be undone.")) resetEverything();
          }}
        >
          Remove everything
        </Button>
      </Section>
    </div>
  );
}

function AboutPanel() {
  const { setView } = useApp();
  return (
    <Section title="About SmartScheduler" hint="Goal instructions, a four-step walkthrough, how planning works, and the parts the app is built from.">
      <div className="flex gap-2 flex-wrap">
        <Button icon={Target} onClick={openGoalNotice}>
          Reopen goal
        </Button>
        <Button trailingIcon={ArrowRight} onClick={() => setView("help")}>
          Open Help
        </Button>
        <Button icon={Compass} onClick={startTour}>
          Show the walkthrough
        </Button>
        <ButtonLink href="/about" icon={Info}>
          How it works
        </ButtonLink>
        <ButtonLink href="/design" icon={LayoutTemplate}>
          Design library
        </ButtonLink>
      </div>
    </Section>
  );
}
