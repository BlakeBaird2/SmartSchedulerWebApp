"use client";

import { useMemo, useState } from "react";
import { todoList, type TodoSort } from "@/lib/todos";
import type { Task } from "@/lib/types";
import { dueLabel } from "@/lib/ui";
import { useApp, useIsPhone } from "./context";
import { beginPlanDrag, dragSourceRef, targetStart, usePlanDrag } from "./planDrag";
import { SsIcon } from "./SsIcon";

/** How many tasks the planner shows, and how many with "Show more items" on. */

/** Everything still to schedule, in order, narrowed by "Stack with class". */
export function useTodos(): Task[] {
  const { model, ws, now, filters, todoScope, todoSort } = useApp();
  return useMemo(() => {
    const courseSet = filters.courses ? new Set(filters.courses) : null;
    const tasks = courseSet ? model.tasks.filter((t) => t.courseId && courseSet.has(t.courseId)) : model.tasks;
    return todoList({
      tasks,
      blocks: ws.blocks,
      now,
      scope: todoScope,
      sort: todoSort,
      classOrder: ws.classOrder,
      policy: ws.unfinished,
      answers: ws.unfinishedAnswers,
    });
  }, [model.tasks, ws.blocks, ws.classOrder, ws.unfinished, ws.unfinishedAnswers, now, filters.courses, todoScope, todoSort]);
}

/**
 * Every task still to schedule, from every class, whatever the planner's filters
 * say: what the planner's search looks through.
 */
function useAllTodos(): Task[] {
  const { model, ws, now, todoSort } = useApp();
  return useMemo(
    () =>
      todoList({
        tasks: model.tasks,
        blocks: ws.blocks,
        now,
        scope: "all",
        sort: todoSort,
        classOrder: ws.classOrder,
        policy: ws.unfinished,
        answers: ws.unfinishedAnswers,
      }),
    [model.tasks, ws.blocks, ws.classOrder, ws.unfinished, ws.unfinishedAnswers, now, todoSort],
  );
}

const SORTS: { id: TodoSort; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "duration", label: "Length" },
];

/**
 * The planner beside the calendar, from the Figma prototype: "Plan your open
 * time". Order the list, narrow it to one class, and drag the top items onto the
 * calendar. Scheduled work leaves the list, so the next one moves up. Dropping
 * scheduled work back here takes it off the calendar.
 */
export function PlannerPanel({ onClose }: { onClose: () => void }) {
  const { model, todoScope, setTodoScope, todoSort, setTodoSort, filters, setFilters, setView, openAddTask } = useApp();
  const app = useApp();
  // On a phone the filters start folded, to leave room for the work; they open and close on their own there.
  const phone = useIsPhone();
  const plannerFilters = phone ? app.plannerFiltersPhone : app.plannerFilters;
  const setPlannerFilters = phone ? app.setPlannerFiltersPhone : app.setPlannerFilters;
  const todos = useTodos();
  const allTodos = useAllTodos();
  const drag = usePlanDrag();
  // Search: typed into `draft`, run on Enter. It looks through everything still to
  // schedule (every class, past the class filter), and lists every match.
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return allTodos.filter((t) => {
      const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
      return `${t.title} ${course ? `${course.code} ${course.title ?? ""}` : "Personal"}`.toLowerCase().includes(q);
    });
  }, [allTodos, q, model.courseById]);
  // Everything still to schedule is listed; the list scrolls.
  const shown = results ?? todos;
  const clearSearch = () => {
    setDraft("");
    setQuery("");
  };
  const stack = filters.courses?.[0] ?? (todoScope === "all" ? "all" : todoScope);
  // What the filters are set to, in a few words, for when they are folded away.
  const stackLabel =
    stack === "all" ? "All classes" : stack === "school" ? "School only" : stack === "personal" ? "Personal" : (model.courseById.get(stack)?.code ?? "One class");
  const summary = `${SORTS.find((s) => s.id === todoSort)?.label} · ${stackLabel}`;

  const setStack = (value: string) => {
    if (value === "all" || value === "school" || value === "personal") {
      setFilters((f) => ({ ...f, courses: null }));
      setTodoScope(value);
    } else {
      setTodoScope("all");
      setFilters((f) => ({ ...f, courses: [value] }));
    }
  };

  return (
    <aside
      className="ss-suggestions"
      data-drop-list
      data-drop-target={(drag?.kind === "move" && Boolean(drag.blockId)) || undefined}
      data-drop-over={drag?.target?.kind === "list" || undefined}
      aria-labelledby="planner-title"
    >
      <div className="ss-aside-head">
        <div>
          <span className="ss-eyebrow">
            <SsIcon name="spark" size={14} /> PERSONALPLANNER
          </span>
          <h1 id="planner-title">Plan your open time</h1>
          {/* Phones drop the standing hint for room; "Drag to schedule" over the list says it. */}
          {drag?.kind === "move" && drag.blockId ? <p>Drop it here to take it off the calendar.</p> : <p className="ss-aside-hint">Drag an item into the calendar to schedule it.</p>}
        </div>
        <button className="ss-icon-button" onClick={onClose} aria-label="Collapse suggestions">
          <SsIcon name="x" />
        </button>
      </div>

      <button className="ss-primary ss-planner-add" onClick={openAddTask} data-smart-event="add_task_opened">
        <SsIcon name="plus" /> Add task
      </button>

      <form
        className="ss-planner-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
        }}
      >
        <SsIcon name="search" size={16} />
        <input
          type="search"
          enterKeyHint="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Emptying the box goes straight back to the list.
            if (!e.target.value.trim()) setQuery("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") clearSearch();
          }}
          placeholder="Search all tasks"
          aria-label="Search all tasks, then press Enter"
        />
        {draft ? (
          <button type="button" className="ss-planner-search-clear" onClick={clearSearch} aria-label="Clear the search">
            <SsIcon name="x" size={14} />
          </button>
        ) : null}
      </form>

      <div className="ss-filters" data-collapsed={!plannerFilters || undefined}>
        <button
          className="ss-filters-toggle"
          aria-expanded={plannerFilters}
          aria-controls="planner-filters"
          onClick={() => setPlannerFilters(!plannerFilters)}
          title={plannerFilters ? "Hide the filters" : "Show the filters"}
        >
          <span>FILTERS</span>
          {!plannerFilters ? <em>{summary}</em> : null}
          <SsIcon name="chevronRight" size={16} />
        </button>
        {plannerFilters ? (
          <div id="planner-filters" className="ss-filters-body">
            <span>ORDER BY</span>
            <div className="ss-sort-tabs" role="group" aria-label="Order by">
              {SORTS.map((s) => (
                <button key={s.id} aria-pressed={todoSort === s.id} onClick={() => setTodoSort(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <label>
              <span>STACK WITH CLASS</span>
              <select value={stack} onChange={(e) => setStack(e.target.value)}>
                <option value="all">All classes</option>
                <option value="school">School only</option>
                {model.visibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
                <option value="personal">Personal</option>
              </select>
            </label>

          </div>
        ) : null}
      </div>

      <div className="ss-queue-label">
        <span className="inline-flex items-center gap-1.5">
          <SsIcon name="grip" size={13} /> {results ? "SEARCH RESULTS" : "DRAG TO SCHEDULE"}
        </span>
        <span aria-live="polite">{results ? `${results.length} FOUND` : `${shown.length} ITEMS`}</span>
      </div>
      <div className="ss-task-stack">
        {results && results.length === 0 ? (
          <p className="ss-empty">
            Nothing left to schedule matches &ldquo;{query.trim()}&rdquo;.{" "}
            <button type="button" className="ss-link-button" onClick={clearSearch}>
              Clear the search
            </button>
          </p>
        ) : null}
        {!results && shown.length === 0 ? <p className="ss-empty">Nothing left to schedule. Nice work.</p> : null}
        {shown.map((task) => (
          <PlannerTask key={task.id} task={task} />
        ))}
      </div>
      <button className="ss-view-all" onClick={() => setView("tasks")}>
        View all tasks <SsIcon name="chevronRight" />
      </button>
    </aside>
  );
}

const ESTIMATE_CHOICES = [5, 15, 30, 45, 60, 90, 120, 180];

/** "45 min", "1 hr", "1.5 hr": short enough for the pill on the card. */
function minutesLabel(m: number): string {
  return m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} hr`;
}

/**
 * One task to plan: a card to grab anywhere and drag onto the calendar (with a
 * mouse straight away; on a touch screen, swipe it sideways toward the calendar,
 * or press and hold it). Its left edge is its class's colour. Tap it to open it,
 * or tap its time to change how long it needs. Ticking work off happens on Tasks and
 * in its details: the planner is only for putting work on the calendar.
 */
function PlannerTask({ task }: { task: Task }) {
  const { model, now, ws, select, setEstimate, scheduleTask, scheduleOnDay, newWork } = useApp();
  const drag = usePlanDrag();
  const [editing, setEditing] = useState(false);
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const due = dueLabel(task.dueAt ? new Date(task.dueAt) : null, now);
  const fresh = newWork.has(task.id);
  const typeDefault = ws.prefs.estimates[task.type];
  const open = () => select({ kind: "task", id: task.id });

  return (
    <article
      className="ss-mini-task ss-draggable"
      style={{ "--task": course?.color ?? "var(--ss-personal)" } as React.CSSProperties}
      role="button"
      tabIndex={0}
      ref={dragSourceRef}
      data-picked={(drag?.kind === "new" && drag.taskId === task.id) || undefined}
      aria-label={`${task.title}, ${task.estimate} min, ${due.text}${fresh ? ", new" : ""}. Drag onto the calendar, or open details`}
      title="Grab it and drag it onto the calendar to schedule it"
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onPointerDown={(e) => {
        // The card's time chip picks it up too (a tap still changes the time); the choices it opens don't.
        if ((e.target as HTMLElement).closest(".ss-choices, input")) return;
        const box = e.currentTarget.getBoundingClientRect();
        beginPlanDrag(
          e,
          {
            kind: "new",
            taskId: task.id,
            blockId: null,
            title: task.title,
            minutes: task.estimate,
            // A finger would hide the top of the block, so on touch the block hangs above it.
            grab: e.pointerType === "mouse" ? 0 : Math.min(task.estimate, 60),
            color: "var(--ss-planned)",
            source: { width: box.width, height: box.height, grabX: e.clientX - box.left, grabY: e.clientY - box.top },
          },
          (target) => {
            if (target.kind === "grid") scheduleTask(task, targetStart(target));
            else if (target.kind === "date") scheduleOnDay(task, new Date(target.dayStart));
          },
          { sideways: true, holdMs: 250 },
        );
      }}
    >
      <div className="min-w-0">
        <h3>
          {task.title}
          {fresh ? <span className="ss-new">NEW</span> : null}
        </h3>
        <p>
          <b>{course ? course.code : "Personal"}</b> · <span className={due.late ? "ss-late" : ""}>{due.text}</span>
          {/* Phones: the time as plain text here instead of the chip, so each card is one line shorter. */}
          <span className="ss-mini-time"> · {minutesLabel(task.estimate)}</span>
        </p>
      </div>
      <button
        className="ss-minutes"
        aria-expanded={editing}
        aria-label={`${task.estimate} minutes. Change how long it needs`}
        title="How long it needs. Tap to change"
        onClick={(e) => {
          e.stopPropagation();
          setEditing((v) => !v);
        }}
      >
        <SsIcon name="clock" size={13} /> {minutesLabel(task.estimate)}
      </button>
      {editing ? (
        <div className="ss-choices" role="group" aria-label={`How long ${task.title} needs`} onClick={(e) => e.stopPropagation()}>
          {[...new Set([...ESTIMATE_CHOICES, task.estimate])]
            .sort((a, b) => a - b)
            .map((m) => (
              <button
                key={m}
                aria-pressed={task.estimate === m}
                onClick={() => {
                  setEstimate(task.id, m === typeDefault && task.customEstimate ? null : m);
                  setEditing(false);
                }}
              >
                {minutesLabel(m)}
              </button>
            ))}
        </div>
      ) : null}
    </article>
  );
}
