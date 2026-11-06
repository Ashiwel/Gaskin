import type { Alert, CarePlan, LearnedRule, Mother, NextContact, Override, PlanDiff, PlanItem } from '../types';
import { COUNTRY_RULES, MOTHER_TEXT, PLAN_TEXT, renderMotherText } from '../clinical';
import { computeAlerts, type AlertWithShort } from './alerts';
import { babyAge, daysBetween, ordinal, shortDate } from './dates';
import { collectFacts, type Facts } from './facts';
import { applyLearnedRules, applyOverrides } from './learning';
import type { LocationProfile, RuleCtx } from './items';
import { pregnancyRules } from './rulesPregnancy';
import { babyRules, breastfeedingRules, infantStageMotherRules, postpartumRules, preconceptionRules } from './rulesPostnatal';
import { traditionalRules } from './rulesTraditional';
import { nextContact } from './schedule';
import { stateFromFacts } from './state';
import { renderVisitText } from '../visits/text';
import { howToFor } from '../clinical';
import { concurrentCareRules, perChild, severalChildrenRules } from './children';
import { constraintRules, unknownItems } from './constraints';
import { personalAlerts, personalItems } from './personal';

export type PlanContext = {
  overrides: Override[];
  learnedRules: LearnedRule[];
  previous?: { version: number; itemIds: string[]; alertIds: string[] };
  /** Optional local foods, practices and malaria status for where she lives */
  location?: LocationProfile;
  /**
   * 'worker' (default): the full plan for a health worker.
   * 'personal': a woman using Gaskin for herself. Mother-facing text only, alerts become
   * "Go to [nearest facility] now" with the emergency number, worker-only items are hidden,
   * and "Register with a clinic" / "Book your next check-up" stay until she records them.
   */
  mode?: 'worker' | 'personal';
  /** Personal mode: the place to go (defaults to her registered clinic, then the country referral hospital) */
  nearestFacility?: string;
  /** Personal mode: emergency number to show (defaults to the country's from src/legal) */
  emergencyNumber?: string;
};

/**
 * Build the care plan. Order of layers:
 * 1. guideline rules for her stage and data
 * 2. traditional practices she mentioned
 * 3. approved learned rules that match her situation
 * 4. this mother's active overrides
 * 5. danger-sign alerts, computed independently from the record and never filtered
 */
export function buildPlan(mother: Mother, asOf: string, ctx: PlanContext): CarePlan {
  const f = collectFacts(mother, asOf);
  const alerts = computeAlerts(f);
  // Plain-language line for the mother on every alert (template-based, translation-ready).
  const babyName = f.youngest?.name ?? 'your baby';
  for (const { alert } of alerts) {
    if (alert.motherTextKey && alert.motherTextKey.startsWith('vt.')) {
      // Visit referral: the template lives in the visits module's VISIT_TEXT
      alert.motherText = renderVisitText(alert.motherTextKey, alert.motherTextParams ?? {});
      continue;
    }
    if (alert.motherTextKey && PLAN_TEXT[alert.motherTextKey] !== undefined) {
      // Untested results and side effects carry their own plan-text template.
      alert.motherText = renderMotherText(alert.motherTextKey, alert.motherTextParams ?? {});
      continue;
    }
    const key = alertTextKey(alert.id.replace(/@.*$/, ''), alert.level);
    const childName = alert.childId ? (f.children.find((k) => k.id === alert.childId)?.name ?? babyName) : babyName;
    const params = /\{name\}/.test(MOTHER_TEXT[key]) ? { name: childName } : undefined;
    alert.motherTextKey = key;
    alert.motherText = renderMotherText(key, params);
    if (params) alert.motherTextParams = params;
  }
  const state = stateFromFacts(f, alerts);
  const rules = COUNTRY_RULES[mother.country];
  const c: RuleCtx = { f, s: state, alerts, rules, simple: mother.literacy !== 'good', items: [], location: ctx.location };

  // Stages can run together: a pregnancy and every child under 1,000 days are all planned.
  switch (state.stage) {
    case 'pregnancy':
      pregnancyRules(c);
      // A pregnant mother with a child under 1,000 days still gets each child's plan.
      if (f.under1000.length) perChild(c, [babyRules, breastfeedingRules]);
      concurrentCareRules(c);
      break;
    case 'postpartum':
      postpartumRules(c);
      perChild(c, [babyRules]);
      // Older siblings under 1,000 days keep their feeding plan.
      if (f.under1000.length > 1) perChild({ ...c, f: { ...f, under1000: f.under1000.slice(0, -1) } }, [breastfeedingRules]);
      severalChildrenRules(c);
      break;
    case 'infant':
      perChild(c, [babyRules, breastfeedingRules]);
      infantStageMotherRules(c);
      severalChildrenRules(c);
      break;
    default:
      preconceptionRules(c);
  }
  referralItems(c, alerts);
  traditionalRules(c);
  constraintRules(c);
  if (state.unknowns?.length) unknownItems(c, state.unknowns);
  for (const it of c.items) {
    if (!it.howTo) it.howTo = howToFor(it.id, it.category);
    if (!it.childId) {
      const sib = it.id.match(/@(.+)$/)?.[1];
      if (sib && f.children.some((k) => k.id === sib)) it.childId = sib;
    }
  }

  let items: PlanItem[] = applyLearnedRules(c.items, ctx.learnedRules ?? [], mother, state);
  items = applyOverrides(items, ctx.overrides ?? [], mother.id);
  if (ctx.mode === 'personal') items = personalItems(items, mother, f.asOf, ctx);
  items = sortItems(items);

  let alertList = alerts.map((a) => a.alert);
  if (ctx.mode === 'personal') alertList = personalAlerts(alertList, mother, ctx);
  const next = nextContact(f);
  const prev = ctx.previous;
  const activeIds = items.filter((i) => i.status !== 'removed').map((i) => i.id);
  let changes: PlanDiff | undefined;
  let version = 1;
  if (prev) {
    // PlanContext.previous carries only ids, so content edits cannot be detected here;
    // the caller marks items it knows it changed (e.g. a modify override).
    changes = {
      added: activeIds.filter((id) => !prev.itemIds.includes(id)),
      removed: prev.itemIds.filter((id) => !activeIds.includes(id)),
      changed: [],
      newAlerts: alertList.map((a) => a.id).filter((id) => !prev.alertIds.includes(id)),
    };
    const clearedAlerts = prev.alertIds.some((id) => !alertList.some((a) => a.id === id));
    const any = changes.added.length + changes.removed.length + changes.newAlerts.length > 0 || clearedAlerts;
    version = any ? prev.version + 1 : prev.version;
  }

  return {
    motherId: mother.id,
    version,
    generatedAt: f.asOf,
    state,
    summary: summarise(f, state, alerts, next),
    alerts: alertList,
    items,
    nextContact: next,
    changes,
  };
}

/** Referral items mirror open emergency/urgent alerts so they appear in the plan and cannot be removed. */
function referralItems(c: RuleCtx, alerts: AlertWithShort[]): void {
  for (const a of alerts) {
    if (a.alert.level === 'warning') continue;
    const id = `refer.${a.alert.id.replace(/^alert\./, '')}`;
    const childId = a.alert.childId;
    if (c.items.some((i) => i.id === id)) continue;
    c.items.push({
      id,
      category: 'danger_signs',
      title: a.alert.title,
      detail: `${a.alert.action} Why: ${a.alert.reason}`,
      motherText: a.alert.motherText ?? '',
      motherTextKey: a.alert.motherTextKey,
      motherTextParams: a.alert.motherTextParams,
      priority: 1,
      audience: 'both',
      dueDate: c.f.asOf,
      evidence: 'A',
      sources: a.alert.sources,
      because: [a.alert.reason],
      locked: true,
      origin: 'guideline',
      illustration: illustrationFor(a.alert.id),
      status: 'active',
      ...(childId ? { childId } : {}),
    });
  }
}

/**
 * Template key for what to tell the mother about an alert right now.
 * Some alerts have a different message at a different level.
 */
function alertTextKey(id: string, level: Alert['level']): string {
  const levelled = `${id}.${level}`;
  if (MOTHER_TEXT[levelled] !== undefined) return levelled;
  if (MOTHER_TEXT[id] !== undefined) return id;
  return 'alert.fallback';
}

function illustrationFor(id: string): PlanItem['illustration'] {
  if (/bleed|haemorrhage/.test(id)) return 'danger_bleeding';
  if (/eclampsia|hypertension|bp/.test(id)) return 'danger_headache';
  if (/convuls/.test(id)) return 'danger_convulsion';
  if (/fever|sepsis|malaria|mastitis/.test(id)) return 'danger_fever';
  if (/fetal/.test(id)) return 'danger_baby_movement';
  if (/breath|dvt/.test(id)) return 'danger_breathing';
  if (/newborn|child|jaundice|cord|diarrhoea|malnutrition/.test(id)) return 'baby_danger';
  if (/self_harm|depression/.test(id)) return 'talk_to_someone';
  if (/anaemia/.test(id)) return 'iron_tablet';
  return 'clinic_visit';
}

function sortItems(items: PlanItem[]): PlanItem[] {
  const statusRank = { active: 0, done: 1, removed: 2 } as const;
  return [...items].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      a.priority - b.priority ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      a.id.localeCompare(b.id),
  );
}

/** One or two plain sentences for the worker. */
const FEEDING_WORDS: Record<string, string> = {
  exclusive_breastfeeding: 'exclusively breastfed',
  mixed: 'mixed feeding',
  complementary_with_breastmilk: 'eating family food and breastfed',
};

/**
 * One sentence on where she is, one on the top concern (alert, or high risks) when there is one,
 * then the next contact once: "Next contact 27 Nov: ANC contact 5 (34 weeks)."
 */
function summarise(f: Facts, s: CarePlan['state'], alerts: AlertWithShort[], next?: NextContact): string {
  const m = f.mother;
  let situation: string;
  if (s.stage === 'pregnancy') {
    const preg = m.gravida > 0 ? `${ordinal(m.gravida)} pregnancy` : 'pregnant';
    const kids = f.under1000.map((k) => `${k.name.split(' ')[0]} (${babyAge(daysBetween(k.dob, f.asOf))})`);
    situation = `${s.gestationalWeeks} weeks, ${preg}${(m.pregnancy?.fetuses ?? 1) > 1 ? ' (twins)' : ''}${kids.length ? `, also caring for ${kids.join(' and ')}` : ''}`;
  } else if (s.stage === 'postpartum') {
    const newborns = f.youngest ? f.children.filter((k) => k.dob.slice(0, 10) === f.youngest!.dob.slice(0, 10)) : [];
    const older = f.under1000.filter((k) => !newborns.includes(k));
    situation = `Day ${s.daysPostpartum} after ${f.lastBirth?.mode === 'caesarean' ? 'caesarean' : 'birth'}${newborns.length > 1 ? ` of twins (${newborns.map((k) => `${k.name.split(' ')[0]} ${k.birthWeightKg} kg`).join(', ')} at birth)` : f.youngest ? `, ${f.youngest.name.split(' ')[0]} ${f.youngest.birthWeightKg} kg at birth` : ''}${older.length ? `, also caring for ${older.map((k) => `${k.name.split(' ')[0]} (${babyAge(daysBetween(k.dob, f.asOf))})`).join(' and ')}` : ''}`;
  } else if (s.stage === 'infant' && f.youngest) {
    const others = f.under1000.filter((k) => k.id !== f.youngest!.id);
    const twin = others.filter((k) => k.dob.slice(0, 10) === f.youngest!.dob.slice(0, 10));
    const older = others.filter((k) => !twin.includes(k));
    const feeding = FEEDING_WORDS[f.youngest.feeding] ?? f.youngest.feeding.replace(/_/g, ' ');
    situation = `${[f.youngest, ...twin].map((k) => k.name.split(' ')[0]).join(' and ')} ${twin.length ? 'are' : 'is'} ${babyAge(f.youngestAgeDays!)} old, ${feeding}${older.length ? `, also caring for ${older.map((k) => `${k.name.split(' ')[0]} (${babyAge(daysBetween(k.dob, f.asOf))})`).join(' and ')}` : ''}`;
  } else {
    situation = `Not pregnant${f.children.length ? `, ${f.children.length} child${f.children.length > 1 ? 'ren' : ''}` : ''}`;
  }
  const sentences = [`${situation}.`];

  const top = alerts[0];
  if (top) {
    const more = alerts.length > 1 ? ` (and ${alerts.length - 1} more alert${alerts.length > 2 ? 's' : ''})` : '';
    sentences.push(`${cap(top.finding)}: ${top.short}${more}.`);
  } else {
    const highRisks = s.risks.filter((r) => r.severity === 'urgent' || r.severity === 'high').slice(0, 2);
    if (highRisks.length) sentences.push(`${highRisks.map((r, i) => (i === 0 ? cap(r.label) : /^[A-Z][a-z]/.test(r.label) ? r.label.charAt(0).toLowerCase() + r.label.slice(1) : r.label)).join(' and ')}.`);
  }
  if (next) {
    const diff = daysBetween(f.asOf, next.date);
    const when = diff === 0 ? 'today' : diff < 0 ? `overdue since ${shortDate(next.date)}` : diff === 1 ? 'tomorrow' : shortDate(next.date);
    // A child's contact label starts with the child's full name; say the first name once, at the end.
    const child = f.children.find((k) => next.label.startsWith(`${k.name}: `));
    const label = child ? `${next.label.slice(child.name.length + 2)} for ${child.name.split(' ')[0]}` : next.label;
    sentences.push(`Next contact ${when}: ${/^ANC/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1)}.`);
  }
  if (!f.events.length) sentences.push('No contacts recorded yet.');
  return sentences.join(' ');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

