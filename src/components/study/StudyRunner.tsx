"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Mic, MonitorUp, RotateCcw, SkipForward } from "lucide-react";
import {
  ALT_EASE,
  COMPARE_HINT,
  SCENARIO,
  SCREENER,
  SURVEY,
  TASKS,
  TASK_EASE,
  TEAM,
  THINK_ALOUD_EXAMPLE,
  THINK_ALOUD_REMINDER,
  STUDY_VERSION,
  type Question,
  type StudyTask,
} from "@/lib/study/config";
import type { Answer, StudyRecord, TaskResult } from "@/lib/study/results";
import { SMART_EVENT, type SmartEvent } from "../smartEvents";
import { backend } from "./backend";
import { QuestionList, QuestionScreen, isAnswered } from "./Questions";
import { SessionRecorder, askMicrophone, askScreen, canRecordScreen, micLevel, type RecorderStatus } from "./recorder";

/*
 * The participant's side of the unmoderated usability test, at /study.
 *
 *   welcome → about you → recording + think-aloud → scenario → 4 tasks → survey → done
 *
 * The tasks run in the real app, in a frame under a bar holding the task, with
 * its own fresh copy of the sample data (store.ts keeps it apart from anything
 * of the participant's own). Every step is saved as it happens.
 */

type Step = "welcome" | "about" | "record" | "scenario" | "tasks" | `survey-${number}` | "finish";
/** After the tasks, one question per screen, each knowing the section it's from. */
const SURVEY_QUESTIONS = SURVEY.flatMap((page) => page.questions.map((q, k) => ({ page, q, firstOfPage: k === 0 })));
const STEPS: Step[] = ["welcome", "about", "record", "scenario", "tasks", ...SURVEY_QUESTIONS.map((_, i) => `survey-${i}` as Step), "finish"];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${String(Math.random()).slice(2)}`;
}

function newCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

function freshRecord(): StudyRecord {
  const now = new Date().toISOString();
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 700;
  return {
    id: newId(),
    code: newCode(),
    studyVersion: STUDY_VERSION,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    step: "welcome",
    order: Math.random() < 0.5 ? "A-first" : "B-first",
    device: { userAgent: navigator.userAgent, screen: `${window.screen.width}x${window.screen.height}`, mobile },
    consent: false,
    recording: { kind: "none", mimeType: null, startedAt: null, endedAt: null, chunks: 0, bytes: 0, stoppedEarly: false },
    answers: {},
    tasks: {},
  };
}

/** Gives the app in the frame a clean start on the sample data, without its tour or sign-in questions. */
function resetStudyApp() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("study:")) localStorage.removeItem(k);
    }
    localStorage.setItem("study:prio:tour", new Date().toISOString());
    localStorage.setItem("study:prio:signin-ask", "never");
  } catch {
    /* storage blocked: the app falls back to memory and still starts on sample data */
  }
}

export function StudyRunner() {
  const [rec, setRec] = useState<StudyRecord>(freshRecord);
  const recRef = useRef(rec);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const recorder = useRef<SessionRecorder | null>(null);
  const [activeRecorder, setActiveRecorder] = useState<SessionRecorder | null>(null);
  const [recStatus, setRecStatus] = useState<RecorderStatus | null>(null);

  /** Change the record and save it (saves run one after another, newest last). */
  const update = useCallback((fn: (r: StudyRecord) => StudyRecord) => {
    const next = { ...fn(recRef.current), updatedAt: new Date().toISOString() };
    if (recorder.current) {
      const s = recorder.current.status;
      next.recording = { ...next.recording, chunks: s.chunks, bytes: s.savedBytes };
    }
    recRef.current = next;
    setRec(next);
    if (!next.consent) return; // Nothing is kept until they agree.
    saving.current = saving.current
      .then(() => backend.save(next))
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  }, []);

  const setAnswer = useCallback((id: string, value: Answer) => update((r) => ({ ...r, answers: { ...r.answers, [id]: value } })), [update]);
  const goTo = useCallback((step: Step) => {
    update((r) => ({ ...r, step }));
    window.scrollTo(0, 0);
  }, [update]);

  const step = rec.step as Step;
  /** Resolves once every save so far has finished. */
  const saveDone = useCallback(() => saving.current, []);

  // Leaving partway through asks first.
  useEffect(() => {
    if (step === "welcome" || step === "finish") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  const startRecording = useCallback(
    (streams: MediaStream[], kind: StudyRecord["recording"]["kind"]) => {
      const r = new SessionRecorder(streams, (n, bytes) => backend.addChunk(recRef.current.id, n, bytes));
      r.onChange = setRecStatus;
      recorder.current = r;
      setActiveRecorder(r);
      for (const s of streams)
        for (const t of s.getVideoTracks())
          t.addEventListener("ended", () => {
            if (!recRef.current.finishedAt) update((x) => ({ ...x, recording: { ...x.recording, stoppedEarly: true } }));
          });
      update((x) => ({ ...x, recording: { ...x.recording, kind, mimeType: r.mime, startedAt: r.startedAt } }));
    },
    [update],
  );

  const index = STEPS.indexOf(step);
  const content = (() => {
    if (step === "welcome") return <Welcome onStart={() => update((r) => ({ ...r, consent: true, step: "about" }))} />;
    if (step === "about")
      return <QuestionPage page={SCREENER} answers={rec.answers} onAnswer={setAnswer} onNext={() => goTo("record")} />;
    if (step === "record") return <RecordStep onReady={startRecording} onNext={() => goTo("scenario")} />;
    if (step === "scenario") return <Scenario onNext={() => goTo("tasks")} />;
    if (step === "tasks") return null;
    if (step.startsWith("survey-")) {
      const i = Number(step.slice("survey-".length));
      const { page, q, firstOfPage } = SURVEY_QUESTIONS[i];
      const last = i + 1 >= SURVEY_QUESTIONS.length;
      return (
        <QuestionScreen
          key={q.id}
          q={q}
          answers={rec.answers}
          onAnswer={setAnswer}
          onNext={() => goTo(last ? "finish" : (`survey-${i + 1}` as Step))}
          nextLabel={last ? "Finish" : "Next"}
          kicker={`${page.title} · Question ${i + 1} of ${SURVEY_QUESTIONS.length}`}
          hint={q.kind === "compare" ? COMPARE_HINT : firstOfPage ? page.intro : undefined}
        />
      );
    }
    return <Finish rec={rec} recorder={activeRecorder} recStatus={recStatus} update={update} saveDone={saveDone} />;
  })();

  if (step === "tasks") {
    return (
      <TaskPhase
        rec={rec}
        update={update}
        setAnswer={setAnswer}
        recorder={activeRecorder}
        onDone={() => goTo("survey-0")}
        saveError={saveError}
      />
    );
  }

  return (
    <div className="study-shell">
      <header className="study-header">
        <div className="font-bold tracking-tight">Schedule Smart · Usability test</div>
        <div className="flex items-center gap-3">
          {activeRecorder && step !== "finish" ? <RecDot since={rec.recording.startedAt} /> : null}
          <span className="text-sm text-muted">About 10 minutes</span>
        </div>
      </header>
      <div className="study-progress" aria-hidden>
        <div style={{ width: `${Math.round((index / (STEPS.length - 1)) * 100)}%` }} />
      </div>
      <main className="study-card">{content}</main>
      {saveError ? (
        <p className="study-toast" role="status">
          Having trouble saving. Check your internet connection; we&apos;ll keep trying.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setting the stage
// ---------------------------------------------------------------------------

function Welcome({ onStart }: { onStart: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileOk, setMobileOk] = useState(false);
  const desktop = canRecordScreen() && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await backend.begin();
      onStart();
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? ` (${String((e as { code: unknown }).code)})` : "";
      setError(`We couldn't connect to save your answers${code}. Check your internet connection and try again.`);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="study-kicker">Thanks for helping!</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mt-1">Help us test Schedule Smart</h1>
        <p className="mt-3 text-lg leading-relaxed">
          We&apos;re {TEAM}, students building <strong>Schedule Smart</strong>: a planner that puts your classes, job and life on one calendar and shows what to
          work on in each free gap. You&apos;ll try it on your own, at your own pace. It takes <strong>about 10 minutes</strong>.
        </p>
      </div>

      <ol className="study-steps">
        <li>
          <span>
            <b>A few questions</b> about how you plan your week.
          </span>
        </li>
        <li>
          <span>
            <b>Four short tasks</b> in the app, while you <b>think out loud</b>.
          </span>
        </li>
        <li>
          <span>
            <b>A short survey</b> about how it went.
          </span>
        </li>
      </ol>

      <div className="study-callout space-y-2">
        <p>
          <b>We&apos;re testing the app, not you.</b> There are no wrong answers and nothing you can break. If something is confusing, that&apos;s the app&apos;s
          fault, and exactly what we need to find.
        </p>
        <p>
          <b>You&apos;re the expert here.</b> You know how you really juggle classes and everything else; we&apos;re here to learn from you. Teach us: tell us
          what you&apos;d actually do, and what you&apos;d expect.
        </p>
        <p>
          <b>Please be brutally honest.</b> This is an early prototype, so expect rough edges and missing pieces. Critical feedback helps far more than
          compliments, and you won&apos;t hurt our feelings.
        </p>
      </div>

      <div className="text-sm text-muted leading-relaxed space-y-2">
        <p>
          <b className="text-fg">What we record:</b> this browser tab (not your other tabs or your desktop) and your voice while you do the tasks, plus your
          answers. The app uses made-up sample data, so none of your own calendars are shown. We don&apos;t ask your name. Recordings are only seen by our
          team for a class project, and you can stop at any time by closing the tab.
        </p>
      </div>

      {!desktop && !mobileOk ? (
        <div className="study-warn">
          <p>
            <b>Please use a laptop or desktop computer</b> with Chrome, Edge or Firefox. Phones and tablets can&apos;t record the screen.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href);
              }}
            >
              Copy the link
            </button>
            <button className="btn" onClick={() => setMobileOk(true)}>
              Continue here anyway
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="study-option">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I&apos;m 18 or older and I agree to take part and to have this tab and my voice recorded during the test.</span>
          </label>
          <button className="btn-primary study-big" disabled={!agreed || busy} onClick={() => void start()}>
            {busy ? "Starting…" : "Start"}
          </button>
          {error ? <p className="text-danger text-sm">{error}</p> : null}
        </>
      )}
      {backend.kind === "local" ? (
        <p className="text-xs text-muted">Trial mode: Firebase isn&apos;t set up for this site, so results are kept in this browser only (see USABILITY_TEST.md).</p>
      ) : null}
    </div>
  );
}

function QuestionPage({
  page,
  answers,
  onAnswer,
  onNext,
  nextLabel = "Continue",
  pageNote,
}: {
  page: { title: string; intro?: string; questions: Question[] };
  answers: Record<string, Answer>;
  onAnswer: (id: string, v: Answer) => void;
  onNext: () => void;
  nextLabel?: string;
  pageNote?: string;
}) {
  const [tried, setTried] = useState(false);
  const ok = page.questions.every((q) => isAnswered(q, answers));
  return (
    <div className="space-y-6">
      <div>
        {pageNote ? <p className="study-kicker">{pageNote}</p> : null}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{page.title}</h1>
        {page.intro ? <p className="mt-2 text-muted">{page.intro}</p> : null}
      </div>
      <QuestionList questions={page.questions} answers={answers} onAnswer={onAnswer} showMissing={tried} />
      <div>
        <button
          className="btn-primary study-big"
          onClick={() => {
            if (ok) onNext();
            else setTried(true);
          }}
        >
          {nextLabel}
        </button>
        {tried && !ok ? <p className="mt-2 text-sm text-danger">A few questions above still need an answer.</p> : null}
      </div>
    </div>
  );
}

function RecordStep({ onReady, onNext }: { onReady: (streams: MediaStream[], kind: StudyRecord["recording"]["kind"]) => void; onNext: () => void }) {
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [screenDenied, setScreenDenied] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!mic) return;
    return micLevel(mic, (l) => {
      setLevel(l);
      if (l > 0.25) setHeard(true);
    });
  }, [mic]);

  const turnOnMic = async () => {
    const s = await askMicrophone();
    if (s) setMic(s);
    else setMicDenied(true);
  };
  const shareScreen = async () => {
    const s = await askScreen();
    if (!s) {
      setScreenDenied(true);
      return;
    }
    onReady(mic ? [s, mic] : [s], mic ? "screen+mic" : "screen");
    setStarted(true);
  };
  const skip = () => {
    if (mic) onReady([mic], "mic");
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="study-kicker">Before you start</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Think out loud</h1>
        <p className="mt-2 text-lg leading-relaxed">
          While you do the tasks, <b>say what you&apos;re thinking</b>: what you&apos;re looking for, what you expect to happen, and anything that surprises,
          confuses or annoys you. It feels odd at first, but it&apos;s the most useful part of the test. Here&apos;s what it sounds like:
        </p>
      </div>
      <blockquote className="study-quote">
        {THINK_ALOUD_EXAMPLE.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </blockquote>

      <div className="space-y-4">
        <div className="study-permission">
          <div className="flex items-start gap-3">
            <Mic className="shrink-0 mt-0.5" size={22} aria-hidden />
            <div className="flex-1">
              <b>1. Turn on your microphone</b>
              <p className="text-sm text-muted">So we can hear you think out loud.</p>
              {mic ? (
                <div className="mt-3">
                  <div className="study-meter" aria-hidden>
                    <div style={{ width: `${Math.round(level * 100)}%` }} />
                  </div>
                  <p className="text-sm mt-2">
                    {heard ? (
                      <span className="text-ok font-medium">✓ We can hear you.</span>
                    ) : (
                      <>Practice now: say out loud, &quot;I&apos;m reading the instructions and I think next I&apos;ll share my screen.&quot;</>
                    )}
                  </p>
                </div>
              ) : (
                <button className="btn mt-3" onClick={() => void turnOnMic()}>
                  Turn on microphone
                </button>
              )}
              {micDenied && !mic ? (
                <p className="text-sm text-danger mt-2">
                  The microphone is blocked. Click the icon at the left of the address bar to allow it, then try again, or carry on without it.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="study-permission">
          <div className="flex items-start gap-3">
            <MonitorUp className="shrink-0 mt-0.5" size={22} aria-hidden />
            <div className="flex-1">
              <b>2. Record this tab</b>
              <p className="text-sm text-muted">
                Your browser will ask what to share. Choose <b>this tab</b> (in Chrome: &quot;This tab&quot;, then <b>Allow</b> or <b>Share</b>). Nothing outside it
                is recorded.
              </p>
              {started ? (
                <p className="text-ok font-medium mt-3">✓ Recording. You&apos;ll see a red dot while it&apos;s on.</p>
              ) : (
                <button className="btn mt-3" onClick={() => void shareScreen()} disabled={!mic && !micDenied}>
                  Share this tab
                </button>
              )}
              {screenDenied && !started ? (
                <p className="text-sm text-danger mt-2">Sharing didn&apos;t start. Try again and pick this tab, or carry on without recording.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary study-big" disabled={!started} onClick={onNext}>
          Continue
        </button>
        {!started ? (
          <button className="text-sm text-muted underline" onClick={skip}>
            I can&apos;t record. Continue without it
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Scenario({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="study-kicker">The situation</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{SCENARIO.title}</h1>
      </div>
      <div className="study-callout space-y-3 text-[1.05rem] leading-relaxed">
        {SCENARIO.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <div>
        <h2 className="font-semibold text-lg">How the tasks work</h2>
        <ul className="mt-2 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>Each task gives you a goal. Read it, then press <b>Start task</b> and do it in the app below.</li>
          <li>There&apos;s no time limit. Do it however feels natural, and keep thinking out loud.</li>
          <li>
            Press <b>I&apos;m done</b> when you think you&apos;ve finished, or <b>I&apos;m stuck</b> to move on. Getting stuck is useful to us, not a failure.
          </li>
          <li>After each task we&apos;ll ask two quick questions.</li>
        </ul>
      </div>
      <button className="btn-primary study-big" onClick={onNext}>
        Open the app
      </button>
    </div>
  );
}

function RecDot({ since }: { since: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = since ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0;
  return (
    <span className="study-rec" title="Recording this tab and your microphone">
      <span className="study-rec-dot" aria-hidden />
      REC {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The tasks, in the app
// ---------------------------------------------------------------------------

type Phase = "before" | "intro" | "doing" | "after-a" | "after-b";

function TaskPhase({
  rec,
  update,
  setAnswer,
  recorder,
  onDone,
  saveError,
}: {
  rec: StudyRecord;
  update: (fn: (r: StudyRecord) => StudyRecord) => void;
  setAnswer: (id: string, v: Answer) => void;
  recorder: SessionRecorder | null;
  onDone: () => void;
  saveError: boolean;
}) {
  const bFirst = rec.order === "B-first";
  const [i, setI] = useState(() => Math.max(0, TASKS.findIndex((t) => !rec.tasks[t.id]?.endedAt)));
  const [phase, setPhase] = useState<Phase>(bFirst ? "before" : "intro");
  const [answer, setAnswerText] = useState("");
  const [tried, setTried] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameSrc] = useState(() => {
    resetStudyApp();
    return "/app#demo";
  });
  const task: StudyTask = TASKS[i];
  const doing = useRef<{ id: string; clicks: number; events: { name: string; at: string }[] } | null>(null);

  // Count clicks and note the app's actions while a task is under way. Re-attached whenever the frame loads a page.
  const attach = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.addEventListener(
      "pointerdown",
      () => {
        if (doing.current) doing.current.clicks += 1;
      },
      true,
    );
    w.addEventListener(SMART_EVENT, (e) => {
      const detail = (e as CustomEvent<SmartEvent>).detail;
      if (doing.current && detail) doing.current.events.push({ name: detail.name, at: detail.at });
    });
  }, []);

  const begin = () => {
    doing.current = { id: task.id, clicks: 0, events: [] };
    setAnswerText("");
    setTried(false);
    const result: TaskResult = { startedAt: new Date().toISOString(), endedAt: null, outcome: null, autoSuccess: null, clicks: 0, events: [], answer: "" };
    update((r) => ({ ...r, tasks: { ...r.tasks, [task.id]: result } }));
    setPhase("doing");
  };

  const end = (outcome: "done" | "gave_up") => {
    if (outcome === "done" && task.answer && !answer.trim()) {
      setTried(true);
      return;
    }
    const d = doing.current;
    doing.current = null;
    const events = d?.events ?? [];
    update((r) => ({
      ...r,
      tasks: {
        ...r.tasks,
        [task.id]: {
          ...r.tasks[task.id],
          endedAt: new Date().toISOString(),
          outcome,
          clicks: d?.clicks ?? 0,
          events,
          answer: answer.trim(),
          autoSuccess: task.successEvent ? events.some((e) => e.name === task.successEvent) : null,
        },
      },
    }));
    setPhase("after-a");
  };

  const next = () => {
    if (i + 1 < TASKS.length) {
      setI(i + 1);
      setPhase(bFirst ? "before" : "intro");
    } else onDone();
  };

  const easeA: Question = { id: `${task.id}_ease_a`, kind: "pair", prompt: TASK_EASE.prompt, scale: TASK_EASE.scale, why: TASK_EASE.why };
  const easeB: Question = { id: `${task.id}_ease_b`, kind: "pair", prompt: ALT_EASE.prompt(task.alternative), scale: ALT_EASE.scale, why: ALT_EASE.why };

  const label = `Task ${i + 1} of ${TASKS.length}`;

  return (
    <div className="study-tasks">
      <div className="study-taskbar">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="study-kicker">
              {label} · {task.title}
            </span>
            <span className="flex gap-1" aria-hidden>
              {TASKS.map((t, k) =>
                k < i ? <CheckCircle2 key={t.id} size={14} className="text-ok" /> : <Circle key={t.id} size={14} className={k === i ? "text-accent" : "text-faint"} />,
              )}
            </span>
          </div>
          {phase === "doing" ? (
            <>
              <p className="font-semibold leading-snug mt-0.5">{task.goal}</p>
              <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                <Mic size={14} aria-hidden /> {THINK_ALOUD_REMINDER}
              </p>
              {task.answer ? (
                <label className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                  <span className="text-sm font-medium shrink-0">{task.answer}</span>
                  <input
                    className={`study-input flex-1 ${tried && !answer.trim() ? "border-danger" : ""}`}
                    value={answer}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer here"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <p className="text-muted mt-0.5">Read the card below.</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {recorder ? <RecDot since={rec.recording.startedAt} /> : null}
          {phase === "doing" ? (
            <div className="flex gap-2">
              <button className="btn" onClick={() => end("gave_up")}>
                <SkipForward size={16} aria-hidden /> I&apos;m stuck
              </button>
              <button className="btn-primary" onClick={() => end("done")}>
                <CheckCircle2 size={16} aria-hidden /> I&apos;m done
              </button>
            </div>
          ) : null}
          {phase === "doing" ? (
            <button
              className="text-xs text-muted underline flex items-center gap-1"
              onClick={() => {
                if (frame.current) frame.current.src = "/app";
              }}
            >
              <RotateCcw size={12} aria-hidden /> Lost? Reopen the app
            </button>
          ) : null}
        </div>
      </div>

      <div className="study-frame-wrap">
        <iframe ref={frame} src={frameSrc} title="Schedule Smart" className="study-frame" onLoad={attach} />
        {phase !== "doing" ? (
          <div className="study-overlay">
            <div className="study-card study-card-pop">
              {phase === "before" ? (
                <QuestionScreen
                  key={`${task.id}-before`}
                  q={easeB}
                  answers={rec.answers}
                  onAnswer={setAnswer}
                  onNext={() => setPhase("intro")}
                  kicker={`${label} · first, think about what you do today`}
                  nextLabel="Continue"
                />
              ) : null}
              {phase === "intro" ? (
                <>
                  <p className="study-kicker">
                    {label} · {task.title}
                  </p>
                  <p className="text-xl sm:text-2xl font-semibold leading-snug mt-2">{task.goal}</p>
                  {task.answer ? <p className="mt-3 text-muted">You&apos;ll type your answer in the bar at the top.</p> : null}
                  <p className="mt-4 study-callout text-sm flex gap-2">
                    <Mic size={18} className="shrink-0" aria-hidden /> {THINK_ALOUD_REMINDER}
                  </p>
                  <button className="btn-primary study-big mt-6" onClick={begin}>
                    Start task
                  </button>
                </>
              ) : null}
              {phase === "after-a" ? (
                <QuestionScreen
                  key={`${task.id}-after-a`}
                  q={easeA}
                  answers={rec.answers}
                  onAnswer={setAnswer}
                  onNext={() => (bFirst ? next() : setPhase("after-b"))}
                  kicker={`${label} · how did that go?`}
                  nextLabel={bFirst ? (i + 1 < TASKS.length ? "Next task" : "On to the survey") : "Continue"}
                />
              ) : null}
              {phase === "after-b" ? (
                <QuestionScreen
                  key={`${task.id}-after-b`}
                  q={easeB}
                  answers={rec.answers}
                  onAnswer={setAnswer}
                  onNext={next}
                  kicker={`${label} · compared to what you do today`}
                  nextLabel={i + 1 < TASKS.length ? "Next task" : "On to the survey"}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {saveError ? (
        <p className="study-toast" role="status">
          Having trouble saving. Check your internet connection; we&apos;ll keep trying.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The end
// ---------------------------------------------------------------------------

function Finish({
  rec,
  recorder,
  recStatus,
  update,
  saveDone,
}: {
  rec: StudyRecord;
  recorder: SessionRecorder | null;
  recStatus: RecorderStatus | null;
  update: (fn: (r: StudyRecord) => StudyRecord) => void;
  saveDone: () => Promise<void>;
}) {
  const [stage, setStage] = useState<"saving" | "done">("saving");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (recorder) await recorder.stop();
      update((r) => ({ ...r, finishedAt: new Date().toISOString(), recording: { ...r.recording, endedAt: new Date().toISOString() } }));
      await saveDone();
      setStage("done");
    })();
  }, [recorder, update, saveDone]);

  const failed = recStatus?.failed ?? false;
  const pct = recStatus && recStatus.bytes ? Math.min(100, Math.round((recStatus.savedBytes / recStatus.bytes) * 100)) : 100;

  if (stage === "saving") {
    return (
      <div className="space-y-4 text-center py-8">
        <h1 className="text-2xl font-bold">Saving your session…</h1>
        <p className="text-muted">Please keep this tab open for a moment.</p>
        {recorder ? (
          <div className="study-meter mx-auto max-w-sm">
            <div style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    );
  }

  const download = () => {
    if (!recorder) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(recorder.blob());
    a.download = `schedule-smart-test-${rec.code}.${recorder.mime.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
  };

  return (
    <div className="space-y-5 text-center py-6">
      <CheckCircle2 size={48} className="mx-auto text-ok" aria-hidden />
      <h1 className="text-3xl font-bold tracking-tight">That&apos;s it. Thank you!</h1>
      <p className="text-lg leading-relaxed max-w-lg mx-auto">
        Your honest feedback will directly shape what we change next. The recording has stopped; you can close this tab.
      </p>
      <div className="study-callout inline-block">
        Your completion code: <b className="font-mono text-xl tracking-widest ml-1">{rec.code}</b>
      </div>
      {failed ? (
        <div className="study-warn text-left">
          <p>
            Part of the recording couldn&apos;t be uploaded. If you can, download it and send it to the person who shared this test with you (mention code{" "}
            <b>{rec.code}</b>).
          </p>
          <button className="btn mt-3" onClick={download}>
            Download my recording
          </button>
        </div>
      ) : null}
    </div>
  );
}
