/**
 * Visits v2: conditional follow-ups, constraint answers and test statuses.
 *
 * A "No" that needs a reason opens a follow-up ("What gets in the way?"); each reason records a
 * ConstraintEvent so the plan can offer an honest alternative, and some reasons open their own
 * follow-up (for example side effects: which ones, how bad). Tests offer Done, Not available,
 * Declined and Not done today; a missing result is unknown, never normal or abnormal.
 */
import type { ConstraintReason } from '../types';
import { howToFor, SIDE_EFFECTS, sideEffectGroup } from '../clinical';
import { src } from './sources';
import type { ChecklistItem, ChecklistResult, ItemInput, VisitChecklist } from './types';

type FU = NonNullable<ChecklistItem['followUps']>[number];

const REASONS: Array<{ value: string; label: string; reason?: ConstraintReason }> = [
  { value: 'cannot_afford', label: 'Cannot afford it', reason: 'cannot_afford' },
  { value: 'side_effects', label: 'Side effects (nausea, constipation, other)', reason: 'side_effects' },
  { value: 'forgets', label: 'Forgets', reason: 'forgets' },
  { value: 'not_available', label: 'Ran out, or out of stock at the clinic', reason: 'not_available' },
  { value: 'declined', label: 'Does not think she needs it', reason: 'declined' },
  { value: 'no_transport', label: 'Cannot get there (transport)', reason: 'no_transport' },
  { value: 'other', label: 'Other' },
];

const DECLINED_OPTIONS = [
  ['fear_of_side_effects', 'Afraid of side effects'],
  ['cost', 'Cost'],
  ['religious_or_cultural', 'Religious or cultural reasons'],
  ['partner_or_family_objects', 'Partner or family objects'],
  ['does_not_see_need', 'Does not see the need'],
  ['distance_or_time', 'Distance or time'],
  ['prefers_traditional_remedy', 'Prefers a traditional remedy'],
  ['other', 'Other'],
] as const;

function child(parent: ChecklistItem, base: string, extra: Partial<ChecklistItem> & Pick<ChecklistItem, 'title' | 'input'>): ChecklistItem {
  const suffix = parent.childId ? `@${parent.childId}` : '';
  return {
    id: `${base}${suffix}`,
    baseId: base,
    section: parent.section,
    subject: parent.subject,
    childId: parent.childId,
    childName: parent.childName,
    why: parent.why,
    sources: parent.sources,
    priority: parent.priority,
    ...extra,
  };
}

/** "Which side effects, and how bad?" for an item that has a side-effect group. */
function sideEffectFollowUp(parent: ChecklistItem, target: string): FU {
  const spec = SIDE_EFFECTS[sideEffectGroup(target)];
  return {
    when: { answerIn: ['side_effects'] },
    items: [
      child(parent, `${parent.baseId}.fu.se_symptoms`, {
        title: `Which side effects? (${spec.label})`,
        how: spec.symptoms.some((s) => s.harmless) ? `Reassure: ${spec.symptoms.filter((s) => s.harmless).map((s) => s.label).join('; ')}.` : undefined,
        input: { kind: 'multi', noneLabel: 'None of these', options: spec.symptoms.map((s) => ({ value: s.code, label: s.label, finding: s.serious ? { label: `${s.label} after ${spec.label.toLowerCase()}`, action: 'refer' as const, urgency: s.emergency ? ('emergency' as const) : ('urgent' as const), todo: spec.severe } : undefined })) },
        constraintTarget: target,
      }),
      child(parent, `${parent.baseId}.fu.se_severity`, {
        title: 'How bad?',
        input: { kind: 'choice', options: [{ value: 'mild', label: 'Mild: she can carry on' }, { value: 'moderate', label: 'Moderate: troubling, but no danger sign' }, { value: 'severe', label: 'Severe', finding: { label: `Severe side effects of ${spec.label.toLowerCase()}`, action: 'refer', urgency: 'urgent', todo: spec.severe } }] },
        constraintTarget: target,
        howTo: { steps: [spec.mild] },
      }),
    ],
  };
}

function declinedFollowUp(parent: ChecklistItem): FU {
  return {
    when: { answerIn: ['declined'] },
    items: [
      child(parent, `${parent.baseId}.fu.declined_why`, {
        title: 'Why did she decline?',
        how: 'Ask without pressure. Her choice is recorded and respected; the plan answers the concern and offers again.',
        input: { kind: 'choice', options: DECLINED_OPTIONS.map(([value, label]) => ({ value, label })) },
      }),
    ],
  };
}

/** "What gets in the way?" with reason → constraint, plus nested follow-ups. */
function reasonFollowUp(parent: ChecklistItem, target: string, answerIn: string[], title = 'What gets in the way?', only?: string[]): FU {
  const opts = REASONS.filter((r) => !only || only.includes(r.value));
  const q = child(parent, `${parent.baseId}.fu.why`, {
    title,
    input: { kind: 'choice', options: opts.map((r) => ({ value: r.value, label: r.label })) },
    constraintTarget: target,
    constraintOn: Object.fromEntries(opts.filter((r) => r.reason).map((r) => [r.value, r.reason!])),
  });
  q.followUps = [];
  if (opts.some((o) => o.value === 'side_effects')) q.followUps.push(sideEffectFollowUp(q, target));
  if (opts.some((o) => o.value === 'declined')) q.followUps.push(declinedFollowUp(q));
  const tip = (value: string, key: string) =>
    q.followUps!.push({ when: { answerIn: [value] }, items: [child(q, `${q.baseId}.tell_${value}`, { section: 'tell', title: 'Tell her', input: { kind: 'told' }, textKey: key, howTo: howToFor(target) })] });
  if (opts.some((o) => o.value === 'forgets')) tip('forgets', 'vt.fu.reminder');
  if (opts.some((o) => o.value === 'cannot_afford')) tip('cannot_afford', 'vt.fu.free');
  if (opts.some((o) => o.value === 'no_transport')) tip('no_transport', 'vt.fu.transport');
  return { when: { answerIn }, items: [q] };
}

/** Constraint target for a checklist base id. */
export function targetFor(baseId: string): string | undefined {
  if (/^(a\.adherence|d\.ifa)$/.test(baseId)) return 'med.iron_folate';
  if (baseId === 'd.folic_scd') return 'med.folic_acid_scd';
  if (baseId === 'a.hiv_art') return 'med.art_pmtct';
  if (baseId === 'd.calcium') return 'med.calcium';
  if (baseId === 'd.iptp') return 'med.iptp';
  if (baseId === 'd.aspirin') return 'med.aspirin';
  if (baseId === 'd.itn') return 'rest.itn';
  if (baseId === 'd.birth_plan' || baseId === 'a.transport') return 'transport';
  if (baseId === 'a.ebf') return 'bf.exclusive';
  if (baseId === 'a.cf_meals' || baseId === 'a.cf_animal' || baseId === 'a.diet') return 'nutr.complementary_feeding';
  if (baseId === 'a.anc_missed') return 'visit.anc_next';
  if (baseId === 'd.td') return 'imm.td';
  const vac = baseId.match(/^d\.vaccine\.(.+)$/);
  if (vac) return `imm.${vac[1]}`;
  const lab = TEST_BASE[baseId];
  if (lab) return `test.${lab}`;
  return undefined;
}

const TEST_BASE: Record<string, string> = {
  'd.hb': 'haemoglobin',
  'd.hiv': 'hiv',
  'd.syphilis': 'syphilis',
  'd.hepb': 'hepatitis_b',
  'd.genotype': 'genotype',
  'd.urine_protein': 'urine_protein',
  'd.glucose': 'blood_glucose_fasting',
  'd.ultrasound': 'ultrasound',
  'd.rdt': 'malaria_rdt',
};

/** Test status answers and the constraint each records. */
export const TEST_STATUS: Record<'not_available' | 'declined' | 'not_done_today', { label: string; reason: ConstraintReason; temporary?: boolean }> = {
  not_available: { label: 'Not available', reason: 'not_available' },
  declined: { label: 'Declined', reason: 'declined' },
  not_done_today: { label: 'Not done today', reason: 'not_available', temporary: true },
};

/** Add Visits v2 fields to a built item. Mutates and returns the item. */
export function enrichItem(it: ChecklistItem): ChecklistItem {
  const target = targetFor(it.baseId);
  if (TEST_BASE[it.baseId]) {
    it.isTest = true;
    it.constraintTarget = target;
    it.constraintOn = { not_available: 'not_available', declined: 'declined', not_done_today: 'not_available' };
    it.followUps = [declinedFollowUp(it)];
  } else if (target) {
    it.constraintTarget = target;
    const k = it.input.kind;
    // Which answer means "No": yes/no items that are abnormal on 'no', done items on 'not_done'.
    let no: string[] = [];
    if (k === 'yes_no' && it.input.abnormalWhen === 'no') no = ['no'];
    else if (k === 'yes_no' && it.baseId === 'a.ebf') no = ['yes'];
    else if (k === 'yes_no' && it.baseId === 'a.hiv_art') no = ['yes'];
    else if (k === 'done') no = ['not_done'];
    else if (k === 'number') no = [];
    if (no.length) {
      const medsLike = /^(med\.|imm\.)/.test(target);
      const only =
        target === 'rest.itn'
          ? ['cannot_afford', 'not_available', 'declined', 'other']
          : target === 'transport'
            ? ['no_transport', 'cannot_afford', 'other']
            : target === 'bf.exclusive'
              ? ['declined', 'other']
              : target.startsWith('imm.')
                ? ['not_available', 'side_effects', 'declined', 'no_transport', 'other']
                : medsLike
                  ? undefined
                  : ['cannot_afford', 'not_available', 'declined', 'other'];
      const title = target === 'bf.exclusive' ? 'Why other foods or drinks?' : target.startsWith('imm.') ? 'Why not given?' : 'What gets in the way?';
      it.followUps = [...(it.followUps ?? []), reasonFollowUp(it, target, no, title, only)];
    }
  }
  if ((it.section === 'tell' || it.section === 'do') && !it.howTo) {
    const key = it.textKey ?? target ?? '';
    const h = howToFor(key) ?? (target ? howToFor(target) : undefined);
    if (h) {
      it.howTo = h;
      it.guideId = h.guideId;
    }
  }
  return it;
}

/** Did this answer open the follow-up? */
export function answerMatches(r: ChecklistResult | undefined, answerIn: string[]): boolean {
  if (!r) return false;
  if (answerIn.includes(r.status)) return true;
  if (r.choice !== undefined && answerIn.includes(r.choice)) return true;
  return (r.choices ?? []).some((c) => answerIn.includes(c));
}

/**
 * Every item that can be answered now, in order: top-level items and the follow-ups their answers
 * opened (recursively). Use this instead of `checklist.items` when answering, counting or saving.
 */
export function activeItems(checklist: VisitChecklist, results: Record<string, ChecklistResult>): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const walk = (it: ChecklistItem) => {
    out.push(it);
    for (const fu of it.followUps ?? []) if (answerMatches(results[it.id], fu.when.answerIn)) for (const c of fu.items) walk(c);
  };
  for (const it of checklist.items) walk(it);
  return out;
}

export type { ItemInput };
export { src };
