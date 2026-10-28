"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus, Timer } from "lucide-react";
import { isSchoolWork, todoList, urgencyColor } from "@/lib/todos";
import type { Task } from "@/lib/types";
import { approxDuration, dueIn } from "@/lib/ui";
import { courseStyle, useApp } from "./context";
import { Button, Checkbox, ChoicePill, SegmentedControl, TextButton } from "./ui";
import { beginPlanDrag, dragSourceRef, targetStart, usePlanDrag } from "./planDrag";

/** The to-do list's work, in order, honouring the class tabs above the calendar. */
export function useTodos(): Task[] {
  const { model, ws, now, filters, todoScope, todoSort } = useApp();
  return useMemo(() => {
    const courseSet = filters.courses ? new Set(filters.courses) : null;
    const tasks = courseSet ? model.tasks.filter((t) => t.courseId && courseSet.has(t.courseId)) : model.tasks;
    return todoList({ tasks, blocks: ws.blocks, now, scope: todoScope, sort: todoSort, classOrder: ws.classOrder });
  }, [model.tasks, ws.blocks, ws.classOrder, now, filters.courses, todoScope, todoSort]);
}

/**
 * Everything still to plan, school and personal, in one list. Putting work on the
 * calendar takes it off, so the next thing to plan is always at the top. Dropping
 * scheduled work back here takes it off the calendar again.
 */
export function TodoList({ className = "" }: { className?: string }) {
  const { todoScope, setTodoScope, todoSort, setTodoSort, openAddTask, newWork, seeWork } = useApp();
  const todos = useTodos();
  const fresh = todos.filter((t) => newWork.has(t.id)).map((t) => t.id);
  const drag = usePlanDrag();
  // Only work already on the calendar can be handed back; the list is where it lands.
  const canDrop = drag?.kind === "move";
  const over = drag?.target?.kind === "list";

  return (
    <section
      data-drop-list
      className={`todo-panel flex flex-col min-h-0 ${canDrop ? "todo-panel-target" : ""} ${over ? "todo-panel-over" : ""} ${className}`}
      aria-labelledby="todo-title"
    >
      <header className="px-3 pt-3 pb-2.5 border-b border-line space-y-2">
        <div className="flex items-center gap-2">
          <h3 id="todo-title" className="text-sm font-semibold">
            To do
          </h3>
          <span className="text-xs text-muted tabular-nums">{todos.length}</span>
          {fresh.length > 0 ? (
            <>
              <span className="new-pill">{fresh.length} new</span>
              <TextButton className="text-xs text-muted" onClick={() => seeWork(fresh)}>
                Mark seen
              </TextButton>
            </>
          ) : null}
          <Button variant="quiet" size="sm" iconOnly icon={Plus} label="Add a task" className="ml-auto" onClick={openAddTask} />
        </div>
        <SegmentedControl
          label="Show"
          stretch
          className="seg-sm"
          options={[
            { id: "all", label: "All tasks" },
            { id: "school", label: "School only" },
          ]}
          value={todoScope}
          onChange={setTodoScope}
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted shrink-0">Sort by</span>
          <SegmentedControl
            label="Sort by"
            stretch
            className="seg-sm flex-1"
            options={[
              { id: "due", label: "Due date" },
              { id: "duration", label: "Duration" },
            ]}
            value={todoSort}
            onChange={setTodoSort}
          />
        </div>
        <p className="text-xs text-muted leading-snug">
          {canDrop ? "Drop here to take it off the calendar." : todoSort === "due" ? "Drag the next task into a free gap on your calendar." : "Shortest first, to fill a gap of a given size."}
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-2">
        {todos.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted text-center">{todoScope === "school" ? "No school work left to plan." : "Nothing left to plan. Nice work."}</p>
        ) : (
          <ol>
            {todos.map((t, i) => (
              <TodoItem key={t.id} task={t} next={i === 0 && todoSort === "due"} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

const ESTIMATE_CHOICES = [5, 15, 30, 45, 60, 90, 120, 180];

/** How long ticking a task off plays before it leaves the list: the tick lands, then the row folds away. */
const COMPLETE_MS = 680;
const COMPLETE_MS_REDUCED = 180;

/**
 * One piece of work: tick it off, open it, change how long it needs, or drag it
 * onto a time. Coloured by how soon it is due, red to yellow. Ticking it off
 * plays out before it leaves: the box pops, the row turns green and is struck
 * through, then it folds away and the rest of the list moves up.
 */
function TodoItem({ task, next }: { task: Task; next: boolean }) {
  const { model, now, ws, select, toggleDone, setEstimate, scheduleTask, newWork } = useApp();
  const drag = usePlanDrag();
  const color = urgencyColor(task.dueAt, now);
  const [editing, setEditing] = useState(false);
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const late = due ? due.getTime() < now.getTime() : false;
  const typeDefault = ws.prefs.estimates[task.type];
  const [completing, setCompleting] = useState(false);
  // Added to a class calendar since the student last looked.
  const fresh = newWork.has(task.id);
  const open = () => select({ kind: "task", id: task.id });

  // Done work stays on the calendar; Undo is in the message that follows.
  const complete = () => {
    if (completing) return;
    setCompleting(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => toggleDone(task), reduce ? COMPLETE_MS_REDUCED : COMPLETE_MS);
  };

  return (
    <li className="todo-fold" data-completing={completing || undefined}>
      <div>
        <div
          role="button"
          tabIndex={0}
          ref={dragSourceRef}
          aria-label={`${task.title}, ${approxDuration(task.estimate)}${due ? `, ${dueIn(due, now)}` : ""}${fresh ? ", new" : ""}${next ? ", next up" : ""}. Open details`}
          title="Drag onto the calendar to schedule it"
          onClick={open}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
          onPointerDown={(e) => {
            // The tick box and the estimate are their own controls.
            if ((e.target as HTMLElement).closest("button, input")) return;
            beginPlanDrag(
              e,
              // A finger would hide the top of the block, so on touch the block hangs above it.
              { kind: "new", taskId: task.id, blockId: null, title: task.title, minutes: task.estimate, grab: e.pointerType === "mouse" ? 0 : Math.min(task.estimate, 60), color },
              (target) => {
                if (target.kind === "grid") scheduleTask(task, targetStart(target));
              },
            );
          }}
          style={{ "--u": color } as React.CSSProperties}
          className={`todo-item urgency-card drag-source group mb-1.5 flex items-start gap-2 pl-3 pr-1 py-2 cursor-grab ${drag?.kind === "new" && drag.taskId === task.id ? "opacity-40" : ""}`}
        >
          <span className="check-burst pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={task.done || completing} onChange={complete} size="sm" label={`Mark ${task.title} as done`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              <span className="text-[13px] font-semibold leading-snug line-clamp-2 flex-1 min-w-0">
                <span className="todo-title">{task.title}</span>
              </span>
              {fresh ? <span className="new-pill shrink-0">New</span> : null}
              {next ? <span className="next-pill shrink-0">Next up</span> : null}
            </span>
            <span className="mt-1 flex items-center gap-x-1.5 gap-y-1 flex-wrap text-[11px] text-muted">
              <button
                type="button"
                className="estimate-chip"
                aria-expanded={editing}
                aria-label={`About ${approxDuration(task.estimate).slice(1)}. Change how long it needs`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing((v) => !v);
                }}
              >
                <Timer size={11} aria-hidden />
                {approxDuration(task.estimate)}
              </button>
              {course ? (
                <span className="inline-flex items-center gap-1 course-text font-medium" style={courseStyle(course.color)}>
                  <span className="course-dot !w-1.5 !h-1.5" aria-hidden />
                  {course.code}
                </span>
              ) : !isSchoolWork(task) ? (
                <span className="font-medium">Personal</span>
              ) : null}
              <span className={`urgency-due ${late ? "font-semibold text-danger" : ""}`}>{due ? dueIn(due, now) : "No due date"}</span>
            </span>
            {editing ? (
              <span className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label={`How long ${task.title} needs`} onClick={(e) => e.stopPropagation()}>
                {[...new Set([...ESTIMATE_CHOICES, task.estimate])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <ChoicePill
                      key={m}
                      selected={task.estimate === m}
                      onClick={() => {
                        setEstimate(task.id, m === typeDefault && task.customEstimate ? null : m);
                        setEditing(false);
                      }}
                    >
                      {approxDuration(m).slice(1)}
                    </ChoicePill>
                  ))}
              </span>
            ) : null}
          </span>
          <GripVertical size={14} className="mt-0.5 shrink-0 text-faint opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
        </div>
      </div>
    </li>
  );
}
