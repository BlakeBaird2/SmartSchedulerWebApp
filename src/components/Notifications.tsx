"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Bell, CalendarDays, Minus, Plus } from "lucide-react";
import type { Change } from "@/lib/types";
import { courseStyle, useApp } from "./context";
import { KEYS, parseJson, readStored, useStored, writeStored } from "./store";
import { SsIcon } from "./SsIcon";

/*
 * Notifications: due dates that moved, and work added to or removed from a class
 * calendar. A bell left of the profile picture shows how many are new; opening it
 * lists them. Clear all hides everything listed for good: the app remembers when
 * and what was cleared, so a calendar refresh that notices the same change again
 * doesn't bring it back, while anything new still shows up.
 */

/** Cleared notifications: everything noticed before `at`, and these exact changes whenever they're noticed again. */
interface Cleared {
  at: number;
  keys: string[];
}

/** How many cleared changes are remembered (the oldest are forgotten first). */
const MAX_CLEARED = 1000;

/** The change itself (what, which work, from and to), so the same change noticed again is recognised. */
function changeKey(c: Change): string {
  return `${c.kind}:${c.taskId}:${c.from ?? ""}:${c.to ?? ""}`;
}

function readCleared(raw: string | null): Cleared {
  const v = parseJson<Partial<Cleared>>(raw);
  return {
    at: typeof v?.at === "number" && Number.isFinite(v.at) ? v.at : 0,
    keys: Array.isArray(v?.keys) ? v.keys.filter((k): k is string => typeof k === "string") : [],
  };
}

/** The notifications still showing, newest first, and how many arrived since the list was last opened. */
export function useNotifications(): { items: Change[]; unseen: number } {
  const { changes } = useApp();
  const seenAt = Number(useStored(KEYS.seen) ?? 0) || 0;
  const clearedRaw = useStored(KEYS.changesCleared);
  return useMemo(() => {
    const cleared = readCleared(clearedRaw);
    const gone = new Set(cleared.keys);
    const items = changes.filter((c) => Date.parse(c.at) > cleared.at && !gone.has(changeKey(c)));
    return { items, unseen: items.filter((c) => Date.parse(c.at) > seenAt).length };
  }, [changes, clearedRaw, seenAt]);
}

/** Clear these notifications for good. */
function clearNotifications(items: Change[]) {
  const before = readCleared(readStored(KEYS.changesCleared));
  const keys = [...new Set([...before.keys, ...items.map(changeKey)])].slice(-MAX_CLEARED);
  const now = Date.now();
  writeStored(KEYS.changesCleared, JSON.stringify({ at: now, keys }));
  writeStored(KEYS.seen, String(now));
}

/** The bell in the top bar, with its count, and the list it opens. */
export function NotificationsButton() {
  const { model, reveal } = useApp();
  const { items, unseen } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const exists = useMemo(() => new Set(model.tasks.map((t) => t.id)), [model.tasks]);

  // Opening the list counts as having seen what's in it.
  useEffect(() => {
    if (open) writeStored(KEYS.seen, String(Date.now()));
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ss-notif" ref={ref}>
      <button
        type="button"
        className="ss-notif-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <SsIcon name="bell" size={20} />
        {unseen > 0 ? <span className="ss-notif-count">{unseen > 9 ? "9+" : unseen}</span> : null}
      </button>
      {open ? (
        <section className="ss-notif-panel" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            {items.length > 0 ? (
              <button
                type="button"
                className="ss-notif-clear"
                onClick={() => {
                  clearNotifications(items);
                  setOpen(false);
                }}
              >
                Clear all
              </button>
            ) : null}
          </header>
          {items.length === 0 ? (
            <div className="ss-notif-empty">
              <Bell size={22} aria-hidden />
              <strong>You&apos;re all caught up</strong>
              <p>When a due date moves, or work is added to or removed from a class calendar, it shows up here.</p>
            </div>
          ) : (
            <ul>
              {items.map((c) => {
                const course = c.courseId ? model.courseById.get(c.courseId) : undefined;
                const live = exists.has(c.taskId);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={live ? "" : "ss-notif-gone"}
                      style={courseStyle(course?.color)}
                      onClick={() => {
                        setOpen(false);
                        if (live) reveal(c.taskId);
                      }}
                      // Removed work has nowhere to open, so it is not a link.
                      disabled={!live}
                    >
                      <span className="ss-notif-meta">
                        <span className="course-dot" />
                        <span className="course-text">{course?.code ?? "Class"}</span>
                        <span className="ss-notif-date">{format(new Date(c.at), "MMM d")}</span>
                      </span>
                      <span className="ss-notif-title">
                        <span>{c.title}</span>
                        {live ? <CalendarDays size={12} aria-label="Opens on the calendar" /> : null}
                      </span>
                      <span className="ss-notif-what">
                        {c.kind === "due_changed" ? (
                          <>
                            <span className="ss-notif-was">{c.from ? format(new Date(c.from), "MMM d, h:mm a") : "no date"}</span>
                            <ArrowRight size={11} aria-label="moved to" />
                            <b>{c.to ? format(new Date(c.to), "MMM d, h:mm a") : "no date"}</b>
                          </>
                        ) : c.kind === "added" ? (
                          <>
                            <Plus size={11} aria-hidden />
                            New{c.to ? ` · due ${format(new Date(c.to), "MMM d")}` : ""}
                          </>
                        ) : (
                          <>
                            <Minus size={11} aria-hidden />
                            Removed
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
