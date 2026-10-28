"use client";

import { useSyncExternalStore } from "react";
import { MIN_BLOCK_MINUTES, snapMinutes } from "@/lib/blocks";

/**
 * Dragging work onto the calendar, moving it, and resizing it: with a mouse, a
 * finger or a pen, through one set of pointer events.
 *
 * A mouse starts a drag once it moves a few pixels, so a plain click still opens
 * things. A finger has to hold still for a moment first (a long press, as in
 * Google Calendar's app), so swiping still scrolls the list and the page. Resize
 * handles start straight away, since they never scroll anything.
 *
 * While a drag is under way it lives here, where any part of the screen can read
 * it: the calendar draws where the block would land, free gaps light up, the
 * to-do list shows it can take scheduled work back, and the phone's to-do sheet
 * gets out of the way.
 *
 * The calendar's day columns describe themselves with data attributes, so this
 * file can work out the time under the pointer without knowing how they are drawn:
 * data-drop-day (the day's midnight, in ms), data-drop-min and data-drop-max (the
 * first and last minute shown), data-drop-top (px above the first minute) and
 * data-drop-ppm (px per minute). The to-do list marks itself data-drop-list, and a
 * day in the month view data-drop-date (its midnight, in ms): work dropped there
 * goes into that day's first free time.
 */

export type DragKind = "new" | "move" | "resize";

export interface DragPayload {
  /** new: a task from the list. move / resize: a block already on the calendar. */
  kind: DragKind;
  taskId: string | null;
  blockId: string | null;
  title: string;
  /** How long the block is (or will be). */
  minutes: number;
  /** Minutes between the top of the block and where it was grabbed, so it doesn't jump. */
  grab: number;
  /** When the block starts (ms), for resizing. */
  start?: number;
  color: string;
  /** How wide the dragged thing was, and where across it it was grabbed (px), so its ghost matches it. */
  width?: number;
  grabX?: number;
}

/** Where a drag would land. Minutes count from the day's midnight. */
export type DropTarget =
  | { kind: "grid"; dayStart: number; startMinute: number; endMinute: number }
  | { kind: "date"; dayStart: number }
  | { kind: "list" };

export interface PlanDrag extends DragPayload {
  x: number;
  y: number;
  target: DropTarget | null;
  touch: boolean;
}

/** How far a mouse moves before a press becomes a drag. */
const MOUSE_SLOP = 5;
/** How long a finger holds still before a press becomes a drag, and how far it may wander meanwhile. */
const LONG_PRESS_MS = 350;
const TOUCH_SLOP = 10;

let current: PlanDrag | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// ---------------------------------------------------------------------------
// The calendar's scale
// ---------------------------------------------------------------------------

/** Below this width the app uses its phone layout. */
export const PHONE_QUERY = "(max-width: 820px)";
/** The shortest an hour is drawn on the calendar; hours stretch when the whole day fits. */
export const HOUR_PX = 64;
export const HOUR_PX_PHONE = 56;

/**
 * Pixels per minute on the calendar, as the time grid last drew it. The planner
 * draws each task this tall for its length, and the drag ghost keeps that size,
 * so work is the same size in the list, on its way and on the calendar.
 */
let scale: number | null = null;
const scaleListeners = new Set<() => void>();
const defaultScale = () => (typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches ? HOUR_PX_PHONE : HOUR_PX) / 60;

export function setCalendarScale(ppm: number) {
  if (scale !== null && Math.abs(scale - ppm) < 0.001) return;
  scale = ppm;
  scaleListeners.forEach((l) => l());
}

export function useCalendarScale(): number {
  return useSyncExternalStore(
    (l) => {
      scaleListeners.add(l);
      return () => scaleListeners.delete(l);
    },
    () => scale ?? defaultScale(),
    () => HOUR_PX / 60,
  );
}

/** How tall a block of this many minutes is on the calendar: a 3px gap above and below. */
export function blockHeight(minutes: number, ppm: number): number {
  return Math.max(16, minutes * ppm - 6);
}

// ---------------------------------------------------------------------------

export function usePlanDrag(): PlanDrag | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

/**
 * Where the pointer would drop the payload, if anywhere. It looks through anything
 * floating on top (a message, a badge) to the calendar or list underneath.
 */
function targetAt(x: number, y: number, d: DragPayload): DropTarget | null {
  let hit: HTMLElement | null = null;
  for (const el of document.elementsFromPoint(x, y)) {
    hit = el.closest<HTMLElement>("[data-drop-day],[data-drop-date],[data-drop-list]");
    if (hit) break;
  }
  // Resizing only ever changes the block's own day.
  const col =
    d.kind === "resize" && d.start !== undefined
      ? document.querySelector<HTMLElement>(`[data-drop-day="${new Date(d.start).setHours(0, 0, 0, 0)}"]`)
      : hit?.dataset.dropDay !== undefined
        ? hit
        : null;
  if (!col) {
    if (hit?.dataset.dropDate !== undefined && d.kind !== "resize") return { kind: "date", dayStart: Number(hit.dataset.dropDate) };
    return hit?.dataset.dropList !== undefined && d.kind === "move" ? { kind: "list" } : null;
  }

  const dayStart = Number(col.dataset.dropDay);
  const min = Number(col.dataset.dropMin);
  const max = Number(col.dataset.dropMax);
  const top = Number(col.dataset.dropTop);
  const ppm = Number(col.dataset.dropPpm);
  const minute = min + (y - col.getBoundingClientRect().top - top) / ppm;

  if (d.kind === "resize" && d.start !== undefined) {
    const startMinute = Math.round((d.start - dayStart) / 60_000);
    // The end moves as far as the pointer does, wherever on the edge it was grabbed.
    const endMinute = Math.min(24 * 60, Math.max(startMinute + MIN_BLOCK_MINUTES, snapMinutes(minute - d.grab + d.minutes)));
    return { kind: "grid", dayStart, startMinute, endMinute };
  }
  const latest = Math.max(min, max - Math.min(d.minutes, 60));
  const startMinute = Math.min(latest, Math.max(min, snapMinutes(minute - d.grab)));
  return { kind: "grid", dayStart, startMinute, endMinute: startMinute + d.minutes };
}

/**
 * Pages scroll by themselves when a drag nears the top or bottom of the screen.
 * `minY` and `maxY` are as far up and down as the pointer has been: a drag that
 * starts near an edge (a block's bottom edge just above the to-do sheet, say)
 * only scrolls once it heads further toward that edge.
 */
function edgeSpeed(y: number, minY: number, maxY: number): number {
  const headroom = 16;
  // Below the sticky header.
  const top = Math.min(88, maxY - headroom);
  // Phones and tablets keep the to-do sheet and the bottom bar down there.
  const from = Math.max(window.innerHeight - (window.innerWidth < 1024 ? 170 : 72), minY + headroom);
  if (y < top) return -Math.ceil(((top - y) / top) * 18);
  if (y > from) return Math.ceil(((y - from) / (window.innerHeight - from)) * 18);
  return 0;
}

/** A box that scrolls by itself under a drag (the calendar's hours: data-drag-scroll), if the pointer is over it. */
function scrollerAt(x: number, y: number): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-drag-scroll]")) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top - 80 && y <= r.bottom + 80) return el;
  }
  return null;
}

/** How fast to scroll a box: faster the closer the pointer gets to (or past) its top or bottom edge. */
function boxSpeed(y: number, top: number, bottom: number, minY: number, maxY: number): number {
  const zone = 56;
  const headroom = 16;
  // As with the page: a drag that starts near an edge scrolls only once it heads that way.
  const upper = Math.min(top + zone, maxY - headroom);
  const lower = Math.max(bottom - zone, minY + headroom);
  if (y < upper) return -Math.min(22, Math.ceil(((upper - y) / zone) * 14));
  if (y > lower) return Math.min(22, Math.ceil(((y - lower) / zone) * 14));
  return 0;
}

/**
 * Touch scrolling can only be stopped by a touchmove listener that isn't passive,
 * and only one that was there when the finger came down. Every drag source gets
 * one through this ref. It does nothing until a drag has started.
 */
function stopScroll(e: TouchEvent) {
  if (current) e.preventDefault();
}
export function dragSourceRef(el: HTMLElement | null) {
  if (!el) return;
  el.addEventListener("touchmove", stopScroll, { passive: false });
  return () => el.removeEventListener("touchmove", stopScroll);
}

/**
 * Start watching a press that may become a drag. `onDrop` runs if it is dropped
 * somewhere it can land; a press that never becomes a drag is left to act as a
 * click.
 */
export function beginPlanDrag(e: React.PointerEvent<HTMLElement>, payload: DragPayload, onDrop: (target: DropTarget) => void, opts: { immediate?: boolean } = {}) {
  if (current || (e.pointerType === "mouse" && e.button !== 0)) return;
  const touch = e.pointerType !== "mouse";
  const pointerId = e.pointerId;
  const startX = e.clientX;
  const startY = e.clientY;
  let x = startX;
  let y = startY;
  let minY = startY;
  let maxY = startY;
  let active = false;
  let frame = 0;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const update = () => {
    if (!current) return;
    current = { ...current, x, y, target: targetAt(x, y, current) };
    emit();
  };

  // While dragging near an edge, scroll (the calendar's hours, or the page) and keep
  // the drop time under the pointer.
  const tick = () => {
    if (!active) return;
    const box = scrollerAt(x, y);
    if (box) {
      const r = box.getBoundingClientRect();
      const speed = boxSpeed(y, r.top, r.bottom, minY, maxY);
      if (speed) {
        box.scrollTop += speed;
        update();
      }
    } else {
      const speed = edgeSpeed(y, minY, maxY);
      if (speed) {
        window.scrollBy(0, speed);
        update();
      }
    }
    frame = requestAnimationFrame(tick);
  };

  const activate = () => {
    active = true;
    current = { ...payload, x, y, target: null, touch };
    current = { ...current, target: targetAt(x, y, current) };
    document.documentElement.classList.add("plan-dragging");
    if (touch) navigator.vibrate?.(12);
    emit();
    frame = requestAnimationFrame(tick);
  };

  const finish = (drop: boolean) => {
    if (pressTimer) clearTimeout(pressTimer);
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("contextmenu", onContextMenu, true);
    if (!active) return;
    const target = current?.target ?? null;
    current = null;
    document.documentElement.classList.remove("plan-dragging");
    emit();
    // The release that ended a drag shouldn't also open whatever it ended on. That
    // click, when there is one, comes straight after the release; a later click is
    // a real one (Undo, say), so only the next moment is covered.
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 50);
    if (drop && target) onDrop(target);
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    x = ev.clientX;
    y = ev.clientY;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const moved = Math.hypot(x - startX, y - startY);
    if (!active) {
      if (touch && !opts.immediate) {
        // Moving before the long press completes means the finger is scrolling.
        if (moved > TOUCH_SLOP) finish(false);
        return;
      }
      if (moved > (touch ? 2 : MOUSE_SLOP)) activate();
      return;
    }
    update();
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId === pointerId) finish(true);
  };
  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId === pointerId) finish(false);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") finish(false);
  };
  // A long press would otherwise open the phone's own menu.
  const onContextMenu = (ev: Event) => {
    if (touch) ev.preventDefault();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
  window.addEventListener("contextmenu", onContextMenu, true);
  if (touch && !opts.immediate) pressTimer = setTimeout(activate, LONG_PRESS_MS);
}

/** The time a drop target starts, as a date. */
export function targetStart(t: Extract<DropTarget, { kind: "grid" }>): Date {
  const d = new Date(t.dayStart);
  d.setMinutes(t.startMinute);
  return d;
}

/** The time a drop target ends, as a date. */
export function targetEnd(t: Extract<DropTarget, { kind: "grid" }>): Date {
  const d = new Date(t.dayStart);
  d.setMinutes(t.endMinute);
  return d;
}

