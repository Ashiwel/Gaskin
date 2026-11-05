import type { Alert, CarePlan, LearnedRule, Mother, Override, PlanDiff, PlanItem } from '../types';
import { COUNTRY_RULES, MOTHER_TEXT, renderMotherText } from '../clinical';
import { computeAlerts, type AlertWithShort } from './alerts';
import { babyAge, ordinal } from './dates';
import { collectFacts, type Facts } from './facts';
import { applyLearnedRules, applyOverrides } from './learning';
import type { LocationProfile, RuleCtx } from './items';
import { pregnancyRules } from './rulesPregnancy';
import { babyRules, breastfeedingRules, infantStageMotherRules, postpartumRules, preconceptionRules } from './rulesPostnatal';
import { traditionalRules } from './rulesTraditional';
import { nextContact, contactLabelWithDate } from './schedule';
import { stateFromFacts } from './state';
import { renderVisitText } from '../visits/text';

export type PlanContext = {
  overrides: Override[];
  learnedRules: LearnedRule[];
  previous?: { version: number; itemIds: string[]; alertIds: string[] };
  /** Optional local foods, practices and malaria status for where she lives */
  location?: LocationProfile;
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
    const key = alertTextKey(alert.id, alert.level);
    const params = /\{name\}/.test(MOTHER_TEXT[key]) ? { name: babyName } : undefined;
    alert.motherTextKey = key;
    alert.motherText = renderMotherText(key, params);
    if (params) alert.motherTextParams = params;
  }
  const state = stateFromFacts(f, alerts);
  const rules = COUNTRY_RULES[mother.country];
  const c: RuleCtx = { f, s: state, alerts, rules, simple: mother.literacy !== 'good', items: [], location: ctx.location };

  switch (state.stage) {
    case 'pregnancy':
      pregnancyRules(c);
      // A pregnant mother with a child under 2 still gets the child's plan.
      if (f.youngest && f.youngestAgeDays! <= 730) {
        babyRules(c);
        breastfeedingRules(c);
      }
      break;
    case 'postpartum':
      postpartumRules(c);
      babyRules(c);
      break;
    case 'infant':
      babyRules(c);
      breastfeedingRules(c);
      infantStageMotherRules(c);
      break;
    default:
      preconceptionRules(c);
  }
  referralItems(c, alerts);
  traditionalRules(c);

  let items: PlanItem[] = applyLearnedRules(c.items, ctx.learnedRules ?? [], mother, state);
  items = applyOverrides(items, ctx.overrides ?? [], mother.id);
  items = sortItems(items);

  const alertList = alerts.map((a) => a.alert);
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
    summary: summarise(f, state, alerts, next ? contactLabelWithDate(next, f.asOf) : undefined),
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
function summarise(f: Facts, s: CarePlan['state'], alerts: AlertWithShort[], next?: string): string {
  const m = f.mother;
  const parts: string[] = [];
  if (s.stage === 'pregnancy') {
    const preg = m.gravida > 0 ? `${ordinal(m.gravida)} pregnancy` : 'pregnant';
    parts.push(`${s.gestationalWeeks} weeks, ${preg}${(m.pregnancy?.fetuses ?? 1) > 1 ? ' (twins)' : ''}`);
  } else if (s.stage === 'postpartum') {
    parts.push(`Day ${s.daysPostpartum} after ${f.lastBirth?.mode === 'caesarean' ? 'caesarean' : 'birth'}${f.youngest ? `; ${f.youngest.name} ${f.youngest.birthWeightKg} kg at birth` : ''}`);
  } else if (s.stage === 'infant' && f.youngest) {
    parts.push(`${f.youngest.name} is ${babyAge(f.youngestAgeDays!)} old, ${f.youngest.feeding.replace(/_/g, ' ')}`);
  } else {
    parts.push(`Not pregnant${f.children.length ? `, ${f.children.length} child${f.children.length > 1 ? 'ren' : ''}` : ''}`);
  }
  const first = `${parts[0]}.`;

  const top = alerts[0];
  if (top) {
    const more = alerts.length > 1 ? ` (+${alerts.length - 1} more alert${alerts.length > 2 ? 's' : ''})` : '';
    return `${first} ${cap(top.finding)}: ${top.short}${more}.`;
  }
  const highRisks = s.risks.filter((r) => r.severity === 'urgent' || r.severity === 'high').slice(0, 2);
  const riskText = highRisks.length ? ` ${highRisks.map((r) => r.label).join('; ')}.` : '';
  const due = next ? ` Next: ${/^[A-Z][a-z]/.test(next) ? next.charAt(0).toLowerCase() + next.slice(1) : next}.` : '';
  const silence = f.events.length ? '' : ' No contacts recorded yet.';
  return `${first}${riskText}${due}${silence}`.trim();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

