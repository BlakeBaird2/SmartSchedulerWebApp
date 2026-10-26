"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { readEventLog, SMART_EVENT, type SmartEvent } from "./smartEvents";

/**
 * The smart events from this browser tab, newest first: what a tester actually did
 * (finished a task, added one, opened a free gap...). For pilot tests and facilitators.
 */
export function EventLog() {
  const [log, setLog] = useState<SmartEvent[]>(() => readEventLog());
  useEffect(() => {
    const refresh = () => setLog(readEventLog());
    window.addEventListener(SMART_EVENT, refresh);
    return () => window.removeEventListener(SMART_EVENT, refresh);
  }, []);
  if (log.length === 0) return <p className="text-sm text-muted">No events yet in this tab. Finish a task or add one and it shows up here.</p>;
  return (
    <ol className="max-h-56 overflow-y-auto scrollbar-thin space-y-1 text-xs font-mono">
      {log.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex gap-2">
          <span className="text-muted tabular-nums shrink-0">{format(new Date(e.at), "h:mm:ss a")}</span>
          <span className="font-semibold">{e.name.replace(/_/g, "-")}</span>
          {typeof e.detail.title === "string" ? <span className="truncate text-muted">{e.detail.title}</span> : null}
        </li>
      ))}
    </ol>
  );
}
