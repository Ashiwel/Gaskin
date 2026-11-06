/**
 * The mood check (EPDS), one question at a time: the question as the worker says it aloud, a
 * compact radio list of plain answers, the validated wording behind a disclosure, a progress ring,
 * and the running score on a 0 to 30 bar marked at 10 and 13. Item 10 (self-harm) is flagged.
 * Used by the guided visit and the record sheet.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from '@untitledui/icons';
import { ProgressRing } from '../../components/viz';
import { cx } from '../../utils/cx';
import { EPDS_ITEMS } from '../epds';

export interface EpdsQuestion {
  ask: string;
  standard: string;
  opts: Array<[string, number]>;
  standardOpts?: Array<[string, number]>;
}

/** Plain questions: the visits module's EPDS_PLAIN when present, else the copy passed in, else the validated wording. */
export function epdsQuestions(plain?: EpdsQuestion[]): EpdsQuestion[] {
  if (plain?.length === 10) return plain;
  return EPDS_ITEMS.map((q) => ({ ask: q.q, standard: q.q, opts: q.opts }));
}

export function bandFor(score: number, selfHarm: boolean): { tone: 'success' | 'warning' | 'error'; word: string; todo: string } {
  if (selfHarm) return { tone: 'error', word: 'Safety concern', todo: 'She answered yes to hurting herself. Stay with her, ask about a plan, and get help today.' };
  if (score >= 13) return { tone: 'error', word: 'Likely depression', todo: 'Refer for support today.' };
  if (score >= 10) return { tone: 'warning', word: 'Possible depression', todo: 'Talk with her, involve family support, and repeat in 2 weeks.' };
  return { tone: 'success', word: 'Below the cut-off', todo: 'Ask again at the next check.' };
}

export function EpdsStepper({
  questions,
  answers,
  onChange,
  onDone,
  className,
}: {
  questions: EpdsQuestion[];
  answers: Array<number | null>;
  onChange: (next: Array<number | null>) => void;
  /** Called once every question has an answer and the worker taps "See the result" */
  onDone?: () => void;
  className?: string;
}) {
  const firstOpen = answers.findIndex((a) => a === null);
  const [i, setI] = useState(firstOpen < 0 ? questions.length : firstOpen);
  const done = answers.filter((a) => a !== null).length;
  const score = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  const selfHarm = (answers[9] ?? 0) > 0;
  const complete = done === questions.length;
  const band = bandFor(score, selfHarm);
  const q = questions[Math.min(i, questions.length - 1)];
  const showResult = i >= questions.length;

  const pick = (v: number) => {
    const next = answers.map((a, j) => (j === i ? v : a));
    onChange(next);
    // Move on after a short pause so the choice is seen.
    window.setTimeout(() => setI((x) => (x === i ? x + 1 : x)), 180);
  };

  return (
    <div className={cx('rounded-2xl bg-primary ring-1 ring-secondary ring-inset', className)} data-testid="epds-stepper">
      <div className="flex items-center gap-4 border-b border-secondary p-4">
        <ProgressRing value={(done / questions.length) * 100} label="Questions answered" size={56} thickness={6} tone={complete ? band.tone === 'success' ? 'success' : band.tone === 'warning' ? 'warning' : 'danger' : 'brand'}>
          {done}/{questions.length}
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">Mood check</p>
          <p className="hidden text-xs text-tertiary sm:block">Ask about the last 7 days. Read each answer and let her choose.</p>
          <p className="text-xs text-tertiary sm:hidden">The last 7 days</p>
        </div>
        <ScoreBar score={score} complete={complete} tone={band.tone} />
      </div>

      {!showResult ? (
        <fieldset className={cx('p-4', i === 9 && 'bg-error-primary')}>
          <legend className="sr-only">Question {i + 1} of {questions.length}</legend>
          <div className="flex items-center gap-2 text-xs font-semibold text-tertiary">
            <span className="tnum">
              Question {i + 1} of {questions.length}
            </span>
            {i === 9 ? <span className="rounded-full bg-error-solid px-2 py-0.5 text-on-fill">Safety question</span> : null}
          </div>
          <p className="mt-2 text-lg leading-snug font-semibold text-primary">{q.ask}</p>
          <div role="radiogroup" aria-label={q.ask} className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {q.opts.map(([label, v]) => {
              const on = answers[i] === v;
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(v)}
                  className={cx('visit-opt flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-focus-ring ring-1 ring-inset focus-visible:outline-2', on ? 'bg-brand-primary font-semibold text-brand-secondary ring-2 ring-border-brand' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover')}
                >
                  <span aria-hidden="true" className={cx('grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset', on ? 'bg-brand-solid ring-transparent' : 'ring-primary')}>
                    {on ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          {q.standard !== q.ask ? (
            <details className="mt-3 text-sm text-tertiary">
              <summary className="min-h-8 cursor-pointer font-medium text-tertiary hover:text-secondary">Standard wording</summary>
              <p className="mt-1 italic">“{q.standard}”</p>
              {q.standardOpts ? <p className="mt-1">{q.standardOpts.map(([l]) => l).join(' · ')}</p> : null}
            </details>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-tertiary hover:bg-primary_hover disabled:opacity-40">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </button>
            <div className="flex gap-1" aria-hidden="true">
              {questions.map((_, j) => (
                <span key={j} className={cx('h-1.5 w-3 rounded-full', j === i ? 'bg-fg-brand-primary' : answers[j] !== null ? 'bg-fg-quaternary' : 'bg-quaternary')} />
              ))}
            </div>
            <button type="button" onClick={() => setI(i + 1)} disabled={answers[i] === null} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-brand-secondary hover:bg-brand-primary disabled:opacity-40">
              {i === questions.length - 1 ? 'See the result' : 'Next'} <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </fieldset>
      ) : (
        <div className="space-y-3 p-4" role="status">
          <div className={cx('rounded-xl p-4 ring-1 ring-inset', band.tone === 'error' ? 'bg-error-primary ring-error_subtle' : band.tone === 'warning' ? 'bg-warning-primary ring-warning_subtle' : 'bg-success-primary ring-success_subtle')}>
            <p className={cx('text-md font-semibold', band.tone === 'error' ? 'text-error-primary' : band.tone === 'warning' ? 'text-warning-primary' : 'text-success-primary')}>
              {complete ? `${score} of 30: ${band.word}` : `${questions.length - done} questions not answered`}
            </p>
            {complete ? <p className="mt-1 text-sm text-secondary">{band.todo}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setI(Math.max(0, firstOpen < 0 ? 0 : firstOpen))} className="min-h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover">
              Review answers
            </button>
            {complete && onDone ? (
              <button type="button" onClick={onDone} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-solid px-3 text-sm font-semibold text-on-fill hover:bg-brand-solid_hover">
                <Check className="size-4" aria-hidden="true" /> Use this score
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Score on a 0 to 30 bar, with the 10 and 13 cut-offs marked. */
export function ScoreBar({ score, complete, tone, className }: { score: number; complete: boolean; tone: 'success' | 'warning' | 'error'; className?: string }) {
  const pct = (v: number) => `${(v / 30) * 100}%`;
  const fill = tone === 'error' ? 'bg-fg-error-secondary' : tone === 'warning' ? 'bg-fg-warning-secondary' : 'bg-fg-success-secondary';
  return (
    <div className={cx('w-28 shrink-0 sm:w-40', className)} role="img" aria-label={`Score ${score} of 30${complete ? '' : ' so far'}. Cut-offs at 10 and 13.`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-semibold text-primary tnum">{score}</span>
        <span className="text-xs text-tertiary">of 30</span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-quaternary">
        <div className={cx('absolute inset-y-0 left-0 rounded-full', complete ? fill : 'bg-fg-quaternary')} style={{ width: pct(score) }} />
        <span className="absolute -top-1 h-4 w-px bg-fg-tertiary" style={{ left: pct(10) }} />
        <span className="absolute -top-1 h-4 w-px bg-fg-tertiary" style={{ left: pct(13) }} />
      </div>
      <div className="relative mt-0.5 h-3 text-[10px] text-quaternary tnum">
        <span className="absolute -translate-x-full pr-0.5" style={{ left: pct(10) }}>
          10
        </span>
        <span className="absolute pl-0.5" style={{ left: pct(13) }}>
          13
        </span>
      </div>
    </div>
  );
}
