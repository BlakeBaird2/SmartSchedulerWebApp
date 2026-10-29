"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Course } from "@/lib/types";
import { plural } from "@/lib/ui";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";

/**
 * "Which classes are yours?" Canvas and Learning Suite give one link for every
 * course on the account, so a TA's courses, last term's and pages that aren't
 * classes all come in with it. The link can't be split; this list picks the
 * classes instead. Ones that look like they aren't the student's start unticked,
 * with the reason. Saving records a choice for every class listed, so a hint
 * never overrides it later; classes the calendar adds afterwards are asked about
 * again (see Notices).
 */
export function ClassPicker({ feedId, onClose }: { feedId: string | null; onClose: () => void }) {
  const { model, snapshot, now, update, toast } = useApp();
  const courses = useMemo(
    () => model.courses.filter((c) => (feedId ? c.feedId === feedId : true) && model.feedById.get(c.feedId)?.enabled),
    [model.courses, model.feedById, feedId],
  );
  // Only what the student changes here; the rest follows the class as it is. (The
  // picker can open in the same moment a calendar is added, before its classes arrive.)
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const isKept = (c: Course) => picked[c.id] ?? !c.hidden;
  const keptCount = courses.filter(isKept).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // What each class has on its calendar, read from the calendar itself, so classes left out still show it.
  const info = useMemo(() => {
    const out = new Map<string, { upcoming: number; next: Date | null }>();
    const t = now.getTime();
    for (const c of courses) {
      const key = c.id.slice(c.feedId.length + 1);
      const due = (snapshot.feeds[c.feedId]?.result?.tasks ?? []).filter((x) => x.courseKey === key).map((x) => Date.parse(x.dueAt));
      const ahead = due.filter((d) => d >= t).sort((a, b) => a - b);
      out.set(c.id, { upcoming: ahead.length, next: ahead.length ? new Date(ahead[0]) : null });
    }
    return out;
  }, [courses, snapshot.feeds, now]);

  const feeds = [...new Set(courses.map((c) => c.feedId))].map((id) => model.feedById.get(id)!);
  const source = feeds.length === 1 ? feeds[0].name : "your school calendars";
  const flagged = courses.filter((c) => c.hint);
  const setAll = (keep: boolean) => setPicked(Object.fromEntries(courses.map((c) => [c.id, keep])));

  const save = () => {
    update((w) => {
      const courseEdits = { ...w.courseEdits };
      for (const c of courses) courseEdits[c.id] = { ...courseEdits[c.id], hidden: !isKept(c) };
      return { ...w, courseEdits };
    });
    const left = courses.length - keptCount;
    toast(`Keeping ${plural(keptCount, "class", "classes")}${left ? `. Left out ${left}.` : "."}`);
    onClose();
  };

  return (
    <div className="ss-backdrop" onMouseDown={onClose}>
      <section className="ss-modal ss-class-picker" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="class-picker-title">
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">YOUR CLASSES</span>
            <h2 id="class-picker-title">Which classes are yours?</h2>
          </div>
          <button className="ss-icon-button" onClick={onClose} aria-label="Close">
            <SsIcon name="x" />
          </button>
        </div>
        <p className="ss-modal-lead">
          {source} shares one link for every course on your account, including ones you TA or took last term. Untick any that aren&apos;t yours: their
          work and class times leave your plan.
        </p>
        {flagged.length ? (
          <p className="ss-picker-auto">
            <SsIcon name="spark" size={14} />
            <span>
              {flagged.length === 1 ? "1 class looks" : `${flagged.length} classes look`} like {flagged.length === 1 ? "it isn't" : "they aren't"} yours, so{" "}
              {flagged.length === 1 ? "it starts" : "they start"} unticked.
            </span>
          </p>
        ) : null}

        <div className="ss-picker-tools">
          <span>
            {keptCount} of {courses.length} kept
          </span>
          <button type="button" onClick={() => setAll(true)}>
            Keep all
          </button>
          <button type="button" onClick={() => setAll(false)}>
            Untick all
          </button>
        </div>
        <ul className="ss-picker-list">
          {courses.map((c) => (
            <ClassRow key={c.id} course={c} kept={isKept(c)} info={info.get(c.id)!} onToggle={() => setPicked((p) => ({ ...p, [c.id]: !isKept(c) }))} />
          ))}
        </ul>

        <div className="ss-modal-actions">
          <button type="button" className="ss-quiet-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ss-primary" onClick={save} data-smart-event="classes_chosen">
            Save classes
          </button>
        </div>
      </section>
    </div>
  );
}

function ClassRow({ course: c, kept, info, onToggle }: { course: Course; kept: boolean; info: { upcoming: number; next: Date | null }; onToggle: () => void }) {
  const id = `pick-${c.id}`;
  return (
    <li className="ss-picker-row" data-off={!kept || undefined} style={{ "--c": c.color } as React.CSSProperties}>
      <button id={id} type="button" className="ss-check" role="checkbox" aria-checked={kept} onClick={onToggle} aria-label={`${kept ? "Leave out" : "Keep"} ${c.code}`}>
        <SsIcon name="check" size={14} />
      </button>
      <label htmlFor={id} className="min-w-0">
        <strong>
          <i className="ss-picker-dot" aria-hidden />
          {c.code}
          {c.title && c.title !== c.code ? <span> · {c.title}</span> : null}
        </strong>
        <small>{info.upcoming ? `${info.upcoming} due ahead · next ${format(info.next!, "EEE, MMM d")}` : "Nothing due ahead"}</small>
        {c.hint ? <em data-reason={c.hint.reason}>{c.hint.label}</em> : null}
      </label>
    </li>
  );
}
