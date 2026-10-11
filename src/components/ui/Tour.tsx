"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export type TourStep = {
  title: string;
  body: string;
  /** A small wireframe drawing of the part of the app this step is about. */
  picture: React.ReactNode;
};

/**
 * A short walkthrough in a pop-up: one picture and a sentence or two per step.
 * It sits in the middle of the screen like every other dialog, so nothing has to
 * follow the page around, and it behaves like them too (Esc, the X, or a click
 * outside ends it).
 *
 * - always says where you are ("2 of 4"), with dots you can see at a glance
 * - Back and Next, plus the arrow keys
 * - "Skip" is always there; the last step's button says what happens next
 */
export function Tour({ steps, onClose, finishLabel = "Got it" }: { steps: TourStep[]; onClose: () => void; finishLabel?: string }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const actions = useRef<HTMLDivElement>(null);

  // Keep the keyboard on the main button as the steps change.
  useEffect(() => {
    actions.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [steps.length]);

  return (
    <Dialog title={step.title} onClose={onClose} size="md" blurBackground>
      <p className="-mt-2 mb-4 section-title" aria-live="polite">
        Step {index + 1} of {steps.length}
      </p>
      {/* Fixed height, so the dialog doesn't jump between steps. */}
      <div key={index} className="fade-in">
        <div className="h-56 border border-line-strong overflow-hidden">{step.picture}</div>
        <p className="mt-4 min-h-[5.25rem] text-[1.0625rem] leading-relaxed">{step.body}</p>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden>
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            tabIndex={-1}
            onClick={() => setIndex(i)}
            className={`h-2.5 w-2.5 border border-fg ${i === index ? "bg-fg" : "bg-surface"}`}
          />
        ))}
      </div>

      <div ref={actions} className="mt-4 pt-4 border-t border-line flex items-center gap-2">
        <Button variant="quiet" onClick={onClose}>
          Skip
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {index > 0 ? (
            <Button icon={ArrowLeft} onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          ) : null}
          {last ? (
            <Button variant="primary" icon={Check} onClick={onClose} data-autofocus>
              {finishLabel}
            </Button>
          ) : (
            <Button variant="primary" trailingIcon={ArrowRight} onClick={() => setIndex(index + 1)} data-autofocus>
              Next
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
