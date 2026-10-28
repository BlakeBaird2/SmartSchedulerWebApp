"use client";

import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ArrowRight, Bell, CalendarDays, Minus, Plus } from "lucide-react";
import { courseStyle, useApp } from "./context";
import { Button, Dialog, EmptyState } from "./ui";
import { KEYS, useStored, writeStored } from "./store";

/** How many changes arrived since the student last looked at them. */
export function useUnseenChanges(): number {
  const { changes } = useApp();
  const seenAt = Number(useStored(KEYS.seen) ?? 0) || 0;
  return useMemo(() => changes.slice(0, 25).filter((c) => Date.parse(c.at) > seenAt).length, [changes, seenAt]);
}

/**
 * Due dates that moved, and work added or removed, over the last 30 days. Opened
 * from the profile menu; opening it counts as having seen them.
 */
export function ChangesDialog({ onClose }: { onClose: () => void }) {
  const { changes: all, model, reveal, clearChanges } = useApp();
  useEffect(() => {
    writeStored(KEYS.seen, String(Date.now()));
  }, []);
  const changes = useMemo(() => all.slice(0, 25), [all]);
  const exists = useMemo(() => new Set(model.tasks.map((t) => t.id)), [model.tasks]);
  const setOpen = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog title="What changed" description="Due dates that moved, and work added or removed, over the last 30 days." onClose={onClose}>
      <div className="-mx-1">
          {changes.length > 0 ? (
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                onClick={() => {
                  clearChanges();
                  setOpen(false);
                }}
              >
                Clear all
              </Button>
            </div>
          ) : null}
          {changes.length === 0 ? (
            <EmptyState compact icon={Bell} title="No changes yet">
              Schedule Smart checks every time your calendars refresh, and lists due dates that move and work that is added or removed.
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
    </Dialog>
  );
}
