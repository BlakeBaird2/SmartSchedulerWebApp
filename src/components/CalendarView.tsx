"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
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
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { layoutColumns } from "@/lib/layout";
import type { PlannedBlock } from "@/lib/planner";
import type { CalEvent, Task } from "@/lib/types";
import { applyFilters, clock, clockRange, dayKey, duration, typeIconClass, typeMeta } from "@/lib/ui";
import { courseStyle, useApp, type CalMode } from "./context";
import { FilterBar } from "./FilterBar";
import { Button, SegmentedControl } from "./ui";

const MODES: { id: CalMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const WEEK = { weekStartsOn: 1 } as const;
const HOUR_PX = 48;

/** Tasks and events that pass the filters, plus planned work, grouped for quick lookup by day. */
function useCalendarData() {
  const { model, filters, plan } = useApp();
  return useMemo(() => {
    const tasks = applyFilters(model.tasks, filters);
    const taskIds = new Set(tasks.map((t) => t.id));
    const courseSet = filters.courses ? new Set(filters.courses) : null;
    const events = model.events.filter((e) => !courseSet || !e.courseId || courseSet.has(e.courseId));

    const dueByDay = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const k = dayKey(new Date(t.dueAt));
      dueByDay.set(k, [...(dueByDay.get(k) ?? []), t]);
    }
    const workByDay = new Map<string, { block: PlannedBlock; task: Task }[]>();
    const byId = new Map(model.tasks.map((t) => [t.id, t]));
    for (const d of plan.days) {
      const list = d.blocks.filter((b) => taskIds.has(b.taskId)).map((block) => ({ block, task: byId.get(block.taskId)! }));
      if (list.length) workByDay.set(dayKey(d.date), list);
    }
    return { tasks, events, dueByDay, workByDay };
  }, [model, filters, plan]);
}

export function CalendarView() {
  const { calMode, setCalMode, calCursor, setCalCursor, timezone } = useApp();
  const data = useCalendarData();

  const step = (dir: number) => {
    if (calMode === "month") setCalCursor(addMonths(calCursor, dir));
    else if (calMode === "week") setCalCursor(addWeeks(calCursor, dir));
    else setCalCursor(addDays(calCursor, dir));
  };

  const title =
    calMode === "month"
      ? format(calCursor, "MMMM yyyy")
      : calMode === "week"
        ? `${format(startOfWeek(calCursor, WEEK), "MMM d")} – ${format(endOfWeek(calCursor, WEEK), "MMM d, yyyy")}`
        : format(calCursor, "EEEE, MMMM d");

  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(calCursor, WEEK), end: endOfWeek(calCursor, WEEK) }), [calCursor]);

  return (
    <div className="space-y-3">
      <FilterBar />
      <div className="flex items-center gap-2 flex-wrap">
        {/* Same order as Google and Outlook calendars: Today, back, forward, then the range. */}
        <div className="flex items-center gap-1">
          <Button onClick={() => setCalCursor(new Date())} className="mr-1">
            Today
          </Button>
          <Button iconOnly icon={ChevronLeft} label={`Previous ${calMode}`} onClick={() => step(-1)} />
          <Button iconOnly icon={ChevronRight} label={`Next ${calMode}`} onClick={() => step(1)} />
        </div>
        <h2 className="text-lg font-bold ml-1" aria-live="polite">
          {title}
        </h2>
        <SegmentedControl label="Calendar range" className="ml-auto" options={MODES} value={calMode} onChange={setCalMode} />
      </div>

      {calMode === "month" ? <MonthGrid data={data} /> : null}
      {calMode === "week" ? <TimeGrid days={weekDays} data={data} /> : null}
      {calMode === "day" ? <TimeGrid days={[startOfDay(calCursor)]} data={data} /> : null}

      <div className="flex items-center gap-4 flex-wrap text-xs text-muted">
        {calMode !== "month" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 event-block" style={courseStyle("#64748b")} /> Events and classes (busy)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-3.5 plan-block !rounded-[4px] grid place-items-center" style={courseStyle("#64748b")}>
                <span className="plan-tick !w-2 !h-2 !rounded-[2px]" />
              </span>{" "}
              Planned work (white with a tick box: it can move)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 border-l-2 border-dashed border-ok/60" /> Free time (click to open)
            </span>
          </>
        ) : (
          <span>Click a day to open it.</span>
        )}
        <span className="ml-auto">Times in {timezone.replace(/_/g, " ")}</span>
      </div>
    </div>
  );
}

type CalData = ReturnType<typeof useCalendarData>;

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

function MonthGrid({ data }: { data: CalData }) {
  const { calCursor, setCalCursor, setCalMode, model, select } = useApp();
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(calCursor), WEEK), end: endOfWeek(endOfMonth(calCursor), WEEK) }),
    [calCursor],
  );
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of data.events) {
      if (e.allDay || e.source === "weekly") continue;
      const k = dayKey(new Date(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [data.events]);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold text-muted text-center uppercase tracking-wide">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const due = data.dueByDay.get(k) ?? [];
          const events = eventsByDay.get(k) ?? [];
          const inMonth = isSameMonth(d, calCursor);
          const today = isToday(d);
          const shown = due.slice(0, 3);
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              onClick={() => {
                setCalCursor(d);
                setCalMode("day");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setCalCursor(d);
                  setCalMode("day");
                }
              }}
              className={`text-left min-h-[92px] sm:min-h-[112px] border-b border-r border-line p-1 sm:p-1.5 cursor-pointer transition hover:bg-surface-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset ${inMonth ? "" : "bg-surface-2/30"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center text-xs tabular-nums ${
                    today ? "bg-accent text-white font-bold w-6 h-6 rounded-full" : inMonth ? "text-fg" : "text-faint"
                  }`}
                >
                  {format(d, "d")}
                </span>
                {events.length > 0 ? <span className="text-[10px] text-muted tabular-nums hidden sm:inline">{events.length === 1 ? "1 event" : `${events.length} events`}</span> : null}
              </div>
              <div className="space-y-[3px]">
                {shown.map((t) => {
                  const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                  const meta = typeMeta(t.type);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      style={courseStyle(course?.color)}
                      onClick={(e) => {
                        e.stopPropagation();
                        select({ kind: "task", id: t.id });
                      }}
                      title={t.title}
                      className={`w-full text-left flex items-center gap-1 px-1 sm:px-1.5 py-[3px] text-[11px] leading-tight course-tint hover:brightness-95 dark:hover:brightness-110 transition ${t.done ? "opacity-45 line-through" : ""}`}
                    >
                      <meta.icon size={11} className={`shrink-0 hidden sm:block ${t.type === "exam" || t.type === "quiz" ? typeIconClass(t.type) : "course-text"}`} strokeWidth={2.5} />
                      <span className={`truncate ${t.type === "exam" ? "font-semibold" : ""}`}>{t.title}</span>
                    </button>
                  );
                })}
                {due.length > shown.length ? <div className="text-[10px] text-muted pl-1.5">+{due.length - shown.length} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week and day: a time grid with events and planned work side by side
// ---------------------------------------------------------------------------

type GridItem =
  | { kind: "event"; id: string; start: number; end: number; event: CalEvent }
  | { kind: "work"; id: string; start: number; end: number; block: PlannedBlock; task: Task };

const MIN = 60_000;

type GapItem = { id: string; start: number; end: number; startMs: number; minutes: number };

function TimeGrid({ days, data }: { days: Date[]; data: CalData }) {
  const { ws, now, select, setCalCursor, setCalMode, model, plan } = useApp();
  const single = days.length === 1;

  const columns = useMemo(
    () =>
      days.map((day) => {
        const from = startOfDay(day).getTime();
        const to = addDays(startOfDay(day), 1).getTime();
        const items: GridItem[] = [];
        const gaps: GapItem[] = [];
        const allDay: CalEvent[] = [];
        for (const e of data.events) {
          const s = Date.parse(e.start);
          const en = Date.parse(e.end);
          if (en <= from || s >= to) continue;
          if (e.allDay) allDay.push(e);
          else items.push({ kind: "event", id: e.id, start: Math.max(s, from), end: Math.min(en, to), event: e });
        }
        for (const w of data.workByDay.get(dayKey(day)) ?? []) {
          items.push({ kind: "work", id: `${w.task.id}:${w.block.part}`, start: w.block.start.getTime(), end: w.block.end.getTime(), ...w });
        }
        const dayPlan = plan.days.find((d) => dayKey(d.date) === dayKey(day));
        for (const g of dayPlan?.gaps ?? []) {
          gaps.push({
            id: `gap:${g.start.getTime()}`,
            start: g.start.getTime(),
            end: g.end.getTime(),
            startMs: g.start.getTime(),
            minutes: g.minutes,
          });
        }
        return { day, from, items, gaps, allDay, due: data.dueByDay.get(dayKey(day)) ?? [] };
      }),
    [days, data, plan.days],
  );

  // Show the working day, stretched to fit anything outside it.
  let startHour = Math.floor(ws.prefs.dayStart / 60);
  let endHour = Math.ceil(ws.prefs.dayEnd / 60);
  for (const c of columns) {
    for (const it of c.items) {
      startHour = Math.min(startHour, Math.floor((it.start - c.from) / (60 * MIN)));
      endHour = Math.max(endHour, Math.ceil((it.end - c.from) / (60 * MIN)));
    }
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const top = (ms: number, from: number) => ((ms - from) / MIN - startHour * 60) * (HOUR_PX / 60);

  // On a narrow screen the week scrolls sideways; start it at today.
  const scroller = useRef<HTMLDivElement>(null);
  const firstDay = days[0].getTime();
  useEffect(() => {
    const el = scroller.current;
    const today = el?.querySelector<HTMLElement>("[data-today]");
    if (el && today && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = today.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 48;
    }
  }, [firstDay]);

  return (
    <div ref={scroller} className="card overflow-x-auto scrollbar-thin">
      <div className={single ? "" : "min-w-[720px]"}>
        {/* Day headers, all-day events and deadlines */}
        <div className="flex border-b border-line bg-surface-2/40">
          <div className="w-12 shrink-0 sticky left-0 z-20 bg-surface" />
          {columns.map((c) => (
            <div key={c.from} data-today={isToday(c.day) || undefined} className="flex-1 min-w-0 border-l border-line px-1.5 py-1.5">
              {!single ? (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setCalCursor(c.day);
                    setCalMode("day");
                  }}
                >
                  <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">{format(c.day, "EEE")} </span>
                  <span
                    className={`text-sm tabular-nums inline-flex items-center justify-center ${isToday(c.day) ? "bg-accent text-white font-bold w-6 h-6 rounded-full" : "font-semibold"}`}
                  >
                    {format(c.day, "d")}
                  </span>
                </button>
              ) : null}
              <div className="space-y-[3px] mt-0.5">
                {c.allDay.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => select({ kind: "event", id: e.id })}
                    className="course-chip w-full truncate text-left px-1 py-px text-[10.5px] font-medium"
                    style={courseStyle(e.color)}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
                {c.due.map((t) => {
                  const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => select({ kind: "task", id: t.id })}
                      className={`w-full flex items-center gap-1 text-left px-1 py-px text-[10.5px] course-tint ${t.done ? "opacity-45 line-through" : ""}`}
                      style={courseStyle(course?.color)}
                      title={`Due ${t.allDay ? "today" : clock(new Date(t.dueAt!))}: ${t.title}`}
                    >
                      <Flag size={9} className={`shrink-0 ${t.type === "exam" ? "text-danger" : "course-text"}`} />
                      <span className="truncate">
                        {t.allDay ? "" : `${clock(new Date(t.dueAt!))} `}
                        {t.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Hours */}
        <div className="flex relative">
          <div className="w-12 shrink-0 sticky left-0 z-20 bg-surface">
            {hours.map((h) => (
              <div key={h} className={`text-[10px] text-faint text-right pr-1.5 tabular-nums ${h === startHour ? "pt-0.5" : "-translate-y-1.5"}`} style={{ height: HOUR_PX }}>
                {h === 0 ? "" : clock(new Date(2000, 0, 1, h))}
              </div>
            ))}
          </div>
          {columns.map((c) => {
            const placed = layoutColumns(c.items, (i) => i.start, (i) => i.end);
            const showNow = isSameDay(c.day, now) && now.getHours() >= startHour && now.getHours() < endHour;
            return (
              <div key={c.from} className="flex-1 min-w-0 relative border-l border-line" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
                ))}
                {c.gaps.map((g) => {
                  const y = top(g.start, c.from);
                  const gh = Math.max(14, top(g.end, c.from) - y - 2);
                  if (y + gh < 0 || y > hours.length * HOUR_PX) return null;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => select({ kind: "gap", startMs: g.startMs })}
                      className="absolute inset-x-0.5 z-0 border-l-2 border-dashed border-ok/40 rounded-r-md text-left pl-1.5 pr-1 py-0.5 overflow-hidden transition-colors hover:bg-ok-soft hover:border-ok"
                      style={{ top: y + 1, height: gh }}
                      title={`Free · ${duration(g.minutes)} — open gap`}
                    >
                      {/* Background, not content: the same dashed green line as free time on Plan, and a quiet label, so events and planned work stay what the eye reads first. */}
                      {gh > 22 ? <span className="text-[10px] font-medium text-ok/80">Free · {duration(g.minutes)}</span> : null}
                    </button>
                  );
                })}
                {placed.map(({ item, col, cols }) => {
                  const y = top(item.start, c.from);
                  const h = Math.max(18, top(item.end, c.from) - y - 2);
                  const style: React.CSSProperties = {
                    top: y + 1,
                    height: h,
                    left: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 4px)`,
                  };
                  if (item.kind === "event") {
                    const e = item.event;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => select({ kind: "event", id: e.id })}
                        className={`event-block absolute z-[1] flex flex-col justify-start text-left overflow-hidden px-1.5 py-1 ${e.busy ? "" : "opacity-60"}`}
                        style={{ ...style, ...courseStyle(e.color) }}
                        title={`${e.title} · ${clockRange(new Date(e.start), new Date(e.end))}`}
                      >
                        <div className="event-title text-[11px] font-semibold leading-tight truncate">{e.title}</div>
                        {h > 30 ? <div className="text-[10px] text-muted leading-tight truncate">{clockRange(new Date(e.start), new Date(e.end))}</div> : null}
                      </button>
                    );
                  }
                  const course = item.task.courseId ? model.courseById.get(item.task.courseId) : undefined;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => select({ kind: "task", id: item.task.id })}
                      className={`plan-block absolute z-[1] flex flex-col justify-start text-left overflow-hidden px-1.5 py-1 ${item.task.done ? "opacity-50" : ""}`}
                      style={{ ...style, ...courseStyle(course?.color) }}
                      title={`Work on ${item.task.title} · ${duration(item.block.minutes)}`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="plan-tick" data-done={item.task.done || undefined} aria-hidden />
                        <span className="text-[11px] font-semibold leading-tight truncate">{item.task.title}</span>
                      </div>
                      {h > 30 ? (
                        <div className="text-[10px] text-muted leading-tight truncate">
                          {course ? <span className="course-text">{course.code} · </span> : null}
                          {duration(item.block.minutes)}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
                {showNow ? (
                  <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: top(now.getTime(), c.from) }}>
                    <div className="h-px bg-danger" />
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-danger" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
