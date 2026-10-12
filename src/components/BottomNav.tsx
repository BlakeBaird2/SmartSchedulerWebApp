"use client";

import { Plus } from "lucide-react";
import { useApp } from "./context";
import { TABS } from "./Header";

/**
 * Phones: the main views move from the top of the screen to a floating bar at the
 * bottom, where a thumb reaches them (Fitts's law). The open view is a raised,
 * tinted pill; every tab keeps a short label under its icon, so nothing has to be
 * guessed. Add task sits beside the bar as its own round button, always in reach.
 *
 * Settings and Help aren't tabs, so while one is open no tab is highlighted.
 */
export function BottomNav() {
  const { view, setView, openAddTask } = useApp();

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-none px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md flex items-center gap-2.5 pointer-events-auto">
        <nav
          aria-label="Main"
          className="flex-1 flex items-center gap-1 rounded-full border border-line bg-surface/90 backdrop-blur-md p-1.5 shadow-[var(--shadow-lg)]"
        >
          {TABS.map((t) => {
            const on = t.id === view;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex-1 min-w-0 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  on ? "bg-accent-soft text-accent shadow-[var(--shadow-sm)]" : "text-muted active:bg-surface-2"
                }`}
              >
                <t.icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden />
                <span className={`text-[10.5px] leading-none ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </button>
            );
          })}
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
