"use client";

import { CalendarCheck, ChevronRight, Clock, Flag, Pin, Undo2 } from "lucide-react";
import { wireGray } from "../context";
import { Checkbox } from "./Controls";

/**
 * The pieces that carry Schedule Smart's core job: show a student which piece of
 * work fits the free gap in front of them, and let them tick it off.
 */

function swatch(color: string | null | undefined): React.CSSProperties {
  return { "--c": wireGray(color ?? "#64748b") } as React.CSSProperties;
}

/**
 * Which class something belongs to. Every class keeps one shade everywhere it
 * appears (Gestalt: similarity), so a student can follow one class across the
 * Plan, Calendar and Upcoming screens.
 *
 * - `tag`: a boxed code, for the main task on a screen.
 * - `dot`: a small square and the code, for dense lists.
 */
export function ClassChip({ code, color, variant = "dot", title }: { code: string; color?: string | null; variant?: "tag" | "dot"; title?: string }) {
  if (variant === "tag") {
    return (
      <span className="course-chip px-1.5 py-0.5 text-xs font-semibold" style={swatch(color)} title={title}>
        {code}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 course-text font-medium min-w-0" style={swatch(color)} title={title}>
      <span className="course-dot" aria-hidden />
      <span className="truncate">{code}</span>
    </span>
  );
}

/**
 * One piece of work. The same card is used on every screen (Plan, Upcoming,
 * Calendar), so it is recognised everywhere:
 *
 * tick box (finish it) · title (open it) · details line · optional right-hand column.
 *
 * The whole card opens the details; only the tick box marks it done, and it is
 * kept apart on the left so the two are never confused.
 */
export function TaskCard({
  title,
  done = false,
  onToggleDone,
  onOpen,
  color,
  density = "regular",
  badge,
  meta,
  trailing,
}: {
  title: string;
  done?: boolean;
  onToggleDone: () => void;
  onOpen: () => void;
  /** Class colour, drawn as the tile's outline. */
  color?: string | null;
  density?: "regular" | "compact";
  /** A chip next to the title, such as "Exam". */
  badge?: React.ReactNode;
  /** The details line: class, time needed, when it's planned. */
  meta?: React.ReactNode;
  /** Right-hand column: due time or time needed. */
  trailing?: React.ReactNode;
}) {
  const compact = density === "compact";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title}${done ? " (done)" : ""}. Open details`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={swatch(color)}
      className={`task-card group flex ${compact ? "items-start gap-2 px-2 py-1.5" : "items-center gap-3 px-3 py-2.5"} cursor-pointer ${done ? "row-done" : ""}`}
    >
      <span className={compact ? "pt-0.5" : ""}>
        <Checkbox checked={done} onChange={onToggleDone} size={compact ? "sm" : "md"} label={done ? `Mark ${title} as not done` : `Mark ${title} as done`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`row-title font-semibold leading-snug ${compact ? "text-[13px] line-clamp-2" : "text-[0.9375rem] line-clamp-2"}`}>{title}</span>
          {badge}
        </div>
        {meta ? (
          <div className={`mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-muted min-w-0 ${compact ? "text-[11px]" : "text-xs"}`}>{meta}</div>
        ) : null}
      </div>
      {trailing ? <div className="text-right shrink-0">{trailing}</div> : null}
    </div>
  );
}

/**
 * One row of a day, read top to bottom like a phone calendar's agenda: the time on
 * the left, a marker on the timeline, and what happens then on the right.
 *
 * Free time is shown by the timeline itself, not a box: its start and end times
 * are joined by a dashed green line, so the work beside it plainly sits inside
 * that stretch of time, and the work keeps the full width of the screen.
 */
export function TimelineRow({
  start,
  end,
  marker = "event",
  color,
  children,
}: {
  start: string;
  /** End time. For free time it sits at the bottom of the line; for events, under the start. */
  end?: string;
  marker?: "event" | "free" | "due";
  /** Class colour for an event's dot. */
  color?: string | null;
  children: React.ReactNode;
}) {
  const free = marker === "free";
  return (
    <li className="grid grid-cols-[2.6rem_0.5rem_minmax(0,1fr)] sm:grid-cols-[4rem_0.75rem_minmax(0,1fr)] gap-x-1 sm:gap-x-2">
      <div className={`pt-2 text-right tabular-nums whitespace-nowrap flex flex-col items-end ${free ? "pb-0.5" : ""}`}>
        <span className={`text-xs font-medium ${free ? "text-ok" : marker === "due" ? "text-warn" : ""}`}>
          <Time value={start} />
        </span>
        {end ? (
          <span className={`text-[11px] text-faint ${free ? "mt-auto" : ""}`}>
            <Time value={end} />
          </span>
        ) : null}
      </div>
      <div className="relative" aria-hidden>
        {free ? (
          <>
            <span className="absolute left-1/2 -translate-x-1/2 top-[0.8rem] h-2 w-2 rounded-full border-2 border-ok bg-surface" />
            <span className="absolute left-1/2 -translate-x-1/2 top-[1.45rem] bottom-[0.55rem] border-l-2 border-dashed border-ok/55" />
            {end ? <span className="absolute left-1/2 -translate-x-1/2 bottom-[0.2rem] h-2 w-2 rounded-full border-2 border-ok bg-surface" /> : null}
          </>
        ) : marker === "due" ? (
          // A deadline: a small amber diamond, like a milestone on a timeline.
          <span className="absolute left-1/2 top-[0.8rem] h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-warn" />
        ) : (
          <span className="absolute left-1/2 -translate-x-1/2 top-[0.75rem] h-2 w-2 rounded-full" style={{ background: wireGray(color) }} />
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** A clock time. On phones "AM"/"PM" is set small so the time column stays narrow. */
function Time({ value }: { value: string }) {
  const m = /^(.*?)\s?(AM|PM)$/.exec(value);
  if (!m) return <>{value}</>;
  return (
    <>
      {m[1]}
      <span className="ml-px text-[0.6rem] font-medium sm:ml-1 sm:text-[length:inherit]">{m[2]}</span>
    </>
  );
}

/**
 * A stretch of free time and the work planned into it. This is the product's
 * core idea made visible: the gap's length is the headline, the work that fits
 * follows it at full width, and any time left over is said out loud. Put it in
 * a `TimelineRow` with `marker="free"`, whose dashed line marks the time as free.
 */
export function FreeGapBlock({
  minutes,
  label,
  note,
  children,
  onOpen,
}: {
  minutes: number;
  label: string;
  note?: React.ReactNode;
  children?: React.ReactNode;
  /** Opens free-gap details (Plan / Calendar goal route). */
  onOpen?: () => void;
}) {
  return (
    <div className="pb-1" aria-label={`${label}, ${minutes} minutes`}>
      {onOpen ? (
        <button type="button" className="group py-1.5 text-sm font-semibold text-ok text-left w-full inline-flex items-center gap-1.5" onClick={onOpen}>
          <Clock size={14} aria-hidden />
          <span className="group-hover:underline underline-offset-2">{label}</span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-normal text-muted group-hover:text-fg">
            Open gap
            <ChevronRight size={13} aria-hidden />
          </span>
        </button>
      ) : (
        <div className="py-1.5 text-sm font-semibold text-ok inline-flex items-center gap-1.5">
          <Clock size={14} aria-hidden />
          {label}
        </div>
      )}
      {children ? <ul className="mt-1 space-y-1.5">{children}</ul> : null}
      {note ? <p className="mt-1.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/**
 * When the work is planned: a green chip with a clock ("Planned today 3:25 PM").
 * Paired with DueBadge, so "when you'll do it" and "when it's due" never look alike.
 */
export function PlannedBadge({ children, title, pinned = false }: { children: React.ReactNode; title?: string; pinned?: boolean }) {
  const Icon = pinned ? Pin : Clock;
  return (
    <span className="plan-badge" title={title ?? (pinned ? "A time you picked" : "When Schedule Smart planned this")}>
      <Icon size={11} strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}

/** When the work is due: an amber chip with a flag ("Due Tue 11:59 PM"), red once it's late. */
export function DueBadge({ children, late = false, title }: { children: React.ReactNode; late?: boolean; title?: string }) {
  return (
    <span className="due-badge" data-late={late || undefined} title={title ?? "Deadline"}>
      <Flag size={11} strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}

/** The app's name and mark, drawn the same way in every header. */
export function Wordmark({ size = "md", collapse = false }: { size?: "md" | "lg"; /** On phones, show only the mark so the header tools fit. */ collapse?: boolean }) {
  const lg = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 select-none">
      {/* On phones the header only has room for the mark; everywhere else the name is the logo. */}
      {collapse ? (
        <span className="grid place-items-center shrink-0 rounded-lg bg-accent text-white h-8 w-8 sm:hidden" aria-hidden>
          <CalendarCheck size={17} strokeWidth={2.4} />
        </span>
      ) : null}
      <span className={`wordmark ${lg ? "text-2xl" : "text-xl"} ${collapse ? "hidden sm:inline" : ""}`}>
        Schedule Smart
      </span>
    </span>
  );
}

/**
 * A short message at the bottom of the screen confirming what just happened.
 * When the action can be taken back, it offers Undo right there. Only Undo
 * catches taps; the rest of it lets them through to what is underneath.
 */
export function Toast({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-toast pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-5 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] rounded-xl bg-fg text-bg shadow-[var(--shadow-lg)] text-[0.9375rem] px-4 py-2.5 fade-in flex items-center gap-4"
    >
      <span className="min-w-0">{message}</span>
      {action && onAction ? (
        <button type="button" className="pointer-events-auto shrink-0 inline-flex items-center gap-1 font-bold underline underline-offset-4" onClick={onAction}>
          <Undo2 size={15} aria-hidden />
          {action}
        </button>
      ) : null}
    </div>
  );
}
