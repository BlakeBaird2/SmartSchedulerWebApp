"use client";

import { CircleAlert, Clock3 } from "lucide-react";
import type { Task } from "@/lib/types";
import { differenceInCalendarDays, format } from "date-fns";
import { clock, dueDate, duration, relativeDue, typeMeta, whenLabel } from "@/lib/ui";
import { useApp } from "./context";
import { Checkbox, ClassChip, TaskCard, TypeChip } from "./ui";

/** The tick box for a task, wired to the app. */
export function DoneToggle({ task, size = "md" }: { task: Task; size?: "sm" | "md" }) {
  const { toggleDone } = useApp();
  return (
    <Checkbox
      checked={task.done}
      onChange={() => toggleDone(task)}
      size={size}
      label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
    />
  );
}

/** Where the plan put this task, or that it won't fit, in plain words. */
export function PlanNote({ task }: { task: Task }) {
  const { index, now } = useApp();
  if (task.done) return null;
  if (index.atRisk.has(task.id)) {
    return (
      <span className="inline-flex items-center gap-1 text-danger font-bold">
        <CircleAlert size={12} aria-hidden />
        Won&apos;t fit in time
      </span>
    );
  }
  const first = index.blocks.get(task.id)?.[0];
  if (!first) return null;
  const days = differenceInCalendarDays(first.start, now);
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : format(first.start, "EEE");
  return (
    <span className="inline-flex items-center gap-1">
      <Clock3 size={12} aria-hidden />
      Planned {day} {clock(first.start)}
    </span>
  );
}

/**
 * A task wired to the app: ticking it marks it done, clicking it opens its details.
 * Every list of work uses this, with a different details line for each screen.
 */
export function AppTaskCard({
  task,
  density,
  meta,
  trailing,
  badge,
}: {
  task: Task;
  density?: "regular" | "compact";
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const { model, select, toggleDone } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  return (
    <TaskCard
      title={task.title}
      done={task.done}
      onToggleDone={() => toggleDone(task)}
      onOpen={() => select({ kind: "task", id: task.id })}
      color={course?.color}
      density={density}
      badge={badge}
      meta={meta}
      trailing={trailing}
    />
  );
}

/** A task in a full-width list (Upcoming): class, kind, time needed, plan, and when it's due on the right. */
export function TaskRow({ task, showDate = false, hideCourse = false }: { task: Task; showDate?: boolean; hideCourse?: boolean }) {
  const { model, now } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const d = dueDate(task);
  const overdue = Boolean(d && d.getTime() < now.getTime() && !task.done);
  const meta = typeMeta(task.type);

  return (
    <AppTaskCard
      task={task}
      badge={meta.loud ? <TypeChip type={task.type} /> : null}
      meta={
        <>
          {!hideCourse && course ? <ClassChip code={course.code} color={course.color} /> : null}
          {!meta.loud ? (
            <span className="inline-flex items-center gap-1">
              <meta.icon size={12} aria-hidden />
              {meta.label}
            </span>
          ) : null}
          <span className="tabular-nums" title="Time this needs">
            {duration(task.estimate)}
          </span>
          <PlanNote task={task} />
        </>
      }
      trailing={
        <>
          <div className={`text-[0.875rem] font-semibold tabular-nums ${overdue ? "text-danger" : ""}`}>
            {d ? (showDate ? whenLabel(d, now, !task.allDay) : task.allDay ? "All day" : clock(d)) : "No date"}
          </div>
          {d ? <div className={`text-xs ${overdue ? "text-danger font-semibold" : "text-muted"}`}>{relativeDue(d, now)}</div> : null}
        </>
      }
    />
  );
}
