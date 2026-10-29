/*
 * Which classes in a school calendar are really the student's.
 *
 * Canvas and Learning Suite give one link for everything: every course the
 * person is enrolled in, including ones they TA or help run, last term's, and
 * pages that aren't classes at all (orientation, advisement, a club). The link
 * can't be split, so Schedule Smart sorts the classes it finds instead. Until the
 * student decides, a class that looks like one of these is left out of the plan
 * with the reason shown; the student can tick it back in.
 */

export type ClassHintReason = "teaching" | "not-a-class" | "past";

export interface ClassHint {
  reason: ClassHintReason;
  /** A few words for the class list, e.g. "Looks like a course you help teach". */
  label: string;
}

/** A class with nothing due or on since this long ago is from an earlier term. */
const PAST_AFTER_MS = 21 * 86_400_000;

// "TA" on its own, but not a department code such as "TA 101".
const TA = /(^|[^A-Za-z])T\.?A\.?s?(?![A-Za-z])(?!\.?\s*\d)/;
const TEACHING =
  /\b(teaching assistants?|instructors?|graders?|staff|faculty|sandbox|training|templates?|blueprint|master course|dev(elopment)? shell|course shell)\b/i;
const NOT_A_CLASS =
  /\b(orientation|onboarding|advis(e|ing|ement|or)|library|student (resources|services|life|success)|resource cent(er|re)|clubs?|community|tutoring cent(er|re)|writing cent(er|re))\b/i;

/**
 * Why a class probably isn't one the student is taking, or null when it looks
 * like a normal class. `dates` are the times (ms) of everything the calendar has
 * for it: due dates and class meetings.
 */
export function classHint(course: { code: string; title: string }, dates: number[], now: Date): ClassHint | null {
  const name = `${course.code} ${course.title}`;
  if (TA.test(name) || TEACHING.test(name)) return { reason: "teaching", label: "Looks like a course you help teach" };
  if (NOT_A_CLASS.test(name)) return { reason: "not-a-class", label: "Looks like a page, not a class" };
  if (dates.length > 0 && Math.max(...dates) < now.getTime() - PAST_AFTER_MS) {
    const last = new Date(Math.max(...dates));
    return { reason: "past", label: `From an earlier term · nothing since ${last.toLocaleDateString("en-US", { month: "short", year: "numeric" })}` };
  }
  return null;
}

/** Whether a class is left out of the plan: the student's choice, or until they make one, the hint's. */
export function classHidden(choice: boolean | undefined, hint: ClassHint | null): boolean {
  return choice ?? hint !== null;
}
