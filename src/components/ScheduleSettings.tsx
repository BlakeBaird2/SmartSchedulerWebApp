"use client";

import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import { randomId } from "@/lib/workspace";
import type { PlanPrefs, WeeklyBlock } from "@/lib/types";
import { duration, hhmmToMinutes, minutesLabel, minutesToHHMM } from "@/lib/ui";
import { useApp } from "./context";
import { DayToggles } from "./ClassTimes";
import { daysLabel } from "@/lib/meetings";
import { Button, Field as UiField, Switch } from "./ui";

/** Settings rows: label and hint on the left, the control on the right. */
function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return <UiField layout="row" {...props} />;
}

function Minutes({ value, options, onChange, label }: { value: number; options: number[]; onChange: (v: number) => void; label: string }) {
  const all = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <select className="input input-sm" aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {all.map((m) => (
        <option key={m} value={m}>
          {m === 0 ? "None" : duration(m)}
        </option>
      ))}
    </select>
  );
}

/** Working hours and the few knobs the planner has. */
export function HoursForm({ advanced = false }: { advanced?: boolean }) {
  const { ws, update } = useApp();
  const p = ws.prefs;
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PlanPrefs>) => update((w) => ({ ...w, prefs: { ...w.prefs, ...patch } }));

  const setHours = (which: "dayStart" | "dayEnd", value: string) => {
    if (!/^\d\d:\d\d$/.test(value)) return;
    let m = hhmmToMinutes(value);
    if (which === "dayEnd" && m === 0) m = 24 * 60; // 12:00 AM as an end means midnight
    const next = { dayStart: p.dayStart, dayEnd: p.dayEnd, [which]: m };
    if (next.dayEnd - next.dayStart < 60) {
      setError("Leave at least an hour between the start and end of your day.");
      return;
    }
    setError(null);
    set({ [which]: m });
  };

  return (
    <div className="divide-y divide-line">
      <Field label="Working hours" hint={`SmartScheduler only plans work between ${minutesLabel(p.dayStart)} and ${minutesLabel(p.dayEnd)}.`}>
        <input type="time" step={900} className="input input-sm" aria-label="Day starts" value={minutesToHHMM(p.dayStart)} onChange={(e) => setHours("dayStart", e.target.value)} />
        <span className="text-muted text-sm">to</span>
        <input
          type="time"
          step={900}
          className="input input-sm"
          aria-label="Day ends"
          value={minutesToHHMM(p.dayEnd % (24 * 60))}
          onChange={(e) => setHours("dayEnd", e.target.value)}
        />
      </Field>
      {error ? <p className="text-xs text-danger py-1.5">{error}</p> : null}
      <Field label="Plan work on weekends">
        <Switch checked={p.weekends} onChange={(v) => set({ weekends: v })} label="Plan work on weekends" />
      </Field>
      <Field label="Most work in a day" hint="Work due within a day can go past this.">
        <Minutes label="Most work in a day" value={p.dailyMax} options={[60, 120, 180, 240, 300, 360, 480, 600, 720]} onChange={(v) => set({ dailyMax: v })} />
      </Field>
      {advanced ? (
        <>
          <Field label="Breathing room around events" hint="Kept free before and after everything on your calendar, for travel and breaks.">
            <Minutes label="Breathing room" value={p.buffer} options={[0, 5, 10, 15, 20, 30]} onChange={(v) => set({ buffer: v })} />
          </Field>
          <Field label="Shortest gap worth using" hint="Free time shorter than this is left alone.">
            <Minutes label="Shortest gap" value={p.minGap} options={[10, 15, 20, 25, 30, 45, 60]} onChange={(v) => set({ minGap: v })} />
          </Field>
        </>
      ) : null}
    </div>
  );
}

/** Recurring busy time that isn't in any calendar: a job, practice, a commute. */
export function WeeklyEditor() {
  const { ws, update, toast } = useApp();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const blocks = ws.weekly.filter((b) => !b.courseId);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [error, setError] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (days.length === 0) return setError("Pick at least one day.");
    if (end <= start) return setError("The end time needs to be after the start.");
    const block: WeeklyBlock = { id: randomId(), label: label.trim() || "Busy", days: [...days].sort(), start, end };
    update((w) => ({ ...w, weekly: [...w.weekly, block] }));
    setLabel("");
    setError(null);
  };

  return (
    <div className="space-y-3">
      {blocks.length > 0 ? (
        <ul className="space-y-1.5">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#78716c] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{b.label}</div>
                <div className="text-xs text-muted">
                  {daysLabel(b.days)} · {minutesLabel(hhmmToMinutes(b.start))} – {minutesLabel(hhmmToMinutes(b.end))}
                </div>
              </div>
              <Button
                variant="quiet"
                iconOnly
                icon={Trash}
                label={`Remove ${b.label}`}
                onClick={() => {
                  update((w) => ({ ...w, weekly: w.weekly.filter((x) => x.id !== b.id) }));
                  toast(`Removed ${b.label}`, { undo: () => update((w) => ({ ...w, weekly: [...w.weekly, b] })) });
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={add} className="border border-dashed border-line-strong p-3 space-y-2.5">
        <input className="input" placeholder="What is it? (Work, practice, commute…)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        <div className="flex items-center gap-2 flex-wrap">
          <DayToggles value={days} onChange={setDays} />
          <div className="flex items-center gap-1.5">
            <input type="time" step={900} className="input input-sm" aria-label="Starts" value={start} onChange={(e) => setStart(e.target.value)} />
            <span className="text-muted text-sm">to</span>
            <input type="time" step={900} className="input input-sm" aria-label="Ends" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button type="submit" icon={Plus} className="ml-auto">
            Add busy time
          </Button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </form>
    </div>
  );
}
