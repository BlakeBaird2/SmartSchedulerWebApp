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
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { dueEntries, type DueEntry } from "@/lib/dueDates";
import { ASSIGNMENT_TYPES, type AssignmentType } from "@/lib/types";
import { approxDuration, clock, dayKey, plural, typeMeta } from "@/lib/ui";
import { useApp, type CalMode } from "./context";
import { SsIcon, type SsIconName } from "./SsIcon";

const WEEK = { weekStartsOn: 1 } as const;

/** Each kind of work has its own colour, icon and name, so it never relies on colour alone. */
const TYPE_ICON: Record<AssignmentType, SsIconName> = {
  exam: "cap",
  quiz: "help",
  project: "folder",
  assignment: "pen",
  reading: "book",
};
/** The legend's order, loudest first. */
const LEGEND: AssignmentType[] = ["exam", "quiz", "project", "assignment", "reading"];

const MODES: { id: CalMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

/**
 * Due dates: everything that's due, from every class and everything added by
 * hand, by the day it's due, and exams by the day they happen (see dueDates.ts). A week (the default) is a column for each day,
 * Monday to Sunday, side by side, with that day's work listed down it; a day
 * shows one day with more about each item; a month shows the shape of the month. Exams, quizzes,
 * projects, assignments and readings each look different at a glance.
 */
export function DueDatesPage() {
  const { model, now, dueMode: mode, setDueMode: setMode } = useApp();
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const range = useMemo(() => {
    if (mode === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    if (mode === "week") return { from: startOfWeek(cursor, WEEK), to: addDays(startOfWeek(cursor, WEEK), 7) };
    return { from: startOfMonth(cursor), to: addDays(endOfMonth(cursor), 1) };
  }, [mode, cursor]);

  // Everything with a date, by the day it falls on here: work by its due date, exams by when they start.
  const byDay = useMemo(() => {
    const m = new Map<string, DueEntry[]>();
    for (const e of dueEntries(model.tasks, model.events)) {
      const k = dayKey(new Date(e.at));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [model.tasks, model.events]);

  const inRange = useMemo(() => {
    const out: DueEntry[] = [];
    for (let d = range.from; d < range.to; d = addDays(d, 1)) out.push(...(byDay.get(dayKey(d)) ?? []));
    return out;
  }, [byDay, range]);
  const counts = Object.fromEntries(ASSIGNMENT_TYPES.map((t) => [t, inRange.filter((x) => x.type === t).length])) as Record<AssignmentType, number>;

  const step = (dir: number) => setCursor((c) => (mode === "day" ? addDays(c, dir) : mode === "week" ? addWeeks(c, dir) : addMonths(c, dir)));
  const unit = mode === "day" ? "day" : mode === "week" ? "week" : "month";
  const title =
    mode === "day"
      ? format(cursor, "EEEE, MMMM d")
      : mode === "week"
        ? `${format(range.from, "MMM d")} – ${format(addDays(range.to, -1), isSameMonth(range.from, addDays(range.to, -1)) ? "d" : "MMM d")}`
        : format(cursor, "MMMM yyyy");

  return (
    <section className="ss-due-page fade-in">
      {/* Just the name, so a whole week fits on the screen below it. */}
      <h1 className="ss-due-heading">Due Dates</h1>

      <div className="ss-due-toolbar">
        <div className="ss-due-title">
          <span>{mode === "month" ? "MONTH" : format(cursor, "MMMM yyyy").toUpperCase()}</span>
          <h2>{title}</h2>
        </div>
        <div className="ss-controls">
          <button className="ss-today" onClick={() => setCursor(startOfDay(new Date()))}>
            Today
          </button>
          <div className="ss-arrows">
            <button onClick={() => step(-1)} aria-label={`Previous ${unit}`}>
              <SsIcon name="chevronLeft" />
            </button>
            <button onClick={() => step(1)} aria-label={`Next ${unit}`}>
              <SsIcon name="chevronRight" />
            </button>
          </div>
          <div className="ss-due-modes" role="group" aria-label="Show">
            {MODES.map((m) => (
              <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="ss-due-legend" aria-label={`Due this ${unit}`}>
        {LEGEND.map((t) => (
          <li key={t} data-type={t} data-none={counts[t] === 0 || undefined}>
            <TypeBadge type={t} />
            <strong>{counts[t]}</strong> {counts[t] === 1 ? typeMeta(t).label : typeMeta(t).plural}
          </li>
        ))}
      </ul>

      {mode === "month" ? (
        <DueMonth
          cursor={cursor}
          byDay={byDay}
          onOpenDay={(d) => {
            setCursor(d);
            setMode("day");
          }}
        />
      ) : mode === "week" ? (
        <DueWeek days={eachDayOfInterval({ start: range.from, end: addDays(range.to, -1) })} byDay={byDay} now={now} />
      ) : (
        <div className="ss-due-days">
          <DayCard day={range.from} items={byDay.get(dayKey(range.from)) ?? []} now={now} />
        </div>
      )}
      {mode !== "month" ? <p className="ss-due-note">Times are shown in your time zone ({timeZoneName()}).</p> : null}
    </section>
  );
}

function TypeBadge({ type, size = 15 }: { type: AssignmentType; size?: number }) {
  return (
    <span className="ss-type-badge" data-type={type} aria-hidden>
      <SsIcon name={TYPE_ICON[type]} size={size} />
    </span>
  );
}

/** One day: its date, how much is due, and each item down the card. */
function DayCard({ day, items, now }: { day: Date; items: DueEntry[]; now: Date }) {
  const past = day < startOfDay(now);
  return (
    <article className="ss-due-day" data-today={isToday(day) || undefined} data-past={past || undefined} data-empty={items.length === 0 || undefined} aria-label={format(day, "EEEE, MMMM d")}>
      <header>
        <div>
          <strong>{format(day, "EEEE")}</strong>
          <span>{format(day, "MMM d")}</span>
          {isToday(day) ? <em>Today</em> : null}
        </div>
        <span className="ss-due-count">{items.length ? `${plural(items.length, "item")} due` : "Nothing due"}</span>
      </header>
      {items.length ? (
        <ul>
          {items.map((t) => (
            <DueItem key={t.id} task={t} detailed now={now} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function DueItem({ task: t, detailed, now }: { task: DueEntry; detailed: boolean; now: Date }) {
  const { model, select } = useApp();
  const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
  const due = new Date(t.at);
  // Only work can be late; an exam that has happened is just over.
  const late = t.source === "task" && !t.done && due < now;
  const meta = typeMeta(t.type);
  return (
    <li>
      <button
        className="ss-due-item"
        data-type={t.type}
        data-done={t.done || undefined}
        onClick={() => select({ kind: t.source, id: t.id })}
        aria-label={`${meta.label}: ${t.title}, ${course?.code ?? "Personal"}, ${t.source === "event" ? "starts" : "due"} ${clock(due)}${t.done ? ", done" : late ? ", past due" : ""}. Open details`}
      >
        <TypeBadge type={t.type} size={detailed ? 17 : 15} />
        <span className="ss-due-main">
          <strong>{t.title}</strong>
          <span className="ss-due-meta">
            <span className="ss-due-type">{meta.label}</span>
            <span className="ss-due-class">
              <i style={{ background: course?.color ?? "var(--ss-personal)" }} aria-hidden />
              {course?.code ?? "Personal"}
            </span>
            {detailed && t.estimate ? <span>About {approxDuration(t.estimate).replace("~", "")}</span> : null}
            {t.points !== null ? <span>{t.points} pts</span> : null}
          </span>
        </span>
        <span className="ss-due-when">
          {t.done ? (
            <span className="ss-due-done">
              <SsIcon name="check" size={13} /> Done
            </span>
          ) : late ? (
            <span className="ss-due-late">Past due</span>
          ) : null}
          <time dateTime={t.at}>{t.allDay ? "All day" : clock(due)}</time>
        </span>
      </button>
    </li>
  );
}

/** "MDT", "PST": the browser's time zone, short. */
function timeZoneName(): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName");
  return part?.value ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The week: seven columns side by side, Monday to Sunday, each with that day's
 * work stacked down it. Each item is tinted with its class's colour and marked
 * with its kind; exams stand out. On a phone the columns scroll sideways, today
 * first in view.
 */
function DueWeek({ days, byDay, now }: { days: Date[]; byDay: Map<string, DueEntry[]>; now: Date }) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = days[0]?.getTime();
  useLayoutEffect(() => {
    const el = scroller.current;
    const today = el?.querySelector<HTMLElement>("[data-today]");
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = today ? today.offsetLeft - 8 : 0;
  }, [first]);
  return (
    <div className="ss-due-week" ref={scroller}>
      {days.map((d) => {
        const items = byDay.get(dayKey(d)) ?? [];
        return (
          <section
            key={d.getTime()}
            className="ss-due-col"
            data-today={isToday(d) || undefined}
            data-past={d < startOfDay(now) || undefined}
            aria-label={`${format(d, "EEEE, MMMM d")}: ${items.length ? `${plural(items.length, "item")} due` : "nothing due"}`}
          >
            <header>
              <span>{format(d, "EEE").toUpperCase()}</span>
              <strong>{format(d, "d")}</strong>
            </header>
            {items.length ? (
              <ul>
                {items.map((t) => (
                  <WeekItem key={t.id} task={t} now={now} />
                ))}
              </ul>
            ) : (
              <p className="ss-due-none" aria-hidden>
                —
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WeekItem({ task: t, now }: { task: DueEntry; now: Date }) {
  const { model, select } = useApp();
  const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
  const due = new Date(t.at);
  // Only work can be late; an exam that has happened is just over.
  const late = t.source === "task" && !t.done && due < now;
  const meta = typeMeta(t.type);
  return (
    <li>
      <button
        className="ss-due-card"
        data-type={t.type}
        data-done={t.done || undefined}
        style={{ "--c": course?.color ?? "var(--ss-personal)" } as React.CSSProperties}
        onClick={() => select({ kind: t.source, id: t.id })}
        aria-label={`${meta.label}: ${t.title}, ${course?.code ?? "Personal"}, ${t.source === "event" ? "starts" : "due"} ${clock(due)}${t.done ? ", done" : late ? ", past due" : ""}. Open details`}
      >
        <span className="ss-due-card-top">
          <span className="ss-due-card-class">
            <span className="ss-due-card-icon" title={meta.label}>
              <SsIcon name={t.done ? "check" : TYPE_ICON[t.type]} size={15} />
            </span>
            {course?.code ?? "Personal"}
          </span>
          <time dateTime={t.at} data-late={late || undefined}>
            {t.allDay ? (
              "All day"
            ) : (
              <>
                {format(due, "h:mm")}
                <small>{format(due, "a").toLowerCase()}</small>
              </>
            )}
          </time>
        </span>
        <strong>{t.title}</strong>
      </button>
    </li>
  );
}

/** The month: what's due each day, as a stripe per item, Sunday first like the calendar. */
function DueMonth({ cursor, byDay, onOpenDay }: { cursor: Date; byDay: Map<string, DueEntry[]>; onOpenDay: (d: Date) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
  return (
    <div className="ss-month ss-due-month">
      <div className="ss-month-weekdays">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="ss-month-grid">
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const items = inMonth ? (byDay.get(dayKey(d)) ?? []) : [];
          return (
            <button
              key={d.getTime()}
              className={`ss-month-cell ${inMonth ? "" : "ss-outside"}`}
              data-today={isToday(d) || undefined}
              onClick={() => onOpenDay(d)}
              aria-label={`${format(d, "EEEE, MMMM d")}: ${items.length ? `${plural(items.length, "item")} due` : "nothing due"}. Open the day`}
            >
              <strong>{format(d, "d")}</strong>
              <span className="ss-month-events">
                {items.slice(0, 3).map((t) => (
                  <span key={t.id} className="ss-due-chip" data-type={t.type} data-done={t.done || undefined}>
                    <TypeBadge type={t.type} size={11} />
                    <span>{t.title}</span>
                  </span>
                ))}
                {items.length > 3 ? <span className="ss-more-events">+{items.length - 3} more</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
