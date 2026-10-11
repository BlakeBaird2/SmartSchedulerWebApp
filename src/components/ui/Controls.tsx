"use client";

import { Check, type LucideIcon } from "lucide-react";

/**
 * A row of options where exactly one is chosen: the app's main views, the
 * calendar's Month / Week / Day, the plan's day picker. The chosen one is
 * boxed, shaded and underlined, so it is clear without colour.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  stretch = false,
  scroll = false,
  className = "",
}: {
  /** `sub` adds a second, smaller line under the label (a date under a weekday). */
  options: { id: T; label: string; sub?: string; ariaLabel?: string; icon?: LucideIcon; hideLabelOnSmall?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  /** Names the group for screen readers ("View", "Calendar range"). */
  label: string;
  /** Share the full width equally (phone navigation). */
  stretch?: boolean;
  /** Let a long row scroll sideways instead of wrapping. */
  scroll?: boolean;
  className?: string;
}) {
  const row = (
    <div role="group" aria-label={label} className={`seg ${stretch ? "flex w-full" : ""} ${scroll ? "w-max" : ""} ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          aria-pressed={o.id === value}
          aria-current={o.id === value ? "true" : undefined}
          onClick={() => onChange(o.id)}
          className={`${stretch ? "flex-1 basis-0 min-w-0 justify-center !px-1" : ""} ${o.sub ? "!flex-col !gap-0 !py-1 leading-tight" : ""}`}
          title={o.hideLabelOnSmall ? o.label : undefined}
          aria-label={o.ariaLabel}
        >
          {o.icon ? <o.icon size={15} aria-hidden /> : null}
          <span className={o.hideLabelOnSmall ? "hidden sm:inline" : ""}>{o.label}</span>
          {o.sub ? <span className="text-xs tabular-nums">{o.sub}</span> : null}
        </button>
      ))}
    </div>
  );
  return scroll ? <div className="-mx-1 px-1 overflow-x-auto scrollbar-thin max-w-full">{row}</div> : row;
}

/** On / off. The label says what "on" means; the track fills when it is on. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/**
 * The tick box for finishing a piece of work. Square, like every checkbox people
 * already know, and big enough to hit on a phone.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  /** Spoken name, such as "Mark Reading: Chapter 5 as done". */
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Mark as not done" : "Mark as done"}
      className={`check ${size === "sm" ? "check-sm" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <Check size={size === "sm" ? 12 : 15} strokeWidth={3.5} aria-hidden />
    </button>
  );
}

/**
 * A labelled form control. `stacked` puts the label above the control (forms in
 * dialogs); `row` puts the label and hint on the left and the control on the right
 * (settings lists). Labels are always visible, never only a placeholder.
 */
export function Field({
  label,
  hint,
  layout = "stacked",
  className = "",
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  layout?: "stacked" | "row";
  className?: string;
  children: React.ReactNode;
}) {
  if (layout === "row") {
    return (
      <div className={`flex items-center gap-3 py-2.5 flex-wrap ${className}`}>
        <div className="min-w-0 flex-1 basis-48">
          <div className="text-[0.9375rem] font-semibold">{label}</div>
          {hint ? <div className="text-sm text-muted mt-0.5 leading-relaxed">{hint}</div> : null}
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    );
  }
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      {label}
      <div className="mt-1 font-normal">{children}</div>
      {hint ? <div className="mt-1 text-xs font-normal text-muted">{hint}</div> : null}
    </label>
  );
}

/** One of several small choices shown side by side, like "30m · 45m · 1h". Pressed = chosen. */
export function ChoicePill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="pill" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}
