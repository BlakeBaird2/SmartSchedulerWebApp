"use client";

import { useEffect, useMemo, useRef } from "react";
import { courseStyle, useApp } from "./context";
import { Switch } from "./ui";
import { trackEvent } from "./smartEvents";

/**
 * Which class to show: "All classes" or exactly one, picked like a tab. One choice at
 * a time is easier to read than toggling classes on and off, and the count on each
 * tab says how much is left before you even tap it. "Show finished" is a separate
 * on/off switch, so it never looks like a class.
 */
export function FilterBar() {
  const { model, filters, setFilters, now } = useApp();
  const courses = model.visibleCourses;

  const left = useMemo(() => {
    const m = new Map<string, number>();
    let all = 0;
    for (const t of model.tasks) {
      // Work still to do: anything not done that's due ahead, or late within the last month.
      if (t.done || (t.dueAt && Date.parse(t.dueAt) < now.getTime() - 30 * 86_400_000)) continue;
      all++;
      if (t.courseId) m.set(t.courseId, (m.get(t.courseId) ?? 0) + 1);
    }
    return { all, byCourse: m };
  }, [model.tasks, now]);

  const active = filters.courses && filters.courses.length === 1 ? filters.courses[0] : null;

  // On phones the tabs scroll sideways; keep the chosen one in view.
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    const box = row.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);
  const pick = (id: string | null) => {
    trackEvent("class_filtered", { courseId: id, code: id ? (model.courseById.get(id)?.code ?? null) : "All classes" });
    setFilters((f) => ({ ...f, courses: id ? [id] : null }));
  };

  return (
    <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
      {/* Phones: one row that scrolls sideways, edge to edge. */}
      <div
        ref={row}
        role="radiogroup"
        aria-label="Show work for"
        className="relative flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-none -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible min-w-0 basis-full md:basis-0 flex-1"
      >
        <button type="button" role="radio" aria-checked={active === null} className="class-tab" onClick={() => pick(null)}>
          All classes
          <span className="class-tab-count">{left.all}</span>
        </button>
        {courses.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active === c.id}
            className="class-tab"
            style={courseStyle(c.color)}
            onClick={() => pick(active === c.id ? null : c.id)}
            title={c.title}
          >
            <span className="course-dot" aria-hidden />
            <span className="course-text">{c.code}</span>
            <span className="class-tab-count">{left.byCourse.get(c.id) ?? 0}</span>
          </button>
        ))}
      </div>
      <label className="ml-auto flex items-center gap-2 text-sm text-muted shrink-0 cursor-pointer">
        <Switch checked={filters.showCompleted} onChange={(v) => setFilters((f) => ({ ...f, showCompleted: v }))} label="Show finished work" />
        Show finished
      </label>
    </div>
  );
}
