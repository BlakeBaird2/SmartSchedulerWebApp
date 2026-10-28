"use client";

import { useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { clock } from "@/lib/ui";
import { slotRect, targetStart, usePlanDrag } from "./planDrag";

/**
 * What is being dragged. It starts out the size of what was picked up (a planner
 * card, or a block on the calendar) and follows the pointer, held where it was
 * grabbed. Over the calendar it glides into the slot it would drop into and takes
 * the block's real size there, so letting go just leaves it in place. On a touch
 * screen it floats above the finger, so the finger doesn't hide it.
 */
export function DragGhost() {
  const drag = usePlanDrag();
  // Scrolling the hours by hand moves the slot under the ghost.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const dragging = Boolean(drag);
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("scroll", rerender, true);
    return () => window.removeEventListener("scroll", rerender, true);
  }, [dragging]);

  if (!drag || drag.kind === "resize") return null;
  const target = drag.target;
  const slot = target?.kind === "grid" ? slotRect(target) : null;

  let style: React.CSSProperties;
  let note: string;
  if (slot && target?.kind === "grid") {
    const start = targetStart(target);
    style = {
      left: slot.left,
      top: slot.top,
      width: slot.width,
      height: slot.height,
      clipPath: slot.clipTop || slot.clipBottom ? `inset(${slot.clipTop}px 0 ${slot.clipBottom}px 0 round 7px)` : undefined,
    };
    // A short block has room for its start beside the title, as on the calendar.
    note = slot.height < 40 ? clock(start) : `${clock(start)} – ${clock(new Date(start.getTime() + drag.minutes * 60_000))}`;
  } else {
    const src = drag.source ?? { width: 228, height: 52, grabX: -14, grabY: -10 };
    style = drag.touch
      ? { left: drag.x - src.width / 2, top: drag.y - src.height - 16, width: src.width, height: src.height }
      : { left: drag.x - src.grabX, top: drag.y - src.grabY, width: src.width, height: src.height };
    note = target?.kind === "list" ? "Drop to take it off the calendar" : target?.kind === "date" ? "Drop to put it in that day's free time" : `${drag.minutes} min`;
  }

  return createPortal(
    <div className="ss-ghost" style={style} data-slot={slot ? true : undefined} data-compact={(slot && slot.height < 40) || undefined} aria-hidden>
      <strong>{drag.title}</strong>
      <span>{note}</span>
    </div>,
    document.body,
  );
}
