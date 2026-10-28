# Screen inventory — SmartScheduler (Flows, Goal & Submission)

Meaningful screens / distinct user-facing states in **SmartScheduler** that support the core goal (find productive work in free time and mark it done). Count: **32**.

For each **new** destination added for this rubric, two entry points and a return path are listed.

| # | Screen / state | Entry points | Return / close |
| --- | --- | --- | --- |
| 1 | Home `/` | Direct URL; wordmark from onboarding | N/A (marketing) |
| 2 | About `/about` | Direct URL; Settings → About → Home page | Browser Back / links to `/app` |
| 3 | Design library `/design` | Direct URL; Settings → About | Browser Back |
| 4 | Welcome dialog: prototype notice + goal | First visit, any page (auto); **Prototype** tag; Help; Settings → About | Start / Got it / Esc / backdrop |
| 5 | Walkthrough (4 steps) | **Show me around** in the welcome dialog; Settings → About → Show the walkthrough | Skip / Show my plan / Esc |
| 6 | Onboarding step 1 — calendars | `/app` when setup incomplete | Skip / Continue / sample data |
| 7 | Onboarding step 2 — class times | Continue from step 1 | Skip / Back / Continue |
| 8 | Onboarding step 3 — hours | Continue from step 1/2 | Skip / Back / Build my plan |
| 9 | Plan (work on now, today's goal, the rest of today) | Header tab; wordmark; Help routes; `/app?view=plan` | Tabs; Back to home page (sample data) |
| 10 | Plan — empty / no-fit free time | Plan when nothing fits | Stay on Plan / Upcoming |
| 11 | **Free-gap detail panel** *(new; now lists the next to-do items that fit, each with **Put it here**)* | Plan “Open gap”; Calendar free-gap band; Focus “See this free gap” | Close / Back to Plan / Upcoming |
| 12 | Calendar month | Header → Calendar → Month | Day click / tabs |
| 13 | Calendar week *(with the to-do list and mini month on computers; drag a task onto a free time to schedule it, then move or resize it)* | Header → Calendar → Week | Tabs |
| 14 | Calendar day | Month day click; Week day header | Tabs |
| 15 | Upcoming, all classes | Header tab; Plan “See everything that's due”; Help; `/app?view=upcoming` | Tabs |
| 16 | Upcoming empty / caught-up | Upcoming with no open work | Add task / tabs |
| 17 | Upcoming, one class (class summary) *(replaces the Classes board)* | Upcoming class tabs; Calendar class tabs | “All classes” tab / tap the class again |
| 18 | Hidden classes row | Upcoming, after hiding a class | Tap a hidden class to show it again |
| 19 | Class edit dialog | Upcoming class summary → Edit class | Close / Cancel / Save |
| 20 | Task detail panel | Plan / Calendar / Upcoming / gap | Close / Esc |
| 21 | **Why this task? panel** *(new)* | Task detail; Focus card; Gap detail | Back to task / Help / Close |
| 22 | **Task completed success panel** *(new)* | Mark done from Focus / gap / task detail | Back to Plan / Upcoming / Open task / Close |
| 23 | Event / class-meeting detail | Calendar / Plan events | Close |
| 24 | Add task dialog | Header +; Upcoming | Cancel / Close / Add |
| 25 | Class times dialog | Plan tip; event detail | Close |
| 26 | Import setup dialog | `#setup=` URL when calendars exist | Cancel / Confirm |
| 27 | **Help** *(new)* | Header Help; Settings hub / About | Back to Plan; Settings; route Open buttons |
| 28 | **Settings hub + sub-pages** *(new structure)* | Header Settings; Help → Settings | All settings / tabs |
| 29 | Page not found (404) | Any mistyped or old address | Open SmartScheduler / Home page buttons |
| 30 | **To-do sheet (phones and tablets)** *(new)* | Calendar on a phone or tablet (always along the bottom); tap it to open the list | Tap the handle / hold a task (it slides away while you drag) |
| 31 | **Unfinished work question** *(new)* | First open of a day after scheduled work went unfinished | Yes / No / Close (asks again next time) / Change this in Settings |
| 32 | **Settings → Class priority** *(new)* | Settings sections list; Settings hub on phones | Other sections / tabs |

Each main screen also has its own address (`/app?view=plan`, `calendar`, `upcoming`, `settings`, `help`), so the browser Back button moves between them. Change alerts, sync error banner, and sample-data banner are additional operational states counted inside the above flows rather than as separate “screens.”

## New screens — reachability checklist

| New screen | Entry 1 | Entry 2 | Return |
| --- | --- | --- | --- |
| Welcome (goal) | First visit, any page | Prototype tag / Help / Settings → About | Start / Got it |
| Free-gap detail | Plan Open gap | Calendar free band (also Focus → See this free gap) | Close / Back to Plan |
| Why this task? | Task detail button | Gap detail / Focus card | Back to task / Close |
| Completed success | Plan Focus **Done**; free-gap panel **Done** | Task detail **Mark as done** (also Calendar→task→Done) | Back to Plan / Upcoming / Open this task / Close |
| Help | Header **Help** | Settings hub **Open Help** and Settings → About | Back to Plan / Settings |
| Settings sub-pages | Settings hub section cards | Help → Open calendar settings / Settings button | **All settings** back button |
| To-do sheet | Calendar on a phone (closed bar says what's next) | Calendar on a tablet | Close the list (handle) |
| Unfinished work question | First open of the day | Reopening the app after closing it without answering | Yes / No / Close |
| Class priority | Settings → Class priority | Settings hub (phones) → Class priority | Other sections |
