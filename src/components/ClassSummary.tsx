"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { COURSE_COLORS } from "@/lib/model";
import type { Course, CourseEdit } from "@/lib/types";
import { useApp } from "./context";
import { Button, ColorSwatches, DialogActions, Field, Switch } from "./ui";
import { useOriginalCourseName, withCourseNames } from "./ClassName";

/** The class editor on its own, for places that already have a panel to put it in. */
export function ClassEditForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const original = useOriginalCourseName(course);
  return <CourseEditor course={course} original={original} onDone={onDone} />;
}

const SHADES = COURSE_COLORS.map((hex, i) => ({ hex, name: `Shade ${i + 1}` }));

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
      // Saying either way is a decision, so a hint never overrides it.
      edit.hidden = hidden;
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
        <div className="mt-1.5">
          <ColorSwatches colors={SHADES} value={color} onChange={setColor} label="Shade" />
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
