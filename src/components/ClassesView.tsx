"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Eye, GraduationCap, Pencil, Plus, RotateCcw } from "lucide-react";
import { COURSE_COLORS } from "@/lib/model";
import type { Course, CourseEdit, Task } from "@/lib/types";
import { duration, relativeDue, typeIconClass, typeMeta, whenLabel } from "@/lib/ui";
import { courseStyle, useApp, wireGray } from "./context";
import { AppTaskCard } from "./TaskRow";
import { Button, buttonClass, Dialog, DialogActions, EmptyState, Field, Switch, TextButton } from "./ui";
import { ClassTimesSummary, useClassTimes } from "./ClassTimes";

/**
 * Every class side by side, one column each, like the days of the week view:
 * the class at the top, then its work in the order it's due.
 */
export function ClassesView() {
  const { model, update, setSettingsPanel } = useApp();
  const [editing, setEditing] = useState<Course | null>(null);
  const visible = model.visibleCourses;
  const hidden = model.courses.filter((c) => c.hidden);

  if (model.courses.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No classes yet"
        action={
          <Button variant="primary" onClick={() => setSettingsPanel("calendars")}>
            Add a school calendar
          </Button>
        }
      >
        Classes appear on their own once you add a school calendar.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {visible.length > 0 ? (
        <div className="card overflow-x-auto scrollbar-thin snap-x snap-mandatory">
          <div className="grid divide-x divide-line" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(13.5rem, 1fr))` }}>
            {visible.map((c) => (
              <ClassColumn key={c.id} course={c} onEdit={() => setEditing(c)} />
            ))}
          </div>
        </div>
      ) : null}

      {hidden.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted">
          <span>Hidden:</span>
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
              <Eye size={12} className="text-faint" />
            </button>
          ))}
        </div>
      ) : null}

      {editing ? <ClassEditDialog course={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

const PAGE = 8;

function ClassColumn({ course, onEdit }: { course: Course; onEdit: () => void }) {
  const { model, now } = useApp();
  const [expanded, setExpanded] = useState(false);
  const feed = model.feedById.get(course.feedId);

  const stats = useMemo(() => {
    const all = model.tasks.filter((t) => t.courseId === course.id);
    const t = now.getTime();
    // Late work from the last month first, then everything still to come.
    const late = all.filter((x) => !x.done && x.dueAt && Date.parse(x.dueAt) < t && Date.parse(x.dueAt) > t - 30 * 86_400_000);
    const ahead = all.filter((x) => !x.done && (!x.dueAt || Date.parse(x.dueAt) >= t));
    const done = all.filter((x) => x.done).length;
    const left = [...late, ...ahead];
    return { left, done, total: all.length, minutes: left.reduce((sum, x) => sum + x.estimate, 0) };
  }, [model.tasks, course.id, now]);

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const shown = expanded ? stats.left : stats.left.slice(0, PAGE);

  return (
    <section className="min-w-0 flex flex-col snap-start" style={courseStyle(course.color)}>
      <header className="px-3 pt-3 pb-2.5 border-b border-line bg-surface-2/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="course-dot" />
          <h2 className="course-text font-semibold text-[0.9375rem] truncate" title={course.title}>
            {course.code}
          </h2>
          <div className="ml-auto flex items-center shrink-0">
            {course.url ? (
              <a href={course.url} target="_blank" rel="noreferrer" className={buttonClass({ variant: "quiet", iconOnly: true })} title={`Open in ${feed?.name ?? "the class site"}`} aria-label={`Open ${course.code}`}>
                <ExternalLink size={14} />
              </a>
            ) : null}
            <Button variant="quiet" iconOnly icon={Pencil} label={`Edit ${course.code}: rename, recolour or hide`} onClick={onEdit} />
          </div>
        </div>
        <p className="text-xs text-muted truncate" title={course.title}>
          {course.title !== course.code ? course.title : `from ${feed?.name ?? "a calendar"}`}
        </p>
        {/* Room for two lines, so every column's work starts at the same height. */}
        <div className="mt-1.5 min-h-[2.125rem]">
          <MeetsLine course={course} />
        </div>
        <div className="mt-2.5 h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.code}: ${pct}% done`}>
          <div className="h-full course-bar rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center text-[11px] text-muted tabular-nums">
          <span>
            {stats.left.length} left{stats.minutes ? ` · about ${duration(stats.minutes)}` : ""}
          </span>
          <span className="ml-auto">
            {stats.done}/{stats.total} done
          </span>
        </div>
      </header>

      <ul className="p-2 space-y-1.5 flex-1">
        {shown.map((t) => (
          <ClassItem key={t.id} task={t} />
        ))}
        {stats.left.length === 0 ? <li className="px-1 py-3 text-xs text-muted text-center">All caught up</li> : null}
      </ul>
      {stats.left.length > PAGE ? (
        <Button variant="quiet" size="sm" className="mx-2 mb-2 justify-center" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show ${stats.left.length - PAGE} more`}
        </Button>
      ) : null}
    </section>
  );
}

function ClassItem({ task }: { task: Task }) {
  const { now } = useApp();
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const late = due ? due.getTime() < now.getTime() : false;
  const meta = typeMeta(task.type);
  return (
    <li>
      <AppTaskCard
        task={task}
        density="compact"
        meta={
          <>
            {meta.loud ? <meta.icon size={11} className={typeIconClass(task.type)} strokeWidth={2.5} aria-label={meta.label} /> : null}
            <span className={late ? "text-danger font-semibold" : ""}>{due ? (late ? relativeDue(due, now) : whenLabel(due, now, !task.allDay)) : "No due date"}</span>
          </>
        }
      />
    </li>
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

function ClassEditDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const { snapshot } = useApp();
  const original = snapshot.feeds[course.feedId]?.result?.courses.find((c) => `${course.feedId}:${c.key}` === course.id);
  return (
    <Dialog title={`Edit ${course.code}`} description="Rename it, change its shade, or hide it from your plan." onClose={onClose} style={courseStyle(course.color)}>
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
    const edit: CourseEdit = {};
    if (code.trim() && code.trim() !== original?.code) edit.code = code.trim().slice(0, 24);
    if (title.trim() && title.trim() !== original?.title) edit.title = title.trim().slice(0, 80);
    edit.color = color;
    if (hidden) edit.hidden = true;
    update((w) => ({ ...w, courseEdits: { ...w.courseEdits, [course.id]: edit } }));
    onDone();
  };

  const reset = () => {
    update((w) => {
      const courseEdits = { ...w.courseEdits };
      delete courseEdits[course.id];
      return { ...w, courseEdits };
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
