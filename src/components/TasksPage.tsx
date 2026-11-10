"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Columns2, LayoutList } from "lucide-react";
import { flushSync } from "react-dom";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { byUrgency, classRank, isSchoolWork } from "@/lib/todos";
import type { ScheduledBlock, Task } from "@/lib/types";
import { clockRange, dueLabel, duration, plural } from "@/lib/ui";
import { MAX_LISTS, newList } from "@/lib/taskLists";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";
import { SplitLists } from "./TaskLists";

/*
 * Tasks: what you've planned, as a checklist. By default it lists the work you
 * put on your calendar, in the order you'll do it, a day at a time. Tick
 * something off and it moves down to Done at the bottom. The bar at the top
 * switches to work that isn't planned yet (or everything), narrows it to one
 * class, searches, and shows or hides what's done.
 */

export type View = "planned" | "unplanned" | "all";

const DAY = 86_400_000;

/** Each tab's heading and the line under it. */
const INTROS: { view: View; title: string; line: string }[] = [
  { view: "planned", title: "What you've planned.", line: "Everything you've put on your calendar, in the order you'll do it. Tick it off as you go." },
  {
    view: "unplanned",
    title: "Not planned yet.",
    line: "Work that doesn't have a time yet, most urgent first. Open one to give it a time, or drag it onto the calendar.",
  },
  { view: "all", title: "All your work.", line: "Planned or not, most urgent first." },
];
const SPLIT_INTRO = { title: "Side by side.", line: `Your lists next to each other, each with its own classes and days. Add up to ${MAX_LISTS}.` };
/** Late work older than this has gone quiet; done work shows for a week. */
const LATE_WINDOW = 14 * DAY;
const DONE_WINDOW = 7 * DAY;

export interface Row {
  task: Task;
  /** The time set aside for it that matters now: the next one, or the last if they've all passed. */
  block: ScheduledBlock | null;
  /** How many times are set aside for it. */
  blocks: number;
}

/** A stable name for an element's view transition (ids hold characters CSS names can't). */
function vtName(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return `ss-task-${(h >>> 0).toString(36)}`;
}

function dayTitle(d: Date, now: Date): string {
  const days = differenceInCalendarDays(d, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return format(d, "EEEE");
  return format(d, "EEE, MMM d");
}

export interface Group {
  key: string;
  title: string | null;
  sub: string | null;
  rows: Row[];
}

/**
 * Work still to do, in groups to list: planned work in the order it's planned,
 * a day at a time, with missed time first; the rest by what's most urgent.
 */
export function groupRows(open: Row[], view: View, now: Date): Group[] {
  // (Class priority was retired: no class comes before another.)
  const urgency = byUrgency(classRank([]));
  if (view !== "planned") return [{ key: "open", title: null, sub: null, rows: [...open].sort((a, b) => urgency(a.task, b.task)) }];
  const nowMs = now.getTime();
  const sorted = [...open].sort((a, b) => a.block!.start.localeCompare(b.block!.start));
  const out: Group[] = [];
  for (const r of sorted) {
    const start = new Date(r.block!.start);
    const missed = Date.parse(r.block!.end) <= nowMs;
    const key = missed ? "missed" : String(startOfDay(start).getTime());
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = missed
        ? { key, title: "Missed", sub: "Its time passed. Tick it off, or open it to plan it again.", rows: [] }
        : { key, title: dayTitle(start, now), sub: differenceInCalendarDays(start, now) < 7 && differenceInCalendarDays(start, now) > 1 ? format(start, "MMMM d") : null, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out;
}

/** Every piece of work worth listing, with the time set aside for it, and when each was ticked off. */
export function useTaskRows(): { rows: Row[]; doneAt: (t: Task) => number | null } {
  const { model, ws, now } = useApp();
  const nowMs = now.getTime();
  const doneAt = (t: Task) => {
    const at = ws.done[t.id];
    // "auto:" marks work assumed done because it was already past due when its calendar was added.
    return at && !at.startsWith("auto:") ? Date.parse(at) : null;
  };
  const rows = useMemo(() => {
    const byTask = new Map<string, ScheduledBlock[]>();
    for (const b of ws.blocks) if (b.taskId) byTask.set(b.taskId, [...(byTask.get(b.taskId) ?? []), b]);
    const out: Row[] = [];
    for (const task of model.tasks) {
      if (task.done) {
        const at = doneAt(task);
        if (at === null || at < nowMs - DONE_WINDOW) continue;
      } else if (task.dueAt && Date.parse(task.dueAt) < nowMs - LATE_WINDOW && !byTask.has(task.id)) continue;
      const mine = [...(byTask.get(task.id) ?? [])].sort((a, b) => a.start.localeCompare(b.start));
      const next = mine.find((b) => Date.parse(b.end) > nowMs) ?? mine[mine.length - 1] ?? null;
      out.push({ task, block: next, blocks: mine.length });
    }
    return out;
    // doneAt reads ws.done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.tasks, ws.blocks, ws.done, nowMs]);
  return { rows, doneAt };
}

/** Ticking off slides the row down to Done, and back (where the browser can animate it). */
export function useTick(): (task: Task) => void {
  const { toggleDone } = useApp();
  return (task: Task) => {
    const go = () => flushSync(() => toggleDone(task));
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reduce) doc.startViewTransition(go);
    else go();
  };
}

/** The classes, and Personal, that a list can show. */
export function useAreas(): Area[] {
  const { model } = useApp();
  return [...model.visibleCourses.map((c) => ({ id: c.id, label: c.code, color: c.color as string | null })), { id: "personal", label: "Personal", color: null }];
}

export function TasksPage() {
  const { model, now, openAddTask, select, setView: goTo, tasksLayout, setTasksLayout, taskLists, setTaskLists } = useApp();
  const [view, setView] = useState<View>("planned");
  // Which classes show: null is all of them, otherwise the ids picked ("personal" for work that isn't a class's).
  const [shownAreas, setShownAreas] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(true);
  const split = tasksLayout === "split";
  // A list just added, so its name can be typed straight away.
  const [added, setAdded] = useState<string | null>(null);
  const { rows, doneAt } = useTaskRows();
  const tick = useTick();
  const areas = useAreas();

  const code = (t: Task) => (t.courseId ? model.courseById.get(t.courseId)?.code : undefined);
  const q = search.trim().toLowerCase();
  const shown = rows.filter(({ task, block }) => {
    if (view === "planned" && !block) return false;
    if (view === "unplanned" && block) return false;
    if (shownAreas && !shownAreas.includes(isSchoolWork(task) && task.courseId ? task.courseId : "personal")) return false;
    if (q && !`${task.title} ${code(task) ?? "Personal"}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const open = shown.filter((r) => !r.task.done);
  const done = shown.filter((r) => r.task.done).sort((a, b) => (doneAt(b.task) ?? 0) - (doneAt(a.task) ?? 0));

  const groups = groupRows(open, view, now);

  const plannedCount = rows.filter((r) => r.block && !r.task.done).length;
  const unplannedCount = rows.filter((r) => !r.block && !r.task.done).length;
  const addList = () => {
    const id = `l${Date.now().toString(36)}`;
    setTaskLists([...taskLists, newList(taskLists, id)]);
    setAdded(id);
  };

  return (
    <section className="ss-tasks-page fade-in" data-split={split || undefined}>
      <div className="ss-tasks-header">
        <div>
          <span className="ss-eyebrow">YOUR PLAN</span>
          {/*
           * Each tab's heading and line, stacked in the same place with only the
           * current one shown: the header is always as tall as the longest, so the
           * island below stays put when switching tabs.
           */}
          <div className="ss-tasks-intro">
            {[...INTROS, { view: "split" as const, ...SPLIT_INTRO }].map((intro) => {
              const current = split ? intro.view === "split" : intro.view === view;
              return (
                <div key={intro.view} aria-hidden={!current} data-current={current || undefined}>
                  <h1>{intro.title}</h1>
                  <p>{intro.line}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="ss-tasks-actions">
          <div className="ss-layout-switch" role="group" aria-label="Layout">
            <button type="button" aria-pressed={!split} onClick={() => setTasksLayout("list")} title="One list">
              <LayoutList size={16} aria-hidden /> List
            </button>
            <button type="button" aria-pressed={split} onClick={() => setTasksLayout("split")} title="Lists side by side">
              <Columns2 size={16} aria-hidden /> Split
            </button>
          </div>
          <button className="ss-primary" onClick={openAddTask} data-smart-event="add_task_opened">
            <SsIcon name="plus" /> Add
          </button>
        </div>
      </div>

      {/* The island: what to list, which class, search, and whether to show what's done. In split view each list has its own. */}
      <div className="ss-island" role="toolbar" aria-label="What to show">
        {split ? (
          <>
            <button type="button" className="ss-island-add" onClick={addList} disabled={taskLists.length >= MAX_LISTS} title={taskLists.length >= MAX_LISTS ? `Up to ${MAX_LISTS} lists` : "Add a list beside these"}>
              <SsIcon name="plus" size={16} /> Add list
            </button>
            <span className="ss-island-note">
              {taskLists.length} of {MAX_LISTS} lists
            </span>
          </>
        ) : (
          <>
        <div className="ss-island-seg" role="group" aria-label="Show">
          {(
            [
              ["planned", "Planned", plannedCount],
              ["unplanned", "Not planned", unplannedCount],
              ["all", "Everything", null],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
              {n ? <span className="ss-island-count">{n}</span> : null}
            </button>
          ))}
        </div>
        <span className="ss-island-divider" aria-hidden />
        <ClassFilter areas={areas} shown={shownAreas} onChange={setShownAreas} />
          </>
        )}
        <div className="ss-island-end">
          <label className="ss-island-search">
            <SsIcon name="search" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search tasks" />
          </label>
          <button type="button" role="switch" aria-checked={showDone} className="ss-island-toggle" onClick={() => setShowDone((v) => !v)}>
            <span className="ss-island-switch" aria-hidden />
            Done
          </button>
        </div>
      </div>

      {split ? (
        <SplitLists rows={rows} doneAt={doneAt} search={q} showDone={showDone} onTick={tick} focus={added} />
      ) : (
      <div className="ss-plan-list">
        {open.length === 0 ? (
          <div className="ss-plan-empty">
            {q || shownAreas ? (
              <p>Nothing here matches.</p>
            ) : view === "planned" ? (
              <>
                <strong>{rows.some((r) => r.block) ? "All of your plan is done." : "Nothing planned yet."}</strong>
                <p>Drag work from the planner onto your calendar, or click a free time on it to add something there.</p>
                <div className="ss-plan-empty-actions">
                  <button className="ss-primary" onClick={() => goTo("calendar")}>
                    Open the calendar
                  </button>
                  {unplannedCount ? (
                    <button className="ss-quiet-button" onClick={() => setView("unplanned")}>
                      See {plural(unplannedCount, "task")} not planned
                    </button>
                  ) : null}
                </div>
              </>
            ) : view === "unplanned" ? (
              <strong>Everything has a time. Nice.</strong>
            ) : (
              <strong>Nothing to do. Nice work.</strong>
            )}
          </div>
        ) : null}

        {groups.map((g) =>
          g.rows.length ? (
            <section key={g.key} className="ss-plan-group" data-missed={g.key === "missed" || undefined}>
              {g.title ? (
                <h2>
                  {g.title}
                  {g.sub ? <span>{g.sub}</span> : null}
                </h2>
              ) : null}
              <ul>
                {g.rows.map((r) => (
                  <TaskLine key={r.task.id} row={r} view={view} onTick={tick} onOpen={() => select({ kind: "task", id: r.task.id })} />
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {showDone && done.length ? (
          <section className="ss-plan-group ss-plan-done">
            <h2>
              Done<span>{plural(done.length, "task")} this week</span>
            </h2>
            <ul>
              {done.map((r) => (
                <TaskLine key={r.task.id} row={r} view={view} onTick={tick} onOpen={() => select({ kind: "task", id: r.task.id })} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      )}
    </section>
  );
}

export interface Area {
  id: string;
  label: string;
  color: string | null;
}

/**
 * Which classes the list shows, as a dropdown: "All classes" until some are
 * picked, then their names (or how many). Each class, and Personal, has a tick
 * box: tick the ones to see. "All classes" at the top shows everything again.
 *
 * With `school` (split view's lists), "School" ticks every class at once, and
 * stays that way as classes come and go.
 */
export function ClassFilter({
  areas,
  shown,
  onChange,
  school = false,
  allLabel = "All classes",
}: {
  areas: Area[];
  shown: string[] | null;
  onChange: (ids: string[] | null) => void;
  school?: boolean;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const classIds = areas.filter((a) => a.id !== "personal").map((a) => a.id);
  const allSchool = Boolean(shown?.includes("school"));
  const isOn = (id: string) => Boolean(shown?.includes(id) || (allSchool && id !== "personal"));
  const picked = shown ? areas.filter((a) => shown.includes(a.id) && !(allSchool && a.id !== "personal")) : [];
  const names = [...(allSchool ? ["School"] : []), ...picked.map((a) => a.label)];
  const label = !shown ? allLabel : names.length <= 2 ? names.join(", ") : `${names.length} classes`;
  // Every class and Personal ticked is everything again; nothing ticked is too.
  const settle = (next: string[]) => {
    const covered = (id: string) => next.includes(id) || (next.includes("school") && id !== "personal");
    onChange(next.length === 0 || areas.every((a) => covered(a.id)) ? null : next);
  };
  // From All, ticking a class shows just that one; ticking more adds them. Unticking the last, or ticking every one, is All again.
  const toggle = (id: string) => {
    let now = shown ?? [];
    // Unticking one class while School is ticked keeps the rest of them.
    if (allSchool && id !== "personal") now = [...now.filter((x) => x !== "school"), ...classIds];
    settle(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
  };
  const toggleSchool = () => {
    const now = shown ?? [];
    settle(allSchool ? now.filter((x) => x !== "school") : [...now.filter((x) => !classIds.includes(x)), "school"]);
  };

  return (
    <div className="ss-filter" ref={box}>
      <button type="button" className="ss-filter-button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-active={shown ? true : undefined}>
        <span className="ss-filter-dots" aria-hidden>
          {(shown ? picked : areas)
            .filter((a) => a.color)
            .slice(0, 3)
            .map((a) => (
              <i key={a.id} style={{ background: a.color! }} />
            ))}
        </span>
        <span className="ss-filter-label">{label}</span>
        <ChevronDown size={16} aria-hidden className="ss-filter-chevron" />
      </button>
      {open ? (
        <div className="ss-filter-menu" role="group" aria-label="Classes to show">
          <button type="button" role="menuitemcheckbox" aria-checked={!shown} onClick={() => onChange(null)} className="ss-filter-all">
            <span className="ss-filter-tick">{!shown ? <Check size={13} strokeWidth={3} /> : null}</span>
            {allLabel}
          </button>
          {school ? (
            <button type="button" role="menuitemcheckbox" aria-checked={allSchool} onClick={toggleSchool} className="ss-filter-all">
              <span className="ss-filter-tick">{allSchool ? <Check size={13} strokeWidth={3} /> : null}</span>
              School<small>every class</small>
            </button>
          ) : null}
          <hr />
          {areas.map((a) => {
            const on = shown ? isOn(a.id) : false;
            return (
              <button key={a.id} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggle(a.id)}>
                <span className="ss-filter-tick" style={a.color ? ({ "--tick": a.color } as React.CSSProperties) : undefined}>
                  {on ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One piece of work: tick it off, or open it. In split view's narrower lists
 * (`compact`) the title can take two lines and the planned time joins the line under it.
 */
export function TaskLine({
  row,
  view,
  onTick,
  onOpen,
  compact = false,
  scope = "",
}: {
  row: Row;
  view: View;
  onTick: (t: Task) => void;
  onOpen: () => void;
  compact?: boolean;
  /** Which list the row is in, when the same work can show in more than one (split view). */
  scope?: string;
}) {
  const { model, now } = useApp();
  const { task, block, blocks } = row;
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const due = dueLabel(task.dueAt ? new Date(task.dueAt) : null, now);
  const start = block ? new Date(block.start) : null;
  const end = block ? new Date(block.end) : null;
  // Planned: when it's planned, then when it's due. Otherwise: when it's due, then how long it takes.
  const when = start && end ? `${view === "planned" ? "" : `${format(start, "EEE")} `}${clockRange(start, end)}` : null;
  const late = due.late && !task.done;

  return (
    <li className="ss-plan-row" data-done={task.done || undefined} style={{ viewTransitionName: vtName(`${scope}${task.id}`) } as React.CSSProperties}>
      <button
        className="ss-check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark ${task.title} as not done` : `Complete ${task.title}`}
        onClick={() => onTick(task)}
      >
        <SsIcon name="check" size={14} />
      </button>
      <button type="button" className="ss-plan-main" onClick={onOpen} aria-label={`${task.title}. Open details`}>
        <strong>{task.title}</strong>
        <span className="ss-plan-meta">
          <span className="ss-plan-class">
            {course ? <i style={{ background: course.color }} aria-hidden /> : null}
            {course?.code ?? "Personal"}
          </span>
          <span className={late ? "ss-plan-late" : undefined}>{!task.dueAt ? "No due date" : late ? due.text : `Due ${due.text}`}</span>
          {blocks > 1 ? <span>{plural(blocks, "time")} planned</span> : null}
          {!block ? <span>{duration(task.estimate)}</span> : null}
          {compact && when ? <span className="ss-plan-when-inline">{when}</span> : null}
        </span>
      </button>
      {compact ? null : when ? <span className="ss-plan-when">{when}</span> : <span className="ss-plan-when ss-plan-when-none">Not planned</span>}
    </li>
  );
}
