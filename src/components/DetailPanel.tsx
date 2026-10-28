"use client";

import { useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CircleAlert, Clock3, ExternalLink, Flag, HelpCircle, MapPin, Pencil, Trash, Undo2, X } from "lucide-react";
import { PROVIDER_LABEL } from "@/lib/feeds/url";
import { parseWeeklyId } from "@/lib/model";
import { daysLabel, meetingKey, meetingPatterns } from "@/lib/meetings";
import type { CalEvent, Task } from "@/lib/types";
import { approxDuration, clock, clockRange, dayKey, dueDate, duration, relativeDue, typeMeta } from "@/lib/ui";
import { todoState, urgencyColor } from "@/lib/todos";
import { EVENT_COLORS, repeats, seriesKey } from "@/lib/eventColors";
import { PLAN_DAYS } from "@/lib/schedule";
import { courseStyle, useApp, type Selection } from "./context";
import { DoneToggle } from "./TaskRow";
import { useTodos } from "./TodoList";
import { Button, buttonClass, ChoicePill, ClassChip, ColorSwatches, Dialog, Field, SectionLabel, TextButton, TypeChip } from "./ui";
import { ClassEditForm } from "./ClassSummary";
import { ClassTimeForm, useClassTimeActions, valuesFromBlock, valuesFromPattern } from "./ClassTimes";

export function DetailPanel({ selection, onClose }: { selection: NonNullable<Selection>; onClose: () => void }) {
  const { model } = useApp();

  const task =
    selection.kind === "task" || selection.kind === "why" || selection.kind === "completed"
      ? model.tasks.find((t) => t.id === selection.id)
      : undefined;
  const event = selection.kind === "event" ? model.events.find((e) => e.id === selection.id) : undefined;
  const color = task ? (task.courseId ? model.courseById.get(task.courseId)?.color : undefined) : event?.color;

  let body: React.ReactNode = null;
  let label = "Details";
  if (selection.kind === "gap") {
    body = <GapDetail startMs={selection.startMs} onClose={onClose} />;
    label = "Free time";
  } else if (selection.kind === "why" && task) {
    body = <WhyDetail task={task} onClose={onClose} />;
    label = `Why: ${task.title}`;
  } else if (selection.kind === "completed" && task) {
    body = <CompletedDetail task={task} onClose={onClose} />;
    label = "Marked done";
  } else if (selection.kind === "task" && task) {
    body = <TaskDetail task={task} onClose={onClose} />;
    label = task.title;
  } else if (selection.kind === "event" && event) {
    body = <EventDetail event={event} onClose={onClose} />;
    label = event.title;
  } else {
    return null;
  }

  return (
    <Dialog placement="side" label={label} onClose={onClose} style={courseStyle(color)}>
      {body}
    </Dialog>
  );
}

/**
 * Choose when to work on a task: a day and a start time. The same as dragging it
 * onto the calendar, for keyboards and anyone who'd rather type.
 */
function PickTime({ task, start, onDone }: { task: Task; start?: Date; onDone: () => void }) {
  const { scheduleTask, now } = useApp();
  const today = startOfDay(now);
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(today, i));
  // Start from the scheduled time, or the next whole hour.
  const initial = start ?? new Date(Math.ceil((now.getTime() + 1) / 3_600_000) * 3_600_000);
  const [day, setDay] = useState(dayKey(initial < addDays(today, PLAN_DAYS) ? initial : today));
  const [time, setTime] = useState(format(initial, "HH:mm"));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = time.split(":").map(Number);
    const at = days.find((d) => dayKey(d) === day) ?? today;
    const when = new Date(at);
    when.setHours(h, m, 0, 0);
    scheduleTask(task, when);
    onDone();
  };

  return (
    <form onSubmit={save} className="mt-2 rounded-xl border border-line bg-surface-2/60 p-3 space-y-3" aria-label={`Pick a time for ${task.title}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
        <Field label="Day">
          <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map((d, i) => (
              <option key={dayKey(d)} value={dayKey(d)}>
                {i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE, MMM d")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start">
          <input className="input" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <p className="text-xs text-muted">Takes {approxDuration(task.estimate)}. It goes on your calendar and comes off your to-do list.</p>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" data-smart-event="task_planned">
          Schedule it
        </Button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-1">{children}</SectionLabel>;
}

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240, 360];

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { model, index, now, changes, ws, setEstimate, update, setView, setCalCursor, toggleDone, select, completeTask, toast, unschedule, answerUnfinished } = useApp();
  const [picking, setPicking] = useState(false);
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const feed = task.feedId ? model.feedById.get(task.feedId) : undefined;
  const d = dueDate(task);
  const overdue = Boolean(d && d.getTime() < now.getTime() && !task.done);
  const scheduled = useMemo(
    () => ws.blocks.filter((b) => b.taskId === task.id).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    [ws.blocks, task.id],
  );
  const lastEnd = scheduled.length ? Date.parse(scheduled[scheduled.length - 1].end) : 0;
  const ahead = scheduled.some((b) => Date.parse(b.end) > now.getTime());
  const state = todoState(task, scheduled, now, ws.unfinished, ws.unfinishedAnswers[task.id]);
  const risk = ahead ? undefined : index.atRisk.get(task.id);
  const history = useMemo(() => changes.filter((c) => c.taskId === task.id).slice(0, 6), [changes, task.id]);
  const typeDefault = ws.prefs.estimates[task.type];
  const options = [...new Set([...ESTIMATES, task.estimate])].sort((a, b) => a - b);
  const rank = index.rank.get(task.id);

  const openDay = (date: Date) => {
    setCalCursor(date);
    setView("calendar");
    onClose();
  };

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <DoneToggle task={task} />
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold leading-snug ${task.done ? "line-through text-muted" : ""}`}>{task.title}</h2>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {course ? (
              <span className="text-xs">
                <ClassChip code={course.code} color={course.color} title={course.title} />
              </span>
            ) : null}
            <TypeChip type={task.type} />
            {task.generated === "study" ? <span className="text-xs text-muted">Study time added by SmartScheduler</span> : null}
          </div>
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>

      <div className="p-4 space-y-5 overflow-y-auto scrollbar-thin">
        {/* The same main action as the Plan screen's Done button, so finishing work looks the same everywhere. */}
        <div className="flex flex-col gap-2">
          <Button
            variant={task.done ? "secondary" : "primary"}
            block
            icon={task.done ? Undo2 : Check}
            data-smart-event={task.done ? "task_uncompleted" : "task_completed"}
            onClick={() => (task.done ? toggleDone(task) : completeTask(task))}
          >
            {task.done ? "Mark as not done" : "Mark as done"}
          </Button>
          {!task.done ? (
            <Button icon={HelpCircle} block onClick={() => select({ kind: "why", id: task.id })}>
              Why this task?
            </Button>
          ) : null}
        </div>

        <div>
          <SectionLabel className="mb-1 inline-flex items-center gap-1.5">
            <Flag size={12} className={overdue ? "text-danger" : "text-warn"} aria-hidden />
            Due (the deadline)
          </SectionLabel>
          <div className={`text-[0.9375rem] font-medium ${overdue ? "text-danger" : ""}`}>
            {d ? `${format(d, "EEEE, MMMM d")}${task.allDay ? "" : ` at ${format(d, "h:mm a")}`}` : "No due date"}
          </div>
          {d ? <div className="text-xs text-muted mt-0.5">{relativeDue(d, now)}</div> : null}
          {rank ? <div className="text-xs text-muted mt-0.5">Priority #{rank} among unfinished work (soonest deadline first).</div> : null}
        </div>

        <div>
          <Label>Time it needs</Label>
          <div className="flex flex-wrap gap-1.5">
            {options.map((m) => (
              <ChoicePill key={m} selected={task.estimate === m} onClick={() => setEstimate(task.id, m === typeDefault ? null : m)}>
                {duration(m)}
              </ChoicePill>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {task.customEstimate ? (
              <>
                Set by you.{" "}
                <TextButton onClick={() => setEstimate(task.id, null)}>
                  Use the {typeMeta(task.type).label.toLowerCase()} default ({duration(typeDefault)})
                </TextButton>
              </>
            ) : (
              `The default for ${typeMeta(task.type).plural.toLowerCase()}. Part-way through? Lower it to what's left.`
            )}
          </p>
        </div>

        {!task.done ? (
          <div>
            <SectionLabel className="mb-1 inline-flex items-center gap-1.5">
              <CalendarClock size={12} className="text-ok" aria-hidden />
              On your calendar
            </SectionLabel>
            {scheduled.length > 0 ? (
              <ul className="space-y-1">
                {scheduled.map((b) => {
                  const start = new Date(b.start);
                  const end = new Date(b.end);
                  const past = end.getTime() <= now.getTime();
                  return (
                    <li key={b.id} className={`flex items-stretch rounded-lg border border-ok/30 bg-ok-soft text-sm ${past ? "opacity-60" : ""}`}>
                      <button
                        type="button"
                        onClick={() => openDay(start)}
                        className="flex-1 min-w-0 text-left flex items-center gap-2 pl-3 pr-1 py-2 rounded-l-lg hover:bg-ok/10 transition"
                      >
                        <Clock3 size={14} className="shrink-0 text-ok" aria-hidden />
                        <span className="flex-1 min-w-0">
                          {format(start, "EEE, MMM d")} · {clockRange(start, end)}
                        </span>
                        <span className="text-xs text-muted tabular-nums">{duration((end.getTime() - start.getTime()) / 60_000)}</span>
                        <ArrowRight size={13} className="text-muted" aria-label="Show it on the calendar" />
                      </button>
                      <Button iconOnly size="sm" variant="quiet" icon={X} label={`Take ${format(start, "EEE h:mm a")} off the calendar`} onClick={() => unschedule(b.id)} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not yet. Drag it from your to-do list onto a free time, or pick one here.</p>
            )}
            {d && !overdue && lastEnd > d.getTime() ? (
              <p className="mt-1.5 text-sm text-danger font-semibold flex gap-1.5">
                <CircleAlert size={15} className="shrink-0 mt-0.5" />
                That&apos;s after it&apos;s due.
              </p>
            ) : null}
            {state === "unfinished" ? (
              <p className="mt-1.5 text-xs text-muted flex flex-wrap items-center gap-x-1.5">
                {ws.unfinished === "midnight"
                  ? "That time has passed. It goes back on your to-do list at midnight."
                  : ws.unfinishedAnswers[task.id]?.back === false
                    ? "That time has passed, and you left it off your to-do list."
                    : "That time has passed. You'll be asked tomorrow morning whether to put it back on your to-do list."}
                <TextButton onClick={() => answerUnfinished([task.id], true)}>Put it back now</TextButton>
              </p>
            ) : scheduled.length > 0 && !ahead ? (
              <p className="mt-1.5 text-xs text-muted">That time has passed, so it&apos;s back on your to-do list.</p>
            ) : ahead && ws.unfinished === "keep" ? (
              <p className="mt-1.5 text-xs text-muted">It stays on your to-do list until you tick it off.</p>
            ) : null}
            {risk ? (
              <p className="mt-2 text-sm text-danger font-semibold flex gap-1.5">
                <CircleAlert size={15} className="shrink-0 mt-0.5" />
                {risk.planned > 0
                  ? `Only ${duration(risk.planned)} of free time before it's due. ${duration(risk.shortBy)} won't fit.`
                  : "There's no free time left before it's due."}
              </p>
            ) : null}
            {picking ? (
              <PickTime task={task} onDone={() => setPicking(false)} />
            ) : (
              <Button size="sm" icon={CalendarClock} className="mt-2" onClick={() => setPicking(true)}>
                {ahead ? "Add another time" : "Schedule it"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm font-semibold">
            {ws.done[task.id]?.startsWith("auto:")
              ? "Done · assumed, since it was already past due when the calendar was added"
              : `Done${ws.done[task.id] ? ` · ${format(new Date(ws.done[task.id]), "MMM d, h:mm a")}` : ""}`}
          </p>
        )}

        {task.description ? (
          <div>
            <Label>Details</Label>
            <p className="text-sm leading-relaxed whitespace-pre-line text-fg/90">{task.description}</p>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div>
            <Label>Recent changes</Label>
            <ul className="space-y-1.5 text-xs">
              {history.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-faint tabular-nums">{format(new Date(c.at), "MMM d")}</span>
                  {c.kind === "due_changed" ? (
                    <>
                      <span className="text-muted">due moved</span>
                      <span className="line-through text-faint">{c.from ? format(new Date(c.from), "MMM d, h:mm a") : "none"}</span>
                      <ArrowRight size={11} className="text-muted" />
                      <span className="font-medium">{c.to ? format(new Date(c.to), "MMM d, h:mm a") : "none"}</span>
                    </>
                  ) : (
                    <span className="text-muted">{c.kind === "added" ? "added to the class calendar" : "removed from the class calendar"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {task.url ? (
          <a href={task.url} target="_blank" rel="noreferrer" className={buttonClass({ block: true })}>
            Open in {feed && feed.provider !== "other" ? PROVIDER_LABEL[feed.provider] : "the class site"}
            <ExternalLink size={14} />
          </a>
        ) : null}

        {task.manual ? (
          <Button
            variant="danger"
            block
            icon={Trash}
            onClick={() => {
              const id = task.id.replace(/^manual:/, "");
              const removed = ws.manualTasks.find((m) => m.id === id);
              update((w) => ({ ...w, manualTasks: w.manualTasks.filter((m) => m.id !== id) }));
              onClose();
              if (removed) toast(`Deleted: ${task.title}`, { undo: () => update((w) => ({ ...w, manualTasks: [...w.manualTasks, removed] })) });
            }}
          >
            Delete this task
          </Button>
        ) : null}

        <p className="text-xs text-muted">{task.manual ? "Added by you." : `From ${feed?.name ?? "a calendar"}.`}</p>
      </div>
    </>
  );
}

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { model, ws, now, setView, update, openClassTimes } = useApp();
  const course = event.courseId ? model.courseById.get(event.courseId) : undefined;
  const feed = event.feedId ? model.feedById.get(event.feedId) : undefined;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const weekly = parseWeeklyId(event.id);
  const actions = useClassTimeActions();
  const [editing, setEditing] = useState(false);
  const [editingClass, setEditingClass] = useState(false);
  // A colour of the student's own, for every meeting of this event.
  const series = seriesKey(event.id);
  const picked = ws.eventColors[series] ?? null;
  const setColor = (hex: string | null) =>
    update((w) => {
      const eventColors = { ...w.eventColors };
      if (hex) eventColors[series] = hex;
      else delete eventColors[series];
      return { ...w, eventColors };
    });

  // A class meeting can be corrected: one entered here directly, one from a class
  // calendar by standing in for every meeting at that time. One-off events can't.
  const block = weekly && event.courseId ? ws.weekly.find((b) => b.id === weekly.blockId) : undefined;
  const pattern =
    !weekly && event.courseId && event.kind === "class"
      ? meetingPatterns(model.events, event.courseId, now).find((p) => p.key === meetingKey(start, end) && p.count >= 2)
      : undefined;
  const editable = Boolean(block || pattern);
  const kind = event.kind === "class" ? "Class" : event.kind === "exam" ? "Exam" : event.source === "weekly" ? "Every week" : "Event";

  const skipDay = () => {
    if (!weekly) return;
    update((w) => ({
      ...w,
      weekly: w.weekly.map((b) => (b.id === weekly.blockId ? { ...b, skip: [...new Set([...(b.skip ?? []), weekly.date])].sort() } : b)),
    }));
    onClose();
  };

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <span className="course-dot mt-2" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">{event.title}</h2>
          <div className="mt-1 text-xs text-muted">
            {kind}
            {course && course.code !== event.title ? <span className="course-text font-medium"> · {course.code}</span> : feed ? ` · ${feed.name}` : ""}
          </div>
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>
      <div className="p-4 space-y-5 overflow-y-auto scrollbar-thin">
        <div>
          <Label>When</Label>
          <div className="text-[0.9375rem] font-medium">
            {event.allDay ? format(start, "EEEE, MMMM d") : `${format(start, "EEEE, MMMM d")} · ${clockRange(start, end)}`}
          </div>
          {event.allDay ? <div className="text-xs text-muted mt-0.5">All day</div> : null}
        </div>
        {event.location ? (
          <div>
            <Label>Where</Label>
            <div className="text-sm flex items-center gap-1.5">
              <MapPin size={14} className="text-muted" />
              {event.location}
            </div>
          </div>
        ) : null}
        <p className="text-sm text-muted">
          {event.busy ? "You're busy then, so it isn't offered as free time." : "This doesn't block your time, so it still counts as free time."}
        </p>
        {editingClass && course ? (
          <div>
            <Label>Edit {course.code}</Label>
            <ClassEditForm course={course} onDone={() => setEditingClass(false)} />
          </div>
        ) : (
          <div>
            <Label>Colour</Label>
            <ColorSwatches colors={EVENT_COLORS} value={picked} onChange={setColor} label={`Colour for ${event.title}`} />
            <p className="mt-2 text-xs text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{repeats(event.id) ? "Every time it repeats." : "Just this event."}</span>
              {picked ? (
                <TextButton onClick={() => setColor(null)}>{course ? `Back to ${course.code}'s colour` : "Back to its calendar's colour"}</TextButton>
              ) : null}
              {course ? <TextButton onClick={() => setEditingClass(true)}>Change {course.code}&apos;s colour everywhere</TextButton> : null}
            </p>
          </div>
        )}
        {editable ? (
          editing ? (
            <div>
              <Label>Class time</Label>
              <ClassTimeForm
                initial={block ? valuesFromBlock(block) : { ...valuesFromPattern(pattern!), location: event.location ?? "" }}
                note={
                  pattern
                    ? `This changes every ${daysLabel(pattern.days)} meeting at this time. ${feed?.name ?? "The calendar"}'s version is hidden; you can switch back in Class times.`
                    : "This changes every meeting of this class time."
                }
                onSave={(v) => {
                  if (block) actions.replace(block, v);
                  else if (pattern && event.courseId) actions.correct(event.courseId, pattern.key, v);
                  onClose();
                }}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <Button variant="primary" block icon={Pencil} onClick={() => setEditing(true)}>
              Change class time
            </Button>
          )
        ) : null}
        {weekly ? (
          <div className="space-y-2">
            <Button block onClick={skipDay}>
              Not happening on {format(start, "EEE, MMM d")}
            </Button>
            <Button
              block
              onClick={() => {
                onClose();
                if (event.courseId) openClassTimes();
                else setView("settings");
              }}
            >
              {event.courseId ? "All class times" : "Change weekly busy times"}
            </Button>
          </div>
        ) : null}
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer" className={buttonClass({ block: true })}>
            Open link
            <ExternalLink size={14} />
          </a>
        ) : null}
      </div>
    </>
  );
}

/** How many tasks a free gap suggests. */
const GAP_SUGGESTIONS = 4;

/**
 * A free stretch of time, with the next things on the to-do list that fit in it.
 * "Put it here" is the tap-and-done way to schedule, for anyone who'd rather not drag.
 */
function GapDetail({ startMs, onClose }: { startMs: number; onClose: () => void }) {
  const { plan, model, select, scheduleTask, setView, setPlanDay, now } = useApp();
  const todos = useTodos();
  const dayIndex = plan.days.findIndex((d) => d.gaps.some((g) => g.start.getTime() <= startMs && g.end.getTime() > startMs));
  const gap = dayIndex >= 0 ? plan.days[dayIndex].gaps.find((g) => g.start.getTime() <= startMs && g.end.getTime() > startMs) : undefined;

  if (!gap) {
    return (
      <>
        <header className="flex items-center gap-3 p-4 border-b border-line">
          <h2 className="font-semibold flex-1">Free time</h2>
          <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
        </header>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted">This free time isn&apos;t free any more (something was scheduled, or the day moved on).</p>
          <Button block onClick={onClose}>
            Close
          </Button>
        </div>
      </>
    );
  }

  // Work starts on a quarter hour, like a drop on the calendar.
  const start = new Date(Math.ceil(Math.max(gap.start.getTime(), now.getTime()) / (15 * 60_000)) * 15 * 60_000);
  const room = Math.max(0, (gap.end.getTime() - start.getTime()) / 60_000);
  const fits = todos.filter((t) => t.estimate <= room);
  const shown = fits.slice(0, GAP_SUGGESTIONS);
  const next = todos[0];

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Free · {duration(gap.minutes)}</h2>
          <p className="mt-1 text-sm text-muted">
            {format(gap.start, "EEEE, MMM d")} · {clockRange(gap.start, gap.end)}
          </p>
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>
      <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
        {shown.length > 0 ? (
          <>
            <p className="text-sm text-muted leading-relaxed">
              Next on your to-do list that fits. Put one here to start at {clock(start)}, or drag any task onto this time.
            </p>
            <ul className="space-y-2">
              {shown.map((t, i) => {
                const course = t.courseId ? model.courseById.get(t.courseId) : undefined;
                return (
                  <li key={t.id} className="urgency-card rounded-xl border border-line p-3 flex items-center gap-3" style={{ "--u": urgencyColor(t.dueAt, now) } as React.CSSProperties}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => select({ kind: "task", id: t.id })}>
                      <div className="font-semibold leading-snug line-clamp-2">{t.title}</div>
                      <div className="mt-1 text-xs text-muted flex flex-wrap gap-x-2">
                        <span>{approxDuration(t.estimate)}</span>
                        {course ? <ClassChip code={course.code} color={course.color} /> : <span>Personal</span>}
                        {t.dueAt ? <span>{relativeDue(new Date(t.dueAt), now)}</span> : null}
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant={i === 0 ? "primary" : "secondary"}
                      icon={CalendarClock}
                      data-smart-event="task_planned"
                      onClick={() => {
                        scheduleTask(t, start);
                        onClose();
                      }}
                    >
                      Put it here
                    </Button>
                  </li>
                );
              })}
            </ul>
            {fits.length > shown.length ? (
              <p className="text-xs text-muted">
                {fits.length - shown.length} more {fits.length - shown.length === 1 ? "task fits" : "tasks fit"}. Drag one from your to-do list.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted leading-relaxed">
            {next
              ? `Nothing on your to-do list fits in ${duration(room)}. Next up is ${next.title}, which needs ${approxDuration(next.estimate)}. Enjoy the break, or drag it here anyway.`
              : "Your to-do list is empty. Enjoy the break."}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={() => {
              setPlanDay(dayIndex);
              setView("plan");
              onClose();
            }}
          >
            Back to Plan
          </Button>
          <Button
            onClick={() => {
              setView("upcoming");
              onClose();
            }}
          >
            Upcoming
          </Button>
        </div>
      </div>
    </>
  );
}

function WhyDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { model, index, plan, select, setView } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const rank = index.rank.get(task.id);
  const blocks = index.blocks.get(task.id) ?? [];
  const risk = index.atRisk.get(task.id);
  const ahead = rank
    ? plan.order
        .slice(0, rank - 1)
        .map((id) => model.tasks.find((t) => t.id === id))
        .filter((t): t is Task => Boolean(t))
        .slice(0, 3)
    : [];

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <Button iconOnly icon={ArrowLeft} label="Back to task" onClick={() => select({ kind: "task", id: task.id })} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">Why this task?</h2>
          <p className="mt-1 text-sm text-muted truncate">{task.title}</p>
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>
      <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
        <p className="text-sm leading-relaxed">
          SmartScheduler plans unfinished work by <b className="font-semibold">soonest deadline first</b>, into free gaps that are long enough. Quizzes are
          not split; longer work can be.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="border border-line p-3">
            <SectionLabel className="mb-1">Priority</SectionLabel>
            {rank ? (
              <p>
                #{rank} of {plan.order.length} unfinished items
                {course ? (
                  <>
                    {" "}
                    · <ClassChip code={course.code} color={course.color} />
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-muted">Not in the current plan window (already done, too far out, or filtered).</p>
            )}
          </li>
          <li className="border border-line p-3">
            <SectionLabel className="mb-1">Due</SectionLabel>
            <p>{task.dueAt ? format(new Date(task.dueAt), "EEEE, MMM d · h:mm a") : "No due date — planned after dated work"}</p>
          </li>
          <li className="border border-line p-3">
            <SectionLabel className="mb-1">Fits in free time</SectionLabel>
            {blocks.length > 0 ? (
              <ul className="space-y-1">
                {blocks.map((b) => (
                  <li key={b.part}>
                    {format(b.start, "EEE MMM d")} · {clockRange(b.start, b.end)} · {duration(b.minutes)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No free gap holds it before the due time.</p>
            )}
            {risk ? (
              <p className="mt-2 text-danger flex gap-1.5">
                <CircleAlert size={15} className="shrink-0 mt-0.5" />
                Short by {duration(risk.shortBy)} before it is due.
              </p>
            ) : null}
          </li>
          {ahead.length > 0 ? (
            <li className="border border-line p-3">
              <SectionLabel className="mb-1">Due sooner than this</SectionLabel>
              <ul className="space-y-1 text-muted">
                {ahead.map((t) => (
                  <li key={t.id}>
                    <TextButton onClick={() => select({ kind: "task", id: t.id })}>{t.title}</TextButton>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button icon={ArrowLeft} onClick={() => select({ kind: "task", id: task.id })}>
            Back to task
          </Button>
          <Button
            onClick={() => {
              setView("help");
              onClose();
            }}
          >
            Help
          </Button>
        </div>
      </div>
    </>
  );
}

function CompletedDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { model, plan, select, setView, setPlanDay, now } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const nextId = plan.order[0];
  const next = nextId ? model.tasks.find((t) => t.id === nextId) : undefined;

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <Check size={22} className="text-ok shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">Marked done</h2>
          <p className={`mt-1 text-sm ${task.done ? "line-through text-muted" : "text-muted"}`}>{task.title}</p>
          {course ? (
            <p className="mt-1 text-xs">
              <ClassChip code={course.code} color={course.color} />
            </p>
          ) : null}
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>
      <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
        <p className="text-sm text-muted leading-relaxed">
          That counts for the prototype goal. Your plan updates everywhere: Plan, Calendar and Upcoming stay in sync.
        </p>
        {next ? (
          <div className="rounded-xl border border-line p-3 space-y-2">
            <SectionLabel>Next up</SectionLabel>
            <p className="font-medium">{next.title}</p>
            <Button variant="primary" trailingIcon={ArrowRight} onClick={() => select({ kind: "task", id: next.id })}>
              Review next task
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing else is waiting in the plan right now.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setPlanDay(0);
              setView("plan");
              onClose();
            }}
          >
            Back to Plan
          </Button>
          <Button
            onClick={() => {
              setView("upcoming");
              onClose();
            }}
          >
            Upcoming
          </Button>
          <Button onClick={() => select({ kind: "task", id: task.id })}>Open this task</Button>
        </div>
        <p className="text-[11px] text-faint">Finished {format(now, "h:mm a")} · stored only in this browser</p>
      </div>
    </>
  );
}
