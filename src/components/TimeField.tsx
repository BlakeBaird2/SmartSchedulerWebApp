"use client";

import { useEffect, useId, useRef, useState } from "react";
import { addMinutes, format, startOfDay } from "date-fns";
import { LENGTH_CHOICES } from "@/lib/ui";
import { lengthText, parseLength, parseTime, timeLabel, timeSteps } from "@/lib/timeText";

/*
 * Setting a time the way Google Calendar does: click a box for a list of times
 * every 15 minutes (an end time's list shows how long each would make it), or
 * type any time at all ("3:37pm", "15:37", "noon"). Lengths work the same way
 * ("45", "1h 20m", "1.5 hours").
 */

const DAY = 24 * 60;

interface Option {
  value: number;
  label: string;
  hint?: string;
}

/** A text box with a list under it: pick from the list, or type and press Enter (or leave the box). */
function Combo({
  value,
  display,
  options,
  parse,
  onCommit,
  label,
  className,
}: {
  value: number;
  display: (v: number) => string;
  options: Option[];
  parse: (text: string) => number | null;
  onCommit: (v: number) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(display(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const focused = useRef(false);
  const list = useRef<HTMLUListElement>(null);

  // Show a change made elsewhere (a drag on the calendar, the start moving the end) unless it's being typed in.
  const shown = display(value);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);

  // Opening the list shows the current choice (or the nearest after it), as Google Calendar does.
  const nearest = Math.max(0, options.findIndex((o) => o.value >= value));
  useEffect(() => {
    if (!open || !list.current) return;
    const el = list.current.children[active >= 0 ? active : nearest] as HTMLElement | undefined;
    if (el) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.offsetHeight / 2;
  }, [open, active, nearest]);

  const commit = (v: number) => {
    setText(display(v));
    setOpen(false);
    setActive(-1);
    if (v !== value) onCommit(v);
  };
  const commitText = () => {
    const v = parse(text);
    if (v === null) setText(display(value));
    else commit(v);
    setOpen(false);
  };

  return (
    <div className="ss-combo">
      <input
        className={className ?? "input"}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          setOpen(true);
          e.currentTarget.select();
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          focused.current = false;
          commitText();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            const from = active >= 0 ? active : nearest - (e.key === "ArrowDown" ? 1 : 0);
            setActive(Math.max(0, Math.min(options.length - 1, from + (e.key === "ArrowDown" ? 1 : -1))));
          } else if (e.key === "Enter") {
            // Enter sets the time; it never sends the form around it.
            e.preventDefault();
            if (open && active >= 0) commit(options[active].value);
            else commitText();
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setText(display(value));
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {open && options.length > 0 ? (
        <ul className="ss-combo-list" role="listbox" id={`${id}-list`} ref={list} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active || undefined}
              // Keep the box focused, so the pick lands before it's left.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(o.value)}
            >
              {o.label}
              {o.hint ? <span>{o.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A time of day, in minutes from midnight. With `after` (the start), it's an end
 * time: only later times count, and the list shows how long each would make it.
 */
export function TimeField({ value, onChange, label, after }: { value: number; onChange: (minutes: number) => void; label: string; after?: number }) {
  const options: Option[] =
    after === undefined
      ? timeSteps(0, DAY - 15).map((m) => ({ value: m, label: timeLabel(m) }))
      : // Counted from the start, as Google Calendar does: 10 minutes, then every 15.
        [after + 10, ...timeSteps(15, DAY - after).map((m) => after + m)]
          .filter((m) => m <= DAY)
          .map((m) => ({ value: m, label: timeLabel(m), hint: lengthText(m - after) }));
  return (
    <Combo
      label={label}
      value={value}
      display={timeLabel}
      options={options}
      parse={(t) => {
        const m = parseTime(t, after);
        return m === null || (after !== undefined && m <= after) ? null : m;
      }}
      onCommit={onChange}
    />
  );
}

/** How long something takes, in minutes: pick a usual length, or type any ("50", "1h 20m"). */
export function LengthField({ value, onChange, label, usual, className }: { value: number; onChange: (minutes: number) => void; label: string; usual?: number; className?: string }) {
  const choices = [...new Set([10, ...LENGTH_CHOICES, value, ...(usual ? [usual] : [])])].sort((a, b) => a - b);
  return (
    <Combo
      label={label}
      className={className}
      value={value}
      display={lengthText}
      options={choices.map((m) => ({ value: m, label: lengthText(m), hint: m === usual ? "usual" : undefined }))}
      parse={(t) => {
        const m = parseLength(t);
        return m !== null && m >= 5 ? m : null;
      }}
      onCommit={onChange}
    />
  );
}

/**
 * When something happens: a day, a start and an end, as in Google Calendar's
 * event editor. Moving the start keeps the length; the end sets it.
 */
export function WhenFields({
  start,
  minutes,
  onChange,
  minDate,
}: {
  start: Date;
  minutes: number;
  onChange: (start: Date, minutes: number) => void;
  minDate?: Date;
}) {
  const day = startOfDay(start);
  const from = Math.round((start.getTime() - day.getTime()) / 60_000);
  const to = Math.min(DAY, from + minutes);
  const at = (d: Date, m: number) => addMinutes(startOfDay(d), m);

  return (
    <div className="ss-when">
      <label className="ss-when-date">
        <span>Date</span>
        <input
          className="input"
          type="date"
          required
          min={minDate ? format(minDate, "yyyy-MM-dd") : undefined}
          value={format(day, "yyyy-MM-dd")}
          onChange={(e) => {
            const picked = new Date(`${e.target.value}T00:00`);
            if (!Number.isNaN(picked.getTime())) onChange(at(picked, from), minutes);
          }}
        />
      </label>
      <div className="ss-when-times">
        <label>
          <span>Starts</span>
          <TimeField
            label="Starts"
            value={from}
            onChange={(m) => onChange(at(day, m), Math.max(5, Math.min(minutes, DAY - m)))}
          />
        </label>
        <span className="ss-when-dash" aria-hidden>
          –
        </span>
        <label>
          <span>Ends</span>
          <TimeField label="Ends" value={to} after={from} onChange={(m) => onChange(start, m - from)} />
        </label>
      </div>
    </div>
  );
}
