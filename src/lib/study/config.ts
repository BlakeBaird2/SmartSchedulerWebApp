/**
 * The unmoderated usability study: everything a participant reads and answers.
 *
 * Edit the words here; the study page (/study), the results page
 * (/study/results) and the CSV export all follow this file. If you change a
 * question's id after people have taken the test, their old answers stay under
 * the old id (they just won't have a column in the export any more), so prefer
 * adding new ids over renaming. Bump STUDY_VERSION when you change the script,
 * so the export shows which version each person saw.
 *
 * The plan behind it (the rubric, the A/B design, why each question is here)
 * is in USABILITY_TEST.md.
 */

export const STUDY_VERSION = 1;

/** How many representative participants the class requires. */
export const TARGET_PARTICIPANTS = 30;

/** Shown on the welcome screen. */
export const TEAM = "Blake, Grace and Hannah";

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

export interface Scale {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

export const AGREE_7: Scale = { min: 1, max: 7, minLabel: "Strongly disagree", maxLabel: "Strongly agree" };
export const EASE_7: Scale = { min: 1, max: 7, minLabel: "Very difficult", maxLabel: "Very easy" };
export const LIKELY_7: Scale = { min: 1, max: 7, minLabel: "Not at all likely", maxLabel: "Extremely likely" };
export const NPS_11: Scale = { min: 0, max: 10, minLabel: "Not at all likely", maxLabel: "Extremely likely" };

export type Question =
  /** One choice from a list. */
  | { id: string; kind: "choice"; prompt: string; options: string[]; optional?: boolean }
  /** Any number of choices from a list. */
  | { id: string; kind: "multi"; prompt: string; options: string[]; optional?: boolean }
  /** Written answer. */
  | { id: string; kind: "text"; prompt: string; placeholder?: string; optional?: boolean }
  /**
   * A rating paired with an open-ended "why", answered together. Exported as
   * `<id>` (the number) and `<id>_why` (the words).
   */
  | { id: string; kind: "pair"; prompt: string; scale: Scale; why: string; optional?: boolean }
  /**
   * The same statement rated twice, for Schedule Smart (A) and for what the
   * participant uses now (B), then one open-ended "why". Exported as `<id>_a`,
   * `<id>_b` and `<id>_why`. `minutes` asks for a number of minutes instead of a rating.
   */
  | { id: string; kind: "compare"; prompt: string; scale: Scale | "minutes"; why: string; optional?: boolean };

export interface Page {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
}

// ---------------------------------------------------------------------------
// Setting the stage
// ---------------------------------------------------------------------------

/** The imaginary situation every participant is put in, word for word the same. */
export const SCENARIO = {
  title: "Pretend this is your week",
  lines: [
    "You're a full-time college student taking four classes: ACC 200, BUS 301, CS 142 and WRTG 150.",
    "You also have a part-time job, and your shifts are on your calendar too.",
    "You've already connected Canvas, Learning Suite and your Google Calendar to Schedule Smart, so everything you'll see is \"your\" schedule. (It's made-up sample data. Nothing real is shown or changed.)",
    "It's today, right now. You have homework due soon and some free time coming up, and you want to make good use of it.",
  ],
};

/** What thinking out loud sounds like, shown as an example before the tasks. */
export const THINK_ALOUD_EXAMPLE = [
  "\"Okay, I'm looking for where to change my password… I'd expect it under my name up here.",
  "Hmm, this menu has Settings, so I'll try that. I'm not sure what 'Account sync' means.",
  "Oh, there it is. That took longer than I thought it would.\"",
];

// ---------------------------------------------------------------------------
// Before the tasks: does this person match the target persona?
// ---------------------------------------------------------------------------

export const SCREENER: Page = {
  id: "about",
  title: "A little about you",
  intro: "Four quick questions so we know whose experience we're hearing about.",
  questions: [
    {
      id: "s_student",
      kind: "choice",
      prompt: "Are you a college student right now?",
      options: ["Yes, full-time", "Yes, part-time", "Graduate student", "Not currently a student"],
    },
    {
      id: "s_commitments",
      kind: "choice",
      prompt: "About how many hours a week do you spend at a job or another regular commitment (team, club, calling, internship)?",
      options: ["None", "1–10 hours", "11–20 hours", "More than 20 hours"],
    },
    {
      id: "s_tools",
      kind: "multi",
      prompt: "What do you use now to keep track of classes, homework and plans? Pick all that apply.",
      options: [
        "Canvas",
        "Learning Suite",
        "Google Calendar",
        "Apple Calendar",
        "Outlook",
        "Paper planner",
        "Notes or to-do app",
        "Nothing in particular",
      ],
    },
    {
      id: "s_struggle",
      kind: "pair",
      prompt: "How often do you have free time but spend a while deciding what to work on?",
      scale: { min: 1, max: 5, minLabel: "Never", maxLabel: "Almost every day" },
      why: "Think of the last time you had a free hour between classes or work. How did you decide what to work on?",
    },
  ],
};

/**
 * Whether someone matches the target persona: a current student juggling school
 * with something else (a job or several tools to check), who at least
 * sometimes loses free time deciding what to do.
 */
export function matchesPersona(answers: Record<string, unknown>): boolean {
  const student = typeof answers.s_student === "string" && answers.s_student !== "Not currently a student";
  const tools = Array.isArray(answers.s_tools) ? answers.s_tools.filter((t) => t !== "Nothing in particular").length : 0;
  const busy = typeof answers.s_commitments === "string" && answers.s_commitments !== "None";
  const struggle = typeof answers.s_struggle === "number" && answers.s_struggle >= 3;
  return student && (busy || tools >= 2) && struggle;
}

// ---------------------------------------------------------------------------
// The tasks. Each is done in Schedule Smart (A) and matched with the same goal
// using the participant's next-best alternative, recalled (B).
// ---------------------------------------------------------------------------

export interface StudyTask {
  id: string;
  title: string;
  /** The goal, in the scenario's words. Never names the button to press. */
  goal: string;
  /** Asks for a typed answer as well (for a "find out" task). */
  answer?: string;
  /** A Schedule Smart action that shows the task was done (see components/smartEvents.ts). */
  successEvent?: string;
  /** B: the same goal with the tools they use now. */
  alternative: string;
}

export const TASKS: StudyTask[] = [
  {
    id: "t1_plan",
    title: "Use your free time",
    goal: "You have some free time later today. Decide which assignment you should work on first, and set aside time for it on your calendar.",
    successEvent: "task_planned",
    alternative: "deciding which assignment to work on first, and setting aside time for it",
  },
  {
    id: "t2_friday",
    title: "Can you say yes?",
    goal: "A friend invites you to a movie this Friday night. Before you answer, find out what you still have due before the weekend and whether you'll have time to get it done.",
    answer: "What's due before the weekend, and can you go?",
    alternative: "finding everything that's due before the weekend and whether you have time to do it",
  },
  {
    id: "t3_done",
    title: "Finish something",
    goal: "Pretend you just finished the assignment you set time aside for in task 1. Mark it as done.",
    successEvent: "task_completed",
    alternative: "keeping track of an assignment you just finished",
  },
  {
    id: "t4_event",
    title: "Something new comes up",
    goal: "You just joined a study group that meets tomorrow from 7 to 8 PM. Add it to your schedule so your plans work around it.",
    successEvent: "event_added",
    alternative: "adding a new commitment and making your homework plans work around it",
  },
];

/** Asked right after each task in Schedule Smart: the Single Ease Question, paired with why. */
export const TASK_EASE = { prompt: "How easy or difficult was this task in Schedule Smart?", scale: EASE_7, why: "Why did you give it that rating?" };

/** Asked for each task about the tools they use now (the B condition). */
export const ALT_EASE = {
  prompt: (alt: string) => `Now think about ${alt} with what you use now (Canvas, a calendar app, a planner…). How easy or difficult is that?`,
  scale: EASE_7,
  why: "What would you do, step by step? What makes it easy or hard?",
};

/** Said again at the start of every task. */
export const THINK_ALOUD_REMINDER = "Remember to think out loud: say what you're looking for, what you expect, and anything that surprises you.";

// ---------------------------------------------------------------------------
// After the tasks
// ---------------------------------------------------------------------------

export const SURVEY: Page[] = [
  {
    id: "outcomes",
    title: "Schedule Smart compared to what you use now",
    intro: "Rate each statement twice: once for Schedule Smart, once for the tools you use today.",
    questions: [
      {
        id: "o_know",
        kind: "compare",
        prompt: "When I have free time, I know exactly what to work on.",
        scale: AGREE_7,
        why: "What makes the difference between the two?",
      },
      {
        id: "o_minutes",
        kind: "compare",
        prompt: "About how many minutes does it take you to decide what to work on when free time comes up?",
        scale: "minutes",
        why: "Where does that time go?",
      },
      {
        id: "o_together",
        kind: "compare",
        prompt: "I can see my classes, job and personal plans together in one place.",
        scale: AGREE_7,
        why: "What would you still have to check somewhere else?",
      },
      {
        id: "o_control",
        kind: "compare",
        prompt: "I feel in control of my week.",
        scale: AGREE_7,
        why: "Why?",
      },
    ],
  },
  {
    id: "features",
    title: "The main features",
    questions: [
      {
        id: "f_planner",
        kind: "pair",
        prompt: "The \"Plan your open time\" list made it clear what to work on next.",
        scale: AGREE_7,
        why: "What, if anything, was confusing or missing?",
      },
      {
        id: "f_drag",
        kind: "pair",
        prompt: "Dragging work onto the calendar was an easy way to set time aside for it.",
        scale: AGREE_7,
        why: "Why?",
      },
      {
        id: "f_combined",
        kind: "pair",
        prompt: "Having Canvas, Learning Suite and my own calendar combined in one place would be useful to me.",
        scale: AGREE_7,
        why: "What would make it more useful?",
      },
    ],
  },
  {
    id: "overall",
    title: "Overall",
    intro: "Last page. Honest answers help us most, even (especially) the critical ones.",
    questions: [
      { id: "u_easy", kind: "pair", prompt: "Schedule Smart is easy to use.", scale: AGREE_7, why: "Why?" },
      { id: "u_needs", kind: "pair", prompt: "Schedule Smart's features meet my needs.", scale: AGREE_7, why: "What's missing, if anything?" },
      {
        id: "u_use",
        kind: "pair",
        prompt: "How likely are you to use Schedule Smart for your own classes this semester?",
        scale: LIKELY_7,
        why: "What would make you more likely to use it?",
      },
      {
        id: "u_recommend",
        kind: "pair",
        prompt: "How likely are you to recommend Schedule Smart to a friend?",
        scale: NPS_11,
        why: "Why that number?",
      },
      { id: "u_change", kind: "text", prompt: "If you could change one thing about Schedule Smart, what would it be?" },
      { id: "u_else", kind: "text", prompt: "Anything else you'd like us to know?", optional: true },
    ],
  },
];

/** Every question, in the order they're asked. */
export function allQuestions(): Question[] {
  return [SCREENER, ...SURVEY].flatMap((p) => p.questions);
}
