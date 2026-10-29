"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, startOfWeek } from "date-fns";
import { byUrgency, classRank, isSchoolWork, PRIORITY_LABEL, weekLoad, type DayLoad } from "@/lib/todos";
import type { Task } from "@/lib/types";
import { approxDuration, dueLabel, plural } from "@/lib/ui";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";

type TaskSort = "due" | "length";

const DAY = 86_400_000;
/** Late work older than this has gone quiet; done work shows for a week. */
const LATE_WINDOW = 14 * DAY;
const DONE_WINDOW = 7 * DAY;
const COMPLETED_WINDOW = 30 * DAY;

/**
 * Tasks, the prototype's "master checklist": how the week is going, then every
 * piece of work in one table to search, sort and filter. Synced assignments and
 * your own tasks sit side by side.
 */
export function TasksPage() {
  const { model, ws, now, openAddTask, select, toggleDone } = useApp();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TaskSort>("due");
  const [filter, setFilter] = useState("All");

  const nowMs = now.getTime();
  const doneAt = (t: Task) => {
    const at = ws.done[t.id];
    // "auto:" marks work assumed done because it was already past due when its calendar was added.
    return at && !at.startsWith("auto:") ? Date.parse(at) : null;
  };

  const pool = useMemo(
    () =>
      model.tasks.filter((t) => {
        if (t.done) {
          const at = doneAt(t);
          return at !== null && at >= nowMs - COMPLETED_WINDOW;
        }
        return !t.dueAt || Date.parse(t.dueAt) >= nowMs - LATE_WINDOW;
      }),
    // doneAt reads ws.done, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model.tasks, ws.done, nowMs],
  );

  // Today's work, and the week's day by day, done or not.
  const today = pool.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), now));
  const todayDone = today.filter((t) => t.done).length;
  const percent = today.length ? Math.round((todayDone / today.length) * 100) : 0;
  const week = useMemo(() => weekLoad(pool, startOfWeek(now, { weekStartsOn: 1 })), [pool, now]);

  const filters = ["All", "Today", ...model.visibleCourses.map((c) => c.code), "Personal", "Completed"];
  const rank = classRank(ws.classOrder);

  const visible = useMemo(() => {
    const code = (t: Task) => (t.courseId ? model.courseById.get(t.courseId)?.code : undefined);
    let items = pool.filter((t) => {
      if (filter === "Completed") return t.done;
      // Done work shows for a week after it's ticked off, then only under Completed.
      if (t.done && (doneAt(t) ?? 0) < nowMs - DONE_WINDOW) return false;
      if (filter === "All") return true;
      if (filter === "Today") return Boolean(t.dueAt && isSameDay(new Date(t.dueAt), now));
      if (filter === "Personal") return !isSchoolWork(t);
      return code(t) === filter;
    });
    const q = search.trim().toLowerCase();
    if (q) items = items.filter((t) => `${t.title} ${code(t) ?? "Personal"}`.toLowerCase().includes(q));
    const urgency = byUrgency(rank);
    return [...items].sort((a, b) => (sort === "length" ? a.estimate - b.estimate || urgency(a, b) : urgency(a, b)));
    // doneAt reads ws.done, which pool already follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, filter, search, sort, model.courseById, rank, nowMs]);

  return (
    <section className="ss-tasks-page fade-in">
      <div className="ss-tasks-header">
        <div>
          <span className="ss-eyebrow">MASTER CHECKLIST</span>
          <h1>Everything, in one place.</h1>
          <p>Capture tasks from every part of your life, then let Schedule Smart find the right moment.</p>
        </div>
        <button className="ss-primary" onClick={openAddTask} data-smart-event="add_task_opened">
          <SsIcon name="plus" /> Add new task
        </button>
      </div>

      <div className="ss-summary">
        <div className="ss-summary-card ss-completion">
          <div className="ss-ring">
            <svg viewBox="0 0 58 58" aria-hidden>
              <circle className="ss-ring-track" cx="29" cy="29" r="24" />
              <circle className="ss-ring-progress" cx="29" cy="29" r="24" strokeDasharray="151" strokeDashoffset={151 - (151 * percent) / 100} />
            </svg>
            <strong>
              {percent}
              <small>%</small>
            </strong>
          </div>
          <div className="ss-summary-copy">
            <span>DUE TODAY</span>
            <h2>
              {todayDone} of {today.length} done
            </h2>
            <p>{today.length === 0 ? "Nothing due today" : today.length === todayDone ? "All done for today" : `${plural(today.length - todayDone, "item")} still to do`}</p>
          </div>
        </div>
        <WeekChart days={week} now={now} />
      </div>

      <div className="ss-task-tools">
        <label className="ss-search">
          <SsIcon name="search" size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or classes" aria-label="Search tasks" />
        </label>
        <label className="ss-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as TaskSort)}>
            <option value="due">Due date</option>
            <option value="length">Shortest first</option>
          </select>
        </label>
      </div>
      <div className="ss-filter-row" role="group" aria-label="Show">
        {filters.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="ss-table">
        <div className="ss-table-head" aria-hidden>
          <span>TASK</span>
          <span>AREA</span>
          <span>DUE</span>
          <span>ESTIMATE</span>
          <span>PRIORITY</span>
        </div>
        {visible.length === 0 ? <p className="ss-table-empty">{search ? "Nothing matches that search." : "Nothing here. Nice work."}</p> : null}
        {visible.map((task) => {
          const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
          const due = dueLabel(task.dueAt ? new Date(task.dueAt) : null, now);
          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              className={`ss-task-row ${task.done ? "ss-done" : ""}`}
              onClick={() => select({ kind: "task", id: task.id })}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  select({ kind: "task", id: task.id });
                }
              }}
              aria-label={`${task.title}, ${course?.code ?? "Personal"}, ${due.text}, ${task.estimate} min, ${PRIORITY_LABEL[task.priority]} priority${task.done ? ", done" : ""}. Open details`}
            >
              <div className="ss-task-name">
                <button
                  className="ss-check"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={task.done ? `Mark ${task.title} as not done` : `Complete ${task.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDone(task);
                  }}
                >
                  <SsIcon name="check" size={14} />
                </button>
                <strong>{task.title}</strong>
              </div>
              <span className="ss-area">{course?.code ?? "Personal"}</span>
              <span className={due.late && !task.done ? "text-[var(--ss-danger)] font-semibold" : ""}>{due.text}</span>
              <span>{task.estimate} min</span>
              <span className={`ss-priority ss-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The week at a glance: a column for each day, Monday to Sunday, as tall as the
 * work due that day (by estimate). It starts grey and fills with colour from the
 * bottom as that day's work is ticked off, so a finished week is seven full
 * columns.
 */
function WeekChart({ days, now }: { days: DayLoad[]; now: Date }) {
  const most = Math.max(...days.map((d) => d.minutes), 1);
  const items = days.reduce((n, d) => n + d.items, 0);
  const done = days.reduce((n, d) => n + d.done, 0);
  return (
    <div className="ss-summary-card ss-week-chart">
      <div className="ss-summary-copy">
        <span>THIS WEEK</span>
        <h2>
          {done} of {items} done
        </h2>
        <p>Taller days have more work due. Each fills in as you finish it.</p>
      </div>
      <ol className="ss-week-bars" aria-label="Work due each day this week">
        {days.map((d) => {
          const label = format(d.date, "EEEE");
          const summary = d.items
            ? `${label}: ${d.done} of ${plural(d.items, "item")} done, about ${approxDuration(d.minutes).replace("~", "")} of work`
            : `${label}: nothing due`;
          return (
            <li key={d.date.getTime()} tabIndex={0} aria-label={summary} data-today={isSameDay(d.date, now) || undefined}>
              <span className="ss-week-plot">
                <span className="ss-week-bar" style={{ height: `${d.minutes ? Math.max(6, (d.minutes / most) * 100) : 0}%` }} data-empty={!d.items || undefined}>
                  <i style={{ height: `${d.minutes ? (d.doneMinutes / d.minutes) * 100 : 0}%` }} />
                </span>
              </span>
              <b>{format(d.date, "EEEEE")}</b>
              <span className="ss-week-tip" role="tooltip">
                <strong>{format(d.date, "EEE, MMM d")}</strong>
                {d.items ? `${d.done} of ${d.items} done · ${approxDuration(d.minutes)}` : "Nothing due"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
