# Design review: Part B (design library and usability principles)

This covers two rubric rows: **Design library and component reuse** and
**Conventions, attention, grouping, and usability principles**. We checked every screen
once for each principle, as the assignment suggests. The table under each principle
lists what we found and what we changed.

Screens checked: Home, About, Onboarding (3 steps), Plan, Calendar (month / week / day),
Upcoming, Classes, Settings, task details, event details, Add task, Edit class,
Class times, Alerts, Import, Prototype notice, Design library.

## Design library

**What it is:** `src/components/ui`. A small set of React components styled with
Tailwind CSS and Lucide icons, drawn as a low-fidelity wireframe. Every part is shown
live at **`/design`**, with when to use it, its rules, why it exists, and which
screens use it. The page is linked from Settings → About and from the home page footer.

**Root user outcome it serves:** students spend their free time doing work, not
figuring out what work to do. The core parts are FreeGapBlock, TaskCard, Checkbox
and ClassChip. They carry that job and get the strongest outlines. Every other part
supports them.

| Component | Replaced | Used in |
| --- | --- | --- |
| `Button`, `ButtonLink`, `TextButton` | About 60 hand-styled buttons and links, each with its own size, icon size and spacing | Every screen |
| `Dialog`, `DialogActions` | 6 separate pop-ups, each with its own backdrop, Esc handling and button order | Add task, Edit class, Class times, Import, Prototype notice, task/event details (side panel) |
| `TaskCard` | 4 different task rows (`TaskRow`, `WorkRow`, `DueItem`, `ClassItem`) | Plan, Due this week, Upcoming, Classes |
| `FreeGapBlock` | One-off markup in the Plan screen | Plan |
| `Checkbox` | Inline-styled round tick box | Every task |
| `ClassChip` | 5 different ways of showing a class code | Plan, Upcoming, task details, Classes |
| `Card`, `CardHeader`, `SectionLabel` | Repeated `card p-4 …` markup and settings' own section box | Plan, Settings, Onboarding |
| `Callout` | 3 hand-built banners | Plan (class times), sample data, calendar errors |
| `EmptyState` | 3 different empty messages, one with no next step | Upcoming, Classes, Alerts |
| `SegmentedControl` | 4 hand-built "pick one" rows | Header (desktop and phone), calendar range, plan day picker, theme |
| `Field`, `ChoicePill`, `Switch` | Labels styled differently in each form | Add task, Edit class, Settings |
| `Toast` | A plain message with no Undo | Every screen |
| `Tour` (walkthrough) | (new) | First visit; Settings; `/design` example |
| `Wordmark` | The logo typed out in 5 places | Every header |

## Principle by principle

### 1. Guide attention (one focal point per screen)

| Screen | Problem | Fix |
| --- | --- | --- |
| Plan | Blue was used for the Done button **and** for every "Planned today 3:25 PM" note, so the eye didn't know where to land. | Blue is now only on the main action. Plan notes are grey with a clock icon. |
| Plan | The "what to work on now" card looked like every other card. | It now has a heavy 2px ink outline and extra padding. It's the only card that does. |
| Classes, Settings, details | Links and "Add class times" were blue, competing with real primary buttons. | Changed to underlined text links (`TextButton`). |
| Calendar | Today was marked differently in month and week view. | The same filled blue square in both. It's the one accent on that screen. |
| Every screen | Status dots, switches and ticks used the accent. | Changed to ink or grey. The accent is kept for "do this next". |

### 2. Grouping (Gestalt)

| Principle | Where | What we did |
| --- | --- | --- |
| Common region | Plan | One card per question: what now / rest of today / due this week. A free gap is a dashed box that contains the tasks planned into it. |
| Figure and ground | Plan, Classes | Task cards are white on the grey of a free gap or column, so they stand out. |
| Proximity | Header | The tools on the right were 5 buttons in a row. Now there are two groups: "keep calendars current" (status + refresh) and "things you open" (Add task, Alerts, Settings), with a divider between. |
| Proximity | Settings | 9 sections in one long column became 3 titled groups: *What SmartScheduler reads*, *How your time is planned*, *This browser*. |
| Similarity | Everywhere | Each class keeps one grey shade and one code everywhere it appears. All tasks share one card. |

### 3. Conventions (external)

| Convention | Where |
| --- | --- |
| Logo goes home | Every header |
| Gear = settings, bell = alerts, + = add | Header. Each has a text label or tooltip too. |
| Calendar controls in the Google / Outlook order: **Today**, back, forward, then Month / Week / Day | Calendar |
| Square checkboxes for "done" | Every task (was round) |
| Esc, the X, and clicking outside close pop-ups | Every dialog, via `Dialog` |
| Links are underlined | `TextButton`, all inline actions |
| Notification count badge on the bell | Alerts |
| Theme switch belongs in Settings, not the main toolbar | Moved from the header to Settings → Appearance |

### 4. Consistency (internal)

| Problem | Fix |
| --- | --- |
| Dialog buttons were in a different order in every dialog (Save, Cancel / Cancel, Add / full-width Done). | `DialogActions`: the way out first, the main action last, both bottom-right. Reset or remove goes far left. |
| The same idea had different words: "item", "work", "task". | "Task" everywhere a person reads it. A glossary is on `/design`. |
| "Alerts" button opened a panel titled "What changed in your classes". | The panel is titled "Alerts". |
| Finishing a task looked different in the details panel (small tick only) than on Plan (big Done button). | The details panel now has the same blue "Mark as done" button. |
| Icon buttons had different sizes and some had no name. | One `Button` with a required `label` for icon-only buttons. |

### 5. Signifiers and affordances

| Problem | Fix |
| --- | --- |
| Filter pills that were "off" faded to 45% opacity and looked disabled. | Off = dashed outline. On = shaded, bold, ink outline. Nothing that works looks disabled. |
| The "Done hidden" filter always reported itself as pressed. | It's now a real on/off: "Show finished work", pressed when on. |
| Unselected time choices ("30m", "1h") looked disabled for the same reason. | Fixed by the same pill change. |
| Edit and remove icons in class times were bare, faint icons. | Quiet buttons with an outline on hover and a spoken name. |
| The "3 ev" label on calendar days was jargon. | "3 events". |

### 6. Feedback and recovery (undo)

| Action | Before | After |
| --- | --- | --- |
| Mark a task done | Nothing but the list changing | "Done: *task*" with **Undo** |
| Add a task | "Added to your plan" | Same, with **Undo** |
| Delete your own task | Gone immediately | "Deleted: *task*" with **Undo** |
| Remove a weekly busy time or class time | Gone immediately | Message with **Undo** |
| Refresh | Icon spins | Icon spins, and the "Synced just now" status is announced. Also a "Refresh now" button in Settings, since the header hides refresh on phones. |
| Copy setup link | "Copied" | "Copied to clipboard" |

### 7. Error prevention

- **Add task** stays disabled until the task has a name, and says why on hover. A due time that has already passed is flagged before saving.
- **Continue** in onboarding says "Add a calendar first" while it is disabled.
- Removing a calendar or **Remove everything** still asks first. The last one now also says "This can't be undone".
- Opening someone's setup link can't be dismissed by a stray click outside the dialog. You have to choose *Keep what's here* or *Import*.

### 8. Recognition over recall

- The current view is shaded, outlined and underlined, and marked `aria-current` for screen readers.
- Every form field has a visible label. Placeholders are only examples.
- Every icon has a word next to it or a tooltip.

### 9. Accessibility and touch (Fitts's law)

- On touch screens every button, tab and pill is at least 44px tall, and tick boxes are 28px.
- The Done button is the biggest target on the Plan screen.
- Dialogs keep keyboard focus inside while open and return it when closed.
- Warnings use an icon, bold text or a heavy outline, never colour alone.

### 10. Learnability (first visit)

- **One welcome pop-up, not a chain.** The prototype notice and the goal share one
  pop-up, so a first visit opens a single dialog instead of three in a row. It
  states plainly that this is an early prototype, then gives the goal in a boxed
  section. Inside the app its buttons are **Show me around** (optional walkthrough)
  and **Start**.
- **Walkthrough, only on request.** A four-step walkthrough in a pop-up covers what to do now, the rest of today, what's
  due, and where everything else is. Each step has a small wireframe drawing and a
  sentence or two. It's built on the shared `Dialog`, so it closes the same way as every
  other pop-up and never follows the page around. It always shows "Step 2 of 4" with
  dots, has Back, Next and arrow keys, keeps "Skip" visible, and the last button says
  what happens next ("Show my plan"). It never runs by itself. Settings →
  **Show the walkthrough** replays it, and so does the development shortcut menu.
- **Home page drawings.** The crossed-out image boxes are replaced by wireframe drawings
  of the real app, built from the same library parts. The biggest picture on the entry
  screen now shows the capability itself: a free gap with tasks planned into it. The
  drawings use ink, not blue, so the page keeps one blue button ("Start planning").

### 11. Fits without scrolling

| Problem | Fix |
| --- | --- |
| The plan's day picker ("Today, Tomorrow, Wed 14 …") scrolled sideways, so later days were hidden. | All seven days share one row: a short weekday on top and the date below, like a phone calendar's week strip. Screen readers hear the full date. |

### 12. The header fits every screen

| Width | Layout |
| --- | --- |
| Phones | Name, Prototype tag, Add task, Alerts, Settings. Help is reached from Settings and from the welcome pop-up. The main views sit on a second full-width row. |
| Tablets and small laptops | Refresh and Help join the first row as icons. The views stay on the second row. |
| Laptops (lg+) | The views move up beside the name, all on one row. |
| Wide screens (xl+) | Tools get their text labels. (The separate Goal tag was later removed: the Prototype tag opens the same pop-up, which holds the goal.) |

Icon-only tools always have their name as a tooltip and for screen readers. The
"Synced just now" status moved into the refresh button's name, so it no longer
wraps onto three lines.

### 13. Calendar free time is background

Free time on the week and day calendar was drawn as solid grey blocks with bold
labels, so an empty Saturday looked like the busiest thing on the screen. Free
time is now a faint dashed outline with a quiet label that darkens on hover. Events
and planned work stay what the eye reads first, and the gaps can still be clicked.

### 14. More fidelity, clearer hierarchy (professor feedback)

After reviewing the live prototype, our professor said low fidelity was good at
directing people down a path, but new users needed more fidelity and a clearer
hierarchy, because the screens carry a lot of information and everything read
at the same level. He also suggested icons in the menus. Changes:

| Problem | Fix |
| --- | --- |
| Everything was the same flat outline, so nothing stood out from anything else. | Layers of depth: an off-white page, white cards with a soft shadow above it, the focal "work on now" card with a stronger shadow and a heavier outline, and dialogs above everything. |
| One sketch font at a few sizes. | Inter, with a real scale: page title → card title → task title → details. |
| Screens other than Plan had no title, so it wasn't clear where you were. | Every main screen opens with a page header: an icon tile, the screen's name (same icon as its tab) and one line on what it's for. Settings sub-pages show a "‹ Settings" breadcrumb. |
| Classes were shades of grey, so they were hard to tell apart. | Each class has its real colour again, as a soft wash on its tasks and on its tags, the same on every screen. |
| Colour carried no meaning. | Blue = the main action, the current tab and today. Green = free time and finished work. Red = late or won't fit, always with an icon or words. |
| Menus were words only. | Icons on the main tabs (larger, blue when selected), on every Settings section, on the Help routes, on card headings, and on the home page links. |
| The logo was just text. | A small calendar-check mark next to the name. On phones only the mark shows, so the header tools still fit. |

The early-stage notice is unchanged in purpose. It now says "Some things are
placeholders, and nothing is saved to an account" instead of "It looks simple on
purpose."

### 15. Full-colour look from the design handoff

The design handoff left one open question: restore the full-colour Prio look or
evolve the wireframe. We restored it, with the same screens, words and behaviour,
and applied the handoff's rules:

| Handoff rule | What changed |
| --- | --- |
| Full-colour Prio tokens | Warm off-white page (#f6f5f1), white cards, warm greys, indigo accent (#4f46e5; #8b85ff in dark mode), and green, amber and red only for free/done, soon and late. |
| Inter with its stylistic sets | Inter Variable with `cv11`, `ss01` and tabular figures. |
| Rounded shapes and one soft shadow | Cards 14px, task cards 12px, buttons, inputs and events 10px, pills fully round. A single soft shadow lifts cards off the page; the focal card and dialogs go one step deeper. |
| Class colour always visible, **no coloured stripe down the left edge** (the owner's request) | Task cards are washed in their class colour with a hairline in the same hue. Events are soft tinted blocks. Class tags, dots and filter pills use the class colour. |
| One heavy-outlined card per screen | The "work on now" card has a 2px indigo outline instead of a coloured left bar. |
| Kind-of-work chips | Exam red, Quiz amber, Project teal, Reading sky, Assignment grey. Each still has its icon and word. |
| Wordmark "SmartScheduler." with an accent full stop | Used in every header. On phones the header shows the small calendar mark so the tools still fit. |
| Off pills never look disabled | Off is a dashed round outline with muted text. On is filled and bold. |
| Dashed means "not fixed" | Free gaps, planned work on the calendar, off pills and the Prototype tag are dashed. |

Blue stays the one main action per screen. The chosen tab is now a raised white
option with dark text, so only its icon is indigo.

### 16. Free time on the timeline, not in a box

Free gaps on Plan were green dashed boxes with the planned tasks nested inside.
It was clear, but each gap shrank its tasks into a box, which was cramped on
phones. Now "The rest of today" reads like a phone calendar's agenda:

| Before | After |
| --- | --- |
| A box around each free gap, with tasks inside it | No box. The time column marks the gap: its start time at the top and its end time at the bottom, joined by a dashed green line. "Free · 1h 50m" sits beside the start. |
| Tasks narrowed by the box's border and padding | Tasks use the full width of the card. |
| Events had no marker on the timeline | Every row has a marker: a dot in the class colour for events, a small grey dot for deadlines, and an open green circle at each end of a free gap. |

The dashed line keeps the meaning of "dashed = open time, not fixed" (Gestalt
continuity and common fate: everything beside the line belongs to that
stretch of time). The new library part is `TimelineRow`, used on Plan, in the
home page drawings and on `/design`.

### 17. Planned work on the calendar, without dashed outlines

Planned work on the week and day calendar had a dashed outline in its class
colour. It was clearly different from events, but a column of dashed boxes
looked busy. Now the difference is carried by **fill and a familiar signifier**:

| Kind | Look | Means |
| --- | --- | --- |
| Event or class | Solid tint of its class colour | Fixed. It happens whether you like it or not. |
| Planned work | White card with a thin outline in its class colour, a small shadow and a **tick box** before the title (ticked and green when done) | A task you planned, which can move. The tick box is the same "to-do" mark as on Plan. |
| Free time | Plain open space with a quiet "Free · 6h 20m" label, tinted green on hover | Open time. Nothing drawn around it, so it stays background. |

The legend under the calendar shows all three.

**One task tile everywhere.** The same white tile with a class-coloured outline
is used for every task: Plan (the free-gap timeline and Due this week),
Upcoming, Classes and the calendar. Solid colour is only ever a fixed event, so
"white tile = a task of yours, solid = fixed" holds on every screen.

On phones, the Plan timeline's time column is narrower: "AM" and "PM" are set
small ("9:30AM"), and the gaps around the line are tighter, so the cards gain
about 16px of width.

### 18. Settings: sections always in view (web)

Settings was a hub of five cards; opening one replaced the page, and getting to
another section meant going back first. On a computer it now works like most
web apps' settings:

| Before | After (768px and wider) |
| --- | --- |
| A list of five sections; opening one hid the others | The five sections stay in a sidebar on the left the whole time. The open one is highlighted (indigo icon, tinted row, `aria-current`). |
| A "‹ Settings" back link to switch sections | One click on another section. Its name, what it covers and its settings fill the right side. |
| Opening Settings showed only the list | The first section, Calendars & class times, opens straight away. |
| Open Help and Reopen goal above the list | Quiet links under the sidebar. |

Phones keep the list-then-page flow for now; the phone layout is being
redesigned separately.

### 19. A roomier calendar

The week view felt crammed: an hour was 48px tall, days were about 140px wide,
and blocks touched each other. Changes:

| Problem | Fix |
| --- | --- |
| Half-hour blocks only fit a cut-off title | Each hour is 64px, so a 30-minute block shows its title and time. |
| Blocks touched their neighbours | 2px of space above and below each block and 3px at the sides, with a little more padding inside. |
| Long titles cut off with "…" | Tall blocks let the title wrap to two lines. Text is a step larger (12px titles, 11px details). |
| "Free · 1h 30m" peeked out from under planned work | The label sits in the first open stretch of the gap, or is left out if there isn't room. |

### 20. Less text, less noise

- **No Goal tag in the header.** It opened the same pop-up as the Prototype tag
  (the pop-up holds both the notice and the goal), so it only took up space.
  The goal is still one click away from the Prototype tag, Help and Settings.
- **No "Free · 6h 20m" labels on the calendar.** Open space already reads as
  free time; the label repeated it in every column. Free time is still clickable
  and opens the free-gap details, and its length is in the tooltip and spoken
  name.
- **No green tint on hover over free time.** It flashed colour across big empty
  areas whenever the pointer crossed the calendar.

### 21. Rename a class anywhere it's listed

Calendars don't always name classes well (Learning Suite sends "Principles of
Finance" with no course code). Renaming existed but was hard to find: a small
pencil on the Classes board, and an inline box in Settings that only changed the
short name. Now one rename form, with **Short name** (shown everywhere, like
FIN 201) and **Full name**, is offered wherever a class is listed:

| Where | How |
| --- | --- |
| Setup, step 1, right after a calendar is added | Click a class chip ("Name not right? Click a class to rename it.") |
| Settings → Calendars | The same class chips under each calendar |
| Class times (setup step 2, Settings, the Class times pop-up) | A "Rename" button beside each class |
| Classes board | An "Edit" button (was an unlabelled pencil) for name, colour and hiding |

A rename is confirmed with a message, sticks when the calendar refreshes, and
"Use the calendar's name" undoes it. Saving a name or colour no longer wipes a
class's corrected meeting times.

### 22. The header never moves

The header now sits in exactly the same place on every screen:

- It is always the same width (72rem). The calendar's extra width on big monitors
  was dropped, because it widened the header too and the logo and tools jumped
  when switching to Calendar.
- The page always keeps room for the scrollbar (`scrollbar-gutter: stable`).
  Before, a short page (Settings, Help) had no scrollbar and a long one (Plan)
  did, which nudged the centred header sideways by the scrollbar's width.

Checked at 1024, 1280 and 1536px: the logo and the Settings button are at the
same position on Plan, Calendar, Upcoming, Classes, Settings and Help.

### 23. A tighter focus card and a big Add task on Plan

The "work on now" card was tall and left a wide empty strip on its right. It
keeps the same information, rearranged so it reads in three lines:

| Before | After |
| --- | --- |
| Status on one line, its detail on the next | One line: "● Class until 3:15 PM · Next free time 3:25 – 10 PM" |
| "Why this task?" and "See this free gap" on their own line under the task | On the footer line, at the right, beside "Then *next task* · 1h" |
| Extra-large padding | Normal card padding; the focus still comes from the indigo outline and Done |

**Add a task** is now a large tile at the top of the right column, level with
the focus card (right under the focus card on phones and tablets). It's white
with an indigo icon, not a blue button, so Done stays the one primary action on
the screen (attention); its size makes it an easy target (Fitts's law).

### 24. Phones: navigation moves to the bottom

On phones the main views were a second row under the header, at the top of the
screen and out of thumb reach. Phones (under 768px) now follow the mobile
convention:

| Before | After (phones) |
| --- | --- |
| Views in a row under the header | A floating, rounded bar at the bottom: Plan, Calendar, Upcoming, Classes. The open view is a raised, tinted pill with an indigo icon. Each tab keeps a short label (icons are always named). |
| Add task as a small + in the header | Its own round button beside the bar, always in reach of a thumb (Fitts's law). |
| Header: name, Prototype tag, +, Alerts, Settings, plus the views row | One slim row: the mark, the Prototype tag, Alerts and Settings. More of the screen is content. |

The bar respects the iPhone home indicator (safe area), the "Done" message and
the dev menu sit above it, and pop-ups and side sheets cover it. While Settings
or Help is open no tab is highlighted, since neither is one of the four views.
Tablets and computers keep the top navigation.

### 25. A real phone layout

Every screen was checked at 390px and reworked for a phone (under 768px).
Computers and tablets are unchanged.

**Calendar, modelled on Google Calendar's app**

| Before | After (phones) |
| --- | --- |
| A seven-day grid squeezed to the screen, scrolling sideways | Four phone views: **Schedule** (the default), Day, 3 days and Month |
| Toolbar wrapped over three lines | The month on the left, Today and ‹ › on the right, the views in one row underneath |
| — | **Schedule**: two weeks as one list, the date in a narrow column (today in an indigo circle) and that day's events, planned work and deadlines stacked in time order. Empty days are skipped. |
| Month cells with cut-off titles ("Rea…") | A small coloured bar per thing due (its class colour). Tapping a day lists its events and work under the month. |
| Legend and time zone under every view | Hidden on phones |
| Class filters wrapped onto three rows | One row that scrolls sideways, edge to edge; "Show finished work" becomes "Finished" |

**Every screen**

- Page headers are smaller and drop the explainer line; the tab bar already says where you are.
- The sample-data notice is one slim line ("Sample data. Nothing here is real." · Use mine).
- Plan's capability sentence is smaller (still the biggest text on the screen) and shows only the date under it.
- Upcoming: rows keep to two lines (the kind of work and "in 3 days" move into the details), and the day headings stick under the slimmer header. Add task is the round + button.
- Classes: a stack of cards, one per class, each showing its next three tasks, instead of a board that scrolled sideways.
- Settings: each calendar's name gets the full first line, with School / Personal and Remove under it; class codes no longer wrap.
- Setup: the link box takes the full width with Add calendar under it.

**Slide between views.** The whole bottom bar is one control: touch it anywhere
and the highlighted pill glides to your finger, slide and it follows, and letting
go opens the tab it's on. A quick tap is the same gesture, so tapping a tab works
as before; keyboards still use Tab and Enter.

**Square header tools.** On touch screens the header's icon buttons (Alerts,
Settings) are 44 × 44 squares, not 36-wide rectangles.

### 26. Professor feedback round 2: focus, one fewer screen, planned vs due

Feedback from our professor's review, plus our own, and what changed. Everything
below is on the `focused-plan-redesign` branch.

**A more focused Plan page.** "Due this week" repeated most of "The rest of
today", so it is gone. Plan now answers three questions in order:

| Question | Where |
| --- | --- |
| What do I work on right now? | The "Work on now" card (unchanged, still the one blue Done button) |
| Am I on track today? | **Today's goal**: a green ring that fills as today's planned tasks are ticked off ("2 of 6 done · 4h left"), turns into a check when the day's plan is done, and warns if anything won't fit before it's due |
| How does the rest of my day look? | The timeline, ending with "See everything that's due →" (Upcoming) |

On computers today's goal and a big Add a task sit in a slim column that stays in
view; on phones the goal sits right under the focus card. Work that was already
past due when a calendar was added is marked done automatically, but never counts
toward today's goal.

**A visual for goals.** Besides today's ring, the welcome pop-up's goal now shows
as three steps with icons (find your free time → open the task → mark it done).

**Classes folded into Upcoming.** Upcoming filtered to one class showed the same
work as the Classes board, so the Classes tab is gone (three tabs: Plan, Calendar,
Upcoming). The class filter is now **class tabs**: "All classes" or one class,
like tabs, each with a count of what's left. Picking a class shows its summary
(when it meets, progress, Open in Canvas, Edit class). Hidden classes are listed
under the work with a one-tap "show again". A saved "Classes" view opens Upcoming.

**Planned vs due, strongly different.** One language everywhere:

| | Look | Where |
| --- | --- | --- |
| Planned (when you'll work on it) | Green chip with a clock: "Planned today 3:25 PM". On the calendar: white tile with a tick box | Upcoming, task details, calendar |
| Due (the deadline) | Amber chip with a flag: "Due tomorrow 9:30 AM"; red when late ("6h late"). On timelines and calendars: amber flag chips and an amber diamond marker | Plan, Upcoming, calendar (all views), task details |

Task details label them "Due (the deadline)" and "Planned (when you'll work on
it)", and the calendar legend explains both.

**The home page picture reads as a picture.** It looked clickable. It is now a
browser window turned three-quarters in 3D, with a "Preview" tag and the caption
"A picture of the Plan screen", and it shows the new Plan page.

**A way back from sample data.** Opening `/` with sample data no longer jumps
into the app, and the sample-data banner has **Back to home page** (a home icon on
phones). Settings → About has **Home page** too.

**Smart events for user testing.** The important actions (task completed, task
added, Add task opened, calendar added, setup finished, sample data started,
task / free gap / "why" opened, class picked, goal reached, screen changed) are
announced three ways: `?event=task-completed` in the address (a success URL for
UXtweak or Maze), a push to `window.dataLayer` (Google Tag Manager, Hotjar), and
a `smartscheduler:event` DOM event. Their buttons carry `data-smart-event`. Each
screen also has its own address (`/app?view=calendar`), so the browser Back button
works. Settings → About shows the session's events for facilitators.

Not done: tying in an audience beyond college students (our professor called it
optional).

### 27. Calendar and to-do redesign, after the best-regarded planners

We studied the calendar and to-do apps people hold up as the cleanest: **Sunsama**
and **Akiflow** (a task list beside the calendar, dragged into the day),
**Notion Calendar** (a quiet grid, a mini month, the time right now in a red
pill), **Things 3** (big date numbers, "when" kept apart from "deadline") and
**Todoist** (a week strip at the top of Upcoming). Everything below is on the
`calendar-planner-redesign` branch.

| Idea | Borrowed from | What we built |
| --- | --- | --- |
| Plan by dragging | Sunsama, Akiflow | Drag a task from the To do list onto a time and it's planned there. SmartScheduler replans everything else around it. Drag a planned block to move it, or back onto the list to hand it back. Each move can be undone. |
| A to-do list beside the calendar | Sunsama, Akiflow, Amie | A To do column on the calendar, grouped by due day ("Due today", "Due Thu"), each task showing when it's planned or "Won't fit". |
| Mini month | Notion Calendar, Google Calendar | A small month above the list. The open week is shaded, today is circled, and an amber dot marks days with something due. |
| Quiet grid, big dates | Notion Calendar | Lighter hour lines, the weekday over a large date, today in an accent circle with a faint wash down its column, weekends slightly shaded, past events faded. |
| The time right now | Notion Calendar | The red now-line gains a red pill with the time in the hour column. |
| Deadlines in their own row | Akiflow, Google Calendar | A labelled **Due** row (amber flag) under the day headers, apart from **All day** events, so a deadline never looks like time on the grid. |
| Your choice vs ours | Things 3 ("when" vs "deadline") | A time you picked carries a pin, on the calendar block, in the To do list and on the green Planned chip. Task details say "You picked this time" and offer **Let SmartScheduler choose**. |
| Pick a time without dragging | Things 3's When picker | **Pick a time** in task details (a day and a start time) does the same as dragging, for phones and keyboards. |
| Week at a glance | Todoist Upcoming | A seven-day strip at the top of Upcoming with amber dots for what's due; tap a day to jump to it. Day headings lead with the date as a big number. |
| More room | Notion Calendar | The sidebar can be hidden (and stays hidden) to give the week the full width. |

Planned stays green and Due stays amber everywhere, and planned blocks keep their
white tile with a class-coloured outline. Phones keep the Google Calendar-style
views; they plan with **Pick a time**.

Also fixed: starting sample data from `/app#demo` changed the address bar while the
page was still drawing, which React flagged as an error. The smart-event address
update now waits until drawing is done.

### 28. One to-do list beside the calendar, from user interviews

Branch `redesign/sidebar-planner`, built on 27, from the team's user interviews.
The left column is what the interviews asked for; the sync with class calendars
is unchanged, and this is all about planning.

| Asked for | What we built | Principle |
| --- | --- | --- |
| Choosing when work happens | The calendar shows only classes, events and time you scheduled. Free gaps stay empty, and while you place work they light up with how much time they hold. | User control; guide attention |
| One list of school and personal work | One to-do list of synced and personal work, "All tasks" or "School only", by due date or by length. Scheduled work leaves it, so the next thing to plan moves up and says **Next up**. | Recognition over recall; grouping |
| An editable time estimate on each task | "~1.5 hrs" on every task, one tap to change. Stored with who set it, so a suggested estimate can sit beside yours later. | Recognition over recall |
| Colour by due date | Red (due now, or late) through yellow (a week or more out), in the list and on scheduled blocks, always with the words ("due tomorrow"). | Pre-attentive colour, never colour alone |
| Drag and drop on phones too | Pointer events for mouse, pen and touch. On touch, press and hold to pick something up, so a swipe still scrolls; resizing starts straight away from the bottom edge. Below desktop size the list is a sheet that gets out of the way while you drag, and switches the agenda to a day with times so there's somewhere to drop. | Fitts's law; conventions (iOS and Android long-press) |
| Easy to fill an empty gap with the next item | A free gap lists what fits next on the list, with **Put it here**. A task's details have **Schedule it**. A focused block moves with the arrow keys, Shift changes its length, and Delete takes it off. | Accessibility; flexibility |
| A satisfying completion | The box pops, the tick draws itself, the row turns green and folds away. Done work stays on the calendar, faded and ticked. Reduced-motion settings get a plain tick. | Feedback; delight |
| Class priority as a tiebreaker | **Class priority** in Settings decides which class's work comes first when things are due at the same time. | User control |
| A New badge on unseen assignments | **New** on work a class calendar added, until it's opened or acted on, with a count and **Mark seen** in the list header. | Visibility of system status |
| A morning question about unfinished work | The first open each day asks whether to put yesterday's unfinished work back on the list (Yes / No). Settings can switch this to "put it back at midnight" or "keep it on my list". | User control; error recovery |
| Custom event colours, like Google Calendar | Recolour any event (a class, a shift) from its details, with Google Calendar's eleven colours. The colour covers every time it repeats. | External consistency |

Every change to the calendar can be undone from the message that confirms it.
Messages let taps through (except Undo) and fade during a drag, so they never
hide a drop spot.

## Before and after

The `Graces-branch` commit `b07e572` is the "before" for every screenshot comparison.
This branch is the "after". Good pairs to show:

1. Plan screen: blue on every plan note → blue only on Done.
2. Free gap: grey cards on a grey box → white cards on a dashed grey box.
3. Calendar filters: faded "off" pills → dashed "off" pills.
4. Add task dialog: Cancel / Add order and visible labels, compared with the Edit class dialog before (Save / Cancel, other way round).
5. Header: five loose buttons → two groups with a divider.
