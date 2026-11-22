"use client";

/**
 * Suggest: the first screen people see. One clear "Work on now" answer, then a
 * short list of what else to put on the calendar. They still place everything
 * themselves — the page only ranks and explains.
 */
import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { nextUpReason, pickNextUp, pickSuggestions, slotWhen, type NextUp } from "@/lib/nextUp";
import { todoList } from "@/lib/todos";
import type { Task } from "@/lib/types";
import { readFirstAha, writeFirstAha, type FirstAha } from "./store";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";

/** Work still to schedule, soonest-due first (same ranking as the calendar planner). */
function useUnscheduled(): Task[] {
  const { model, ws, now } = useApp();
  return useMemo(
    () =>
      todoList({
        tasks: model.tasks,
        blocks: ws.blocks,
        now,
        scope: "all",
        sort: "due",
        classOrder: [],
        policy: ws.unfinished,
        answers: ws.unfinishedAnswers,
      }),
    [model.tasks, ws.blocks, ws.unfinished, ws.unfinishedAnswers, now],
  );
}

export function SuggestionsPage() {
  const { plan, now, model, select, scheduleTask, setView, setCalMode, setCalCursor, ws } = useApp();
  const todos = useUnscheduled();
  const gaps = useMemo(() => plan.days.flatMap((d) => d.gaps), [plan.days]);
  const next = useMemo(() => pickNextUp(todos, gaps, now), [todos, gaps, now]);
  const more = useMemo(() => {
    const all = pickSuggestions(todos, gaps, now, 7);
    return next ? all.filter((s) => s.task.id !== next.task.id).slice(0, 6) : all.slice(0, 6);
  }, [todos, gaps, now, next]);

  const [aha, setAha] = useState<FirstAha>(() => readFirstAha());
  const demo = Boolean(ws.demo);

  const place = (item: NextUp, fromHero: boolean) => {
    if (!item.slot) return;
    scheduleTask(item.task, item.slot.start);
    if (aha === "ready") {
      writeFirstAha("won");
      setAha("won");
    }
    if (fromHero) {
      // Keep them on Suggest so the win lands here; Calendar is one tap away.
    }
  };

  const seeOnCalendar = (item: NextUp) => {
    if (item.slot) {
      setCalCursor(item.slot.start);
      setCalMode("day");
    }
    setView("calendar");
  };

  const dismissAha = () => {
    writeFirstAha(null);
    setAha(null);
  };

  return (
    <div className="ss-suggest-page">
      <header className="ss-tasks-header">
        <div>
          <span className="ss-eyebrow">
            <SsIcon name="spark" size={14} /> SUGGEST
          </span>
          <h1>What to put on your schedule.</h1>
          <p>Ranked by what&apos;s due soonest and what fits your free gaps. You choose what to add.</p>
        </div>
      </header>

      {aha === "ready" && demo ? (
        <aside className="ss-suggest-coach" aria-live="polite">
          <SsIcon name="spark" size={18} />
          <div>
            <strong>Try your first win</strong>
            <p>You have free time coming up. Put the next task on your calendar in one tap — then you&apos;ll see it on Calendar.</p>
          </div>
        </aside>
      ) : null}

      {aha === "won" ? (
        <aside className="ss-suggest-win" aria-live="polite">
          <SsIcon name="check" size={18} />
          <div>
            <strong>It&apos;s on your calendar</strong>
            <p>That&apos;s the loop: Suggest ranks the work, you place it, Calendar holds the plan.</p>
          </div>
          <button type="button" className="ss-primary" onClick={() => { dismissAha(); setView("calendar"); }}>
            See it on Calendar
          </button>
          <button type="button" className="ss-suggest-dismiss" onClick={dismissAha} aria-label="Dismiss">
            <SsIcon name="x" size={16} />
          </button>
        </aside>
      ) : null}

      {next ? (
        <section
          className="ss-suggest-hero"
          style={{ "--task": (next.task.courseId ? model.courseById.get(next.task.courseId)?.color : null) ?? "var(--ss-personal)" } as React.CSSProperties}
          aria-labelledby="suggest-now-title"
          data-aha={aha === "ready" ? "ready" : undefined}
        >
          <span className="ss-suggest-hero-eyebrow" id="suggest-now-title">
            <SsIcon name="spark" size={12} /> WORK ON NOW
            {next.task.courseId ? ` · ${model.courseById.get(next.task.courseId)?.code ?? ""}` : " · Personal"}
          </span>
          <button type="button" className="ss-suggest-hero-task" onClick={() => select({ kind: "task", id: next.task.id })}>
            {next.task.title}
          </button>
          <p className="ss-suggest-hero-why">{nextUpReason(next, now)}</p>
          <div className="ss-suggest-hero-actions">
            {next.slot ? (
              <button
                type="button"
                className="ss-primary"
                onClick={() => place(next, true)}
                data-smart-event="next_up_placed"
                aria-label={`Put ${next.task.title} on the calendar at ${slotWhen(next.slot.start, now)}`}
              >
                <SsIcon name="calendar" size={16} />{" "}
                {isSameDay(next.slot.start, now) ? `Put it on at ${slotWhen(next.slot.start, now)}` : `Put it on · ${slotWhen(next.slot.start, now)}`}
              </button>
            ) : (
              <button type="button" className="ss-primary" onClick={() => select({ kind: "task", id: next.task.id })}>
                Pick a time
              </button>
            )}
            <button type="button" className="ss-suggest-secondary" onClick={() => seeOnCalendar(next)}>
              Open Calendar
            </button>
          </div>
        </section>
      ) : (
        <section className="ss-suggest-empty">
          <SsIcon name="check" size={22} />
          <h2>Nothing left to suggest</h2>
          <p>{todos.length === 0 ? "Everything due soon is already on your calendar — or you have no open work." : "No free gaps fit the work still on your list."}</p>
          <button type="button" className="ss-primary" onClick={() => setView("calendar")}>
            Open Calendar
          </button>
        </section>
      )}

      {more.length > 0 ? (
        <section className="ss-suggest-list" aria-labelledby="suggest-more-title">
          <div className="ss-suggest-list-head">
            <h2 id="suggest-more-title">Also worth scheduling</h2>
            <p>Add any of these when you&apos;re ready. Scheduled work leaves this list.</p>
          </div>
          <ul>
            {more.map((item) => {
              const course = item.task.courseId ? model.courseById.get(item.task.courseId) : undefined;
              const when = item.slot ? slotWhen(item.slot.start, now) : null;
              return (
                <li
                  key={item.task.id}
                  className="ss-suggest-row"
                  style={{ "--task": course?.color ?? "var(--ss-personal)" } as React.CSSProperties}
                >
                  <button type="button" className="ss-suggest-row-main" onClick={() => select({ kind: "task", id: item.task.id })}>
                    <span className="ss-suggest-row-title">{item.task.title}</span>
                    <span className="ss-suggest-row-meta">
                      {course ? course.code : "Personal"} · {nextUpReason(item, now)}
                    </span>
                  </button>
                  {item.slot && when ? (
                    <button
                      type="button"
                      className="ss-suggest-row-place"
                      onClick={() => place(item, false)}
                      data-smart-event="suggestion_placed"
                      aria-label={`Put ${item.task.title} on the calendar at ${when}`}
                    >
                      <SsIcon name="calendar" size={14} /> {isSameDay(item.slot.start, now) ? `At ${when}` : when}
                    </button>
                  ) : (
                    <button type="button" className="ss-suggest-row-place ss-suggest-row-place-quiet" onClick={() => select({ kind: "task", id: item.task.id })}>
                      Pick a time
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {next?.slot ? (
        <p className="ss-suggest-foot">
          Next free block: <b>{format(next.slot.start, "EEE · h:mm a")}</b>
          {" · "}
          <button type="button" className="ss-text-link" onClick={() => setView("tasks")}>
            See all tasks
          </button>
        </p>
      ) : null}
    </div>
  );
}
