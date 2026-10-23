"use client";

import { Check, Link as LinkIcon, Plus } from "lucide-react";
import { ClassChip, DueBadge, FreeGapBlock, SectionLabel, TaskCard, TimelineRow, Wordmark } from "./ui";

/**
 * Wireframe drawings of the app for the home page, built from the real design
 * library parts so they always match the app. They are pictures, not controls:
 * `inert` keeps them out of the keyboard order and away from clicks, and each one
 * has a plain-words label for screen readers.
 */

const noop = () => {};

export function Sketch({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden bg-surface-2 select-none ${className}`}>
      <div inert className="contents">
        {children}
      </div>
    </div>
  );
}

export function SketchEvent({ title, time, color = "#78716c", className = "" }: { title: string; time: string; color?: string; className?: string }) {
  return (
    <div className={`event-block px-2 py-1 ${className}`} style={{ "--c": color } as React.CSSProperties}>
      <div className="event-title text-[12px] font-semibold leading-tight">{title}</div>
      <div className="text-[11px] text-muted leading-tight">{time}</div>
    </div>
  );
}

/**
 * The hero picture: the Plan screen inside a browser window, turned three-quarters
 * in 3D like a product shot. The tilt, the window frame, the "Preview" tag and the
 * caption all say "this is a picture of the app", so nobody tries to click it.
 */
export function PlanSketch() {
  return (
    <figure className="picture-stage">
      <div className="picture-tilt">
        <Sketch
          label="A picture of the Plan screen: the task to work on now with a Done button, today's goal ring, and this evening's free gap already filled with two tasks."
          className="rounded-2xl border border-line text-left"
        >
          {/* Browser window frame: the clearest signal that this is a screenshot. */}
          <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </span>
            <span className="mx-auto max-w-[60%] truncate rounded-md bg-surface px-3 py-0.5 text-[11px] text-muted">smartschedulerwebapp.vercel.app/app</span>
            <span className="w-10" aria-hidden />
          </div>
          <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
            <span className="scale-90 origin-left">
              <Wordmark />
            </span>
            <span className="ml-2 hidden sm:flex gap-1 text-sm">
              <span className="rounded-md bg-surface-2 border border-line text-fg font-semibold px-2">Plan</span>
              <span className="px-2 text-muted">Calendar</span>
              <span className="px-2 text-muted">Upcoming</span>
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="space-y-4 min-w-0">
              <div className="rounded-xl border-2 border-accent/50 bg-surface p-4 shadow-[var(--shadow-md)]">
                <div className="text-sm">Free until 3:15 PM · 45m</div>
                <SectionLabel className="mt-3">Work on</SectionLabel>
                <div className="mt-1 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold leading-snug">Lab 6</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted flex-wrap">
                      <ClassChip variant="tag" code="CS 142" color="#d97706" />
                      45m
                      <DueBadge>Due tomorrow 11:59 PM</DueBadge>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-4 py-2 font-semibold">
                    <Check size={16} strokeWidth={3} aria-hidden />
                    Done
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
                <div className="font-bold">The rest of today</div>
                <ol className="mt-3 space-y-2.5">
                  <TimelineRow start="3:15 PM" end="6 PM" color="#78716c">
                    <SketchEvent title="Work" time="3:15 – 6 PM" />
                  </TimelineRow>
                  <TimelineRow marker="free" start="6:10 PM" end="8 PM">
                    <FreeGapBlock minutes={110} label="Free · 1h 50m">
                      <li>
                        <TaskCard
                          title="Reading: Chapter 5"
                          onToggleDone={noop}
                          onOpen={noop}
                          color="#2563eb"
                          meta={
                            <>
                              <ClassChip code="BUS 301" color="#2563eb" />
                              <DueBadge>Due Wed</DueBadge>
                            </>
                          }
                          trailing={<span className="text-sm font-semibold">30m</span>}
                        />
                      </li>
                      <li>
                        <TaskCard
                          title="Problem Set 5"
                          onToggleDone={noop}
                          onOpen={noop}
                          color="#16a34a"
                          meta={
                            <>
                              <ClassChip code="ACC 200" color="#16a34a" />
                              <DueBadge>Due Thu</DueBadge>
                            </>
                          }
                          trailing={<span className="text-sm font-semibold">1h</span>}
                        />
                      </li>
                    </FreeGapBlock>
                  </TimelineRow>
                </ol>
              </div>
            </div>
            <div className="hidden md:block space-y-4">
              <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] text-center">
                <SectionLabel className="text-left">Today&apos;s goal</SectionLabel>
                <SketchRing />
                <div className="mt-2 font-semibold">Finish today&apos;s plan</div>
                <div className="text-sm text-muted">2 of 4 done · 1h 30m left</div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)] flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden>
                  <Plus size={20} strokeWidth={2.4} />
                </span>
                <span>
                  <span className="block font-semibold">Add a task</span>
                  <span className="block text-xs text-muted">Homework, study time, anything else</span>
                </span>
              </div>
            </div>
          </div>
        </Sketch>
        <span className="picture-tag" aria-hidden>
          Preview
        </span>
      </div>
      <figcaption className="mt-6 text-center text-sm text-muted">A picture of the Plan screen. Open the app to try it with your own calendars or sample data.</figcaption>
    </figure>
  );
}

/** The goal ring from the Plan screen, drawn at 2 of 4. */
function SketchRing() {
  const size = 92;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto mt-2 grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ok)" strokeWidth={10} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c / 2} />
      </svg>
      <span className="absolute text-xl font-bold tabular-nums">
        2<span className="text-muted">/4</span>
      </span>
    </div>
  );
}

/** Step 1: a calendar link pasted in, and the calendar it became. */
export function LinkSketch() {
  return (
    <Sketch label="A sketch of pasting a Canvas calendar link and pressing Add calendar." className="h-56 p-4 flex flex-col justify-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm">
          <LinkIcon size={14} className="shrink-0 text-muted" aria-hidden />
          <span className="truncate">https://byu.instructure.com/feeds/…ics</span>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-semibold">
          <Plus size={14} aria-hidden />
          Add calendar
        </span>
      </div>
      <div className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm">
        <div className="font-semibold">Canvas</div>
        <div className="text-xs text-muted">4 classes · 28 tasks due · added</div>
      </div>
    </Sketch>
  );
}

/** Steps 2 and 3: a day with its busy blocks, and the free gaps between them, empty or filled. */
export function DaySketch({ filled, className = "h-56" }: { filled: boolean; className?: string }) {
  return (
    <Sketch
      label={
        filled
          ? "A sketch of a day where each free gap between classes and work holds the task due soonest."
          : "A sketch of a day with classes and work blocked out, and the free gaps between them marked."
      }
      className={`${className} px-4 py-3`}
    >
      <ol className="space-y-1.5 text-[11px]">
        <TimelineRow start="10 AM" end="10:50" color="#d97706">
          <SketchEvent title="Class · CS 142" time="10 – 10:50 AM" color="#d97706" />
        </TimelineRow>
        <TimelineRow marker="free" start="11 AM" end="12:10">
          <Gap minutes="1h 10m" task={filled ? { title: "Lab 6", code: "CS 142", color: "#d97706", time: "1h" } : null} />
        </TimelineRow>
        <TimelineRow start="12:30" end="4 PM">
          <SketchEvent title="Work" time="12:30 – 4 PM" />
        </TimelineRow>
        <TimelineRow marker="free" start="4 PM" end="4:45">
          <Gap minutes="45m" task={filled ? { title: "Reading: Ch. 5", code: "BUS 301", color: "#2563eb", time: "30m" } : null} />
        </TimelineRow>
      </ol>
    </Sketch>
  );
}

function Gap({ minutes, task }: { minutes: string; task: { title: string; code: string; color: string; time: string } | null }) {
  return (
    <div className="pb-0.5">
      <div className="pt-1.5 font-bold text-[12px] leading-tight text-ok">Free · {minutes}</div>
      {task ? (
        <div className="task-card mt-1 flex items-center gap-2 px-1.5 py-0.5" style={{ "--c": task.color } as React.CSSProperties}>
          <span className="w-3 h-3 rounded-[4px] border border-line-strong bg-surface shrink-0" aria-hidden />
          <span className="font-semibold truncate">{task.title}</span>
          <ClassChip code={task.code} color={task.color} />
          <span className="ml-auto font-semibold">{task.time}</span>
        </div>
      ) : null}
    </div>
  );
}
