# Low-Fidelity Prototype submission — SmartScheduler

**Team:** Blake Baird, Grace Farnsworth, Hannah Galindo

| | |
| --- | --- |
| **Public URL** | https://smartschedulerwebapp.vercel.app |
| **GitHub** | https://github.com/BlakeBaird2/SmartSchedulerWebApp |
| **Design library** | https://smartschedulerwebapp.vercel.app/design |

---

## Text for the submission box

Copy everything between the lines into the comments box. The public URL is already at the top.

---

**Public link:** https://smartschedulerwebapp.vercel.app (no login needed. Try it on a phone or a laptop.)

**What SmartScheduler is for.** Our discovery work narrowed many student frustrations about time and workload down to one problem: students lose their free time deciding what to work on instead of working on it. SmartScheduler's core feature answers that directly. It reads your class and personal calendars, finds the free gaps in your day, and fills each one with the unfinished work that is due soonest. The result is one clear answer to "what should I do with the next 45 minutes?"

**How the prototype puts that core feature first.**
- Every entry screen (home page, About, setup, and the Plan screen returning users land on) leads with the same sentence, largest on the page: *"See exactly what to work on in every free gap of your day."* Each has one blue button: the next step.
- The app opens on **Plan**, not a calendar. Its focal card is the single task to do right now, with one large **Done** button. Under it, "The rest of today" shows each free gap with its work already placed inside it.
- Our design library (`/design`) is built around the core loop. The free-gap block, task card, Done checkbox and class tag get the strongest outlines; everything else supports them.

**What we left out or kept small (tangential functions).**
- No accounts, sign-up, grades, chat, social or gamification.
- No calendar editing: SmartScheduler only reads calendars, because the decision is the problem, not data entry.
- Following Gall's Law, the AI time estimates from our project plan are not built yet. The prototype uses simple, editable estimates per kind of work.
- Secondary functions (Calendar, Upcoming, Classes, Settings) are one click away in labeled tabs, but visually quieter than the plan. Settings is split into small sub-pages, and the theme switch lives there instead of the toolbar.

**Goal and routes.** On first visit, one pop-up tells you in plain English that this is an early prototype and gives you a goal: *"You have 45 minutes between class and work. Find something productive to work on and mark it done."* You can reach it through Plan, Calendar (click a free gap or planned work), Upcoming, or Classes; Help lists all four. Setup can be skipped from any step (it loads sample data), and an optional four-step walkthrough is offered but never forced.

**Low fidelity and usability.** It is a deliberate wireframe: sketch font, greys, square outlines, wireframe drawings instead of pictures, and a Prototype tag in every header. We reviewed every screen once per principle (attention, grouping, conventions, consistency, signifiers, feedback and undo, error prevention, recognition over recall, touch targets) and logged each fix in `DESIGN_REVIEW.md`.

**Who owned what.** Grace Farnsworth: first impressions (low-fi look, early-stage notice, entry screens, five-second test). Blake Baird: design library and usability principles. Hannah Galindo: goal, non-linear flows, skippable onboarding, and these submission materials. All three worked through GitHub branches merged into `main`.

---

## Where the grader can see each rubric row

| Rubric row | Points | Where to look |
| --- | --- | --- |
| Instructions followed | 20 | Public link above; GitHub history with branches from all three (`Graces-branch`, `Blakes-branch`, `Hannah-branch`) merged into `main`; this note; [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md) lists **29** screens and states. |
| Low-fidelity look and early-stage notice | 20 | Any page in a private window: the welcome pop-up says "This is an early prototype" in plain words. Sketch font, greys, outlines and wireframe drawings everywhere, including the 404 page. The **Prototype** tag reopens the notice. |
| Entry screens signify overarching capability | 40 | `/`, `/about`, `/app` (setup) and `/app` (Plan) all lead with the capability sentence and one blue next step. Other top-level functions use labeled tabs and conventional icons (+, bell, gear, ?). Five-second test: [`FIVE_SECOND_TEST.md`](FIVE_SECOND_TEST.md). |
| Conventions, attention, grouping, usability | 40 | [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md): one section per principle, with each problem and fix. |
| Design library and component reuse | 40 | `/design` (every component live, with its rules, where it's used, and the discovery finding it serves); code in `src/components/ui`. |
| Fully functional, non-linear, goal-driven | 40 | Goal in the welcome pop-up; four routes on the Help screen; Skip at the top of every setup step; real planning from real calendar links (or sample data). |

---

## Before you press Submit

- [x] Pull request from `Blakes-branch` into `main` merged ([#3](https://github.com/BlakeBaird2/PrioritizedScheduleWebApp/pull/3)).
- [x] Deployed on Vercel from `main` at https://smartschedulerwebapp.vercel.app (home, `/app`, `/about` and `/design` all load).
- [x] URL pasted at the top of this file.
- [ ] Opened the public URL in a **private window** on a laptop: the welcome pop-up shows, Skip loads sample data, and a task can be marked Done from Plan and from Upcoming.
- [ ] Same check on a **phone**.
- [ ] Pasted the URL and the text above into the submission box.
