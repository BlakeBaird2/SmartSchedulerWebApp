"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, Sparkles } from "lucide-react";
import { feedIdFor } from "@/lib/feeds/url";
import { defaultWorkspace, PERSONAL_COLORS } from "@/lib/workspace";
import type { FeedConfig, Workspace } from "@/lib/types";
import { useApp } from "./context";
import { FeedAdder, FeedList, ProviderHelp } from "./Feeds";
import { HoursForm, WeeklyEditor } from "./ScheduleSettings";
import { ClassTimesEditor } from "./ClassTimes";
import { KEYS, writeStored } from "./store";
import { CapabilityHero, GoalBadge, PrototypeBadge } from "./Prototype";
import { Button, Card, Wordmark } from "./ui";

function demoWorkspace(): Workspace {
  const feed = (url: string, name: string, role: FeedConfig["role"], provider: FeedConfig["provider"], color: string): FeedConfig => ({
    id: feedIdFor(url),
    url,
    name,
    role,
    provider,
    color,
    enabled: true,
  });
  const canvas = feedIdFor("demo:canvas");
  return {
    ...defaultWorkspace(),
    demo: true,
    // The sample Canvas calendar has meeting times for one class only, like most real ones.
    weekly: [
      { id: "demo-cs", label: "Class", courseId: `${canvas}:course_4102`, days: [1, 3, 5], start: "11:00", end: "11:50", location: "TMCB 1170" },
      { id: "demo-bus", label: "Class", courseId: `${canvas}:course_4101`, days: [2, 4], start: "11:30", end: "12:45", location: "TNRB 120" },
    ],
    feeds: [
      feed("demo:canvas", "Canvas (sample)", "school", "canvas", PERSONAL_COLORS[0]),
      feed("demo:course", "Principles of Accounting (sample)", "school", "other", PERSONAL_COLORS[1]),
      feed("demo:personal", "Personal (sample)", "personal", "google", PERSONAL_COLORS[0]),
    ],
  };
}

export function startDemo() {
  writeStored(KEYS.workspace, JSON.stringify(demoWorkspace()));
  writeStored(KEYS.snapshot, null);
  writeStored(KEYS.changes, null);
  writeStored(KEYS.ui, JSON.stringify({ view: "plan", setupDone: true }));
}

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { ws, model, toast } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const hasSchool = ws.feeds.some((f) => f.role === "school");
  const hasClasses = model.visibleCourses.length > 0;

  /** Leave setup and open a usable Plan. Keeps calendars already added; otherwise loads sample data. */
  const skip = () => {
    const hadFeeds = ws.feeds.length > 0;
    if (!hadFeeds) startDemo();
    onFinish();
    toast(
      hadFeeds
        ? "Setup skipped — your calendars are ready on Plan."
        : "Setup skipped — sample data loaded so you can try the goal.",
    );
  };

  return (
    <div className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/" className="inline-block" aria-label="SmartScheduler home page">
            <Wordmark size="lg" />
          </Link>
          <PrototypeBadge />
          <GoalBadge />
          {/* The one way out of setup, in the same place on every step (where onboarding usually puts Skip). */}
          <Button className="ml-auto" icon={ws.feeds.length === 0 ? Sparkles : undefined} onClick={skip}>
            {ws.feeds.length === 0 ? "Skip: try sample data" : "Skip setup"}
          </Button>
        </div>
        <CapabilityHero className="mt-6">
          <p className="mt-3 text-lg text-muted leading-relaxed">
            Add your calendars and SmartScheduler puts your classes, work and life in one place, then plans each free gap for you.
          </p>
        </CapabilityHero>

        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-muted" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-1.5 w-10 border border-line-strong ${step >= n ? "bg-fg" : "bg-surface"}`} />
          ))}
          <span className="ml-1">Step {step} of 3</span>
        </div>

        {step === 1 ? (
          <Card padding="lg" className="mt-3 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Add your calendars</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Start with your school calendar from Canvas, Learning Suite or any course site. SmartScheduler finds your classes and assignments on its own. Then add
                your work and personal calendars (Google, Outlook, Apple) so it knows when you&apos;re busy.
              </p>
            </div>
            {/* Until a calendar is added, Add calendar is the main action; after that, Continue is. */}
            <FeedAdder autoFocus primary={ws.feeds.length === 0} />
            <FeedList />
            <ProviderHelp />
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <Button
                variant={ws.feeds.length === 0 ? "secondary" : "primary"}
                trailingIcon={ArrowRight}
                disabled={ws.feeds.length === 0}
                title={ws.feeds.length === 0 ? "Add a calendar first, or skip setup to try sample data" : undefined}
                onClick={() => setStep(hasClasses ? 2 : 3)}
              >
                Continue
              </Button>
              {ws.feeds.length > 0 && !hasSchool ? (
                <span className="text-xs text-muted">No school calendar yet. You can still add work by hand.</span>
              ) : null}
              {ws.feeds.length === 0 ? (
                <span className="text-sm text-muted">No link handy? Use Skip at the top to try it with sample data.</span>
              ) : null}
            </div>
          </Card>
        ) : step === 2 ? (
          <Card padding="lg" className="mt-3 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">When do your classes meet?</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Class calendars usually list what&apos;s due, not when class is. Add each class&apos;s days and times once so they show on your calendar and
                SmartScheduler plans around them. Skip any class that doesn&apos;t meet in person.
              </p>
            </div>
            <ClassTimesEditor />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button icon={ArrowLeft} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" trailingIcon={ArrowRight} className="ml-auto" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </Card>
        ) : (
          <Card padding="lg" className="mt-3 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">When do you like to work?</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                SmartScheduler fills the gaps between your events with the work that&apos;s due soonest. Tell it when your day starts and ends.
              </p>
            </div>
            <HoursForm />
            <div>
              <h2 className="text-sm font-semibold">Anything else every week?</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted leading-relaxed">A job, practice, or commute that isn&apos;t on a calendar you added. You can skip this.</p>
              <WeeklyEditor />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button icon={ArrowLeft} onClick={() => setStep(hasClasses ? 2 : 1)}>
                Back
              </Button>
              <Button variant="primary" trailingIcon={ArrowRight} className="ml-auto" onClick={onFinish}>
                Build my plan
              </Button>
            </div>
          </Card>
        )}

        <p className="mt-5 text-xs text-muted leading-relaxed flex gap-2">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>
            No account needed. Your calendar links and everything you set here stay in this browser. The server reads a calendar only to hand it back to you,
            and keeps nothing. Setup is optional: Skip opens the app with sample data if you haven&apos;t added a calendar yet.
          </span>
        </p>
      </div>
    </div>
  );
}
