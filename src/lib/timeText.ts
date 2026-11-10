/**
 * Times and lengths typed by hand, as in Google Calendar: "3", "3pm", "3:37 pm",
 * "15:37", "noon" for a time; "45", "1h", "1.5 hours", "1h 20m", "1:20" for a length.
 *
 * Times are minutes from midnight. An end time may be 1440: midnight at the end
 * of the day.
 */

const DAY = 24 * 60;

/** "9:00 AM", "12:45 PM": the way every time in a time list reads. */
export function timeLabel(minutes: number): string {
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

/** "45 min", "1 hr", "1 hr 20 min", "2.5 hrs": a length, short. */
export function lengthText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return `${h} ${h === 1 ? "hr" : "hrs"}`;
  if (rest === 30) return `${h}.5 hrs`;
  return `${h} ${h === 1 ? "hr" : "hrs"} ${rest} min`;
}

/**
 * A typed time of day, or null if it doesn't read as one.
 *
 * Without am or pm, a 24-hour time ("15:30", "0:45") is taken as it is. An hour
 * from 1 to 12 is read the way people mean it: for an end time (`after`, the
 * start), the first of the two that comes after the start; otherwise 7 to 11 in
 * the morning and 12 to 6 in the afternoon.
 */
export function parseTime(text: string, after?: number): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, ":");
  if (!t) return null;
  if (t === "noon" || t === "midday") return 12 * 60;
  if (t === "midnight") return after !== undefined ? DAY : 0;

  const m = t.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/) ?? t.match(/^(\d{1,2}):(\d{1,2})(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  const meridiem = m[3]?.[0] as "a" | "p" | undefined;
  if (min > 59) return null;

  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem === "p" ? 12 : 0);
    const at = h * 60 + min;
    // "12am" as an end means midnight tonight, not this morning.
    return after !== undefined && at === 0 ? DAY : at;
  }
  if (h > 24 || (h === 24 && min > 0)) return null;
  // Clearly 24-hour: "0:30", "09:00", "15:00", "24:00".
  if (h === 0 || h > 12 || (m[1].length === 2 && m[1].startsWith("0"))) {
    const at = h * 60 + min;
    if (after !== undefined) return at === 0 ? DAY : at;
    return at % DAY;
  }
  // An hour from 1 to 12, morning or afternoon.
  const morning = (h % 12) * 60 + min;
  const afternoon = morning + 12 * 60;
  if (after !== undefined) {
    const choices = [morning, afternoon, ...(morning === 0 ? [DAY] : [])];
    return choices.find((c) => c > after && c <= DAY) ?? null;
  }
  return h === 12 ? afternoon : h >= 7 ? morning : afternoon;
}

/**
 * A typed length in minutes, or null. A bare number is minutes ("45"), unless
 * it's small with a decimal ("1.5" is hours).
 */
export function parseLength(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  let minutes: number | null = null;

  const clock = t.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else if (/^\d+$/.test(t)) minutes = Number(t);
  else if (/^\d*\.\d+$/.test(t)) minutes = Number(t) * 60;
  else {
    const re = /(\d*\.?\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?![a-z])/g;
    let rest = t;
    let total = 0;
    let found = false;
    for (const part of t.matchAll(re)) {
      found = true;
      total += Number(part[1]) * (part[2].startsWith("h") ? 60 : 1);
      rest = rest.replace(part[0], "");
    }
    if (found && /^[\s,and]*$/.test(rest)) minutes = total;
  }
  if (minutes === null || !Number.isFinite(minutes)) return null;
  minutes = Math.round(minutes);
  return minutes > 0 && minutes <= DAY ? minutes : null;
}

/** Times of day every `step` minutes, from `from` up to and including `to`. */
export function timeSteps(from: number, to: number, step = 15): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(from / step) * step; m <= to; m += step) out.push(m);
  return out;
}
