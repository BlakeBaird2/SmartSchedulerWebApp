"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, LogOut, RefreshCw, Scissors } from "lucide-react";
import { SCREENER, SURVEY, TARGET_PARTICIPANTS, TASKS, matchesPersona, type Question } from "@/lib/study/config";
import { comparisons, recordingOffset, secondsBetween, taskSummaries, toCsv, type StudyRecord } from "@/lib/study/results";
import { backend, researcherEmail, researcherSignIn, researcherSignOut } from "./backend";

/*
 * The research team's side, at /study/results: who has taken the test, a
 * summary of the A/B comparisons, the CSV export, and each session's recording
 * with a tool to cut one clip out of it.
 */

function saveFile(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

const fmt = (n: number | null, digits = 1) => (n === null ? "–" : n.toFixed(digits));
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function parseClock(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2]);
}

export function ResultsDashboard() {
  const [who, setWho] = useState<string | null | "checking">(backend.kind === "local" ? "this browser" : "checking");
  const [records, setRecords] = useState<StudyRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyComplete, setOnlyComplete] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecords(await backend.listSessions());
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      setError(
        code === "permission-denied"
          ? "This Google account isn't on the researcher list yet. In Firestore, add a document to the \"researchers\" collection whose ID is your email (see USABILITY_TEST.md), then reload."
          : `Couldn't load the results${code ? ` (${code})` : ""}.`,
      );
    }
  }, []);

  useEffect(() => {
    if (backend.kind === "local") {
      void Promise.resolve().then(load);
      return;
    }
    void researcherEmail().then((email) => {
      setWho(email);
      if (email) void load();
    });
  }, [load]);

  if (who === "checking") return <Page>Checking who&apos;s signed in…</Page>;
  if (who === null)
    return (
      <Page>
        <h1 className="text-2xl font-bold">Study results</h1>
        <p className="mt-2 text-muted">Sign in with the Google account on the researcher list.</p>
        <button
          className="btn-primary mt-4"
          onClick={() =>
            void researcherSignIn()
              .then(researcherEmail)
              .then((email) => {
                setWho(email);
                if (email) void load();
              })
              .catch(() => setError("Sign-in didn't finish."))
          }
        >
          Sign in with Google
        </button>
        {error ? <p className="text-danger mt-3">{error}</p> : null}
      </Page>
    );

  const shown = (records ?? []).filter((r) => !onlyComplete || r.finishedAt);
  const complete = (records ?? []).filter((r) => r.finishedAt);
  const representative = complete.filter((r) => matchesPersona(r.answers));
  const open = records?.find((r) => r.id === openId) ?? null;

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usability test results</h1>
          <p className="text-sm text-muted mt-1">
            Participant link: <code className="font-mono">{typeof window !== "undefined" ? `${window.location.origin}/study` : "/study"}</code>
            {backend.kind === "local" ? " · Trial mode: showing sessions taken in this browser only." : ` · Signed in as ${who}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden /> Refresh
          </button>
          {backend.kind === "firebase" ? (
            <button className="btn" onClick={() => void researcherSignOut().then(() => setWho(null))}>
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-danger mt-4">{error}</p> : null}
      {records === null && !error ? <p className="mt-6 text-muted">Loading…</p> : null}

      {records ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3 mt-6">
            <Stat label="Sessions started" value={String(records.length)} />
            <Stat label="Completed" value={String(complete.length)} />
            <Stat label={`Match the persona (goal ${TARGET_PARTICIPANTS})`} value={`${representative.length} / ${TARGET_PARTICIPANTS}`}>
              <div className="study-meter mt-2">
                <div style={{ width: `${Math.min(100, (representative.length / TARGET_PARTICIPANTS) * 100)}%` }} />
              </div>
            </Stat>
          </section>

          <section className="mt-8 flex flex-wrap items-center gap-4">
            <button className="btn-primary" onClick={() => saveFile(new Blob([toCsv(shown)], { type: "text/csv" }), `usability-test-${new Date().toISOString().slice(0, 10)}.csv`)}>
              <Download size={16} aria-hidden /> Export CSV ({shown.length})
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyComplete} onChange={(e) => setOnlyComplete(e.target.checked)} /> Completed sessions only
            </label>
          </section>

          <Summary records={complete} />

          <section className="mt-10">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <div className="overflow-x-auto mt-3">
              <table className="study-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Persona</th>
                    <th>Order</th>
                    <th>Minutes</th>
                    <th>Tasks done</th>
                    <th>Recording</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const mins = secondsBetween(r.startedAt, r.finishedAt ?? r.updatedAt);
                    return (
                      <tr key={r.id} className={r.id === openId ? "is-open" : ""}>
                        <td>{new Date(r.startedAt).toLocaleString()}</td>
                        <td className="font-mono">{r.code}</td>
                        <td>{r.finishedAt ? "Complete" : `Stopped at ${r.step}`}</td>
                        <td>{matchesPersona(r.answers) ? "Yes" : "No"}</td>
                        <td>{r.order}</td>
                        <td>{mins === null ? "–" : (mins / 60).toFixed(1)}</td>
                        <td>
                          {TASKS.filter((t) => r.tasks[t.id]?.outcome === "done").length} / {TASKS.length}
                        </td>
                        <td>{r.recording.kind === "none" ? "None" : `${r.recording.kind}, ${(r.recording.bytes / 1_048_576).toFixed(1)} MB`}</td>
                        <td>
                          <button className="btn" onClick={() => setOpenId(r.id === openId ? null : r.id)}>
                            {r.id === openId ? "Close" : "Open"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-muted">
                        Nobody yet. Share the participant link.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {open ? <SessionDetail key={open.id} rec={open} /> : null}
        </>
      ) : null}
    </Page>
  );
}

function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="study-shell">
      <main className={`study-card ${wide ? "study-card-wide" : ""}`}>{children}</main>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="study-stat">
      <div className="text-sm text-muted">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {children}
    </div>
  );
}

function Summary({ records }: { records: StudyRecord[] }) {
  const tasks = useMemo(() => taskSummaries(records), [records]);
  const pairs = useMemo(() => comparisons(records), [records]);
  if (!records.length) return null;
  return (
    <section className="mt-10 grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold">Tasks in Schedule Smart</h2>
        <table className="study-table mt-3">
          <thead>
            <tr>
              <th>Task</th>
              <th>Said done</th>
              <th>App saw it</th>
              <th>Median time</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{pct(t.doneRate)}</td>
                <td>{pct(t.autoRate)}</td>
                <td>{t.medianSeconds === null ? "–" : clock(t.medianSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="text-lg font-semibold">A (Schedule Smart) vs B (what they use now)</h2>
        <table className="study-table mt-3">
          <thead>
            <tr>
              <th>Measure</th>
              <th>A</th>
              <th>B</th>
              <th>A − B</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td>{fmt(p.a)}</td>
                <td>{fmt(p.b)}</td>
                <td>{p.a !== null && p.b !== null ? fmt(p.a - p.b) : "–"}</td>
                <td>{p.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted mt-2">Means of completed sessions, 1 = strongly disagree, 7 = strongly agree.</p>
      </div>
    </section>
  );
}

function answerText(rec: StudyRecord, id: string): string {
  const v = rec.answers[id];
  if (v === undefined || v === "") return "–";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function AnswerRows({ rec, questions }: { rec: StudyRecord; questions: Question[] }) {
  return (
    <>
      {questions.map((q) => (
        <div key={q.id} className="study-answer">
          <div className="text-sm text-muted">{q.prompt}</div>
          {q.kind === "compare" ? (
            <div>
              <b>A {answerText(rec, `${q.id}_a`)}</b> · <b>B {answerText(rec, `${q.id}_b`)}</b>
              {q.why ? ` — ${answerText(rec, `${q.id}_why`)}` : ""}
            </div>
          ) : q.kind === "scale" ? (
            <div>
              <b>{answerText(rec, q.id)}</b>
            </div>
          ) : q.kind === "pair" ? (
            <div>
              <b>{answerText(rec, q.id)}</b> — {answerText(rec, `${q.id}_why`)}
            </div>
          ) : (
            <div>{answerText(rec, q.id)}</div>
          )}
        </div>
      ))}
    </>
  );
}

function SessionDetail({ rec }: { rec: StudyRecord }) {
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [start, setStart] = useState("0:00");
  const [end, setEnd] = useState("0:30");
  const [cutting, setCutting] = useState(false);

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);

  const ext = (rec.recording.mimeType ?? "").includes("mp4") ? "mp4" : "webm";

  const loadVideo = async () => {
    setLoading(true);
    setNote(null);
    try {
      const b = await backend.readRecording(rec);
      if (!b) setNote("No recording was saved for this session.");
      else {
        setBlob(b);
        setSrc(URL.createObjectURL(b));
      }
    } catch {
      setNote("Couldn't load the recording.");
    }
    setLoading(false);
  };

  // Recordings made in the browser don't say how long they are; finding the end once makes seeking work.
  const onMeta = () => {
    const v = video.current;
    if (!v || Number.isFinite(v.duration)) return;
    const back = () => {
      v.removeEventListener("durationchange", back);
      v.currentTime = 0;
    };
    v.addEventListener("durationchange", back);
    v.currentTime = 1e101;
  };

  const jump = (at: string | null) => {
    const s = secondsBetween(rec.recording.startedAt, at);
    if (video.current && s !== null) {
      video.current.currentTime = Math.max(0, s - 2);
      void video.current.play();
    }
  };

  const cut = async () => {
    const v = video.current;
    const from = parseClock(start);
    const to = parseClock(end);
    if (!v || from === null || to === null || to <= from) {
      setNote("Set a start and an end time (m:ss), with the end after the start.");
      return;
    }
    const capture = (v as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.() ??
      (v as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
    if (!capture) {
      setNote("This browser can't cut clips. Try Chrome, or download the full recording.");
      return;
    }
    setCutting(true);
    setNote(`Cutting the clip. It plays through once (${clock(to - from)}); keep this tab open.`);
    v.pause();
    v.currentTime = from;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const mr = new MediaRecorder(capture, { mimeType: type || undefined, videoBitsPerSecond: 1_500_000 });
    const parts: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const stopped = new Promise((r) => (mr.onstop = r));
    mr.start(1000);
    await v.play();
    await new Promise<void>((resolve) => {
      const check = () => (v.currentTime >= to || v.ended || v.paused ? resolve() : requestAnimationFrame(check));
      check();
    });
    v.pause();
    mr.stop();
    await stopped;
    saveFile(new Blob(parts, { type: mr.mimeType || "video/webm" }), `clip-${rec.code}-${start.replace(":", "m")}s-${end.replace(":", "m")}s.webm`);
    setCutting(false);
    setNote("Clip saved to your downloads.");
  };

  const setFromVideo = (which: "start" | "end") => {
    const t = video.current?.currentTime ?? 0;
    (which === "start" ? setStart : setEnd)(clock(t));
  };

  return (
    <section className="mt-10 study-detail">
      <h2 className="text-xl font-bold">
        Session <span className="font-mono">{rec.code}</span>
      </h2>
      <p className="text-sm text-muted">
        {new Date(rec.startedAt).toLocaleString()} · {rec.order} · {rec.device.mobile ? "phone/tablet" : "computer"} {rec.device.screen}
        {rec.recording.stoppedEarly ? " · stopped sharing their screen early" : ""}
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] mt-5">
        <div>
          {src ? (
            <video ref={video} src={src} controls className="w-full rounded-lg border border-line bg-black" onLoadedMetadata={onMeta} />
          ) : (
            <button className="btn-primary" onClick={() => void loadVideo()} disabled={loading || rec.recording.kind === "none"}>
              <Film size={16} aria-hidden />{" "}
              {rec.recording.kind === "none" ? "No recording" : loading ? "Loading recording…" : `Load recording (${(rec.recording.bytes / 1_048_576).toFixed(1)} MB)`}
            </button>
          )}
          {note ? <p className="text-sm mt-2">{note}</p> : null}

          {src ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {TASKS.map((t, k) => (
                  <button key={t.id} className="btn" onClick={() => jump(rec.tasks[t.id]?.startedAt ?? null)} disabled={!rec.tasks[t.id]}>
                    Task {k + 1} ({recordingOffset(rec, rec.tasks[t.id]?.startedAt) || "–"})
                  </button>
                ))}
              </div>
              <div className="study-callout">
                <div className="font-semibold flex items-center gap-2">
                  <Scissors size={16} aria-hidden /> Cut a clip
                </div>
                <div className="flex flex-wrap items-end gap-3 mt-2 text-sm">
                  <label>
                    Start
                    <input className="study-input w-20 ml-2" value={start} onChange={(e) => setStart(e.target.value)} />
                  </label>
                  <button className="btn" onClick={() => setFromVideo("start")}>
                    Use current time
                  </button>
                  <label>
                    End
                    <input className="study-input w-20 ml-2" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </label>
                  <button className="btn" onClick={() => setFromVideo("end")}>
                    Use current time
                  </button>
                  <button className="btn-primary" onClick={() => void cut()} disabled={cutting}>
                    {cutting ? "Cutting…" : "Save clip"}
                  </button>
                </div>
              </div>
              <button className="btn" onClick={() => blob && saveFile(blob, `session-${rec.code}.${ext}`)}>
                <Download size={16} aria-hidden /> Download full recording
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold">Tasks</h3>
            {TASKS.map((t, k) => {
              const r = rec.tasks[t.id];
              const s = r ? secondsBetween(r.startedAt, r.endedAt) : null;
              return (
                <div key={t.id} className="study-answer">
                  <div className="text-sm text-muted">
                    Task {k + 1}: {t.title}
                  </div>
                  {r ? (
                    <div>
                      <b>{r.outcome === "done" ? "Said done" : r.outcome === "gave_up" ? "Gave up" : "Unfinished"}</b>
                      {r.autoSuccess !== null ? ` · app ${r.autoSuccess ? "saw it" : "didn't see it"}` : ""} · {s === null ? "–" : clock(s)} · {r.clicks} clicks
                      {r.answer ? <div className="mt-1">Answer: “{r.answer}”</div> : null}
                      <div className="mt-1">
                        Ease A <b>{answerText(rec, `${t.id}_ease_a`)}</b> — {answerText(rec, `${t.id}_ease_a_why`)}
                      </div>
                      <div className="mt-1">
                        Ease B <b>{answerText(rec, `${t.id}_ease_b`)}</b> — {answerText(rec, `${t.id}_ease_b_why`)}
                      </div>
                    </div>
                  ) : (
                    <div>Not reached</div>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <h3 className="font-semibold">About them</h3>
            <AnswerRows rec={rec} questions={SCREENER.questions} />
          </div>
          {SURVEY.map((p) => (
            <div key={p.id}>
              <h3 className="font-semibold">{p.title}</h3>
              <AnswerRows rec={rec} questions={p.questions} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
