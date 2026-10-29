"use client";

import { useEffect, useState } from "react";
import { addDays, endOfWeek, format } from "date-fns";
import { PRIORITIES, type Priority } from "@/lib/types";
import { PRIORITY_LABEL } from "@/lib/todos";
import { randomId } from "@/lib/workspace";
import { useApp } from "./context";
import { trackEvent } from "./smartEvents";
import { SsIcon } from "./SsIcon";

type Due = "today" | "tomorrow" | "week" | "date" | "none";
const ESTIMATES = [15, 30, 45, 60, 90, 120];

/**
 * Add a task no calendar knows about, as in the Figma prototype: a name, its
 * class or area, when it's due, how long it takes and how much it matters. It
 * goes straight onto the planner's list. Points are left out: they say what an
 * assignment is worth in its class, so they belong to assignments from a class
 * calendar.
 */
export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const { model, update, toast, now } = useApp();
  const [due, setDue] = useState<Due>("today");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim().slice(0, 140);
    if (!title) return;
    const courseId = String(data.get("course") ?? "") || null;
    const [hh, mm] = String(data.get("dueTime") || "17:00").split(":").map(Number);
    const day = due === "today" ? now : due === "tomorrow" ? addDays(now, 1) : due === "week" ? endOfWeek(now, { weekStartsOn: 1 }) : due === "date" ? new Date(`${data.get("dueDate")}T00:00`) : null;
    let dueAt: string | null = null;
    if (day && !Number.isNaN(day.getTime())) {
      const at = new Date(day);
      at.setHours(hh, mm, 0, 0);
      dueAt = at.toISOString();
    }
    const minutes = Number(data.get("minutes"));
    const priority = String(data.get("priority")) as Priority;
    const id = randomId();
    const taskId = `manual:${id}`;
    const at = new Date().toISOString();
    update((w) => ({
      ...w,
      manualTasks: [...w.manualTasks, { id, title, courseId, type: "assignment", dueAt }],
      estimates: { ...w.estimates, [taskId]: { minutes, source: "user", at } },
      taskMeta: { ...w.taskMeta, [taskId]: { priority } },
    }));
    trackEvent("task_added", { title, courseId, type: "assignment", hasDueDate: Boolean(dueAt), minutes });
    toast(`Added to Schedule Smart: ${title}`, {
      undo: () => update((w) => ({ ...w, manualTasks: w.manualTasks.filter((t) => t.id !== id) })),
    });
    onClose();
  };

  return (
    <div className="ss-backdrop" onMouseDown={onClose}>
      <section className="ss-modal" onMouseDown={(e) => e.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="add-task-title">
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">NEW ITEM</span>
            <h2 id="add-task-title">Add a task</h2>
          </div>
          <button className="ss-icon-button" onClick={onClose} aria-label="Close">
            <SsIcon name="x" />
          </button>
        </div>
        <form onSubmit={add}>
          <label>
            <span>Task name</span>
            <input name="title" required autoFocus placeholder="What needs to get done?" maxLength={140} />
          </label>
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
          {due === "date" ? (
            <label>
              <span>Due date</span>
              <input name="dueDate" type="date" required min={format(now, "yyyy-MM-dd")} defaultValue={format(addDays(now, 2), "yyyy-MM-dd")} />
            </label>
          ) : null}
          {due !== "none" ? (
            <label>
              <span>Due time</span>
              <input name="dueTime" type="time" defaultValue="17:00" />
            </label>
          ) : null}
          <div className="ss-form-row">
            <label>
              <span>Estimate</span>
              <select name="minutes" defaultValue="30">
                {ESTIMATES.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : m === 60 ? "1 hour" : `${m / 60} hours`}
                  </option>
                ))}
              </select>
            </label>
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
          <button className="ss-primary" type="submit" data-smart-event="task_added">
            <SsIcon name="plus" /> Add to Schedule Smart
          </button>
        </form>
      </section>
    </div>
  );
}
