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
import { ChevronLeft, ChevronRight, Flag, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { layoutColumns } from "@/lib/layout";
import { NO_DUE_COLOR, urgencyColor } from "@/lib/todos";
import type { CalEvent, ScheduledBlock, Task } from "@/lib/types";
import { applyFilters, clock, clockRange, dayKey, duration, typeMeta } from "@/lib/ui";
import { courseStyle, useApp, useIsPhone, type CalMode } from "./context";
import { FilterBar } from "./FilterBar";
import { CalendarSidebar } from "./CalendarSidebar";
import { DragGhost } from "./DragGhost";
import { TodoSheet } from "./TodoSheet";
import { beginPlanDrag, dragSourceRef, targetStart, usePlanDrag, type DropTarget } from "./planDrag";
import { Button, SegmentedControl } from "./ui";

const MODES: { id: CalMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

/** Phones get Google Calendar's app views: an agenda list, one day, three days, and the month. */
const PHONE_MODES: { id: CalMode; label: string }[] = [
  { id: "schedule", label: "Schedule" },
  { id: "day", label: "Day" },
  { id: "3day", label: "3 days" },
  { id: "month", label: "Month" },
];

/** The same saved choice, shown the closest way the screen allows. */
function modeFor(mode: CalMode, phone: boolean): CalMode {
  if (phone) return mode === "week" ? "schedule" : mode;
  return mode === "3day" || mode === "schedule" ? "week" : mode;
}

const WEEK = { weekStartsOn: 1 } as const;
const HOUR_PX = 64;
/** Room between the day headers and the first hour, so the grid doesn't start right against them. */
const TOP_PAD = 12;

/**
 * Time the student set aside, ready to draw. Free time is left empty on the
 * calendar: the to-do list beside it suggests what to put there next.
 */
export interface CalBlock {
  id: string;
  block: ScheduledBlock;
  /** The work it is for. Null for set-aside time that isn't for a task. */
  task: Task | null;
  title: string;
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * The colour scheduled work is drawn in: one the student picked, or by how soon
 * its work is due (red to yellow). Done work goes grey, so it reads as finished.
 */
function blockTint(item: CalBlock, now: Date): string {
  if (item.block.color) return item.block.color;
  if (!item.task) return NO_DUE_COLOR;
  return item.task.done ? NO_DUE_COLOR : urgencyColor(item.task.dueAt, now);
}

/** Tasks and events that pass the filters, plus set-aside time, grouped for quick lookup by day. */
function useCalendarData() {
  const { model, filters, ws } = useApp();
  return useMemo(() => {
    const tasks = applyFilters(model.tasks, filters);
    const courseSet = filters.courses ? new Set(filters.courses) : null;
    const events = model.events.filter((e) => !courseSet || !e.courseId || courseSet.has(e.courseId));

    const dueByDay = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const k = dayKey(new Date(t.dueAt));
      dueByDay.set(k, [...(dueByDay.get(k) ?? []), t]);
    }
    // Set-aside time stays on the calendar after its work is done, so done work isn't filtered out here.
    const blocksByDay = new Map<string, CalBlock[]>();
    const byId = new Map(model.tasks.map((t) => [t.id, t]));
    for (const block of ws.blocks) {
      const task = block.taskId ? (byId.get(block.taskId) ?? null) : null;
      // Time for work that has gone (its calendar removed, its class hidden) or is filtered out isn't shown.
      if (block.taskId && (!task || (courseSet && (!task.courseId || !courseSet.has(task.courseId))))) continue;
      const start = new Date(block.start);
      const end = new Date(block.end);
      const item: CalBlock = {
        id: block.id,
        block,
        task,
        title: task?.title ?? block.title,
        start,
        end,
        minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      };
      const k = dayKey(start);
      blocksByDay.set(k, [...(blocksByDay.get(k) ?? []), item]);
    }
    return { tasks, events, dueByDay, blocksByDay };
  }, [model, filters, ws.blocks]);
}

export function CalendarView() {
  const { calMode: saved, setCalMode, calCursor, setCalCursor, timezone, calSidebar, setCalSidebar } = useApp();
  const phone = useIsPhone();
  const calMode = modeFor(saved, phone);
  const data = useCalendarData();
  const dueDays = useMemo(() => new Set(data.dueByDay.keys()), [data.dueByDay]);

  const step = (dir: number) => {
    if (calMode === "month") setCalCursor(addMonths(calCursor, dir));
    else if (calMode === "week" || calMode === "schedule") setCalCursor(addWeeks(calCursor, dir));
    else if (calMode === "3day") setCalCursor(addDays(calCursor, 3 * dir));
    else setCalCursor(addDays(calCursor, dir));
  };
  const unit = calMode === "3day" ? "3 days" : calMode === "schedule" ? "week" : calMode;

  const title =
    calMode === "month"
      ? format(calCursor, "MMMM yyyy")
      : calMode === "week"
        ? `${format(startOfWeek(calCursor, WEEK), "MMM d")} – ${format(endOfWeek(calCursor, WEEK), "MMM d, yyyy")}`
        : calMode === "day"
          ? format(calCursor, phone ? "EEE, MMM d" : "EEEE, MMMM d")
          : format(calCursor, "MMMM yyyy");

  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(calCursor, WEEK), end: endOfWeek(calCursor, WEEK) }), [calCursor]);
  const threeDays = useMemo(() => [0, 1, 2].map((i) => addDays(startOfDay(calCursor), i)), [calCursor]);

  const views = (
    <>
      {calMode === "month" ? <MonthGrid data={data} phone={phone} /> : null}
      {calMode === "month" && phone ? (
        // Phones: tap a day in the month and its events and work are listed underneath.
        <Agenda data={data} count={1} />
      ) : null}
      {calMode === "week" ? <TimeGrid days={weekDays} data={data} /> : null}
      {calMode === "3day" ? <TimeGrid days={threeDays} data={data} /> : null}
      {calMode === "day" ? <TimeGrid days={[startOfDay(calCursor)]} data={data} /> : null}
      {calMode === "schedule" ? <Agenda data={data} /> : null}
    </>
  );

  if (phone) {
    return (
      <div className="space-y-3">
        <FilterBar />
        {/* Phones: Google Calendar's app header. The month on the left, Today and the arrows on the right, the views underneath. */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold tracking-tight flex-1 min-w-0 truncate" aria-live="polite">
              {title}
            </h2>
            <Button size="sm" onClick={() => setCalCursor(new Date())}>
              Today
            </Button>
            <Button variant="quiet" iconOnly icon={ChevronLeft} label={`Previous ${unit}`} onClick={() => step(-1)} />
            <Button variant="quiet" iconOnly icon={ChevronRight} label={`Next ${unit}`} onClick={() => step(1)} />
          </div>
          <SegmentedControl label="Calendar view" stretch options={PHONE_MODES} value={calMode} onChange={setCalMode} />
        </div>
        {views}
        {/* Room under the last hour for the to-do sheet. */}
        <div className="h-20" aria-hidden />
        <TodoSheet hasTimes={calMode === "day" || calMode === "3day"} showTimes={() => setCalMode("day")} />
        <DragGhost />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar />
      {/* Computers: Notion Calendar and Sunsama's layout. A month to jump around and the work to plan on the left, the calendar on the right. */}
      <div className={calSidebar ? "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-5 lg:items-start" : ""}>
        {calSidebar ? <CalendarSidebar mode={calMode} dueDays={dueDays} /> : null}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              iconOnly
              icon={calSidebar ? PanelLeftClose : PanelLeftOpen}
              label={calSidebar ? "Hide the to-do list" : "Show the to-do list"}
              aria-pressed={calSidebar}
              className="hidden lg:inline-flex"
              onClick={() => setCalSidebar(!calSidebar)}
            />
            {/* Same order as Google and Outlook calendars: Today, back, forward, then the range. */}
            <div className="flex items-center gap-1">
              <Button onClick={() => setCalCursor(new Date())} className="mr-1">
                Today
              </Button>
              <Button iconOnly icon={ChevronLeft} label={`Previous ${calMode}`} onClick={() => step(-1)} />
              <Button iconOnly icon={ChevronRight} label={`Next ${calMode}`} onClick={() => step(1)} />
            </div>
            <h2 className="text-xl font-bold tracking-tight ml-1" aria-live="polite">
              {title}
            </h2>
            <SegmentedControl label="Calendar range" className="ml-auto" options={MODES} value={calMode} onChange={setCalMode} />
          </div>
          {views}
          <Legend month={calMode === "month"} timezone={timezone} />
        </div>
      </div>
      {/* Tablets: no room for the sidebar, so the to-do list is a sheet, as on phones. */}
      <TodoSheet className="lg:hidden" hasTimes={calMode !== "month"} showTimes={() => setCalMode("week")} />
      <DragGhost />
    </div>
  );
}

/** What each kind of block means, in a word and a picture. */
function Legend({ month, timezone }: { month: boolean; timezone: string }) {
  return (
    <div className="hidden md:flex items-center gap-x-5 gap-y-2 flex-wrap text-xs text-muted">
      {!month ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-3.5 event-block !rounded-[4px]" style={courseStyle("#64748b")} aria-hidden />
            Class or event
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-3.5 plan-block !rounded-[4px] grid place-items-center" style={courseStyle("#64748b")} aria-hidden>
              <span className="plan-tick !w-2 !h-2 !rounded-[2px]" />
            </span>
            Work you scheduled <span className="text-faint">(drag to move)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="due-chip !inline-flex px-1 py-px" aria-hidden>
              <Flag size={10} />
            </span>
            Due
          </span>
        </>
      ) : (
        <span>Click a day to open it.</span>
      )}
      <span className="ml-auto">Times in {timezone.replace(/_/g, " ")}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule (phones): Google Calendar's agenda list
// ---------------------------------------------------------------------------

const AGENDA_DAYS = 14;

type AgendaRow =
  | { kind: "event"; key: string; sort: number; event: CalEvent }
  | { kind: "work"; key: string; sort: number; item: CalBlock }
  | { kind: "due"; key: string; sort: number; task: Task };

/**
 * Two weeks as one scrolling list, like Google Calendar's Schedule view: the date
 * in a narrow column on the left, that day's events and planned work stacked on
 * the right in time order. Days with nothing on them are left out; today always
 * shows, so you can see where you are.
 */
function Agenda({ data, count = AGENDA_DAYS }: { data: CalData; count?: number }) {
  const { calCursor, select, model, now } = useApp();
  const startMs = startOfDay(calCursor).getTime();

  const days = useMemo(() => {
    const start = new Date(startMs);
    const out: { day: Date; rows: AgendaRow[] }[] = [];
    for (let i = 0; i < count; i++) {
      const day = addDays(start, i);
      const from = day.getTime();
      const to = addDays(day, 1).getTime();
      const rows: AgendaRow[] = [];
      for (const e of data.events) {
        const s = Date.parse(e.start);
        const en = Date.parse(e.end);
        if (en <= from || s >= to) continue;
        rows.push({ kind: "event", key: `e:${e.id}`, sort: e.allDay ? -1 : Math.max(s, from), event: e });
      }
      for (const item of data.blocksByDay.get(dayKey(day)) ?? []) {
        rows.push({ kind: "work", key: `w:${item.id}`, sort: item.start.getTime(), item });
      }
      for (const t of data.dueByDay.get(dayKey(day)) ?? []) {
        rows.push({ kind: "due", key: `d:${t.id}`, sort: t.allDay ? -0.5 : Date.parse(t.dueAt!), task: t });
      }
      rows.sort((a, b) => a.sort - b.sort);
      if (rows.length || isToday(day) || count === 1) out.push({ day, rows });
    }
    return out;
  }, [data, startMs, count]);

  return (
    <ol className="space-y-4">
      {days.map(({ day, rows }) => {
        const today = isToday(day);
        return (
          <li key={dayKey(day)} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2.5" data-today={today || undefined}>
            <div className="text-center pt-0.5">
              <div className={`text-[11px] font-semibold uppercase tracking-wide ${today ? "text-accent" : "text-muted"}`}>{format(day, "EEE")}</div>
              <div
                className={`mx-auto mt-0.5 grid place-items-center text-lg font-semibold tabular-nums leading-none ${
                  today ? "h-9 w-9 rounded-full bg-accent text-white" : "h-9"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              {rows.length === 0 ? <p className="pt-2.5 text-sm text-muted">{today ? "Nothing on today." : "Nothing on this day."}</p> : null}
              {rows.map((r) => {
                if (r.kind === "event") {
                  const e = r.event;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => select({ kind: "event", id: e.id })}
                      className={`event-block w-full text-left px-3 py-2 ${e.busy ? "" : "opacity-60"}`}
                      style={courseStyle(e.color)}
                    >
                      <div className="event-title text-sm font-semibold truncate">{e.title}</div>
                      <div className="text-xs text-muted truncate">
                        {e.allDay ? "All day" : clockRange(new Date(e.start), new Date(e.end))}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                    </button>
                  );
                }
                if (r.kind === "work") {
                  const { task } = r.item;
                  const course = task?.courseId ? model.courseById.get(task.courseId) : undefined;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => (task ? select({ kind: "task", id: task.id }) : undefined)}
                      className={`plan-block urgency-card w-full text-left pl-3.5 pr-3 py-2 flex items-start gap-2 ${task?.done ? "opacity-50" : ""}`}
                      style={{ "--u": blockTint(r.item, now), "--c": blockTint(r.item, now) } as React.CSSProperties}
                    >
                      <span className="plan-tick mt-1" data-done={task?.done || undefined} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{r.item.title}</span>
                        <span className="block text-xs text-muted truncate">
                          {clockRange(r.item.start, r.item.end)}
                          {course ? (
                            <>
                              {" · "}
                              <span className="course-text font-medium" style={courseStyle(course.color)}>
                                {course.code}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                }
                const t = r.task;
                const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                const late = !t.done && t.dueAt ? Date.parse(t.dueAt) < now.getTime() : false;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => select({ kind: "task", id: t.id })}
                    data-late={late || undefined}
                    className={`due-chip w-full text-left px-2.5 py-1.5 text-xs ${t.done ? "opacity-50 line-through" : ""}`}
                    style={courseStyle(course?.color)}
                  >
                    <Flag size={12} aria-hidden />
                    <span className="truncate">
                      <span className="font-semibold">Due {t.allDay ? "today" : clock(new Date(t.dueAt!))}:</span> {t.title}
                    </span>
                    {course ? <span className="course-text ml-auto shrink-0 font-medium">{course.code}</span> : null}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type CalData = ReturnType<typeof useCalendarData>;

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

function MonthGrid({ data, phone }: { data: CalData; phone: boolean }) {
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
                // Computers open the day; phones list it under the month instead.
                if (!phone) setCalMode("day");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setCalCursor(d);
                  setCalMode("day");
                }
              }}
              aria-pressed={phone ? isSameDay(d, calCursor) : undefined}
              aria-label={phone ? `${format(d, "EEEE, MMMM d")}: ${due.length} due` : undefined}
              className={`text-left ${phone ? "min-h-[64px]" : "min-h-[92px] sm:min-h-[112px]"} border-b border-r border-line p-1 sm:p-1.5 cursor-pointer transition hover:bg-surface-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset ${inMonth ? "" : "bg-surface-2/30"} ${phone && isSameDay(d, calCursor) && !today ? "!bg-accent-soft" : ""}`}
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
              {phone ? (
                // Phones: a small coloured bar per thing due, like Google Calendar's month on a phone.
                <div className="space-y-[3px] px-0.5">
                  {due.slice(0, 3).map((t) => {
                    const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                    return <span key={t.id} className={`block h-1.5 rounded-full course-bar ${t.done ? "opacity-30" : ""}`} style={courseStyle(course?.color)} />;
                  })}
                  {due.length > 3 ? <span className="block text-[9px] leading-none text-muted">+{due.length - 3}</span> : null}
                </div>
              ) : (
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
                        title={`Due: ${t.title}`}
                        className={`due-chip w-full text-left px-1 sm:px-1.5 py-[3px] text-[11px] leading-tight hover:brightness-95 dark:hover:brightness-110 transition ${t.done ? "opacity-45 line-through" : ""}`}
                      >
                        <Flag size={10} className="hidden sm:block" strokeWidth={2.5} aria-hidden />
                        <span className="course-dot !w-1.5 !h-1.5" aria-hidden />
                        <span className={`truncate ${meta.loud ? "font-semibold" : ""}`}>{t.title}</span>
                      </button>
                    );
                  })}
                  {due.length > shown.length ? <div className="text-[10px] text-muted pl-1.5">+{due.length - shown.length} more</div> : null}
                </div>
              )}
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
  | { kind: "work"; id: string; start: number; end: number; item: CalBlock };

const MIN = 60_000;

type GapItem = { id: string; start: number; end: number; startMs: number; minutes: number };

function TimeGrid({ days, data }: { days: Date[]; data: CalData }) {
  const { ws, now, select, setCalCursor, setCalMode, model, plan } = useApp();
  const single = days.length === 1;
  const drag = usePlanDrag();
  // While work is dragged, free gaps light up, brighter where it fits.
  const placing = drag && drag.kind !== "resize" ? drag : null;

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
        for (const item of data.blocksByDay.get(dayKey(day)) ?? []) {
          items.push({ kind: "work", id: item.id, start: Math.max(item.start.getTime(), from), end: Math.min(item.end.getTime(), to), item });
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
  const anyAllDay = columns.some((c) => c.allDay.length > 0);
  const anyDue = columns.some((c) => c.due.length > 0);

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
  const top = (ms: number, from: number) => TOP_PAD + ((ms - from) / MIN - startHour * 60) * (HOUR_PX / 60);
  const gridHeight = TOP_PAD + hours.length * HOUR_PX;
  const nowInView = columns.some((c) => isSameDay(c.day, now)) && now.getHours() >= startHour && now.getHours() < endHour;

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

  const gutter = "w-12 md:w-14 shrink-0 sticky left-0 z-20 bg-surface";

  return (
    <div ref={scroller} className="card cal-grid overflow-x-auto scrollbar-thin">
      <div className={days.length === 7 ? "min-w-[760px]" : ""}>
        {/* Day headers: the weekday over a big date, today in a filled circle */}
        {!single ? (
          <div className="flex border-b border-line">
            <div className={gutter} />
            {columns.map((c) => {
              const today = isToday(c.day);
              return (
                <div key={c.from} data-today={today || undefined} className="flex-1 min-w-0 border-l border-line/70 first-of-type:border-l-0">
                  <button
                    type="button"
                    className="cal-day-head w-full py-2 flex flex-col items-center gap-0.5"
                    onClick={() => {
                      setCalCursor(c.day);
                      setCalMode("day");
                    }}
                    aria-label={`Open ${format(c.day, "EEEE, MMMM d")}`}
                  >
                    <span className={`text-[11px] uppercase tracking-wider font-semibold ${today ? "text-accent" : "text-muted"}`}>{format(c.day, "EEE")}</span>
                    <span className={`cal-date ${today ? "cal-date-today" : ""}`}>{format(c.day, "d")}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* All-day events, then deadlines, each in its own labelled row */}
        {anyAllDay ? (
          <Lane label="All day" gutter={gutter}>
            {columns.map((c) => (
              <LaneCell key={c.from}>
                {c.allDay.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => select({ kind: "event", id: e.id })}
                    className="event-block w-full truncate text-left px-1.5 py-0.5 text-[11px] font-medium"
                    style={courseStyle(e.color)}
                    title={e.title}
                  >
                    <span className="event-title">{e.title}</span>
                  </button>
                ))}
              </LaneCell>
            ))}
          </Lane>
        ) : null}
        {anyDue ? (
          <Lane label="Due" icon gutter={gutter}>
            {columns.map((c) => (
              <LaneCell key={c.from}>
                {c.due.map((t) => {
                  const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                  const late = !t.done && t.dueAt ? Date.parse(t.dueAt) < now.getTime() : false;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => select({ kind: "task", id: t.id })}
                      data-late={late || undefined}
                      className={`due-chip w-full text-left px-1.5 py-0.5 text-[11px] ${t.done ? "opacity-45 line-through" : ""}`}
                      style={courseStyle(course?.color)}
                      title={`Due ${t.allDay ? "today" : clock(new Date(t.dueAt!))}: ${t.title}`}
                    >
                      <Flag size={10} aria-hidden />
                      <span className="truncate">
                        {!t.allDay ? <span className="font-semibold tabular-nums">{clock(new Date(t.dueAt!))} </span> : null}
                        {t.title}
                      </span>
                    </button>
                  );
                })}
              </LaneCell>
            ))}
          </Lane>
        ) : null}

        {/* Hours, with a little room under the day headers */}
        <div className="flex relative">
          <div className={`${gutter} relative`} style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2 text-[11px] text-faint tabular-nums -translate-y-1/2" style={{ top: TOP_PAD + i * HOUR_PX }}>
                {h === 0 ? "" : clock(new Date(2000, 0, 1, h))}
              </div>
            ))}
            {nowInView ? (
              // Notion Calendar's touch: the time right now, in red, where the line meets the hours.
              <div className="cal-now-pill absolute right-1 z-10 -translate-y-1/2" style={{ top: top(now.getTime(), startOfDay(now).getTime()) }}>
                {format(now, "h:mm")}
              </div>
            ) : null}
          </div>
          {columns.map((c) => {
            const placed = layoutColumns(c.items, (i) => i.start, (i) => i.end);
            const today = isSameDay(c.day, now);
            const showNow = today && nowInView;
            const weekend = c.day.getDay() === 0 || c.day.getDay() === 6;
            const preview = drag?.target?.kind === "grid" && drag.target.dayStart === c.from ? drag.target : null;
            return (
              <div
                key={c.from}
                className={`flex-1 min-w-0 relative border-l border-line/70 ${today ? "cal-col-today" : weekend ? "cal-col-weekend" : ""}`}
                style={{ height: gridHeight }}
                // How the drag works out the time under the pointer (see planDrag.ts).
                data-drop-day={c.from}
                data-drop-min={startHour * 60}
                data-drop-max={endHour * 60}
                data-drop-top={TOP_PAD}
                data-drop-ppm={HOUR_PX / 60}
              >
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: TOP_PAD + i * HOUR_PX }} />
                ))}
                {c.gaps.map((g) => {
                  const y = top(g.start, c.from);
                  const gh = Math.max(14, top(g.end, c.from) - y - 2);
                  if (y + gh < 0 || y > gridHeight) return null;
                  const fits = placing ? g.minutes >= placing.minutes : false;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => select({ kind: "gap", startMs: g.startMs })}
                      className={`absolute inset-x-0.5 z-0 cursor-pointer ${placing ? `gap-hint ${fits ? "gap-fit" : ""}` : ""}`}
                      style={{ top: y + 1, height: gh }}
                      title={`Free · ${duration(g.minutes)}. Open to put something here`}
                      aria-label={`Free time, ${duration(g.minutes)}. Open to put something from your to-do list here.`}
                    >
                      {placing && gh >= 30 ? <span className="gap-hint-label">{duration(g.minutes)} free</span> : null}
                    </button>
                  );
                })}
                {placed.map(({ item, col, cols }) => {
                  const y = top(item.start, c.from);
                  // A little air between blocks: 2px above and below, 3px at the sides.
                  const h = Math.max(22, top(item.end, c.from) - y - 4);
                  const style: React.CSSProperties = {
                    top: y + 2,
                    height: h,
                    left: `calc(${(col / cols) * 100}% + 3px)`,
                    width: `calc(${100 / cols}% - 6px)`,
                  };
                  const past = item.end <= now.getTime();
                  // Tall blocks let the title wrap to two lines instead of cutting it off.
                  const titleFit = h >= 56 ? "line-clamp-2" : "truncate";
                  if (item.kind === "event") {
                    const e = item.event;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => select({ kind: "event", id: e.id })}
                        className={`event-block absolute z-[1] flex flex-col justify-start gap-0.5 text-left overflow-hidden px-2 py-1.5 ${e.busy ? "" : "opacity-60"} ${past ? "cal-past" : ""} ${drag ? "pointer-events-none" : ""}`}
                        style={{ ...style, ...courseStyle(e.color) }}
                        title={`${e.title} · ${clockRange(new Date(e.start), new Date(e.end))}`}
                      >
                        <div className={`event-title text-xs font-semibold leading-tight ${titleFit}`}>{e.title}</div>
                        {h >= 40 ? <div className="text-[11px] text-muted leading-tight truncate">{clockRange(new Date(e.start), new Date(e.end))}</div> : null}
                      </button>
                    );
                  }
                  return (
                    <PlannedTile
                      key={item.id}
                      item={item}
                      style={style}
                      h={h}
                      titleFit={titleFit}
                      dragging={drag?.blockId === item.id}
                      passThrough={Boolean(drag) && drag?.blockId !== item.id}
                    />
                  );
                })}
                {preview && drag ? <DropPreview target={preview} title={drag.title} top={(m) => top(c.from + m * MIN, c.from)} /> : null}
                {showNow ? (
                  <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: top(now.getTime(), c.from) }}>
                    <div className="h-[2px] bg-danger" />
                    <div className="absolute -left-[5px] -top-[4px] w-2.5 h-2.5 rounded-full bg-danger" />
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

/** A labelled row above the hours: "All day" or "Due". */
function Lane({ label, icon = false, gutter, children }: { label: string; icon?: boolean; gutter: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-line">
      <div className={`${gutter} flex items-start justify-end gap-1 pr-2 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${icon ? "text-warn" : "text-faint"}`}>
        {icon ? <Flag size={10} className="mt-px" aria-hidden /> : null}
        {label}
      </div>
      {children}
    </div>
  );
}

function LaneCell({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-w-0 border-l border-line/70 p-1 space-y-1">{children}</div>;
}

/** Where dragged work would land, and the time it would take. */
function DropPreview({ target, title, top }: { target: Extract<DropTarget, { kind: "grid" }>; title: string; top: (minute: number) => number }) {
  const y = top(target.startMinute);
  const h = Math.max(22, top(target.endMinute) - y - 4);
  const start = targetStart(target);
  const end = new Date(start.getTime() + (target.endMinute - target.startMinute) * MIN);
  return (
    <div className="plan-drop absolute inset-x-1 z-[5] pointer-events-none px-2 py-1" style={{ top: y + 2, height: h }} aria-hidden>
      {/* Short blocks put the time first, so where it lands is always readable. */}
      {h >= 40 ? <div className="text-xs font-semibold truncate">{title}</div> : null}
      <div className="text-[11px] font-semibold tabular-nums truncate">{clockRange(start, end)}</div>
    </div>
  );
}

/**
 * Time the student set aside, on the grid: a white tile coloured by how soon its
 * work is due, with a tick box. Drag it to move it, drag its bottom edge to change
 * its length, or drag it back onto the to-do list to take it off the calendar. With
 * a keyboard: arrows move it, Shift and arrows change its length, Delete takes it off.
 * Done work stays, ticked and faded.
 */
function PlannedTile({
  item,
  style,
  h,
  titleFit,
  dragging,
  passThrough,
}: {
  item: Extract<GridItem, { kind: "work" }>;
  style: React.CSSProperties;
  h: number;
  titleFit: string;
  dragging: boolean;
  passThrough: boolean;
}) {
  const { model, select, now, moveScheduled, resizeScheduled, unschedule } = useApp();
  const cal = item.item;
  const { task, start, end, minutes, title } = cal;
  const course = task?.courseId ? model.courseById.get(task.courseId) : undefined;
  const done = Boolean(task?.done);
  const tint = blockTint(cal, now);
  const open = () => (task ? select({ kind: "task", id: task.id }) : undefined);
  const payload = { taskId: task?.id ?? null, blockId: cal.id, title, minutes, start: start.getTime(), color: tint };

  return (
    <div
      role="button"
      tabIndex={0}
      ref={dragSourceRef}
      onClick={open}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-resize]")) return;
        // Where it was grabbed, in minutes from its top, so it doesn't jump under the pointer.
        const grab = Math.round((e.clientY - e.currentTarget.getBoundingClientRect().top) / (HOUR_PX / 60));
        beginPlanDrag(e, { kind: "move", grab, ...payload }, (target) => {
          if (target.kind === "list") unschedule(cal.id);
          else moveScheduled(cal.id, targetStart(target));
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          unschedule(cal.id);
          return;
        }
        const step = e.key === "ArrowUp" ? -15 : e.key === "ArrowDown" ? 15 : 0;
        if (!step) return;
        e.preventDefault();
        if (e.shiftKey) resizeScheduled(cal.id, new Date(end.getTime() + step * MIN));
        else moveScheduled(cal.id, new Date(start.getTime() + step * MIN));
      }}
      aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Delete"
      className={`plan-block urgency-card drag-source absolute z-[2] flex flex-col justify-start gap-0.5 text-left overflow-hidden pl-2.5 pr-2 py-1.5 cursor-grab ${done ? "opacity-50" : ""} ${dragging ? "opacity-30" : ""} ${passThrough ? "pointer-events-none" : ""}`}
      style={{ ...style, "--u": tint, "--c": tint } as React.CSSProperties}
      title={`${title} · ${duration(minutes)}. Drag to move, or drag the bottom edge to change its length. Arrow keys move it; Shift and arrows change its length; Delete takes it off.`}
      aria-label={`Scheduled: ${title}, ${clockRange(start, end)}${done ? ", done" : ""}. Open details`}
    >
      <div className="flex items-start gap-1.5 min-w-0">
        <span className="plan-tick mt-[3px]" data-done={done || undefined} aria-hidden />
        <span className={`text-xs font-semibold leading-tight flex-1 min-w-0 ${titleFit}`}>{title}</span>
      </div>
      {h >= 40 ? (
        <div className="text-[11px] text-muted leading-tight truncate">
          {course ? (
            <span className="course-text font-medium" style={courseStyle(course.color)}>
              {course.code} ·{" "}
            </span>
          ) : null}
          {h >= 60 ? clockRange(start, end) : duration(minutes)}
        </div>
      ) : null}
      {/* The bottom edge changes how long it is. Fingers get it straight away; it never scrolls anything. */}
      <span
        data-resize
        aria-hidden
        className="block-resize"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
          const top = e.currentTarget.closest(".plan-block")!.getBoundingClientRect().top;
          beginPlanDrag(
            e,
            { kind: "resize", grab: (e.clientY - top) / (HOUR_PX / 60), ...payload },
            (target) => {
              if (target.kind === "grid") resizeScheduled(cal.id, new Date(targetStart(target).getTime() + (target.endMinute - target.startMinute) * MIN));
            },
            { immediate: true },
          );
        }}
      />
    </div>
  );
}
