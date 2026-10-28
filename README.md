# SmartScheduler.

Your classes, your job and the rest of your life on one calendar, and a plan for
exactly what to work on in every free gap.

Paste in calendar links from Canvas, Learning Suite, Google, Outlook or Apple.
SmartScheduler finds your classes and assignments on its own, works out when you are free,
and fills that time with the work that is due soonest.

No accounts, no database, no API keys, no environment variables. Anyone can open
it and start.

> **Submitting the Low-Fidelity Prototype?** The paste-ready submission text and a rubric checklist are in [`SUBMISSION.md`](SUBMISSION.md).

## Pages

- **`/`** — the home page for newcomers: what SmartScheduler does, how the plan is made,
  and where to find the calendar link in each app (Canvas, Learning Suite,
  Google, Outlook, Apple, scheduling apps), grouped by school, work and personal.
  It is rendered on the server, so it shows up at once and search engines can
  read it. Anyone who already has calendars in their browser skips it and goes
  straight to their plan.
- **`/about`** — the same home page, for people who already use SmartScheduler. It never
  skips ahead to the app; Settings → **About SmartScheduler** links to it.
- **`/design`** — the design library: every component the screens are built
  from, drawn live, with when to use it and why it exists. Code in
  [`src/components/ui`](src/components/ui); the screen-by-screen usability review
  is in [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md).
- **`/app`** — SmartScheduler itself. `/app#demo` opens it with sample data, unless that
  browser already has calendars of its own.

## What it does

- **Plan** — the home screen, built to answer three questions at a glance:
  *what should I work on right now* (one task, with a Done button), *what does
  the rest of my day look like* (your events, and each stretch of free time
  with the work planned into it), and *what's due this week* (each item says
  when it's planned, or that it won't fit in time).
- **Calendar and to-do list** — month, week and day, with your classes, work and
  personal events, and the free time between them left open for you to fill.
  Beside it (a sheet along the bottom on phones and tablets) is **one to-do
  list** of everything still to schedule: synced assignments and your own tasks,
  "All tasks" or "School only", sorted by due date or by how long things take.
  - Each task shows about how long it needs ("~1.5 hrs"); tap to change it.
    Estimates record who set them, ready for suggested estimates later.
  - Tasks and blocks are coloured by how soon they're due, red through yellow.
  - **Drag a task onto a free time** to schedule it, as long as its estimate.
    Drag blocks to move them, drag their bottom edge to change their length, or
    drag them back onto the list. On a phone, press and hold first. A free gap
    also lists what fits next, with **Put it here**, and a task's details have
    **Schedule it**.
  - Scheduled work leaves the list, so the next thing to plan moves up.
  - Ticking a task off plays a short animation and takes it off the list; it
    stays on the calendar, marked done.
  - **New** marks work a class calendar added since you last looked.
  - **Class priority** (Settings) breaks ties between work due at the same time.
  - **Work you didn't finish:** each morning SmartScheduler asks whether to put
    yesterday's unfinished work back on the list. Settings can switch this to
    "put it back at midnight" or "keep it on my list".
  - **Recolour any event** (a class, a shift at work) from its details, using
    Google Calendar's colours. The colour covers every time it repeats.
- **Upcoming** — everything due, by day, with where it sits in the plan.
- **Classes** — every class side by side in one board, like the days of the
  week view: when it meets, how much is left, and its work in due order.
  Classes are created automatically from your calendars; rename, recolour or
  hide any of them.
- **Class times** — class calendars list what's due, rarely when class is. Add
  each class's days and times once (during setup, in Settings, or from the
  prompt on the Plan screen) and they show on your calendar in the class's
  colour and block that time in the plan. Classes whose calendar already has
  meetings say so. Click any class on the calendar to change its time (a wrong
  time from Canvas is replaced by yours, and you can switch back), or to mark a
  single day off, like a holiday.
- **Change alerts** — each refresh is compared with the last. When a due date
  moves, or work is added or removed, the bell says so. Click to jump to it.
- **Your own tasks** — add work no calendar knows about with the + button.

## How the plan is made

Two steps, kept simple on purpose so you can always tell why it says what it says.

1. **Find the gaps.** Each day has working hours (8 AM–10 PM by default).
   Everything busy on your calendars, plus any weekly busy times you add, is cut
   out, class times included, with a little breathing room either side (10
   minutes by default). What's
   left, if it's at least 20 minutes long, is free time.
2. **Fill them, soonest deadline first.** Going through the gaps in order, each
   gets the most urgent unfinished work that fits. If the most urgent thing is
   too long for a short gap, the next thing that fits goes there instead, so
   short gaps still get used. Longer work is split across gaps in pieces of at
   least 25 minutes; quizzes are never split. Nothing is scheduled after its
   own due time, and there's a daily limit (4 hours by default) that only work
   due within a day can go past.

Every kind of work has a starting estimate (reading 30m, assignment 1h,
project 2h, exam 3h of study). Open any item to change how long it needs, which
is also how you tell SmartScheduler you are part-way through. Exams on a class calendar
automatically get a "Study for …" task before them.

The code is in [`src/lib/planner.ts`](src/lib/planner.ts), with tests in
[`src/lib/__tests__/planner.test.ts`](src/lib/__tests__/planner.test.ts).

The **Plan** screen uses this plan. The **Calendar** shows only the time you
scheduled yourself, and the planner treats it as busy. Work you scheduled is
planned where you put it; work whose time has passed is planned again.

**Scheduled time** is stored shaped like a Google Calendar event (`start`,
`end`, `title`, `color`, `externalId`), so a later two-way sync can map it
across. See `ScheduledBlock` in [`src/lib/types.ts`](src/lib/types.ts).

## Adding calendars

Every calendar app can give you a private link to a calendar (called iCal, ICS or
webcal). SmartScheduler reads that link, so it always sees the latest version.

| Where | How to get the link | Notes |
| --- | --- | --- |
| **Canvas** | Calendar → **Calendar Feed** (bottom of the right-hand column) | One link covers every class. Each assignment links back to Canvas. |
| **Learning Suite** | A course's Schedule → its calendar (iCal) link | One link per class. |
| **Google Calendar** | Settings → pick the calendar → Integrate calendar → **Secret address in iCal format** | School and work Google accounts sometimes have this switched off by an administrator. |
| **Outlook** | Outlook on the web → Settings → Calendar → Shared calendars → **Publish a calendar** → copy the ICS link | "Can view when I'm busy" is enough if you'd rather not share titles. |
| **Apple (iCloud)** | Calendar sharing → turn on **Public Calendar** → copy the link | Anyone with this link can read the calendar, so keep it to yourself. |
| **Anything else** | Any iCal, ICS or webcal link | Work rosters, sports schedules, clubs. |

Each calendar is either **School** (its entries become classes and assignments)
or **Personal** (its entries only mark you as busy and never turn into homework).
SmartScheduler picks one when you add a link and you can switch it at any time.

**Staying up to date.** These links are live. SmartScheduler re-reads every calendar when
you open it, when you come back to the tab, and every 30 minutes while it's open.
Google and Apple reflect changes within minutes; Outlook can take a few hours to
republish.

**If a link won't add,** the message says why and what to copy instead. The
common one: Google's "public address" only works for calendars shared with
everyone, so use the "Secret address in iCal format". Canvas can also label a
class with an unhelpful code like "All Sections"; SmartScheduler looks for the real code in
section names, and you can tap any class under its calendar to rename it.

**What a calendar link can't tell SmartScheduler.** Feeds say when work is due, not whether
you handed it in. When you first add a school calendar, anything already past due
is assumed done (you can untick it). After that, tick things off as you finish
them.

## Your data

- Calendar links, classes, done marks and settings are stored **in your browser**
  (localStorage). There are no accounts and no database.
- The server has one job: fetch a calendar link you send it, turn it into
  classes, work and busy time, and send that back. It stores nothing and logs
  nothing about the calendar.
- **Using more than one device:** Settings → *Copy setup link*. Opening that link
  on your phone or laptop brings your calendars, classes and choices across. The
  setup travels in the part of the URL after `#`, which browsers never send to a
  server. It contains your private calendar links, so only send it to yourself.

Because the server fetches any link it's given, it refuses links that point at
private or internal network addresses, checks every redirect, and caps the size
and time of each download (see [`src/lib/server/fetchFeed.ts`](src/lib/server/fetchFeed.ts)).

## Why not the Canvas API?

Canvas's API needs either a personal access token or a developer key issued by
each school. Canvas's API policy doesn't allow an app used by many people to ask
them for personal tokens, and developer keys have to be approved school by
school. The Canvas **Calendar Feed** needs neither and works at every school, so
SmartScheduler uses that. The trade-off is that SmartScheduler can't see whether something was
submitted, which is why you tick things off yourself.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (the app itself is at /app)
npm test           # parser, planner, workspace and timeline tests
npm run lint
```

No configuration is needed. Pick **Try it with sample data** on the home page to
see it working without any calendars.

## Testing the entry states (prototype)

SmartScheduler is currently styled as a **low-fidelity prototype**: greys and one accent
colour, a sketch font, square outlined boxes, and wireframe drawings of the app (`src/components/LandingSketches.tsx`) in place of pictures.
Every entry screen leads with the same sentence — *"See exactly what to work on
in every free gap of your day."* — and has one primary (accent) button. The
wireframe rules are at the end of `src/app/globals.css`; the shared pieces
(`PrototypeNotice`, `PrototypeBadge`, `CapabilityHero`, `WirePlaceholder`) are in
`src/components/Prototype.tsx`.

What the browser stores decides which state you see (all in localStorage).
Keys keep a legacy `prio:` prefix for compatibility; the product name is **SmartScheduler**.

| Key | Meaning |
| --- | --- |
| `prio:prototype-notice`, `prio:goal-notice` | Set when the welcome pop-up (prototype notice + goal) is closed. Missing = it shows on the next page load. |
| `prio:tour` | Set when the walkthrough is finished or skipped. It only runs when asked for (Show me around, Settings, or `/app#tour`). |
| `prio:ws` | Calendars and choices, including scheduled time, estimates, class priority, event colours and what happens to unfinished work. Calendars here + finished setup = returning user. |
| `prio:new` | Work a class calendar added since you last looked (task id → when it showed up). |
| `prio:ui` | Includes `setupDone`, current view, and settings sub-panel. |

**Quickest way:** run `npm run dev`. A small **Dev: entry states** box sits in the
bottom-left corner with one-click shortcuts to each state below. It only exists
in development (`NODE_ENV=development`) and is not in production builds.

**By hand** (works in any build; a private/incognito window is a clean first visit):

| State | How to reach it | What to check |
| --- | --- | --- |
| First visit: welcome pop-up | New private window → `/` (or `/about`, `/app`, `/app#demo`) | One pop-up says it is an early prototype and gives the 45-minute goal. In the app it offers **Show me around** (the walkthrough) and **Start**. It doesn't return on refresh; the **Prototype** tag, **Goal** tag (wide screens) and Help reopen it. |
| Home `/` | Private window → `/` | Capability sentence is the biggest thing; **Start planning** is the only accent button. |
| About `/about` | `/about` (never redirects) | Same, with **Open SmartScheduler** as the primary button. |
| New user `/app` | Private window → `/app` | Onboarding: capability first; **Skip** on every step enters a usable Plan (sample data if no calendars yet). |
| Sample data `/app#demo` | Private window → `/app#demo` | Plan screen with the capability above the "Sample data" note; **Done** is primary. |
| Returning user `/app` | After the demo (or real calendars), open `/app` again, or `/` (redirects to `/app`) | Plan screen, capability first, **Done** primary; goal/prototype do not auto-interrupt. |

**Goal routes (same outcome: mark productive work done):**

1. **Plan** → open a free gap → choose a task → review / Why this task? → **Done**
2. **Calendar** → drag the next task from the to-do list onto a free time (or open a free gap → **Put it here**) → tick it off
3. **Upcoming** or **Classes** → open a task → review → **Done**

Help (header) lists these routes. See [`SUBMISSION_NOTES.md`](SUBMISSION_NOTES.md) and [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md).

To start over without a private window, run this in the browser console, then
reload: `Object.keys(localStorage).filter(k => k.startsWith("prio:")).forEach(k => localStorage.removeItem(k))`.
Settings → Start over → **Remove everything** clears calendars and settings but keeps the theme and
the prototype-notice dismissal.

See [`FIVE_SECOND_TEST.md`](FIVE_SECOND_TEST.md) for five-second test results (preliminary; two participants).

`npm run dev` accepts links whose site resolves to a private network address
(common on campus Wi-Fi and VPNs). A production build refuses them unless started
with `FEED_ALLOW_PRIVATE_HOSTS=1`, which is only for testing on your own machine.
Never set it on a public deployment.

## Team contributions

Team responsibilities below map to the **professor’s Low-Fidelity Prototype rubric**
(the full ~200-point group assignment). Labels like “A / B / C” are only our
internal shorthand — not official professor section titles.

| Team member | Git identity (from history) | Responsibility (rubric + app areas) | Git evidence |
| --- | --- | --- | --- |
| **Grace Farnsworth** | `gracefarns` / `gmfarnz@byu.edu` | **First Impressions** — low-fidelity look and early-stage (prototype) notice; entry screens signify the overarching capability. App areas: home `/`, `/about`, first screen of `/app`, overall look. Also owns First Impressions research / five-second testing for the team. | Genuine commits under `gracefarns`: `packages`, `modified package.json`, `fixed package.json`. Her low-fidelity look and entry-screen work was built with an AI coding agent on `Graces-branch`, so those commits are authored as Claude. |
| **Blake Baird** | `Blake Baird` / `blakebaird2@gmail.com` | **Design System & Usability** — design library and component reuse; conventions, attention, grouping, and usability principles. App areas: shared components (`src/components/ui`), Plan, Calendar, Upcoming, Classes. See also [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md) and `/design`. | Multiple genuine commits under Blake Baird (e.g. planner/classes/feeds, class times, Wi‑Fi/dev server, PR merges). Later design-library / walkthrough commits on this branch are authored as Claude — still part of Blake’s owned product areas. |
| **Hannah Galindo** | `Hannah Galindo` / `hannahgalindo013@gmail.com` | **Flows, Goal & Submission** — fully functional, non-linear, goal-driven flows; instructions followed. App areas: onboarding, Settings, dialogs, new screens (goal notice, Help, free-gap / why / completion), deployment, and submission documentation (`SUBMISSION_NOTES.md`, `SCREEN_INVENTORY.md`). | Genuine commit under Hannah Galindo: `0f79fe0` *Complete goal flows and submission requirements*. An earlier agent-host baseline commit also appears under her name — graders should weigh the product commit. |

See [`SUBMISSION_NOTES.md`](SUBMISSION_NOTES.md) and [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md).
First Impressions five-second results are in [`FIVE_SECOND_TEST.md`](FIVE_SECOND_TEST.md) (preliminary; no design change claimed from that test alone).

## Deploy it (free)

**Vercel (primary):** push `main` to GitHub, then at [vercel.com/new](https://vercel.com/new)
import the repo and Deploy. Framework preset: Next.js. Build command:
`npm run build`. There are **no** environment variables. After deploy, open the
public URL in an **incognito** window on a phone and a laptop (no login).

Step-by-step checklist (including where to paste the URL): [`SUBMISSION_NOTES.md`](SUBMISSION_NOTES.md).

**Public URL:** https://smartschedulerwebapp.vercel.app

**Docker:**

```bash
docker build -t smartscheduler .
docker run -p 3000:3000 smartscheduler
```

## Project layout

```
src/app/page.tsx            the home page (src/components/Landing*.tsx, LinkGuide.tsx)
src/app/app/page.tsx        the app
src/app/api/feed/route.ts   the only server endpoint: read one calendar link
src/lib/feeds/              link checks, provider detection, the iCal parser, sample data
src/lib/server/fetchFeed.ts safe fetching of user-supplied links
src/lib/planner.ts          finding gaps and filling them
src/lib/model.ts            merging calendars and your choices into classes, work and events
src/lib/workspace.ts        what the browser stores, checked on the way back in
src/lib/sync.ts             refreshing every calendar
src/lib/changes.ts          spotting moved, added and removed work
src/lib/timeline.ts         a day in order, and "what now"
src/lib/todos.ts            the to-do list: what's on it, its order and its colours
src/lib/blocks.ts           scheduled time: snapping, moving and resizing
src/lib/newWork.ts          work that's new since you last looked
src/lib/eventColors.ts      Google Calendar's event colours, and which events share one
src/components/             the interface
```
