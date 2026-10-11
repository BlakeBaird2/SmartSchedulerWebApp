"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, ExternalLink, HelpCircle, MapPin, Pencil, Trash, Undo2, X } from "lucide-react";
import { PROVIDER_LABEL } from "@/lib/feeds/url";
import { parseWeeklyId } from "@/lib/model";
import { daysLabel, meetingKey, meetingPatterns } from "@/lib/meetings";
import { buildDaySchedule } from "@/lib/timeline";
import type { CalEvent, Task } from "@/lib/types";
import { clockRange, dueDate, duration, relativeDue, typeMeta } from "@/lib/ui";
import { courseStyle, useApp, type Selection } from "./context";
import { DoneToggle } from "./TaskRow";
import { Button, buttonClass, ChoicePill, ClassChip, Dialog, SectionLabel, TextButton, TypeChip } from "./ui";
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

function Label({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-1">{children}</SectionLabel>;
}

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240, 360];

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { model, index, now, changes, ws, setEstimate, update, setView, setPlanDay, toggleDone, select, completeTask, toast } = useApp();
  const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
  const feed = task.feedId ? model.feedById.get(task.feedId) : undefined;
  const d = dueDate(task);
  const overdue = Boolean(d && d.getTime() < now.getTime() && !task.done);
  const blocks = index.blocks.get(task.id) ?? [];
  const risk = index.atRisk.get(task.id);
  const history = useMemo(() => changes.filter((c) => c.taskId === task.id).slice(0, 6), [changes, task.id]);
  const typeDefault = ws.prefs.estimates[task.type];
  const options = [...new Set([...ESTIMATES, task.estimate])].sort((a, b) => a - b);
  const rank = index.rank.get(task.id);

  const openDay = (date: Date) => {
    setPlanDay(differenceInCalendarDays(date, now));
    setView("plan");
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
          <Label>Due</Label>
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
            <Label>In your plan</Label>
            {blocks.length > 0 ? (
              <ul className="space-y-1">
                {blocks.map((b) => (
                  <li key={b.part}>
                    <button
                      type="button"
                      onClick={() => openDay(b.start)}
                      className="w-full text-left flex items-center gap-2 border border-line-strong px-2.5 py-2 text-sm hover:bg-surface-2 transition"
                    >
                      <Clock3 size={14} className="shrink-0" aria-hidden />
                      <span className="flex-1 min-w-0">
                        {format(b.start, "EEE, MMM d")} · {clockRange(b.start, b.end)}
                      </span>
                      <span className="text-xs text-muted tabular-nums">{duration(b.minutes)}</span>
                      <ArrowRight size={13} className="text-muted" aria-label="Open this day in your plan" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {risk ? (
              <p className="mt-2 text-sm text-danger font-semibold flex gap-1.5">
                <CircleAlert size={15} className="shrink-0 mt-0.5" />
                {risk.planned > 0
                  ? `Only ${duration(risk.planned)} of free time before it's due. ${duration(risk.shortBy)} won't fit.`
                  : "There's no free time left before it's due."}
              </p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted">
                {d && d.getTime() < now.getTime() - 7 * 86_400_000
                  ? "More than a week late, so it's left out of the plan."
                  : "Due more than two weeks out. It'll be planned as it gets closer."}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm font-semibold">Done{ws.done[task.id] ? ` · ${format(new Date(ws.done[task.id]), "MMM d, h:mm a")}` : ""}</p>
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
          {event.busy ? "SmartScheduler plans your work around this." : "This doesn't block your time, so SmartScheduler can plan work during it."}
        </p>
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

function GapDetail({ startMs, onClose }: { startMs: number; onClose: () => void }) {
  const { plan, model, select, completeTask, setView, setPlanDay, now } = useApp();
  let found: {
    dayIndex: number;
    day: (typeof plan.days)[number];
    gap: Extract<ReturnType<typeof buildDaySchedule>["items"][number], { kind: "free" }>;
  } | null = null;
  for (let i = 0; i < plan.days.length; i++) {
    const day = plan.days[i];
    const schedule = buildDaySchedule(day.date, day, model.events, model.tasks);
    const gap = schedule.items.find((it) => it.kind === "free" && it.start.getTime() <= startMs && it.end.getTime() > startMs);
    if (gap && gap.kind === "free") {
      found = { dayIndex: i, day, gap };
      break;
    }
  }

  if (!found) {
    return (
      <>
        <header className="flex items-center gap-3 p-4 border-b border-line">
          <h2 className="font-semibold flex-1">Free time</h2>
          <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
        </header>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted">This free gap is no longer on your plan (the day may have moved on).</p>
          <Button block onClick={onClose}>
            Close
          </Button>
        </div>
      </>
    );
  }

  const { dayIndex, day, gap } = found;

  return (
    <>
      <header className="flex items-start gap-3 p-4 border-b border-line">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Free · {duration(gap.minutes)}</h2>
          <p className="mt-1 text-sm text-muted">
            {format(day.date, "EEEE, MMM d")} · {clockRange(gap.start, gap.end)}
          </p>
        </div>
        <Button iconOnly icon={X} label="Close" onClick={onClose} data-dialog-close="true" />
      </header>
      <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
        <p className="text-sm text-muted leading-relaxed">
          SmartScheduler fills this gap with unfinished work that is due soonest and that fits. Open a task, review it, then mark it done.
        </p>
        {gap.work.length === 0 ? (
          <p className="text-sm text-muted">Nothing due soon fits here. Enjoy the break, or pick work from Upcoming or Classes.</p>
        ) : (
          <ul className="space-y-2">
            {gap.work.map((w) => {
              const course = w.task.courseId ? model.courseById.get(w.task.courseId) : undefined;
              return (
                <li key={`${w.task.id}:${w.block.part}`} className="border border-line-strong p-3 space-y-2" style={courseStyle(course?.color)}>
                  <button type="button" className="text-left w-full" onClick={() => select({ kind: "task", id: w.task.id })}>
                    <div className="font-semibold leading-snug">{w.task.title}</div>
                    <div className="mt-1 text-xs text-muted flex flex-wrap gap-x-2">
                      {course ? <ClassChip code={course.code} color={course.color} /> : null}
                      <span>{duration(w.block.minutes)}</span>
                      {w.task.dueAt ? <span>{relativeDue(new Date(w.task.dueAt), now)}</span> : null}
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => select({ kind: "why", id: w.task.id })}>
                      Why this task?
                    </Button>
                    <Button size="sm" variant="primary" className="ml-auto" icon={Check} onClick={() => completeTask(w.task)}>
                      Done
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {gap.leftover >= 15 ? <p className="text-xs text-muted">{duration(gap.leftover)} of this gap stays free.</p> : null}
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
          That counts for the prototype goal. Your plan updates everywhere — Plan, Calendar, Upcoming, and Classes stay in sync.
        </p>
        {next ? (
          <div className="border border-line-strong p-3 space-y-2">
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
