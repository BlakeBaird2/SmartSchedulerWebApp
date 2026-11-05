"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, CircleHelp, Lock, Sparkles } from "lucide-react";
import { feedIdFor } from "@/lib/feeds/url";
import { defaultWorkspace, PERSONAL_COLORS } from "@/lib/workspace";
import type { FeedConfig, Workspace } from "@/lib/types";
import { useApp } from "./context";
import { FeedAdder, FeedList, ProviderHelp } from "./Feeds";
import { ClassTimesEditor } from "./ClassTimes";
import { KEYS, writeStored } from "./store";
import { CapabilityHero, PrototypeBadge } from "./Prototype";
import { AccountStep } from "./Account";
import { cloudAvailable, useCloud } from "./cloud";
import { Button, Card, Wordmark } from "./ui";
import { trackEvent } from "./smartEvents";

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
  writeStored(KEYS.ui, JSON.stringify({ view: "calendar", setupDone: true }));
  trackEvent("sample_data_started");
}

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { ws, model, toast } = useApp();
  const cloud = useCloud();
  // With sign-in available, setup opens by asking whether to use a Google account (step 0).
  const asksAccount = cloudAvailable;
  const [chosenStep, setStep] = useState<0 | 1 | 2>(asksAccount ? 0 : 1);
  const [helpOpen, setHelpOpen] = useState(false);
  // Signed in, here or by coming back from Google: on to calendars. (An account that
  // already has a setup brings it across, and setup closes on its own.)
  const step = chosenStep === 0 && (cloud.user || !asksAccount) ? 1 : chosenStep;
  // Sign-in (when offered), calendars, then class times. Working hours aren't asked here:
  // nothing fills the calendar on its own, so they live in Settings.
  const total = asksAccount ? 3 : 2;
  const shown = asksAccount ? step + 1 : step;
  const hasSchool = ws.feeds.some((f) => f.role === "school");
  const hasClasses = model.visibleCourses.length > 0;

  /** No link handy: leave setup with the sample calendars loaded, so the goal can still be tried. */
  const trySample = () => {
    startDemo();
    onFinish();
    toast("Sample data loaded so you can try the goal.");
  };

  return (
    <div className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/" className="inline-block" aria-label="Schedule Smart home page">
            <Wordmark size="lg" />
          </Link>
          <PrototypeBadge />
        </div>
        <CapabilityHero className="mt-6" />

        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-muted" aria-label={`Step ${shown} of ${total}`}>
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
            <span key={n} className={`h-1.5 w-10 rounded-full ${shown >= n ? "bg-accent" : "bg-line-strong/50"}`} />
          ))}
          <span className="ml-1">
            Step {shown} of {total}
          </span>
        </div>

        {step === 0 ? (
          <Card padding="lg" className="mt-3">
            <AccountStep onNext={() => setStep(1)} />
          </Card>
        ) : step === 1 ? (
          <Card padding="lg" className="mt-3 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Add your calendars</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">Paste a calendar link from Canvas, Learning Suite, Google, Outlook or Apple.</p>
            </div>
            {/* Until a calendar is added, Add calendar is the main action; after that, Continue is. */}
            <FeedAdder autoFocus primary={ws.feeds.length === 0} />
            {/* The help is one obvious button, opened only when wanted, so the step stays short. */}
            <div>
              <button type="button" className="ss-link-help" aria-expanded={helpOpen} onClick={() => setHelpOpen((o) => !o)}>
                <CircleHelp size={18} aria-hidden />
                <span>Where do I find my link?</span>
                <ChevronDown size={18} className="ml-auto" aria-hidden />
              </button>
              {helpOpen ? (
                <div className="mt-2">
                  <ProviderHelp heading={false} />
                </div>
              ) : null}
            </div>
            <FeedList />
            {ws.feeds.length > 0 && !hasSchool ? <p className="text-xs text-muted">No school calendar yet. You can still add work by hand.</p> : null}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {asksAccount && !cloud.user ? <Button icon={ArrowLeft} iconOnly label="Back" onClick={() => setStep(0)} /> : null}
              {/* Both ways forward sit together on the right: sample data (soft yellow) beside Continue (blue once a calendar is added). */}
              <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                {ws.feeds.length === 0 ? (
                  <Button icon={Sparkles} className="ss-sample-button" onClick={trySample} data-smart-event="sample_data_started">
                    Try sample data
                  </Button>
                ) : null}
                <Button
                  variant={ws.feeds.length === 0 ? "secondary" : "primary"}
                  trailingIcon={ArrowRight}
                  disabled={ws.feeds.length === 0}
                  title={ws.feeds.length === 0 ? "Add a calendar first, or try sample data" : undefined}
                  onClick={hasClasses ? () => setStep(2) : onFinish}
                  data-smart-event={hasClasses ? undefined : "setup_finished"}
                >
                  {hasClasses || ws.feeds.length === 0 ? "Continue" : "Open my calendar"}
                </Button>
              </div>
            </div>
          </Card>
        ) : step === 2 ? (
          <Card padding="lg" className="mt-3 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">When do your classes meet?</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Class calendars usually list what&apos;s due, not when class is. Add each class&apos;s days and times so they show on your calendar. Skip any
                class that doesn&apos;t meet in person.
              </p>
            </div>
            <ClassTimesEditor />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button icon={ArrowLeft} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" trailingIcon={ArrowRight} className="ml-auto" onClick={onFinish} data-smart-event="setup_finished">
                Open my calendar
              </Button>
            </div>
          </Card>
        ) : null}

        <p className="mt-5 text-xs text-muted leading-relaxed flex gap-2">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>
            Your calendar links stay in this browser{cloudAvailable ? ", and in your account if you sign in" : ""}. The server reads a calendar only to hand it
            back to you, and keeps nothing.
          </span>
        </p>
      </div>
    </div>
  );
}
