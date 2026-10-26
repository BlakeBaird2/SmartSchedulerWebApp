"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, CircleAlert, Clock3, Flag, GripVertical, Inbox, Pin } from "lucide-react";
import { PLAN_DAYS } from "@/lib/schedule";
import type { Task } from "@/lib/types";
import { clock, dayKey, duration } from "@/lib/ui";
import { courseStyle, useApp, type CalMode } from "./context";
import { Button, Checkbox } from "./ui";
import { endPlanDrag, PLAN_DRAG_TYPE, startPlanDrag, usePlanDrag } from "./planDrag";

const WEEK = { weekStartsOn: 1 } as const;

/**
 * The calendar's left column on a computer, after Notion Calendar and Sunsama: a
 * small month to jump around in, and the work still to do, ready to be dragged
 * onto the calendar. Dragging a task onto a time "plans" it there; dropping a
 * planned block back on the list lets SmartScheduler choose again.
 */
export function CalendarSidebar({ mode, dueDays }: { mode: CalMode; dueDays: Set<string> }) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] min-h-0" aria-label="Month and work to plan">
      {mode !== "month" ? <MiniMonth mode={mode} dueDays={dueDays} /> : null}
      <TodoPanel />
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

// ---------------------------------------------------------------------------
// Work to plan
// ---------------------------------------------------------------------------

type Group = { key: string; title: string; tone: "late" | "due" | "plain"; items: Task[] };

function useTodoGroups() {
  const { model, filters, now } = useApp();
  return useMemo(() => {
    const courseSet = filters.courses ? new Set(filters.courses) : null;
    const today = startOfDay(now).getTime();
    const horizon = today + PLAN_DAYS * 86_400_000;
    const late: Task[] = [];
    const undated: Task[] = [];
    const byDay = new Map<string, { date: Date; items: Task[] }>();
    let later = 0;
    for (const t of model.tasks) {
      if (t.done || (courseSet && (!t.courseId || !courseSet.has(t.courseId)))) continue;
      const due = t.dueAt ? Date.parse(t.dueAt) : null;
      if (due === null) undated.push(t);
      else if (due < now.getTime()) {
        if (due >= now.getTime() - 7 * 86_400_000) late.push(t);
      } else if (due >= horizon) later++;
      else {
        const k = dayKey(new Date(due));
        const g = byDay.get(k) ?? { date: startOfDay(new Date(due)), items: [] };
        g.items.push(t);
        byDay.set(k, g);
      }
    }
    const byDue = (a: Task, b: Task) => Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? "");
    const groups: Group[] = [];
    if (late.length) groups.push({ key: "late", title: "Late", tone: "late", items: late.sort(byDue) });
    for (const [key, g] of [...byDay.entries()].sort((a, b) => a[1].date.getTime() - b[1].date.getTime())) {
      const n = differenceInCalendarDays(g.date, now);
      const title = n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : `Due ${format(g.date, n < 7 ? "EEEE" : "EEE, MMM d")}`;
      groups.push({ key, title, tone: "due", items: g.items.sort(byDue) });
    }
    if (undated.length) groups.push({ key: "undated", title: "No due date", tone: "plain", items: undated });
    return { groups, later, count: groups.reduce((s, g) => s + g.items.length, 0) };
  }, [model.tasks, filters.courses, now]);
}

function TodoPanel() {
  const { planAt, model, setView } = useApp();
  const { groups, later, count } = useTodoGroups();
  const drag = usePlanDrag();
  const [over, setOver] = useState(false);
  // Only a block you placed yourself can be handed back; the list is where it lands.
  const canDrop = Boolean(drag?.pinned);

  return (
    <section
      className={`todo-panel flex flex-col min-h-0 ${canDrop ? "todo-panel-target" : ""} ${over ? "todo-panel-over" : ""}`}
      aria-labelledby="todo-title"
      onDragOver={(e) => {
        if (!canDrop || !e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        if (!canDrop || !drag) return;
        e.preventDefault();
        const task = model.tasks.find((t) => t.id === drag.taskId);
        if (task) planAt(task, null);
        endPlanDrag();
      }}
    >
      <header className="px-3 pt-3 pb-2 border-b border-line">
        <div className="flex items-baseline gap-2">
          <h3 id="todo-title" className="text-sm font-semibold">
            To do
          </h3>
          <span className="text-xs text-muted tabular-nums">{count}</span>
        </div>
        <p className="text-xs text-muted mt-0.5 leading-snug">
          {canDrop ? "Drop here and SmartScheduler picks the time again." : "Drag a task onto the calendar to pick when you'll do it."}
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 pb-2">
        {groups.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted text-center">Nothing left to plan. Nice work.</p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="pt-2.5">
              <h4
                className={`px-1 mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                  g.tone === "late" ? "text-danger" : g.tone === "due" ? "text-warn" : "text-muted"
                }`}
              >
                {g.tone === "plain" ? <Inbox size={11} aria-hidden /> : <Flag size={11} aria-hidden />}
                {g.title}
              </h4>
              <ul className="space-y-1">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <TodoItem task={t} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {later > 0 ? (
          <button type="button" onClick={() => setView("upcoming")} className="mt-3 w-full text-left px-1 text-xs text-muted hover:text-fg">
            + {later} due later, in Upcoming
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** One task in the list: tick it, open it, or drag it onto a time. */
function TodoItem({ task }: { task: Task }) {
  const { model, index, now, ws, select, toggleDone } = useApp();
  const drag = usePlanDrag();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const first = index.blocks.get(task.id)?.[0];
  const risk = index.atRisk.get(task.id);
  const pinned = Boolean(ws.pins[task.id] && first?.pinned);
  const due = task.dueAt ? new Date(task.dueAt) : null;

  let status: React.ReactNode;
  if (risk) {
    status = (
      <span className="inline-flex items-center gap-1 text-danger font-semibold">
        <CircleAlert size={11} aria-hidden />
        Won&apos;t fit
      </span>
    );
  } else if (first) {
    const n = differenceInCalendarDays(first.start, now);
    const day = n === 0 ? "Today" : n === 1 ? "Tomorrow" : format(first.start, "EEE");
    status = (
      <span className="inline-flex items-center gap-1 text-ok font-semibold" title={pinned ? "You picked this time" : "SmartScheduler picked this time"}>
        {pinned ? <Pin size={10} aria-hidden /> : <Clock3 size={10} aria-hidden />}
        Planned {day.toLowerCase().startsWith("to") ? day.toLowerCase() : day} {clock(first.start)}
      </span>
    );
  } else status = <span className="text-faint">Not planned yet</span>;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${task.title}. Open details`}
      title="Drag onto the calendar to plan it"
      onClick={() => select({ kind: "task", id: task.id })}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select({ kind: "task", id: task.id });
        }
      }}
      onDragStart={(e) => startPlanDrag(e, { taskId: task.id, title: task.title, minutes: task.estimate, grab: 0, pinned: false, color: course?.color ?? null })}
      onDragEnd={endPlanDrag}
      style={courseStyle(course?.color)}
      className={`todo-item task-card group flex items-start gap-2 pl-2 pr-1 py-1.5 cursor-grab active:cursor-grabbing ${drag?.taskId === task.id ? "opacity-40" : ""}`}
    >
      <span className="pt-0.5">
        <Checkbox checked={task.done} onChange={() => toggleDone(task)} size="sm" label={`Mark ${task.title} as done`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug line-clamp-2">{task.title}</span>
        <span className="mt-0.5 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap text-[11px] text-muted">
          {course ? (
            <span className="inline-flex items-center gap-1 course-text font-medium">
              <span className="course-dot !w-1.5 !h-1.5" aria-hidden />
              {course.code}
            </span>
          ) : null}
          <span className="tabular-nums">{duration(task.estimate)}</span>
          {due && !task.allDay ? <span className="tabular-nums text-warn">· due {clock(due)}</span> : null}
        </span>
        <span className="mt-0.5 block text-[11px]">{status}</span>
      </span>
      <GripVertical size={14} className="mt-0.5 shrink-0 text-faint opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
    </div>
  );
}
