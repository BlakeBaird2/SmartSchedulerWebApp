"use client";

import { CircleAlert } from "lucide-react";
import type { Task } from "@/lib/types";
import { differenceInCalendarDays, format } from "date-fns";
import { clock, dueDate, duration, relativeDue, typeMeta, whenLabel } from "@/lib/ui";
import { useApp } from "./context";
import { Checkbox, ClassChip, DueBadge, PlannedBadge, TaskCard, TypeChip } from "./ui";

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

/** Where the plan put this task (a green "Planned" chip), or that it won't fit, in plain words. */
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
    <PlannedBadge>
      Planned {day} {clock(first.start)}
    </PlannedBadge>
  );
}

/**
 * When a task is due, as an amber "Due" chip: "Due tomorrow 9:30 AM", "Due Thu",
 * or "2 days late" in red. `timeOnly` drops the day where a heading already says it.
 */
export function DueTag({ task, timeOnly = false }: { task: Task; timeOnly?: boolean }) {
  const { now } = useApp();
  const d = dueDate(task);
  if (!d) return <span className="text-xs text-muted">No due date</span>;
  const late = !task.done && d.getTime() < now.getTime();
  if (late) return <DueBadge late>{relativeDue(d, now)}</DueBadge>;
  const when = timeOnly ? (task.allDay ? "end of day" : clock(d)) : whenLabel(d, now, !task.allDay).replace(/^Today/, "today").replace(/^Tomorrow/, "tomorrow");
  return <DueBadge>Due {when}</DueBadge>;
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
  const { model } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const meta = typeMeta(task.type);

  return (
    <AppTaskCard
      task={task}
      badge={meta.loud ? <TypeChip type={task.type} /> : null}
      meta={
        <>
          {!hideCourse && course ? <ClassChip code={course.code} color={course.color} /> : null}
          {/* Phones drop the kind of work here (it's in the details) to keep each row to two lines. */}
          {!meta.loud ? (
            <span className="hidden md:inline-flex items-center gap-1">
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
      trailing={<DueTag task={task} timeOnly={!showDate} />}
    />
  );
}
