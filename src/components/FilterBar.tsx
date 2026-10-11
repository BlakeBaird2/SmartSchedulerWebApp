"use client";

import { useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { courseStyle, useApp } from "./context";

/** Pick which classes to show, and whether finished work is shown. */
export function FilterBar() {
  const { model, filters, setFilters, now } = useApp();
  const courses = model.visibleCourses;

  const remaining = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of model.tasks) {
      if (t.done || !t.courseId || !t.dueAt || Date.parse(t.dueAt) < now.getTime()) continue;
      m.set(t.courseId, (m.get(t.courseId) ?? 0) + 1);
    }
    return m;
  }, [model.tasks, now]);

  const toggleCourse = (id: string) =>
    setFilters((f) => {
      if (f.courses === null) return { ...f, courses: [id] };
      const next = f.courses.includes(id) ? f.courses.filter((x) => x !== id) : [...f.courses, id];
      return { ...f, courses: next.length === 0 || next.length === courses.length ? null : next };
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
      {courses.length > 1 ? <span className="text-sm text-muted mr-1">Show:</span> : null}
      {courses.length > 1 ? (
        <>
          <button type="button" className="pill" aria-pressed={filters.courses === null} onClick={() => setFilters((f) => ({ ...f, courses: null }))}>
            All classes
          </button>
          {courses.map((c) => {
            const on = filters.courses === null || filters.courses.includes(c.id);
            const n = remaining.get(c.id) ?? 0;
            return (
              <button key={c.id} type="button" className="pill pill-course" style={courseStyle(c.color)} aria-pressed={on} onClick={() => toggleCourse(c.id)} title={c.title}>
                <span className="course-dot" />
                <span className="course-text">{c.code}</span>
                {n > 0 ? <span className="text-[11px] text-muted tabular-nums">{n}</span> : null}
              </button>
            );
          })}
        </>
      ) : null}
      {/* A plain on/off: pressed means finished work is shown. */}
      <button
        type="button"
        className="pill ml-auto"
        aria-pressed={filters.showCompleted}
        onClick={() => setFilters((f) => ({ ...f, showCompleted: !f.showCompleted }))}
      >
        {filters.showCompleted ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
        Show finished work
      </button>
    </div>
  );
}
