"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildModel } from "@/lib/model";
import { indexPlan, makePlan } from "@/lib/schedule";
import { mergeChanges } from "@/lib/changes";
import { addNewWork, newIds, parseNewWork, seeWork as seeNewWork } from "@/lib/newWork";
import { fetchFeedFromApi, syncAll } from "@/lib/sync";
import { feedIdFor, PROVIDER_LABEL } from "@/lib/feeds/url";
import { decodeSetup, nextPersonalColor, pastDueIds, randomId, sanitizeWorkspace } from "@/lib/workspace";
import { type Change, type EstimateSource, type FeedResult, type FeedRole, type ScheduledBlock, type Snapshot, type Task, type Workspace } from "@/lib/types";
import { format } from "date-fns";
import { clock, DEFAULT_FILTERS, duration, plural, type Filters } from "@/lib/ui";
import { blockMinutes, dropBlock, makeBlock, moveBlock as moveBlockTo, putBlock, resizeBlock as resizeBlockTo } from "@/lib/blocks";
import type { TodoScope, TodoSort } from "@/lib/todos";
import { AppContext, type AppContextValue, type CalMode, type Selection, type SettingsPanel, type View } from "./context";
import { KEYS, parseJson, readStored, useStored, writeStored } from "./store";
import { Header } from "./Header";
import { Banners } from "./Banners";
import { Onboarding, startDemo } from "./Onboarding";
import { PlanHeading, PlanView } from "./PlanView";
import { CalendarView } from "./CalendarView";
import { UpcomingView } from "./UpcomingView";
import { SettingsView } from "./SettingsView";
import { HelpView } from "./HelpView";
import { DetailPanel } from "./DetailPanel";
import { AddTaskDialog } from "./AddTaskDialog";
import { ImportDialog } from "./ImportDialog";
import { ClassTimesDialog } from "./ClassTimes";
import { Toast } from "./ui";
import { BottomNav } from "./BottomNav";
import { AppTour } from "./AppTour";
import { ViewHeading } from "./ViewHeading";
import { UnfinishedPrompt } from "./UnfinishedPrompt";
import { openGoalNotice } from "./Prototype";
import { trackEvent } from "./smartEvents";

// ---------------------------------------------------------------------------
// Reading what the browser has stored
// ---------------------------------------------------------------------------

interface UiPrefs {
  view: View;
  calMode: CalMode;
  filters: Filters;
  /** Whether the first-run setup has been finished. */
  setupDone: boolean;
  hideClassTimesTip: boolean;
  settingsPanel: SettingsPanel;
  /** Whether the calendar's sidebar (small month and to-do list) is open on a computer. */
  calSidebar: boolean;
  /** The to-do list: everything, or school work only. */
  todoScope: TodoScope;
  /** The to-do list's order: most urgent first, or shortest first. */
  todoSort: TodoSort;
}

const VIEWS: View[] = ["plan", "calendar", "upcoming", "settings", "help"];
const CAL_MODES: CalMode[] = ["month", "week", "day", "3day", "schedule"];
const SETTINGS_PANELS: SettingsPanel[] = ["main", "calendars", "classes", "schedule", "estimates", "browser", "about"];
const DEFAULT_UI: UiPrefs = {
  view: "plan",
  calMode: "week",
  filters: DEFAULT_FILTERS,
  setupDone: false,
  hideClassTimesTip: false,
  settingsPanel: "main",
  calSidebar: true,
  todoScope: "all",
  todoSort: "due",
};

function parseUi(raw: string | null): UiPrefs {
  const p = parseJson<Partial<UiPrefs>>(raw);
  if (!p || typeof p !== "object") return DEFAULT_UI;
  const f = p.filters;
  return {
    // Classes was folded into Upcoming; a saved "classes" view opens Upcoming.
    view: (p.view as string) === "classes" ? "upcoming" : p.view && VIEWS.includes(p.view) ? p.view : DEFAULT_UI.view,
    calMode: p.calMode && CAL_MODES.includes(p.calMode) ? p.calMode : DEFAULT_UI.calMode,
    filters: {
      // One class or all of them (class tabs). An older multi-class choice falls back to all.
      courses: Array.isArray(f?.courses) && f.courses.length === 1 && typeof f.courses[0] === "string" ? [f.courses[0]] : null,
      // Type filters were retired; one saved by an older version must not hide work.
      types: null,
      showCompleted: Boolean(f?.showCompleted),
    },
    setupDone: p.setupDone === true,
    hideClassTimesTip: p.hideClassTimesTip === true,
    settingsPanel: p.settingsPanel && SETTINGS_PANELS.includes(p.settingsPanel) ? p.settingsPanel : DEFAULT_UI.settingsPanel,
    calSidebar: p.calSidebar !== false,
    todoScope: p.todoScope === "school" ? "school" : "all",
    todoSort: p.todoSort === "duration" ? "duration" : "due",
  };
}

function writeUi(patch: Partial<UiPrefs>) {
  writeStored(KEYS.ui, JSON.stringify({ ...parseUi(readStored(KEYS.ui)), ...patch }));
}

const EMPTY_SNAPSHOT: Snapshot = { feeds: {}, at: null };

/** A stored snapshot from an older version, or a damaged one, is dropped rather than trusted. */
function parseSnapshot(raw: string | null): Snapshot {
  const s = parseJson<Snapshot>(raw);
  if (!s || typeof s !== "object" || typeof s.feeds !== "object" || s.feeds === null) return EMPTY_SNAPSHOT;
  const feeds: Snapshot["feeds"] = {};
  for (const [id, state] of Object.entries(s.feeds)) {
    const r = state?.result;
    const valid = r === null || (r && Array.isArray(r.courses) && Array.isArray(r.tasks) && Array.isArray(r.events));
    if (state && valid) feeds[id] = { result: r ?? null, error: state.error ?? null, syncedAt: state.syncedAt ?? null };
  }
  return { feeds, at: typeof s.at === "string" ? s.at : null };
}

function parseChanges(raw: string | null): Change[] {
  const c = parseJson<Change[]>(raw);
  return Array.isArray(c) ? c.filter((x) => x && typeof x.id === "string" && typeof x.taskId === "string") : [];
}

const readWorkspace = () => sanitizeWorkspace(parseJson(readStored(KEYS.workspace)));
const readSnapshot = () => parseSnapshot(readStored(KEYS.snapshot));

function writeJson(key: string, value: unknown): boolean {
  return writeStored(key, JSON.stringify(value));
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ---------------------------------------------------------------------------
// Moving a setup over from another device
// ---------------------------------------------------------------------------

type Incoming = { pending: Workspace | null; message: string | null };

function applyImport(ws: Workspace) {
  writeJson(KEYS.workspace, ws);
  writeStored(KEYS.snapshot, null);
  writeStored(KEYS.changes, null);
  writeUi({ setupDone: true, view: "plan" });
}

/**
 * A setup link carries the workspace in the URL fragment (#setup=...). If this
 * browser already has calendars of its own, the user is asked before anything is
 * replaced.
 */
function takeSetupFromUrl(): Incoming {
  if (typeof window === "undefined" || !window.location.hash.startsWith("#setup=")) return { pending: null, message: null };
  const imported = decodeSetup(window.location.hash.slice("#setup=".length));
  if (!imported) return { pending: null, message: "That setup link is incomplete. Copy it again from your other device." };
  const current = readWorkspace();
  if (current.feeds.length === 0 || current.demo) {
    applyImport(imported);
    return { pending: null, message: `Setup imported · ${plural(imported.feeds.length, "calendar")}` };
  }
  return { pending: imported, message: null };
}

/**
 * The home page's "Try it with sample data" opens /app#demo. Sample data never
 * replaces calendars someone has already added.
 */
function takeDemoFromUrl(): Incoming | null {
  if (typeof window === "undefined" || window.location.hash !== "#demo") return null;
  const current = readWorkspace();
  if (current.feeds.length > 0 && !current.demo) return { pending: null, message: "You already have calendars set up, so the sample data wasn't loaded." };
  startDemo();
  return { pending: null, message: null };
}

/**
 * What the link that opened the page asked for, worked out once. React can start
 * the app's first render over, and an import must not be lost, or run twice, when
 * it does. The fragment is cleared from the address bar once the app is on screen.
 */
let opened: Incoming | null = null;

function takeFromUrl(): Incoming {
  if (!opened) {
    // Every visit opens on the Plan screen, which leads with what SmartScheduler does,
    // unless the address names a screen (?view=calendar). The calendar mode and filters
    // are still remembered.
    const asked = viewFromUrl();
    const raw = readStored(KEYS.ui);
    if (asked) writeUi({ view: asked });
    else if (raw && parseUi(raw).view !== "plan") writeUi({ view: "plan" });
    opened = takeDemoFromUrl() ?? takeSetupFromUrl();
  }
  return opened;
}

/** The screen named in the address (?view=upcoming), if it is one. */
function viewFromUrl(): View | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("view");
  if (v === "classes") return "upcoming";
  return v && VIEWS.includes(v as View) ? (v as View) : null;
}

function clearUrlFragment() {
  opened = null;
  const { hash, pathname, search } = window.location;
  if (hash === "#demo" || hash.startsWith("#setup=")) history.replaceState(null, "", pathname + search);
}

// ---------------------------------------------------------------------------

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

const MINUTE = 60_000;

export function App() {
  const [incoming, setIncoming] = useState<Incoming>(takeFromUrl);
  useEffect(() => clearUrlFragment(), []);
  const wsRaw = useStored(KEYS.workspace);
  const snapRaw = useStored(KEYS.snapshot);
  const changesRaw = useStored(KEYS.changes);
  const newRaw = useStored(KEYS.newWork);
  const uiRaw = useStored(KEYS.ui);

  const ws = useMemo(() => sanitizeWorkspace(parseJson(wsRaw)), [wsRaw]);
  const snapshot = useMemo(() => parseSnapshot(snapRaw), [snapRaw]);
  const changes = useMemo(() => parseChanges(changesRaw), [changesRaw]);
  const ui = useMemo(() => parseUi(uiRaw), [uiRaw]);

  // Each screen has its own address (/app?view=calendar), so the browser's Back
  // button works, a link can open a screen, and testing tools can tell screens apart.
  const firstView = useRef(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") === ui.view) return;
    url.searchParams.set("view", ui.view);
    if (firstView.current) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    firstView.current = false;
  }, [ui.view]);
  useEffect(() => {
    const onPop = () => {
      const v = viewFromUrl();
      if (v && v !== parseUi(readStored(KEYS.ui)).view) writeUi({ view: v });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [timezone] = useState(browserTimezone);

  const now = useNow();
  // The plan only needs to move when the minute changes.
  const minute = Math.floor(now.getTime() / MINUTE);
  const model = useMemo(() => buildModel(ws, snapshot, new Date(minute * MINUTE)), [ws, snapshot, minute]);
  const plan = useMemo(() => makePlan(model, ws.prefs, new Date(minute * MINUTE), ws.blocks), [model, ws.prefs, ws.blocks, minute]);
  const index = useMemo(() => indexPlan(plan), [plan]);
  const newWork = useMemo(() => newIds(parseNewWork(newRaw), new Date(minute * MINUTE)), [newRaw, minute]);

  const [calCursor, setCalCursor] = useState(() => new Date());
  const [planDay, setPlanDay] = useState(0);
  const [selected, setSelected] = useState<Selection>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [classTimesOpen, setClassTimesOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const [toastMsg, setToastMsg] = useState<{ message: string; undo?: () => void } | null>(incoming.message ? { message: incoming.message } : null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string, options?: { undo?: () => void }) => {
    setToastMsg({ message, undo: options?.undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Leave a little longer to read and reach Undo.
    toastTimer.current = setTimeout(() => setToastMsg(null), options?.undo ? 6000 : 3600);
  }, []);
  useEffect(() => {
    if (!incoming.message) return;
    const t = setTimeout(() => setToastMsg(null), 3600);
    return () => clearTimeout(t);
  }, [incoming.message]);

  const update = useCallback(
    (fn: (w: Workspace) => Workspace) => {
      if (!writeJson(KEYS.workspace, fn(readWorkspace()))) toast("This browser would not save that change. Is site storage turned off?");
    },
    [toast],
  );

  const seeWork = useCallback((taskIds: string[]) => {
    const work = parseNewWork(readStored(KEYS.newWork));
    if (taskIds.some((id) => work[id])) writeJson(KEYS.newWork, seeNewWork(work, taskIds));
  }, []);

  /** Mark work as done without touching anything the user already marked. */
  const markDone = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      // "auto:" marks work assumed done (it was already past due), so it never counts toward today's goal.
      const at = `auto:${new Date().toISOString()}`;
      update((w) => ({ ...w, done: { ...Object.fromEntries(ids.map((id) => [id, at])), ...w.done } }));
    },
    [update],
  );

  const saveSnapshot = useCallback(
    (s: Snapshot) => {
      if (!writeJson(KEYS.snapshot, s)) toast("Browser storage is full, so calendars will be re-read next time you open SmartScheduler.");
    },
    [toast],
  );

  // -------------------------------------------------------------------------
  // Syncing
  // -------------------------------------------------------------------------

  const runSync = useCallback(
    async (quiet: boolean) => {
      if (syncingRef.current) return;
      const before = readWorkspace();
      if (!before.feeds.some((f) => f.enabled)) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const at = new Date();
        const firstRead = readSnapshot().at === null;
        const outcome = await syncAll(before, readSnapshot(), fetchFeedFromApi, timezone, at);

        // Calendars may have been added, removed or switched while this ran.
        // Keep fresh results only for calendars that are still set up the same way.
        const after = readWorkspace();
        const latest = readSnapshot();
        const feeds: Snapshot["feeds"] = {};
        for (const f of after.feeds) {
          const was = before.feeds.find((b) => b.id === f.id);
          const fresh = outcome.snapshot.feeds[f.id];
          feeds[f.id] = fresh && was && was.role === f.role && was.enabled === f.enabled ? fresh : latest.feeds[f.id];
          if (!feeds[f.id]) delete feeds[f.id];
        }
        saveSnapshot({ feeds, at: outcome.snapshot.at });

        // Sample data starts the way a real semester looks: older work handed in,
        // yesterday's still to do.
        if (firstRead && after.demo) {
          const cutoff = new Date(at.getTime() - 86_400_000);
          markDone(after.feeds.flatMap((f) => (feeds[f.id]?.result ? pastDueIds(f.id, feeds[f.id]!.result!, cutoff) : [])));
        }

        if (outcome.changes.length) {
          writeJson(KEYS.changes, mergeChanges(outcome.changes, parseChanges(readStored(KEYS.changes)), at));
          writeJson(KEYS.newWork, addNewWork(parseNewWork(readStored(KEYS.newWork)), outcome.changes, at));
        }

        if (outcome.failed > 0) toast(outcome.failed === 1 ? "One calendar couldn't be read. Its last copy is still shown." : `${outcome.failed} calendars couldn't be read. Their last copies are still shown.`);
        else if (outcome.changes.length) toast(`${plural(outcome.changes.length, "change")} from your classes · see the bell`);
        else if (!quiet) toast("Everything is up to date");
      } catch (e) {
        if (!quiet) toast(e instanceof Error ? e.message : "Sync failed");
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [timezone, toast, saveSnapshot, markDone],
  );

  const sync = useCallback(() => runSync(false), [runSync]);
  const ready = ui.setupDone && ws.feeds.length > 0;

  // Keep calendars fresh without anyone thinking about it: when the page opens,
  // when the tab comes back into view, and every half hour while it is open.
  useEffect(() => {
    if (!ready) return;
    const olderThan = (ms: number) => {
      const at = readSnapshot().at;
      return !at || Date.now() - Date.parse(at) > ms;
    };
    const kick = setTimeout(() => {
      if (olderThan(5 * MINUTE)) void runSync(true);
    }, 0);
    const onVisible = () => {
      if (document.visibilityState === "visible" && olderThan(10 * MINUTE)) void runSync(true);
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && olderThan(29 * MINUTE)) void runSync(true);
    }, MINUTE);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [ready, runSync]);

  // -------------------------------------------------------------------------
  // Calendars
  // -------------------------------------------------------------------------

  const addFeed = useCallback(
    (result: FeedResult): number => {
      const url = result.url;
      const id = feedIdFor(url);
      const known = readWorkspace().feeds.some((f) => f.id === id);
      update((w) => {
        if (w.feeds.some((f) => f.id === id)) return w;
        const name = result.provider === "canvas" ? "Canvas" : result.calendarName?.trim() || PROVIDER_LABEL[result.provider];
        return {
          ...w,
          feeds: [
            ...w.feeds,
            { id, url, name: name.slice(0, 60), role: result.role, provider: result.provider, color: nextPersonalColor(w.feeds), enabled: true },
          ],
        };
      });
      const snap = readSnapshot();
      saveSnapshot({ ...snap, feeds: { ...snap.feeds, [id]: { result, error: null, syncedAt: result.fetchedAt } } });
      if (!known) trackEvent("calendar_added", { provider: result.provider, role: result.role, classes: result.courses.length });
      if (known || result.role !== "school") return 0;
      const past = pastDueIds(id, result, new Date());
      markDone(past);
      return past.length;
    },
    [update, saveSnapshot, markDone],
  );

  const removeFeed = useCallback(
    (id: string) => {
      update((w) => ({ ...w, feeds: w.feeds.filter((f) => f.id !== id) }));
      const snap = readSnapshot();
      const feeds = { ...snap.feeds };
      delete feeds[id];
      saveSnapshot({ ...snap, feeds });
    },
    [update, saveSnapshot],
  );

  const setFeedRole = useCallback(
    async (id: string, role: FeedRole) => {
      const feed = readWorkspace().feeds.find((f) => f.id === id);
      if (!feed || feed.role === role) return;
      update((w) => ({ ...w, feeds: w.feeds.map((f) => (f.id === id ? { ...f, role } : f)) }));
      setSyncing(true);
      try {
        const result = await fetchFeedFromApi(feed.url, role, timezone);
        const snap = readSnapshot();
        saveSnapshot({ ...snap, feeds: { ...snap.feeds, [id]: { result, error: null, syncedAt: result.fetchedAt } } });
        if (role === "school" && !snap.feeds[id]?.result?.tasks.length) markDone(pastDueIds(id, result, new Date()));
      } catch (e) {
        toast(e instanceof Error ? e.message : "That calendar could not be re-read.");
      } finally {
        setSyncing(syncingRef.current);
      }
    },
    [update, saveSnapshot, timezone, toast, markDone],
  );

  // -------------------------------------------------------------------------
  // Work
  // -------------------------------------------------------------------------

  const toggleDone = useCallback(
    (task: Task) => {
      const flip = () =>
        update((w) => {
          const done = { ...w.done };
          if (done[task.id]) delete done[task.id];
          else done[task.id] = new Date().toISOString();
          return { ...w, done };
        });
      flip();
      seeWork([task.id]);
      trackEvent(task.done ? "task_uncompleted" : "task_completed", { taskId: task.id, title: task.title, from: parseUi(readStored(KEYS.ui)).view });
      // Ticking something off moves the whole plan, so say so and offer a way back.
      toast(task.done ? `Moved back to your plan: ${task.title}` : `Done: ${task.title}`, { undo: flip });
    },
    [update, toast, seeWork],
  );

  const completeTask = useCallback(
    (task: Task, opts?: { celebrate?: boolean }) => {
      if (task.done) {
        toggleDone(task);
        return;
      }
      const flip = () =>
        update((w) => {
          const done = { ...w.done };
          delete done[task.id];
          return { ...w, done };
        });
      update((w) => ({ ...w, done: { ...w.done, [task.id]: new Date().toISOString() } }));
      seeWork([task.id]);
      trackEvent("task_completed", { taskId: task.id, title: task.title, from: parseUi(readStored(KEYS.ui)).view });
      if (opts?.celebrate === false) toast(`Done: ${task.title}`, { undo: flip });
      else setSelected({ kind: "completed", id: task.id });
    },
    [update, toggleDone, toast, seeWork],
  );

  const setEstimate = useCallback(
    (taskId: string, minutes: number | null, source: EstimateSource = "user") => {
      update((w) => {
        const estimates = { ...w.estimates };
        if (minutes === null) delete estimates[taskId];
        else estimates[taskId] = { minutes: Math.max(5, Math.min(24 * 60, Math.round(minutes))), source, at: new Date().toISOString() };
        return { ...w, estimates };
      });
      seeWork([taskId]);
    },
    [update, seeWork],
  );

  // ---------------------------------------------------------------------------
  // Time set aside on the calendar
  // ---------------------------------------------------------------------------

  /** Change one block, saying what happened and offering a way back. */
  const changeBlock = useCallback(
    (before: ScheduledBlock | null, after: ScheduledBlock | null, message: string) => {
      const swap = (from: ScheduledBlock | null, to: ScheduledBlock | null) =>
        update((w) => {
          let blocks = from ? dropBlock(w.blocks, from.id) : w.blocks;
          if (to) blocks = putBlock(blocks, to);
          return { ...w, blocks };
        });
      swap(before, after);
      toast(message, { undo: () => swap(after, before) });
    },
    [update, toast],
  );

  const blockTitle = useCallback((b: ScheduledBlock) => model.tasks.find((t) => t.id === b.taskId)?.title ?? b.title, [model.tasks]);
  const when = (d: Date) => `${format(d, "EEE")} ${clock(d)}`;

  const scheduleTask = useCallback(
    (task: Task, start: Date) => {
      const block = makeBlock(randomId(), task, start, task.estimate, new Date());
      if (Date.parse(block.end) <= Date.now()) {
        toast("That time has already passed. Pick a time from now on.");
        return;
      }
      trackEvent("task_planned", { taskId: task.id, title: task.title, at: block.start });
      changeBlock(null, block, `Scheduled ${when(start)}: ${task.title}`);
      seeWork([task.id]);
    },
    [changeBlock, toast, seeWork],
  );

  const moveScheduled = useCallback(
    (blockId: string, start: Date) => {
      const before = readWorkspace().blocks.find((b) => b.id === blockId);
      if (!before || Date.parse(before.start) === start.getTime()) return;
      const after = moveBlockTo(before, start, new Date());
      if (Date.parse(after.end) <= Date.now()) {
        toast("That time has already passed. Pick a time from now on.");
        return;
      }
      trackEvent("task_planned", { taskId: before.taskId, at: after.start });
      changeBlock(before, after, `Moved to ${when(start)}: ${blockTitle(before)}`);
    },
    [changeBlock, toast, blockTitle],
  );

  const resizeScheduled = useCallback(
    (blockId: string, end: Date) => {
      const before = readWorkspace().blocks.find((b) => b.id === blockId);
      if (!before || Date.parse(before.end) === end.getTime()) return;
      const after = resizeBlockTo(before, end, new Date());
      changeBlock(before, after, `${blockTitle(before)}: now ${duration(blockMinutes(after))}, until ${clock(new Date(after.end))}`);
    },
    [changeBlock, blockTitle],
  );

  const unschedule = useCallback(
    (blockId: string) => {
      const before = readWorkspace().blocks.find((b) => b.id === blockId);
      if (!before) return;
      trackEvent("task_unplanned", { taskId: before.taskId });
      changeBlock(before, null, `Back on your to-do list: ${blockTitle(before)}`);
    },
    [changeBlock, blockTitle],
  );

  const answerUnfinished = useCallback(
    (taskIds: string[], back: boolean) => {
      const prev = readWorkspace().unfinishedAnswers;
      const at = new Date().toISOString();
      const write = (answers: Workspace["unfinishedAnswers"]) => update((w) => ({ ...w, unfinishedAnswers: answers }));
      write({ ...prev, ...Object.fromEntries(taskIds.map((id) => [id, { at, back }])) });
      trackEvent(back ? "unfinished_returned" : "unfinished_left_off", { count: taskIds.length });
      const n = plural(taskIds.length, "task");
      toast(back ? `Back on your to-do list: ${n}` : `Left off your to-do list: ${n}`, { undo: () => write(prev) });
    },
    [update, toast],
  );

  const setView = useCallback((v: View) => {
    if (v !== parseUi(readStored(KEYS.ui)).view) trackEvent("view_changed", { view: v });
    writeUi(v === "settings" ? { view: v, settingsPanel: "main" } : { view: v });
  }, []);

  /** Opening something is a smart event too: which task, free gap or explanation. */
  const select = useCallback(
    (s: Selection) => {
      if (s?.kind === "task") {
        trackEvent("task_opened", { taskId: s.id });
        seeWork([s.id]);
      }
      else if (s?.kind === "gap") trackEvent("free_gap_opened", { at: new Date(s.startMs).toISOString() });
      else if (s?.kind === "why") trackEvent("why_opened", { taskId: s.id });
      setSelected(s);
    },
    [seeWork],
  );
  const setSettingsPanel = useCallback((p: SettingsPanel) => writeUi({ view: "settings", settingsPanel: p }), []);
  const setCalMode = useCallback((m: CalMode) => writeUi({ calMode: m }), []);
  const setFilters = useCallback((f: Filters | ((prev: Filters) => Filters)) => {
    const prev = parseUi(readStored(KEYS.ui)).filters;
    writeUi({ filters: typeof f === "function" ? f(prev) : f });
  }, []);

  const reveal = useCallback(
    (taskId: string) => {
      const task = model.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.dueAt) {
        setCalCursor(new Date(task.dueAt));
        writeUi({ view: "calendar", calMode: "day" });
      }
      setSelected({ kind: "task", id: taskId });
      seeWork([taskId]);
    },
    [model.tasks, seeWork],
  );

  const clearChanges = useCallback(() => writeStored(KEYS.changes, null), []);

  // A plan day past the horizon (after midnight rolls over) falls back to today.
  const safePlanDay = planDay < plan.days.length ? planDay : 0;

  const ctx: AppContextValue = {
    ws,
    snapshot,
    model,
    plan,
    index,
    changes,
    newWork,
    now,
    timezone,
    update,
    toggleDone,
    setEstimate,
    scheduleTask,
    moveScheduled,
    resizeScheduled,
    unschedule,
    answerUnfinished,
    addFeed,
    removeFeed,
    setFeedRole,
    syncing,
    sync,
    view: ui.view,
    setView,
    settingsPanel: ui.settingsPanel,
    setSettingsPanel,
    calMode: ui.calMode,
    setCalMode,
    calSidebar: ui.calSidebar,
    setCalSidebar: (open: boolean) => writeUi({ calSidebar: open }),
    todoScope: ui.todoScope,
    setTodoScope: (scope: TodoScope) => writeUi({ todoScope: scope }),
    todoSort: ui.todoSort,
    setTodoSort: (sort: TodoSort) => writeUi({ todoSort: sort }),
    calCursor,
    setCalCursor,
    planDay: safePlanDay,
    setPlanDay,
    filters: ui.filters,
    setFilters,
    selected,
    select,
    reveal,
    openAddTask: () => {
      trackEvent("add_task_opened");
      setAddOpen(true);
    },
    openClassTimes: () => setClassTimesOpen(true),
    classTimesTipHidden: ui.hideClassTimesTip,
    hideClassTimesTip: () => writeUi({ hideClassTimesTip: true }),
    clearChanges,
    seeWork,
    toast,
    openGoal: openGoalNotice,
    completeTask,
  };

  const finishSetup = useCallback(() => {
    trackEvent("setup_finished");
    writeUi({ setupDone: true, view: "plan" });
  }, []);

  return (
    <AppContext.Provider value={ctx}>
      {!ready ? (
        <Onboarding onFinish={finishSetup} />
      ) : (
        <div className="min-h-dvh flex flex-col">
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-32 md:pb-24">
            {ui.view === "plan" ? <PlanHeading /> : <ViewHeading />}
            <Banners />
            <div className="mt-4 fade-in" key={ui.view === "settings" ? `settings:${ui.settingsPanel}` : ui.view}>
              {ui.view === "plan" && <PlanView />}
              {ui.view === "calendar" && <CalendarView />}
              {ui.view === "upcoming" && <UpcomingView />}
              {ui.view === "settings" && <SettingsView />}
              {ui.view === "help" && <HelpView />}
            </div>
          </main>
          <BottomNav />
          {selected ? <DetailPanel selection={selected} onClose={() => setSelected(null)} /> : null}
          {addOpen ? <AddTaskDialog onClose={() => setAddOpen(false)} /> : null}
          {classTimesOpen ? <ClassTimesDialog onClose={() => setClassTimesOpen(false)} /> : null}
          <AppTour blocked={Boolean(selected || addOpen || classTimesOpen || incoming.pending)} />
          <UnfinishedPrompt blocked={Boolean(selected || addOpen || classTimesOpen || incoming.pending)} />
        </div>
      )}
      {incoming.pending ? (
        <ImportDialog
          incoming={incoming.pending}
          onCancel={() => setIncoming({ pending: null, message: null })}
          onConfirm={() => {
            applyImport(incoming.pending!);
            setIncoming({ pending: null, message: null });
            toast(`Setup imported · ${plural(incoming.pending!.feeds.length, "calendar")}`);
          }}
        />
      ) : null}
      {toastMsg ? (
        <Toast
          message={toastMsg.message}
          action={toastMsg.undo ? "Undo" : undefined}
          onAction={() => {
            toastMsg.undo?.();
            setToastMsg(null);
          }}
        />
      ) : null}
    </AppContext.Provider>
  );
}
