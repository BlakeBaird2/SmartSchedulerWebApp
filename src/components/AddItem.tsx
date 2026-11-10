"use client";

import { useState } from "react";
import { addDays, addMinutes, endOfWeek, format, isSameDay, startOfDay } from "date-fns";
import { PRIORITIES, type Priority } from "@/lib/types";
import { PRIORITY_LABEL } from "@/lib/todos";
import { clock } from "@/lib/ui";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";
import { SegmentedControl } from "./ui";
import { LengthField, WhenFields } from "./TimeField";

/*
 * Adding something of the student's own, from the Add button or by clicking
 * empty time on the calendar. Two kinds, as in Google Calendar:
 * - an event: a title and a time. It takes that time on the calendar, and the
 *   planner plans around it. No due date, no estimate.
 * - a task: work with a due date, a length and a priority, which goes on the
 *   to-do list (or, from a click on the calendar, straight onto that time).
 */

export type AddKind = "event" | "task";
type Due = "today" | "tomorrow" | "week" | "date" | "none";

/** When something is due, from the choices on the form. */
function dueAtFrom(due: Due, date: string, time: string, now: Date): string | null {
  const day = due === "today" ? now : due === "tomorrow" ? addDays(now, 1) : due === "week" ? endOfWeek(now, { weekStartsOn: 1 }) : due === "date" ? new Date(`${date}T00:00`) : null;
  if (!day || Number.isNaN(day.getTime())) return null;
  const [hh, mm] = (time || "17:00").split(":").map(Number);
  const at = new Date(day);
  at.setHours(hh, mm, 0, 0);
  return at.toISOString();
}

/** The next half hour from now, for an event added without a time picked. */
function nextHalfHour(now: Date): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  return addMinutes(d, 30 - (d.getMinutes() % 30));
}

/** A time picked on the calendar, still adjustable on the form. */
export interface PickedTime {
  start: Date;
  minutes: number;
  onChange: (start: Date, minutes: number) => void;
}

export function AddKindToggle({ kind, onKind }: { kind: AddKind; onKind: (k: AddKind) => void }) {
  return (
    <SegmentedControl
      label="Add an event or a task"
      stretch
      value={kind}
      onChange={onKind}
      options={[
        { id: "event", label: "Event" },
        { id: "task", label: "Task" },
      ]}
    />
  );
}

/**
 * The fields for an event or a task, and adding it. With `picked`, the time
 * comes from the calendar; without, the form asks for it.
 */
export function AddItemForm({ kind, picked, onDone }: { kind: AddKind; picked?: PickedTime; onDone: () => void }) {
  const { model, now, addTask, addEvent } = useApp();
  const firstStart = picked?.start ?? nextHalfHour(now);
  // A task added on a calendar day is due that day unless the student says otherwise.
  const pickedDay = picked ? startOfDay(picked.start) : null;
  const [due, setDue] = useState<Due>(
    !pickedDay || isSameDay(pickedDay, now) ? "today" : isSameDay(pickedDay, addDays(now, 1)) ? "tomorrow" : "date",
  );
  const [error, setError] = useState<string | null>(null);
  // Without a time from the calendar, the form keeps its own: an event's, and a task's estimate.
  const [own, setOwn] = useState({ start: firstStart, minutes: 60 });
  const [estimate, setEstimate] = useState(30);
  const when = picked ?? { ...own, onChange: (start: Date, minutes: number) => setOwn({ start, minutes }) };
  const past = picked ? picked.start.getTime() + picked.minutes * 60_000 <= now.getTime() : false;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim().slice(0, 140);
    if (!title) return;
    if (kind === "event") {
      if (when.minutes <= 0) return setError("It has to end after it starts.");
      addEvent(title, when.start, addMinutes(when.start, when.minutes));
    } else {
      const minutes = picked ? picked.minutes : estimate;
      const dueAt = dueAtFrom(due, String(data.get("dueDate") ?? ""), String(data.get("dueTime") ?? ""), now);
      addTask(
        { title, courseId: String(data.get("course") ?? "") || null, dueAt, minutes, priority: String(data.get("priority")) as Priority },
        picked?.start,
      );
    }
    onDone();
  };

  const whenFields = <WhenFields start={when.start} minutes={when.minutes} onChange={when.onChange} />;

  return (
    <form className="ss-add-form" onSubmit={submit} onChange={() => setError(null)}>
      <label>
        <span>{kind === "event" ? "Event name" : "Task name"}</span>
        <input
          name="title"
          required
          autoFocus
          data-autofocus
          placeholder={kind === "event" ? "Study group, gym, dinner…" : "What needs to get done?"}
          maxLength={140}
        />
      </label>

      {kind === "event" ? (
        whenFields
      ) : (
        <>
          {/* A task added on the calendar takes that time; its length is how long it needs. */}
          {picked ? whenFields : null}
          <div className="ss-form-row">
            <label>
              <span>Class or area</span>
              <select name="course" defaultValue="">
                <option value="">Personal</option>
                {model.visibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Due</span>
              <select name="due" value={due} onChange={(e) => setDue(e.target.value as Due)}>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This week</option>
                <option value="date">Pick a date…</option>
                <option value="none">No due date</option>
              </select>
            </label>
          </div>
          {due !== "none" ? (
            <div className="ss-form-row">
              {due === "date" ? (
                <label>
                  <span>Due date</span>
                  <input name="dueDate" type="date" required min={format(now, "yyyy-MM-dd")} defaultValue={format(pickedDay ?? addDays(now, 2), "yyyy-MM-dd")} />
                </label>
              ) : null}
              <label>
                <span>Due time</span>
                <input name="dueTime" type="time" defaultValue={picked ? "23:59" : "17:00"} />
              </label>
            </div>
          ) : null}
          <div className="ss-form-row">
            {picked ? null : (
              <label>
                <span>Estimate</span>
                <LengthField label="Estimate" className="" value={estimate} onChange={setEstimate} />
              </label>
            )}
            <label>
              <span>Priority</span>
              <select name="priority" defaultValue="medium">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {error ? <p className="ss-add-error">{error}</p> : null}
      {past ? <p className="ss-add-note">That time has already passed. Pick a time from now on.</p> : null}
      <button className="ss-primary" type="submit" disabled={past} data-smart-event={kind === "task" ? "task_added" : undefined}>
        <SsIcon name="plus" />
        {kind === "event" ? (picked ? `Add event at ${clock(picked.start)}` : "Add event") : picked ? `Add task at ${clock(picked.start)}` : "Add task"}
      </button>
    </form>
  );
}
