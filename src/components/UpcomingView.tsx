"use client";

import { useMemo } from "react";
import { startOfDay } from "date-fns";
import { CalendarCheck, CircleCheckBig, Flame, Inbox, Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { applyFilters, dayHeading, dayKey, duration, plural, typeMeta } from "@/lib/ui";
import { useApp } from "./context";
import { FilterBar } from "./FilterBar";
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

export function UpcomingView() {
  const { model, filters, now, openAddTask } = useApp();
  const filtered = useMemo(() => applyFilters(model.tasks, filters), [model.tasks, filters]);
  const groups = useMemo(() => group(filtered, now), [filtered, now]);
  const empty = groups.overdue.length + groups.days.length + groups.undated.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <FilterBar />
        </div>
        <Button icon={Plus} className="shrink-0" onClick={openAddTask}>
          Add task
        </Button>
      </div>

      {groups.overdue.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-danger mb-2">
            <Flame size={15} />
            Overdue
            <span className="text-xs font-normal text-muted">{plural(groups.overdue.length, "task")}</span>
          </h2>
          <div className="space-y-1.5">
            {groups.overdue.map((t) => (
              <TaskRow key={t.id} task={t} showDate />
            ))}
          </div>
        </section>
      ) : null}

      {groups.days.map((g) => {
        const h = dayHeading(g.date, now);
        const minutes = g.items.reduce((s, t) => s + t.estimate, 0);
        const loud = g.items.filter((t) => typeMeta(t.type).loud).length;
        return (
          <section key={g.key}>
            <div className="flex items-baseline gap-2 mb-2 sticky top-[6.25rem] md:top-14 bg-bg py-1 z-10 border-b border-line">
              <h2 className="text-sm font-semibold">{h.title}</h2>
              <span className="text-xs text-muted">{h.sub}</span>
              <span className="ml-auto text-xs text-muted tabular-nums">
                {plural(g.items.length, "task")} · {duration(minutes)}
                {loud > 0 ? <span className="text-warn font-medium"> · {loud} quiz/exam</span> : null}
              </span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} />
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
              <TaskRow key={t.id} task={t} />
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
              <TaskRow key={t.id} task={t} showDate />
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
          {model.tasks.length === 0 ? "Add a school calendar in Settings, or add work by hand." : "Everything in view is done. Change the class filters above to see more."}
        </EmptyState>
      ) : null}
    </div>
  );
}
