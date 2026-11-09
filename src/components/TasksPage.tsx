"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { flushSync } from "react-dom";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { byUrgency, classRank, isSchoolWork } from "@/lib/todos";
import type { ScheduledBlock, Task } from "@/lib/types";
import { clockRange, dueLabel, duration, plural } from "@/lib/ui";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";

/*
 * Tasks: what you've planned, as a checklist. By default it lists the work you
 * put on your calendar, in the order you'll do it, a day at a time. Tick
 * something off and it moves down to Done at the bottom. The bar at the top
 * switches to work that isn't planned yet (or everything), narrows it to one
 * class, searches, and shows or hides what's done.
 */

type View = "planned" | "unplanned" | "all";

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
/** Late work older than this has gone quiet; done work shows for a week. */
const LATE_WINDOW = 14 * DAY;
const DONE_WINDOW = 7 * DAY;

interface Row {
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

export function TasksPage() {
  const { model, ws, now, openAddTask, select, toggleDone, setView: goTo } = useApp();
  const [view, setView] = useState<View>("planned");
  // Which classes show: null is all of them, otherwise the ids picked ("personal" for work that isn't a class's).
  const [shownAreas, setShownAreas] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(true);
  const nowMs = now.getTime();
  // (Class priority was retired: no class comes before another.)
  const rank = classRank([]);

  const doneAt = (t: Task) => {
    const at = ws.done[t.id];
    // "auto:" marks work assumed done because it was already past due when its calendar was added.
    return at && !at.startsWith("auto:") ? Date.parse(at) : null;
  };

  // Every piece of work worth listing, with the time set aside for it.
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

  // Planned work in the order it's planned, a day at a time; missed time first.
  // The rest by what's most urgent.
  const groups = (() => {
    const urgency = byUrgency(rank);
    if (view !== "planned") return [{ key: "open", title: null as string | null, sub: null as string | null, rows: [...open].sort((a, b) => urgency(a.task, b.task)) }];
    const sorted = [...open].sort((a, b) => a.block!.start.localeCompare(b.block!.start));
    const out: { key: string; title: string | null; sub: string | null; rows: Row[] }[] = [];
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
  })();

  // Ticking off slides the row down to Done, and back (where the browser can animate it).
  const tick = (task: Task) => {
    const go = () => flushSync(() => toggleDone(task));
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reduce) doc.startViewTransition(go);
    else go();
  };

  const plannedCount = rows.filter((r) => r.block && !r.task.done).length;
  const unplannedCount = rows.filter((r) => !r.block && !r.task.done).length;
  const areas = [
    ...model.visibleCourses.map((c) => ({ id: c.id, label: c.code, color: c.color as string | null })),
    { id: "personal", label: "Personal", color: null },
  ];

  return (
    <section className="ss-tasks-page fade-in">
      <div className="ss-tasks-header">
        <div>
          <span className="ss-eyebrow">YOUR PLAN</span>
          {/*
           * Each tab's heading and line, stacked in the same place with only the
           * current one shown: the header is always as tall as the longest, so the
           * island below stays put when switching tabs.
           */}
          <div className="ss-tasks-intro">
            {INTROS.map((intro) => (
              <div key={intro.view} aria-hidden={intro.view !== view} data-current={intro.view === view || undefined}>
                <h1>{intro.title}</h1>
                <p>{intro.line}</p>
              </div>
            ))}
          </div>
        </div>
        <button className="ss-primary" onClick={openAddTask} data-smart-event="add_task_opened">
          <SsIcon name="plus" /> Add
        </button>
      </div>

      {/* The island: what to list, which class, search, and whether to show what's done. */}
      <div className="ss-island" role="toolbar" aria-label="What to show">
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
    </section>
  );
}

/**
 * Which classes the list shows, as a dropdown: "All classes" until some are
 * picked, then their names (or how many). Each class, and Personal, has a tick
 * box: tick the ones to see. "All classes" at the top shows everything again.
 */
function ClassFilter({
  areas,
  shown,
  onChange,
}: {
  areas: { id: string; label: string; color: string | null }[];
  shown: string[] | null;
  onChange: (ids: string[] | null) => void;
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

  const picked = shown ? areas.filter((a) => shown.includes(a.id)) : [];
  const label = !shown ? "All classes" : picked.length === 1 ? picked[0].label : picked.length === 2 ? `${picked[0].label}, ${picked[1].label}` : `${picked.length} classes`;
  // From All, ticking a class shows just that one; ticking more adds them. Unticking the last, or ticking every one, is All again.
  const toggle = (id: string) => {
    const now = shown ?? [];
    const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    onChange(next.length === 0 || next.length === areas.length ? null : next);
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
            All classes
          </button>
          <hr />
          {areas.map((a) => {
            const on = Boolean(shown?.includes(a.id));
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

function TaskLine({ row, view, onTick, onOpen }: { row: Row; view: View; onTick: (t: Task) => void; onOpen: () => void }) {
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
    <li className="ss-plan-row" data-done={task.done || undefined} style={{ viewTransitionName: vtName(task.id) } as React.CSSProperties}>
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
        </span>
      </button>
      {when ? <span className="ss-plan-when">{when}</span> : <span className="ss-plan-when ss-plan-when-none">Not planned</span>}
    </li>
  );
}
