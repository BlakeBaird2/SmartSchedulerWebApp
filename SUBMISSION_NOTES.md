# Submission notes — SmartScheduler (Flows, Goal & Submission — Hannah)

Notes for Hannah’s assigned slice of the **professor’s Low-Fidelity Prototype rubric**
for **SmartScheduler** (fully functional / non-linear / goal-driven + instructions followed).
The full group assignment is worth ~200 points; A/B/C are **only our team’s internal
labels**, not official professor section titles.

Claims below are limited to code, Git history, and existing project docs. Items marked
`[TODO]` need a human fill-in. Do not invent research, commits, or deployment URLs.

## Before you submit — Hannah checklist

| # | Professor-facing requirement | Status in this repo |
| --- | --- | --- |
| 1 | Goal pop-up after prototype notice + way to reopen | **In code** — confirm in browser |
| 2 | ≥3 non-linear routes to the same user goal | **In code** — walk `/app#demo` |
| 3 | Skip on every onboarding step | **In code** — test steps 1–3 |
| 4 | No dead ends; controls work or give honest feedback | **In code** — spot-check Help/Settings/dialogs |
| 5 | 20–30 meaningful screens; new screens ≥2 entry points + way back | **28** in `SCREEN_INVENTORY.md` |
| 6 | Public deployment; incognito laptop + phone | **`[TODO: deploy + paste URL]`** |
| 7 | Genuine GitHub commits from all three + README ownership | **Commits exist** — see Team responsibilities; Grace name/ownership TODOs |
| 8 | Research-supported core feature + five-second evidence | **Recorded** — see below + `FIVE_SECOND_TEST.md` (2 participants; preliminary) |
| 9 | Tangential features minimized / honest about limits | Documented below |
| 10 | Commit remaining local fixes when Hannah approves | Uncommitted doc/code may still be local |

---

## Team responsibilities (full descriptions)

| Member | Responsibility | App areas |
| --- | --- | --- |
| **Grace** | **First Impressions** — low-fidelity look and early-stage notice; entry screens signify the overarching capability. Owns First Impressions research / five-second testing for the team. | Home `/`, `/about`, first screen of `/app`, overall look |
| **Blake Baird** | **Design System & Usability** — design library and component reuse; conventions, attention, grouping, and usability principles. | Shared UI (`src/components/ui`), Plan, Calendar, Upcoming, Classes; `/design`, `DESIGN_REVIEW.md` |
| **Hannah Galindo** | **Flows, Goal & Submission** — fully functional, non-linear, goal-driven; instructions followed. | Onboarding, Settings, dialogs, new screens (goal / Help / gap / why / completion), deployment, these notes |

### Git evidence (do not invent)

| Member | Identity in Git | Evidence | Uncertainty |
| --- | --- | --- | --- |
| Grace | `gracefarns` `<gmfarnz@byu.edu>` | Commits: `packages`, `modified package.json`, `fixed package.json` | Preferred display name `[TODO]`. Low-fi entry/prototype work also arrived via Graces-branch merges authored as Claude — `[TODO: Grace confirm personal ownership of visual/entry items]` |
| Blake Baird | `Blake Baird` `<blakebaird2@gmail.com>` | Multiple product commits (planner, classes, feeds, class times, LAN/dev, PR merges) | Later design-library / walkthrough commits on this branch authored as Claude, in Blake’s owned areas |
| Hannah Galindo | `Hannah Galindo` `<hannahgalindo013@gmail.com>` | `0f79fe0` *Complete goal flows and submission requirements* | Earlier agent-host baseline commit also under her name |

---

## Core design feature (research-supported)

**Core design feature:** A prioritized plan that finds free gaps between classes/events and fills them with unfinished work due soonest — so a student always has a concrete answer to “what should I work on in this free block?”

**User need:** Students juggle class calendars, personal busy time, and assignment due dates. They need to know **what productive work fits in the next free gap** and mark it done.

**Evidence already in the repo (product/design docs — not invented interviews):**

- `README.md` — gap-finding + soonest-deadline planning, Canvas feed trade-offs, local-only data.
- `DESIGN_REVIEW.md` — root user outcome: spend free time doing work, not figuring out what work to do.
- Live design catalog at `/design`.

**First Impressions research / five-second tests (Grace owns):** see [`FIVE_SECOND_TEST.md`](FIVE_SECOND_TEST.md).

| Finding | Detail |
| --- | --- |
| Purpose understood | Both participants (n=2) understood SmartScheduler’s main purpose after a five-second look at the entry screen. |
| Next step / learning | One was unsure where to go next; the other expected a short learning curve before it felt easy. |
| Implication | Entry screen communicates the core capability; the primary next step could be clearer for first-time users. |
| Design change from this test | **None implemented.** A more prominent primary action is noted as a *potential* improvement only. |
| Limits | Only two participants so far — preliminary, not representative of all users. |

Broader discovery interviews beyond this five-second test are not claimed here.

---

## User goal

**One sentence:** In a free stretch of time (for example, 45 minutes between class and work), find something productive to work on and mark it done.

The app supports that by surfacing free gaps, ranking unfinished work by soonest deadline, opening task details (including “Why this task?”), and marking Done with shared local `done` state across Plan, Calendar, Upcoming, and Classes.

---

## Multiple routes

Three working paths to the same goal:

1. **Plan → free gap → task → Done**  
   Plan “right now” / day schedule → open a free gap → pick planned work → review (optional Why) → Mark done → completion panel.

2. **Calendar → free gap or planned work → task → Done**  
   Calendar week or day → free-gap band or planned-work block → review → Mark done.

3. **Upcoming or Classes → task → Done**  
   Upcoming list **or** a Classes column → open a task → review → Mark done.

Shared completion is in browser workspace storage (localStorage key `prio:ws` — legacy key prefix; product name is SmartScheduler). Full UI walkthroughs (including public URL incognito) remain **manual** for the team unless recorded separately.

---

## Tangential features minimized

| Feature | Representation | Why simplified |
| --- | --- | --- |
| Accounts / cloud sync | None — localStorage; optional `#setup=` link | Course prototype; no server accounts |
| Canvas submission status | Manual Done ticks | Feeds cannot report hand-ins (README) |
| Calendar fetch failures | Banner + last good snapshot; honest toasts | Depends on user links / network |
| Multi-device setup | Clipboard / prompt of `#setup=` URL | Client-only |
| Illustrations | Wire sketches / placeholders | Low-fidelity (First Impressions) |
| Extra discovery interviews | Not claimed beyond the two five-second participants | Honest scope; see `FIVE_SECOND_TEST.md` |
| Deep links per app view | Client view state on `/app` | Existing architecture |

---

## Screen inventory

See [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md): **28** meaningful screens/states, with two entry points and a return path for each newly added destination owned in Hannah’s flows (goal notice, free-gap detail, why-this-task, completion, Help, Settings sub-pages).

---

## Public URL (deployment)

- **Provider:** Vercel (primary; see README). Docker also supported.
- **Env vars:** none.
- **Public URL:** `[TODO: paste after you verify deploy — do not invent one]`

### Exact deploy steps (when Hannah approves)

1. Commit any approved local fixes, then ensure `Hannah-branch` is on GitHub (`git push -u origin HEAD` if needed).
2. Open https://vercel.com/new → import `BlakeBaird2/PrioritizedScheduleWebApp` (or your fork).
3. Framework: Next.js · Build: `npm run build` · **Env vars: leave empty**.
4. If asked for a production branch, select `Hannah-branch` (or merge into the branch Vercel tracks).
5. Deploy → open the `.vercel.app` URL with **no login**.
6. Incognito on **laptop** and **phone**: `/` then `/app#demo` — prototype → goal → Skip or sample data → complete a task on two routes.
7. Paste the verified URL here and into README **Public URL**.

---

## Checks (commands)

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```
