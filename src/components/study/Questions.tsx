"use client";

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
  if (q.kind === "compare") return filled(`${q.id}_a`) && filled(`${q.id}_b`) && filled(`${q.id}_why`);
  return filled(q.id);
}

export function QuestionList({ questions, answers, onAnswer, showMissing }: { questions: Question[]; answers: Answers; onAnswer: SetAnswer; showMissing: boolean }) {
  return (
    <div className="space-y-7">
      {questions.map((q, i) => (
        <QuestionField key={q.id} q={q} n={i + 1} answers={answers} onAnswer={onAnswer} missing={showMissing && !isAnswered(q, answers)} />
      ))}
    </div>
  );
}

export function QuestionField({ q, n, answers, onAnswer, missing }: { q: Question; n?: number; answers: Answers; onAnswer: SetAnswer; missing?: boolean }) {
  const labelId = `q-${q.id}`;
  return (
    <fieldset className={`study-q ${missing ? "study-q-missing" : ""}`} aria-labelledby={labelId}>
      <legend id={labelId} className="font-semibold text-[1.02rem] leading-snug">
        {n ? <span className="text-muted mr-1.5">{n}.</span> : null}
        {q.prompt}
        {q.optional ? <span className="text-muted font-normal"> (optional)</span> : null}
      </legend>
      <div className="mt-3">
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
        {q.kind === "text" ? <Why id={q.id} label="" answers={answers} onAnswer={onAnswer} placeholder={q.placeholder} /> : null}
        {q.kind === "pair" ? (
          <>
            <ScaleInput id={q.id} scale={q.scale} answers={answers} onAnswer={onAnswer} label={q.prompt} />
            <Why id={`${q.id}_why`} label={q.why} answers={answers} onAnswer={onAnswer} />
          </>
        ) : null}
        {q.kind === "compare" ? (
          <>
            <div className="grid gap-4">
              <CompareRow title="Schedule Smart" id={`${q.id}_a`} scale={q.scale} answers={answers} onAnswer={onAnswer} prompt={q.prompt} />
              <CompareRow title="What I use now" id={`${q.id}_b`} scale={q.scale} answers={answers} onAnswer={onAnswer} prompt={q.prompt} />
            </div>
            <Why id={`${q.id}_why`} label={q.why} answers={answers} onAnswer={onAnswer} />
          </>
        ) : null}
      </div>
      {missing ? <p className="mt-2 text-sm text-danger">Please answer this one.</p> : null}
    </fieldset>
  );
}

function CompareRow({ title, id, scale, answers, onAnswer, prompt }: { title: string; id: string; scale: Scale | "minutes"; answers: Answers; onAnswer: SetAnswer; prompt: string }) {
  return (
    <div className="study-compare">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {scale === "minutes" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            className="study-input w-24"
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            value={typeof answers[id] === "number" ? String(answers[id]) : ""}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Math.max(0, Math.min(600, Math.round(Number(e.target.value))));
              onAnswer(id, v);
            }}
            aria-label={`${title}: ${prompt}`}
          />
          minutes
        </label>
      ) : (
        <ScaleInput id={id} scale={scale} answers={answers} onAnswer={onAnswer} label={`${title}: ${prompt}`} />
      )}
    </div>
  );
}

export function ScaleInput({ id, scale, answers, onAnswer, label }: { id: string; scale: Scale; answers: Answers; onAnswer: SetAnswer; label: string }) {
  const values = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  return (
    <div>
      <div className="study-scale" role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={answers[id] === v}
            className="study-scale-btn"
            onClick={() => onAnswer(id, v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted mt-1.5 gap-4">
        <span>
          {scale.min} = {scale.minLabel}
        </span>
        <span className="text-right">
          {scale.max} = {scale.maxLabel}
        </span>
      </div>
    </div>
  );
}

export function Why({ id, label, answers, onAnswer, placeholder }: { id: string; label: string; answers: Answers; onAnswer: SetAnswer; placeholder?: string }) {
  return (
    <label className="block mt-4">
      {label ? <span className="block text-sm font-medium mb-1.5">{label}</span> : null}
      <textarea
        className="study-input w-full min-h-[76px]"
        value={typeof answers[id] === "string" ? (answers[id] as string) : ""}
        onChange={(e) => onAnswer(id, e.target.value)}
        placeholder={placeholder ?? "A sentence or two is plenty."}
        rows={2}
      />
    </label>
  );
}
