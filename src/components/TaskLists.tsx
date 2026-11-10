"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { LIST_WINDOWS, inAreas, inDays, type ListShow, type TaskListConfig } from "@/lib/taskLists";
import { windowEnd } from "@/lib/todos";
import type { Task } from "@/lib/types";
import { plural } from "@/lib/ui";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";
import { ClassFilter, TaskLine, groupRows, useAreas, type Row } from "./TasksPage";

/*
 * Split view on Tasks: up to four lists side by side, each with its own name,
 * classes and days. Say School for the next 7 days beside Life's plan for the
 * week. Search and Done, in the bar above, apply to every list.
 */

const SHOWS: { id: ListShow; label: string }[] = [
  { id: "planned", label: "Planned" },
  { id: "unplanned", label: "Not planned" },
  { id: "all", label: "All" },
];

function daysLabel(days: number | null): string {
  return days === null ? "Any time" : `${days} days`;
}

export function SplitLists({
  rows,
  doneAt,
  search,
  showDone,
  onTick,
  focus,
}: {
  rows: Row[];
  doneAt: (t: Task) => number | null;
  /** What's typed in the search, lower case. */
  search: string;
  showDone: boolean;
  onTick: (t: Task) => void;
  /** A list just added, whose name gets the cursor. */
  focus: string | null;
}) {
  const { taskLists, setTaskLists } = useApp();
  const change = (id: string, patch: Partial<TaskListConfig>) => setTaskLists(taskLists.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setTaskLists(taskLists.filter((l) => l.id !== id));

  return (
    <div className="ss-lists" style={{ "--lists": taskLists.length } as React.CSSProperties}>
      {taskLists.map((list) => (
        <ListColumn
          key={list.id}
          list={list}
          rows={rows}
          doneAt={doneAt}
          search={search}
          showDone={showDone}
          onTick={onTick}
          autoFocus={focus === list.id}
          onChange={(patch) => change(list.id, patch)}
          onRemove={taskLists.length > 1 ? () => remove(list.id) : undefined}
        />
      ))}
    </div>
  );
}

function ListColumn({
  list,
  rows,
  doneAt,
  search,
  showDone,
  onTick,
  autoFocus,
  onChange,
  onRemove,
}: {
  list: TaskListConfig;
  rows: Row[];
  doneAt: (t: Task) => number | null;
  search: string;
  showDone: boolean;
  onTick: (t: Task) => void;
  autoFocus: boolean;
  onChange: (patch: Partial<TaskListConfig>) => void;
  onRemove?: () => void;
}) {
  const { model, now, select } = useApp();
  const areas = useAreas();
  const nameBox = useRef<HTMLInputElement>(null);
  // What's typed while the name is emptied out; the saved name otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? list.name;
  useEffect(() => {
    if (!autoFocus) return;
    nameBox.current?.focus();
    nameBox.current?.select();
    nameBox.current?.closest(".ss-list")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [autoFocus]);

  const code = (t: Task) => (t.courseId ? model.courseById.get(t.courseId)?.code : undefined);
  const shown = rows.filter(({ task, block }) => {
    if (list.show === "planned" && !block) return false;
    if (list.show === "unplanned" && block) return false;
    if (!inAreas(list.areas, task)) return false;
    // Planned work counts by when it's planned; the rest by when it's due.
    if (!inDays(block && !task.done ? block.start : task.dueAt, now, list.days)) return false;
    if (search && !`${task.title} ${code(task) ?? "Personal"}`.toLowerCase().includes(search)) return false;
    return true;
  });
  const open = shown.filter((r) => !r.task.done);
  const done = shown.filter((r) => r.task.done).sort((a, b) => (doneAt(b.task) ?? 0) - (doneAt(a.task) ?? 0));
  const groups = groupRows(open, list.show, now);

  // The list's colour: its one class's, Personal's, or the app's.
  const only = list.areas?.length === 1 ? list.areas[0] : null;
  const color = only === "personal" ? "var(--ss-personal)" : only && only !== "school" ? (model.courseById.get(only)?.color ?? null) : null;
  const lastDay = list.days === null ? null : addDays(windowEnd(now, list.days), -1);

  return (
    <section className="ss-list" style={color ? ({ "--list": color } as React.CSSProperties) : undefined} aria-label={list.name || "List"}>
      <header className="ss-list-head">
        <div className="ss-list-title">
          <input
            ref={nameBox}
            className="ss-list-name"
            value={name}
            maxLength={40}
            aria-label="List name"
            onChange={(e) => {
              // An empty name isn't saved: leaving the box empty puts the old one back.
              if (e.target.value.trim()) {
                setDraft(null);
                onChange({ name: e.target.value });
              } else setDraft(e.target.value);
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <span className="ss-list-count" aria-label={plural(open.length, "task") + " to do"}>
            {open.length}
          </span>
          {onRemove ? (
            <button type="button" className="ss-list-remove" onClick={onRemove} aria-label={`Remove the ${list.name} list`} title="Remove this list">
              <SsIcon name="x" size={16} />
            </button>
          ) : null}
        </div>
        <div className="ss-list-filters">
          <div className="ss-list-seg" role="group" aria-label="Show">
            {SHOWS.map((s) => (
              <button key={s.id} type="button" aria-pressed={list.show === s.id} onClick={() => onChange({ show: s.id })}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ss-list-pickers">
            <ClassFilter areas={areas} shown={list.areas} onChange={(ids) => onChange({ areas: ids })} school allLabel="Everything" />
            <label className="ss-list-days">
              <SsIcon name="calendar" size={15} />
              <select value={list.days ?? "any"} onChange={(e) => onChange({ days: e.target.value === "any" ? null : Number(e.target.value) })} aria-label="How many days ahead, counting today" title="How many days ahead, counting today">
                {LIST_WINDOWS.map((d) => (
                  <option key={d ?? "any"} value={d ?? "any"}>
                    {daysLabel(d)}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden className="ss-filter-chevron" />
            </label>
          </div>
        </div>
      </header>

      <div className="ss-list-body">
        {open.length === 0 ? (
          <div className="ss-list-empty">
            {search ? (
              <p>Nothing here matches.</p>
            ) : (
              <>
                <strong>{list.show === "planned" ? "Nothing planned" : "Nothing to do"}</strong>
                <p>{lastDay ? `through ${format(lastDay, "EEE, MMM d")}. Nice.` : "Nice."}</p>
              </>
            )}
          </div>
        ) : null}
        {groups.map((g) =>
          g.rows.length ? (
            <section key={g.key} className="ss-plan-group" data-missed={g.key === "missed" || undefined}>
              {g.title ? (
                <h2>
                  {g.title}
                  {g.sub ? <span>{g.sub}</span> : null}
                </h2>
              ) : null}
              <ul>
                {g.rows.map((r) => (
                  <TaskLine key={r.task.id} row={r} view={list.show} onTick={onTick} onOpen={() => select({ kind: "task", id: r.task.id })} compact scope={list.id} />
                ))}
              </ul>
            </section>
          ) : null,
        )}
        {showDone && done.length ? (
          <section className="ss-plan-group ss-plan-done">
            <h2>
              Done<span>{done.length}</span>
            </h2>
            <ul>
              {done.map((r) => (
                <TaskLine key={r.task.id} row={r} view={list.show} onTick={onTick} onOpen={() => select({ kind: "task", id: r.task.id })} compact scope={list.id} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}
