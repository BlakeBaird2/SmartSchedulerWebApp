"use client";

import { useState } from "react";
import { format } from "date-fns";
import { randomId } from "@/lib/workspace";
import { ASSIGNMENT_TYPES, type AssignmentType } from "@/lib/types";
import { duration, typeMeta } from "@/lib/ui";
import { useApp } from "./context";
import { Button, ChoicePill, Dialog, DialogActions, Field } from "./ui";

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240];

/** For work no calendar knows about: a paper, a study session, a form to fill in. */
export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const { model, ws, update, toast, now } = useApp();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [type, setType] = useState<AssignmentType>("assignment");
  const [date, setDate] = useState(() => format(new Date(Date.now() + 86_400_000), "yyyy-MM-dd"));
  const [time, setTime] = useState("23:59");
  const [estimate, setEstimate] = useState<number | null>(null);
  const minutes = estimate ?? ws.prefs.estimates[type];
  const past = (() => {
    if (!date) return false;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = (time || "23:59").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm).getTime() < now.getTime();
  })();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = randomId();
    let dueAt: string | null = null;
    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      const [hh, mm] = (time || "23:59").split(":").map(Number);
      dueAt = new Date(y, m - 1, d, hh, mm).toISOString();
    }
    update((w) => ({
      ...w,
      manualTasks: [...w.manualTasks, { id, title: title.trim().slice(0, 140), courseId: courseId || null, type, dueAt }],
      estimates: estimate !== null ? { ...w.estimates, [`manual:${id}`]: estimate } : w.estimates,
    }));
    toast(`Added to your plan: ${title.trim()}`, {
      undo: () => update((w) => ({ ...w, manualTasks: w.manualTasks.filter((t) => t.id !== id) })),
    });
    onClose();
  };

  return (
    <Dialog title="Add a task" description="For work that isn't on any calendar. SmartScheduler fits it into your free time." onClose={onClose} onSubmit={save}>
      <div className="space-y-4">
        <Field label="What needs doing?">
          <input
            className="input"
            placeholder="e.g. Finish lab report"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-autofocus
            maxLength={140}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class">
            <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No class</option>
              {model.visibleCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as AssignmentType)}>
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeMeta(t).label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Due time">
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
          </Field>
        </div>
        {past ? <p className="text-sm font-semibold">That time has already passed, so this will show as overdue.</p> : null}
        <fieldset>
          <legend className="text-sm font-semibold">Time it needs</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...new Set([...ESTIMATES, minutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <ChoicePill key={m} selected={minutes === m} onClick={() => setEstimate(m)}>
                  {duration(m)}
                </ChoicePill>
              ))}
          </div>
        </fieldset>
      </div>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!title.trim()} title={title.trim() ? undefined : "Name the task first"}>
          Add task
        </Button>
      </DialogActions>
    </Dialog>
  );
}
