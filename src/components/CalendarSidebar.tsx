"use client";

import { useMemo, useState } from "react";
import { addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey } from "@/lib/ui";
import { useApp, type CalMode } from "./context";
import { Button } from "./ui";
import { TodoList } from "./TodoList";

const WEEK = { weekStartsOn: 1 } as const;

/**
 * The calendar's left column on a computer, after Notion Calendar and Sunsama: a
 * small month to jump around in, and the to-do list, ready to be dragged into the
 * free time on the calendar. Dropping scheduled work back on the list takes it
 * off the calendar.
 */
export function CalendarSidebar({ mode, dueDays }: { mode: CalMode; dueDays: Set<string> }) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] min-h-0" aria-label="Month and work to plan">
      {mode !== "month" ? <MiniMonth mode={mode} dueDays={dueDays} /> : null}
      <TodoList />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mini month
// ---------------------------------------------------------------------------

function MiniMonth({ mode, dueDays }: { mode: CalMode; dueDays: Set<string> }) {
  const { calCursor, setCalCursor } = useApp();
  // The month shown can wander away from the open week without moving the calendar.
  const [shown, setShown] = useState<{ base: number; offset: number }>({ base: startOfMonth(calCursor).getTime(), offset: 0 });
  const base = startOfMonth(calCursor).getTime();
  const offset = shown.base === base ? shown.offset : 0;
  const month = addMonths(new Date(base), offset);
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), WEEK), end: endOfWeek(endOfMonth(month), WEEK) }),
    [month],
  );
  const inRange = (d: Date) => {
    if (mode === "week") return isSameDay(startOfWeek(d, WEEK), startOfWeek(calCursor, WEEK));
    if (mode === "3day") {
      const n = differenceInCalendarDays(d, calCursor);
      return n >= 0 && n < 3;
    }
    return isSameDay(d, calCursor);
  };

  return (
    <div className="px-1">
      <div className="flex items-center gap-1 mb-1.5">
        <h3 className="flex-1 text-sm font-semibold pl-1" aria-live="polite">
          {format(month, "MMMM yyyy")}
        </h3>
        <Button variant="quiet" size="sm" iconOnly icon={ChevronLeft} label="Previous month" onClick={() => setShown({ base, offset: offset - 1 })} />
        <Button variant="quiet" size="sm" iconOnly icon={ChevronRight} label="Next month" onClick={() => setShown({ base, offset: offset + 1 })} />
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] font-semibold text-faint mb-0.5" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const k = dayKey(d);
          const today = isToday(d);
          const picked = inRange(d);
          const due = dueDays.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCalCursor(d)}
              aria-label={`${format(d, "EEEE, MMMM d")}${due ? ", something due" : ""}`}
              aria-current={isSameDay(d, calCursor) ? "date" : undefined}
              className={`mini-day ${picked ? "mini-day-range" : ""}`}
              data-out={!isSameMonth(d, month) || undefined}
            >
              <span className={`mini-day-num ${today ? "mini-day-today" : ""}`}>{format(d, "d")}</span>
              <span className={`mini-day-dot ${due ? "" : "invisible"}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
