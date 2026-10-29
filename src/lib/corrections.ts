import type { Change } from "./types";

/**
 * Whether a due date "moved" only because an older version of Schedule Smart
 * read it wrong: Canvas sends work due at 11:59 PM as a date with no time, which
 * used to be read as the first moment of that day (midnight UTC on the server,
 * or local midnight) instead of 11:59 PM where the student is. The first refresh
 * after the fix moves every such date to the right time; that is not news from
 * the class, so it isn't reported as a change. Uses the browser's time zone,
 * which is the student's.
 */
export function isDateOnlyCorrection(c: Change): boolean {
  if (c.kind !== "due_changed" || !c.from || !c.to) return false;
  const to = new Date(c.to);
  if (to.getHours() !== 23 || to.getMinutes() !== 59 || to.getSeconds() !== 59) return false;
  const from = Date.parse(c.from);
  const [y, m, d] = [to.getFullYear(), to.getMonth(), to.getDate()];
  return from === Date.UTC(y, m, d) || from === new Date(y, m, d).getTime();
}
