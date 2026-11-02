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
    // The whole week, Monday to Sunday.
    return eachDayOfInterval({ start: startOfWeek(calCursor, WEEK), end: endOfWeek(calCursor, WEEK) });
  }, [calMode, calCursor, phone, panelOpen]);

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

/** How tall an hour is, at least: room for a half-hour block's title and time. */
const HOUR_PX = 64;
const HOUR_PX_PHONE = 56;

function TimeGrid({ days, data, dayView }: { days: Date[]; data: CalData; dayView: boolean }) {
  const { ws, now, select, setCalCursor, setCalMode, plan, model } = useApp();
  const drag = usePlanDrag();
  const scroller = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ height: 0, phone: false });

  // The hours scroll inside the frame. Each is at least HOUR_PX tall, and they
  // stretch to fill the frame when the whole day fits.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setFrame({ height: el.clientHeight, phone: window.matchMedia(PHONE_QUERY).matches });
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
  const height = frame.height;
  const ppm = Math.max((frame.phone ? HOUR_PX_PHONE : HOUR_PX) / 60, height > 0 ? height / (hours.length * 60) : 0);
  const bodyHeight = hours.length * 60 * ppm;
  const y = (ms: number, from: number) => ((ms - from) / MIN - startHour * 60) * ppm;

  // Open on what matters: an hour before now when today is showing, otherwise the start of the day.
  const firstDay = days[0]?.getTime() ?? 0;
  const showsToday = columns.some((c) => isSameDay(c.day, now));
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || height === 0) return;
    const minute = showsToday ? now.getHours() * 60 + now.getMinutes() - 60 : startHour * 60;
    el.scrollTop = Math.max(0, (minute - startHour * 60) * ppm);
    // Only when the days shown change or the frame first gets its size, not on every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, days.length, height > 0]);

  // While a task is dragged, everything after it is due greys out, with a red line at the deadline.
  const draggedTask = drag && drag.kind !== "resize" && drag.taskId ? (data.byId.get(drag.taskId) ?? null) : null;
  const deadline = draggedTask?.dueAt ? new Date(draggedTask.dueAt) : null;
  // Anything that has ended is faded.
  const nowMs = now.getTime();

  return (
    <div className={`ss-week ${dayView ? "ss-day-view" : ""}`} style={{ "--ss-days": days.length } as React.CSSProperties}>
      <div className="ss-week-row">
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
      </div>
      {anyAllDay ? (
        <div className="ss-week-row">
          <div className="ss-allday-gutter">ALL DAY</div>
          {columns.map((c) => (
            <div key={c.from} className="ss-allday">
              {c.allDay.map((e) => (
                <EventChip key={e.id} event={e} past={Date.parse(e.end) <= nowMs} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {/* The drag scrolls this box when it nears the top or bottom (see planDrag.ts). */}
      <div className="ss-week-scroll" ref={scroller} data-drag-scroll>
        <div className="ss-week-body" style={{ height: bodyHeight }}>
          <div className="ss-time-column">
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
              deadline && deadline.getTime() < dayEnd ? (deadline.getTime() <= c.from ? 0 : Math.max(0, Math.min(bodyHeight, y(deadline.getTime(), c.from)))) : null;
            return (
              <div
                key={c.from}
                className="ss-day-column"
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
                      if (item.kind === "event")
                        return (
                          <GridEvent
                            key={item.id}
                            event={item.event}
                            style={style}
                            h={h}
                            ppm={ppm}
                            dragging={drag?.eventId === item.id}
                            passThrough={Boolean(drag) && drag?.eventId !== item.id}
                            past={item.end <= nowMs}
                          />
                        );
                      return (
                        <PlannedBlock
                          key={item.id}
                          item={item.item}
                          style={style}
                          h={h}
                          ppm={ppm}
                          dragging={drag?.blockId === item.id}
                          passThrough={Boolean(drag) && drag?.blockId !== item.id}
                          past={item.end <= nowMs}
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
                    {/* Moving work, the ghost itself settles into the slot (DragGhost.tsx); resizing draws it here. */}
                    {preview && drag?.kind === "resize" ? <DropPreview target={preview} title={drag.title} y={(m) => y(c.from + m * MIN, c.from)} /> : null}
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
      </div>
    </div>
  );
}

/**
 * What to call an event: its own title, and which class it's for, by full name
 * when Schedule Smart knows it ("CS 142 · Intro to Programming"). An event named
 * just for its class ("CS 142") keeps that as its title, with the full name below.
 */
function useEventNames(e: CalEvent): { title: string; classLine: string | null } {
  const { model } = useApp();
  const course = e.courseId ? model.courseById.get(e.courseId) : undefined;
  if (!course) return { title: e.title, classLine: null };
  const full = course.title && course.title !== course.code ? course.title : null;
  if (e.title === course.code) return { title: e.title, classLine: full };
  return { title: e.title, classLine: full ? `${course.code} · ${full}` : course.code };
}

/** The colour of an event: its kind's, or one the student picked for it. */
function useEventLook(e: CalEvent): { kind: Kind; custom: string | null } {
  const { model, ws } = useApp();
  return { kind: eventKind(e, model.feedById), custom: ws.eventColors[seriesKey(e.id)] ?? null };
}

/**
 * An event from a calendar, or a weekly time. Drag it to move it, or its bottom
 * edge to change how long it is, as with scheduled work; with a keyboard, arrows
 * move it and Shift and arrows change its length. Calendars can't be changed from
 * here, so the move is Schedule Smart's own (see eventMoves.ts). All-day events
 * stay put.
 */
function GridEvent({
  event: e,
  style,
  h,
  ppm,
  dragging,
  passThrough,
  past,
}: {
  event: CalEvent;
  style: React.CSSProperties;
  h: number;
  ppm: number;
  dragging: boolean;
  passThrough: boolean;
  past: boolean;
}) {
  const { select, moveEvent, resizeEvent } = useApp();
  const { kind, custom } = useEventLook(e);
  const { title, classLine } = useEventNames(e);
  const start = new Date(e.start);
  const end = new Date(e.end);
  const minutes = Math.round((end.getTime() - start.getTime()) / MIN);
  // Lines of text that fit: the title, then the class (as many lines as are left), then the time if there's room.
  const fit = Math.floor((h - 8) / 15);
  const compact = fit < 2;
  const showTime = fit >= 3 || !classLine;
  const classLines = Math.max(1, fit - 1 - (showTime ? 1 : 0));
  const open = () => select({ kind: "event", id: e.id });
  const payload = { taskId: null, blockId: null, eventId: e.id, title: e.title, minutes, start: start.getTime(), color: custom ?? `var(--ss-${kind})` };
  return (
    <div
      role="button"
      tabIndex={0}
      ref={dragSourceRef}
      className={`ss-event ss-${kind} ss-movable ${e.busy ? "" : "ss-free"}`}
      data-custom={custom ? true : undefined}
      data-compact={h < 40 || undefined}
      data-past={past || undefined}
      data-picked={dragging || undefined}
      data-moved={e.original ? true : undefined}
      style={{ ...style, ...(custom ? { "--ev": custom } : {}), pointerEvents: passThrough ? "none" : undefined } as React.CSSProperties}
      onClick={open}
      onPointerDown={(ev) => {
        if ((ev.target as HTMLElement).closest("[data-resize]")) return;
        const box = ev.currentTarget.getBoundingClientRect();
        const grab = Math.round((ev.clientY - box.top) / ppm);
        const source = { width: box.width, height: box.height, grabX: ev.clientX - box.left, grabY: ev.clientY - box.top };
        beginPlanDrag(ev, { kind: "move", grab, source, ...payload }, (target) => {
          if (target.kind === "grid") moveEvent(e.id, targetStart(target));
          // Onto a day in the month: the same time, that day.
          else if (target.kind === "date") moveEvent(e.id, new Date(target.dayStart + (start.getTime() - startOfDay(start).getTime())));
        });
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
          return;
        }
        const stepBy = ev.key === "ArrowUp" ? -15 : ev.key === "ArrowDown" ? 15 : 0;
        if (!stepBy) return;
        ev.preventDefault();
        if (ev.shiftKey) resizeEvent(e.id, new Date(end.getTime() + stepBy * MIN));
        else moveEvent(e.id, new Date(start.getTime() + stepBy * MIN));
      }}
      aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown"
      aria-label={`${title}${classLine ? `, ${classLine}` : ""}, ${shortRange(start, end)}${e.original ? ", moved here in Schedule Smart" : ""}. Open details, or drag to move it`}
      title={`${title}${classLine ? ` · ${classLine}` : ""} · ${shortRange(start, end)}. Drag to move it, or drag the bottom edge to change its length.`}
    >
      <strong>{title}</strong>
      {compact ? (
        h >= 22 ? <span>{classLine ?? format(start, "h:mm")}</span> : null
      ) : (
        <>
          {classLine ? (
            <span className="ss-event-class" style={{ WebkitLineClamp: classLines }}>
              {classLine}
            </span>
          ) : null}
          {showTime ? <span>{shortRange(start, end)}</span> : null}
        </>
      )}
      <span
        data-resize
        aria-hidden
        className="ss-resize"
        onPointerDown={(ev) => {
          ev.stopPropagation();
          const top = ev.currentTarget.closest(".ss-event")!.getBoundingClientRect().top;
          beginPlanDrag(
            ev,
            { kind: "resize", grab: (ev.clientY - top) / ppm, ...payload },
            (target) => {
              if (target.kind === "grid") resizeEvent(e.id, new Date(targetStart(target).getTime() + (target.endMinute - target.startMinute) * MIN));
            },
            { immediate: true },
          );
        }}
      />
    </div>
  );
}

function EventChip({ event: e, past }: { event: CalEvent; past: boolean }) {
  const { select, moveEvent, model } = useApp();
  const course = e.courseId ? model.courseById.get(e.courseId) : undefined;
  const { kind, custom } = useEventLook(e);
  const start = new Date(e.start);
  return (
    <button
      ref={e.allDay ? undefined : dragSourceRef}
      className={`ss-month-event ss-${kind}`}
      data-custom={custom ? true : undefined}
      data-past={past || undefined}
      data-all-day={e.allDay || undefined}
      style={custom ? ({ "--ev": custom } as React.CSSProperties) : undefined}
      onClick={(ev) => {
        ev.stopPropagation();
        select({ kind: "event", id: e.id });
      }}
      // In the month, a timed event can be dragged to another day, at the same time.
      onPointerDown={
        e.allDay
          ? undefined
          : (ev) => {
              const box = ev.currentTarget.getBoundingClientRect();
              const minutes = Math.round((Date.parse(e.end) - start.getTime()) / MIN);
              beginPlanDrag(
                ev,
                {
                  kind: "move",
                  taskId: null,
                  blockId: null,
                  eventId: e.id,
                  title: e.title,
                  minutes,
                  grab: 0,
                  start: start.getTime(),
                  color: custom ?? `var(--ss-${kind})`,
                  source: { width: box.width, height: box.height, grabX: ev.clientX - box.left, grabY: ev.clientY - box.top },
                },
                (target) => {
                  if (target.kind === "date") moveEvent(e.id, new Date(target.dayStart + (start.getTime() - startOfDay(start).getTime())));
                },
              );
            }
      }
      title={course ? `${e.title} · ${course.code}${course.title !== course.code ? ` ${course.title}` : ""}` : e.title}
    >
      <i />
      {/* Timed events show their start, as in Google's month view: "7am", "9:30am". */}
      <span>
        {e.allDay ? null : <time>{format(start, start.getMinutes() ? "h:mmaaa" : "haaa")} </time>}
        {e.title}
        {course && e.title !== course.code ? <span className="ss-month-class"> · {course.code}</span> : null}
      </span>
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
  past,
  course,
}: {
  item: CalBlock;
  style: React.CSSProperties;
  h: number;
  ppm: number;
  dragging: boolean;
  passThrough: boolean;
  past: boolean;
  course?: string;
}) {
  const { select, moveScheduled, resizeScheduled, unschedule } = useApp();
  const { task, start, end, minutes, title } = cal;
  const done = Boolean(task?.done);
  const open = () => (task ? select({ kind: "task", id: task.id }) : undefined);
  const payload = { taskId: task?.id ?? null, blockId: cal.id, title, minutes, start: start.getTime(), color: "var(--ss-planned)" };

  return (
    <div
      role="button"
      tabIndex={0}
      ref={dragSourceRef}
      onClick={open}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-resize]")) return;
        // Where it was grabbed, in minutes from its top, so it doesn't jump under the pointer.
        const box = e.currentTarget.getBoundingClientRect();
        const grab = Math.round((e.clientY - box.top) / ppm);
        const source = { width: box.width, height: box.height, grabX: e.clientX - box.left, grabY: e.clientY - box.top };
        beginPlanDrag(e, { kind: "move", grab, source, ...payload }, (target) => {
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
      data-compact={h < 40 || undefined}
      data-past={past || undefined}
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
      {h >= 22 ? (
        <span>
          {format(start, "h:mm")}
          {h >= 40 ? ` · ${minutes} min${course ? ` · ${course}` : ""}` : ""}
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
  const { calCursor, setCalCursor, setCalMode, select, now } = useApp();
  const drag = usePlanDrag();
  const nowMs = now.getTime();
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
              className={`ss-month-cell ${inMonth ? "" : "ss-outside"} ${deadline !== null && from > deadline ? "ss-past-deadline" : ""}`}
              data-today={isToday(d) || undefined}
              data-drop-date={inMonth ? from : undefined}
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
                    <EventChip key={en.key} event={en.event} past={Date.parse(en.event.end) <= nowMs} />
                  ) : (
                    <button
                      key={en.key}
                      className="ss-month-event ss-planned"
                      data-past={en.block!.end.getTime() <= nowMs || undefined}
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
