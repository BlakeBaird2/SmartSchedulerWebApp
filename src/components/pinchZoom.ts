"use client";

import { useEffect, useRef } from "react";
import { KEYS, readStored, writeStored } from "./store";

/*
 * Pinching the calendar's hours with two fingers, as in Google Calendar's app:
 * spread your fingers apart and the hours stretch, so events get taller and
 * easier to read; pinch them together and the hours shrink, until the whole
 * day fits on the screen. The time between your fingers stays under them while
 * you pinch, and the size is remembered on this device for next time.
 *
 * Only the vertical distance between the fingers counts, since the hours run up
 * and down; the days across stay as they are. While two fingers are down, the
 * day swipe (daySwipe.ts) and press-and-hold to move an event (planDrag.ts)
 * stand aside, and the page itself doesn't zoom.
 */

/** The tallest an hour gets, in pixels: one hour fills most of a phone's screen. */
export const MAX_HOUR_PX = 240;
/** The smallest the fingers' distance counts as, so two fingers side by side don't jump the zoom. */
const MIN_SPAN = 40;

let active = false;
/** Whether two fingers are pinching the calendar right now. */
export function pinching(): boolean {
  return active;
}

/** The hour height picked by pinching on this device, if any. */
export function readHourPx(): number | null {
  const v = Number(readStored(KEYS.calZoom));
  return Number.isFinite(v) && v >= 8 && v <= MAX_HOUR_PX ? v : null;
}

export interface PinchOptions {
  /** How tall an hour is drawn now, in pixels. */
  hourPx: () => number;
  /** The smallest an hour may get: the whole day fits the frame. */
  minHourPx: () => number;
  /** Draw hours this tall, keeping `minute` (from the top of the hours) at `clientY` on screen. */
  zoom: (hourPx: number, anchor: { minute: number; clientY: number }) => void;
}

/** Follow two-finger pinches on `ref` (the scrolling hours). */
export function usePinchZoom(ref: React.RefObject<HTMLElement | null>, opts: PinchOptions) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { span: number; hourPx: number } | null = null;
    let last: number | null = null;
    let frame = 0;
    let pending: { hourPx: number; anchor: { minute: number; clientY: number } } | null = null;

    const span = (t: TouchList) => Math.max(MIN_SPAN, Math.abs(t[0].clientY - t[1].clientY));
    const middle = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2;
    /** The top of the hours on screen (the first day column), which moves as it scrolls. */
    const hoursTop = () => (el.querySelector(".ss-day-column") as HTMLElement | null)?.getBoundingClientRect().top ?? el.getBoundingClientRect().top;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      optsRef.current.zoom(pending.hourPx, pending.anchor);
      pending = null;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      start = { span: span(e.touches), hourPx: optsRef.current.hourPx() };
      last = null;
      active = true;
      el.setAttribute("data-pinching", "");
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      // Two fingers here are a pinch, not a scroll or a page zoom.
      e.preventDefault();
      const { hourPx, minHourPx } = optsRef.current;
      const next = Math.min(MAX_HOUR_PX, Math.max(minHourPx(), (start.hourPx * span(e.touches)) / start.span));
      const clientY = middle(e.touches);
      const minute = (clientY - hoursTop()) / (hourPx() / 60);
      last = next;
      pending = { hourPx: next, anchor: { minute, clientY } };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return;
      start = null;
      active = false;
      el.removeAttribute("data-pinching");
      if (last !== null) writeStored(KEYS.calZoom, String(Math.round(last)));
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      if (frame) cancelAnimationFrame(frame);
      active = false;
    };
  }, [ref]);
}
