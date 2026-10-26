"use client";

import { useEffect, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ArrowRight, CalendarClock, Check, CircleAlert, Flag, MapPin, Plus } from "lucide-react";
import type { PlannedWork, ScheduleItem } from "@/lib/timeline";
import { buildDaySchedule, nowStatus } from "@/lib/timeline";
import type { Task } from "@/lib/types";
import { clock, clockRange, duration, minutesLabel, plural, typeMeta } from "@/lib/ui";
import { courseStyle, useApp } from "./context";
import { AppTaskCard, DueTag } from "./TaskRow";
import { useClassesWithoutTimes } from "./ClassTimes";
import { CapabilityHero } from "./Prototype";
import { trackEvent } from "./smartEvents";
import { Button, Callout, Card, ClassChip, FreeGapBlock, SectionLabel, SegmentedControl, TextButton, TimelineRow, TypeChip } from "./ui";

/**
 * The home screen, focused on one question at a time:
 * what should I work on right now, am I on track today, and how does the rest of my day look.
 * Everything that's due later lives on Upcoming, one tap away.
 */
export function PlanView() {
  const { snapshot, syncing } = useApp();
  if (!snapshot.at && syncing) return <Loading />;

  return (
    <div className="space-y-5">
      <ClassTimesPrompt />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] items-start">
        <div className="space-y-5 min-w-0">
          <NowCard />
          {/* Phones and tablets: today's goal right under the focus card. */}
          <div className="lg:hidden">
            <TodayGoal compact />
          </div>
          {/* Tablets add from here; phones use the round + button in the bottom bar. */}
          <div className="hidden md:block lg:hidden">
            <AddTaskTile />
          </div>
          <DaySchedule />
        </div>
        {/* Computers: a slim column beside the plan that stays in view while you scroll. */}
        <aside className="hidden lg:block space-y-5 sticky top-20" aria-label="Today's goal and adding work">
          <TodayGoal />
          <AddTaskTile />
        </aside>
      </div>
    </div>
  );
}

/**
 * The top of the Plan screen, drawn above any banners (such as the sample-data
 * one) so what SmartScheduler does is the first and biggest thing someone sees here.
 */
export function PlanHeading() {
  const { now } = useApp();
  return (
    <CapabilityHero className="pt-4 md:pt-6">
      <p className="mt-1.5 md:mt-2 text-base md:text-lg text-muted">
        <span className="text-fg">{format(now, "EEEE, MMMM d")}</span>
        <span className="hidden md:inline"> · SmartScheduler fills each free gap with whatever is due soonest. Tick things off as you finish them.</span>
      </p>
    </CapabilityHero>
  );
}

/** Asks for class times until every class has them, or the person says not now. */
function ClassTimesPrompt() {
  const { openClassTimes, classTimesTipHidden, hideClassTimesTip } = useApp();
  const missing = useClassesWithoutTimes();
  if (classTimesTipHidden || missing.length === 0) return null;
  const names = missing.map((c) => c.code);
  const list = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  return (
    <Callout
      icon={CalendarClock}
      title="When do your classes meet?"
      actions={
        <>
          <Button variant="quiet" onClick={hideClassTimesTip}>
            Not now
          </Button>
          <Button icon={Plus} onClick={openClassTimes}>
            Add class times
          </Button>
        </>
      }
    >
      Your class calendars don&apos;t include class times for {list}. Add them once and they&apos;ll show on your calendar, so your real free time is
      clear.
    </Callout>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <p className="text-sm text-muted">Reading your calendars…</p>
      <div className="skeleton h-40 w-full" />
      <div className="skeleton h-14 w-full" />
      <div className="skeleton h-14 w-full" />
    </div>
  );
}

function useCourse(task: Task | undefined) {
  const { model } = useApp();
  return task?.courseId ? model.courseById.get(task.courseId) : undefined;
}

// ---------------------------------------------------------------------------
// Right now
// ---------------------------------------------------------------------------

function NowCard() {
  const { plan, model, now, ws, setPlanDay } = useApp();
  const status = useMemo(() => nowStatus(plan, model.events, model.tasks, now), [plan, model, now]);
  const hasWork = model.tasks.some((t) => !t.done);

  let dot = "bg-ok";
  let headline: React.ReactNode;
  let detail: string | null = null;
  let work: PlannedWork[] = [];
  let lead = "Work on";

  if (status.state === "free") {
    headline = `Free until ${clock(status.until)}`;
    // Name what comes next only when it is what ends this free time.
    const next = status.nextEvent && Date.parse(status.nextEvent.start) - status.until.getTime() <= 45 * 60_000 ? status.nextEvent : null;
    detail = next ? `${duration(status.minutes)} free, then ${next.title} at ${clock(new Date(next.start))}` : `${duration(status.minutes)} of free time left today`;
    work = status.work;
  } else if (status.state === "busy") {
    dot = "bg-warn";
    headline = `${status.event.title} until ${clock(new Date(status.event.end))}`;
    detail = status.next ? `Next free time ${clockRange(status.next.start, status.next.end)}` : "No more free time today";
    work = status.work;
    if (status.next) lead = `At ${clock(status.next.start)}, work on`;
  } else if (status.state === "later") {
    dot = "bg-fg";
    headline = `Free from ${clock(status.next.start)} to ${clock(status.next.end)}`;
    const first = model.events.find((e) => e.busy && !e.allDay && Date.parse(e.start) >= now.getTime() && Date.parse(e.start) < status.next.start.getTime());
    detail = first ? `${first.title} at ${clock(new Date(first.start))} comes first` : `Your day starts at ${minutesLabel(ws.prefs.dayStart)}`;
    work = status.work;
    lead = `At ${clock(status.next.start)}, work on`;
  } else {
    dot = "bg-faint";
    headline = "No more free time today";
    detail = `You plan work until ${minutesLabel(ws.prefs.dayEnd)}`;
  }

  const [first, second] = work;

  return (
    // The focal point of the whole app: a heavier outline than any other card, so the eye lands here first.
    <Card className="card-focal" aria-label="What to work on now">
      {/* Where you are in the day, on one line: the state, then what's next in a quieter tone. */}
      <p className="flex items-baseline gap-x-2 flex-wrap text-sm">
        <span className={`w-2 h-2 rounded-full shrink-0 self-center ${dot}`} aria-hidden />
        <span className="font-medium">{headline}</span>
        {detail ? (
          <span className="text-muted basis-full pl-4 sm:basis-auto sm:pl-0">
            <span className="hidden sm:inline">· </span>
            {detail}
          </span>
        ) : null}
      </p>

      {first ? (
        <FocusTask lead={lead} item={first} next={second} />
      ) : status.state === "done" ? (
        <Button variant="primary" className="mt-4" trailingIcon={ArrowRight} onClick={() => setPlanDay(1)}>
          See tomorrow&apos;s plan
        </Button>
      ) : (
        <p className="mt-4 text-[0.9375rem]">{hasWork ? "Nothing due soon fits in this time. Enjoy the break." : "You're all caught up."}</p>
      )}
    </Card>
  );
}

function FocusTask({ lead, item, next }: { lead: string; item: PlannedWork; next?: PlannedWork }) {
  const { completeTask, select } = useApp();
  const { task, block } = item;
  const course = useCourse(task);

  return (
    <div className="mt-4">
      <SectionLabel>{lead}</SectionLabel>
      <div className="mt-1.5 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => select({ kind: "task", id: task.id })} className="text-left text-xl font-semibold leading-snug hover:underline underline-offset-4 decoration-line-strong">
            {task.title}
          </button>
          <div className="mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap text-sm text-muted" style={courseStyle(course?.color)}>
            {course ? <ClassChip variant="tag" code={course.code} color={course.color} title={course.title} /> : null}
            {typeMeta(task.type).loud ? <TypeChip type={task.type} /> : null}
            <span>
              {duration(block.minutes)}
              {block.parts > 1 ? ` (part ${block.part} of ${block.parts})` : ""}
            </span>
            <DueTag task={task} />
          </div>
        </div>
        {/* The one primary action on the Plan screen. */}
        <Button variant="primary" size="lg" icon={Check} className="shrink-0" data-smart-event="task_completed" onClick={() => completeTask(task)}>
          Done
        </Button>
      </div>
      {/* One footer line: what comes next on the left, quiet follow-up links on the right. */}
      <div className="mt-4 pt-3 border-t border-line flex items-center gap-x-4 gap-y-1.5 flex-wrap text-sm text-muted">
        {next ? (
          <span className="min-w-0 truncate">
            Then <span className="text-fg font-medium">{next.task.title}</span> · {duration(next.block.minutes)}
          </span>
        ) : null}
        <span className="sm:ml-auto flex flex-wrap gap-x-4 gap-y-1">
          <TextButton onClick={() => select({ kind: "why", id: task.id })}>Why this task?</TextButton>
          <TextButton onClick={() => select({ kind: "gap", startMs: block.start.getTime() })}>See this free gap</TextButton>
        </span>
      </div>
    </div>
  );
}

/**
 * A big, easy target for adding something to the plan straight from the
 * dashboard. White, not blue, so Done stays the one primary button on the screen;
 * its size and the accent icon make it easy to find.
 */
function AddTaskTile() {
  const { openAddTask } = useApp();
  return (
    <button
      type="button"
      onClick={openAddTask}
      data-smart-event="add_task_opened"
      className="card w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition hover:border-accent/50 hover:shadow-[var(--shadow-md)] group"
    >
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white" aria-hidden>
        <Plus size={22} strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">Add a task</span>
        <span className="block text-sm text-muted">Homework, study time, anything else</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// One day: what's on, and the free time between it
// ---------------------------------------------------------------------------

/**
 * The next seven days as one row that always fits: a short weekday on top and the
 * date under it, like the week strip in a phone's calendar. Nothing scrolls sideways.
 */
function DayPicker() {
  const { plan, planDay, setPlanDay } = useApp();
  return (
    <SegmentedControl
      label="Day to show"
      stretch
      value={planDay}
      onChange={setPlanDay}
      options={plan.days.slice(0, 7).map((d, i) => ({
        id: i,
        label: i === 0 ? "Today" : format(d.date, "EEE"),
        sub: format(d.date, "d"),
        ariaLabel: i === 0 ? `Today, ${format(d.date, "MMMM d")}` : i === 1 ? `Tomorrow, ${format(d.date, "EEEE MMMM d")}` : format(d.date, "EEEE, MMMM d"),
      }))}
    />
  );
}

function DaySchedule() {
  const { plan, planDay, model, now, ws, select, setView } = useApp();
  const day = plan.days[planDay];
  const dueLater = model.tasks.filter((t) => !t.done && t.dueAt && Date.parse(t.dueAt) > now.getTime()).length;
  const schedule = useMemo(() => buildDaySchedule(day.date, day, model.events, model.tasks), [day, model.events, model.tasks]);
  const isToday = planDay === 0;
  // On today, what has already happened is behind you.
  const items = isToday ? schedule.items.filter((it) => (it.kind === "due" ? it.start : it.end).getTime() > now.getTime()) : schedule.items;
  const capReached = day.plannedMinutes >= ws.prefs.dailyMax;
  const dueAllDay = schedule.dueAllDay.filter((t) => !t.done);

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
        <CalendarClock size={18} className="text-muted" aria-hidden />
        {isToday ? "The rest of today" : format(day.date, "EEEE, MMMM d")}
      </h2>
      <div className="mt-3">
        <DayPicker />
      </div>

      {schedule.allDayEvents.length > 0 || dueAllDay.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {schedule.allDayEvents.map((e) => (
            <button key={e.id} type="button" onClick={() => select({ kind: "event", id: e.id })} className="course-chip px-2 py-0.5 text-xs font-medium" style={courseStyle(e.color)}>
              {e.title}
            </button>
          ))}
          {dueAllDay.map((t) => (
            <button key={t.id} type="button" onClick={() => select({ kind: "task", id: t.id })} className="due-chip px-2 py-0.5 text-xs">
              <Flag size={11} aria-hidden />
              <span className="font-semibold">Due {isToday ? "today" : "this day"}:</span> {t.title}
            </button>
          ))}
        </div>
      ) : null}

      {!day.working ? (
        <p className="mt-4 text-sm text-muted">
          You have weekends off, so no work is planned.{" "}
          <TextButton onClick={() => setView("settings")}>Change this</TextButton>
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{isToday ? "Nothing else today." : "Nothing on this day."}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {items.map((item) => (
            <Row key={item.key} item={item} capReached={capReached} />
          ))}
        </ol>
      )}

      {/* Everything due later lives on Upcoming. */}
      <div className="mt-5 pt-3 border-t border-line flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted">{dueLater ? `${plural(dueLater, "task")} due in the coming weeks.` : "Nothing else is due."}</span>
        {dueLater ? (
          <TextButton className="ml-auto inline-flex items-center gap-1" onClick={() => setView("upcoming")}>
            See everything that&apos;s due
            <ArrowRight size={14} aria-hidden />
          </TextButton>
        ) : null}
      </div>
    </Card>
  );
}

function Row({ item, capReached }: { item: ScheduleItem; capReached: boolean }) {
  if (item.kind === "free") {
    return (
      <TimelineRow marker="free" start={clock(item.start)} end={clock(item.end)}>
        <FreeBlock item={item} capReached={capReached} />
      </TimelineRow>
    );
  }
  if (item.kind === "due") {
    return (
      <TimelineRow marker="due" start={clock(item.start)}>
        <DueRow task={item.task} />
      </TimelineRow>
    );
  }
  return (
    <TimelineRow start={clock(item.start)} end={clock(item.end)} color={item.event.color}>
      <EventRow item={item} />
    </TimelineRow>
  );
}

function EventRow({ item }: { item: Extract<ScheduleItem, { kind: "event" }> }) {
  const { model, select } = useApp();
  const e = item.event;
  const course = e.courseId ? model.courseById.get(e.courseId) : undefined;
  const details = [
    course ? (course.code !== e.title ? course.code : null) : e.feedId ? (model.feedById.get(e.feedId)?.name ?? null) : null,
    e.kind === "class" ? "Class" : e.kind === "exam" ? "Exam" : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => select({ kind: "event", id: e.id })}
      className="event-block w-full text-left px-3 py-2"
      style={courseStyle(e.color)}
    >
      <div className="event-title text-sm font-semibold truncate">{e.title}</div>
      <div className="text-xs text-muted flex items-center gap-1.5 min-w-0">
        {details.length ? <span className="truncate">{details.join(" · ")}</span> : null}
        {e.location ? (
          <span className="inline-flex items-center gap-0.5 truncate">
            <MapPin size={11} className="shrink-0" />
            {e.location}
          </span>
        ) : null}
        {!e.busy ? <span className="text-faint">doesn&apos;t block your time</span> : null}
      </div>
    </button>
  );
}

function FreeBlock({ item, capReached }: { item: Extract<ScheduleItem, { kind: "free" }>; capReached: boolean }) {
  const { select } = useApp();
  const note =
    item.leftover >= 15
      ? item.work.length === 0
        ? capReached
          ? "You've hit your daily work limit, so this time stays free."
          : "Nothing due soon fits here. It's yours."
        : `${duration(item.leftover)} left over${capReached ? " (daily work limit reached)" : ""}`
      : null;
  return (
    <FreeGapBlock
      minutes={item.minutes}
      label={`Free · ${duration(item.minutes)}`}
      note={note}
      onOpen={() => select({ kind: "gap", startMs: item.start.getTime() })}
    >
      {item.work.length > 0 ? item.work.map((w) => <WorkRow key={`${w.task.id}:${w.block.part}`} work={w} />) : null}
    </FreeGapBlock>
  );
}

/** Work planned into a free gap: the class, when it's due, and the time it takes from this gap. */
function WorkRow({ work }: { work: PlannedWork }) {
  const { task, block } = work;
  const course = useCourse(task);
  return (
    <li>
      <AppTaskCard
        task={task}
        meta={
          <>
            {course ? <ClassChip code={course.code} color={course.color} /> : null}
            <DueTag task={task} />
            {block.parts > 1 ? <span>part {block.part} of {block.parts}</span> : null}
          </>
        }
        trailing={<span className="text-sm font-semibold tabular-nums">{duration(block.minutes)}</span>}
      />
    </li>
  );
}

/** A deadline on the timeline: an amber flag chip, so it never looks like planned work. */
function DueRow({ task }: { task: Task }) {
  const { select, now } = useApp();
  const course = useCourse(task);
  const late = !task.done && Boolean(task.dueAt && Date.parse(task.dueAt) < now.getTime());
  return (
    <button
      type="button"
      onClick={() => select({ kind: "task", id: task.id })}
      data-late={late || undefined}
      className={`due-chip w-full text-left px-2.5 py-1.5 text-xs ${task.done ? "opacity-50 line-through" : ""}`}
    >
      <Flag size={13} aria-hidden />
      <span className="font-semibold shrink-0">Due</span>
      <span className="truncate">{task.title}</span>
      {course ? (
        <span className="course-text shrink-0 ml-auto font-medium" style={courseStyle(course.color)}>
          {course.code}
        </span>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Today's goal
// ---------------------------------------------------------------------------

/**
 * A visual for the day's goal: finish what SmartScheduler planned for today. A
 * ring fills as tasks are ticked off, and anything that won't fit before it's due
 * is flagged here, so the student always knows whether they're on track.
 */
let goalReachedOn: string | null = null;

function TodayGoal({ compact = false }: { compact?: boolean }) {
  const { model, plan, ws, now, setView } = useApp();
  const goal = useMemo(() => {
    const isToday = (iso: string) => !iso.startsWith("auto:") && isSameDay(new Date(iso), now);
    const done = model.tasks.filter((t) => t.done && ws.done[t.id] && isToday(ws.done[t.id])).length;
    const today = plan.days[0];
    const left = new Set((today?.blocks ?? []).map((b) => b.taskId)).size;
    const minutesLeft = (today?.blocks ?? []).reduce((sum, b) => sum + b.minutes, 0);
    return { done, left, total: done + left, minutesLeft };
  }, [model.tasks, ws.done, plan.days, now]);
  const risky = plan.atRisk.length;
  const reached = goal.total > 0 && goal.left === 0;

  // A smart event the first time today's goal is reached (once a day, however many cards show it).
  const day = format(now, "yyyy-MM-dd");
  useEffect(() => {
    if (!reached || goalReachedOn === day) return;
    goalReachedOn = day;
    trackEvent("goal_reached", { tasks: goal.total });
  }, [reached, day, goal.total]);

  const title = goal.total === 0 ? "Nothing planned today" : reached ? "Goal reached" : "Finish today's plan";
  const detail =
    goal.total === 0
      ? model.tasks.some((t) => !t.done)
        ? "No free time today fits the work that's due. Check tomorrow's plan."
        : "You're all caught up."
      : reached
        ? `You finished all ${plural(goal.total, "task")} planned for today.`
        : `${goal.done} of ${plural(goal.total, "task")} done · ${duration(goal.minutesLeft)} of work left today`;

  const warning =
    risky > 0 ? (
      <p className="flex items-start gap-1.5 text-sm text-danger font-semibold">
        <CircleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          {risky === 1 ? "1 task won't fit before it's due." : `${risky} tasks won't fit before they're due.`}{" "}
          <TextButton className="font-semibold" onClick={() => setView("upcoming")}>
            See {risky === 1 ? "it" : "them"}
          </TextButton>
        </span>
      </p>
    ) : null;

  if (compact) {
    return (
      <Card padding="sm" aria-label="Today's goal">
        <div className="flex items-center gap-3">
          <GoalRing done={goal.done} total={goal.total} size={48} />
          <div className="min-w-0">
            <SectionLabel>Today&apos;s goal</SectionLabel>
            <p className="font-semibold leading-snug">{title}</p>
            <p className="text-sm text-muted leading-snug">{detail}</p>
          </div>
        </div>
        {warning ? <div className="mt-2">{warning}</div> : null}
      </Card>
    );
  }

  return (
    <Card aria-label="Today's goal">
      <SectionLabel>Today&apos;s goal</SectionLabel>
      <div className="mt-3 flex flex-col items-center text-center">
        <GoalRing done={goal.done} total={goal.total} size={104} />
        <p className="mt-3 font-semibold text-lg leading-snug">{title}</p>
        <p className="mt-0.5 text-sm text-muted leading-relaxed">{detail}</p>
      </div>
      {warning ? <div className="mt-4 pt-3 border-t border-line">{warning}</div> : null}
    </Card>
  );
}

/** A progress ring: tasks done out of today's goal. Green, the same as a ticked box. */
function GoalRing({ done, total, size }: { done: number; total: number; size: number }) {
  const stroke = size >= 80 ? 9 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const reached = total > 0 && done === total;
  return (
    <div className="relative shrink-0 grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={total ? `${done} of ${total} tasks done today` : "No tasks planned today"}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ok)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        {reached ? (
          <Check size={size >= 80 ? 34 : 20} strokeWidth={3} className="text-ok" aria-hidden />
        ) : total === 0 ? (
          <span className={`font-bold text-muted ${size >= 80 ? "text-2xl" : "text-sm"}`}>–</span>
        ) : (
          <span className={`font-bold tabular-nums ${size >= 80 ? "text-2xl" : "text-sm"}`}>
            {done}
            <span className="text-muted font-semibold">/{total}</span>
          </span>
        )}
      </span>
    </div>
  );
}
