/**
 * The home page: what SmartScheduler does, how it works, and where to find each calendar
 * link. It renders on the server so it shows up at once; only the link guide's
 * tabs and the Prototype tag run in the browser. Anyone who already has calendars
 * set up skips it (see the root layout) and goes straight to the app at /app.
 *
 * The same page is served at /about (`variant="about"`) for people who already use
 * SmartScheduler, where the main button opens the app instead of starting setup.
 *
 * This is a low-fidelity prototype: illustrations are grey placeholders, and each
 * screen has one primary (accent) button, with every other action drawn quieter.
 */
import Link from "next/link";
import { ArrowRight, Bell, Check, CircleAlert, CircleHelp, Link as LinkIcon, Workflow, GraduationCap, Lock, Plus, RefreshCw, SlidersHorizontal, Sparkles, Target } from "lucide-react";
import { LinkGuide } from "./LinkGuide";
import { CapabilityHero, PrototypeBadge } from "./Prototype";
import { DaySketch, LinkSketch, PlanSketch } from "./LandingSketches";
import { ButtonLink, Wordmark } from "./ui";

const WRAP = "max-w-6xl mx-auto px-4 sm:px-6";

export type LandingVariant = "home" | "about";

export function Landing({ variant = "home" }: { variant?: LandingVariant }) {
  return (
    <div data-landing className="flex min-h-dvh flex-col">
      <Nav />
      <main className="flex-1">
        <Hero variant={variant} />
        <WorksWith />
        <HowItWorks />
        <Features />
        <GetYourLinks />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

/** A full page load rather than next/link, so the app sees #demo as it starts. */
function SampleLink({ className, children = "Try it with sample data" }: { className: string; children?: React.ReactNode }) {
  return (
    <a href="/app#demo" className={className} data-smart-event="sample_data_started">
      <Sparkles size={16} />
      {children}
    </a>
  );
}

/** Opens the app. Only the hero's copy is `primary`; repeats further down are quieter. */
function StartLink({ children = "Start planning", primary = false }: { children?: React.ReactNode; primary?: boolean }) {
  return (
    <ButtonLink href="/app" variant={primary ? "primary" : "secondary"} size="lg" trailingIcon={ArrowRight}>
      {children}
    </ButtonLink>
  );
}

function SectionIntro({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{lead}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className={`${WRAP} flex h-14 items-center gap-3 sm:gap-6`}>
        <a href="#top" className="shrink-0" aria-label="SmartScheduler, back to top">
          <Wordmark collapse />
        </a>
        <PrototypeBadge />
        <nav aria-label="On this page" className="hidden items-center gap-1 text-[0.95rem] text-muted lg:flex">
          {[
            { href: "#how-it-works", label: "How it works", icon: Workflow },
            { href: "#links", label: "Get your links", icon: LinkIcon },
            { href: "#faq", label: "FAQ", icon: CircleHelp },
          ].map((l) => (
            <a key={l.href} href={l.href} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-fg">
              <l.icon size={16} aria-hidden />
              {l.label}
            </a>
          ))}
        </nav>
        {/* Quiet on purpose: the hero holds this screen's one primary button. */}
        <ButtonLink href="/app" className="ml-auto shrink-0">
          <span className="sm:hidden">Open app</span>
          <span className="hidden sm:inline">Open SmartScheduler</span>
        </ButtonLink>
      </div>
    </header>
  );
}

function Hero({ variant }: { variant: LandingVariant }) {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate scroll-mt-14">
      <div aria-hidden className="landing-glow absolute inset-x-0 top-0 -z-10 h-[44rem]" />
      <div className={`${WRAP} pt-12 text-center sm:pt-16 lg:pt-20`}>
        {/* The overarching capability comes first and is the biggest thing on the page. */}
        <CapabilityHero id="hero-title" size="page" className="mx-auto max-w-5xl">
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty sm:text-xl">
            SmartScheduler puts your classes and assignments from Canvas, your work schedule and your plans from Google, Outlook or Apple on one calendar. Then it fills each
            free gap with whatever&apos;s due soonest.
          </p>
        </CapabilityHero>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {variant === "about" ? <StartLink primary>Open SmartScheduler</StartLink> : <StartLink primary>Start planning</StartLink>}
          <SampleLink className="btn btn-lg" />
        </div>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base text-muted">
          {["Free", "No account or sign-up", "Saved only in your browser"].map((point) => (
            <li key={point} className="inline-flex items-center gap-1.5">
              <Check size={15} strokeWidth={2.5} />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${WRAP} mt-12 pb-16 sm:pb-20`}>
        <PlanSketch />
      </div>
    </section>
  );
}

const APPS = ["Canvas", "Learning Suite", "Google Calendar", "Outlook", "Apple Calendar"];

function WorksWith() {
  return (
    <section aria-label="Works with" className="border-y border-line bg-surface">
      <div className={`${WRAP} flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6`}>
        <span className="text-sm text-muted">Works with</span>
        {APPS.map((name) => (
          <span key={name} className="rounded-full border border-line bg-surface-2 px-3 py-0.5 text-sm font-medium text-fg">
            {name}
          </span>
        ))}
        <span className="text-sm text-muted">and any iCal link</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-14 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionIntro
          id="how-title"
          eyebrow="How it works"
          title="Paste your links. SmartScheduler does the rest."
          lead="Setting up takes a couple of minutes. After that, your plan keeps itself up to date."
        />
        <ol className="mt-12 grid gap-5 sm:mt-16 md:grid-cols-3">
          <Step n={1} title="Add your calendar links" art={<LinkSketch />}>
            Paste a private link from Canvas, Learning Suite, Google, Outlook or Apple. School calendars bring in your classes and assignments. Work and
            personal calendars tell SmartScheduler when you&apos;re busy.
          </Step>
          <Step n={2} title="SmartScheduler finds your free time" art={<DaySketch filled={false} />}>
            Classes, work and other plans are blocked out, with a little breathing room around each. What&apos;s left inside the hours you choose is your free
            time.
          </Step>
          <Step n={3} title="Each gap gets what's due soonest" art={<DaySketch filled />}>
            Free time fills with the most urgent work that fits. Big projects are split across gaps, and exams get study time before them.
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({ n, title, art, children }: { n: number; title: string; art: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="card flex flex-col overflow-hidden">
      <div className="border-b border-line">{art}</div>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-white text-sm font-semibold tabular-nums">{n}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Target,
    title: "What to do right now",
    text: "Open SmartScheduler and the first thing you see is the one task to work on now, with a Done button.",
  },
  {
    icon: CircleAlert,
    title: "Warnings while there's still time",
    text: "If something won't fit before it's due, SmartScheduler tells you early, while you can still make room for it.",
  },
  {
    icon: Bell,
    title: "Changes flagged",
    text: "When a due date moves or new work appears on a class calendar, the bell tells you exactly what changed.",
  },
  {
    icon: RefreshCw,
    title: "Always up to date",
    text: "Calendar links are live. SmartScheduler re-reads them whenever you open it, and every 30 minutes while it's open.",
  },
  {
    icon: GraduationCap,
    title: "Study time for exams",
    text: "Exams on your class calendar get study time planned before them, the same as any other work.",
  },
  {
    icon: SlidersHorizontal,
    title: "Your day, your rules",
    text: "Pick your working hours, a daily limit and whether weekends count. Add anything a calendar doesn't know about.",
  },
];

function Features() {
  return (
    <section aria-labelledby="features-title" className="border-y border-line bg-surface py-20 sm:py-28">
      <div className={WRAP}>
        <SectionIntro
          id="features-title"
          eyebrow="Why SmartScheduler"
          title="Always know what to work on next"
          lead="No more checking three apps to work out when you'll get anything done. SmartScheduler keeps one plan, and keeps it current."
        />
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <f.icon size={19} />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function GetYourLinks() {
  return (
    <section id="links" aria-labelledby="links-title" className="scroll-mt-14 py-20 sm:py-28">
      <div className={WRAP}>
        <SectionIntro
          id="links-title"
          eyebrow="Get started"
          title="Where to find your calendar links"
          lead="Every calendar app can share a private link to your calendar, usually called iCal, ICS or webcal. Copy one from each app you use and paste them into SmartScheduler. They stay up to date on their own."
        />
        <div className="mt-10 sm:mt-12">
          <LinkGuide />
        </div>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <StartLink>Paste your links into SmartScheduler</StartLink>
          <SampleLink className="btn btn-lg">No links handy? Try sample data</SampleLink>
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          <Lock size={13} className="mr-1.5 inline -translate-y-px" />
          Your links stay private, saved only in your browser.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const FAQ = [
  {
    q: "Is SmartScheduler free? Do I need an account?",
    a: "It's free, and there's no account or sign-up. Open it, paste your calendar links and you have a plan.",
  },
  {
    q: "Where is my information kept?",
    a: "In your browser. Your calendar links, classes, done marks and settings are saved on your device. When a calendar is refreshed, the server reads it, hands it straight back and keeps nothing.",
  },
  {
    q: "Can SmartScheduler tell when I've turned something in?",
    a: "No. Calendar links say when work is due, not whether you've handed it in, so you tick things off as you finish them. When you first add a school calendar, anything already past due is marked done for you.",
  },
  {
    q: "My class calendar doesn't say when class meets. Is that a problem?",
    a: "Most don't, so SmartScheduler asks. Add each class's days and times once during setup, and SmartScheduler shows them on your calendar and plans around them.",
  },
  {
    q: "What if my job isn't on any calendar?",
    a: "Add your work schedule as a weekly busy time during setup, the same way you'd add practice or a commute. SmartScheduler plans around them like anything else.",
  },
  {
    q: "How does SmartScheduler decide what comes first?",
    a: "Whatever's due soonest goes first. If the most urgent thing is too long for a short gap, the next thing that fits goes there instead, so short gaps still get used. You can change how long anything takes and the plan updates.",
  },
  {
    q: "Can I use it on my phone and my laptop?",
    a: "Yes. In Settings, copy your setup link and open it on the other device. Your calendars, classes and choices come across.",
  },
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-14 border-t border-line py-20 sm:py-28">
      <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16`}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">FAQ</p>
          <h2 id="faq-title" className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Questions, answered
          </h2>
          <div className="card mt-8 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Lock size={16} />
              Private by design
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              No account and no database. Your calendar links and everything you set up stay in your browser, and you can remove them all at any time.
            </p>
          </div>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus size={18} className="shrink-0 text-muted group-open:rotate-45" />
              </summary>
              <p className="pr-8 pb-5 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="pb-20 sm:pb-28">
      <div className={WRAP}>
        <div className="relative isolate overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-md)] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="landing-glow absolute inset-0 -z-10" />
          <h2 id="closing-title" className="mx-auto max-w-2xl text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            Stop juggling calendars. Start knowing what&apos;s next.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted text-pretty">
            Paste your first calendar link and see your week planned in a couple of minutes.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <StartLink />
            <SampleLink className="btn btn-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${WRAP} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <Wordmark />
          <p className="mt-1 text-sm text-muted">One calendar for school, work and life, with a plan for every gap. An early prototype.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <a href="#how-it-works" className="hover:text-fg">
            How it works
          </a>
          <a href="#links" className="hover:text-fg">
            Get your links
          </a>
          <a href="#faq" className="hover:text-fg">
            FAQ
          </a>
          <Link href="/design" className="hover:text-fg">
            Design library
          </Link>
          <Link href="/app" className="hover:text-fg">
            Open SmartScheduler
          </Link>
        </nav>
      </div>
    </footer>
  );
}
