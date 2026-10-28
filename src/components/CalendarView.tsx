"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { seriesKey } from "@/lib/eventColors";
import { layoutColumns } from "@/lib/layout";
import type { CalEvent, FeedConfig, ScheduledBlock, Task } from "@/lib/types";
import { clock, dayKey } from "@/lib/ui";
import { useApp, useIsPhone } from "./context";
import { DragGhost } from "./DragGhost";
import { PlannerPanel } from "./PlannerPanel";
import { beginPlanDrag, dragSourceRef, targetStart, usePlanDrag, type DropTarget } from "./planDrag";
import { SsIcon } from "./SsIcon";

const WEEK = { weekStartsOn: 1 } as const;
const MIN = 60_000;
/** Phones and narrow windows get the prototype's phone layout below this width. */
const PHONE_QUERY = "(max-width: 820px)";

/** Time the student set aside, ready to draw. */
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

/** The prototype's three kinds of event, each with its own colour, plus work you scheduled. */
type Kind = "work" | "school" | "personal";

const WORKISH = /\b(work|shift|job|office|meeting|stand-?up|client|sync|interview)\b/i;

/**
 * Which kind an event is: anything from a class or a school calendar is School;
 * weekly busy times (a job, practice) are Work; events on a personal calendar
 * are Personal, unless they read like work ("Work", "Shift at the bookstore").
 */
function eventKind(e: CalEvent, feedById: Map<string, FeedConfig>): Kind {
  if (e.courseId || e.kind === "class" || e.kind === "exam") return "school";
  if (e.source === "weekly") return "work";
  const feed = e.feedId ? feedById.get(e.feedId) : undefined;
  if (feed?.role === "school") return "school";
  return WORKISH.test(e.title) || (feed && WORKISH.test(feed.name)) ? "work" : "personal";
}

/** "9:00 – 10:00", the prototype's way of writing a time range. */
function shortRange(start: Date, end: Date): string {
  return `${format(start, "h:mm")} – ${format(end, "h:mm")}`;
}

/** Events, set-aside time and what's due, grouped for quick lookup by day. */
function useCalendarData() {
  const { model, ws } = useApp();
  return useMemo(() => {
    const byId = new Map(model.tasks.map((t) => [t.id, t]));
    const blocksByDay = new Map<string, CalBlock[]>();
    for (const block of ws.blocks) {
      const task = block.taskId ? (byId.get(block.taskId) ?? null) : null;
      // Time for work that has gone (its calendar removed, its class hidden) isn't shown.
      if (block.taskId && !task) continue;
      const start = new Date(block.start);
      const end = new Date(block.end);
      const item: CalBlock = { id: block.id, block, task, title: task?.title ?? block.title, start, end, minutes: Math.round((end.getTime() - start.getTime()) / MIN) };
      const k = dayKey(start);
      blocksByDay.set(k, [...(blocksByDay.get(k) ?? []), item]);
    }
    return { events: model.events, blocksByDay, byId };
  }, [model, ws.blocks]);
}
type CalData = ReturnType<typeof useCalendarData>;

/** The calendar page: the planner on the left, the calendar on the right. */
export function CalendarView() {
  const { calMode, setCalMode, calCursor, setCalCursor, calSidebar: panelOpen, setCalSidebar: setPanelOpen } = useApp();
  const phone = useNarrow();
  const data = useCalendarData();
  const today = new Date();

  // Phones: the week shows three days at a time, or one beside the open planner.
  const days = useMemo(() => {
    if (calMode === "day") return [startOfDay(calCursor)];
    if (phone) return Array.from({ length: panelOpen ? 1 : 3 }, (_, i) => addDays(startOfDay(calCursor), i));
    const week = eachDayOfInterval({ start: startOfWeek(calCursor, WEEK), end: endOfWeek(calCursor, WEEK) });
    // Monday to Friday, as in the prototype; a weekend day joins in when something is on it.
    return week.filter((d, i) => i < 5 || data.blocksByDay.has(dayKey(d)) || data.events.some((e) => !e.allDay && isSameDay(new Date(e.start), d)));
  }, [calMode, calCursor, phone, panelOpen, data]);

  const step = (dir: number) => {
    if (calMode === "month") setCalCursor(addMonths(calCursor, dir));
    else if (calMode === "week" && !phone) setCalCursor(addWeeks(calCursor, dir));
    else setCalCursor(addDays(calCursor, dir));
  };
  const unit = calMode === "month" ? "month" : calMode === "week" && !phone ? "week" : "day";

  const eyebrow = calMode === "month" ? "MONTH VIEW" : format(calCursor, "MMMM yyyy").toUpperCase();
  const title =
    calMode === "month"
      ? format(calCursor, "MMMM yyyy")
      : calMode === "day"
        ? format(calCursor, "EEE, MMMM d")
        : phone
          ? `${format(days[0], "MMMM d")}–${format(days[days.length - 1], "d")}`
          : `Week of ${format(startOfWeek(calCursor, WEEK), "MMMM d")}`;

  return (
    <div className={`ss-calendar-page ${panelOpen ? "" : "ss-panel-closed"}`}>
      {panelOpen ? (
        <PlannerPanel
          onClose={() => {
            setPanelOpen(false);
          }}
        />
      ) : null}
      <section className="ss-calendar-area" aria-label="Calendar">
        <div className="ss-toolbar">
          <div className="ss-date-title">
            {!panelOpen ? (
              <button
                className="ss-icon-button ss-open-panel"
                onClick={() => {
                  setPanelOpen(true);
                  if (phone) setCalMode("day");
                }}
                aria-label="Open suggestions"
              >
                <SsIcon name="menu" />
              </button>
            ) : null}
            <div className="min-w-0">
              <span>{eyebrow}</span>
              <h1 aria-live="polite">{title}</h1>
            </div>
          </div>
          <div className="ss-controls">
            <button className="ss-today" onClick={() => setCalCursor(new Date())} aria-current={isSameDay(calCursor, today) ? "date" : undefined}>
              Today
            </button>
            <div className="ss-arrows">
              <button aria-label={`Previous ${unit}`} onClick={() => step(-1)}>
                <SsIcon name="chevronLeft" />
              </button>
              <button aria-label={`Next ${unit}`} onClick={() => step(1)}>
                <SsIcon name="chevronRight" />
              </button>
            </div>
            <select
              aria-label="Calendar view"
              value={calMode}
              onChange={(e) => {
                const mode = e.target.value as typeof calMode;
                setCalMode(mode);
                if (mode === "month" && phone) setPanelOpen(false);
              }}
            >
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div className="ss-key">
          <span>
            <i className="ss-key-work" />
            Work
          </span>
          <span>
            <i className="ss-key-school" />
            School
          </span>
          <span>
            <i className="ss-key-personal" />
            Personal
          </span>
        </div>
        {calMode === "month" ? <MonthGrid data={data} /> : <TimeGrid days={days} data={data} dayView={calMode === "day"} />}
      </section>
      <DragGhost />
    </div>
  );
}

/** Whether the window is phone-sized, by the prototype's own breakpoint. */
function useNarrow(): boolean {
  const phone = useIsPhone();
  const [narrow, setNarrow] = useState(phone);
  useLayoutEffect(() => {
    const q = window.matchMedia(PHONE_QUERY);
    const update = () => setNarrow(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** "GMT−6": the time zone the times are in, as the prototype labels it. */
function gmtLabel(now: Date): string {
  const off = -now.getTimezoneOffset();
  const h = Math.trunc(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return `GMT${off < 0 ? "−" : "+"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

// ---------------------------------------------------------------------------
// Week and day: a time grid that fits the screen
// ---------------------------------------------------------------------------

type GridItem =
  | { kind: "event"; id: string; start: number; end: number; event: CalEvent }
  | { kind: "work"; id: string; start: number; end: number; item: CalBlock };

function TimeGrid({ days, data, dayView }: { days: Date[]; data: CalData; dayView: boolean }) {
  const { ws, now, select, setCalCursor, setCalMode, plan, model } = useApp();
  const drag = usePlanDrag();
  const body = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // The hours stretch to fill the grid, as in the prototype; the page never scrolls.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(
    () =>
      days.map((day) => {
        const from = startOfDay(day).getTime();
        const to = addDays(startOfDay(day), 1).getTime();
        const items: GridItem[] = [];
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
        const gaps = plan.days.find((d) => dayKey(d.date) === dayKey(day))?.gaps ?? [];
        return { day, from, items, allDay, gaps };
      }),
    [days, data, plan.days],
  );
  const anyAllDay = columns.some((c) => c.allDay.length > 0);

  // The working day, stretched to fit anything outside it.
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
  const ppm = height > 0 ? height / (hours.length * 60) : 1;
  const y = (ms: number, from: number) => ((ms - from) / MIN - startHour * 60) * ppm;

  // While a task is dragged, everything after it is due greys out, with a red line at the deadline.
  const draggedTask = drag && drag.kind !== "resize" && drag.taskId ? (data.byId.get(drag.taskId) ?? null) : null;
  const deadline = draggedTask?.dueAt ? new Date(draggedTask.dueAt) : null;
  const placing = Boolean(drag && drag.kind !== "resize");

  return (
    <div className={`ss-week ${dayView ? "ss-day-view" : ""}`} style={{ "--ss-days": days.length } as React.CSSProperties}>
      <div className="ss-day-head ss-time-head">{gmtLabel(now)}</div>
      {columns.map((c) => (
        <button
          key={c.from}
          className="ss-day-head"
          data-today={isToday(c.day) || undefined}
          onClick={() => {
            setCalCursor(c.day);
            setCalMode("day");
          }}
          aria-label={`Open ${format(c.day, "EEEE, MMMM d")}`}
        >
          <span>{format(c.day, "EEE").toUpperCase()}</span>
          <strong>{format(c.day, "d")}</strong>
        </button>
      ))}
      {anyAllDay ? (
        <>
          <div className="ss-allday-gutter" style={{ gridRow: 2 }}>
            ALL DAY
          </div>
          {columns.map((c) => (
            <div key={c.from} className="ss-allday" style={{ gridRow: 2 }}>
              {c.allDay.map((e) => (
                <EventChip key={e.id} event={e} />
              ))}
            </div>
          ))}
        </>
      ) : null}
      <div className="ss-time-column" ref={body} style={{ gridRow: 3 }}>
        {height > 0
          ? hours.map((h, i) => (
              <span key={h} style={{ top: i * 60 * ppm }}>
                {clock(new Date(2000, 0, 1, h)).toUpperCase()}
              </span>
            ))
          : null}
      </div>
      {columns.map((c) => {
        const placed = layoutColumns(c.items, (i) => i.start, (i) => i.end);
        const preview = drag?.target?.kind === "grid" && drag.target.dayStart === c.from ? drag.target : null;
        const dayEnd = addDays(c.day, 1).getTime();
        const shadeFrom =
          deadline && deadline.getTime() < dayEnd ? (deadline.getTime() <= c.from ? 0 : Math.max(0, Math.min(height, y(deadline.getTime(), c.from)))) : null;
        return (
          <div
            key={c.from}
            className={`ss-day-column ${placing ? "ss-drop-ready" : ""}`}
            style={{ gridRow: 3 }}
            // How the drag works out the time under the pointer (see planDrag.ts).
            data-drop-day={c.from}
            data-drop-min={startHour * 60}
            data-drop-max={endHour * 60}
            data-drop-top={0}
            data-drop-ppm={ppm}
          >
            {height > 0 ? (
              <>
                {hours.map((h, i) => (
                  <div key={h} className="ss-hour-line" style={{ top: i * 60 * ppm, height: 60 * ppm }} />
                ))}
                {/* Free time is empty, but tapping it offers the next tasks that fit. */}
                {c.gaps.map((g) => {
                  const top = y(g.start.getTime(), c.from);
                  const h = y(g.end.getTime(), c.from) - top;
                  if (h < 8) return null;
                  return (
                    <button
                      key={g.start.getTime()}
                      className="ss-gap"
                      style={{ top, height: h }}
                      onClick={() => select({ kind: "gap", startMs: g.start.getTime() })}
                      aria-label={`Free time, ${g.minutes} minutes. Open to put something from your list here.`}
                      title="Free time. Open to put something here"
                    />
                  );
                })}
                {placed.map(({ item, col, cols }) => {
                  const top = y(item.start, c.from) + 3;
                  const h = Math.max(16, y(item.end, c.from) - y(item.start, c.from) - 6);
                  const style: React.CSSProperties = {
                    top,
                    height: h,
                    left: `calc(${(col / cols) * 100}% + 5px)`,
                    width: `calc(${100 / cols}% - 10px)`,
                  };
                  if (item.kind === "event") return <GridEvent key={item.id} event={item.event} style={style} h={h} passThrough={Boolean(drag)} />;
                  return (
                    <PlannedBlock
                      key={item.id}
                      item={item.item}
                      style={style}
                      h={h}
                      ppm={ppm}
                      dragging={drag?.blockId === item.id}
                      passThrough={Boolean(drag) && drag?.blockId !== item.id}
                      course={item.item.task?.courseId ? model.courseById.get(item.item.task.courseId)?.code : undefined}
                    />
                  );
                })}
                {shadeFrom !== null ? <div className="ss-deadline-shade" style={{ top: shadeFrom }} /> : null}
                {deadline && isSameDay(deadline, c.day) && shadeFrom !== null && shadeFrom > 0 ? (
                  <div className="ss-deadline-line" style={{ top: shadeFrom }}>
                    <span>DUE {clock(deadline).toUpperCase()}</span>
                  </div>
                ) : null}
                {preview && drag ? <DropPreview target={preview} title={drag.title} y={(m) => y(c.from + m * MIN, c.from)} /> : null}
                {isSameDay(c.day, now) && now.getHours() >= startHour && now.getHours() < endHour ? (
                  <div className="ss-now-line" style={{ top: y(now.getTime(), c.from) }}>
                    <i />
                    <span>{format(now, "h:mm")}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The colour of an event: its kind's, or one the student picked for it. */
function useEventLook(e: CalEvent): { kind: Kind; custom: string | null } {
  const { model, ws } = useApp();
  return { kind: eventKind(e, model.feedById), custom: ws.eventColors[seriesKey(e.id)] ?? null };
}

function GridEvent({ event: e, style, h, passThrough }: { event: CalEvent; style: React.CSSProperties; h: number; passThrough: boolean }) {
  const { select } = useApp();
  const { kind, custom } = useEventLook(e);
  const start = new Date(e.start);
  const end = new Date(e.end);
  return (
    <button
      className={`ss-event ss-${kind} ${e.busy ? "" : "ss-free"}`}
      data-custom={custom ? true : undefined}
      style={{ ...style, ...(custom ? { "--ev": custom } : {}), pointerEvents: passThrough ? "none" : undefined } as React.CSSProperties}
      onClick={() => select({ kind: "event", id: e.id })}
      title={`${e.title} · ${shortRange(start, end)}`}
    >
      <strong>{e.title}</strong>
      {h >= 30 ? <span>{shortRange(start, end)}</span> : null}
    </button>
  );
}

function EventChip({ event: e }: { event: CalEvent }) {
  const { select } = useApp();
  const { kind, custom } = useEventLook(e);
  return (
    <button
      className={`ss-month-event ss-${kind}`}
      data-custom={custom ? true : undefined}
      style={custom ? ({ "--ev": custom } as React.CSSProperties) : undefined}
      onClick={(ev) => {
        ev.stopPropagation();
        select({ kind: "event", id: e.id });
      }}
      title={e.title}
    >
      <i />
      <span>{e.title}</span>
    </button>
  );
}

/** Where dragged work would land, and the time it would take. */
function DropPreview({ target, title, y }: { target: Extract<DropTarget, { kind: "grid" }>; title: string; y: (minute: number) => number }) {
  const top = y(target.startMinute) + 3;
  const h = Math.max(16, y(target.endMinute) - y(target.startMinute) - 6);
  const start = targetStart(target);
  const end = new Date(start.getTime() + (target.endMinute - target.startMinute) * MIN);
  return (
    <div className="ss-drop" style={{ top, height: h }} aria-hidden>
      {h >= 30 ? <strong>{title}</strong> : null}
      {clock(start)} – {clock(end)}
    </div>
  );
}

/**
 * Time the student set aside, striped like the prototype's planned work. Drag it
 * to move it, drag its bottom edge to change its length, or drag it back onto the
 * planner to take it off. With a keyboard: arrows move it, Shift and arrows change
 * its length, Delete takes it off. Done work stays, ticked and faded.
 */
function PlannedBlock({
  item: cal,
  style,
  h,
  ppm,
  dragging,
  passThrough,
  course,
}: {
  item: CalBlock;
  style: React.CSSProperties;
  h: number;
  ppm: number;
  dragging: boolean;
  passThrough: boolean;
  course?: string;
}) {
  const { select, moveScheduled, resizeScheduled, unschedule } = useApp();
  const { task, start, end, minutes, title } = cal;
  const done = Boolean(task?.done);
  const open = () => (task ? select({ kind: "task", id: task.id }) : undefined);
  const payload = { taskId: task?.id ?? null, blockId: cal.id, title, minutes, start: start.getTime(), color: "var(--ss-accent)" };

  return (
    <div
      role="button"
      tabIndex={0}
      ref={dragSourceRef}
      onClick={open}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-resize]")) return;
        // Where it was grabbed, in minutes from its top, so it doesn't jump under the pointer.
        const grab = Math.round((e.clientY - e.currentTarget.getBoundingClientRect().top) / ppm);
        beginPlanDrag(e, { kind: "move", grab, ...payload }, (target) => {
          if (target.kind === "list") unschedule(cal.id);
          else if (target.kind === "grid") moveScheduled(cal.id, targetStart(target));
          // Onto a day in the month: the same time, that day.
          else moveScheduled(cal.id, new Date(target.dayStart + (start.getTime() - startOfDay(start).getTime())));
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
        const stepBy = e.key === "ArrowUp" ? -15 : e.key === "ArrowDown" ? 15 : 0;
        if (!stepBy) return;
        e.preventDefault();
        if (e.shiftKey) resizeScheduled(cal.id, new Date(end.getTime() + stepBy * MIN));
        else moveScheduled(cal.id, new Date(start.getTime() + stepBy * MIN));
      }}
      aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Delete"
      className="ss-event ss-planned ss-movable"
      data-done={done || undefined}
      data-picked={dragging || undefined}
      style={{ ...style, pointerEvents: passThrough ? "none" : undefined }}
      title={`${title} · ${minutes} min. Drag to move, or drag the bottom edge to change its length.`}
      aria-label={`Scheduled: ${title}, ${clock(start)} – ${clock(end)}${done ? ", done" : ""}. Open details`}
    >
      <strong>
        {done ? (
          <span className="ss-event-check" aria-hidden>
            <SsIcon name="check" size={8} />
          </span>
        ) : null}
        {title}
      </strong>
      {h >= 30 ? (
        <span>
          {format(start, "h:mm")} · {minutes} min{course ? ` · ${course}` : ""}
        </span>
      ) : null}
      {/* The bottom edge changes how long it is. Fingers get it straight away; it never scrolls anything. */}
      <span
        data-resize
        aria-hidden
        className="ss-resize"
        // A tap here still opens the block; the click after a resize is swallowed by the drag.
        onPointerDown={(e) => {
          e.stopPropagation();
          const top = e.currentTarget.closest(".ss-event")!.getBoundingClientRect().top;
          beginPlanDrag(
            e,
            { kind: "resize", grab: (e.clientY - top) / ppm, ...payload },
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

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

function MonthGrid({ data }: { data: CalData }) {
  const { calCursor, setCalCursor, setCalMode, select } = useApp();
  const drag = usePlanDrag();
  const placing = Boolean(drag && drag.kind !== "resize");
  // The prototype's month starts on Sunday.
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(calCursor)), end: endOfWeek(endOfMonth(calCursor)) }),
    [calCursor],
  );
  const draggedTask = drag && drag.kind !== "resize" && drag.taskId ? (data.byId.get(drag.taskId) ?? null) : null;
  const deadline = draggedTask?.dueAt ? startOfDay(new Date(draggedTask.dueAt)).getTime() : null;

  type Entry = { key: string; sort: number; event?: CalEvent; block?: CalBlock };
  const entriesByDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const add = (k: string, e: Entry) => m.set(k, [...(m.get(k) ?? []), e]);
    for (const e of data.events) add(dayKey(new Date(e.start)), { key: e.id, sort: e.allDay ? 0 : Date.parse(e.start), event: e });
    for (const [k, blocks] of data.blocksByDay) for (const b of blocks) add(k, { key: b.id, sort: b.start.getTime(), block: b });
    for (const list of m.values()) list.sort((a, b) => a.sort - b.sort);
    return m;
  }, [data]);

  return (
    <div className="ss-month">
      <div className="ss-month-weekdays">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="ss-month-grid">
        {days.map((d) => {
          const k = dayKey(d);
          const inMonth = isSameMonth(d, calCursor);
          const entries = inMonth ? (entriesByDay.get(k) ?? []) : [];
          const from = startOfDay(d).getTime();
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              className={`ss-month-cell ${inMonth ? "" : "ss-outside"} ${placing ? "ss-drop-ready" : ""} ${deadline !== null && from > deadline ? "ss-past-deadline" : ""}`}
              data-today={isToday(d) || undefined}
              data-drop-date={inMonth ? from : undefined}
              data-drop-over={(drag?.target?.kind === "date" && drag.target.dayStart === from) || undefined}
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
              aria-label={`${format(d, "EEEE, MMMM d")}${entries.length ? `, ${entries.length} on` : ""}. Open the day`}
            >
              <strong>{format(d, "d")}</strong>
              <div className="ss-month-events">
                {entries.slice(0, 3).map((en) =>
                  en.event ? (
                    <EventChip key={en.key} event={en.event} />
                  ) : (
                    <button
                      key={en.key}
                      className="ss-month-event"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (en.block?.task) select({ kind: "task", id: en.block.task.id });
                      }}
                      title={en.block!.title}
                    >
                      <i />
                      <span className={en.block?.task?.done ? "line-through" : ""}>{en.block!.title}</span>
                    </button>
                  ),
                )}
                {entries.length > 3 ? <span className="ss-more-events">+{entries.length - 3} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
