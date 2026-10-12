"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "./context";
import { TABS } from "./Header";

/**
 * Phones: the main views move from the top of the screen to a floating bar at the
 * bottom, where a thumb reaches them (Fitts's law). The open view is a raised,
 * tinted pill; every tab keeps a short label under its icon, so nothing has to be
 * guessed. Add task sits beside the bar as its own round button, always in reach.
 *
 * The whole bar is one control: touch it anywhere and the pill glides to your
 * finger, slide and it follows, and letting go opens the tab it's on. A quick tap
 * is the same gesture, so tapping a tab works as you'd expect.
 *
 * Settings and Help aren't tabs, so while one is open no tab is highlighted.
 */
export function BottomNav() {
  const { view, setView, openAddTask } = useApp();
  const track = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  // Where the pill is while a finger is on the bar, and how wide one tab is.
  // `follow` is false for the first glide to the finger, then true while it tracks the finger exactly.
  const [dragging, setDragging] = useState<{ left: number; w: number; follow: boolean } | null>(null);
  const suppressClick = useRef(false);

  const active = TABS.findIndex((t) => t.id === view);
  const nearest = (left: number, w: number) => Math.max(0, Math.min(TABS.length - 1, Math.round(left / (w || 1))));

  // While a finger is down, the tab under the pill is the one that reads as chosen.
  const shown = dragging ? nearest(dragging.left, dragging.w) : active;

  /** The pill's left edge with its centre under the finger, kept inside the bar. */
  const pillAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const w = rect.width / TABS.length;
    return { left: Math.max(0, Math.min(w * (TABS.length - 1), clientX - rect.left - w / 2)), w };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!track.current || pointer.current !== null) return;
    pointer.current = e.pointerId;
    track.current.setPointerCapture(e.pointerId);
    setDragging({ ...pillAt(e.clientX), follow: false });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId || !track.current) return;
    setDragging({ ...pillAt(e.clientX), follow: true });
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    // The pointer handled this press; skip the click it ends with (keyboard clicks still work).
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    if (commit && dragging) {
      const to = TABS[nearest(dragging.left, dragging.w)];
      if (to.id !== view) setView(to.id);
    }
    setDragging(null);
  };

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-none px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md flex items-center gap-2.5 pointer-events-auto">
        <nav aria-label="Main" className="flex-1 rounded-full border border-line bg-surface/90 backdrop-blur-md p-1.5 shadow-[var(--shadow-lg)]">
          <div
            ref={track}
            className="relative flex touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
          >
            {/* The pill: a layer under the tabs that slides between them. */}
            {active >= 0 || dragging ? (
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 rounded-full bg-accent-soft shadow-[var(--shadow-sm)] ${
                  dragging?.follow ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                }`}
                // At rest the pill sits on the open tab (100% = one tab's width); while held it follows the finger.
                style={{ width: `${100 / TABS.length}%`, transform: dragging ? `translateX(${dragging.left}px) scale(1.04)` : `translateX(${Math.max(active, 0) * 100}%)` }}
              />
            ) : null}
            {TABS.map((t, i) => {
              const on = i === shown;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={(e) => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      e.preventDefault();
                      return;
                    }
                    setView(t.id);
                  }}
                  aria-current={t.id === view ? "page" : undefined}
                  className={`relative z-[1] flex-1 min-w-0 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    on ? "text-accent" : "text-muted"
                  }`}
                >
                  <t.icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden />
                  <span className={`text-[10.5px] leading-none ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <button
          type="button"
          onClick={openAddTask}
          aria-label="Add task"
          title="Add task"
          className="shrink-0 h-[3.75rem] w-[3.75rem] rounded-full grid place-items-center border border-line bg-surface/90 backdrop-blur-md text-accent shadow-[var(--shadow-lg)] active:bg-surface-2"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
