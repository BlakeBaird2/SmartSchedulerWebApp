"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { planDragActive } from "./planDrag";

/** How far a finger moves before it counts as a swipe rather than a tap or a scroll. */
const SLOP = 10;
/** A swipe past this share of the width, or a quick flick, turns the page. */
const TURN_SHARE = 0.2;
const FLICK_PX_PER_MS = 0.45;
const OUT_MS = 170;
const IN_MS = 220;

/**
 * Swiping the calendar left or right on a phone, as in Google Calendar's app:
 * the days follow the finger, and a swipe far or fast enough slides them out and
 * the next (or previous) days in. Up and down still scroll the hours, and holding
 * still still picks up an event to move it (planDrag.ts); a swipe never opens
 * what it started on.
 *
 * The days move by a CSS variable, --ss-swipe, set on the element while it moves;
 * the stylesheet moves the day columns and headers by it and leaves the hours where
 * they are. `turn` runs synchronously, so the new days are drawn before they slide in.
 */
export function useDaySwipe(ref: React.RefObject<HTMLElement | null>, enabled: boolean, turn: (dir: 1 | -1) => void) {
  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout> | null = null;

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
      if (e.pointerType === "mouse" || !e.isPrimary || timer) return;
      const id = e.pointerId;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let state: "pending" | "swiping" | "off" = "pending";
      let dx = 0;
      let lastX = x0;
      let lastT = e.timeStamp;
      let speed = 0;

      const done = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      };
      const back = () => {
        set(0, OUT_MS);
        timer = setTimeout(() => {
          timer = null;
          settle();
        }, OUT_MS);
      };
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
        set(dx, 0);
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

        const width = el.clientWidth || 1;
        const far = Math.abs(dx) > width * TURN_SHARE;
        const flick = Math.abs(speed) > FLICK_PX_PER_MS && Math.sign(speed) === Math.sign(dx);
        if (!far && !flick) return back();
        // Swiping left shows what comes next.
        const dir: 1 | -1 = dx < 0 ? 1 : -1;
        if (reduced) {
          settle();
          turnRef.current(dir);
          return;
        }
        set(-dir * width, OUT_MS);
        timer = setTimeout(() => {
          flushSync(() => turnRef.current(dir));
          set(dir * width, 0);
          // Draw the new days off to the side before sliding them in.
          void el.offsetWidth;
          set(0, IN_MS);
          timer = setTimeout(() => {
            timer = null;
            settle();
          }, IN_MS);
        }, OUT_MS);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        done();
        if (state === "swiping") back();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    };

    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      if (timer) clearTimeout(timer);
      settle();
    };
  }, [ref, enabled]);
}
