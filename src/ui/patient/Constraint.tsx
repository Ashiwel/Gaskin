/**
 * One control for every test, supplement, medicine, vaccine, food and transport recommendation:
 * Done / Not available / Declined / Not done today, plus "She cannot afford it" and "Side effects"
 * where they apply. Declined asks why and shows the counselling points; Side effects asks which
 * symptoms and how bad, and shows the response (tips and continue, adjust, or stop and refer today).
 * Her decision is respected and recorded as a ConstraintEvent; the engine then adds the alternative.
 *
 * The counselling and side-effect content comes from the clinical module when it exports
 * `declineCounselling(itemId, why)` and `sideEffectsFor(itemId)` / `sideEffectResponse(itemId,
 * symptoms, severity)`; until then these screens use the cautious defaults below.
 */
import { useMemo } from 'react';
import { AlertCircle, CheckCircle, Clock, Coins01, FaceFrown, SlashCircle01, Truck01, XCircle } from '@untitledui/icons';
import type { ConstraintEvent, ConstraintReason, DeclinedReason } from '../../types';
import { SIDE_EFFECTS, sideEffectGroup } from '../../clinical';
import { cx } from '../../utils/cx';
import { Segmented, type IconType } from './ui';

type Mod = Record<string, unknown>;
const CLINICAL = Object.values(import.meta.glob('../../clinical/index.ts', { eager: true }))[0] as Mod | undefined;
const VISITS = Object.values(import.meta.glob('../../visits/index.ts', { eager: true }))[0] as Mod | undefined;
const fromModules = <T,>(name: string): T | undefined => (CLINICAL?.[name] ?? VISITS?.[name]) as T | undefined;

export type ConstraintKind = 'test' | 'medicine' | 'supplement' | 'vaccine' | 'food' | 'transport';
export type Outcome = 'done' | 'not_available' | 'declined' | 'not_done_today' | 'cannot_afford' | 'side_effects';

export interface ConstraintValue {
  outcome: Outcome;
  why?: DeclineWhy;
  whyNote?: string;
  symptoms?: string[];
  severity?: 'mild' | 'moderate' | 'severe';
}

export type DeclineWhy = DeclinedReason;

export const DECLINE_WHY: Array<{ value: DeclineWhy; label: string }> = [
  { value: 'fear_of_side_effects', label: 'Fear of side effects' },
  { value: 'cost', label: 'Cost' },
  { value: 'religious_or_cultural', label: 'Religious or cultural reasons' },
  { value: 'partner_or_family_objects', label: 'Partner or family objects' },
  { value: 'does_not_see_need', label: 'Does not see the need' },
  { value: 'distance_or_time', label: 'Distance or time' },
  { value: 'prefers_traditional_remedy', label: 'Prefers a traditional remedy' },
  { value: 'other', label: 'Other' },
];

const OUTCOME: Record<Outcome, { label: string; icon: IconType; tone: 'ok' | 'bad' | 'neutral' }> = {
  done: { label: 'Done', icon: CheckCircle, tone: 'ok' },
  not_available: { label: 'Not available', icon: SlashCircle01, tone: 'neutral' },
  declined: { label: 'Declined', icon: XCircle, tone: 'neutral' },
  not_done_today: { label: 'Not done today', icon: Clock, tone: 'neutral' },
  cannot_afford: { label: 'Cannot afford', icon: Coins01, tone: 'neutral' },
  side_effects: { label: 'Side effects', icon: FaceFrown, tone: 'neutral' },
};

/** Which outcomes a kind of recommendation offers. */
export function outcomesFor(kind: ConstraintKind): Outcome[] {
  switch (kind) {
    case 'test':
      return ['done', 'not_available', 'declined', 'not_done_today', 'cannot_afford'];
    case 'medicine':
    case 'supplement':
      return ['done', 'not_available', 'declined', 'cannot_afford', 'side_effects', 'not_done_today'];
    case 'vaccine':
      return ['done', 'not_available', 'declined', 'not_done_today', 'side_effects'];
    case 'food':
      return ['done', 'cannot_afford', 'not_available', 'declined'];
    case 'transport':
      return ['done', 'cannot_afford', 'not_available', 'declined'];
  }
}

export function kindForItem(id: string, category?: string): ConstraintKind | undefined {
  if (id.startsWith('test.') || id.startsWith('untested.') || category === 'tests') return 'test';
  if (id.startsWith('imm.') || id.includes('vaccine') || category === 'immunisation') return 'vaccine';
  if (id.includes('iron') || id.includes('folic') || id.includes('calcium') || id.includes('vit')) return 'supplement';
  if (category === 'medication' || id.startsWith('med.')) return 'medicine';
  if (category === 'nutrition') return 'food';
  if (id.includes('transport') || id.includes('birth_plan')) return 'transport';
  return undefined;
}

/** The ConstraintEvent fields for an outcome (none for Done). */
export function toConstraint(v: ConstraintValue): Pick<ConstraintEvent, 'reason' | 'temporary' | 'note' | 'declinedReason' | 'sideEffect'> | null {
  const note = v.whyNote?.trim() || undefined;
  switch (v.outcome) {
    case 'done':
      return null;
    case 'not_done_today':
      return { reason: 'not_available', temporary: true, note };
    case 'cannot_afford':
      return { reason: 'cannot_afford', note };
    case 'side_effects':
      return { reason: 'side_effects', note, sideEffect: v.severity && v.symptoms?.length ? { symptoms: v.symptoms, severity: v.severity } : undefined };
    case 'declined':
      return { reason: 'declined', note, declinedReason: v.why };
    case 'not_available':
      return { reason: 'not_available', note };
  }
}

// ---------- Content (engine first, cautious defaults otherwise) ----------

const DEFAULT_SYMPTOMS: Record<ConstraintKind, string[]> = {
  supplement: ['Nausea', 'Constipation', 'Stomach pain', 'Dark stools', 'Vomiting'],
  medicine: ['Nausea', 'Dizziness', 'Headache', 'Rash', 'Vomiting', 'Swelling of face or lips', 'Difficulty breathing'],
  vaccine: ['Fever', 'Pain or swelling where given', 'Crying a lot', 'Rash', 'Fits', 'Floppy or hard to wake'],
  test: [],
  food: ['Stomach upset', 'Rash'],
  transport: [],
};
const DANGER_SYMPTOMS = new Set(['Swelling of face or lips', 'Difficulty breathing', 'Fits', 'Floppy or hard to wake', 'Vomiting everything']);

export interface SymptomOption {
  code: string;
  label: string;
  serious?: boolean;
  harmless?: boolean;
}

/** Item-specific symptoms from src/clinical SIDE_EFFECTS (by group), else a cautious default list. */
export function sideEffectOptions(itemId: string, kind: ConstraintKind): SymptomOption[] {
  try {
    const spec = SIDE_EFFECTS[sideEffectGroup(itemId)];
    if (spec?.symptoms?.length) return spec.symptoms.map((s) => ({ code: s.code, label: s.label, serious: s.serious, harmless: s.harmless }));
  } catch {
    /* defaults */
  }
  return DEFAULT_SYMPTOMS[kind].map((l) => ({ code: l, label: l, serious: DANGER_SYMPTOMS.has(l) }));
}

export interface SideEffectResponse {
  action: 'continue' | 'adjust' | 'stop_refer';
  tips: string[];
  headline: string;
}

export function sideEffectResponse(itemId: string, kind: ConstraintKind, symptoms: string[], severity?: 'mild' | 'moderate' | 'severe'): SideEffectResponse | undefined {
  if (!severity || !symptoms.length) return undefined;
  const opts = sideEffectOptions(itemId, kind);
  const serious = symptoms.some((c) => opts.find((o) => o.code === c)?.serious);
  const action: SideEffectResponse['action'] = serious || severity === 'severe' ? 'stop_refer' : severity === 'moderate' ? 'adjust' : 'continue';
  const harmless = opts.filter((o) => o.harmless && symptoms.includes(o.code)).map((o) => o.label.replace(/\s*\(.*\)$/, ''));
  try {
    const spec = SIDE_EFFECTS[sideEffectGroup(itemId)];
    if (spec && spec.group !== 'other') {
      const text = action === 'stop_refer' ? spec.severe : action === 'adjust' ? spec.moderate : spec.mild;
      const tips = text.split(/(?<=\.)\s+/).filter(Boolean);
      if (harmless.length) tips.unshift(`${harmless.join(', ')}: expected and harmless.`);
      if (spec.reportable && action === 'stop_refer') tips.push('Report it through the facility today.');
      return { action, headline: HEADLINE[action], tips };
    }
  } catch {
    /* defaults below */
  }
  if (action === 'stop_refer') return { action, headline: HEADLINE.stop_refer, tips: ['Do not give the next dose.', 'Refer to the facility today and write down what she took and when.'] };
  if (kind === 'vaccine') return { action, headline: HEADLINE[action], tips: ['Keep breastfeeding and give extra feeds.', 'A cool cloth helps where the injection was given.', 'Come back at once if the fever lasts more than 2 days or the baby will not feed.'] };
  return { action, headline: HEADLINE[action], tips: ['Take it with food or at night.', 'Write down when it happens and tell the health worker at the next visit.'] };
}

const HEADLINE: Record<SideEffectResponse['action'], string> = {
  continue: 'Mild: carry on, with these tips',
  adjust: 'Moderate: change how she takes it',
  stop_refer: 'Stop and refer today',
};

export function declineCounselling(itemId: string, kind: ConstraintKind, why?: DeclineWhy): string[] {
  const fn = fromModules<(id: string, why?: string) => string[] | undefined>('declineCounselling');
  try {
    const r = typeof fn === 'function' ? fn(itemId, why) : undefined;
    if (r?.length) return r;
  } catch {
    /* defaults */
  }
  const base = ['Thank her for telling you. It is her choice, and you will respect it.', 'Explain in one or two sentences what this protects her or the baby from.'];
  const byWhy: Partial<Record<DeclineWhy, string>> = {
    fear_of_side_effects: kind === 'vaccine' ? 'Most babies have only a mild fever or a sore leg for a day. Tell her what to watch for and what to do.' : 'Most side effects are mild and settle. Show her how to take it with food or at night.',
    cost: 'Tell her where it is free (the PHC, a government programme) and help her get there.',
    religious_or_cultural: 'Ask what worries her. Offer to talk with a faith leader or an elder she trusts.',
    partner_or_family_objects: 'Offer to talk with her partner or family together, at the next visit or by phone.',
    does_not_see_need: 'Share one plain reason it helps, and ask if she would like to think about it until the next visit.',
    distance_or_time: 'Agree a day and a way to get there, or offer it at the next home visit.',
    prefers_traditional_remedy: 'Ask what she uses. Many remedies are safe alongside this; check that hers is.',
  };
  const extra = why ? byWhy[why] : undefined;
  return [...base, ...(extra ? [extra] : []), 'Write down her reason, and ask again gently at the next visit.'];
}

// ---------- Control ----------

export function ConstraintControl({
  kind,
  itemId,
  value,
  onChange,
  label,
  size = 'md',
}: {
  kind: ConstraintKind;
  itemId: string;
  value?: ConstraintValue;
  onChange: (v: ConstraintValue | null) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const outs = outcomesFor(kind);
  const symptoms = useMemo(() => sideEffectOptions(itemId, kind), [itemId, kind]);
  const resp = value?.outcome === 'side_effects' ? sideEffectResponse(itemId, kind, value.symptoms ?? [], value.severity) : undefined;
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="constraint-control">
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {outs.map((o) => {
          const def = OUTCOME[o];
          const on = value?.outcome === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : { outcome: o })}
              className={cx(
                'visit-opt inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 font-semibold outline-focus-ring ring-1 ring-inset focus-visible:outline-2',
                size === 'sm' ? 'min-h-9 text-sm' : 'min-h-11 text-sm',
                on ? (o === 'done' ? 'bg-success-solid text-on-fill ring-transparent' : 'bg-primary-solid text-on-fill ring-transparent') : 'bg-primary text-secondary ring-primary hover:bg-primary_hover',
              )}
            >
              <def.icon aria-hidden="true" className="size-4" />
              {def.label}
            </button>
          );
        })}
      </div>

      {value?.outcome === 'declined' ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-secondary p-3">
          <p className="text-sm font-semibold text-primary">Why did she decline?</p>
          <div className="flex flex-wrap gap-1.5">
            {DECLINE_WHY.map((w) => (
              <button
                key={w.value}
                type="button"
                aria-pressed={value.why === w.value}
                onClick={() => onChange({ ...value, why: value.why === w.value ? undefined : w.value })}
                className={cx('min-h-9 cursor-pointer rounded-full px-3 text-sm ring-1 ring-inset', value.why === w.value ? 'bg-brand-solid font-semibold text-on-fill ring-transparent' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}
              >
                {w.label}
              </button>
            ))}
          </div>
          {value.why === 'other' ? (
            <input className="min-h-10 rounded-lg px-3 text-sm ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand" placeholder="Her reason, in a few words" value={value.whyNote ?? ''} onChange={(e) => onChange({ ...value, whyNote: e.target.value })} aria-label="Her reason" />
          ) : null}
          <div>
            <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">What to say</p>
            <ul className="mt-1.5 space-y-1.5">
              {declineCounselling(itemId, kind, value.why).map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-secondary">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-brand-secondary" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-tertiary">Her decision is respected and recorded. Gaskin will offer an alternative where there is one.</p>
        </div>
      ) : null}

      {value?.outcome === 'side_effects' ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-secondary p-3">
          <p className="text-sm font-semibold text-primary">Which symptoms?</p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map((s) => {
              const on = value.symptoms?.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...value, symptoms: on ? value.symptoms!.filter((x) => x !== s.code) : [...(value.symptoms ?? []), s.code] })}
                  className={cx('min-h-9 cursor-pointer rounded-full px-3 text-sm ring-1 ring-inset', on ? (s.serious ? 'bg-error-solid font-semibold text-on-fill ring-transparent' : 'bg-brand-solid font-semibold text-on-fill ring-transparent') : s.serious ? 'bg-primary text-error-primary ring-error_subtle' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}
                >
                  {s.label}
                  {s.serious ? <span className="sr-only"> (danger sign)</span> : null}
                </button>
              );
            })}
          </div>
          <Segmented
            label="How bad"
            size="sm"
            value={value.severity}
            onChange={(sev) => onChange({ ...value, severity: (sev ?? undefined) as ConstraintValue['severity'] })}
            options={[
              { value: 'mild', label: 'Mild' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'severe', label: 'Severe', tone: 'bad' },
            ]}
          />
          {resp ? (
            <div role="status" className={cx('rounded-xl p-3 ring-1 ring-inset', resp.action === 'stop_refer' ? 'bg-error-primary ring-error_subtle' : resp.action === 'adjust' ? 'bg-warning-primary ring-warning_subtle' : 'bg-success-primary ring-success_subtle')}>
              <p className={cx('flex items-center gap-2 text-sm font-semibold', resp.action === 'stop_refer' ? 'text-error-primary' : resp.action === 'adjust' ? 'text-warning-primary' : 'text-success-primary')}>
                {resp.action === 'stop_refer' ? <AlertCircle className="size-4" aria-hidden="true" /> : <CheckCircle className="size-4" aria-hidden="true" />}
                {resp.headline}
              </p>
              <ul className="mt-1.5 space-y-1">
                {resp.tips.map((t, i) => (
                  <li key={i} className="text-sm text-secondary">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-tertiary">Choose the symptoms and how bad they are to see what to do.</p>
          )}
        </div>
      ) : null}

      {value?.outcome === 'cannot_afford' ? (
        <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary">
          <Coins01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
          Saved. Her plan will show where to get it free and an affordable local alternative.
        </p>
      ) : null}
      {value?.outcome === 'not_available' || value?.outcome === 'not_done_today' ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-warning_subtle ring-inset">
          {kind === 'transport' ? <Truck01 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {kind === 'test' ? 'The result is unknown, which is not the same as normal. Her plan will say when and where to test.' : 'Her plan will show another source or a referral.'}
        </p>
      ) : null}
    </div>
  );
}

/** Words for a recorded constraint reason, for chips and the timeline. */
export const REASON_WORD: Record<ConstraintReason, string> = {
  cannot_afford: 'cannot afford',
  not_available: 'not available',
  side_effects: 'side effects',
  declined: 'declined',
  forgets: 'forgets',
  no_transport: 'no transport',
};
