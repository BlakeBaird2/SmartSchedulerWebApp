"use client";

import { useEffect, useRef, useState } from "react";
import { AddItemForm, AddKindToggle, type AddKind } from "./AddItem";
import { SsIcon } from "./SsIcon";

/**
 * New event or task: a right-side panel (bottom sheet on phones) so the calendar
 * stays visible behind a light dim while the student fills in the form. Same
 * fields and behaviour as before; Esc, the X, and clicking the dim close it.
 */
export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<AddKind | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first =
      panel.current?.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ??
      panel.current?.querySelector<HTMLElement>("button, input, select, textarea");
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const title = kind === "event" ? "New event" : kind === "task" ? "New task" : "Event or task?";

  return (
    <div className="ss-backdrop ss-backdrop-side" onMouseDown={onClose}>
      <section
        ref={panel}
        className="ss-modal ss-modal-side"
        onMouseDown={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="add-task-title"
        tabIndex={-1}
      >
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">NEW</span>
            <h2 id="add-task-title">{title}</h2>
            <p className="ss-modal-side-hint">Your calendar stays in view so you can check what&apos;s already planned.</p>
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
