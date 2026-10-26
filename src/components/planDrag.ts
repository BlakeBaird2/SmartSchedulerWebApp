"use client";

import { useSyncExternalStore } from "react";

/**
 * Dragging work onto the calendar to plan it (Sunsama and Akiflow's main gesture).
 *
 * Browsers only reveal what is being dragged when it is dropped, but the calendar
 * needs to know sooner: to draw a preview of the block at the right height while
 * it moves, and to show where a planned block can be handed back. So the drag is
 * also kept here, where any part of the calendar can read it.
 */
export interface PlanDrag {
  taskId: string;
  title: string;
  /** How long the block will be. */
  minutes: number;
  /** Minutes between the top of the block and where it was grabbed, so it doesn't jump. */
  grab: number;
  /** Whether it is already at a time the student picked (and so can be handed back). */
  pinned: boolean;
  color: string | null;
}

export const PLAN_DRAG_TYPE = "application/x-smartscheduler-task";

let current: PlanDrag | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startPlanDrag(e: React.DragEvent, drag: PlanDrag): void {
  e.dataTransfer.setData(PLAN_DRAG_TYPE, drag.taskId);
  e.dataTransfer.setData("text/plain", drag.title);
  e.dataTransfer.effectAllowed = "move";
  // Let the browser take its drag picture before the original fades.
  requestAnimationFrame(() => {
    current = drag;
    emit();
  });
}

export function endPlanDrag(): void {
  if (!current) return;
  current = null;
  emit();
}

export function usePlanDrag(): PlanDrag | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
