"use client";

import { CalendarCheck, Clock, Undo2 } from "lucide-react";
import { wireGray } from "../context";
import { Checkbox } from "./Controls";

/**
 * The pieces that carry SmartScheduler's core job: show a student which piece of
 * work fits the free gap in front of them, and let them tick it off.
 */

function swatch(color: string | null | undefined): React.CSSProperties {
  return { "--c": wireGray(color ?? "#64748b") } as React.CSSProperties;
}

/**
 * Which class something belongs to. Every class keeps one shade everywhere it
 * appears (Gestalt: similarity), so a student can follow one class across the
 * Plan, Calendar and Classes screens.
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
 * Classes), so it is recognised everywhere:
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
  /** Class colour, drawn as a grey shade. */
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
 * A stretch of free time and the work planned into it. This is the product's
 * core idea made visible: the gap's length is the headline, the work that fits
 * sits inside it, and any time left over is said out loud.
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
    <div className="rounded-xl border-[1.5px] border-dashed border-ok/45 bg-ok-soft p-2 sm:p-2.5" aria-label={`${label}, ${minutes} minutes`}>
      {onOpen ? (
        <button type="button" className="group px-1 pt-0.5 text-sm font-semibold text-ok text-left w-full inline-flex items-center gap-1.5" onClick={onOpen}>
          <Clock size={14} aria-hidden />
          <span className="group-hover:underline underline-offset-2">{label}</span>
          <span className="ml-auto text-xs font-normal text-muted">Open gap</span>
        </button>
      ) : (
        <div className="px-1 pt-0.5 text-sm font-semibold text-ok inline-flex items-center gap-1.5">
          <Clock size={14} aria-hidden />
          {label}
        </div>
      )}
      {children ? <ul className="mt-2 space-y-1.5">{children}</ul> : null}
      {note ? <p className="mt-1.5 px-1 text-xs text-muted">{note}</p> : null}
    </div>
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
        SmartScheduler<span className="wordmark-dot">.</span>
      </span>
    </span>
  );
}

/**
 * A short message at the bottom of the screen confirming what just happened.
 * When the action can be taken back, it offers Undo right there.
 */
export function Toast({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] rounded-xl bg-fg text-bg shadow-[var(--shadow-lg)] text-[0.9375rem] px-4 py-2.5 fade-in flex items-center gap-4"
    >
      <span className="min-w-0">{message}</span>
      {action && onAction ? (
        <button type="button" className="shrink-0 inline-flex items-center gap-1 font-bold underline underline-offset-4" onClick={onAction}>
          <Undo2 size={15} aria-hidden />
          {action}
        </button>
      ) : null}
    </div>
  );
}
