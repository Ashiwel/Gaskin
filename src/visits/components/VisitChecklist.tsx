/**
 * Guided visit: one section at a time, sized for a phone held in one hand.
 *
 * A step rail and a progress ring show where the worker is. Each check is a card with its
 * pictogram, a plain question, large normal/abnormal toggles (or a stepper, a compact choice
 * list, or the EPDS stepper), and "How" and "Why" behind disclosures. Answers that need a reason
 * open their follow-ups inline. Tests offer Done / Not available / Declined / Not done today, and a
 * missing result is shown as unknown, never normal. "Tell the mother" has a language switcher.
 * The Ask step takes the worker's own saved questions. The summary is actionable: record a recheck
 * now, answer a missed item, open a guide, and finish only with every important item answered or
 * an explicit "Finish anyway" with a reason.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen01,
  CheckCircle,
  ChevronDown,
  Clock,
  Edit03,
  HelpCircle,
  Plus,
  SlashCircle01,
  Translate01,
  XCircle,
  XClose,
} from '@untitledui/icons';
import type { ClinicalEvent, HowTo, IllustrationKey, LanguageCode, Mother } from '../../types';
import { renderIllustration } from '../../illustrations';
import { ConfidenceBadge, englishTemplate, getPack, installedLanguages, isPackCode, registerTemplates, renderMotherText as renderI18n, summarisePack, type Confidence, type PackCode } from '../../i18n';
import { LANGUAGE_NAMES } from '../../data';
import { PLAN_TEXT } from '../../clinical';
import { ProgressRing } from '../../components/viz';
import { cx } from '../../utils/cx';
import { buildVisitChecklist, checklistToEvents, evaluateFindings, findingsFor, isItemActive, summariseChecklist, type BuildOptions } from '../build';
import { activeItems } from '../followups';
import { EPDS_PLAIN } from '../epds';
import { facilityById } from '../../data/directory';
import { referralWhen, renderVisitText, VISIT_TEXT } from '../text';
import type { ChecklistItem, ChecklistResult, ChecklistSummary, Finding, VisitChecklist as Checklist, VisitSection } from '../types';
import { addCustomQuestion, customQuestionStore, encodeCustomAnswers, listCustomQuestions, type CustomQuestion } from '../customQuestions';
import { EpdsStepper } from './EpdsStepper';
import { VISIT_CSS } from './styles';

/** Mother text the visit screens add on top of VISIT_TEXT (translated by packs like the rest). */
const VISIT_UI_TEXT: Record<string, string> = {};

let registered = false;
function ensureTemplates() {
  if (registered) return;
  for (const [src, table] of [
    ['visits', VISIT_TEXT],
    ['plan', PLAN_TEXT],
    ['visits-ui', VISIT_UI_TEXT],
  ] as const) {
    try {
      registerTemplates(src, table as Record<string, string>);
    } catch {
      /* already registered with identical text */
    }
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
    if (englishTemplate(key) !== undefined) {
      const r = renderI18n(key, params ?? {}, (isPackCode(lang) ? lang : 'en') as PackCode);
      return { text: r.text, english: r.english, lang: r.lang, confidence: r.confidence, dir: r.dir };
    }
  } catch {
    /* fall through */
  }
  const tpl = VISIT_UI_TEXT[key];
  const english = tpl ? tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? '')) : renderVisitText(key, params);
  return { text: english, english, lang: 'en', confidence: lang === 'en' ? 'reviewed' : 'fallback', dir: 'ltr' };
}

export interface VisitChecklistProps {
  mother: Mother;
  asOf: string;
  workerLang: LanguageCode | string;
  motherLang: LanguageCode | string;
  /** Worker id written on every event */
  workerId?: string;
  /** Worker's name, shown as "Recording as" */
  workerName?: string;
  /** Used to scope saved custom questions to the facility */
  facilityId?: string;
  /** Pick a template or a child; otherwise the due visit for her stage */
  options?: BuildOptions;
  onComplete: (events: ClinicalEvent[], checklist: Checklist, results: Record<string, ChecklistResult>) => void;
  onCancel: () => void;
  /** Open a guide from GUIDES (the host renders the sheet) */
  onOpenGuide?: (guideId: string) => void;
  /** Hide "Add your own question" (e.g. a role that cannot) */
  canAddQuestions?: boolean;
}

type Step = VisitSection | 'summary';

const SECTION_HINT: Record<VisitSection, string> = {
  ask: 'Ask her these questions, in your own words.',
  check_mother: 'Examine the mother.',
  check_baby: 'Examine the baby.',
  milestones: 'Watch the child play, or ask the mother.',
  do: 'Tests, medicines and vaccines due today.',
  tell: 'Say these in her language. Tick each one once she has understood.',
  book: 'Agree the next visit.',
};

const SECTION_SHORT: Record<VisitSection, string> = { ask: 'Ask', check_mother: 'Mother', check_baby: 'Baby', milestones: 'Development', do: 'Do today', tell: 'Tell her', book: 'Book' };

export function VisitChecklist({ mother, asOf, workerLang, motherLang, workerId, workerName, facilityId, options, onComplete, onCancel, onOpenGuide, canAddQuestions = true }: VisitChecklistProps) {
  ensureStyles();
  const checklist = useMemo(() => buildVisitChecklist(mother, asOf, options), [mother, asOf, options]);
  const [results, setResults] = useState<Record<string, ChecklistResult>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const cqVersion = useSyncExternalStore(customQuestionStore.subscribe, customQuestionStore.getVersion, customQuestionStore.getVersion);
  const wid = workerId ?? mother.assignedWorkerId;
  const fid = facilityId ?? mother.facilityId;
  const questions = useMemo(() => listCustomQuestions({ workerId: wid, facilityId: fid, visitType: checklist.visitType, templateId: checklist.templateId }), [wid, fid, checklist.visitType, checklist.templateId, cqVersion]);
  const sectionIds = checklist.sections.map((s) => s.id);
  if (!sectionIds.includes('ask')) sectionIds.unshift('ask');
  const steps: Step[] = [...sectionIds, 'summary'];
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const wl = String(workerLang);
  const [ml, setMl] = useState(String(motherLang));
  const [focusId, setFocusId] = useState<string | null>(null);
  const railRef = useRef<HTMLElement>(null);

  const set = (id: string, r: Omit<ChecklistResult, 'itemId'> | null) =>
    setResults((prev) => {
      const next = { ...prev };
      if (r) next[id] = { itemId: id, ...r };
      else delete next[id];
      return next;
    });

  const all = activeItems(checklist, results).filter((i) => isItemActive(i, checklist, results));
  const answered = all.filter((i) => results[i.id]).length;
  const findings = evaluateFindings(checklist, results);
  const summary = summariseChecklist(checklist, results);

  const goTo = (i: number, itemId?: string) => {
    setStepIdx(Math.min(steps.length - 1, Math.max(0, i)));
    setFocusId(itemId ?? null);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (itemId) document.getElementById(`vi-${itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        else window.scrollTo?.({ top: 0 });
      }, 30);
    }
  };

  const finish = (note?: string) => {
    const events = checklistToEvents(checklist, results, wid, asOf);
    const extra = encodeCustomAnswers(questions.map((q) => ({ question: q, answer: custom[q.id] ?? '' })));
    const withNotes = events.map((e) => (e.kind === 'visit' ? { ...e, note: [e.note, extra, note ? `finished_anyway:${encodeURIComponent(note)}` : ''].filter(Boolean).join('|') } : e));
    onComplete(withNotes, checklist, results);
  };

  const pct = all.length ? (answered / all.length) * 100 : 0;
  // Keep the current step in view in the rail (it scrolls sideways on phones).
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!rail || !el) return;
    const left = el.offsetLeft - rail.offsetLeft - 16;
    const right = left + el.offsetWidth + 32;
    if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) rail.scrollTo({ left: Math.max(0, left - (rail.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
  }, [stepIdx]);
  const mustList = summary.unanswered.filter((u) => mustAnswer(all.find((i) => i.id === u.itemId)?.baseId ?? u.itemId));
  const mustCount = mustList.length;
  const firstMust = mustList[0]?.itemId;
  const answerItem = (itemId: string) => {
    const it = all.find((x) => x.id === itemId);
    const idx = it ? steps.indexOf(it.section) : -1;
    if (idx >= 0) goTo(idx, itemId);
  };

  return (
    <div className="visit-root flex min-h-dvh flex-col bg-primary text-primary" lang={wl}>
      <header className="sticky top-0 z-20 border-b border-secondary bg-primary/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
          <button type="button" className="visit-link grid grid-cols-1 size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-fg-quaternary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2" onClick={onCancel} aria-label="Cancel visit">
            <XClose className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="visit-eyebrow truncate text-xs font-semibold text-brand-secondary">{checklist.label}</p>
            <p className="truncate text-md font-semibold text-primary" data-clip-ok>
              {mother.name}
            </p>
            {checklist.children.length ? <p className="text-sm break-words text-tertiary">{checklist.children.map((c) => `${c.name.split(' ')[0]}, ${c.ageLabel}`).join(' · ')}</p> : null}
            {workerName ? <p className="truncate text-xs text-tertiary">Recording as {workerName}</p> : null}
          </div>
          <ProgressRing value={pct} label="Items answered" size={48} thickness={5} tone={findings.some((f) => f.action === 'refer') ? 'danger' : 'brand'}>
            <span className="text-xs">{Math.round(pct)}%</span>
          </ProgressRing>
        </div>
        <nav ref={railRef} className="visit-steps mx-auto flex max-w-3xl scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-3 sm:flex-wrap sm:overflow-visible" aria-label="Visit steps">
          {steps.map((s, i) => {
            const sec = checklist.sections.find((x) => x.id === s);
            const items = sec ? all.filter((it) => it.section === s) : [];
            const doneN = items.filter((it) => results[it.id]).length;
            const flagged = sec ? findings.some((f) => items.some((it) => it.id === f.itemId)) : findings.length > 0;
            const complete = sec ? items.length > 0 && doneN === items.length : false;
            const cur = i === stepIdx;
            return (
              <button
                key={s}
                type="button"
                data-step={s}
                onClick={() => goTo(i)}
                aria-current={cur ? 'step' : undefined}
                className={cx(
                  'visit-step flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold outline-focus-ring ring-1 ring-inset focus-visible:outline-2',
                  cur ? 'is-current bg-primary-solid text-on-fill ring-transparent' : flagged ? 'is-flagged bg-error-primary text-error-primary ring-error_subtle' : complete ? 'is-done bg-success-primary text-success-primary ring-success_subtle' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover',
                )}
              >
                {!cur && complete && !flagged ? <CheckCircle className="size-4" aria-hidden="true" /> : null}
                {!cur && flagged ? <AlertCircle className="size-4" aria-hidden="true" /> : null}
                <span className="visit-step-label">{sec ? sec.title : 'Summary'}</span>
                {sec ? <span className={cx('visit-step-count text-xs font-medium tnum', cur ? 'text-on-fill/80' : 'text-tertiary')}>{doneN}/{items.length}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="visit-progress h-1 bg-quaternary" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={answered} aria-label="Items answered">
          <div className="visit-progress-bar h-full bg-fg-brand-secondary transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className={cx('visit-body mx-auto w-full max-w-3xl flex-1 px-4 pt-5', step === 'summary' ? 'pb-64' : 'pb-36')}>
        {checklist.personalisation.length > 0 && stepIdx === 0 ? (
          <details className="visit-personal mb-4 rounded-xl bg-brand-primary px-4 py-2 text-sm ring-1 ring-utility-brand-200 ring-inset">
            <summary className="flex min-h-9 cursor-pointer items-center gap-2 font-semibold text-brand-secondary">
              <ChevronDown className="size-4" aria-hidden="true" /> Tailored for her ({checklist.personalisation.length})
            </summary>
            <ul className="mt-1 mb-2 list-disc space-y-1 pl-5 text-secondary">
              {checklist.personalisation.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {step === 'summary' ? (
          <SummaryView
            checklist={checklist}
            summary={summary}
            findings={findings}
            results={results}
            set={set}
            wl={wl}
            ml={ml}
            onAnswer={answerItem}
            onOpenGuide={onOpenGuide}
          />
        ) : (
          <SectionView
            id={step}
            items={all.filter((i) => i.section === step)}
            title={checklist.sections.find((s) => s.id === step)?.title ?? 'Ask'}
            hint={SECTION_HINT[step]}
            results={results}
            set={set}
            ml={ml}
            setMl={setMl}
            motherLang={String(motherLang)}
            wl={wl}
            checklist={checklist}
            focusId={focusId}
            onOpenGuide={onOpenGuide}
            extra={
              step === 'ask' ? (
                <CustomQuestions questions={questions} answers={custom} setAnswer={(id, v) => setCustom((c) => ({ ...c, [id]: v }))} canAdd={canAddQuestions} workerId={wid} facilityId={fid} visitType={checklist.visitType} templateId={checklist.templateId} />
              ) : null
            }
          />
        )}
      </main>

      <footer className="visit-foot fixed inset-x-0 bottom-0 z-20 border-t border-secondary bg-primary/95 backdrop-blur" data-testid="visit-footer">
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {step === 'summary' ? (
            <FinishBar mustCount={mustCount} firstMust={firstMust} referring={findings.some((f) => f.action === 'refer')} onBack={() => goTo(stepIdx - 1)} onAnswerFirst={() => firstMust && answerItem(firstMust)} onFinish={finish} />
          ) : (
            <div className="flex gap-3">
              <button type="button" className="visit-btn visit-btn--ghost inline-flex min-h-13 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-md font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover" onClick={() => (stepIdx === 0 ? onCancel() : goTo(stepIdx - 1))}>
                {stepIdx === 0 ? (
                  'Cancel'
                ) : (
                  <>
                    <ArrowLeft className="size-5" aria-hidden="true" /> Back
                  </>
                )}
              </button>
              <button type="button" className="visit-btn visit-btn--primary inline-flex min-h-13 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-solid text-md font-semibold text-on-fill hover:bg-brand-solid_hover" onClick={() => goTo(stepIdx + 1)}>
                {steps[stepIdx + 1] === 'summary' ? 'Summary' : `Next: ${SECTION_SHORT[steps[stepIdx + 1] as VisitSection]}`} <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------- Section ----------

function SectionView({
  id,
  items,
  title,
  hint,
  results,
  set,
  ml,
  setMl,
  motherLang,
  wl,
  checklist,
  focusId,
  onOpenGuide,
  extra,
}: {
  id: VisitSection;
  items: ChecklistItem[];
  title: string;
  hint: string;
  results: Record<string, ChecklistResult>;
  set: (id: string, r: Omit<ChecklistResult, 'itemId'> | null) => void;
  ml: string;
  setMl: (l: string) => void;
  motherLang: string;
  wl: string;
  checklist: Checklist;
  focusId: string | null;
  onOpenGuide?: (id: string) => void;
  extra?: ReactNode;
}) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const it of items) {
    const k = it.childName ?? '';
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const multiChild = checklist.children.length > 1;
  // Follow-ups render inside their parent card, so skip them at the top level.
  const childIds = new Set<string>();
  for (const it of items) for (const fu of it.followUps ?? []) for (const c of fu.items) childIds.add(c.id);
  return (
    <section className="visit-section grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="visit-h2 text-display-xs font-semibold text-primary">{title}</h2>
          <p className="visit-hint mt-1 text-md text-tertiary">{hint}</p>
        </div>
        {id === 'tell' ? <LangSwitcher value={ml} onChange={setMl} motherLang={motherLang} /> : null}
      </div>
      {[...groups.entries()].map(([name, list]) => (
        <div key={name || 'mother'} className="visit-group grid grid-cols-1 gap-3">
          {name && multiChild ? <h3 className="visit-h3 mt-2 text-sm font-semibold tracking-wide text-tertiary uppercase">{name}</h3> : null}
          {list
            .filter((it) => !childIds.has(it.id))
            .map((it) => (
              <ItemCard key={it.id} item={it} results={results} set={set} ml={ml} wl={wl} focus={focusId === it.id} onOpenGuide={onOpenGuide} />
            ))}
        </div>
      ))}
      {items.length === 0 && !extra ? <p className="text-sm text-tertiary">Nothing to do in this step for this visit.</p> : null}
      {extra}
    </section>
  );
}

// ---------- Item ----------

function Pict({ k, size = 48 }: { k?: IllustrationKey; size?: number }) {
  if (!k) return null;
  return <span className="visit-pict grid grid-cols-1 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary" style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderIllustration(k, { size }) }} />;
}

function ItemCard({ item, results, set, ml, wl, focus, onOpenGuide, nested }: { item: ChecklistItem; results: Record<string, ChecklistResult>; set: (id: string, r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string; focus?: boolean; onOpenGuide?: (id: string) => void; nested?: boolean }) {
  const result = results[item.id];
  const findings = result ? findingsFor(item, result) : [];
  const abnormal = findings.length > 0;
  const unknown = item.isTest && result && (result.status === 'not_available' || result.status === 'declined' || result.status === 'not_done_today');
  const open = (item.followUps ?? []).filter((fu) => result && (fu.when.answerIn.includes(result.status) || (result.choice !== undefined && fu.when.answerIn.includes(result.choice)) || (result.choices ?? []).some((c) => fu.when.answerIn.includes(c))));
  return (
    <article
      id={`vi-${item.id}`}
      className={cx(
        'visit-item rounded-2xl p-4 ring-1 ring-inset transition sm:p-5',
        nested ? 'bg-secondary ring-secondary' : 'bg-primary',
        abnormal ? 'is-abnormal bg-error-primary ring-2 ring-border-error' : unknown ? 'bg-warning-primary ring-warning_subtle' : result ? 'is-answered ring-success_subtle' : !nested && 'ring-secondary',
        item.priority === 1 && !abnormal && !result && 'is-p1 ring-2 ring-border-brand',
        focus && 'ring-2 ring-border-brand',
      )}
    >
      <div className="visit-item-head flex items-start gap-3">
        <Pict k={item.illustration ?? item.howTo?.illustration} size={nested ? 40 : 52} />
        <div className="visit-item-titles min-w-0 flex-1">
          <h4 className="visit-item-title text-md leading-snug font-semibold text-primary">{item.title}</h4>
          {item.how ? <p className="visit-how mt-1 text-sm text-secondary">{item.how}</p> : null}
          {item.because?.length ? <p className="visit-because mt-1 text-xs font-semibold text-brand-secondary">Because: {item.because.join(', ')}</p> : null}
        </div>
        {result ? (
          <button type="button" onClick={() => set(item.id, null)} className="grid grid-cols-1 size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-fg-quaternary hover:bg-primary_hover" aria-label={`Clear answer for ${item.title}`}>
            <Edit03 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {item.isTest ? <TestInput item={item} result={result} set={(r) => set(item.id, r)} ml={ml} wl={wl} /> : <ItemInputView item={item} result={result} set={(r) => set(item.id, r)} ml={ml} wl={wl} />}
      </div>

      {unknown ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-warning-primary">
          <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Result unknown. This is not the same as normal; the plan will say when and where to test.
        </p>
      ) : null}

      {findings.map((f, i) => (
        <div key={i} role="status" className={cx('visit-finding mt-3 rounded-xl p-3 text-sm ring-1 ring-inset', `visit-finding--${f.urgency}`, f.action === 'refer' ? 'bg-primary ring-border-error' : f.action === 'treat' ? 'bg-primary ring-warning_subtle' : 'bg-primary ring-secondary')}>
          <span className={cx('visit-action mr-2 inline-block rounded-md px-1.5 py-0.5 text-xs font-bold uppercase', `visit-action--${f.action}`, f.action === 'refer' ? 'bg-error-solid text-on-fill' : f.action === 'treat' ? 'bg-warning-solid text-on-fill' : 'bg-secondary text-secondary')}>
            {f.action === 'refer' ? (f.urgency === 'emergency' ? 'Refer now' : f.urgency === 'urgent' ? 'Refer today' : 'Refer') : f.action === 'treat' ? 'Treat' : 'Recheck'}
          </span>
          <strong className="font-semibold text-primary">{f.label}.</strong> <span className="text-secondary">{f.todo}</span>
        </div>
      ))}

      {open.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 border-l-2 border-fg-brand-secondary pl-3" data-testid="follow-ups">
          {open.flatMap((fu) => fu.items).map((c) => (
            <ItemCard key={c.id} item={c} results={results} set={set} ml={ml} wl={wl} onOpenGuide={onOpenGuide} nested />
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-5">
        {item.howTo?.steps?.length ? (
          <details className="visit-why group text-sm">
            <summary className="flex min-h-10 cursor-pointer items-center gap-1.5 font-semibold text-brand-secondary">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /> How
            </summary>
            <HowToSteps howTo={item.howTo} lang={ml} onOpenGuide={onOpenGuide} />
          </details>
        ) : null}
        <details className="visit-why group text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center gap-1.5 font-semibold text-tertiary hover:text-secondary">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /> Why this check
          </summary>
          <p className="mt-1 text-secondary">{item.why}</p>
          <ul className="visit-sources mt-1 list-disc pl-5 text-xs text-tertiary">
            {item.sources.map((s) => (
              <li key={s.id}>{s.url ? <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>
            ))}
          </ul>
        </details>
        {item.guideId && onOpenGuide ? (
          <button type="button" onClick={() => onOpenGuide(item.guideId!)} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand-secondary">
            <BookOpen01 className="size-4" aria-hidden="true" /> Open guide
          </button>
        ) : null}
      </div>
    </article>
  );
}

function HowToSteps({ howTo, lang, onOpenGuide }: { howTo: HowTo; lang: string; onOpenGuide?: (id: string) => void }) {
  const line = (k: string | undefined, s: string) => (k ? motherLine(k, {}, lang) : { text: s, lang: 'en', dir: 'ltr' as const });
  return (
    <div className="mt-2 flex gap-3">
      {howTo.illustration ? <Pict k={howTo.illustration} size={72} /> : null}
      <div className="min-w-0 flex-1">
        <ol className="space-y-1.5">
          {howTo.steps.map((s, i) => {
            const l = line(howTo.stepKeys?.[i], s);
            return (
              <li key={i} className="flex gap-2.5 text-secondary" lang={l.lang} dir={l.dir}>
                <span aria-hidden="true" className="grid grid-cols-1 size-5 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-brand-secondary tnum">
                  {i + 1}
                </span>
                <span>{l.text}</span>
              </li>
            );
          })}
        </ol>
        {howTo.examples?.length ? <p className="mt-2 text-tertiary">For example: {howTo.examples.map((s, i) => line(howTo.exampleKeys?.[i], s).text).join('; ')}.</p> : null}
        {howTo.avoid?.length ? <p className="mt-1 text-warning-primary">Avoid: {howTo.avoid.map((s, i) => line(howTo.avoidKeys?.[i], s).text).join('; ')}.</p> : null}
        {howTo.guideId && onOpenGuide ? (
          <button type="button" onClick={() => onOpenGuide(howTo.guideId!)} className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 font-semibold text-brand-secondary">
            <BookOpen01 className="size-4" aria-hidden="true" /> Open guide
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Inputs ----------

type Tone = 'ok' | 'bad' | 'neutral';

/** Large two-to-four way choice. Tapping the chosen option clears it. */
function Toggle({ options, value, onChange, name, size = 'lg', stack }: { options: Array<{ value: string; label: string; tone?: Tone; icon?: typeof CheckCircle }>; value?: string; onChange: (v: string | null) => void; name: string; size?: 'md' | 'lg'; stack?: boolean }) {
  return (
    <div className={cx('visit-toggle grid grid-cols-1 gap-2', stack ? 'grid-cols-1' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')} role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const on = value === o.value;
        const Icon = o.icon ?? (o.tone === 'ok' ? CheckCircle : o.tone === 'bad' ? AlertCircle : undefined);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.value)}
            className={cx(
              'visit-opt flex cursor-pointer items-center gap-2.5 rounded-xl px-4 text-left font-semibold outline-focus-ring ring-inset transition focus-visible:outline-2',
              `visit-opt--${o.tone ?? 'neutral'}`,
              size === 'lg' ? 'min-h-14 text-md' : 'min-h-11 text-sm',
              on ? 'is-on' : '',
              on ? (o.tone === 'bad' ? 'bg-error-solid text-on-fill ring-0' : o.tone === 'ok' ? 'bg-success-solid text-on-fill ring-0' : 'bg-primary-solid text-on-fill ring-0') : 'bg-primary text-secondary ring-1 ring-primary hover:bg-primary_hover',
            )}
          >
            {Icon ? <Icon aria-hidden="true" className={cx('size-5 shrink-0', !on && (o.tone === 'bad' ? 'text-fg-error-secondary' : o.tone === 'ok' ? 'text-fg-success-secondary' : 'text-fg-quaternary'))} /> : null}
            <span className="min-w-0 leading-snug">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact choice list (for reasons, severities and other many-option questions). */
function ChoiceList({ options, value, onChange, name }: { options: Array<{ value: string; label: string; tone?: Tone }>; value?: string; onChange: (v: string | null) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.value)}
            className={cx(
              'visit-opt flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-focus-ring ring-1 ring-inset focus-visible:outline-2',
              on ? 'is-on' : '',
              on ? (o.tone === 'bad' ? 'bg-error-primary font-semibold text-error-primary ring-2 ring-border-error' : 'bg-brand-primary font-semibold text-brand-secondary ring-2 ring-border-brand') : o.tone === 'bad' ? 'bg-primary text-secondary ring-error_subtle hover:bg-primary_hover' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover',
            )}
          >
            <span aria-hidden="true" className={cx('grid grid-cols-1 size-4 shrink-0 place-items-center rounded-full ring-1 ring-inset', on ? 'bg-brand-solid ring-transparent' : 'ring-primary')}>
              {on ? <span className="size-1.5 rounded-full bg-primary" /> : null}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TestInput({ item, result, set, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; set: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const status = result?.status;
  const outcome = status === 'not_available' || status === 'declined' || status === 'not_done_today' ? status : result ? 'done' : undefined;
  const [doneOpen, setDoneOpen] = useState(outcome === 'done');
  const pick = (v: string | null) => {
    if (v === 'done') {
      setDoneOpen(true);
      if (outcome !== 'done') set(null);
    } else {
      setDoneOpen(false);
      set(v ? { status: v as ChecklistResult['status'] } : null);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="test-status">
      <div role="radiogroup" aria-label={`${item.title}: result`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['done', 'Done', CheckCircle],
            ['not_available', 'Not available', SlashCircle01],
            ['declined', 'Declined', XCircle],
            ['not_done_today', 'Not done today', Clock],
          ] as const
        ).map(([v, label, Icon]) => {
          const on = v === 'done' ? doneOpen || outcome === 'done' : outcome === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(on ? null : v)}
              className={cx('visit-opt flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-focus-ring ring-1 ring-inset focus-visible:outline-2', on ? 'is-on' : '', on ? (v === 'done' ? 'bg-success-solid text-on-fill ring-transparent' : 'bg-primary-solid text-on-fill ring-transparent') : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      {doneOpen ? (
        <div className="rounded-xl bg-secondary p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-tertiary uppercase">Result</p>
          <ItemInputView item={item} result={outcome === 'done' ? result : undefined} set={set} ml={ml} wl={wl} />
        </div>
      ) : null}
    </div>
  );
}

function ItemInputView({ item, result, set, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; set: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const inp = item.input;
  switch (inp.kind) {
    case 'normal_abnormal':
      return <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'normal' | 'abnormal' } : null)} options={[{ value: 'normal', label: `Normal: ${inp.normal}`, tone: 'ok' }, { value: 'abnormal', label: inp.abnormal.label, tone: 'bad' }]} />;
    case 'yes_no':
      return <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'yes' | 'no' } : null)} options={[{ value: 'yes', label: 'Yes', tone: inp.abnormalWhen === 'yes' ? 'bad' : 'ok' }, { value: 'no', label: 'No', tone: inp.abnormalWhen === 'no' ? 'bad' : 'ok' }]} />;
    case 'number':
      return <NumberField label={item.title} unit={inp.unit} min={inp.min} max={inp.max} step={inp.step} normal={inp.normal} value={result?.value} onChange={(v) => set(v === undefined ? null : { status: 'value', value: v })} />;
    case 'bp':
      return <BpField value={result} onChange={(s, d) => set(s !== undefined && d !== undefined ? { status: 'value', value: s, value2: d } : null)} />;
    case 'choice':
      return inp.options.length <= 3 && inp.options.every((o) => o.label.length < 40) ? (
        <Toggle name={item.title} value={result?.choice} onChange={(v) => set(v ? { status: 'value', choice: v } : null)} options={inp.options.map((o) => ({ value: o.value, label: o.label, tone: o.finding ? 'bad' : 'neutral' }))} />
      ) : (
        <ChoiceList name={item.title} value={result?.choice} onChange={(v) => set(v ? { status: 'value', choice: v } : null)} options={inp.options.map((o) => ({ value: o.value, label: o.label, tone: o.finding ? 'bad' : 'neutral' }))} />
      );
    case 'multi': {
      const chosen = result?.choices ?? [];
      const none = result?.status === 'normal';
      return (
        <div className="visit-multi grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className={cx('visit-opt flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1 ring-inset sm:col-span-2', none ? 'is-on bg-success-solid text-on-fill ring-transparent' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')} aria-pressed={none} onClick={() => set(none ? null : { status: 'normal', choices: [] })}>
            <CheckCircle className="size-5 shrink-0" aria-hidden="true" /> {inp.noneLabel}
          </button>
          {inp.options.map((o) => {
            const on = chosen.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                className={cx('visit-opt flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ring-1 ring-inset', on ? (o.finding ? 'is-on bg-error-solid text-on-fill ring-transparent' : 'is-on bg-primary-solid text-on-fill ring-transparent') : o.finding ? 'bg-primary text-secondary ring-error_subtle hover:bg-primary_hover' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}
                onClick={() => {
                  const next = on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value];
                  set(next.length ? { status: 'abnormal', choices: next } : null);
                }}
              >
                {o.finding ? <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> : null}
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
        <div className="grid grid-cols-1 gap-3">
          {item.textKey ? <MotherBlock keys={[item.textKey]} params={item.params} ml={ml} wl={wl} compact /> : null}
          <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: v as 'achieved' | 'not_yet' } : null)} options={[{ value: 'achieved', label: 'Yes, does this', tone: 'ok' }, { value: 'not_yet', label: 'Not yet', tone: 'bad' }]} />
        </div>
      );
    case 'told':
      return (
        <div className="grid grid-cols-1 gap-3">
          {item.textKey ? <MotherBlock keys={[item.textKey, ...(item.subKeys ?? [])]} params={item.params} ml={ml} wl={wl} illustration={item.illustration} /> : null}
          <Toggle name={item.title} value={result?.status} onChange={(v) => set(v ? { status: 'told' } : null)} options={[{ value: 'told', label: 'Told, and she understood', tone: 'ok' }]} stack />
        </div>
      );
    case 'book':
      return <BookField item={item} result={result} onChange={set} ml={ml} wl={wl} />;
    default:
      return null;
  }
}

function NumberField({ unit, min, max, step, value, onChange, label, normal }: { unit: string; min: number; max: number; step: number; value?: number; onChange: (v: number | undefined) => void; label: string; normal?: string }) {
  const [text, setText] = useState(value !== undefined ? String(value) : '');
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0;
  const start = Math.round(((min + max) / 2) / step) * step;
  const bump = (d: number) => {
    const cur = parseFloat(text);
    const base = Number.isFinite(cur) ? cur + d : start;
    const v = +Math.min(max, Math.max(min, base)).toFixed(decimals);
    setText(String(v));
    onChange(v);
  };
  return (
    <div className="visit-num grid grid-cols-1 gap-1.5">
      <div className="visit-num-row flex items-stretch overflow-hidden rounded-xl bg-primary ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand sm:max-w-xs">
        <button type="button" aria-label={`Less ${label}`} onClick={() => bump(-step)} className="w-14 shrink-0 cursor-pointer text-xl text-fg-quaternary hover:bg-primary_hover">
          −
        </button>
        <input
          className="visit-num-input min-h-14 min-w-0 flex-1 bg-transparent text-center text-xl font-semibold text-primary tnum outline-none"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          aria-label={label}
          placeholder="–"
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) && v >= min && v <= max ? v : undefined);
          }}
        />
        <span className="visit-unit self-center pr-2 text-sm text-tertiary">{unit}</span>
        <button type="button" aria-label={`More ${label}`} onClick={() => bump(step)} className="w-14 shrink-0 cursor-pointer text-xl text-fg-quaternary hover:bg-primary_hover">
          +
        </button>
      </div>
      {normal ? <span className="visit-normal text-xs text-tertiary">Normal: {normal}</span> : null}
    </div>
  );
}

function BpField({ value, onChange }: { value?: ChecklistResult; onChange: (s?: number, d?: number) => void }) {
  const [s, setS] = useState(value?.value !== undefined ? String(value.value) : '');
  const [d, setD] = useState(value?.value2 !== undefined ? String(value.value2) : '');
  const parse = (x: string, lo: number, hi: number) => {
    const v = parseInt(x, 10);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
  };
  const sv = parse(s, 50, 260);
  const dv = parse(d, 30, 160);
  const zone = sv !== undefined && dv !== undefined ? (sv >= 160 || dv >= 110 ? 'Severe' : sv >= 140 || dv >= 90 ? 'Raised' : 'Normal') : undefined;
  const field = 'visit-num-input min-h-14 w-24 rounded-xl bg-primary text-center text-xl font-semibold text-primary tnum ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand';
  return (
    <div className="visit-num grid grid-cols-1 gap-1.5">
      <div className="visit-num-row visit-bp flex flex-wrap items-center gap-2">
        <input className={field} type="number" inputMode="numeric" aria-label="Systolic" placeholder="120" value={s} onChange={(e) => { setS(e.target.value); onChange(parse(e.target.value, 50, 260), dv); }} />
        <span className="visit-bp-slash text-2xl text-quaternary">/</span>
        <input className={field} type="number" inputMode="numeric" aria-label="Diastolic" placeholder="80" value={d} onChange={(e) => { setD(e.target.value); onChange(sv, parse(e.target.value, 30, 160)); }} />
        <span className="visit-unit text-sm text-tertiary">mmHg</span>
        {zone ? <span className={cx('ml-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', zone === 'Severe' ? 'bg-error-primary text-error-primary ring-error_subtle' : zone === 'Raised' ? 'bg-warning-primary text-warning-primary ring-warning_subtle' : 'bg-success-primary text-success-primary ring-success_subtle')}>{zone}</span> : null}
      </div>
      <span className="visit-normal text-xs text-tertiary">Normal: below 140/90</span>
    </div>
  );
}

function EpdsField({ result, onChange }: { result?: ChecklistResult; onChange: (r: Omit<ChecklistResult, 'itemId'> | null) => void }) {
  const [answers, setAnswers] = useState<Array<number | null>>(() => EPDS_PLAIN.map(() => null));
  const update = (next: Array<number | null>) => {
    setAnswers(next);
    if (next.every((a) => a !== null)) {
      const score = next.reduce<number>((s, a) => s + (a ?? 0), 0);
      onChange({ status: 'value', value: score, selfHarm: (next[9] ?? 0) > 0 });
    } else if (result) onChange(null);
  };
  return <EpdsStepper questions={EPDS_PLAIN} answers={answers} onChange={update} />;
}

function BookField({ item, result, onChange, ml, wl }: { item: ChecklistItem; result?: ChecklistResult; onChange: (r: Omit<ChecklistResult, 'itemId'> | null) => void; ml: string; wl: string }) {
  const proposed = item.next?.date ?? '';
  const date = result?.date ?? proposed;
  const params = { ...(item.params ?? {}), date: shortLabel(date) };
  return (
    <div className="visit-book grid grid-cols-1 gap-3">
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-secondary">
        Date
        <input className="visit-num-input visit-date min-h-12 rounded-xl px-3 text-md font-semibold text-primary ring-1 ring-primary ring-inset" type="date" value={date} onChange={(e) => onChange({ status: 'booked', date: e.target.value })} aria-label="Next visit date" />
      </label>
      <MotherBlock keys={['vt.next_visit']} params={params} ml={ml} wl={wl} illustration="calendar" />
      <Toggle name="Booked" value={result?.status} onChange={(v) => onChange(v ? { status: 'booked', date } : null)} options={[{ value: 'booked', label: 'Booked and written on her card', tone: 'ok' }]} stack />
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
    <div className={cx('visit-mother flex gap-3 rounded-xl p-3', compact ? 'visit-mother--compact bg-secondary' : 'bg-brand-primary ring-1 ring-utility-brand-200 ring-inset')} dir={dir} lang={lines[0]?.lang}>
      {!compact ? <Pict k={illustration} size={56} /> : null}
      <div className="visit-mother-text min-w-0 flex-1">
        {lines.map((l, i) => (
          <p key={i} className={i === 0 ? cx('visit-mother-lead text-primary', compact ? 'text-sm' : 'text-lg leading-snug font-medium') : 'visit-mother-sub mt-1 text-md text-secondary'}>
            {l.text}
          </p>
        ))}
        {!compact ? (
          <div className="visit-mother-meta mt-2 flex flex-wrap items-center gap-2" dir="ltr">
            <ConfidenceBadge confidence={worst(lines.map((l) => l.confidence))} lang={(isPackCode(wl) ? wl : 'en') as PackCode} compact />
            {showEnglish ? <span className="visit-english text-xs text-tertiary">{lines.map((l) => l.english).join(' ')}</span> : null}
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

/** Her language first, then installed packs; languages with no pack show "Coming soon". */
function LangSwitcher({ value, onChange, motherLang }: { value: string; onChange: (l: string) => void; motherLang: string }) {
  let installed: string[] = ['en'];
  try {
    installed = installedLanguages();
  } catch {
    /* default */
  }
  const codes = Array.from(new Set([motherLang, ...installed, 'en']));
  const opt = (c: string) => {
    if (!isPackCode(c)) return { c, name: LANGUAGE_NAMES[c as LanguageCode] ?? c, soon: true };
    const s = summarisePack(c);
    return { c, name: getPack(c).nativeName, soon: s.status === 'none' && c !== 'en' };
  };
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
      <Translate01 className="size-4 text-fg-quaternary" aria-hidden="true" />
      <span className="sr-only">Language for her</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer bg-transparent font-semibold text-primary outline-none" data-testid="tell-lang">
        {codes.map(opt).map((o) => (
          <option key={o.c} value={o.c} disabled={o.soon}>
            {o.name}
            {o.soon ? ', coming soon' : o.c === motherLang ? ', her language' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- Custom questions ----------

function CustomQuestions({ questions, answers, setAnswer, canAdd, workerId, facilityId, visitType, templateId }: { questions: CustomQuestion[]; answers: Record<string, string>; setAnswer: (id: string, v: string) => void; canAdd: boolean; workerId: string; facilityId: string; visitType: string; templateId: string }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'yes_no' | 'text'>('yes_no');
  const [scope, setScope] = useState<'worker' | 'facility'>('worker');
  const [every, setEvery] = useState<'type' | 'template'>('type');
  const save = () => {
    if (!text.trim()) return;
    addCustomQuestion({ text, answer: kind, scope, ownerId: scope === 'worker' ? workerId : facilityId, createdBy: workerId, visitType: every === 'type' ? visitType : templateId });
    setText('');
    setAdding(false);
  };
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="custom-questions">
      {questions.map((q) => (
        <article key={q.id} className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset sm:p-5">
          <div className="flex items-start gap-2">
            <h4 className="min-w-0 flex-1 text-md leading-snug font-semibold text-primary">{q.text}</h4>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-tertiary">{q.scope === 'facility' ? 'Facility question' : 'Your question'}</span>
          </div>
          <div className="mt-3">
            {q.answer === 'yes_no' ? (
              <Toggle name={q.text} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v ?? '')} options={[{ value: 'Yes', label: 'Yes', tone: 'neutral' }, { value: 'No', label: 'No', tone: 'neutral' }]} />
            ) : (
              <textarea className="min-h-20 w-full rounded-xl px-3 py-2 text-md ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand" value={answers[q.id] ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} aria-label={q.text} placeholder="Her answer" />
            )}
          </div>
        </article>
      ))}
      {canAdd ? (
        adding ? (
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-secondary p-4">
            <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
              Your question, as you will ask it
              <input autoFocus className="min-h-12 rounded-xl bg-primary px-3 text-md ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand" value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Is anyone at home helping you with the baby at night?" data-testid="custom-question-text" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniSeg label="Answer" value={kind} onChange={setKind} options={[['yes_no', 'Yes or no'], ['text', 'Her words']]} />
              <MiniSeg label="Who sees it" value={scope} onChange={setScope} options={[['worker', 'Only me'], ['facility', 'My facility']]} />
              <MiniSeg label="Show on" value={every} onChange={setEvery} options={[['type', 'Every visit of this kind'], ['template', 'This visit only']]} />
            </div>
            <p className="text-xs text-tertiary">It will show on every future visit like this one until you delete it in Settings.</p>
            <div className="flex gap-2">
              <button type="button" onClick={save} disabled={!text.trim()} className="min-h-11 cursor-pointer rounded-xl bg-brand-solid px-4 text-sm font-semibold text-on-fill disabled:opacity-50" data-testid="custom-question-save">
                Save question
              </button>
              <button type="button" onClick={() => setAdding(false)} className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-secondary hover:bg-primary_hover">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary text-md font-semibold text-tertiary hover:bg-primary_hover hover:text-secondary" data-testid="add-custom-question">
            <Plus className="size-5" aria-hidden="true" /> Add your own question
          </button>
        )
      ) : null}
    </div>
  );
}

function MiniSeg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <span className="text-xs font-medium text-tertiary">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-primary p-1 ring-1 ring-secondary ring-inset">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cx('min-h-9 flex-1 cursor-pointer rounded-lg px-2 text-xs font-semibold', value === v ? 'bg-primary-solid text-on-fill' : 'text-tertiary hover:text-secondary')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- What must be answered ----------

/**
 * Items a visit must not close without: danger-sign questions, blood pressure, temperature,
 * breathing and chest indrawing, jaundice and colour, newborn danger signs, fetal heart and
 * movements, bleeding after birth, and the mood safety screen. Everything else is optional.
 */
const MUST_ANSWER = new Set([
  'a.danger_preg',
  'a.danger_pp',
  'a.newborn_danger',
  'a.child_danger',
  'a.fetal_movement',
  'm.bp',
  'm.bp_recheck',
  'm.temp',
  'm.fhr',
  'm.lochia',
  'm.epds',
  'b.temp',
  'b.breathing',
  'b.indrawing',
  'b.jaundice',
  'b.colour',
  'b.tone',
  'b.feeds',
  'b.cord',
]);
export function mustAnswer(baseId: string): boolean {
  return MUST_ANSWER.has(baseId.split('@')[0]);
}

// ---------- Referral wording ----------

/** "within 2 weeks", "this week", "this month" from the worker's instruction. */
const whenFrom = (todo: string): string | undefined => referralWhen(todo);

/**
 * What to tell her about a referral, matching its urgency: emergency "go now", urgent "go today",
 * routine "go within N weeks", with where to go. The finding's own explanation comes first.
 */
function referralLines(f: Finding, place: string, ml: string): Rendered[] {
  const out: Rendered[] = [];
  const name = f.childName?.split(' ')[0] ?? 'your baby';
  if (f.textKey && f.urgency === 'routine') out.push(motherLine(f.textKey, { name }, ml));
  if (f.urgency === 'emergency') out.push(motherLine('vt.refer_now', { place }, ml));
  else if (f.urgency === 'urgent') out.push(motherLine('vt.refer_today', { place }, ml));
  else {
    out.push(motherLine('vt.refer_within', { place, when: whenFrom(f.todo) ?? 'soon' }, ml));
  }
  return out;
}

// ---------- Summary ----------

function SummaryView({
  checklist,
  summary,
  findings,
  results,
  set,
  wl,
  ml,
  onAnswer,
  onOpenGuide,
}: {
  checklist: Checklist;
  summary: ChecklistSummary;
  findings: Finding[];
  results: Record<string, ChecklistResult>;
  set: (id: string, r: Omit<ChecklistResult, 'itemId'> | null) => void;
  wl: string;
  ml: string;
  onAnswer: (itemId: string) => void;
  onOpenGuide?: (id: string) => void;
}) {
  const refer = findings.filter((f) => f.action === 'refer');
  const treat = findings.filter((f) => f.action === 'treat');
  const items = activeItems(checklist, results);
  const baseOf = (id: string) => items.find((i) => i.id === id)?.baseId ?? id.split('@')[0];
  const withWho = (u: { itemId: string; label: string; important: boolean }) => {
    const it = items.find((i) => i.id === u.itemId);
    const who = it?.subject === 'baby' ? (it.childName?.split(' ')[0] ?? 'Baby') : 'Mother';
    return { ...u, label: u.label.includes(':') ? u.label : `${who}: ${u.label}` };
  };
  const important = summary.unanswered.filter((u) => mustAnswer(baseOf(u.itemId))).map(withWho);
  const optional = summary.unanswered.filter((u) => !mustAnswer(baseOf(u.itemId))).map(withWho);
  const vaccines = checklist.items.filter((i) => i.vaccines && i.section === 'do' && results[i.id]?.status === 'done').flatMap((i) => i.vaccines!);
  const book = results['bk.next']?.date ?? checklist.nextVisit?.date;
  const place = facilityById(checklist.referralFacilityId)?.name ?? 'the hospital';
  const referLines = refer.map((f) => ({ f, lines: referralLines(f, place, ml) }));
  const counts = [
    { label: 'Refer', n: refer.length, tone: 'error' as const },
    { label: 'Treat', n: treat.length, tone: 'warning' as const },
    { label: 'Recheck', n: summary.rechecks.length, tone: 'brand' as const },
    { label: 'Unknown', n: summary.unknowns.length, tone: 'warning' as const },
    { label: 'Must answer', n: important.length, tone: 'gray' as const },
  ];
  return (
    <section className="visit-section grid grid-cols-1 gap-5">
      <h2 className="visit-h2 text-display-xs font-semibold text-primary">Summary</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="At a glance">
        {counts.map((c) => (
          <div key={c.label} className={cx('rounded-xl px-3 py-2.5 ring-1 ring-inset', c.n ? (c.tone === 'error' ? 'bg-error-primary ring-error_subtle' : c.tone === 'warning' ? 'bg-warning-primary ring-warning_subtle' : c.tone === 'brand' ? 'bg-brand-primary ring-utility-brand-200' : 'bg-secondary ring-secondary') : 'bg-primary ring-secondary')}>
            <p className={cx('text-xl font-semibold tnum', c.n ? (c.tone === 'error' ? 'text-error-primary' : c.tone === 'warning' ? 'text-warning-primary' : c.tone === 'brand' ? 'text-brand-secondary' : 'text-primary') : 'text-quaternary')}>{c.n}</p>
            <p className="text-xs text-tertiary">{c.label}</p>
          </div>
        ))}
      </div>
      {summary.perChild.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {summary.perChild.map((c) => (
            <li key={c.childId} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary">
              {c.name.split(' ')[0]}: {c.answered}/{c.total} answered{c.findings ? `, ${c.findings} finding${c.findings === 1 ? '' : 's'}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {findings.length === 0 ? <p className="visit-ok flex items-center gap-2 rounded-xl bg-success-primary p-3 text-sm font-semibold text-success-primary ring-1 ring-success_subtle ring-inset"><CheckCircle className="size-5" aria-hidden="true" /> No abnormal findings recorded.</p> : null}

      {refer.length ? (
        <SumBlock title="Referral" tone="error">
          {refer.map((f, i) => (
            <li key={i} className="py-2">
              <strong className="font-semibold text-primary">{f.childName ? `${f.childName}: ` : ''}{f.label}.</strong> <span className="text-secondary">{f.todo}</span>
              {f.urgency !== 'routine' ? <span className="visit-pill ml-2 rounded-full bg-error-solid px-2 py-0.5 text-xs font-bold text-on-fill">{f.urgency === 'emergency' ? 'Now' : 'Today'}</span> : null}
            </li>
          ))}
          <p className="visit-what mt-2 text-sm text-secondary">Saving creates a {refer[0].urgency} referral on her timeline and updates her plan at once. Confirm she arrived.</p>
          {referLines.map(({ f, lines }, i) => (
            <div key={i} className="mt-3 rounded-xl bg-primary p-3" dir={lines[0].dir} lang={lines[0].lang} data-testid="referral-mother-line">
              <p className="text-xs font-semibold tracking-wide text-tertiary uppercase" dir="ltr">
                Tell her{f.childName ? ` about ${f.childName.split(' ')[0]}` : ''} · {f.urgency === 'emergency' ? 'go now' : f.urgency === 'urgent' ? 'go today' : `not urgent, ${whenFrom(f.todo) ?? 'soon'}`}
              </p>
              {lines.map((l, j) => (
                <p key={j} className={cx('mt-1 text-md text-primary', j === 0 && 'font-medium')}>
                  {l.text}
                </p>
              ))}
              <div className="mt-1" dir="ltr">
                <ConfidenceBadge confidence={worst(lines.map((l) => l.confidence))} lang={(isPackCode(wl) ? wl : 'en') as PackCode} compact />
              </div>
            </div>
          ))}
        </SumBlock>
      ) : null}

      {treat.length ? (
        <SumBlock title="Treat or advise now" tone="warning">
          {treat.map((f, i) => (
            <li key={i} className="py-2">
              <strong className="font-semibold text-primary">{f.childName ? `${f.childName}: ` : ''}{f.label}.</strong> <span className="text-secondary">{f.todo}</span>
            </li>
          ))}
        </SumBlock>
      ) : null}

      {summary.rechecks.length ? (
        <SumBlock title="Recheck" tone="brand">
          {summary.rechecks.map((r) => (
            <RecheckRow key={r.itemId} label={r.label} item={items.find((i) => i.id === r.itemId)} result={results[r.itemId]} set={set} wl={wl} ml={ml} />
          ))}
        </SumBlock>
      ) : null}

      {summary.unknowns.length ? (
        <SumBlock title="Tests with no result" tone="warning">
          {summary.unknowns.map((u) => (
            <li key={u.itemId} className="flex flex-wrap items-start gap-2 py-2">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-fg-warning-secondary" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">
                <strong className="font-semibold text-primary">{u.label}</strong> <span className="text-tertiary">({u.status.replace(/_/g, ' ')})</span>. <span className="text-secondary">{u.consequence}</span>
              </span>
              {u.referToday ? <span className="rounded-full bg-error-solid px-2 py-0.5 text-xs font-bold text-on-fill">Today</span> : null}
              {u.status === 'unanswered' ? <SmallBtn onClick={() => onAnswer(u.itemId)}>Answer now</SmallBtn> : null}
            </li>
          ))}
        </SumBlock>
      ) : null}

      {summary.recommendations.some((r) => r.guideId) && onOpenGuide ? (
        <SumBlock title="Guides for this visit" tone="gray">
          {summary.recommendations
            .filter((r) => r.guideId)
            .map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm text-secondary">{r.text}</span>
                <SmallBtn onClick={() => onOpenGuide(r.guideId!)}>
                  <BookOpen01 className="size-4" aria-hidden="true" /> Open guide
                </SmallBtn>
              </li>
            ))}
        </SumBlock>
      ) : null}

      {vaccines.length ? <p className="visit-what text-sm text-secondary">Vaccines to record: {vaccines.join(', ')}.</p> : null}
      {book ? <p className="visit-what text-sm text-secondary">Next visit: {shortLabel(book)}.</p> : null}

      {important.length ? (
        <SumBlock title={`Must answer before finishing (${important.length})`} tone="gray" dashed>
          {important.map((u) => (
            <li key={u.itemId} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 text-sm text-secondary">{u.label}</span>
              <SmallBtn onClick={() => onAnswer(u.itemId)}>Answer now</SmallBtn>
            </li>
          ))}
        </SumBlock>
      ) : null}
      {optional.length ? (
        <details className="visit-why group rounded-2xl bg-secondary px-4 text-sm" data-testid="optional-unanswered">
          <summary className="flex min-h-12 cursor-pointer items-center gap-1.5 font-semibold text-tertiary">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /> {optional.length} optional {optional.length === 1 ? 'check' : 'checks'} not done
          </summary>
          <ul className="divide-y divide-border-secondary pb-2">
            {optional.map((u) => (
              <li key={u.itemId} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-secondary">{u.label}</span>
                <SmallBtn onClick={() => onAnswer(u.itemId)}>Answer</SmallBtn>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {checklist.skipped.length ? (
        <details className="visit-why group text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center gap-1.5 font-semibold text-tertiary">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /> Left out because already done ({checklist.skipped.length})
          </summary>
          <ul className="mt-1 list-disc pl-5 text-secondary">
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

/** The summary's footer: Back, and finish (with "Answer the next check" / "Finish anyway" and a reason when something must still be answered). */
function FinishBar({ mustCount, firstMust, referring, onBack, onAnswerFirst, onFinish }: { mustCount: number; firstMust?: string; referring: boolean; onBack: () => void; onAnswerFirst: () => void; onFinish: (note?: string) => void }) {
  const [anyway, setAnyway] = useState(false);
  const [reason, setReason] = useState('');
  const back = (
    <button type="button" onClick={anyway ? () => setAnyway(false) : onBack} className="visit-btn visit-btn--ghost inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-md font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover">
      <ArrowLeft className="size-5" aria-hidden="true" /> Back
    </button>
  );
  const save = `Save visit${referring ? ' and referral' : ''}`;
  if (mustCount && firstMust && !anyway) {
    return (
      <div className="grid grid-cols-1 gap-2">
        <p className="text-sm text-secondary">
          {mustCount} {mustCount === 1 ? 'check' : 'checks'} must be answered before finishing.
        </p>
        <div className="flex flex-wrap gap-2">
          {back}
          <button type="button" onClick={onAnswerFirst} className="min-h-12 flex-1 cursor-pointer rounded-xl bg-brand-solid px-4 text-md font-semibold whitespace-nowrap text-on-fill hover:bg-brand-solid_hover">
            Answer the next check
          </button>
          <button type="button" onClick={() => setAnyway(true)} className="min-h-12 flex-1 cursor-pointer rounded-xl px-4 text-md font-semibold whitespace-nowrap text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover" data-testid="finish-anyway">
            Finish anyway
          </button>
        </div>
      </div>
    );
  }
  if (mustCount && anyway) {
    return (
      <div className="grid grid-cols-1 gap-2">
        <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
          Why are these not answered?
          <input autoFocus className="min-h-12 rounded-xl px-3 text-md ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: She had to leave; will finish at a home visit tomorrow" data-testid="finish-anyway-reason" />
        </label>
        <div className="flex gap-2">
          {back}
          <button type="button" disabled={!reason.trim()} onClick={() => onFinish(reason.trim())} className="visit-btn visit-btn--primary min-h-12 flex-1 cursor-pointer rounded-xl bg-brand-solid px-4 text-md font-semibold text-on-fill disabled:opacity-50">
            {save}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      {back}
      <button type="button" onClick={() => onFinish()} className="visit-btn visit-btn--primary min-h-12 flex-1 cursor-pointer rounded-xl bg-brand-solid px-4 text-md font-semibold text-on-fill hover:bg-brand-solid_hover">
        {save}
      </button>
    </div>
  );
}

function RecheckRow({ label, item, result, set, wl, ml }: { label: string; item?: ChecklistItem; result?: ChecklistResult; set: (id: string, r: Omit<ChecklistResult, 'itemId'> | null) => void; wl: string; ml: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-secondary">{label}</span>
        {item ? <SmallBtn onClick={() => setOpen(!open)}>{open ? 'Done' : 'Record result now'}</SmallBtn> : null}
      </div>
      {open && item ? (
        <div className="mt-2 rounded-xl bg-primary p-3">
          <ItemInputView item={item} result={result} set={(r) => set(item.id, r)} ml={ml} wl={wl} />
        </div>
      ) : null}
    </li>
  );
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-brand-secondary ring-1 ring-utility-brand-200 ring-inset hover:bg-brand-primary">
      {children}
    </button>
  );
}

function SumBlock({ title, tone, children, dashed }: { title: string; tone: 'error' | 'warning' | 'brand' | 'gray'; children: ReactNode; dashed?: boolean }) {
  return (
    <div className={cx('visit-sum-block rounded-2xl p-4 ring-1 ring-inset', `visit-sum-block--${tone === 'error' ? 'refer' : tone === 'warning' ? 'treat' : dashed ? 'missing' : 'recheck'}`, tone === 'error' ? 'bg-error-primary ring-error_subtle' : tone === 'warning' ? 'bg-warning-primary ring-warning_subtle' : tone === 'brand' ? 'bg-brand-primary ring-utility-brand-200' : 'bg-secondary ring-secondary', dashed && 'ring-2 ring-dashed')}>
      <h3 className="visit-h3 text-sm font-semibold text-primary">{title}</h3>
      <ul className="mt-1 divide-y divide-border-secondary">{children}</ul>
    </div>
  );
}
