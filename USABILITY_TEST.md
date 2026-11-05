# Unmoderated usability test

One link for participants: **https://smartschedulerwebapp.vercel.app/study**
Results for the team: **https://smartschedulerwebapp.vercel.app/study/results**

Participants do the whole test alone in about 10 minutes. It records their
browser tab and their voice (with permission), times each task, asks the survey,
and saves everything as they go. The team exports a CSV and cuts a video clip on
the results page.

## What a participant goes through

| Step | Time | What happens |
| --- | --- | --- |
| 1. Welcome | ~1 min | Who we are, what they'll do, how long it takes. "We're testing the app, not you." Apprenticeship: "You're the expert; teach us." Asks for brutal honesty and says it's an early prototype (fidelity). Explains exactly what's recorded. Consent checkbox (18+). Phones are asked to switch to a computer. |
| 2. About you | ~1.5 min | Full-time student? Number of classes, job/commitment hours, which tools they use. Two 1–7 ratings, each with an open question: "When I have free time… I know exactly what to work on" (+ how do you usually decide?) and "My plans are spread across too many places" (+ what stresses or frustrates you most?). |
| 3. Think aloud + recording | ~1 min | Explains thinking aloud with a written example, then a practice line while a mic meter shows "We can hear you". Then **Share this tab** (Chrome/Edge offer the current tab, one click). Can continue without recording. |
| 4. Scenario | ~30 s | The same imaginary context for everyone: a full-time student with four classes and a part-time job whose calendars are already connected (sample data). How tasks work. |
| 5. Four tasks | ~5 min | The real app opens under a task bar, on fresh sample data kept apart from the participant's own (a `study:` storage prefix; no account sync). Each task: read the goal → **Start task** → do it while thinking aloud (reminder every task) → **I'm done** or **I'm stuck**. Then the paired questions (below). |
| 6. Survey | ~2–3 min | Three short pages: A vs B outcomes, core features, overall. |
| 7. Done | | Recording stops and finishes uploading; they get a completion code. If the upload failed, they can download the recording to send it to you. |

### Tasks (goal-driven, matched A/B)

| # | Goal (A: done in Schedule Smart) | B: the same goal with their next-best alternative (recalled) | App detects success |
| --- | --- | --- | --- |
| 1 | You have free time later today: decide which assignment to work on first and set time aside for it. | Deciding what to work on first and setting time aside | `task_planned` |
| 2 | A friend invites you to a movie Friday night: find what's due before the weekend and whether you'll have time. (Typed answer.) | Finding everything due before the weekend | Typed answer |
| 3 | You finished the assignment from task 1: mark it done. | Keeping track of finished work | `task_completed` |
| 4 | A study group meets tomorrow 7–8 PM: add it so your plans work around it. | Adding a commitment and replanning around it | `event_added` |

**A/B design.** A = Schedule Smart. B = the participant's own next-best alternative
(Google Calendar, Canvas, a planner, or nothing at all), recalled for the *same* goal.
After each task: "This task was easy to do in Schedule Smart" (1–7) + why, and
"Doing that with my current tools is easy" (1–7) + "what would you do, step by
step?". **Order is counterbalanced**: each participant is randomly A-first (do the
task, then recall B) or B-first (recall B, then do the task); the CSV's `order`
column says which. The survey then rates the same statements for A and B side by side.

### Survey questions

Every rating is 1–7, 1 = Strongly disagree, 7 = Strongly agree, and every rating
is paired with an open-ended question. A/B items ("compare") are rated twice on the
same screen: Schedule Smart and what I use now.

**Before the tasks** (persona + baseline): full-time student, number of classes,
job/commitment hours, tools used; *I know exactly what to work on in free time* +
how do you decide; *my plans are spread across too many places* + what frustrates you most.

**After the tasks**
1. *Clarity and ease*: purpose was clear from the beginning (A); interactions clear and understandable (A/B); finding what I'm looking for is easy (A/B) → what most affected your sense of purpose, ease or clarity; enjoyable (A/B) + what would make it more enjoyable.
2. *Planning your week* (the target outcomes, all A/B + why): useful for planning and getting schoolwork done in free time; organized and in control of my week; clear what to work on in free time; easy to see when I have free time.
3. *Overall*: would intend to use a fully functional version, compared to current tools (A/B) + biggest reasons; Schedule Smart would make my day-to-day life more organized than now + why; one thing to change or add; anything else (optional).

**Persona fit** (`matches_persona`): a current student, with a job/commitment or 2+
tools, who either doesn't agree they know what to work on (≤ 4) or agrees their plans
are spread across too many places (≥ 5).

All wording lives in that one file. Change it there and the study page, results page and CSV follow.

## Set up (once, ~10 minutes)

Results are stored in the same Firebase project as sign-in ([`FIREBASE_SETUP.md`](FIREBASE_SETUP.md)).
Without Firebase the study still runs, but saves only in the browser that took it
("trial mode"), which is fine for a pilot on your own computer.

1. Do steps 1–7 of [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) if they aren't done yet (the four `NEXT_PUBLIC_FIREBASE_*` keys in Vercel).
2. **Authentication → Sign-in method → Add new provider → Anonymous → Enable.** Participants sign in anonymously so each can write only their own session.
3. **Firestore → Rules**: paste the whole of [`firestore.rules`](firestore.rules) again and **Publish** (it now includes `studySessions` and `researchers`).
4. **Firestore → Data → Start collection** `researchers`. Add one document per team member whose **Document ID is their Google email** (e.g. `you@gmail.com`) with any field (e.g. `name: "Grace"`). Only these accounts can read results.
5. Redeploy on Vercel, then do a full pilot run yourself at `/study` and check it appears at `/study/results`.

Storage: a 10-minute session records ~15–25 MB, saved in pieces under 1 MB to
Firestore. 30+ sessions fit within Firestore's free 1 GiB; delete pilot sessions
afterwards if space gets tight.

## Running it

- Send participants just the `/study` link. Ask them to use a **laptop or desktop with Chrome or Edge** (Firefox works; Safari can't share a single tab).
- Recruit people who fit the persona: college students juggling classes plus a job or other commitments. You need **30 representative users**; the results page counts those whose screener answers match (`Match the persona`).
- Ask each person for their completion code if you're tracking who took part.

## Results page (`/study/results`)

- **Sign in with Google** (an account listed in `researchers`).
- Counts of started, completed and persona-matching sessions (goal 30).
- **Export CSV**: one row per participant, with every answer, each task's outcome, whether the app saw it succeed, seconds, clicks, typed answer, A and B ease ratings with reasons, and where each task starts in the video (`tN_video_at`).
- A summary of task success and time, and the mean A vs B for every paired measure.
- **Open** a session to read their answers and watch the recording, with **Task 1–4** buttons that jump to each task.
- **Cut a clip**: set start and end (or "Use current time" while watching) → **Save clip** plays that part once and downloads it as a `.webm`. **Download full recording** saves the whole session. (Clip cutting needs Chrome, Edge or Firefox.)

## Code

| File | What it is |
| --- | --- |
| `src/lib/study/config.ts` | The script: scenario, tasks, questions, persona rule. Edit here. |
| `src/lib/study/results.ts` | Session shape, CSV export, summaries (tested in `src/lib/__tests__/study.test.ts`). |
| `src/components/study/StudyRunner.tsx` | The participant flow at `/study`. |
| `src/components/study/recorder.ts` | Tab + mic recording, saved in pieces as it goes. |
| `src/components/study/backend.ts` | Firestore (or this browser, without Firebase). |
| `src/components/study/ResultsDashboard.tsx` | `/study/results`. |
| `src/components/store.ts` | Inside the study the app keeps its data under a `study:` prefix, and `cloud.ts` turns sync off there. |
