"use client";

import { useEffect, useState } from "react";
import { AddItemForm, AddKindToggle, type AddKind } from "./AddItem";
import { SsIcon } from "./SsIcon";

/**
 * The Add button's pop-up, as in the Figma prototype: add a task (a name, its
 * class or area, when it's due, how long it takes and how much it matters),
 * which goes straight onto the planner's list, or an event (a name and a time),
 * which takes that time on the calendar.
 */
export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<AddKind>("task");

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
            <span className="ss-eyebrow">NEW ITEM</span>
            <h2 id="add-task-title">{kind === "event" ? "Add an event" : "Add a task"}</h2>
          </div>
          <button className="ss-icon-button" onClick={onClose} aria-label="Close">
            <SsIcon name="x" />
          </button>
        </div>
        <div className="mt-5">
          <AddKindToggle kind={kind} onKind={setKind} />
        </div>
        {/* Switching keeps what's typed in the name. */}
        <AddItemForm kind={kind} onDone={onClose} />
      </section>
    </div>
  );
}
