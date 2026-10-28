"use client";

import { createPortal } from "react-dom";
import { usePlanDrag } from "./planDrag";

/**
 * What is being dragged, following the pointer while it is away from the calendar:
 * on its way out of the to-do list, or over the list to be taken off the calendar.
 * Over the calendar the block is drawn where it would land instead. On a touch
 * screen it floats above the finger, so the finger doesn't hide it.
 */
export function DragGhost() {
  const drag = usePlanDrag();
  if (!drag || drag.kind === "resize" || drag.target?.kind === "grid") return null;
  const left = drag.touch ? drag.x - 104 : drag.x + 14;
  const top = drag.touch ? drag.y - 84 : drag.y + 10;
  return createPortal(
    <div className="ss-ghost" style={{ left, top }} aria-hidden>
      <strong>{drag.title}</strong>
      <span>{drag.target?.kind === "list" ? "Drop to take it off the calendar" : drag.target?.kind === "date" ? "Drop to put it in that day's free time" : `${drag.minutes} min`}</span>
    </div>,
    document.body,
  );
}
