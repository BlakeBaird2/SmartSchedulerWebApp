"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import {
  BookOpen,
  Briefcase,
  Calculator,
  ChevronDown,
  Code,
  Coffee,
  Dumbbell,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Heart,
  House,
  Leaf,
  ListTodo,
  Music,
  Palette,
  PenLine,
  Plane,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LIST_COLORS, LIST_ICONS, LIST_WINDOWS, inAreas, inDays, listColor, listIcon, type ListIcon, type ListShow, type TaskListConfig } from "@/lib/taskLists";
import { windowEnd } from "@/lib/todos";
import type { Task } from "@/lib/types";
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

/** Each badge icon, with a name for anyone who can't see it. */
const ICONS: Record<ListIcon, { Icon: LucideIcon; label: string }> = {
  list: { Icon: ListTodo, label: "List" },
  cap: { Icon: GraduationCap, label: "School" },
  book: { Icon: BookOpen, label: "Book" },
  home: { Icon: House, label: "Home" },
  work: { Icon: Briefcase, label: "Work" },
  gym: { Icon: Dumbbell, label: "Workout" },
  heart: { Icon: Heart, label: "Heart" },
  shop: { Icon: ShoppingCart, label: "Shopping" },
  travel: { Icon: Plane, label: "Travel" },
  music: { Icon: Music, label: "Music" },
  code: { Icon: Code, label: "Code" },
  science: { Icon: FlaskConical, label: "Science" },
  art: { Icon: Palette, label: "Art" },
  food: { Icon: Utensils, label: "Food" },
  people: { Icon: Users, label: "People" },
  star: { Icon: Star, label: "Star" },
  coffee: { Icon: Coffee, label: "Coffee" },
  money: { Icon: Wallet, label: "Money" },
  math: { Icon: Calculator, label: "Math" },
  write: { Icon: PenLine, label: "Writing" },
  games: { Icon: Gamepad2, label: "Games" },
  nature: { Icon: Leaf, label: "Nature" },
  sparkle: { Icon: Sparkles, label: "Sparkle" },
  goal: { Icon: Target, label: "Goal" },
};

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
  open,
  onToggle,
}: {
  rows: Row[];
  doneAt: (t: Task) => number | null;
  /** What's typed in the search, lower case. */
  search: string;
  showDone: boolean;
  onTick: (t: Task) => void;
  /** A list just added, whose name gets the cursor. */
  focus: string | null;
  /** On a phone, the lists open past their headers; null where lists don't fold (wider screens). */
  open: string[] | null;
  onToggle: (id: string) => void;
}) {
  const { taskLists, setTaskLists } = useApp();
  const change = (id: string, patch: Partial<TaskListConfig>) => setTaskLists(taskLists.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setTaskLists(taskLists.filter((l) => l.id !== id));

  return (
    <div className="ss-lists" data-stacked={open ? true : undefined} style={{ "--lists": taskLists.length } as React.CSSProperties}>
      {taskLists.map((list, i) => (
        <ListColumn
          key={list.id}
          list={list}
          color={listColor(list, i)}
          rows={rows}
          doneAt={doneAt}
          search={search}
          showDone={showDone}
          onTick={onTick}
          autoFocus={focus === list.id}
          collapsed={open ? !open.includes(list.id) : null}
          onToggle={() => onToggle(list.id)}
          onChange={(patch) => change(list.id, patch)}
          onRemove={taskLists.length > 1 ? () => remove(list.id) : undefined}
        />
      ))}
    </div>
  );
}

function ListColumn({
  list,
  color,
  rows,
  doneAt,
  search,
  showDone,
  onTick,
  autoFocus,
  collapsed,
  onToggle,
  onChange,
  onRemove,
}: {
  list: TaskListConfig;
  /** The list's colour, which its header, ticks and headings take on. */
  color: string;
  rows: Row[];
  doneAt: (t: Task) => number | null;
  search: string;
  showDone: boolean;
  onTick: (t: Task) => void;
  autoFocus: boolean;
  /** Whether it's folded to its header, or null where lists don't fold. */
  collapsed: boolean | null;
  onToggle: () => void;
  onChange: (patch: Partial<TaskListConfig>) => void;
  onRemove?: () => void;
}) {
  const { model, now, select } = useApp();
  const bodyId = `list-${list.id}`;
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

  const lastDay = list.days === null ? null : addDays(windowEnd(now, list.days), -1);
  const icon = listIcon(list);

  return (
    <section className="ss-list" data-collapsed={collapsed || undefined} style={{ "--list": color } as React.CSSProperties} aria-label={list.name || "List"}>
      <header className="ss-list-head">
        <div className="ss-list-title">
          <BadgePicker list={list} color={color} icon={icon} onChange={onChange} />
          <div className="ss-list-heading">
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
          {/* On a phone, the line under the name opens and closes the list too: a bigger target than the arrow. */}
          <span className="ss-list-sub" onClick={collapsed !== null ? onToggle : undefined} data-toggles={collapsed !== null || undefined}>
            <b>{open.length}</b> {list.show === "planned" ? "planned" : "to do"} · {list.days === null ? "any time" : `next ${list.days} days`}
          </span>
          </div>
          {/* Folded, a list is just its header: no remove button to hit by mistake. */}
          {onRemove && !collapsed ? (
            <button type="button" className="ss-list-remove" onClick={onRemove} aria-label={`Remove the ${list.name} list`} title="Remove this list">
              <SsIcon name="x" size={16} />
            </button>
          ) : null}
          {collapsed !== null ? (
            <button
              type="button"
              className="ss-list-toggle"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={collapsed ? `Open ${list.name}` : `Close ${list.name}`}
              onClick={onToggle}
            >
              <ChevronDown size={20} aria-hidden />
            </button>
          ) : null}
        </div>
        {collapsed ? null : (
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
        )}
      </header>

      {collapsed ? null : (
        <div className="ss-list-body" id={bodyId}>
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
      )}
    </section>
  );
}

/**
 * The list's badge: its colour, with an icon for what it holds. Tap it to pick
 * another colour, or another icon.
 */
function BadgePicker({
  list,
  color,
  icon,
  onChange,
}: {
  list: TaskListConfig;
  color: string;
  icon: ListIcon;
  onChange: (patch: Partial<TaskListConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const { Icon } = ICONS[icon];

  return (
    <div className="ss-list-badge-wrap" ref={box}>
      <button
        type="button"
        className="ss-list-badge"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={`${list.name} list colour and icon`}
        title="Change the colour or icon"
      >
        <Icon size={21} strokeWidth={2.2} aria-hidden />
      </button>
      {open ? (
        <div className="ss-list-picker" role="group" aria-label={`Colour and icon for ${list.name}`}>
          <span className="ss-list-picker-label">Colour</span>
          <div className="ss-list-swatches">
            {LIST_COLORS.map((c) => (
              <button key={c} type="button" style={{ background: c }} aria-pressed={c === color} aria-label={c === color ? "Current colour" : "Use this colour"} onClick={() => onChange({ color: c })}>
                {c === color ? <SsIcon name="check" size={14} /> : null}
              </button>
            ))}
          </div>
          <span className="ss-list-picker-label">Icon</span>
          <div className="ss-list-icons">
            {LIST_ICONS.map((id) => {
              const { Icon: Choice, label } = ICONS[id];
              return (
                <button key={id} type="button" aria-pressed={id === icon} aria-label={label} title={label} onClick={() => onChange({ icon: id })}>
                  <Choice size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
