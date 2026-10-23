"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Eye, Pencil, Plus, RotateCcw } from "lucide-react";
import { COURSE_COLORS } from "@/lib/model";
import type { Course, CourseEdit } from "@/lib/types";
import { duration } from "@/lib/ui";
import { courseStyle, useApp, wireGray } from "./context";
import { Button, buttonClass, Dialog, DialogActions, Field, Switch, TextButton } from "./ui";
import { ClassTimesSummary, useClassTimes } from "./ClassTimes";
import { useOriginalCourseName, withCourseNames } from "./ClassName";

/**
 * One class at a glance, shown at the top of Upcoming when a class is picked:
 * its name, when it meets, how much is left and how much is done. Edit fixes the
 * name, colour or hides it. (This replaces the old Classes board: Upcoming filtered
 * to one class shows the same work, so one screen does both.)
 */
export function ClassSummary({ course }: { course: Course }) {
  const { model, now } = useApp();
  const [editing, setEditing] = useState(false);
  const feed = model.feedById.get(course.feedId);

  const stats = useMemo(() => {
    const all = model.tasks.filter((t) => t.courseId === course.id);
    const t = now.getTime();
    const left = all.filter((x) => !x.done && (!x.dueAt || Date.parse(x.dueAt) > t - 30 * 86_400_000));
    const done = all.filter((x) => x.done).length;
    return { left: left.length, done, total: all.length, minutes: left.reduce((sum, x) => sum + x.estimate, 0) };
  }, [model.tasks, course.id, now]);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section className="card p-4 sm:p-5 fade-in" style={courseStyle(course.color)} aria-label={`${course.code} summary`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="flex items-center gap-2 text-lg font-bold leading-tight">
            <span className="course-dot !w-2.5 !h-2.5" aria-hidden />
            <span className="course-text">{course.code}</span>
            {course.title !== course.code ? <span className="text-muted font-medium text-base truncate">{course.title}</span> : null}
          </h2>
          <div className="mt-1.5 text-sm">
            <MeetsLine course={course} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {course.url ? (
            <a href={course.url} target="_blank" rel="noreferrer" className={buttonClass({ variant: "quiet", size: "sm" })} title={`Open in ${feed?.name ?? "the class site"}`}>
              <ExternalLink size={13} aria-hidden />
              Open in {feed?.name ?? "class site"}
            </a>
          ) : null}
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)} title={`Rename, recolour or hide ${course.code}`}>
            Edit class
          </Button>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.code}: ${pct}% done`}>
        <div className="h-full course-bar rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center text-xs text-muted tabular-nums">
        <span>
          {stats.left} left{stats.minutes ? ` · about ${duration(stats.minutes)} of work` : ""}
        </span>
        <span className="ml-auto">
          {stats.done} of {stats.total} done
        </span>
      </div>
      {editing ? <ClassEditDialog course={course} onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

/** Classes the student hid, with a one-tap way to bring each back. */
export function HiddenClasses() {
  const { model, update } = useApp();
  const hidden = model.courses.filter((c) => c.hidden);
  if (hidden.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm text-muted">
      <span>Hidden classes:</span>
      {hidden.map((c) => (
        <button
          key={c.id}
          type="button"
          className="pill pill-course"
          aria-pressed={true}
          style={courseStyle(c.color)}
          title="Show this class again"
          onClick={() => update((w) => ({ ...w, courseEdits: { ...w.courseEdits, [c.id]: { ...w.courseEdits[c.id], hidden: undefined } } }))}
        >
          <span className="course-dot" />
          <span className="course-text">{c.code}</span>
          <Eye size={12} className="text-faint" aria-hidden />
          <span className="sr-only">Show again</span>
        </button>
      ))}
    </div>
  );
}

function MeetsLine({ course }: { course: Course }) {
  const { openClassTimes } = useApp();
  const { any } = useClassTimes(course);
  if (any) {
    return (
      <button type="button" onClick={openClassTimes} className="text-left hover:opacity-80" title="Change class times">
        <ClassTimesSummary course={course} />
      </button>
    );
  }
  return (
    <TextButton onClick={openClassTimes} className="inline-flex items-center gap-1 text-xs font-semibold">
      <Plus size={12} aria-hidden />
      Add class times
    </TextButton>
  );
}

export function ClassEditDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const original = useOriginalCourseName(course);
  return (
    <Dialog title={`Edit ${course.code}`} description="Fix its name if the calendar got it wrong, change its colour, or hide it from your plan." onClose={onClose} style={courseStyle(course.color)}>
      <CourseEditor course={course} original={original} onDone={onClose} />
    </Dialog>
  );
}

function CourseEditor({ course, original, onDone }: { course: Course; original?: { code: string; title: string }; onDone: () => void }) {
  const { update } = useApp();
  const [code, setCode] = useState(course.code);
  const [title, setTitle] = useState(course.title);
  const [color, setColor] = useState(course.color);
  const [hidden, setHidden] = useState(course.hidden);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    update((w) => {
      // Keep anything else set for this class (such as corrected class times).
      const named = withCourseNames(w, course.id, { code, title }, original);
      const edit: CourseEdit = { ...named.courseEdits[course.id], color };
      if (hidden) edit.hidden = true;
      else delete edit.hidden;
      return { ...named, courseEdits: { ...named.courseEdits, [course.id]: edit } };
    });
    onDone();
  };

  const reset = () => {
    update((w) => {
      // Back to the calendar's name and colour, shown again; corrected class times stay.
      const rest: CourseEdit = { ...w.courseEdits[course.id] };
      delete rest.code;
      delete rest.title;
      delete rest.color;
      delete rest.hidden;
      return { ...w, courseEdits: { ...w.courseEdits, [course.id]: rest } };
    });
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label="Short name">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={24} />
        </Field>
        <Field label="Full name">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Shade</legend>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Shade">
          {COURSE_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Shade ${i + 1}`}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border border-line-strong"
              style={{ background: wireGray(c) }}
            />
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2.5 text-sm">
        <Switch checked={hidden} onChange={setHidden} label="Hide this class" />
        Hide this class and leave its work out of the plan
      </label>
      <DialogActions
        aside={
          <Button variant="quiet" icon={RotateCcw} onClick={reset} title="Go back to the name and shade from the calendar">
            Reset
          </Button>
        }
      >
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </DialogActions>
    </form>
  );
}
