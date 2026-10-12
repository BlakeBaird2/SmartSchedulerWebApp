"use client";

import { Check, Link as LinkIcon, Plus } from "lucide-react";
import { ClassChip, FreeGapBlock, SectionLabel, TaskCard, Wordmark } from "./ui";

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

export function SketchEvent({ title, time, className = "" }: { title: string; time: string; className?: string }) {
  return (
    <div className={`event-block px-2 py-1 ${className}`} style={{ "--c": "#8a8a8a" } as React.CSSProperties}>
      <div className="text-[12px] font-semibold leading-tight">{title}</div>
      <div className="text-[11px] text-muted leading-tight">{time}</div>
    </div>
  );
}

/** The hero: a small Plan screen, the thing the sentence above it promises. */
export function PlanSketch() {
  return (
    <Sketch
      label="A sketch of the Plan screen: the task to work on now with a Done button, and this afternoon's free gap already filled with two tasks."
      className="rounded-2xl border border-line shadow-[var(--shadow-lg)] text-left"
    >
      <div className="flex items-center gap-3 border-b border-line-strong bg-surface px-4 py-2.5">
        <span className="scale-90 origin-left">
          <Wordmark />
        </span>
        <span className="ml-2 hidden sm:flex gap-1 text-sm">
          <span className="rounded-md bg-accent-soft text-accent font-semibold px-2">Plan</span>
          <span className="px-2 text-muted">Calendar</span>
          <span className="px-2 text-muted">Upcoming</span>
          <span className="px-2 text-muted">Classes</span>
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4 min-w-0">
          <div className="rounded-xl border border-accent/35 bg-surface p-4 shadow-[var(--shadow-md)]">
            <div className="text-sm">Free until 3:15 PM · 45m</div>
            <SectionLabel className="mt-3">Work on</SectionLabel>
            <div className="mt-1 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xl font-semibold leading-snug">Lab 6</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <ClassChip variant="tag" code="CS 142" color="#d97706" />
                  45m · due tomorrow
                </div>
              </div>
              {/* Ink, not blue: the page's one blue button is the real "Start planning" above. */}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-4 py-2 font-semibold">
                <Check size={16} strokeWidth={3} aria-hidden />
                Done
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
            <div className="font-bold">The rest of today</div>
            <div className="mt-3 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 items-start">
              <div className="pt-1 text-right text-xs">3:15 PM</div>
              <SketchEvent title="Work" time="3:15 – 6 PM" />
              <div className="pt-2 text-right text-xs">6:10 PM</div>
              <FreeGapBlock minutes={110} label="Free · 1h 50m">
                <li>
                  <TaskCard
                    title="Reading: Chapter 5"
                    onToggleDone={noop}
                    onOpen={noop}
                    color="#2563eb"
                    meta={<ClassChip code="BUS 301" color="#2563eb" />}
                    trailing={<span className="text-sm font-semibold">30m</span>}
                  />
                </li>
                <li>
                  <TaskCard
                    title="Problem Set 5"
                    onToggleDone={noop}
                    onOpen={noop}
                    color="#16a34a"
                    meta={<ClassChip code="ACC 200" color="#16a34a" />}
                    trailing={<span className="text-sm font-semibold">1h</span>}
                  />
                </li>
              </FreeGapBlock>
            </div>
          </div>
        </div>
        <div className="hidden md:block rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
          <div className="font-bold">Due this week</div>
          <SectionLabel className="mt-3 mb-1.5">Tomorrow</SectionLabel>
          <div className="space-y-1.5">
            <TaskCard
              title="Lab 6"
              density="compact"
              onToggleDone={noop}
              onOpen={noop}
              meta={
                <>
                  <ClassChip code="CS 142" color="#d97706" />
                  11:59 PM
                </>
              }
            />
            <TaskCard
              title="Case Write-Up 4"
              density="compact"
              onToggleDone={noop}
              onOpen={noop}
              meta={
                <>
                  <ClassChip code="BUS 301" color="#2563eb" />
                  9:30 AM
                </>
              }
            />
          </div>
          <SectionLabel className="mt-3 mb-1.5">Thursday</SectionLabel>
          <div className="space-y-1.5">
            <TaskCard
              title="Problem Set 5"
              density="compact"
              onToggleDone={noop}
              onOpen={noop}
              meta={
                <>
                  <ClassChip code="ACC 200" color="#16a34a" />
                  end of day
                </>
              }
            />
            <TaskCard
              title="Reading Response 5"
              density="compact"
              onToggleDone={noop}
              onOpen={noop}
              meta={
                <>
                  <ClassChip code="WRTG 150" color="#9333ea" />
                  11 AM
                </>
              }
            />
          </div>
        </div>
      </div>
    </Sketch>
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
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-stretch text-[11px]">
        <span className="pt-1 text-right">10 AM</span>
        <SketchEvent title="Class · CS 142" time="10 – 10:50 AM" />
        <span className="pt-1 text-right">11 AM</span>
        <Gap minutes="1h 10m" task={filled ? { title: "Lab 6", code: "CS 142", color: "#d97706", time: "1h" } : null} />
        <span className="pt-1 text-right">12:30</span>
        <SketchEvent title="Work" time="12:30 – 4 PM" />
        <span className="pt-1 text-right">4 PM</span>
        <Gap minutes="45m" task={filled ? { title: "Reading: Ch. 5", code: "BUS 301", color: "#2563eb", time: "30m" } : null} />
      </div>
    </Sketch>
  );
}

function Gap({ minutes, task }: { minutes: string; task: { title: string; code: string; color: string; time: string } | null }) {
  return (
    <div className="rounded-lg border border-dashed border-ok/50 bg-ok-soft px-2 py-1">
      <div className="font-bold text-[12px] leading-tight">Free · {minutes}</div>
      {task ? (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-line bg-surface px-1.5 py-0.5">
          <span className="w-3 h-3 border border-line-strong bg-surface shrink-0" aria-hidden />
          <span className="font-semibold truncate">{task.title}</span>
          <ClassChip code={task.code} color={task.color} />
          <span className="ml-auto font-semibold">{task.time}</span>
        </div>
      ) : null}
    </div>
  );
}
