"use client";

import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import type { Course, CourseEdit, Workspace } from "@/lib/types";
import { useApp } from "./context";
import { Button, Field } from "./ui";

/** The name a class had on its calendar, before any rename. */
export function useOriginalCourseName(course: Course): { code: string; title: string } | undefined {
  const { snapshot } = useApp();
  return snapshot.feeds[course.feedId]?.result?.courses.find((c) => `${course.feedId}:${c.key}` === course.id);
}

/**
 * Saves a class's names, keeping everything else the student set for it (colour,
 * hidden, corrected class times). A name that matches the calendar's own is not
 * stored, so a later fix on the calendar still comes through.
 */
export function withCourseNames(
  w: Workspace,
  courseId: string,
  names: { code: string; title: string },
  original?: { code: string; title: string },
): Workspace {
  const edit: CourseEdit = { ...w.courseEdits[courseId] };
  const code = names.code.trim().slice(0, 24);
  const title = names.title.trim().slice(0, 80);
  if (code && code !== original?.code) edit.code = code;
  else delete edit.code;
  if (title && title !== original?.title) edit.title = title;
  else delete edit.title;
  return { ...w, courseEdits: { ...w.courseEdits, [courseId]: edit } };
}

/**
 * Rename a class in place: its short name (shown everywhere, like "FIN 201") and
 * its full name. Calendars don't always name classes well, so this is offered
 * wherever a class is listed: right after a calendar is added, in Settings, in
 * class times and on the Classes board.
 */
export function ClassNameForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const { update, toast } = useApp();
  const original = useOriginalCourseName(course);
  const [code, setCode] = useState(course.code);
  const [title, setTitle] = useState(course.title);
  const renamed = Boolean(original && (course.code !== original.code || course.title !== original.title));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    update((w) => withCourseNames(w, course.id, { code, title }, original));
    toast(`Renamed to ${code.trim()}`);
    onDone();
  };

  const useCalendarName = () => {
    if (!original) return;
    update((w) => withCourseNames(w, course.id, original, original));
    toast(`Back to ${original.code}`);
    onDone();
  };

  return (
    <form
      onSubmit={save}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      className="mt-2 rounded-xl border border-line bg-surface-2/60 p-3 space-y-3"
      aria-label={`Rename ${course.code}`}
    >
      <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <Field label="Short name" hint="Shown everywhere, like FIN 201">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={24} autoFocus required />
        </Field>
        <Field label="Full name">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Principles of Finance" />
        </Field>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {renamed && original ? (
          <Button variant="quiet" size="sm" icon={RotateCcw} onClick={useCalendarName} title={`Go back to "${original.code}"`}>
            Use the calendar&apos;s name
          </Button>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={!code.trim()}>
            Save name
          </Button>
        </span>
      </div>
    </form>
  );
}

/** A small "Rename" action next to a class's name. */
export function RenameClassButton({ course, onClick }: { course: Course; onClick: () => void }) {
  return (
    <Button variant="quiet" size="sm" icon={Pencil} onClick={onClick} title={`Rename ${course.code}`} aria-label={`Rename ${course.code}`}>
      Rename
    </Button>
  );
}
