"use client";

import { useState } from "react";
import { CALENDAR_KINDS, type CalendarKindId, type LinkSteps } from "./calendarGuide";
import { wireGray } from "./context";

/** Where to find each calendar link, grouped by what the calendar is for. */
export function LinkGuide() {
  const [kind, setKind] = useState<CalendarKindId>("school");
  const current = CALENDAR_KINDS.find((k) => k.id === kind)!;

  return (
    <div>
      <div className="flex justify-center">
        <div className="seg" role="group" aria-label="What the calendar is for">
          {CALENDAR_KINDS.map((k) => (
            <button key={k.id} type="button" className="!px-4 !py-1.5 !text-sm" aria-pressed={k.id === kind} onClick={() => setKind(k.id)}>
              <span className="h-2 w-2 rounded-full" style={{ background: wireGray(k.color) }} />
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-5 text-center text-[0.9375rem] text-muted text-pretty" aria-live="polite">
        {current.does}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {current.cards.map((card) => (
          <GuideCard key={card.name} card={card} />
        ))}
      </div>
    </div>
  );
}

function GuideCard({ card }: { card: LinkSteps }) {
  return (
    <div className="card flex flex-col p-5">
      <h3 className="font-semibold">{card.name}</h3>
      <ol className="mt-3 space-y-2.5 text-sm leading-relaxed">
        {card.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[0.6875rem] font-semibold text-accent tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>
      {card.note ? (
        <div className="mt-auto pt-4">
          <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">{card.note}</p>
        </div>
      ) : null}
    </div>
  );
}
