/**
 * Guided visit: one section at a time, sized for a phone held in one hand.
 * Every check has a clear normal/abnormal choice, numbers carry their units, and each item
 * opens a "Why this check" note with its sources. The "Tell the mother" step shows each line
 * in her language (through src/i18n) with a confidence badge, and the summary lists every
 * abnormal finding with what will happen before anything is saved.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { ClinicalEvent, IllustrationKey, LanguageCode, Mother } from '../../types';
import { renderIllustration } from '../../illustrations';
import { ConfidenceBadge, registerTemplates, renderMotherText as renderI18n, t as tUi, type Confidence, type PackCode } from '../../i18n';
import { buildVisitChecklist, checklistToEvents, evaluateFindings, findingsFor, isItemActive, type BuildOptions } from '../build';
import { EPDS_ITEMS } from '../epds';
import { renderVisitText, VISIT_TEXT } from '../text';
import type { ChecklistItem, ChecklistResult, Finding, VisitChecklist as Checklist, VisitSection } from '../types';
import { VISIT_CSS } from './styles';

let registered = false;
function ensureTemplates() {
  if (registered) return;
  try {
    registerTemplates('visits', VISIT_TEXT);
  } catch {
    /* already registered with identical text, or a clash reported by the i18n tests */
  }
  registered = true;
}
// Register at load so language packs and the pack editor see the visit lines before any visit opens.
ensureTemplates();

let styled = false;
function ensureStyles() {
  if (styled || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.setAttribute('data-gaskin', 'visits');
  el.textContent = VISIT_CSS;
  document.head.appendChild(el);
  styled = true;
}

interface Rendered {
  text: string;
  english: string;
  lang: string;
  confidence: Confidence;
  dir: 'ltr' | 'rtl';
}

/** Mother-facing line in her language, falling back to plain English. */
function motherLine(key: string, params: Record<string, string | number> | undefined, lang: string): Rendered {
  ensureTemplates();
  try {
    const r = renderI18n(key, params ?? {}, lang as PackCode);
    return { text: r.text, english: r.english, lang: r.lang, confidence: r.confidence, dir: r.dir };
  } catch {
    const english = renderVisitText(key, params);
    return { text: english, english, lang: 'en', confidence: lang === 'en' ? 'reviewed' : 'fallback', dir: 'ltr' };
  }
}

function ui(key: string, english: string, lang: string): string {
  if (lang === 'en') return english;
  try {
    const s = tUi(key as Parameters<typeof tUi>[0], lang as PackCode);
    return s && s !== key ? s : english;
  } catch {
    return english;
  }
}

export interface VisitChecklistProps {
  mother: Mother;
  asOf: string;
  workerLang: LanguageCode | string;
  motherLang: LanguageCode | string;
  /** Worker id written on every event */
  workerId?: string;
  /** Pick a template or a child; otherwise the due visit for her stage */
  options?: BuildOptions;
  onComplete: (events: ClinicalEvent[], checklist: Checklist, results: Record<string, ChecklistResult>) => void;
  onCancel: () => void;
}

type Step = VisitSection | 'summary';

const SECTION_HINT: Record<VisitSection, string> = {
  ask: 'Ask her these questions.',
  check_mother: 'Examine the mother.',
  check_baby: 'Examine the baby.',
  milestones: 'Watch the child play, or ask the mother.',
  do: 'Tests, medicines and vaccines due today.',
  tell: 'Say these in her language. Tick each one once she has understood.',
  book: 'Agree the next visit.',
};

export function VisitChecklist({ mother, asOf, workerLang, motherLang, workerId, options, onComplete, onCancel }: VisitChecklistProps) {
  ensureStyles();
  const checklist = useMemo(() => buildVisitChecklist(mother, asOf, options), [mother, asOf, options]);
  const [results, setResults] = useState<Record<string, ChecklistResult>>({});
  const steps: Step[] = [...checklist.sections.map((s) => s.id), 'summary'];
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const wl = String(workerLang);
  const ml = String(motherLang);

  const set = (id: string, r: Omit<ChecklistResult, 'itemId'> | null) =>
    setResults((prev) => {
      const next = { ...prev };
      if (r) next[id] = { itemId: id, ...r };
      else delete next[id];
      return next;
    });

  const activeItems = checklist.items.filter((i) => isItemActive(i, checklist, results));
  const answered = activeItems.filter((i) => results[i.id]).length;
  const findings = evaluateFindings(checklist, results);

  const go = (d: number) => {
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + d)));
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  };

  const finish = () => {
    const events = checklistToEvents(checklist, results, workerId ?? mother.assignedWorkerId, asOf);
    onComplete(events, checklist, results);
  };

  return (
    <div className="visit-root" lang={wl}>
      <header className="visit-head">
        <button type="button" className="visit-link" onClick={onCancel}>
          {'Cancel'}
        </button>
        <div className="visit-head-title">
          <div className="visit-eyebrow">{checklist.label}</div>
          <div className="visit-who">
            {mother.name}
            {checklist.children.map((c) => (
              <span key={c.id} className="visit-chip">
                {c.name}, {c.ageLabel}
                {c.correctedAgeDays !== undefined ? ` (corrected ${Math.round(c.correctedAgeDays / 7)} wk)` : ''}
              </span>
            ))}
          </div>
        </div>
      </header>

      <nav className="visit-steps" aria-label="Visit steps">
        {steps.map((s, i) => {
          const sec = checklist.sections.find((x) => x.id === s);
          const items = sec ? sec.items.filter((it) => isItemActive(it, checklist, results)) : [];
          const doneN = items.filter((it) => results[it.id]).length;
          const flagged = sec ? findings.some((f) => sec.items.some((it) => it.id === f.itemId)) : findings.length > 0;
          return (
            <button key={s} type="button" className={`visit-step${i === stepIdx ? ' is-current' : ''}${flagged ? ' is-flagged' : ''}${sec && doneN === items.length && items.length ? ' is-done' : ''}`} onClick={() => setStepIdx(i)} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="visit-step-label">{sec ? sec.title : 'Summary'}</span>
              {sec ? <span className="visit-step-count">{doneN}/{items.length}</span> : null}
            </button>
          );
        })}
      </nav>
      <div className="visit-progress" role="progressbar" aria-valuemin={0} aria-valuemax={activeItems.length} aria-valuenow={answered} aria-label="Items answered">
        <div className="visit-progress-bar" style={{ width: `${activeItems.length ? (answered / activeItems.length) * 100 : 0}%` }} />
      </div>

      {checklist.personalisation.length > 0 && stepIdx === 0 ? (
        <details className="visit-personal">
          <summary>Tailored for her ({checklist.personalisation.length})</summary>
          <ul>
            {checklist.personalisation.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <main className="visit-body">
        {step === 'summary' ? (
          <Summary checklist={checklist} findings={findings} results={results} wl={wl} ml={ml} />
        ) : (
          <SectionView
            section={checklist.sections.find((s) => s.id === step)!.items.filter((i) => isItemActive(i, checklist, results))}
            hint={SECTION_HINT[step]}
            title={checklist.sections.find((s) => s.id === step)!.title}
            results={results}
            set={set}
            ml={ml}
            wl={wl}
            checklist={checklist}
          />
        )}
      </main>

      <footer className="visit-foot">
        <button type="button" className="visit-btn visit-btn--ghost" onClick={() => (stepIdx === 0 ? onCancel() : go(-1))}>
          {stepIdx === 0 ? 'Cancel' : ui('nav.back', 'Back', wl)}
        </button>
        {step === 'summary' ? (
          <button type="button" className="visit-btn visit-btn--primary" onClick={finish}>
            Save visit{findings.some((f) => f.action === 'refer') ? ' and referral' : ''}
          </button>
        ) : (
          <button type="button" className="visit-btn visit-btn--primary" onClick={() => go(1)}>
            Next
          </button>
        )}
      </footer>
    </div>
  );
}

// ---------- Section ----------

function SectionView({ section, title, hint, results, set, ml, wl, checklist }: { section: ChecklistItem[]; title: string; hint: string; results: Record<string, ChecklistResult>; set: (id: string, r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string; checklist: Checklist }) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const it of section) {
    const k = it.childName ?? '';
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const multiChild = checklist.children.length > 1;
  return (
    <section className="visit-section">
      <h2 className="visit-h2">{title}</h2>
      <p className="visit-hint">{hint}</p>
      {[...groups.entries()].map(([name, items]) => (
        <div key={name || 'mother'} className="visit-group">
          {name && multiChild ? <h3 className="visit-h3">{name}</h3> : null}
          {items.map((it) => (
            <ItemCard key={it.id} item={it} result={results[it.id]} set={(r) => set(it.id, r)} ml={ml} wl={wl} />
          ))}
        </div>
      ))}
    </section>
  );
}

// ---------- Item ----------

function Pict({ k }: { k?: IllustrationKey }) {
  if (!k) return null;
  return <span className="visit-pict" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderIllustration(k, { size: 44 }) }} />;
}

function ItemCard({ item, result, set, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; set: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const findings = result ? findingsFor(item, result) : [];
  const abnormal = findings.length > 0;
  return (
    <article className={`visit-item${abnormal ? ' is-abnormal' : result ? ' is-answered' : ''}${item.priority === 1 ? ' is-p1' : ''}`} id={`vi-${item.id}`}>
      <div className="visit-item-head">
        <Pict k={item.illustration} />
        <div className="visit-item-titles">
          <h4 className="visit-item-title">{item.title}</h4>
          {item.how ? <p className="visit-how">{item.how}</p> : null}
          {item.because?.length ? <p className="visit-because">Because: {item.because.join(', ')}</p> : null}
        </div>
      </div>
      <ItemInputView item={item} result={result} set={set} ml={ml} wl={wl} />
      {findings.map((f, i) => (
        <div key={i} className={`visit-finding visit-finding--${f.urgency}`} role="status">
          <strong>{f.label}.</strong> <span className={`visit-action visit-action--${f.action}`}>{f.action === 'refer' ? (f.urgency === 'emergency' ? 'Refer now' : f.urgency === 'urgent' ? 'Refer today' : 'Refer') : f.action === 'treat' ? 'Treat' : 'Recheck'}</span> {f.todo}
        </div>
      ))}
      <details className="visit-why">
        <summary>Why this check</summary>
        <p>{item.why}</p>
        <ul className="visit-sources">
          {item.sources.map((s) => (
            <li key={s.id}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function Toggle({ options, value, onChange, name }: { options: Array<{ value: string; label: string; tone?: 'ok' | 'bad' | 'neutral' }>; value?: string; onChange: (v: string | null) => void; name: string }) {
  return (
    <div className="visit-toggle" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`visit-opt visit-opt--${o.tone ?? 'neutral'}${value === o.value ? ' is-on' : ''}`} onClick={() => onChange(value === o.value ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({ unit, min, max, step, value, onChange, label, normal }: { unit: string; min: number; max: number; step: number; value?: number; onChange: (v: number | undefined) => void; label: string; normal?: string }) {
  const [text, setText] = useState(value !== undefined ? String(value) : '');
  return (
    <div className="visit-num">
      <label className="visit-num-row">
        <input
          className="visit-num-input"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          aria-label={label}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) && v >= min && v <= max ? v : undefined);
          }}
        />
        <span className="visit-unit">{unit}</span>
      </label>
      {normal ? <span className="visit-normal">Normal: {normal}</span> : null}
    </div>
  );
}

function ItemInputView({ item, result, set, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; set: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const inp = item.input;
  switch (inp.kind) {
    case 'normal_abnormal':
      return (
        <>
          <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'normal' | 'abnormal' } : null)} options={[{ value: 'normal', label: `Normal: ${inp.normal}`, tone: 'ok' }, { value: 'abnormal', label: inp.abnormal.label, tone: 'bad' }]} />
        </>
      );
    case 'yes_no':
      return <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'yes' | 'no' } : null)} options={[{ value: 'yes', label: 'Yes', tone: inp.abnormalWhen === 'yes' ? 'bad' : 'ok' }, { value: 'no', label: 'No', tone: inp.abnormalWhen === 'no' ? 'bad' : 'ok' }]} />;
    case 'number':
      return <NumberField label={item.title} unit={inp.unit} min={inp.min} max={inp.max} step={inp.step} normal={inp.normal} value={result?.value} onChange={(v) => set(v === undefined ? null : { status: 'value', value: v })} />;
    case 'bp':
      return <BpField value={result} onChange={(s, d) => set(s !== undefined && d !== undefined ? { status: 'value', value: s, value2: d } : null)} />;
    case 'choice':
      return <Toggle name={item.title} value={result?.choice} onChange={(v) => set(v ? { status: 'value', choice: v } : null)} options={inp.options.map((o) => ({ value: o.value, label: o.label, tone: o.finding ? 'bad' : 'ok' }))} />;
    case 'multi': {
      const chosen = result?.choices ?? [];
      const none = result?.status === 'normal';
      return (
        <div className="visit-multi">
          <button type="button" className={`visit-opt visit-opt--ok${none ? ' is-on' : ''}`} aria-pressed={none} onClick={() => set(none ? null : { status: 'normal', choices: [] })}>
            {inp.noneLabel}
          </button>
          {inp.options.map((o) => {
            const on = chosen.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                className={`visit-opt visit-opt--${o.finding ? 'bad' : 'neutral'}${on ? ' is-on' : ''}`}
                onClick={() => {
                  const next = on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value];
                  set(next.length ? { status: 'abnormal', choices: next } : null);
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'epds':
      return <EpdsField result={result} onChange={set} />;
    case 'done':
      return <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'done' | 'not_done' } : null)} options={[{ value: 'done', label: inp.doneLabel, tone: 'ok' }, { value: 'not_done', label: inp.notDoneLabel, tone: inp.notDone ? 'bad' : 'neutral' }]} />;
    case 'milestone':
      return (
        <>
          {item.textKey ? <MotherBlock keys={[item.textKey]} params={item.params} ml={ml} wl={wl} compact /> : null}
          <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'achieved' | 'not_yet' } : null)} options={[{ value: 'achieved', label: 'Yes, does this', tone: 'ok' }, { value: 'not_yet', label: 'Not yet', tone: 'bad' }]} />
        </>
      );
    case 'told':
      return (
        <>
          <MotherBlock keys={[item.textKey!, ...(item.subKeys ?? [])]} params={item.params} ml={ml} wl={wl} illustration={item.illustration} />
          <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: 'told' } : null)} options={[{ value: 'told', label: 'Told, and she understood', tone: 'ok' }]} />
        </>
      );
    case 'book':
      return <BookField item={item} result={result} onChange={set} ml={ml} wl={wl} />;
    default:
      return null;
  }
}

function BpField({ value, onChange }: { value?: ChecklistResult; onChange: (s?: number, d?: number) => void }) {
  const [s, setS] = useState(value?.value !== undefined ? String(value.value) : '');
  const [d, setD] = useState(value?.value2 !== undefined ? String(value.value2) : '');
  const parse = (x: string, lo: number, hi: number) => {
    const v = parseInt(x, 10);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
  };
  return (
    <div className="visit-num">
      <div className="visit-num-row visit-bp">
        <input className="visit-num-input" type="number" inputMode="numeric" aria-label="Systolic" placeholder="120" value={s} onChange={(e) => { setS(e.target.value); onChange(parse(e.target.value, 50, 260), parse(d, 30, 160)); }} />
        <span className="visit-bp-slash">/</span>
        <input className="visit-num-input" type="number" inputMode="numeric" aria-label="Diastolic" placeholder="80" value={d} onChange={(e) => { setD(e.target.value); onChange(parse(s, 50, 260), parse(e.target.value, 30, 160)); }} />
        <span className="visit-unit">mmHg</span>
      </div>
      <span className="visit-normal">Normal: below 140/90</span>
    </div>
  );
}

function EpdsField({ result, onChange }: { result?: ChecklistResult; onChange: (r: Omit<ChecklistResult, 'itemId'> | null) => void }) {
  const [answers, setAnswers] = useState<Array<number | null>>(() => EPDS_ITEMS.map(() => null));
  const update = (i: number, v: number) => {
    const next = answers.map((a, j) => (j === i ? v : a));
    setAnswers(next);
    if (next.every((a) => a !== null)) {
      const score = next.reduce<number>((s, a) => s + (a ?? 0), 0);
      onChange({ status: 'value', value: score, selfHarm: (next[9] ?? 0) > 0 });
    } else onChange(null);
  };
  return (
    <ol className="visit-epds">
      {EPDS_ITEMS.map((q, i) => (
        <li key={i} className={i === 9 ? 'is-self-harm' : undefined}>
          <p className="visit-epds-q">{q.q}</p>
          <div className="visit-toggle visit-toggle--stack">
            {q.opts.map(([label, v]) => (
              <button key={label} type="button" className={`visit-opt${answers[i] === v ? ' is-on' : ''}`} aria-pressed={answers[i] === v} onClick={() => update(i, v)}>
                {label}
              </button>
            ))}
          </div>
        </li>
      ))}
      {result?.value !== undefined ? <li className="visit-epds-total">Total {result.value} of 30{result.selfHarm ? ' · item 10 positive' : ''}</li> : null}
    </ol>
  );
}

function BookField({ item, result, onChange, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; onChange: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const proposed = item.next?.date ?? '';
  const date = result?.date ?? proposed;
  const params = { ...(item.params ?? {}), date: shortLabel(date) };
  return (
    <div className="visit-book">
      <label className="visit-num-row">
        <input className="visit-num-input visit-date" type="date" value={date} onChange={(e) => onChange({ status: 'booked', date: e.target.value })} aria-label="Next visit date" />
      </label>
      <MotherBlock keys={['vt.next_visit']} params={params} ml={ml} wl={wl} illustration="calendar" />
      <Toggle name="Booked" value={result?.status} onChange={(v) => onChange(v ? { status: 'booked', date } : null)} options={[{ value: 'booked', label: 'Booked and written on her card', tone: 'ok' }]} />
    </div>
  );
}

function shortLabel(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${months[m - 1]}` : iso;
}

function MotherBlock({ keys, params, ml, wl, illustration, compact }: { keys: string[]; params?: Record<string, string | number>; ml: string; wl: string; illustration?: IllustrationKey; compact?: boolean }) {
  const lines = keys.map((k) => motherLine(k, params, ml));
  const dir = lines[0]?.dir ?? 'ltr';
  const showEnglish = ml !== 'en' && lines.some((l) => l.lang !== 'en');
  return (
    <div className={`visit-mother${compact ? ' visit-mother--compact' : ''}`} dir={dir} lang={lines[0]?.lang}>
      {!compact ? <Pict k={illustration} /> : null}
      <div className="visit-mother-text">
        {lines.map((l, i) => (
          <p key={i} className={i === 0 ? 'visit-mother-lead' : 'visit-mother-sub'}>
            {l.text}
          </p>
        ))}
        {!compact ? (
          <div className="visit-mother-meta" dir="ltr">
            <ConfidenceBadge confidence={worst(lines.map((l) => l.confidence))} lang={wl as PackCode} compact />
            {showEnglish ? <span className="visit-english">{lines.map((l) => l.english).join(' ')}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function worst(cs: Confidence[]): Confidence {
  if (cs.includes('fallback')) return 'fallback';
  if (cs.includes('draft')) return 'draft';
  return 'reviewed';
}

// ---------- Summary ----------

function Summary({ checklist, findings, results, wl, ml }: { checklist: Checklist; findings: Finding[]; results: Record<string, ChecklistResult>; wl: string; ml: string }) {
  const unanswered = checklist.items.filter((i) => isItemActive(i, checklist, results) && !results[i.id] && i.priority <= 2);
  const refer = findings.filter((f) => f.action === 'refer');
  const treat = findings.filter((f) => f.action === 'treat');
  const recheck = findings.filter((f) => f.action === 'recheck');
  const vaccines = checklist.items.filter((i) => i.vaccines && i.section === 'do' && results[i.id]?.status === 'done').flatMap((i) => i.vaccines!);
  const book = results['bk.next']?.date ?? checklist.nextVisit?.date;
  const block = (title: string, list: Finding[], tone: string): ReactNode =>
    list.length ? (
      <div className={`visit-sum-block visit-sum-block--${tone}`}>
        <h3 className="visit-h3">{title}</h3>
        <ul>
          {list.map((f, i) => (
            <li key={i}>
              <strong>
                {f.childName ? `${f.childName}: ` : ''}
                {f.label}.
              </strong>{' '}
              {f.todo}
              {f.urgency !== 'routine' && f.action === 'refer' ? <span className={`visit-pill visit-pill--${f.urgency}`}>{f.urgency === 'emergency' ? 'Now' : 'Today'}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  const referLine = refer.length ? motherLine(refer.some((f) => f.urgency === 'emergency') ? 'vt.refer_now' : 'vt.refer_today', { place: 'the hospital' }, ml) : undefined;
  return (
    <section className="visit-section">
      <h2 className="visit-h2">Summary</h2>
      {findings.length === 0 ? <p className="visit-ok">No abnormal findings recorded.</p> : null}
      {block('Referral', refer, 'refer')}
      {block('Treat or advise now', treat, 'treat')}
      {block('Recheck', recheck, 'recheck')}
      {refer.length ? (
        <p className="visit-what">
          Saving creates a {refer[0].urgency} referral on her timeline. Her plan updates at once{refer.some((f) => f.symptom) ? ', and the danger-sign alerts appear on the Today list' : ''}. Confirm she arrived.
        </p>
      ) : null}
      {referLine ? (
        <div className="visit-mother" dir={referLine.dir}>
          <div className="visit-mother-text">
            <p className="visit-mother-lead">{referLine.text}</p>
            <div className="visit-mother-meta" dir="ltr">
              <ConfidenceBadge confidence={referLine.confidence} lang={wl as PackCode} compact />
            </div>
          </div>
        </div>
      ) : null}
      {vaccines.length ? <p className="visit-what">Vaccines to record: {vaccines.join(', ')}.</p> : null}
      {book ? <p className="visit-what">Next visit: {shortLabel(book)}.</p> : null}
      {unanswered.length ? (
        <div className="visit-sum-block visit-sum-block--missing">
          <h3 className="visit-h3">Important items not answered ({unanswered.length})</h3>
          <ul>
            {unanswered.slice(0, 12).map((i) => (
              <li key={i.id}>
                {i.childName ? `${i.childName}: ` : ''}
                {i.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {checklist.skipped.length ? (
        <details className="visit-why">
          <summary>Left out because already done ({checklist.skipped.length})</summary>
          <ul>
            {checklist.skipped.map((s) => (
              <li key={s.id}>
                {s.title}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
