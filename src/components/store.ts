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

export const KEYS = {
  workspace: "prio:ws",
  snapshot: "prio:snap",
  changes: "prio:changes",
  seen: "prio:seen",
  ui: "prio:ui",
  theme: "prio:theme",
  /** When the "early prototype" notice was dismissed. Kept apart from calendars and settings. */
  prototypeNotice: "prio:prototype-notice",
  /** When the goal-setting instructions were dismissed. Kept apart from calendars and settings. */
  goalNotice: "prio:goal-notice",
  /** When the quick tour of the Plan screen was finished or skipped. */
  tour: "prio:tour",
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

export function readStored(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
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
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
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
 * the prototype/goal notices and the tour were already seen (starting over is not a first visit).
 */
export function resetEverything() {
  for (const key of Object.values(KEYS)) {
    if (key === KEYS.theme || key === KEYS.prototypeNotice || key === KEYS.goalNotice || key === KEYS.tour) continue;
    writeStored(key, null);
  }
}
