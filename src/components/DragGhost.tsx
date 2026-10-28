"use client";

import { createPortal } from "react-dom";
import { approxDuration } from "@/lib/ui";
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
    <div className="drag-ghost" style={{ left, top, "--u": drag.color } as React.CSSProperties} aria-hidden>
      <div className="text-[13px] font-semibold leading-snug truncate">{drag.title}</div>
      <div className="text-[11px] text-muted">{drag.target?.kind === "list" ? "Drop to take it off the calendar" : approxDuration(drag.minutes)}</div>
    </div>,
    document.body,
  );
}
