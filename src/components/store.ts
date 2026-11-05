"use client";

import { useSyncExternalStore } from "react";

/**
 * Everything the app remembers lives in this browser's localStorage, behind a
 * tiny external store so components read it during render and every tab stays in
 * step. When storage is unavailable (a private window, blocked site data) values
 * fall back to memory for the session, and the page still works.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

/**
 * True when the app is running inside the usability study (/study), which shows it
 * in a frame. There it keeps its own copy of everything under a "study:" prefix, so
 * a participant's real calendars are never touched and every participant starts
 * from the same fresh sample data.
 */
export const inStudy: boolean = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.top !== window.self && Boolean(window.top?.location.pathname.startsWith("/study"));
  } catch {
    return false;
  }
})();

/** Prefix for this app's storage keys: "study:" inside the usability study, nothing otherwise. */
export const STORAGE_PREFIX = inStudy ? "study:" : "";

export const KEYS = {
  workspace: "prio:ws",
  snapshot: "prio:snap",
  changes: "prio:changes",
  seen: "prio:seen",
  /** Work added to class calendars that the student hasn't looked at yet. */
  newWork: "prio:new",
  ui: "prio:ui",
  theme: "prio:theme",
  /** When the quick tour of the Plan screen was finished or skipped. */
  tour: "prio:tour",
  /** This device's name for itself when syncing, so it can tell its own changes from another device's. */
  device: "prio:device",
  /** The account this device syncs with, and the setup it last agreed with it on. */
  cloud: "prio:cloud",
  /** When the "sign in to sync your devices?" pop-up may ask again ("never" once declined for good). */
  signInAsk: "prio:signin-ask",
  /** How tall an hour is on the calendar, after pinching it (pinchZoom.ts). This device only. */
  calZoom: "prio:cal-zoom",
} as const;

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Call `cb` whenever the stored value for `key` changes, in this tab or another. */
export function onStoredChange(key: string, cb: (value: string | null) => void): () => void {
  let last = readStored(key);
  return subscribe(() => {
    const now = readStored(key);
    if (now === last) return;
    last = now;
    cb(now);
  });
}

export function readStored(key: string): string | null {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + key);
    if (v !== null) return v;
  } catch {
    /* unavailable */
  }
  return memory.get(key) ?? null;
}

/** Returns false when the browser refused to save (usually storage is full). */
export function writeStored(key: string, value: string | null): boolean {
  let saved = true;
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    saved = false;
  }
  notify();
  return saved;
}

/** The stored string for `key`, or null. Null on the server and during hydration. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useTheme(): { theme: "light" | "dark"; toggle: () => void } {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light" as const,
  );
  const toggle = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    writeStored(KEYS.theme, next);
  };
  return { theme, toggle };
}

/**
 * Forget everything this app stored in the browser, except the theme and whether
 * the tour was already seen (starting over is not a first visit).
 */
export function resetEverything() {
  for (const key of Object.values(KEYS)) {
    if (key === KEYS.theme || key === KEYS.tour) continue;
    writeStored(key, null);
  }
}
