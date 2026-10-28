"use client";

import { createPortal } from "react-dom";
import { blockHeight, useCalendarScale, usePlanDrag } from "./planDrag";

/**
 * What is being dragged, following the pointer while it is away from the calendar:
 * on its way out of the planner, or over the planner to be taken off the calendar.
 * It is drawn as the block it will become, as tall as on the calendar and as wide
 * as what was picked up, held where it was grabbed. Over the calendar the block is
 * drawn where it would land instead. On a touch screen it floats above the finger,
 * so the finger doesn't hide it.
 */
export function DragGhost() {
  const drag = usePlanDrag();
  const ppm = useCalendarScale();
  if (!drag || drag.kind === "resize" || drag.target?.kind === "grid") return null;
  const width = drag.width ?? 228;
  const height = blockHeight(drag.minutes, ppm);
  const left = drag.touch ? drag.x - width / 2 : drag.x - (drag.grabX ?? -14);
  // The same offset the drop uses, so the block lands where the ghost was.
  const top = drag.y - drag.grab * ppm;
  const note = drag.target?.kind === "list" ? "Drop to take it off the calendar" : drag.target?.kind === "date" ? "Drop to put it in that day's free time" : `${drag.minutes} min`;
  return createPortal(
    <div className="ss-ghost" style={{ left, top, width, height }} data-compact={height < 40 || undefined} aria-hidden>
      <strong>{drag.title}</strong>
      <span>{note}</span>
    </div>,
    document.body,
  );
}
