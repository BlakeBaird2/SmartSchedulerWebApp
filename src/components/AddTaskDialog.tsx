"use client";

import { useEffect, useState } from "react";
import { AddItemForm, AddKindToggle, type AddKind } from "./AddItem";
import { SsIcon } from "./SsIcon";

/**
 * The + New button's pop-up. It asks first: "Event or task?", with what each one
 * is, so nobody has to guess which kind an "Add task" button makes. Then the form
 * for that kind: a task (a name, its class or area, when it's due, how long it
 * takes and how much it matters) goes onto the planner's list; an event (a name
 * and a time) takes that time on the calendar. The toggle above the form still
 * switches kinds without losing what's typed.
 */
export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<AddKind | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ss-backdrop" onMouseDown={onClose}>
      <section className="ss-modal" onMouseDown={(e) => e.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="add-task-title">
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">NEW</span>
            <h2 id="add-task-title">{kind === "event" ? "New event" : kind === "task" ? "New task" : "Event or task?"}</h2>
          </div>
          <button className="ss-icon-button" onClick={onClose} aria-label="Close">
            <SsIcon name="x" />
          </button>
        </div>
        {kind === null ? (
          <div className="ss-add-choice" role="group" aria-label="What do you want to add?">
            <button type="button" onClick={() => setKind("event")} data-autofocus autoFocus>
              <SsIcon name="calendar" />
              <span>
                <strong>Event</strong>
                <em>Something at a set time: a meeting, practice, dinner. It goes on your calendar.</em>
              </span>
            </button>
            <button type="button" onClick={() => setKind("task")}>
              <SsIcon name="list" />
              <span>
                <strong>Task</strong>
                <em>Work with a due date: homework, a reading, an errand. It goes on your to-do list to plan.</em>
              </span>
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <AddKindToggle kind={kind} onKind={setKind} />
            </div>
            {/* Switching keeps what's typed in the name. */}
            <AddItemForm kind={kind} onDone={onClose} />
          </>
        )}
      </section>
    </div>
  );
}
