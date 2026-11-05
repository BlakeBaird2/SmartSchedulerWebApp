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

export const STUDY_VERSION = 2;

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

/** Every rating in the study uses this scale. */
export const AGREE_7: Scale = { min: 1, max: 7, minLabel: "Strongly disagree", maxLabel: "Strongly agree" };

export type Question =
  /** One choice from a list. */
  | { id: string; kind: "choice"; prompt: string; options: string[]; optional?: boolean }
  /** Any number of choices from a list. */
  | { id: string; kind: "multi"; prompt: string; options: string[]; optional?: boolean }
  /** Written answer. */
  | { id: string; kind: "text"; prompt: string; placeholder?: string; optional?: boolean }
  /** A rating on its own; follow it with a "text" question to pair it. Exported as `<id>`. */
  | { id: string; kind: "scale"; prompt: string; scale: Scale; optional?: boolean }
  /**
   * A rating paired with an open-ended "why", answered together. Exported as
   * `<id>` (the number) and `<id>_why` (the words).
   */
  | { id: string; kind: "pair"; prompt: string; scale: Scale; why: string; optional?: boolean }
  /**
   * The same statement rated twice, for Schedule Smart (A) and for what the
   * participant uses now (B), with an optional open-ended "why". Exported as
   * `<id>_a`, `<id>_b` and, with a why, `<id>_why`.
   */
  | { id: string; kind: "compare"; prompt: string; scale: Scale; why?: string; optional?: boolean };

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
  intro: "A few quick questions so we know whose experience we're hearing about.",
  questions: [
    {
      id: "s_student",
      kind: "choice",
      prompt: "Are you a full-time student?",
      options: ["Yes, full-time", "Part-time student", "Graduate student", "Not currently a student"],
    },
    {
      id: "s_classes",
      kind: "choice",
      prompt: "How many classes are you taking this semester?",
      options: ["None", "1–2", "3–4", "5 or more"],
    },
    {
      id: "s_commitments",
      kind: "choice",
      prompt: "Do you have a job or other regular weekly commitments (team, club, calling, internship)? About how many hours a week?",
      options: ["None", "1–10 hours", "11–20 hours", "More than 20 hours"],
    },
    {
      id: "s_tools",
      kind: "multi",
      prompt: "What do you use now to keep track of classes, assignments, work and personal plans? Pick all that apply.",
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
      id: "p_know",
      kind: "pair",
      prompt: "When I have free time between classes or work, I know exactly what to work on.",
      scale: AGREE_7,
      why: "How do you usually decide?",
    },
    {
      id: "p_spread",
      kind: "pair",
      prompt: "My classes, assignments, work and personal plans are spread across too many places.",
      scale: AGREE_7,
      why: "What part of managing your schedule stresses you out or frustrates you the most?",
    },
  ],
};

/**
 * Whether someone matches the target persona: a current student juggling school
 * with something else (a job or several tools to check), who loses free time
 * deciding what to do (doesn't agree they know what to work on) or whose plans
 * are scattered (agrees they're spread across too many places).
 */
export function matchesPersona(answers: Record<string, unknown>): boolean {
  const student = typeof answers.s_student === "string" && answers.s_student !== "Not currently a student";
  const tools = Array.isArray(answers.s_tools) ? answers.s_tools.filter((t) => t !== "Nothing in particular").length : 0;
  const busy = typeof answers.s_commitments === "string" && answers.s_commitments !== "None";
  const unsure = typeof answers.p_know === "number" && answers.p_know <= 4;
  const scattered = typeof answers.p_spread === "number" && answers.p_spread >= 5;
  return student && (busy || tools >= 2) && (unsure || scattered);
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

/** Asked right after each task in Schedule Smart, paired with why. */
export const TASK_EASE = { prompt: "This task was easy to do in Schedule Smart.", scale: AGREE_7, why: "Why did you give it that rating?" };

/** Asked for each task about the tools they use now (the B condition). */
export const ALT_EASE = {
  prompt: (alt: string) =>
    `Now think about ${alt} with the tools you use now (Google Calendar, Canvas, a planner, or nothing at all). Doing that with my current tools is easy.`,
  scale: AGREE_7,
  why: "What would you do, step by step? What makes it easy or hard?",
};

/** Said again at the start of every task. */
export const THINK_ALOUD_REMINDER = "Remember to think out loud: say what you're looking for, what you expect, and anything that surprises you.";

// ---------------------------------------------------------------------------
// After the tasks
// ---------------------------------------------------------------------------

/** Shown with every Schedule Smart vs. current tools rating. */
export const COMPARE_HINT = "Rate it twice: for Schedule Smart, and for the tools you use now (Google Calendar, Canvas, a planner, a spreadsheet, or nothing at all).";

export const SURVEY: Page[] = [
  {
    id: "clarity",
    title: "Clarity and ease",
    intro: COMPARE_HINT,
    questions: [
      { id: "a_purpose", kind: "scale", prompt: "The purpose of Schedule Smart was clear from the beginning.", scale: AGREE_7 },
      { id: "c_clear", kind: "compare", prompt: "My interactions with it are clear and understandable.", scale: AGREE_7 },
      { id: "c_find", kind: "compare", prompt: "Finding what I'm looking for is easy.", scale: AGREE_7 },
      { id: "a_clarity_why", kind: "text", prompt: "Please tell us what most affected your sense of Schedule Smart's purpose, ease, or clarity." },
      {
        id: "c_enjoy",
        kind: "compare",
        prompt: "I find the experience enjoyable.",
        scale: AGREE_7,
        why: "What would make Schedule Smart more enjoyable?",
      },
    ],
  },
  {
    id: "outcomes",
    title: "Planning your week",
    intro: COMPARE_HINT,
    questions: [
      {
        id: "c_useful",
        kind: "compare",
        prompt: "Using it would be useful for planning and getting my schoolwork done in my free time.",
        scale: AGREE_7,
        why: "What would make Schedule Smart more useful?",
      },
      {
        id: "c_control",
        kind: "compare",
        prompt: "Using it, I feel organized and in control of my week.",
        scale: AGREE_7,
        why: "What helped or got in the way?",
      },
      {
        id: "c_what",
        kind: "compare",
        prompt: "It makes it clear what I should work on in my free time.",
        scale: AGREE_7,
        why: "How did you decide what to do first?",
      },
      {
        id: "c_free",
        kind: "compare",
        prompt: "I can easily see when I have free time.",
        scale: AGREE_7,
        why: "What made it easy or hard to spot?",
      },
    ],
  },
  {
    id: "overall",
    title: "Overall",
    intro: "Last page. Honest answers help us most, even (especially) the critical ones.",
    questions: [
      {
        id: "c_intend",
        kind: "compare",
        prompt:
          "Mentally compare Schedule Smart to the tools you use now, or to not using anything at all if that's what you do. If I had access to a fully functional version, I would intend to use it.",
        scale: AGREE_7,
        why: "What are the biggest reasons why you would or would not intend to use Schedule Smart?",
      },
      {
        id: "a_more_organized",
        kind: "pair",
        prompt: "Schedule Smart would make my day-to-day life more organized than the way I organize it now.",
        scale: AGREE_7,
        why: "Why or why not?",
      },
      { id: "a_change", kind: "text", prompt: "If you could change or add one thing in Schedule Smart, what would it be?" },
      { id: "a_else", kind: "text", prompt: "Anything else you'd like to share?", optional: true },
    ],
  },
];

/** Every question, in the order they're asked. */
export function allQuestions(): Question[] {
  return [SCREENER, ...SURVEY].flatMap((p) => p.questions);
}
