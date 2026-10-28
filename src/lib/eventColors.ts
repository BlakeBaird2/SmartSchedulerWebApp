/**
 * Colours the student picks for events on their calendar (a class, a shift at
 * work), as in Google Calendar. The choices are Google Calendar's own eleven, in
 * the order its picker shows them, so a two-way sync can carry them across as
 * the same colorId.
 *
 * A colour belongs to the whole series: every meeting of a repeating event, or
 * every day of a weekly busy time.
 */

export interface EventColor {
  /** Google Calendar's colorId for events. */
  id: string;
  name: string;
  hex: string;
}

export const EVENT_COLORS: EventColor[] = [
  { id: "11", name: "Tomato", hex: "#d50000" },
  { id: "4", name: "Flamingo", hex: "#e67c73" },
  { id: "6", name: "Tangerine", hex: "#f4511e" },
  { id: "5", name: "Banana", hex: "#f6bf26" },
  { id: "2", name: "Sage", hex: "#33b679" },
  { id: "10", name: "Basil", hex: "#0b8043" },
  { id: "7", name: "Peacock", hex: "#039be5" },
  { id: "9", name: "Blueberry", hex: "#3f51b5" },
  { id: "1", name: "Lavender", hex: "#7986cb" },
  { id: "3", name: "Grape", hex: "#8e24aa" },
  { id: "8", name: "Graphite", hex: "#616161" },
];

/**
 * The series an event belongs to, from its id. One meeting of a repeating event
 * ends in "@" and its start time; a day of a weekly busy time ends in "@" and its
 * date. Ids often contain "@" themselves (abc@google.com), so only a date or time
 * at the very end is taken off.
 */
export function seriesKey(eventId: string): string {
  return eventId.replace(/@\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z)?$/, "");
}

/** Whether an event is one of a series, so a colour reaches every one of them. */
export function repeats(eventId: string): boolean {
  return seriesKey(eventId) !== eventId;
}

/** Google Calendar's colorId for a colour, if it is one of theirs. */
export function gcalColorId(hex: string | null | undefined): string | null {
  if (!hex) return null;
  return EVENT_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.id ?? null;
}
