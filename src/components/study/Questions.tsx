"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Question, Scale } from "@/lib/study/config";
import type { Answer } from "@/lib/study/results";

type Answers = Record<string, Answer>;
type SetAnswer = (id: string, value: Answer) => void;

/** Whether a question has everything it needs (optional ones always do). */
export function isAnswered(q: Question, a: Answers): boolean {
  if (q.optional) return true;
  const filled = (id: string) => {
    const v = a[id];
    if (typeof v === "number") return Number.isFinite(v);
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  };
  if (q.kind === "pair") return filled(q.id) && filled(`${q.id}_why`);
  if (q.kind === "compare") return filled(`${q.id}_a`) && filled(`${q.id}_b`) && (!q.why || filled(`${q.id}_why`));
  return filled(q.id);
}

/** The rating rows a question shows: one, or two for a Schedule Smart vs. current tools comparison. */
function ratingRows(q: Question): { id: string; label: string | null }[] {
  if (q.kind === "scale" || q.kind === "pair") return [{ id: q.id, label: null }];
  if (q.kind === "compare")
    return [
      { id: `${q.id}_a`, label: "Schedule Smart" },
      { id: `${q.id}_b`, label: "What I use now" },
    ];
  return [];
}

/** Several questions on one page (the "about you" page). */
export function QuestionList({ questions, answers, onAnswer, showMissing }: { questions: Question[]; answers: Answers; onAnswer: SetAnswer; showMissing: boolean }) {
  return (
    <div className="space-y-8">
      {questions.map((q, i) => (
        <QuestionField key={q.id} q={q} n={i + 1} answers={answers} onAnswer={onAnswer} missing={showMissing && !isAnswered(q, answers)} />
      ))}
    </div>
  );
}

export function QuestionField({
  q,
  n,
  answers,
  onAnswer,
  missing,
  large,
}: {
  q: Question;
  n?: number;
  answers: Answers;
  onAnswer: SetAnswer;
  missing?: boolean;
  /** The question is alone on its screen: a bigger statement. */
  large?: boolean;
}) {
  const labelId = `q-${q.id}`;
  return (
    <fieldset className={`study-q ${missing ? "study-q-missing" : ""}`} aria-labelledby={labelId}>
      <legend id={labelId} className={`font-semibold leading-snug ${large ? "text-xl sm:text-2xl" : "text-[1.02rem]"}`}>
        {n ? <span className="text-muted mr-1.5">{n}.</span> : null}
        {q.prompt}
        {q.optional ? <span className="text-muted font-normal"> (optional)</span> : null}
      </legend>
      <div className={large ? "mt-5" : "mt-3"}>
        {q.kind === "choice" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => (
              <label key={o} className="study-option">
                <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => onAnswer(q.id, o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        ) : null}
        {q.kind === "multi" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => {
              const list = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
              return (
                <label key={o} className="study-option">
                  <input
                    type="checkbox"
                    checked={list.includes(o)}
                    onChange={(e) => onAnswer(q.id, e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
                  />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        ) : null}
        {q.kind === "text" ? <Why id={q.id} label="" answers={answers} onAnswer={onAnswer} placeholder="Type your answer" /> : null}
        {q.kind === "scale" || q.kind === "pair" || q.kind === "compare" ? (
          <RatingGrid rows={ratingRows(q)} scale={q.scale} answers={answers} onAnswer={onAnswer} prompt={q.prompt} />
        ) : null}
        {q.kind === "pair" ? <Why id={`${q.id}_why`} label={q.why} answers={answers} onAnswer={onAnswer} /> : null}
        {q.kind === "compare" && q.why ? <Why id={`${q.id}_why`} label={q.why} answers={answers} onAnswer={onAnswer} /> : null}
      </div>
      {missing ? <p className="mt-2 text-sm text-danger">Please answer this one.</p> : null}
    </fieldset>
  );
}

/**
 * One or two rows of rating buttons under a single set of end labels
 * ("Strongly disagree … Strongly agree"), so a comparison stays compact.
 */
export function RatingGrid({
  rows,
  scale,
  answers,
  onAnswer,
  prompt,
}: {
  rows: { id: string; label: string | null }[];
  scale: Scale;
  answers: Answers;
  onAnswer: SetAnswer;
  prompt: string;
}) {
  const values = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  const labelled = rows.some((r) => r.label);
  const half = Math.floor(values.length / 2);
  return (
    <div className={`study-grid ${labelled ? "study-grid-labelled" : ""}`} style={{ "--n": values.length } as React.CSSProperties}>
      {labelled ? <span className="study-grid-corner" aria-hidden /> : null}
      <span className="study-grid-anchor" style={{ gridColumn: `span ${half}` }} aria-hidden>
        {scale.min} = {scale.minLabel}
      </span>
      {values.length % 2 ? <span aria-hidden /> : null}
      <span className="study-grid-anchor text-right" style={{ gridColumn: `span ${half}` }} aria-hidden>
        {scale.max} = {scale.maxLabel}
      </span>
      {rows.map((r) => (
        <div
          key={r.id}
          className="study-grid-row"
          role="radiogroup"
          aria-label={`${r.label ? `${r.label}: ` : ""}${prompt} (${scale.min} = ${scale.minLabel}, ${scale.max} = ${scale.maxLabel})`}
        >
          {r.label ? <span className="study-grid-label">{r.label}</span> : null}
          {values.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={answers[r.id] === v} className="study-scale-btn" onClick={() => onAnswer(r.id, v)}>
              {v}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A one-line answer box that grows as they type. */
export function Why({ id, label, answers, onAnswer, placeholder }: { id: string; label: string; answers: Answers; onAnswer: SetAnswer; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = typeof answers[id] === "string" ? (answers[id] as string) : "";
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <label className="block mt-5">
      {label ? <span className="block text-[0.95rem] font-medium mb-1.5">{label}</span> : null}
      <textarea
        ref={ref}
        data-why
        className="study-input study-why w-full"
        value={value}
        onChange={(e) => onAnswer(id, e.target.value)}
        placeholder={placeholder ?? "A few words is plenty"}
        rows={1}
      />
    </label>
  );
}

/**
 * One question alone on the screen, with a Next button. From the keyboard:
 * the number keys pick a rating (the next unrated row first), Enter goes on,
 * and Shift+Enter starts a new line in an answer box.
 */
export function QuestionScreen({
  q,
  answers,
  onAnswer,
  onNext,
  kicker,
  hint,
  nextLabel = "Next",
}: {
  q: Question;
  answers: Answers;
  onAnswer: SetAnswer;
  onNext: () => void;
  kicker: string;
  hint?: string;
  nextLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [tried, setTried] = useState(false);
  const ok = isAnswered(q, answers);

  const submit = useCallback(() => {
    if (isAnswered(q, answers)) {
      setTried(false);
      onNext();
    } else setTried(true);
  }, [q, answers, onNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      if (e.key === "Enter" && !e.shiftKey && (target?.tagName !== "BUTTON" || typing)) {
        e.preventDefault();
        submit();
        return;
      }
      if (typing) return;
      // Typing a letter anywhere on the screen goes into the answer box.
      if (e.key.length === 1 && !/^[0-9 ]$/.test(e.key)) {
        box.current?.querySelector<HTMLTextAreaElement>("textarea[data-why]")?.focus();
        return;
      }
      if (!/^[0-9]$/.test(e.key)) return;
      const rows = ratingRows(q);
      if (!rows.length || !("scale" in q)) return;
      const v = Number(e.key);
      if (v < q.scale.min || v > q.scale.max) return;
      const row = rows.find((r) => typeof answers[r.id] !== "number") ?? rows[rows.length - 1];
      onAnswer(row.id, v);
      // Last rating given: on to the "why" box.
      if (rows.every((r) => r.id === row.id || typeof answers[r.id] === "number")) {
        requestAnimationFrame(() => box.current?.querySelector<HTMLTextAreaElement>("textarea[data-why]")?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, answers, onAnswer, submit]);

  return (
    <div ref={box}>
      <p className="study-kicker">{kicker}</p>
      {hint ? <p className="text-sm text-muted mt-1">{hint}</p> : null}
      <div className="mt-4">
        <QuestionField q={q} answers={answers} onAnswer={onAnswer} missing={tried && !ok} large />
      </div>
      <div className="mt-7 flex items-center gap-4">
        <button className="btn-primary study-big" onClick={submit}>
          {nextLabel}
        </button>
        <span className="text-sm text-muted hidden sm:inline">
          or press <kbd className="study-kbd">Enter ↵</kbd>
        </span>
      </div>
    </div>
  );
}
