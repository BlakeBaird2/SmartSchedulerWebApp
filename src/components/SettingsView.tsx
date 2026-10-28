"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, CircleHelp, Clock, Compass, ListOrdered, MonitorSmartphone, Timer, type LucideIcon, Copy, LayoutTemplate, Moon, RefreshCw, RotateCcw, Sparkles, Sun, Target, House } from "lucide-react";
import { encodeSetup } from "@/lib/workspace";
import { classRank } from "@/lib/todos";
import { ASSIGNMENT_TYPES, type AssignmentType, type UnfinishedPolicy } from "@/lib/types";
import { duration, typeIconClass, typeMeta } from "@/lib/ui";
import { courseStyle, useApp, type SettingsPanel } from "./context";
import { FeedAdder, FeedList, ProviderHelp } from "./Feeds";
import { HoursForm, WeeklyEditor } from "./ScheduleSettings";
import { ClassTimesEditor } from "./ClassTimes";
import { openGoalNotice } from "./Prototype";
import { resetEverything, useTheme } from "./store";
import { startTour } from "./AppTour";
import { EventLog } from "./EventLog";
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

/** Each section has its own icon, so the menu can be scanned by shape as well as by name. */
export const SETTINGS_SECTIONS: { id: SettingsPanel; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "calendars", label: "Calendars & class times", hint: "Links SmartScheduler reads, and when classes meet", icon: CalendarDays },
  { id: "classes", label: "Class priority", hint: "Which class comes first when work is due at the same time", icon: ListOrdered },
  { id: "schedule", label: "Schedule", hint: "Working hours and weekly busy times", icon: Clock },
  { id: "estimates", label: "How long things take", hint: "Default estimates by kind of work", icon: Timer },
  { id: "browser", label: "This browser", hint: "Theme, another device, start over", icon: MonitorSmartphone },
  { id: "about", label: "About, Help & walkthrough", hint: "Goal instructions, tour, design library", icon: CircleHelp },
];

/**
 * Settings.
 *
 * On a computer (md and up) it works like most web apps' settings: the
 * sections stay listed on the left the whole time, the open one is highlighted,
 * and its settings fill the right. Nothing is ever more than one click away, and
 * you never lose your place.
 *
 * On phones it stays a list of sections, each opening as its own page with a
 * "‹ Settings" link back (the phone layout will be redesigned separately).
 */
export function SettingsView() {
  const { settingsPanel } = useApp();
  // On a computer, "no section chosen yet" opens the first one.
  const desktopPanel: SettingsPanel = settingsPanel === "main" ? SETTINGS_SECTIONS[0].id : settingsPanel;

  return (
    <>
      {settingsPanel === "main" ? (
        <div className="md:hidden">
          <SettingsHub />
        </div>
      ) : null}
      <div className={`${settingsPanel === "main" ? "hidden md:grid" : "grid"} md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] gap-6 items-start`}>
        <SettingsSidebar active={desktopPanel} />
        <div className="min-w-0 max-w-3xl">
          <SectionHeading id={desktopPanel} />
          <div className="space-y-4">
            {desktopPanel === "calendars" ? <CalendarsPanel /> : null}
            {desktopPanel === "classes" ? <ClassesPanel /> : null}
            {desktopPanel === "schedule" ? <SchedulePanel /> : null}
            {desktopPanel === "estimates" ? <EstimatesPanel /> : null}
            {desktopPanel === "browser" ? <BrowserPanel /> : null}
            {desktopPanel === "about" ? <AboutPanel /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

/** Computer only: the sections, always visible, with the open one highlighted. */
function SettingsSidebar({ active }: { active: SettingsPanel }) {
  const { setSettingsPanel, setView } = useApp();
  return (
    <aside className="hidden md:block md:sticky md:top-32 lg:top-20">
      <nav className="card p-2" aria-label="Settings sections">
        <ul className="space-y-0.5">
          {SETTINGS_SECTIONS.map((item) => {
            const on = item.id === active;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setSettingsPanel(item.id)}
                  className={`w-full text-left flex items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors ${
                    on ? "bg-accent-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`grid place-items-center h-8 w-8 shrink-0 rounded-lg ${on ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}
                    aria-hidden
                  >
                    <item.icon size={17} />
                  </span>
                  <span className={`min-w-0 text-sm leading-snug ${on ? "font-semibold text-fg" : "font-medium text-muted"}`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-3 px-1 flex flex-col items-start gap-1">
        <Button variant="quiet" size="sm" icon={CircleHelp} onClick={() => setView("help")}>
          Open Help
        </Button>
        <Button variant="quiet" size="sm" icon={Target} onClick={openGoalNotice}>
          Reopen goal
        </Button>
      </div>
    </aside>
  );
}

/** Computer only: the open section's name and what it covers, above its settings. */
function SectionHeading({ id }: { id: SettingsPanel }) {
  const section = SETTINGS_SECTIONS.find((s) => s.id === id);
  if (!section) return null;
  return (
    <div className="hidden md:flex items-start gap-3 mb-4">
      <span className="grid place-items-center h-9 w-9 shrink-0 rounded-lg bg-accent-soft text-accent" aria-hidden>
        <section.icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight leading-tight">{section.label}</h2>
        <p className="mt-0.5 text-sm text-muted">{section.hint}</p>
      </div>
    </div>
  );
}

/** Phones: the list of sections, each opening as its own page. */
function SettingsHub() {
  const { setSettingsPanel, setView } = useApp();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button icon={CircleHelp} onClick={() => setView("help")}>
          Open Help
        </Button>
        <Button icon={Target} onClick={openGoalNotice}>
          Reopen goal
        </Button>
      </div>

      <nav className="space-y-2" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="card p-4 w-full text-left flex items-center gap-4 hover:shadow-[var(--shadow-md)] hover:border-line-strong transition"
            onClick={() => setSettingsPanel(item.id)}
          >
            <span className="grid place-items-center h-10 w-10 shrink-0 rounded-xl bg-accent-soft text-accent" aria-hidden>
              <item.icon size={20} />
            </span>
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

/**
 * The student's own ranking of their classes. Work due at the same moment (most
 * class work is due at 11:59 PM) is listed by it on the to-do list.
 */
function ClassesPanel() {
  const { model, ws, update } = useApp();
  const rank = classRank(ws.classOrder);
  // Classes never ranked keep their calendar order, after the ranked ones.
  const ranked = model.courses.filter((c) => !c.hidden).sort((a, b) => rank(a.id) - rank(b.id));
  const custom = ws.classOrder.length > 0;

  const move = (from: number, by: -1 | 1) => {
    const ids = ranked.map((c) => c.id);
    const to = from + by;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    // Hidden classes keep their place at the end, in case they come back.
    update((w) => ({ ...w, classOrder: [...ids, ...w.classOrder.filter((id) => !ids.includes(id))] }));
    // Keep the keyboard on the class that moved, even at the top or bottom of the list.
    const id = ids[to];
    requestAnimationFrame(() => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>(`[data-rank="${CSS.escape(id)}"]`)];
      (buttons.find((b) => b.dataset.dir === (by < 0 ? "up" : "down") && !b.disabled) ?? buttons.find((b) => !b.disabled))?.focus();
    });
  };

  return (
    <Section
      title="Class priority"
      hint="When two things are due at the same time, work for the class higher on this list comes first on your to-do list. Most class work is due at 11:59 PM, so this decides a lot."
    >
      {ranked.length === 0 ? (
        <p className="text-sm text-muted">No classes yet. Add a school calendar and its classes show up here.</p>
      ) : (
        <ol className="divide-y divide-line" aria-label="Classes, most important first">
          {ranked.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 py-2" style={courseStyle(c.color)}>
              <span className="w-5 text-center text-sm font-semibold tabular-nums text-muted" aria-hidden>
                {i + 1}
              </span>
              <span className="course-dot shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <span className="course-text font-semibold">{c.code}</span>
                {c.title !== c.code ? <span className="block text-xs text-muted truncate">{c.title}</span> : null}
              </span>
              <Button
                iconOnly
                size="sm"
                variant="quiet"
                icon={ArrowUp}
                label={`Move ${c.code} up`}
                disabled={i === 0}
                data-rank={c.id}
                data-dir="up"
                onClick={() => move(i, -1)}
              />
              <Button
                iconOnly
                size="sm"
                variant="quiet"
                icon={ArrowDown}
                label={`Move ${c.code} down`}
                disabled={i === ranked.length - 1}
                data-rank={c.id}
                data-dir="down"
                onClick={() => move(i, 1)}
              />
            </li>
          ))}
        </ol>
      )}
      {custom ? (
        <TextButton className="mt-3 text-sm" onClick={() => update((w) => ({ ...w, classOrder: [] }))}>
          Back to calendar order
        </TextButton>
      ) : null}
    </Section>
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
      <Section title="Work you didn't finish" hint="Scheduling something takes it off your to-do list. When its time passes before you tick it off:">
        <UnfinishedChoice />
      </Section>
    </div>
  );
}

const UNFINISHED_CHOICES: { id: UnfinishedPolicy; label: string; hint: string }[] = [
  { id: "ask", label: "Ask me each morning", hint: "The first time you open SmartScheduler each day, choose whether to put it back." },
  { id: "midnight", label: "Put it back at midnight", hint: "Back on your to-do list once the day it was scheduled for is over." },
  { id: "keep", label: "Keep it on my to-do list", hint: "Scheduling never takes work off the list. It stays until you tick it off." },
];

function UnfinishedChoice() {
  const { ws, update } = useApp();
  return (
    <div role="radiogroup" aria-label="When scheduled work isn't finished" className="space-y-2">
      {UNFINISHED_CHOICES.map((c) => {
        const on = ws.unfinished === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => update((w) => ({ ...w, unfinished: c.id }))}
            className={`w-full text-left flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              on ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
            }`}
          >
            <span
              className={`mt-0.5 grid place-items-center h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-accent" : "border-line-strong"}`}
              aria-hidden
            >
              {on ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="block text-xs text-muted">{c.hint}</span>
            </span>
          </button>
        );
      })}
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
        <ButtonLink href="/about" icon={House}>
          Home page
        </ButtonLink>
        <ButtonLink href="/design" icon={LayoutTemplate}>
          Design library
        </ButtonLink>
      </div>
      {/* For user tests: the smart events this tab has fired, so a facilitator can check what a tester did. */}
      <details className="mt-4 rounded-xl border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold">Smart events in this session (for user testing)</summary>
        <p className="mt-1 mb-2 text-xs text-muted leading-relaxed">
          Key actions add <code>?event=…</code> to the address and push to <code>window.dataLayer</code>, so testing tools can count a task as done.
        </p>
        <EventLog />
      </details>
    </Section>
  );
}
