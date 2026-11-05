/**
 * Guided onboarding: one plain question per screen with big picture answers, then
 * "Here is your setup" and a single button that applies everything.
 *
 * Mount it full-screen. Styles are self-contained, prefixed `setup-`, and read the
 * app theme through var(--…) tokens with fallbacks.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_NAMES } from '../../data';
import { listRegions, nearestRegion, getLocationProfile } from '../../location';
import { applySetupPlan, type ApplyOptions, type ApplyProgress, type ApplyStepId } from '../apply';
import { connectAssistant, type AssistantConnection } from '../assistant';
import { detectSetupEnvironment, requestPosition } from '../env';
import { NOT_SURE, visibleQuestions, type Question, type QuestionOption } from '../questions';
import { recommendSetup } from '../recommend';
import { langTag, st, type SetupKey } from '../strings';
import type { SetupAnswers, SetupEnvironment, SetupPlan, WorkerLanguage } from '../types';
import { SetupIcon } from './icons';

export interface OnboardingWizardProps {
  /** Called after the plan is applied; the app should land on the caseload */
  onComplete: (plan: SetupPlan, answers: SetupAnswers) => void;
  /** Start from earlier answers (e.g. "Change my answers" from Settings) */
  initialAnswers?: SetupAnswers;
  /** Override detected device facts (demo controls, tests) */
  env?: SetupEnvironment;
  /** Shows a small "Skip setup and look around" link on the first screen */
  onSkipAll?: () => void;
  /** Passed to applySetupPlan (tests, pack download speed) */
  applyOptions?: Omit<ApplyOptions, 'apiKey' | 'onProgress'>;
}

type Phase = 'questions' | 'summary' | 'applying';

export function OnboardingWizard({ onComplete, initialAnswers, env: envProp, onSkipAll, applyOptions }: OnboardingWizardProps) {
  const [answers, setAnswers] = useState<SetupAnswers>(initialAnswers ?? {});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('questions');
  const env = useMemo(() => envProp ?? detectSetupEnvironment(), [envProp]);
  const lang: WorkerLanguage = answers.workerLanguage ?? 'en';
  const T = (k: SetupKey, p?: Record<string, string | number>, en?: string) => st(k, lang, p, en);

  const questions = visibleQuestions(answers);
  const q = questions[Math.min(index, questions.length - 1)];
  const plan = useMemo(() => (phase === 'questions' ? null : recommendSetup(answers, env)), [phase, answers, env]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [index, phase]);

  const next = () => {
    const qs = visibleQuestions(answers);
    if (index + 1 >= qs.length) setPhase('summary');
    else setIndex(index + 1);
  };
  const back = () => {
    if (phase === 'summary') {
      setPhase('questions');
      setIndex(visibleQuestions(answers).length - 1);
    } else if (index > 0) setIndex(index - 1);
  };
  const set = (patch: Partial<SetupAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  return (
    <div className="setup-root" lang={langTag(lang)}>
      <style>{CSS}</style>
      {phase === 'questions' && q ? (
        <QuestionScreen
          key={q.id}
          q={q}
          answers={answers}
          set={set}
          T={T}
          lang={lang}
          index={index}
          total={questions.length}
          onNext={next}
          onBack={index > 0 ? back : undefined}
          onSkipAll={index === 0 ? onSkipAll : undefined}
          headingRef={headingRef}
        />
      ) : null}
      {phase !== 'questions' && plan ? (
        <Summary
          plan={plan}
          answers={answers}
          T={T}
          lang={lang}
          applying={phase === 'applying'}
          headingRef={headingRef}
          onBack={back}
          onApply={async (apiKey, onProgress) => {
            setPhase('applying');
            await applySetupPlan(plan, answers, { ...applyOptions, apiKey, onProgress });
            onComplete(plan, answers);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One question
// ---------------------------------------------------------------------------

type TFn = (k: SetupKey, p?: Record<string, string | number>, en?: string) => string;

interface QProps {
  q: Question;
  answers: SetupAnswers;
  set: (p: Partial<SetupAnswers>) => void;
  T: TFn;
  lang: WorkerLanguage;
  index: number;
  total: number;
  onNext: () => void;
  onBack?: () => void;
  onSkipAll?: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

function Dots({ index, total }: { index: number; total: number }) {
  return (
    <div className="setup-dots" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`setup-dot${i < index ? ' is-done' : i === index ? ' is-here' : ''}`} />
      ))}
    </div>
  );
}

function OptionButton({ o, selected, onClick, multi, label }: { o: QuestionOption; selected: boolean; onClick: () => void; multi?: boolean; label: string }) {
  return (
    <button type="button" className={`setup-option${selected ? ' is-selected' : ''}`} aria-pressed={selected} role={multi ? 'checkbox' : 'radio'} aria-checked={selected} onClick={onClick}>
      <span className="setup-option-icon">
        <SetupIcon name={o.icon} />
      </span>
      <span className="setup-option-text">
        <span className="setup-option-label">{label}</span>
        {o.hint ? <span className="setup-option-hint">{o.hint}</span> : null}
      </span>
      {selected ? (
        <span className="setup-option-tick" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

function QuestionScreen({ q, answers, set, T, lang, index, total, onNext, onBack, onSkipAll, headingRef }: QProps) {
  const opts = q.options(answers);
  const key = q.id as keyof SetupAnswers;
  const value = q.id === 'location' ? answers.region : (answers[key] as unknown);
  const labelFor = (o: QuestionOption) => (o.value === 'not_sure' ? T('not_sure') : o.label);
  const title = T(`q.${q.id}` as SetupKey, undefined, q.title);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // Single choice: select and move on after a short pause so she sees the tick.
  const pickSingle = (v: string | number) => {
    set({ [key]: v } as Partial<SetupAnswers>);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(onNext, 260);
  };

  let body: React.ReactNode = null;
  let canContinue = true;

  if (q.kind === 'single') {
    body = (
      <div className="setup-options" role="radiogroup" aria-label={title}>
        {opts.map((o) => (
          <OptionButton key={String(o.value)} o={o} label={q.id === 'workerLanguage' ? o.label : labelFor(o)} selected={value === o.value} onClick={() => pickSingle(o.value)} />
        ))}
      </div>
    );
    canContinue = value !== undefined;
  } else if (q.kind === 'multi') {
    const arr = (Array.isArray(value) ? value : []) as Array<string | number>;
    const toggle = (o: QuestionOption) => {
      let nextArr: Array<string | number>;
      if (arr.includes(o.value)) nextArr = arr.filter((x) => x !== o.value);
      else if (o.exclusive) nextArr = [o.value];
      else nextArr = [...arr.filter((x) => !opts.find((p) => p.value === x)?.exclusive), o.value];
      set({ [key]: nextArr } as Partial<SetupAnswers>);
    };
    body = (
      <>
        <p className="setup-help">{T('pick_all')}</p>
        <div className="setup-options" role="group" aria-label={title}>
          {opts.map((o) => (
            <OptionButton key={String(o.value)} o={o} multi label={labelFor(o)} selected={arr.includes(o.value)} onClick={() => toggle(o)} />
          ))}
        </div>
      </>
    );
    canContinue = arr.length > 0;
  } else if (q.kind === 'choice_or_text') {
    const other = value === 'other';
    body = (
      <>
        <div className="setup-options" role="radiogroup" aria-label={title}>
          {opts.map((o) => (
            <OptionButton
              key={String(o.value)}
              o={o}
              label={labelFor(o)}
              selected={value === o.value}
              onClick={() => {
                // Keep the region when she taps the same country again (e.g. after going back)
                const changed = answers.country !== o.value;
                if (o.value === 'other') set({ country: 'other', ...(changed ? { region: undefined } : {}) });
                else {
                  set({ country: o.value as SetupAnswers['country'], countryOther: undefined, ...(changed ? { region: undefined, geo: undefined } : {}) });
                  pickSingle(o.value);
                }
              }}
            />
          ))}
        </div>
        {other ? (
          <label className="setup-field">
            <span>{T('type_country')}</span>
            <input className="setup-input" value={answers.countryOther ?? ''} autoFocus onChange={(e) => set({ countryOther: e.target.value })} autoComplete="country-name" />
          </label>
        ) : null}
      </>
    );
    canContinue = value !== undefined && (!other || Boolean(answers.countryOther?.trim()));
  } else if (q.kind === 'location') {
    body = <LocationStep answers={answers} set={set} T={T} opts={opts} lang={lang} />;
    canContinue = true;
  }

  const showContinue = q.kind !== 'single' && !(q.kind === 'choice_or_text' && value !== 'other');

  return (
    <section className="setup-screen" aria-labelledby="setup-q-title">
      <header className="setup-top">
        <button type="button" className="setup-link" onClick={onBack} disabled={!onBack} aria-hidden={!onBack} style={{ visibility: onBack ? 'visible' : 'hidden' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {T('back')}
        </button>
        <span className="setup-count">{T('step', { n: index + 1, total })}</span>
        {q.skippable ? (
          <button type="button" className="setup-link" onClick={() => (q.id !== 'location' && answers[key] === undefined ? (set({ [key]: Array.isArray(answers[key]) ? ['not_sure'] : 'not_sure' } as Partial<SetupAnswers>), onNext()) : onNext())}>
            {T('skip')}
          </button>
        ) : (
          <span className="setup-link-spacer" />
        )}
      </header>
      <Dots index={index} total={total} />
      <h1 className="setup-title" id="setup-q-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h1>
      {q.help ? <p className="setup-help">{q.help}</p> : null}
      {body}
      {showContinue ? (
        <div className="setup-actions">
          <button type="button" className="setup-primary" disabled={!canContinue} onClick={onNext}>
            {T('continue')}
          </button>
        </div>
      ) : null}
      {onSkipAll ? (
        <p className="setup-skipall">
          <button type="button" className="setup-link" onClick={onSkipAll}>
            Skip setup and look around the demo
          </button>
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Location: use my location (with consent), pick a region, or type one
// ---------------------------------------------------------------------------

function LocationStep({ answers, set, T, opts }: { answers: SetupAnswers; set: (p: Partial<SetupAnswers>) => void; T: TFn; opts: QuestionOption[]; lang: WorkerLanguage }) {
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'found' | 'failed'>(answers.geo ? 'found' : 'idle');
  const [guess, setGuess] = useState<string | null>(null);
  const launch = answers.country === 'NG' || answers.country === 'KE' || answers.country === 'GH';
  const known = launch ? listRegions(answers.country as 'NG' | 'KE' | 'GH') : [];
  const typed = answers.region !== undefined && answers.region !== 'not_sure' && !known.includes(answers.region);
  const [otherOpen, setOtherOpen] = useState(typed);

  const useMine = async () => {
    setGeoState('asking');
    const pos = await requestPosition();
    if (!pos) return setGeoState('failed');
    const near = nearestRegion(pos.lat, pos.lon);
    set({ geo: pos, ...(near && (!launch || near.country === answers.country) ? { country: near.country, region: near.region } : {}) });
    setGuess(near ? near.region : null);
    setGeoState(near ? 'found' : 'failed');
  };

  return (
    <div className="setup-location">
      <div className="setup-geo">
        <button type="button" className="setup-option setup-geo-btn" onClick={useMine} disabled={geoState === 'asking'}>
          <span className="setup-option-icon">
            <SetupIcon name="pin" />
          </span>
          <span className="setup-option-text">
            <span className="setup-option-label">{geoState === 'asking' ? '…' : T('use_location')}</span>
            <span className="setup-option-hint">{T('location_consent')}</span>
          </span>
        </button>
        {geoState === 'found' && guess ? <p className="setup-note setup-note-ok">{T('location_found', { region: guess })}</p> : null}
        {geoState === 'failed' ? <p className="setup-note">{T('location_failed')}</p> : null}
      </div>
      {launch ? (
        <>
          <p className="setup-help">{T('location_where')}</p>
          <div className="setup-options setup-options-compact" role="radiogroup">
            {opts.map((o) => (
              <OptionButton
                key={String(o.value)}
                o={o}
                label={o.value === 'not_sure' ? T('not_sure') : o.label}
                selected={o.value === '__other' ? otherOpen : !otherOpen && answers.region === o.value}
                onClick={() => {
                  if (o.value === '__other') {
                    setOtherOpen(true);
                    set({ region: '' });
                  } else {
                    setOtherOpen(false);
                    set({ region: String(o.value) });
                  }
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      {otherOpen || !launch ? (
        <label className="setup-field">
          <span>{launch ? (answers.country === 'NG' ? 'State' : answers.country === 'KE' ? 'County' : 'Region') : 'Province, state or region'}</span>
          <input className="setup-input" value={answers.region && answers.region !== 'not_sure' ? answers.region : ''} onChange={(e) => set({ region: e.target.value })} />
        </label>
      ) : null}
      <label className="setup-field">
        <span>{T('district')}</span>
        <input className="setup-input" value={answers.district ?? ''} placeholder={T('district_hint')} onChange={(e) => set({ district: e.target.value })} />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary and apply
// ---------------------------------------------------------------------------

const STEP_ORDER: ApplyStepId[] = ['storage', 'languages', 'ai', 'place'];
const STEP_KEY: Record<ApplyStepId, SetupKey> = { storage: 'step_storage', languages: 'step_lang', ai: 'step_ai', place: 'step_place' };

function Card({ icon, title, children }: { icon: Parameters<typeof SetupIcon>[0]['name']; title: string; children: React.ReactNode }) {
  return (
    <section className="setup-card">
      <div className="setup-card-head">
        <span className="setup-card-icon">
          <SetupIcon name={icon} size={32} />
        </span>
        <h2>{title}</h2>
      </div>
      <div className="setup-card-body">{children}</div>
    </section>
  );
}

function langName(code: string): string {
  return (LANGUAGE_NAMES as Record<string, string>)[code] ?? (code === 'fr' ? 'French' : code);
}

interface SummaryProps {
  plan: SetupPlan;
  answers: SetupAnswers;
  T: TFn;
  lang: WorkerLanguage;
  applying: boolean;
  onBack: () => void;
  onApply: (apiKey: string | undefined, onProgress: (p: ApplyProgress) => void) => Promise<void>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

function Summary({ plan, T, applying, onBack, onApply, headingRef }: SummaryProps) {
  const [apiKey, setApiKey] = useState('');
  const [progress, setProgress] = useState<Partial<Record<ApplyStepId, ApplyProgress>>>({});
  const [assistant, setAssistant] = useState<AssistantConnection | null>(null);
  const [copied, setCopied] = useState(false);
  const profile = plan.country !== 'other' && plan.region ? getLocationProfile(plan.country, plan.region) : null;

  useEffect(() => {
    if (plan.ai.mode === 'connect_assistant' && plan.ai.assistant) void connectAssistant(plan.ai.assistant).then(setAssistant);
  }, [plan.ai.mode, plan.ai.assistant]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address is selectable */
    }
  };

  return (
    <section className="setup-screen setup-summary" aria-labelledby="setup-sum-title">
      <header className="setup-top">
        <button type="button" className="setup-link" onClick={onBack} disabled={applying}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {T('change_answers')}
        </button>
      </header>
      <h1 className="setup-title" id="setup-sum-title" tabIndex={-1} ref={headingRef}>
        {T('summary_title')}
      </h1>
      <p className="setup-help">{T('summary_intro')}</p>

      <div className="setup-cards">
        <Card icon={plan.run.where === 'phone_app' ? 'phone_smart' : plan.run.where === 'facility_hub' ? 'computer_shared' : 'laptop'} title={T('card_run')}>
          <p className="setup-strong">{plan.run.label}</p>
          <p>{plan.run.reason}</p>
        </Card>

        <Card icon={plan.storage.mode === 'folder' ? 'computer_shared' : 'check'} title={T('card_storage')}>
          <p className="setup-strong">{plan.storage.label}</p>
          <p>{plan.storage.reason}</p>
        </Card>

        <Card icon="speech_many" title={T('card_languages')}>
          <p className="setup-strong">
            {langName(plan.languages.ui)} for you
            {plan.languages.mothers.length ? `; ${plan.languages.mothers.map(langName).join(', ')} for mothers` : ''}
          </p>
          {plan.languages.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </Card>

        <Card icon="spark" title={T('card_ai')}>
          <p className="setup-strong">{plan.ai.label}</p>
          <p>{plan.ai.reason}</p>
          {plan.ai.mode !== 'none' ? <p className="setup-privacy">{T('privacy_on')}</p> : null}
          {plan.ai.needsKey ? (
            <label className="setup-field">
              <span>{T('key_label', { service: plan.ai.needsKey.service })}</span>
              <input className="setup-input" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={applying} />
              <small>
                {T('key_hint')}
                {plan.ai.needsKey.getKeyUrl ? (
                  <>
                    {' '}
                    <a href={plan.ai.needsKey.getKeyUrl} target="_blank" rel="noreferrer">
                      Get a key
                    </a>
                  </>
                ) : null}
              </small>
            </label>
          ) : null}
          {assistant ? (
            <div className="setup-assistant">
              <ol>
                {assistant.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {assistant.kind === 'download' && assistant.downloadUrl ? (
                <a className="setup-secondary" href={assistant.downloadUrl} download={assistant.fileName}>
                  Download "Gaskin for Claude"
                </a>
              ) : null}
              {assistant.kind === 'address' && assistant.address ? (
                <div className="setup-copyrow">
                  <code>{assistant.address}</code>
                  <button type="button" className="setup-secondary" onClick={() => copy(assistant.address!)}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : null}
              {assistant.note ? <p className="setup-note">{assistant.note}</p> : null}
            </div>
          ) : null}
        </Card>

        <Card icon="chat" title={T('card_messages')}>
          <ul className="setup-list">
            {plan.channels.map((c) => (
              <li key={c.channel}>
                <strong>{c.channel === 'sms' ? 'SMS' : c.channel === 'whatsapp' ? 'WhatsApp' : c.channel === 'voice' ? 'Voice call or voice note' : c.channel === 'print' ? 'Printed picture cards' : 'Email'}</strong>
                {c.primary ? ' (main)' : ''}: {c.reason}
              </li>
            ))}
          </ul>
        </Card>

        <Card icon="printer" title={T('card_print')}>
          <p>{plan.printing.routine}</p>
        </Card>

        <Card icon="check" title={T('card_sync')}>
          <p>{plan.sync.routine}</p>
        </Card>

        {profile ? (
          <Card icon="map" title={T('card_place')}>
            <p className="setup-strong">
              {profile.region}
              {plan.district ? `, ${plan.district}` : ''}
            </p>
            {profile.localFoods.length ? <p>Local foods in plans: {profile.localFoods.slice(0, 4).map((f) => f.householdMeasure).join('; ')}.</p> : null}
            <p>{profile.malariaNote}</p>
            {profile.referralFacilities.length ? <p>Referral: {profile.referralFacilities.map((f) => f.name).join('; ')}.</p> : null}
          </Card>
        ) : null}

        <Card icon="star_4" title={T('card_first')}>
          <ol className="setup-list setup-steps">
            {plan.firstTenMinutes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {plan.notes.length ? (
            <ul className="setup-list setup-notes">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      {applying ? (
        <ol className="setup-progress" aria-live="polite">
          {STEP_ORDER.map((id) => {
            const p = progress[id];
            const state = p?.state ?? 'waiting';
            return (
              <li key={id} className={`setup-progress-item is-${state}`}>
                <span className="setup-progress-mark" aria-hidden="true">
                  {state === 'done' || state === 'skipped' ? '✓' : state === 'fallback' ? '!' : state === 'running' ? '…' : ''}
                </span>
                <span>
                  {T(STEP_KEY[id])}
                  {id === 'languages' && p?.progress !== undefined && state === 'running' ? ` ${Math.round(p.progress * 100)}%` : ''}
                  {p?.note && state !== 'running' ? <small>{p.note}</small> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="setup-actions setup-actions-sticky">
        <button
          type="button"
          className="setup-primary setup-primary-big"
          disabled={applying}
          onClick={() => onApply(apiKey || undefined, (p) => setProgress((cur) => ({ ...cur, [p.step]: p })))}
        >
          {applying ? T('applying') : T('apply')}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Styles (prefixed, theme tokens with fallbacks)
// ---------------------------------------------------------------------------

const CSS = `
.setup-root{min-height:100dvh;background:var(--paper,#f6f1e6);color:var(--ink,#221d17);font-family:var(--sans,system-ui,sans-serif);display:flex;justify-content:center;padding:0 var(--gutter,16px) 120px}
.setup-screen{width:100%;max-width:640px;display:flex;flex-direction:column;gap:14px;padding-top:12px}
.setup-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px}
.setup-link{display:inline-flex;align-items:center;gap:4px;min-height:48px;padding:0 10px;margin:0 -10px;border:0;background:none;color:var(--clay-ink,#8a3a20);font:inherit;font-weight:600;font-size:1.05rem;cursor:pointer;border-radius:var(--r-m,10px)}
.setup-link:disabled{opacity:.4;cursor:default}
.setup-link:focus-visible,.setup-option:focus-visible,.setup-primary:focus-visible,.setup-secondary:focus-visible,.setup-input:focus-visible{outline:3px solid var(--focus,#a3482a);outline-offset:2px}
.setup-link-spacer{width:48px}
.setup-count{color:var(--ink-3,#7b7062);font-size:.95rem}
.setup-dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.setup-dot{width:10px;height:10px;border-radius:50%;background:var(--line-2,#d0c3ab)}
.setup-dot.is-done{background:var(--green,#2d5b45)}
.setup-dot.is-here{background:var(--clay,#a3482a);transform:scale(1.35)}
.setup-title{font-family:var(--serif,Georgia,serif);font-weight:500;font-size:clamp(1.6rem,5.4vw,2.2rem);line-height:1.18;margin:8px 0 0;outline:none}
.setup-help{margin:0;color:var(--ink-2,#4f463b);font-size:1.05rem;line-height:1.45}
.setup-options{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:560px){.setup-options{grid-template-columns:1fr 1fr}}
.setup-options-compact .setup-option{min-height:64px}
.setup-option{position:relative;display:flex;align-items:center;gap:14px;min-height:76px;width:100%;padding:12px 16px;text-align:left;border:2px solid var(--line,#e3d9c6);border-radius:var(--r-l,16px);background:var(--card,#fbf8f1);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,background .15s}
.setup-option:hover{border-color:var(--line-2,#d0c3ab)}
.setup-option.is-selected{border-color:var(--clay,#a3482a);background:var(--clay-soft,#f2dfd2)}
.setup-option:disabled{opacity:.6}
.setup-option-icon{flex:none;display:grid;place-items:center;width:52px;height:52px;color:var(--clay,#a3482a)}
.setup-option-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.setup-option-label{font-size:1.15rem;font-weight:600;line-height:1.25}
.setup-option-hint{font-size:.92rem;color:var(--ink-3,#7b7062);line-height:1.35}
.setup-option-tick{position:absolute;top:8px;right:10px;color:var(--clay,#a3482a)}
.setup-field{display:flex;flex-direction:column;gap:6px;font-weight:600}
.setup-field small{font-weight:400;color:var(--ink-3,#7b7062)}
.setup-input{min-height:56px;padding:0 14px;font:inherit;font-size:1.1rem;border:2px solid var(--line-2,#d0c3ab);border-radius:var(--r-m,10px);background:var(--raised,#fffdf8);color:inherit}
.setup-actions{display:flex;justify-content:flex-end;padding-top:6px}
.setup-actions-sticky{position:sticky;bottom:0;padding:12px 0 calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top,var(--paper,#f6f1e6) 70%,transparent)}
.setup-primary{min-height:60px;min-width:180px;padding:0 28px;border:0;border-radius:999px;background:var(--clay,#a3482a);color:var(--paper,#fff);font:inherit;font-size:1.15rem;font-weight:700;cursor:pointer}
.setup-primary:disabled{opacity:.45;cursor:default}
.setup-primary-big{width:100%;min-height:68px;font-size:1.25rem}
.setup-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 20px;border:2px solid var(--clay,#a3482a);border-radius:999px;background:none;color:var(--clay-ink,#8a3a20);font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.setup-note{margin:0;padding:10px 12px;border-radius:var(--r-m,10px);background:var(--amber-soft,#f6e6c4);color:var(--ink,#221d17)}
.setup-note-ok{background:var(--green-soft,#dde8de)}
.setup-location{display:flex;flex-direction:column;gap:14px}
.setup-geo{display:flex;flex-direction:column;gap:8px}
.setup-geo-btn{border-style:dashed}
.setup-skipall{text-align:center;margin:12px 0 0}
.setup-cards{display:grid;gap:12px}
.setup-card{border:1px solid var(--line,#e3d9c6);border-radius:var(--r-l,16px);background:var(--card,#fbf8f1);padding:14px 16px}
.setup-card-head{display:flex;align-items:center;gap:10px}
.setup-card-head h2{margin:0;font-size:.95rem;font-weight:700;letter-spacing:.02em;color:var(--ink-3,#7b7062);text-transform:uppercase}
.setup-card-icon{color:var(--clay,#a3482a);display:grid}
.setup-card-body p{margin:8px 0 0;line-height:1.45}
.setup-strong{font-weight:700;font-size:1.08rem}
.setup-privacy{font-size:.95rem;color:var(--green,#2d5b45)}
.setup-list{margin:8px 0 0;padding-left:20px;display:grid;gap:6px;line-height:1.45}
.setup-steps li::marker{font-weight:700;color:var(--clay,#a3482a)}
.setup-notes{color:var(--ink-2,#4f463b);font-size:.95rem}
.setup-assistant{margin-top:10px;display:grid;gap:10px}
.setup-assistant ol{margin:0;padding-left:20px;display:grid;gap:4px}
.setup-copyrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.setup-copyrow code{flex:1 1 220px;padding:12px;border-radius:var(--r-m,10px);background:var(--paper-sunk,#eee6d6);overflow-wrap:anywhere;user-select:all}
.setup-progress{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}
.setup-progress-item{display:flex;gap:10px;align-items:flex-start;font-size:1.05rem}
.setup-progress-item small{display:block;color:var(--ink-3,#7b7062);font-size:.9rem}
.setup-progress-mark{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid var(--line-2,#d0c3ab);font-weight:700}
.setup-progress-item.is-done .setup-progress-mark,.setup-progress-item.is-skipped .setup-progress-mark{background:var(--green,#2d5b45);border-color:var(--green,#2d5b45);color:var(--paper,#fff)}
.setup-progress-item.is-fallback .setup-progress-mark{background:var(--amber,#9a6110);border-color:var(--amber,#9a6110);color:var(--paper,#fff)}
.setup-progress-item.is-running .setup-progress-mark{border-color:var(--clay,#a3482a);color:var(--clay,#a3482a)}
.setup-icon{display:block}
@media (prefers-reduced-motion:reduce){.setup-option,.setup-dot{transition:none}}
`;

// Re-exported so the UI can show the same "Not sure" label elsewhere
export { NOT_SURE };
