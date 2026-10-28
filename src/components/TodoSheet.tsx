"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ListTodo } from "lucide-react";
import { approxDuration } from "@/lib/ui";
import { useApp } from "./context";
import { usePlanDrag } from "./planDrag";
import { TodoList, useTodos } from "./TodoList";

/**
 * The to-do list on phones and tablets: a sheet along the bottom of the calendar.
 * Closed, it says what to schedule next; open, it holds the whole list.
 *
 * Press and hold a task to pick it up. The sheet slides out of the way so the
 * calendar is free to drop it on, and the page scrolls when the task nears the
 * top or bottom. If the calendar is on a view without times (the agenda or the
 * month), it switches to the day so there is somewhere to drop. While scheduled
 * work is dragged, the closed sheet takes it back off the calendar.
 */
export function TodoSheet({ hasTimes, showTimes, className = "" }: { hasTimes: boolean; showTimes: () => void; className?: string }) {
  const todos = useTodos();
  const { newWork } = useApp();
  const fresh = todos.filter((t) => newWork.has(t.id)).length;
  const drag = usePlanDrag();
  const [open, setOpen] = useState(false);
  const placing = drag?.kind === "new";
  const takingBack = drag?.kind === "move";
  const over = drag?.target?.kind === "list";
  const next = todos[0];

  // Somewhere to drop: the agenda and month have no times, so show the day.
  useEffect(() => {
    if (placing && !hasTimes) showTimes();
  }, [placing, hasTimes, showTimes]);

  return (
    <div className={`todo-sheet ${className}`} data-hidden={placing || undefined} data-open={(open && !takingBack) || undefined}>
      {open && !takingBack ? (
        <div className="flex flex-col max-h-[min(62dvh,34rem)]">
          <button type="button" className="todo-sheet-handle" onClick={() => setOpen(false)} aria-expanded aria-label="Close the to-do list">
            <ChevronDown size={16} aria-hidden />
            Hold a task, then drag it onto a free time
          </button>
          <TodoList className="flex-1 !rounded-t-none !border-t-0" />
        </div>
      ) : (
        <button
          type="button"
          data-drop-list={takingBack || undefined}
          className={`todo-sheet-bar ${takingBack ? "todo-panel-target" : ""} ${over ? "todo-panel-over" : ""}`}
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={`To do, ${todos.length} ${todos.length === 1 ? "task" : "tasks"}${fresh ? `, ${fresh} new` : ""}. Open the list`}
        >
          <ListTodo size={18} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 text-left">
            {takingBack ? (
              <span className="block text-sm font-semibold">Drop here to take it off the calendar</span>
            ) : (
              <>
                <span className="block text-sm font-semibold">
                  To do <span className="text-muted font-medium tabular-nums">{todos.length}</span>
                  {fresh > 0 ? <span className="new-pill ml-1.5">{fresh} new</span> : null}
                </span>
                <span className="block text-xs text-muted truncate">
                  {next ? `Next up: ${next.title} · ${approxDuration(next.estimate)}` : "Nothing left to schedule"}
                </span>
              </>
            )}
          </span>
          {!takingBack ? <ChevronUp size={18} className="shrink-0 text-muted" aria-hidden /> : null}
        </button>
      )}
    </div>
  );
}
