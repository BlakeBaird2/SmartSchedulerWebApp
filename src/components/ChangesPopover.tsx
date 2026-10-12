"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Bell, CalendarDays, Minus, Plus } from "lucide-react";
import { courseStyle, useApp } from "./context";
import { Button, EmptyState } from "./ui";
import { KEYS, useStored, writeStored } from "./store";

export function ChangesPopover() {
  const { changes: all, model, reveal, clearChanges } = useApp();
  const [open, setOpen] = useState(false);
  const rawSeen = useStored(KEYS.seen);
  const seenAt = Number(rawSeen ?? 0) || 0;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const changes = useMemo(() => all.slice(0, 25), [all]);
  const exists = useMemo(() => new Set(model.tasks.map((t) => t.id)), [model.tasks]);
  const unseen = changes.filter((c) => Date.parse(c.at) > seenAt).length;

  const toggle = () => {
    if (!open) writeStored(KEYS.seen, String(Date.now()));
    setOpen((o) => !o);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        icon={Bell}
        className="relative"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unseen > 0 ? `Alerts: ${unseen} new changes in your classes` : "Alerts: changes in your classes"}
        title="Changes in your classes"
      >
        <span className="hidden 2xl:inline">Alerts</span>
        {unseen > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center tabular-nums" aria-hidden>
            {unseen > 9 ? "9+" : unseen}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="card fixed sm:absolute right-4 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto scrollbar-thin z-50 fade-in">
          <div className="px-3.5 py-2.5 border-b border-line flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold">Alerts</div>
              <div className="text-xs text-muted mt-0.5">Due dates that moved, and work added or removed, over the last 30 days.</div>
            </div>
            {changes.length > 0 ? (
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => {
                  clearChanges();
                  setOpen(false);
                }}
              >
                Clear all
              </Button>
            ) : null}
          </div>
          {changes.length === 0 ? (
            <EmptyState compact icon={Bell} title="No changes yet">
              SmartScheduler checks every time your calendars refresh, and lists due dates that move and work that is added or removed.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {changes.map((c) => {
                const course = c.courseId ? model.courseById.get(c.courseId) : undefined;
                const live = exists.has(c.taskId);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-3.5 py-2.5 transition ${live ? "hover:bg-surface-2 cursor-pointer" : "cursor-default"}`}
                      style={courseStyle(course?.color)}
                      onClick={() => {
                        setOpen(false);
                        if (live) reveal(c.taskId);
                      }}
                      // Removed work has nowhere to open, so it is not a link.
                      disabled={!live}
                    >
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="course-dot" />
                        <span className="course-text font-medium">{course?.code ?? "Class"}</span>
                        <span className="ml-auto text-faint tabular-nums">{format(new Date(c.at), "MMM d")}</span>
                      </div>
                      <div className="text-sm font-medium mt-0.5 leading-snug flex items-center gap-1.5">
                        <span className="min-w-0 truncate">{c.title}</span>
                        {live ? <CalendarDays size={12} className="text-faint shrink-0" aria-label="Opens on the calendar" /> : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted flex-wrap">
                        {c.kind === "due_changed" ? (
                          <>
                            <span className="line-through text-faint">{c.from ? format(new Date(c.from), "MMM d, h:mm a") : "no date"}</span>
                            <ArrowRight size={11} />
                            <span className="font-medium text-fg">{c.to ? format(new Date(c.to), "MMM d, h:mm a") : "no date"}</span>
                          </>
                        ) : c.kind === "added" ? (
                          <>
                            <Plus size={11} />
                            New {c.to ? `· due ${format(new Date(c.to), "MMM d")}` : ""}
                          </>
                        ) : (
                          <>
                            <Minus size={11} />
                            Removed
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
