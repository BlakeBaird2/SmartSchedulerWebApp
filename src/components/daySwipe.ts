"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { planDragActive } from "./planDrag";

/** How far a finger moves before it counts as a swipe rather than a tap or a scroll. */
const SLOP = 10;
/** A quick flick moves at least a day, however short it was. */
const FLICK_PX_PER_MS = 0.45;
/** How far a flick carries on after the finger lifts: its speed for this long. */
const GLIDE_MS = 220;
const BACK_MS = 170;

/**
 * Sliding the calendar left or right on a phone, as in Google Calendar's app: the
 * days follow the finger, and when it lifts they glide on and settle on whichever
 * day is nearest, so any day can be the first one shown. A flick carries further,
 * up to `maxDays` (the days drawn off to each side). Up and down still scroll the
 * hours, and holding still still picks up an event to move it (planDrag.ts); a
 * swipe never opens what it started on.
 *
 * The days move by a CSS variable, --ss-swipe, set on the element while it moves;
 * the stylesheet moves the day columns and headers by it and leaves the hours where
 * they are. Once they settle, `turn` moves the first day shown by that many days,
 * synchronously, so the days are redrawn in place without a jump.
 */
export function useDaySwipe(ref: React.RefObject<HTMLElement | null>, enabled: boolean, maxDays: number, turn: (days: number) => void) {
  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** Stops the swipe in progress, when a second finger turns it into a pinch (pinchZoom.ts). */
    let cancel: (() => void) | null = null;

    const set = (px: number, ms: number) => {
      el.style.setProperty("--ss-swipe", `${px}px`);
      el.style.setProperty("--ss-swipe-ms", `${ms}ms`);
    };
    const settle = () => {
      el.removeAttribute("data-swiping");
      el.style.removeProperty("--ss-swipe");
      el.style.removeProperty("--ss-swipe-ms");
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !e.isPrimary) {
        cancel?.();
        return;
      }
      if (e.pointerType === "mouse" || timer) return;
      const id = e.pointerId;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let state: "pending" | "swiping" | "off" = "pending";
      let dx = 0;
      let lastX = x0;
      let lastT = e.timeStamp;
      let speed = 0;

      const done = () => {
        cancel = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      };
      const back = () => {
        set(0, BACK_MS);
        timer = setTimeout(() => {
          timer = null;
          settle();
        }, BACK_MS);
      };
      const column = () => (el.querySelector(".ss-day-column") as HTMLElement | null)?.getBoundingClientRect().width || el.clientWidth || 1;
      const limit = () => column() * maxDays;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (state === "pending") {
          if (planDragActive() || (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx))) {
            state = "off";
            done();
            return;
          }
          if (Math.abs(dx) <= SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          state = "swiping";
          el.setAttribute("data-swiping", "");
        }
        if (planDragActive()) {
          state = "off";
          done();
          back();
          return;
        }
        const dt = ev.timeStamp - lastT;
        if (dt > 0) speed = (ev.clientX - lastX) / dt;
        lastX = ev.clientX;
        lastT = ev.timeStamp;
        // No further than the days drawn off to the side.
        set(Math.max(-limit(), Math.min(limit(), dx)), 0);
      };
      /** The finger lifted, or the browser took the touch away: glide on and settle on the nearest day. */
      const release = () => {
        const col = column();
        const at = Math.max(-limit(), Math.min(limit(), dx));
        const flick = Math.abs(speed) > FLICK_PX_PER_MS && Math.sign(speed) === Math.sign(dx);
        // Swiping left shows what comes next.
        let days = Math.round(-(at + (flick ? speed * GLIDE_MS : 0)) / col);
        if (days === 0 && flick) days = dx < 0 ? 1 : -1;
        days = Math.max(-maxDays, Math.min(maxDays, days));
        if (days === 0) return back();
        if (reduced) {
          settle();
          turnRef.current(days);
          return;
        }
        // Longer glides take a little longer, as a flick slows down.
        const ms = Math.round(Math.min(380, Math.max(180, 140 + Math.abs(-days * col - at) * 0.35)));
        set(-days * col, ms);
        timer = setTimeout(() => {
          timer = null;
          // The days redraw starting from the one settled on, and the slide resets in the same frame.
          flushSync(() => turnRef.current(days));
          settle();
        }, ms);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        done();
        if (state !== "swiping") return;
        // The lift that ends a swipe isn't a tap on whatever it ended over.
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, true), 50);
        release();
      };
      // A browser can still take a touch over partway (Safari does for some
      // gestures). A swipe that had already gone far enough still turns the page.
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        done();
        if (state === "swiping") release();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      cancel = () => {
        const was = state;
        state = "off";
        done();
        if (was === "swiping") back();
      };
    };

    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      if (timer) clearTimeout(timer);
      settle();
    };
  }, [ref, enabled, maxDays]);
}
