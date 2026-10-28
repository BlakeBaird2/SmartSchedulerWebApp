"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/ui";
import { useApp } from "./context";
import { ChangesDialog, useUnseenChanges } from "./ChangesDialog";
import { openGoalNotice } from "./Prototype";
import { resetEverything } from "./store";
import { SsIcon } from "./SsIcon";

/**
 * The bar across the top, as in the Figma prototype: the name on the left, the
 * two views in the middle, Add task and the profile on the right. Everything the
 * prototype has no room for (refreshing calendars, what changed, Settings, Help)
 * is in the profile menu.
 */
export function Topbar() {
  const { view, setView, openAddTask } = useApp();
  return (
    <header className="ss-topbar">
      <button className="ss-brand" onClick={() => setView("calendar")} aria-label="Schedule Smart, go to your calendar">
        <span>Schedule Smart</span>
      </button>
      <nav className="ss-nav" aria-label="Primary navigation">
        <button aria-current={view === "calendar" ? "page" : undefined} onClick={() => setView("calendar")}>
          <SsIcon name="calendar" />
          Calendar
        </button>
        <button aria-current={view === "tasks" ? "page" : undefined} onClick={() => setView("tasks")}>
          <SsIcon name="list" />
          Tasks
        </button>
      </nav>
      <div className="ss-actions">
        <button className="ss-add" onClick={openAddTask} data-smart-event="add_task_opened">
          <SsIcon name="plus" /> Add task
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const { ws, snapshot, now, syncing, sync, setView } = useApp();
  const [open, setOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const unseen = useUnseenChanges();
  const ref = useRef<HTMLDivElement>(null);
  const status = syncing ? "Refreshing…" : snapshot.at ? `Calendars refreshed ${timeAgo(snapshot.at, now)}` : "Calendars not read yet";

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

  const go = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="ss-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-label={unseen ? `Open profile, ${unseen} changes in your classes` : "Open profile"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {ws.demo ? "SS" : "ME"}
        {unseen > 0 ? <span className="ss-avatar-dot">{unseen > 9 ? "9+" : unseen}</span> : null}
      </button>
      {open ? (
        <div className="ss-menu" role="menu" aria-label="Profile">
          <div className="ss-menu-head">
            <strong>{ws.demo ? "Sample data" : "Your calendars"}</strong>
            <span aria-live="polite">{status}</span>
          </div>
          <button role="menuitem" onClick={() => void sync()} disabled={syncing}>
            <SsIcon name="refresh" size={16} /> {syncing ? "Refreshing…" : "Refresh calendars"}
          </button>
          <button role="menuitem" onClick={go(() => setChangesOpen(true))}>
            <SsIcon name="bell" size={16} /> What changed
            {unseen > 0 ? <span className="ss-menu-count">{unseen}</span> : null}
          </button>
          <hr />
          <button role="menuitem" onClick={go(() => setView("settings"))}>
            <SsIcon name="settings" size={16} /> Settings
          </button>
          <button role="menuitem" onClick={go(() => setView("help"))}>
            <SsIcon name="help" size={16} /> Help
          </button>
          <button role="menuitem" onClick={go(openGoalNotice)}>
            <SsIcon name="spark" size={16} /> Prototype goal
          </button>
          <Link role="menuitem" href="/about">
            <SsIcon name="home" size={16} /> Home page
          </Link>
          {ws.demo ? (
            <>
              <hr />
              <button role="menuitem" onClick={go(resetEverything)}>
                <SsIcon name="calendar" size={16} /> Use my own calendars
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {changesOpen ? <ChangesDialog onClose={() => setChangesOpen(false)} /> : null}
    </div>
  );
}

/** App-wide messages, one slim line each under the bar: sample data, or a calendar that couldn't be read. */
export function Notices() {
  const { ws, snapshot, setView } = useApp();
  const broken = ws.feeds.filter((f) => f.enabled && snapshot.feeds[f.id]?.error);
  return (
    <>
      {ws.demo ? (
        <div className="ss-notice" role="note">
          <SsIcon name="spark" size={14} />
          <span className="min-w-0 truncate">
            <strong>Sample data.</strong> Nothing here is real.
          </span>
          <span className="ss-notice-actions">
            <Link href="/">Home page</Link>
            <button onClick={resetEverything}>Use my own calendars</button>
          </span>
        </div>
      ) : null}
      {broken.length > 0 ? (
        <div className="ss-notice" data-tone="warning" role="alert">
          <span className="min-w-0 truncate">
            <strong>{broken.length === 1 ? `${broken[0].name} couldn't be read.` : `${broken.length} calendars couldn't be read.`}</strong>{" "}
            {broken.length === 1 ? snapshot.feeds[broken[0].id]?.error : "Their last good copies are still shown."}
          </span>
          <span className="ss-notice-actions">
            <button onClick={() => setView("settings")}>Check calendars</button>
          </span>
        </div>
      ) : null}
    </>
  );
}
