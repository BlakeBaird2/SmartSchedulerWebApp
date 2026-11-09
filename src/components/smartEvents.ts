/**
 * Smart events: the important actions in the prototype, made visible to user-testing
 * tools. Each one is announced three ways, so any platform can pick it up:
 *
 * 1. The address bar gains `?event=<name>` (for example `?event=task-completed`).
 *    Tools like UXtweak or Maze can mark a task as a success when that URL appears.
 * 2. It is pushed to `window.dataLayer`, the standard list that Google Tag Manager,
 *    Hotjar and most analytics tools read.
 * 3. A `smartscheduler:event` DOM event fires, and the last few are kept for the
 *    facilitator's event log in the development menu.
 *
 * Buttons that trigger one also carry `data-smart-event="<name>"`, so click-tracking
 * tools can find them without guessing.
 */

import posthog from "posthog-js";

export type SmartEventName =
  | "task_completed"
  | "task_uncompleted"
  | "task_added"
  | "event_added"
  | "task_planned"
  | "task_unplanned"
  | "unfinished_returned"
  | "unfinished_left_off"
  | "add_task_opened"
  | "task_opened"
  | "free_gap_opened"
  | "why_opened"
  | "calendar_added"
  | "setup_finished"
  | "sample_data_started"
  | "view_changed"
  | "class_filtered"
  | "goal_reached";

export interface SmartEvent {
  name: SmartEventName;
  at: string;
  detail: Record<string, string | number | boolean | null>;
}

const LOG_KEY = "prio:events";
const LOG_SIZE = 40;
export const SMART_EVENT = "smartscheduler:event";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Sends only bounded action metadata; task and event content stays out of analytics. */
function capturePostHogEvent(name: SmartEventName, detail: SmartEvent["detail"]): void {
  switch (name) {
    case "setup_finished":
      posthog.capture("setup_finished");
      break;
    case "sample_data_started":
      posthog.capture("sample_data_started");
      break;
    case "calendar_added":
      posthog.capture("calendar_added", { provider: detail.provider, role: detail.role, class_count: detail.classes });
      break;
    case "add_task_opened":
      posthog.capture("add_task_opened");
      break;
    case "task_added":
      posthog.capture("task_added", { task_type: detail.type, has_due_date: detail.hasDueDate, estimated_minutes: detail.minutes });
      break;
    case "event_added":
      posthog.capture("event_added");
      break;
    case "task_planned":
      posthog.capture("task_planned");
      break;
    case "task_unplanned":
      posthog.capture("task_unplanned");
      break;
    case "task_completed":
      posthog.capture("task_completed", { source_view: detail.from });
      break;
    case "task_uncompleted":
      posthog.capture("task_uncompleted", { source_view: detail.from });
      break;
    case "unfinished_returned":
      posthog.capture("unfinished_returned", { task_count: detail.count });
      break;
    case "unfinished_left_off":
      posthog.capture("unfinished_left_off", { task_count: detail.count });
      break;
  }
}

export function trackEvent(name: SmartEventName, detail: SmartEvent["detail"] = {}): void {
  if (typeof window === "undefined") return;
  const entry: SmartEvent = { name, at: new Date().toISOString(), detail };
  capturePostHogEvent(name, detail);
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: `smartscheduler_${name}`, ...detail });
  } catch {
    // Analytics must never break the app.
  }
  // Next's router listens to the address bar, so change it after the current render
  // (sample data starts while the app is first drawn), never during it.
  setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("event", name.replace(/_/g, "-"));
      window.history.replaceState(null, "", url);
    } catch {
      // Some embedded browsers refuse history changes; the other two signals still fire.
    }
  }, 0);
  try {
    const log = readEventLog();
    log.unshift(entry);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_SIZE)));
  } catch {
    // Storage can be blocked; the log is only a convenience.
  }
  window.dispatchEvent(new CustomEvent<SmartEvent>(SMART_EVENT, { detail: entry }));
}

export function readEventLog(): SmartEvent[] {
  try {
    const raw = sessionStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
