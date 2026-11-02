import { sanitizeWorkspace } from "./workspace";
import type { Workspace } from "./types";

/*
 * Keeping a student's setup the same on every device they sign in on.
 *
 * What syncs is the workspace: calendar links, which classes are theirs,
 * scheduled time, done marks, estimates, moved events, colours and settings.
 * What a calendar says is not stored; each device reads the links itself.
 * The copy in this browser stays the one the app works from, so it opens
 * instantly and works offline; the account keeps a copy and passes changes on.
 */

/** Whether a workspace holds anything of the student's own (sample data doesn't count). */
export function hasOwnData(ws: Workspace): boolean {
  return !ws.demo && (ws.feeds.length > 0 || ws.manualTasks.length > 0 || ws.blocks.length > 0);
}

/** The same setup, whatever order its JSON was written in. */
export function sameWorkspace(a: Workspace, b: Workspace): boolean {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * What to do the first time this device meets the account:
 * - upload: the account is empty; this device's setup becomes the account's.
 * - download: this device has nothing of its own (or only sample data); it takes the account's.
 * - same: they already match.
 * - ask: both have a setup and they differ; the student picks which to keep.
 * - none: neither has anything yet.
 */
export type FirstSync = "upload" | "download" | "same" | "ask" | "none";

export function firstSync(local: Workspace, remote: Workspace | null): FirstSync {
  const mine = hasOwnData(local);
  const theirs = remote !== null && hasOwnData(remote);
  if (!theirs) return mine ? "upload" : "none";
  if (!mine) return "download";
  return sameWorkspace(local, remote) ? "same" : "ask";
}

/**
 * What to do when a device that has synced with this account before opens
 * again, given the setup they last agreed on (`base`):
 * - only the account changed (another device did something): take it.
 * - only this device changed (edits made offline): save them.
 * - both changed: ask, unless they happen to match.
 */
export function resync(local: Workspace, remote: Workspace | null, base: Workspace): FirstSync {
  const localChanged = !sameWorkspace(local, base);
  if (remote === null) return hasOwnData(local) ? "upload" : "none";
  const remoteChanged = !sameWorkspace(remote, base);
  if (!localChanged) return remoteChanged ? "download" : "same";
  if (!remoteChanged) return hasOwnData(local) ? "upload" : "same";
  return sameWorkspace(local, remote) ? "same" : "ask";
}

/** The account's copy, read safely: anything damaged or empty is treated as no copy. */
export function readCloudWorkspace(raw: unknown): Workspace | null {
  if (typeof raw !== "string") return null;
  try {
    const ws = sanitizeWorkspace(JSON.parse(raw));
    return hasOwnData(ws) ? ws : null;
  } catch {
    return null;
  }
}

/** A few words about a setup, for choosing between two of them: its calendars by name and site, and how much is in it. */
export function describeWorkspace(ws: Workspace): string {
  const site = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  const named = ws.feeds.slice(0, 3).map((f) => (site(f.url) && site(f.url) !== f.name ? `${f.name} (${site(f.url)})` : f.name));
  if (ws.feeds.length > 3) named.push(`${ws.feeds.length - 3} more`);
  const parts = [named.length ? named.join(", ") : "No calendars"];
  if (ws.blocks.length) parts.push(`${ws.blocks.length} scheduled`);
  const done = Object.keys(ws.done).length;
  if (done) parts.push(`${done} done`);
  return parts.join(" · ");
}
