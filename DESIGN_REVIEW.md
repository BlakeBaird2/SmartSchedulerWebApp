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
| Wide screens (xl+) | Tools get their text labels, and the Goal tag appears. |

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
| Free time | A dashed green line down the left of the gap, with a green "Free · 6h 20m" label | Open time, the same line as on Plan. |

The legend under the calendar shows all three.

On phones, the Plan timeline's time column is narrower: "AM" and "PM" are set
small ("9:30AM"), and the gaps around the line are tighter, so the cards gain
about 16px of width.

## Before and after

The `Graces-branch` commit `b07e572` is the "before" for every screenshot comparison.
This branch is the "after". Good pairs to show:

1. Plan screen: blue on every plan note → blue only on Done.
2. Free gap: grey cards on a grey box → white cards on a dashed grey box.
3. Calendar filters: faded "off" pills → dashed "off" pills.
4. Add task dialog: Cancel / Add order and visible labels, compared with the Edit class dialog before (Save / Cancel, other way round).
5. Header: five loose buttons → two groups with a divider.
