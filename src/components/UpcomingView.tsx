"use client";

import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, isToday, startOfDay } from "date-fns";
import { CalendarCheck, CircleCheckBig, Flame, Inbox, Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { applyFilters, dayKey, duration, plural, typeMeta } from "@/lib/ui";
import { useApp } from "./context";
import { FilterBar } from "./FilterBar";
import { ClassSummary, HiddenClasses } from "./ClassSummary";
import { TaskRow } from "./TaskRow";
import { Button, EmptyState } from "./ui";

const DAY = 86_400_000;

function group(tasks: Task[], now: Date) {
  const today = startOfDay(now).getTime();
  const overdue: Task[] = [];
  const undated: Task[] = [];
  const done: Task[] = [];
  const days = new Map<string, { date: Date; items: Task[] }>();
  for (const t of tasks) {
    const due = t.dueAt ? Date.parse(t.dueAt) : null;
    if (t.done) {
      if (due === null || due >= today - 14 * DAY) done.push(t);
      continue;
    }
    if (due === null) undated.push(t);
    else if (due < now.getTime()) {
      if (due >= now.getTime() - 30 * DAY) overdue.push(t);
    } else {
      const k = dayKey(new Date(due));
      const g = days.get(k) ?? { date: startOfDay(new Date(due)), items: [] };
      g.items.push(t);
      days.set(k, g);
    }
  }
  return { overdue, days: [...days.entries()].map(([key, g]) => ({ key, ...g })), undated, done };
}

/**
 * The next seven days at a glance, like Todoist's Upcoming: each day shows its date
 * and an amber dot for each thing due. Tap a day to jump to it.
 */
function WeekStrip({ days }: { days: { key: string; items: Task[] }[] }) {
  const { now } = useApp();
  const counts = new Map(days.map((d) => [d.key, d.items.length]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i));
  return (
    <nav aria-label="Jump to a day" className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {week.map((d, i) => {
        const k = dayKey(d);
        const n = counts.get(k) ?? 0;
        return (
          <button
            key={k}
            type="button"
            disabled={n === 0}
            onClick={() => document.getElementById(`due-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="week-day"
            data-today={i === 0 || undefined}
            aria-label={`${format(d, "EEEE, MMMM d")}: ${n === 0 ? "nothing due" : plural(n, "thing") + " due"}`}
          >
            <span className="text-[10.5px] font-semibold uppercase tracking-wide">{i === 0 ? "Today" : format(d, "EEE")}</span>
            <span className="text-lg font-bold tabular-nums leading-tight">{format(d, "d")}</span>
            <span className="flex gap-[3px] h-1.5 items-center" aria-hidden>
              {Array.from({ length: Math.min(n, 4) }, (_, j) => (
                <span key={j} className="w-1.5 h-1.5 rounded-full bg-warn" />
              ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function UpcomingView() {
  const { model, filters, now, openAddTask } = useApp();
  const picked = filters.courses?.length === 1 ? model.courseById.get(filters.courses[0]) : undefined;
  const filtered = useMemo(() => applyFilters(model.tasks, filters), [model.tasks, filters]);
  const groups = useMemo(() => group(filtered, now), [filtered, now]);
  const empty = groups.overdue.length + groups.days.length + groups.undated.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <FilterBar />
        </div>
        {/* Phones add from the round + in the bottom bar. */}
        <Button icon={Plus} className="hidden md:inline-flex shrink-0" onClick={openAddTask} data-smart-event="add_task_opened">
          Add task
        </Button>
      </div>

      {/* One class picked: its summary (when it meets, how much is left, Edit) above its work. */}
      {picked ? <ClassSummary key={picked.id} course={picked} /> : null}

      <WeekStrip days={groups.days} />

      {groups.overdue.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-danger mb-2">
            <Flame size={15} />
            Overdue
            <span className="text-xs font-normal text-muted">{plural(groups.overdue.length, "task")}</span>
          </h2>
          <div className="space-y-1.5">
            {groups.overdue.map((t) => (
              <TaskRow key={t.id} task={t} showDate hideCourse={Boolean(picked)} />
            ))}
          </div>
        </section>
      ) : null}

      {groups.days.map((g) => {
        const n = differenceInCalendarDays(g.date, now);
        const h = {
          title: n === 0 ? "Today" : n === 1 ? "Tomorrow" : format(g.date, "EEEE"),
          sub: n <= 1 ? format(g.date, "EEEE, MMMM") : format(g.date, "MMMM"),
        };
        const minutes = g.items.reduce((s, t) => s + t.estimate, 0);
        const loud = g.items.filter((t) => typeMeta(t.type).loud).length;
        const today = isToday(g.date);
        return (
          <section key={g.key} id={`due-${g.key}`} className="scroll-mt-28 md:scroll-mt-40 lg:scroll-mt-28">
            {/* Things 3's day heading: the date as a big number, then what the day is called. */}
            <div className="flex items-end gap-3 mb-2 sticky top-14 md:top-[6.5rem] lg:top-14 bg-bg/95 backdrop-blur pt-2 pb-1.5 z-10 border-b border-line">
              <span className={`text-[1.75rem] leading-none font-bold tabular-nums tracking-tight ${today ? "text-accent" : ""}`} aria-hidden>
                {format(g.date, "d")}
              </span>
              <div className="min-w-0 flex-1 pb-px">
                <h2 className="text-sm font-semibold leading-tight">
                  <span className="sr-only">Due </span>
                  {h.title}
                </h2>
                <div className="text-xs text-muted leading-tight">{h.sub}</div>
              </div>
              <span className="text-xs text-muted tabular-nums whitespace-nowrap pb-px">
                {plural(g.items.length, "task")} · {duration(minutes)}
                {loud > 0 ? <span className="text-warn font-medium"> · {loud} quiz/exam</span> : null}
              </span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} hideCourse={Boolean(picked)} />
              ))}
            </div>
          </section>
        );
      })}

      {groups.undated.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted mb-2">
            <Inbox size={15} />
            No due date
          </h2>
          <div className="space-y-1.5">
            {groups.undated.map((t) => (
              <TaskRow key={t.id} task={t} hideCourse={Boolean(picked)} />
            ))}
          </div>
        </section>
      ) : null}

      {filters.showCompleted && groups.done.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ok mb-2">
            <CircleCheckBig size={15} />
            Done
            <span className="text-xs font-normal text-muted">{plural(groups.done.length, "task")}</span>
          </h2>
          <div className="space-y-1.5">
            {groups.done.map((t) => (
              <TaskRow key={t.id} task={t} showDate hideCourse={Boolean(picked)} />
            ))}
          </div>
        </section>
      ) : null}

      {empty ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing due right now"
          action={
            model.tasks.length === 0 ? (
              <Button icon={Plus} onClick={openAddTask}>
                Add a task
              </Button>
            ) : null
          }
        >
          {model.tasks.length === 0 ? "Add a school calendar in Settings, or add work by hand." : "Everything in view is done. Pick \"All classes\" above to see the rest."}
        </EmptyState>
      ) : null}
      <HiddenClasses />
    </div>
  );
}
