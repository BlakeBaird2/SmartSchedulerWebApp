/*
 * Shared types.
 *
 * Everything the app knows comes from calendar feeds (iCal links) the user pastes
 * in. The server turns a feed into a FeedResult and stores nothing. The browser
 * keeps the user's Workspace and the last Snapshot of each feed, and merges them
 * into Courses, Tasks and CalEvents for display and planning.
 */

export type AssignmentType = "exam" | "quiz" | "reading" | "project" | "assignment";

export const ASSIGNMENT_TYPES: AssignmentType[] = ["exam", "quiz", "project", "assignment", "reading"];

const KNOWN_TYPES = new Set<string>(ASSIGNMENT_TYPES);

/** Coerce a stored type to one that exists, so old or odd data never breaks the page. */
export function normalizeType(type: unknown): AssignmentType {
  return typeof type === "string" && KNOWN_TYPES.has(type) ? (type as AssignmentType) : "assignment";
}

/** Where a feed comes from. Only used for sensible defaults and help text. */
export type Provider = "canvas" | "learningsuite" | "google" | "outlook" | "icloud" | "other";

/**
 * What a feed is for.
 * - school: its entries become assignments and class meetings.
 * - personal: its entries only mark time as busy; nothing becomes homework.
 */
export type FeedRole = "school" | "personal";

// ---------------------------------------------------------------------------
// What the server returns for one feed
// ---------------------------------------------------------------------------

/** A class found inside a feed. `key` is unique within that feed. */
export interface FeedCourse {
  key: string;
  code: string;
  title: string;
  url: string | null;
}

/** Something that is due. */
export interface FeedTask {
  uid: string;
  courseKey: string | null;
  title: string;
  type: AssignmentType;
  dueAt: string; // ISO instant
  allDay: boolean;
  url: string | null;
  description: string | null;
  /** Created by the app rather than read from the feed, e.g. study time before an exam. */
  generated?: "study";
}

export type EventKind = "class" | "exam" | "event";

/** Something that occupies time on the calendar. */
export interface FeedEvent {
  uid: string;
  courseKey: string | null;
  title: string;
  start: string; // ISO instant
  end: string; // ISO instant, exclusive
  allDay: boolean;
  /** Whether this blocks the planner from scheduling work. */
  busy: boolean;
  kind: EventKind;
  location: string | null;
  url: string | null;
}

export interface FeedResult {
  url: string;
  provider: Provider;
  role: FeedRole;
  calendarName: string | null;
  fetchedAt: string;
  courses: FeedCourse[];
  tasks: FeedTask[];
  events: FeedEvent[];
  /** Entries that could not be read and were left out. */
  skipped: number;
}

// ---------------------------------------------------------------------------
// What the browser keeps
// ---------------------------------------------------------------------------

export interface FeedConfig {
  /** Derived from the URL, so the same link always gets the same id on every device. */
  id: string;
  url: string;
  name: string;
  role: FeedRole;
  provider: Provider;
  /** Colour for events from personal calendars. Classes get their own colours. */
  color: string;
  enabled: boolean;
}

/**
 * Something that happens every week and isn't on a calendar feed: when a class
 * meets, a work shift, practice.
 */
export interface WeeklyBlock {
  id: string;
  label: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  /** Set when this is a class meeting; the class supplies its name and colour. */
  courseId?: string | null;
  location?: string | null;
  /** Dates ("YYYY-MM-DD") when it isn't happening, such as a holiday. */
  skip?: string[];
}

/** Work the user added by hand, for things no feed knows about. */
export interface ManualTask {
  id: string;
  title: string;
  courseId: string | null;
  type: AssignmentType;
  dueAt: string | null;
}

export interface CourseEdit {
  code?: string;
  title?: string;
  color?: string;
  hidden?: boolean;
  /**
   * Meeting times from the class's calendar that the user corrected, as
   * "startMinutes-endMinutes" of the day. Meetings at those times are hidden and
   * the user's own class times stand in for them.
   */
  feedTimesOff?: string[];
}

export interface PlanPrefs {
  /** Minutes after midnight when the working day starts and ends. */
  dayStart: number;
  dayEnd: number;
  /** Most minutes of work to plan in one day, unless something is due within a day. */
  dailyMax: number;
  /** Minutes kept free before and after each event, for travel and breathing room. */
  buffer: number;
  /** Shortest free stretch worth using. */
  minGap: number;
  /** Whether to plan work on Saturdays and Sundays. */
  weekends: boolean;
  /** Default time needed for each kind of work, in minutes. */
  estimates: Record<AssignmentType, number>;
}

/** Who set an estimate: the student, or (later) a suggestion they accepted. */
export type EstimateSource = "user" | "ai";

/**
 * How long a piece of work needs, and where the number came from. Kept as a
 * record rather than a bare number so suggested estimates can sit alongside the
 * student's own later.
 */
export interface Estimate {
  minutes: number;
  source: EstimateSource;
  /** When it was set. */
  at?: string;
}

/**
 * Time the student set aside on the calendar for a piece of work.
 *
 * Shaped like a Google Calendar event (start, end, title, colour, an external id)
 * so two-way sync can map one onto the other without reshaping anything. The
 * planner treats it as fixed: that time is taken, and the work it is for is
 * scheduled.
 */
export interface ScheduledBlock {
  id: string;
  /** The work this time is for. Null for time not tied to a task, such as an event brought in from Google Calendar. */
  taskId: string | null;
  /** Shown when there is no task to take a title from, and the title Google Calendar would show. */
  title: string;
  start: string; // ISO instant
  end: string; // ISO instant, exclusive
  /** A colour the student picked, or null to colour it by how soon its work is due. */
  color: string | null;
  /** The matching Google Calendar event's id, once synced. */
  externalId: string | null;
  /** When the block last changed, to settle edits made on both sides of a sync. */
  updatedAt: string;
}

/**
 * What happens to work whose scheduled time passed without it being done.
 * - ask: each morning, ask whether to put yesterday's unfinished work back on the list.
 * - midnight: put it back on its own once the day it was scheduled for is over.
 * - keep: scheduling never takes work off the list; it stays until it is ticked off.
 */
export type UnfinishedPolicy = "ask" | "midnight" | "keep";
export const UNFINISHED_POLICIES: UnfinishedPolicy[] = ["ask", "midnight", "keep"];

/** The answer given about one task when asked whether to put it back on the list. */
export interface UnfinishedAnswer {
  at: string;
  back: boolean;
}

export interface Workspace {
  version: 1;
  feeds: FeedConfig[];
  weekly: WeeklyBlock[];
  manualTasks: ManualTask[];
  /** taskId -> when it was marked done */
  done: Record<string, string>;
  /** taskId -> how long the user says it needs */
  estimates: Record<string, Estimate>;
  /** Time set aside on the calendar, by dragging work onto it or picking a time. */
  blocks: ScheduledBlock[];
  /** courseId -> the user's renames, colours and hiding */
  courseEdits: Record<string, CourseEdit>;
  /** Class ids, most important first. Breaks ties between work due at the same time. */
  classOrder: string[];
  /** Event series (see eventColors.seriesKey) -> the colour the student picked for it. */
  eventColors: Record<string, string>;
  /** What happens to work whose scheduled time passes before it is done. */
  unfinished: UnfinishedPolicy;
  /** taskId -> the last answer to "put it back on the to-do list?" */
  unfinishedAnswers: Record<string, UnfinishedAnswer>;
  prefs: PlanPrefs;
  /** Showing sample data instead of the user's own calendars. */
  demo: boolean;
}

export interface FeedState {
  result: FeedResult | null;
  error: string | null;
  /** When the feed was last read successfully. */
  syncedAt: string | null;
}

export interface Snapshot {
  feeds: Record<string, FeedState>;
  /** When the last sync attempt finished. */
  at: string | null;
}

export type ChangeKind = "added" | "removed" | "due_changed";

export interface Change {
  id: string;
  at: string;
  kind: ChangeKind;
  taskId: string;
  courseId: string | null;
  title: string;
  from: string | null;
  to: string | null;
}

// ---------------------------------------------------------------------------
// The merged view the interface and planner work from
// ---------------------------------------------------------------------------

export interface Course {
  /** `${feedId}:${key}` */
  id: string;
  feedId: string;
  code: string;
  title: string;
  color: string;
  url: string | null;
  hidden: boolean;
}

export interface Task {
  id: string;
  feedId: string | null;
  courseId: string | null;
  title: string;
  type: AssignmentType;
  dueAt: string | null;
  allDay: boolean;
  url: string | null;
  description: string | null;
  /** Minutes this is expected to take. */
  estimate: number;
  /** Whether the user set the estimate, rather than it coming from the default for its type. */
  customEstimate: boolean;
  /** Where the estimate came from: the default for its type, the student, or a suggestion. */
  estimateSource: "default" | EstimateSource;
  done: boolean;
  manual: boolean;
  generated: "study" | null;
}

export interface CalEvent {
  id: string;
  feedId: string | null;
  courseId: string | null;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  busy: boolean;
  kind: EventKind;
  location: string | null;
  url: string | null;
  color: string;
  source: "feed" | "weekly";
}
