"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bell, CalendarClock, Check, Inbox, Plus, Settings, Trash } from "lucide-react";
import { PrototypeBadge } from "./Prototype";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  ChoicePill,
  ClassChip,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FreeGapBlock,
  SectionLabel,
  SegmentedControl,
  Switch,
  TaskCard,
  TextButton,
  Toast,
  Tour,
  TypeChip,
  Wordmark,
} from "./ui";

/**
 * /design: SmartScheduler's design library, drawn live. Each entry shows the
 * component, when to use it, the rules it follows, which screens use it, and
 * what in our discovery research it answers.
 */

const ROOT_OUTCOME = "Students spend their free time doing work, not figuring out what work to do.";

const GROUPS: { id: string; title: string; items: { id: string; name: string }[] }[] = [
  {
    id: "foundations",
    title: "Foundations",
    items: [
      { id: "colour", name: "Colour" },
      { id: "type", name: "Type" },
      { id: "words", name: "Words" },
    ],
  },
  {
    id: "core",
    title: "Core: planning",
    items: [
      { id: "free-gap", name: "FreeGapBlock" },
      { id: "task-card", name: "TaskCard" },
      { id: "checkbox", name: "Checkbox" },
      { id: "class-chip", name: "ClassChip" },
      { id: "type-chip", name: "TypeChip" },
    ],
  },
  {
    id: "actions",
    title: "Actions",
    items: [
      { id: "button", name: "Button" },
      { id: "text-button", name: "TextButton" },
    ],
  },
  {
    id: "containers",
    title: "Containers",
    items: [
      { id: "card", name: "Card" },
      { id: "callout", name: "Callout" },
      { id: "dialog", name: "Dialog" },
      { id: "empty", name: "EmptyState" },
    ],
  },
  {
    id: "inputs",
    title: "Inputs",
    items: [
      { id: "segmented", name: "SegmentedControl" },
      { id: "field", name: "Field" },
      { id: "choice", name: "ChoicePill" },
      { id: "switch", name: "Switch" },
    ],
  },
  {
    id: "feedback",
    title: "Feedback and guidance",
    items: [
      { id: "toast", name: "Toast" },
      { id: "tour", name: "Tour" },
    ],
  },
];

export function DesignLibrary() {
  return (
    <div className="min-h-dvh" data-design-library>
      <header className="sticky top-0 z-30 bg-bg border-b border-line-strong">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/" aria-label="SmartScheduler home page" className="shrink-0">
            <Wordmark />
          </Link>
          <PrototypeBadge />
          <span className="hidden sm:inline text-muted">/ Design library</span>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/" icon={ArrowLeft} aria-label="Home">
              <span className="hidden sm:inline">Home</span>
            </ButtonLink>
            <ButtonLink href="/app" trailingIcon={ArrowRight}>
              Open the app
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <section className="pt-10 pb-8 border-b border-line-strong">
          <h1 className="capability text-4xl sm:text-5xl">Design library</h1>
          <p className="mt-3 max-w-3xl text-lg text-muted leading-relaxed">
            Every SmartScheduler screen is built from the parts on this page. They are React components in <code className="text-fg">src/components/ui</code>,
            styled with Tailwind CSS and Lucide icons, and drawn as a low-fidelity wireframe: greys, square outlines, a sketch font and one blue for the main
            action.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Card padding="sm" className="!border-2 !border-fg">
              <SectionLabel>Root user outcome</SectionLabel>
              <p className="mt-1 font-semibold leading-snug">{ROOT_OUTCOME}</p>
            </Card>
            <Card padding="sm">
              <SectionLabel>Who it&apos;s for</SectionLabel>
              <p className="mt-1 leading-snug">A student with classes and a job, who has 45 minutes between them and no time to decide what to do.</p>
            </Card>
            <Card padding="sm">
              <SectionLabel>What that means for the parts</SectionLabel>
              <p className="mt-1 leading-snug">The free gap and the one task to do in it come first. Everything else supports that or stays quiet.</p>
            </Card>
          </div>
        </section>

        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Components" className="hidden lg:block sticky top-20 self-start pt-8 max-h-[calc(100dvh-6rem)] overflow-y-auto scrollbar-thin">
            {GROUPS.map((g) => (
              <div key={g.id} className="mb-4">
                <SectionLabel>{g.title}</SectionLabel>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <a href={`#${i.id}`} className="text-muted hover:text-fg hover:underline underline-offset-4">
                        {i.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <SectionLabel>Rules</SectionLabel>
            <a href="#rules" className="text-muted hover:text-fg hover:underline underline-offset-4">
              How screens use them
            </a>
          </nav>

          <div className="min-w-0">
            <Foundations />
            <CoreParts />
            <Actions />
            <Containers />
            <Inputs />
            <Feedback />
            <Rules />
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout of an entry
// ---------------------------------------------------------------------------

function GroupHeading({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div id={id} className="pt-12 pb-2 scroll-mt-16">
      <h2 className="text-3xl font-bold">{title}</h2>
      <p className="mt-1 text-muted max-w-3xl">{lead}</p>
    </div>
  );
}

function Entry({
  id,
  name,
  summary,
  use,
  rules,
  why,
  usedIn,
  children,
}: {
  id: string;
  name: string;
  summary: string;
  use: string;
  rules: string[];
  why: string;
  usedIn: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 mt-6 border border-line-strong" aria-labelledby={`${id}-title`}>
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-line">
        <h3 id={`${id}-title`} className="text-xl font-bold">
          {name}
        </h3>
        <p className="text-muted">{summary}</p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="p-4 sm:p-5 bg-surface-2 border-b md:border-b-0 md:border-r border-line min-w-0" aria-label={`${name} example`}>
          <SectionLabel className="mb-3">Example</SectionLabel>
          {children}
        </div>
        <dl className="p-4 sm:p-5 space-y-3 text-[0.9375rem]">
          <div>
            <dt className="section-title">Use it for</dt>
            <dd className="mt-0.5">{use}</dd>
          </div>
          <div>
            <dt className="section-title">Rules</dt>
            <dd className="mt-0.5">
              <ul className="list-disc pl-5 space-y-0.5">
                {rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="section-title">Why it exists</dt>
            <dd className="mt-0.5">{why}</dd>
          </div>
          <div>
            <dt className="section-title">Used in</dt>
            <dd className="mt-0.5 text-muted">{usedIn}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

const SWATCHES = [
  { name: "Ink", token: "--fg", use: "Text, outlines of the focal card, ticked boxes" },
  { name: "Muted", token: "--muted", use: "Secondary text: details lines, hints" },
  { name: "Line", token: "--line-strong", use: "Outlines of every box and control" },
  { name: "Paper", token: "--surface-2", use: "Fills that group things: free gaps, examples, callouts" },
  { name: "Blue pen", token: "--accent", use: "Only the one main action on a screen, and today on the calendar" },
];

function Foundations() {
  return (
    <>
      <GroupHeading id="foundations" title="Foundations" lead="The few decisions every component shares, so all screens look like one product." />
      <section id="colour" className="scroll-mt-16 mt-6">
        <h3 className="text-xl font-bold">Colour</h3>
        <p className="text-muted">Greys and one accent. Class colours are turned into shades of grey, so the prototype reads as a sketch.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SWATCHES.map((s) => (
            <li key={s.token} className="flex items-center gap-3 border border-line-strong p-2">
              <span className="w-12 h-12 shrink-0 border border-line-strong" style={{ background: `var(${s.token})` }} aria-hidden />
              <span className="min-w-0">
                <span className="font-semibold">{s.name}</span> <code className="text-xs text-muted">{s.token}</code>
                <span className="block text-sm text-muted leading-snug">{s.use}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">Warnings never rely on colour: they always carry an icon, bold text, or a heavier outline.</p>
      </section>

      <section id="type" className="scroll-mt-16 mt-8">
        <h3 className="text-xl font-bold">Type</h3>
        <p className="text-muted">One sketch font. Size and weight, not colour, set what is read first.</p>
        <div className="mt-3 border border-line-strong divide-y divide-line">
          <div className="p-3 flex items-baseline gap-4 flex-wrap">
            <span className="w-28 text-sm text-muted shrink-0">Capability</span>
            <span className="capability text-3xl">See exactly what to work on</span>
          </div>
          <div className="p-3 flex items-baseline gap-4 flex-wrap">
            <span className="w-28 text-sm text-muted shrink-0">Focus task</span>
            <span className="text-xl font-semibold">Reading: Chapter 5</span>
          </div>
          <div className="p-3 flex items-baseline gap-4 flex-wrap">
            <span className="w-28 text-sm text-muted shrink-0">Card title</span>
            <span className="text-lg font-bold">Due this week</span>
          </div>
          <div className="p-3 flex items-baseline gap-4 flex-wrap">
            <span className="w-28 text-sm text-muted shrink-0">Group label</span>
            <SectionLabel>Tuesday, Oct 13</SectionLabel>
          </div>
          <div className="p-3 flex items-baseline gap-4 flex-wrap">
            <span className="w-28 text-sm text-muted shrink-0">Body / details</span>
            <span>
              Body text <span className="text-sm text-muted">and a quieter details line</span>
            </span>
          </div>
        </div>
      </section>

      <section id="words" className="scroll-mt-16 mt-8">
        <h3 className="text-xl font-bold">Words</h3>
        <p className="text-muted">One word for each idea, used the same way on every screen.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 border border-line-strong p-3">
          {[
            ["Task", 'Anything to do: an assignment, a reading, study time. Never "item" or "work item".'],
            ["Free gap", "Time between events that is long enough to use."],
            ["Plan", "Which task goes in which free gap. Also the home screen."],
            ["Done", "Finished. Ticking the box or pressing Done does the same thing."],
            ["Class", "A course. Shown by its short code (ACC 200)."],
            ["Alerts", "Changes from your class calendars: moved due dates, new or removed tasks."],
          ].map(([term, def]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="text-sm text-muted">{def}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Core planning parts
// ---------------------------------------------------------------------------

function CoreParts() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <>
      <GroupHeading
        id="core"
        title="Core: planning"
        lead="These carry SmartScheduler's one job. They get the most space and the strongest outlines; everything else in the library supports them."
      />

      <Entry
        id="free-gap"
        name="FreeGapBlock"
        summary="A stretch of free time, with the tasks planned into it."
        use="Every free gap in a day's plan."
        rules={[
          'The gap\'s length is the headline ("Free · 50m").',
          'Tasks that fit sit inside it, so the box itself says "these belong to this time".',
          "Dashed outline: it is open time, not a fixed event.",
          "Time left over is always said, never left blank.",
        ]}
        why="Our discovery research narrowed to one problem: students lose free time deciding what to work on instead of working on it. This shows the gap with the decision already made."
        usedIn="Plan → The rest of today"
      >
        <FreeGapBlock minutes={50} label="Free · 50m" note="20m left over">
          <li>
            <TaskCard
              title="Reading: Chapter 5"
              done={done.gap}
              onToggleDone={() => toggle("gap")}
              onOpen={() => setOpened("Reading: Chapter 5")}
              meta={
                <>
                  <ClassChip code="BUS 301" color="#2563eb" />
                  <span>due in 2 days</span>
                </>
              }
              trailing={<span className="text-sm font-semibold">30m</span>}
            />
          </li>
        </FreeGapBlock>
        {opened ? <p className="mt-2 text-sm text-muted">Opened details for {opened}.</p> : null}
      </Entry>

      <Entry
        id="task-card"
        name="TaskCard"
        summary="One task, the same everywhere it appears."
        use="Every list of tasks: Plan, Due this week, Upcoming, Classes. Compact in narrow columns."
        rules={[
          "Tick box on the left finishes it; clicking anywhere else opens its details. The two never overlap.",
          "Title first, in the heaviest weight. Details (class, time, plan) on one quieter line.",
          "Exams and quizzes get a TypeChip next to the title so they stand out.",
          "Finished tasks are struck through and faded, not removed, until you hide them.",
        ]}
        why="The same task appears on several screens. One card means it is recognised at a glance everywhere, instead of being re-read on each screen."
        usedIn="Plan, Upcoming, Classes"
      >
        <div className="space-y-2">
          <TaskCard
            title="Study for Midterm Exam 1"
            done={done.exam}
            onToggleDone={() => toggle("exam")}
            onOpen={() => setOpened("Study for Midterm Exam 1")}
            badge={<TypeChip type="exam" />}
            meta={
              <>
                <ClassChip code="ACC 200" color="#16a34a" />
                <span>3h</span>
                <span>Planned tomorrow 9 AM</span>
              </>
            }
            trailing={
              <>
                <div className="text-sm font-semibold">10 AM</div>
                <div className="text-xs text-muted">in 2 days</div>
              </>
            }
          />
          <TaskCard
            title="Case Write-Up 4"
            done={done.compact}
            onToggleDone={() => toggle("compact")}
            onOpen={() => setOpened("Case Write-Up 4")}
            density="compact"
            meta={
              <>
                <ClassChip code="BUS 301" color="#2563eb" />
                <span>9:30 AM</span>
              </>
            }
          />
        </div>
      </Entry>

      <Entry
        id="checkbox"
        name="Checkbox"
        summary="Finishes a task."
        use="The left edge of every TaskCard, and the details panel."
        rules={["Square, like every checkbox people already know.", "At least 28px on touch screens.", "Ticking it shows a message with Undo."]}
        why="Ticking off is the reward at the end of the root outcome. It has to be obvious and instant, and safe to hit by mistake."
        usedIn="Every TaskCard; task details"
      >
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <Checkbox checked={!!done.cb1} onChange={() => toggle("cb1")} label="Example task" />
            Not done
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={!done.cb2} onChange={() => toggle("cb2")} label="Example task" />
            Done
          </label>
        </div>
      </Entry>

      <Entry
        id="class-chip"
        name="ClassChip"
        summary="Which class something belongs to."
        use="Anywhere a task or event is shown with its class."
        rules={[
          "Each class keeps one shade everywhere (Gestalt: similarity), so you can follow a class across screens.",
          "Tag (boxed) for the focus task; dot for dense lists.",
          "Always shows the code as text, never only a colour.",
        ]}
        why="Students pull several classes from different calendars (Canvas, Learning Suite). A steady code and shade answers “which class is this for?” without reading the title."
        usedIn="Plan, Upcoming, Classes, Calendar, task details"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <ClassChip variant="tag" code="BUS 301" color="#2563eb" />
          <ClassChip code="ACC 200" color="#16a34a" />
          <ClassChip code="CS 142" color="#d97706" />
          <ClassChip code="WRTG 150" color="#9333ea" />
        </div>
      </Entry>

      <Entry
        id="type-chip"
        name="TypeChip"
        summary="What kind of task it is."
        use="Next to the title of exams and quizzes; in task details for every kind."
        rules={["Exams are solid black, quizzes outlined: the bigger the stakes, the louder the chip.", "Icon plus word, never icon alone."]}
        why="Missing an exam is worse than missing a reading. The chip lets high-stakes work stand out in a long list."
        usedIn="Plan, Upcoming, task details"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <TypeChip type="exam" />
          <TypeChip type="quiz" />
          <TypeChip type="project" />
          <TypeChip type="assignment" />
          <TypeChip type="reading" />
        </div>
      </Entry>
    </>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function Actions() {
  return (
    <>
      <GroupHeading id="actions" title="Actions" lead="Four button looks, each with one job, so how a button looks tells you how much it matters." />
      <Entry
        id="button"
        name="Button"
        summary="Primary, secondary, quiet and danger, in three sizes."
        use="Every action that isn't inside a sentence."
        rules={[
          "Exactly one primary (blue) button per screen or dialog: the thing we want you to do next.",
          "Secondary for everything else. Quiet for small actions inside lists. Danger for removing things, and it always asks or offers Undo.",
          "Icon-only buttons always have a name, read out by screen readers and shown on hover.",
          "Disabled buttons say why on hover.",
        ]}
        why="On the Plan screen the next step is always “do this task, then press Done”. A single blue button makes that the obvious move."
        usedIn="Every screen"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" icon={Check}>
              Done
            </Button>
            <Button icon={Plus}>Add task</Button>
            <Button variant="quiet">Not now</Button>
            <Button variant="danger" icon={Trash}>
              Delete
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" size="lg" icon={Check}>
              Done
            </Button>
            <Button size="sm">Small</Button>
            <Button iconOnly icon={Settings} label="Settings" />
            <Button iconOnly icon={Bell} label="Alerts" />
            <Button disabled title="Add a calendar first">
              Continue
            </Button>
          </div>
        </div>
      </Entry>
      <Entry
        id="text-button"
        name="TextButton"
        summary="An action inside a sentence."
        use="Small follow-ups that belong to the sentence around them."
        rules={["Underlined, like every link on the web.", "Never used for the main action on a screen."]}
        why="Keeps secondary choices close to the sentence that explains them, without adding another box to the screen."
        usedIn="Plan, Settings, task details, class times"
      >
        <p>
          You have weekends off, so no work is planned. <TextButton>Change this</TextButton>
        </p>
      </Entry>
    </>
  );
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

function Containers() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GroupHeading id="containers" title="Containers" lead="Boxes that group what belongs together, and keep it apart from what doesn't." />
      <Entry
        id="card"
        name="Card"
        summary="One box, one group, one title."
        use="Each separate part of a screen: what to do now, the rest of today, due this week, each settings section."
        rules={[
          "Everything in a card belongs together (Gestalt: common region).",
          'One card per screen gets the heavy outline: the focal point. On Plan, that\'s "what to work on now".',
          "Space between cards is wider than space inside them (Gestalt: proximity).",
        ]}
        why="The Plan screen answers three questions in order: what now, the rest of today, what's due. One card per question keeps them from blurring together."
        usedIn="Plan, Settings, onboarding"
      >
        <div className="space-y-3">
          <Card className="!border-2 !border-fg">
            <SectionLabel>Work on</SectionLabel>
            <p className="mt-1 text-xl font-semibold">Reading: Chapter 5</p>
          </Card>
          <Card>
            <CardHeader title="Due this week" hint="Everything here fits in your free time." />
          </Card>
        </div>
      </Entry>
      <Entry
        id="callout"
        name="Callout"
        summary="A message about the screen, set apart from its content."
        use="Sample data, a setup step that's missing, a calendar that couldn't be read."
        rules={["Info: grey fill. Sample: dashed. Warning: heavy black outline and an icon.", "Its actions sit on its right, quietest first."]}
        why="Setup gaps (like missing class times) make the plan wrong. A callout asks once, right where it matters, and can be dismissed."
        usedIn="Plan, every screen (banners)"
      >
        <div className="space-y-2">
          <Callout
            icon={CalendarClock}
            title="When do your classes meet?"
            actions={
              <>
                <Button variant="quiet">Not now</Button>
                <Button icon={Plus}>Add class times</Button>
              </>
            }
          >
            Add them once so your real free time is clear.
          </Callout>
          <Callout tone="warning" title="Canvas couldn't be read">
            Its last good copy is still shown.
          </Callout>
        </div>
      </Entry>
      <Entry
        id="dialog"
        name="Dialog"
        summary="Every pop-up, built once."
        use="Adding a task, editing a class, class times, imports, the prototype notice; as a side panel for task and event details."
        rules={[
          "Esc, the X, and clicking outside all close it.",
          "Focus moves in, stays in while it's open, and goes back where it came from.",
          "Buttons bottom-right in one order: the way out first, the main action last. Reset or remove sits far left.",
        ]}
        why="Pop-ups that behave differently make people hesitate. One component means once you've used one, you've used them all."
        usedIn="Add task, Edit class, Class times, Import, Prototype notice, task and event details"
      >
        <Button onClick={() => setOpen(true)}>Open an example dialog</Button>
        {open ? (
          <Dialog title="Add a task" description="For work that isn't on any calendar." onClose={() => setOpen(false)}>
            <Field label="What needs doing?">
              <input className="input" placeholder="e.g. Finish lab report" data-autofocus />
            </Field>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Add task
              </Button>
            </DialogActions>
          </Dialog>
        ) : null}
      </Entry>
      <Entry
        id="empty"
        name="EmptyState"
        summary="What an empty list says instead of nothing."
        use="Any list that can be empty: Upcoming, Classes, Alerts."
        rules={["Say what's missing and why, in plain words.", "Offer the one action that fills it."]}
        why="A blank screen looks broken. New users especially need to know the next step."
        usedIn="Upcoming, Classes, Alerts"
      >
        <EmptyState icon={Inbox} title="Nothing due right now" action={<Button icon={Plus}>Add a task</Button>}>
          Add a school calendar in Settings, or add work by hand.
        </EmptyState>
      </Entry>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function Inputs() {
  const [range, setRange] = useState<"month" | "week" | "day">("week");
  const [est, setEst] = useState(30);
  const [on, setOn] = useState(true);
  return (
    <>
      <GroupHeading id="inputs" title="Inputs" lead="Ways to choose and type, each with a visible label." />
      <Entry
        id="segmented"
        name="SegmentedControl"
        summary="Pick exactly one of a few options."
        use="The main views (Plan, Calendar, Upcoming, Classes), Month / Week / Day, the plan's day picker, light or dark."
        rules={["The chosen option is boxed, shaded and underlined: clear without colour.", "Labels are words, with an icon only as a helper."]}
        why="The same control for every “pick one” choice means switching views works the same way everywhere."
        usedIn="Header, Calendar, Plan, Settings"
      >
        <SegmentedControl
          label="Calendar range"
          value={range}
          onChange={setRange}
          options={[
            { id: "month", label: "Month" },
            { id: "week", label: "Week" },
            { id: "day", label: "Day" },
          ]}
        />
      </Entry>
      <Entry
        id="field"
        name="Field"
        summary="A label with its control."
        use="Every form: add a task, edit a class, settings."
        rules={[
          "The label is always visible, never only a placeholder.",
          "Hints sit under the control, in the quieter style.",
          "Stacked in dialogs; label-left in settings lists.",
        ]}
        why="Students fill these in quickly between classes; visible labels mean nothing has to be remembered."
        usedIn="Add task, Edit class, Settings"
      >
        <div className="space-y-3 max-w-sm">
          <Field label="Due date" hint="Leave the time as 11:59 PM if you're not sure.">
            <input type="date" className="input" defaultValue="2026-10-14" />
          </Field>
          <Field layout="row" label="Plan work on weekends" hint="Off means Saturday and Sunday stay free.">
            <Switch checked={on} onChange={setOn} label="Plan work on weekends" />
          </Field>
        </div>
      </Entry>
      <Entry
        id="choice"
        name="ChoicePill"
        summary="One of several small values, side by side."
        use="How long a task needs."
        rules={["Shows every common choice at once, so nothing has to be typed.", "The chosen one is pressed and filled."]}
        why="Estimates are what make the plan fit. Making them one tap keeps students adjusting them as they go."
        usedIn="Add task, task details"
      >
        <div className="flex gap-1.5 flex-wrap">
          {[15, 30, 45, 60, 90].map((m) => (
            <ChoicePill key={m} selected={est === m} onClick={() => setEst(m)}>
              {m < 60 ? `${m}m` : m === 60 ? "1h" : "1h 30m"}
            </ChoicePill>
          ))}
        </div>
      </Entry>
      <Entry
        id="switch"
        name="Switch"
        summary="On or off, taking effect at once."
        use="Settings that change the plan straight away."
        rules={['Its label says what "on" means.', "Filled track when on."]}
        why="Small preferences (weekends, hiding a class) should feel as quick as flipping a light switch."
        usedIn="Settings, Edit class"
      >
        <label className="flex items-center gap-2.5">
          <Switch checked={on} onChange={setOn} label="Plan work on weekends" />
          Plan work on weekends
        </label>
      </Entry>
    </>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function Feedback() {
  const [shown, setShown] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);
  return (
    <>
      <GroupHeading id="feedback" title="Feedback and guidance" lead="Every action shows its result, and the first visit gets a short, skippable tour." />
      <Entry
        id="toast"
        name="Toast"
        summary="A short confirmation at the bottom of the screen, with Undo when possible."
        use="After marking done, adding or deleting a task, removing a time, refreshing calendars."
        rules={[
          "Says what happened in a few words.",
          "Offers Undo for anything that can be taken back, and stays a little longer when it does.",
          "Never blocks the screen.",
        ]}
        why="Marking something done moves the whole plan. People need to see that it worked, and to recover if they tapped the wrong box."
        usedIn="Every screen"
      >
        <Button onClick={() => setShown("Done: Reading: Chapter 5")}>Show an example</Button>
        {shown ? <Toast message={shown} action="Undo" onAction={() => setShown(null)} /> : null}
      </Entry>
      <Entry
        id="tour"
        name="Tour"
        summary="A short walkthrough in a pop-up: a wireframe picture and a sentence or two per step."
        use="Once, the first time someone opens the app (after the prototype notice). Again from Settings → Show the walkthrough."
        rules={[
          "Four steps at most, in the order the Plan screen is read: what to do now, the rest of today, what's due, everything else.",
          "Built on Dialog, so it closes the same way (Esc, the X, a click outside) and never follows the page around.",
          "Always says where you are (Step 2 of 4, with dots), with Back, Next and the arrow keys.",
          "Skip is always there, and the last button says what happens next (Show my plan).",
        ]}
        why="New users need to see the core loop (free gap → task → Done) once. A short walkthrough shows it without a manual and gets out of the way."
        usedIn="App (first visit), Settings"
      >
        <Button onClick={() => setTouring(true)}>Open an example walkthrough</Button>
        {touring ? (
          <Tour
            steps={[
              {
                title: "Start with the task in front of you",
                body: "The one task to work on in your free time right now.",
                picture: (
                  <div className="h-full bg-surface-2 p-4 flex items-center">
                    <div className="w-full border-2 border-fg bg-surface p-3">
                      <SectionLabel>Work on</SectionLabel>
                      <p className="font-semibold">Reading: Chapter 5</p>
                    </div>
                  </div>
                ),
              },
              {
                title: "See what's due",
                body: "Everything due this week, and when it's planned.",
                picture: (
                  <div className="h-full bg-surface-2 p-4 flex items-center">
                    <div className="w-full border border-line-strong bg-surface p-3">Due this week · 8 tasks</div>
                  </div>
                ),
              },
            ]}
            onClose={() => setTouring(false)}
          />
        ) : null}
      </Entry>
    </>
  );
}

// ---------------------------------------------------------------------------
// Rules for screens
// ---------------------------------------------------------------------------

const RULES: { title: string; text: string }[] = [
  {
    title: "Lead with the capability",
    text: 'Every entry screen opens with "See exactly what to work on in every free gap of your day." Nothing above it competes.',
  },
  { title: "One focal point per screen", text: "One heavy-outlined card and one blue button per screen. Plan: the task to do now and its Done button." },
  { title: "Group by meaning", text: "One card per question. Related controls sit together; unrelated groups are separated by space or a divider." },
  {
    title: "Follow conventions",
    text: "Logo goes home. Settings is a gear, alerts a bell, add a +. Calendar works like Google Calendar: Today, back, forward, Month / Week / Day.",
  },
  { title: "Same thing, same look", text: "A task looks the same on every screen. Dialogs close the same way and put their buttons in the same order." },
  {
    title: "Show the result, allow undo",
    text: "Every change gets a confirmation; anything that can be taken back offers Undo. Removing a calendar or everything asks first.",
  },
  { title: "Prevent mistakes", text: "Buttons that can't work yet are disabled and say why. Dates in the past are flagged before saving." },
  { title: "Recognise, don't recall", text: "The current view is always highlighted. Labels stay visible. Icons always come with a word or a tooltip." },
  { title: "Fit the hand", text: "On touch screens every control is at least 44px tall, and the main action is the biggest target." },
];

function Rules() {
  return (
    <>
      <GroupHeading
        id="rules"
        title="How screens use the library"
        lead="The rules every SmartScheduler screen follows. Each one was checked screen by screen."
      />
      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {RULES.map((r, i) => (
          <li key={r.title} className="border border-line-strong p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-bold tabular-nums">{i + 1}.</span>
              <span className="font-bold">{r.title}</span>
            </div>
            <p className="mt-1 text-[0.9375rem] text-muted leading-relaxed">{r.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex items-center gap-3 flex-wrap">
        <ButtonLink href="/app" variant="primary" size="lg" trailingIcon={ArrowRight}>
          Open SmartScheduler
        </ButtonLink>
        <ButtonLink href="/" size="lg">
          Back to the home page
        </ButtonLink>
      </div>
    </>
  );
}
