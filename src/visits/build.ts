/**
 * Builds a guided visit checklist for one mother (and her baby or babies) on one day,
 * and turns the worker's answers into timeline events the rules engine understands.
 */
import type {
  Alert,
  Child,
  ClinicalEvent,
  CountryCode,
  FeedingEvent,
  GrowthEvent,
  ImmunisationEvent,
  LabEvent,
  MedicationEvent,
  Mother,
  ReferralEvent,
  ScreeningEvent,
  SymptomCode,
  SymptomEvent,
  VisitEvent,
  VitalsEvent,
} from '../types';
import { CONDITION_LABELS, COUNTRY_RULES, IMMUNISATION_SCHEDULES, IMMUNISATION_SOURCE, vaccineKey } from '../clinical';
import { addDays, babyAge, daysBetween, dayMs, shortDate } from '../engine/dates';
import { collectFacts, hasCondition, labNumber, labPositive, latestEpds, latestFeeding, latestLab, maternalVaccines, medsMatching, ofKind, onMedication, growthFor, recentSymptoms, type Facts } from '../engine/facts';
import { computeRisks } from '../engine/risks';
import { ancPlan, vaccineList } from '../engine/schedule';
import { facilityById } from '../data/directory';
import { CATALOGUE, SECTION_ORDER, SECTION_TITLES, TEMPLATE_BY_ID, VISIT_TEMPLATES, type CatalogueItem, type VisitTemplate } from './catalogue';
import { CDC_MILESTONES, WHO_MOTOR_WINDOWS, milestoneSetFor, nextMilestoneSet } from './milestones';
import { src } from './sources';
import { renderVisitText } from './text';
import type { ChecklistItem, ChecklistResult, ChecklistSection, Emit, Finding, FindingSpec, ItemInput, RiskFlags, VisitChecklist, VisitCtx, VisitSection } from './types';

const ANC_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

// ---------- Template choice ----------

/** Which visit is due for her today, from her stage and what has already happened. */
export function dueTemplateId(mother: Mother, asOf: string, childId?: string): string {
  const f = collectFacts(mother, asOf);
  if (f.pregnant && f.ga !== undefined) {
    // The template matches her gestation; booking items are added whenever she has not yet booked.
    const byGa = ANC_WEEKS.findIndex((w) => w >= f.ga! - 1);
    return `anc${byGa < 0 ? 8 : byGa + 1}`;
  }
  const child = childId ? f.children.find((c) => c.id === childId) : f.youngest;
  const age = child ? daysBetween(child.dob, f.asOf) : undefined;
  if (child && age !== undefined && age >= 0 && age <= 1000) {
    if (age <= 1) return 'pnc_24h';
    if (age <= 6) return 'pnc_day3';
    if (age <= 41) return 'pnc_day7_14';
    if (age < 63) return 'pnc_6wk';
    const tpl = [...VISIT_TEMPLATES].reverse().find((t) => t.stage === 'infant' && t.ageDays !== undefined && t.ageDays <= age + 14);
    return tpl?.id ?? 'child_10wk';
  }
  return 'preconception';
}

// ---------- Context ----------

const FACILITY_BIRTH_RISKS = ['previous_caesarean', 'grand_multipara', 'multiple_pregnancy', 'previous_pph', 'sickle_cell_disease', 'pre_eclampsia_high_risk', 'hypertension_current', 'adolescent', 'severe_anaemia', 'moderate_anaemia', 'previous_stillbirth', 'gdm', 'diabetes', 'hiv'];

/** Parse the done list written into visit notes by checklistToEvents. */
function doneBefore(f: Facts): Set<string> {
  const out = new Set<string>();
  for (const v of ofKind(f, 'visit')) {
    const m = v.note?.match(/done:([^|]*)/);
    if (m) for (const id of m[1].split(',')) if (id) out.add(id.trim());
  }
  return out;
}

function riskFlags(f: Facts, babies: Child[]): RiskFlags {
  const m = f.mother;
  const hb = labNumber(latestLab(f, 'haemoglobin'));
  const epds = latestEpds(f);
  const feeding = latestFeeding(f);
  const rules = COUNTRY_RULES[m.country];
  return {
    scd: hasCondition(f, 'sickle_cell_disease') || m.genotype === 'SS' || m.genotype === 'SC',
    hiv: hasCondition(f, 'hiv') || labPositive(latestLab(f, 'hiv')),
    previousCaesarean: m.previousCaesarean,
    caesareanBirth: f.lastBirth?.mode === 'caesarean',
    vaginalBirth: !!f.lastBirth && f.lastBirth.mode !== 'caesarean',
    twins: (f.pregnant && (m.pregnancy?.fetuses ?? 1) > 1) || babies.length > 1,
    hypertension: hasCondition(f, 'chronic_hypertension', 'pre_eclampsia_history'),
    diabetes: hasCondition(f, 'diabetes_preexisting', 'gestational_diabetes'),
    anaemia: hasCondition(f, 'anaemia') || (hb !== undefined && hb < (f.pregnant ? 11 : 12)),
    depression: hasCondition(f, 'depression_history') || (epds !== undefined && epds.score >= rules.epds.positive),
    hepatitisB: hasCondition(f, 'hepatitis_b') || labPositive(latestLab(f, 'hepatitis_b')),
    lowMilk: feeding?.milkSupply === 'low' || feeding?.milkSupply === 'very_low' || recentSymptoms(f, 14).mother.includes('low_milk_supply'),
    previousPph: m.previousPPH || !!f.lastBirth?.complications.includes('pph'),
    onCotrimoxazole: onMedication(f, /cotrimoxazole|co-trimoxazole|septrin/i),
    adolescent: m.age < 20,
    smallBaby: (c?: Child) => !!c && (c.gestationAtBirthWeeks < 37 || c.birthWeightKg < 2.5),
  };
}

function makeCtx(mother: Mother, f: Facts, template: VisitTemplate, babies: Child[], child?: Child): VisitCtx {
  const country = mother.country;
  const rules = COUNTRY_RULES[country];
  const flags = riskFlags(f, babies);
  const lmp = f.lmp;
  const sinceLmp = (test: LabEvent['test']) => !!lmp && ofKind(f, 'lab').some((l) => l.test === test && dayMs(l.at) >= dayMs(lmp));
  const epdsList = ofKind(f, 'screening').filter((s) => s.instrument === 'epds');
  const lastEpds = epdsList[epdsList.length - 1];
  const epdsSince = (iso: string) => epdsList.some((s) => dayMs(s.at) >= dayMs(iso));
  const ga = f.ga ?? template.gaWeek;
  const isAncT = template.stage === 'pregnancy';
  let epdsDue = false;
  if (isAncT && lmp) epdsDue = !epdsSince(lmp) || ((ga ?? 0) >= 28 && !epdsSince(addDays(lmp, 28 * 7)));
  else if (isAncT) epdsDue = template.id === 'anc1' || template.id === 'anc5';
  if ((template.id === 'pnc_6wk' || template.stage === 'infant') && f.lastBirth && (f.daysSinceBirth ?? 0) <= 365) epdsDue = !epdsSince(addDays(f.lastBirth.date, 28));
  if (flags.depression && (!lastEpds || daysBetween(lastEpds.at, f.asOf) >= 28) && template.stage !== 'birth') epdsDue = true;

  const hbs = ofKind(f, 'lab').filter((l) => l.test === 'haemoglobin');
  const lastHb = hbs[hbs.length - 1];
  const hbSince = (iso: string) => hbs.some((h) => dayMs(h.at) >= dayMs(iso));
  let hbDue = false;
  if (isAncT) {
    hbDue = lmp ? !hbSince(lmp) || ((ga ?? 0) >= 28 && !hbSince(addDays(lmp, 28 * 7))) || ((ga ?? 0) >= 36 && !hbSince(addDays(lmp, 36 * 7))) : template.id === 'anc1' || template.id === 'anc4' || template.id === 'anc6';
    if (flags.anaemia && (!lastHb || daysBetween(lastHb.at, f.asOf) >= 28)) hbDue = true;
  } else if (template.id === 'pnc_6wk') hbDue = flags.anaemia || flags.previousPph;

  const sp = lmp ? medsMatching(f, /\b(sp|iptp|sulfadoxine|fansidar)\b/i, lmp) : [];
  const td = maternalVaccines(f);
  const tdThis = lmp ? td.filter((e) => dayMs(e.at) >= dayMs(lmp)) : [];
  const risks = computeRisks(f);
  const pe = risks.find((r) => r.code === 'pre_eclampsia_high_risk');
  const birthRisks = risks.filter((r) => FACILITY_BIRTH_RISKS.includes(r.code));
  const iptpEligible = rules.iptp === 'all' || (rules.iptpRegions ?? []).includes(mother.region);
  const weights = child ? growthFor(f, child).filter((g) => g.weightKg !== undefined) : [];
  const lastW = weights[weights.length - 1];
  const childImms = child ? ofKind(f, 'immunisation').filter((e) => e.childId === child.id && e.vaccines.some((v) => /deworm/i.test(v))) : [];
  const lastDeworm = childImms[childImms.length - 1];
  const sched = IMMUNISATION_SCHEDULES[country];
  const childAgeDays = child ? daysBetween(child.dob, f.asOf) : template.ageDays;
  const corrected = child && child.gestationAtBirthWeeks < 37 && childAgeDays !== undefined && childAgeDays < 730 ? Math.max(0, childAgeDays - (40 - child.gestationAtBirthWeeks) * 7) : childAgeDays;

  return {
    mother,
    f,
    asOf: f.asOf,
    country,
    template,
    ga: f.pregnant ? f.ga : template.gaWeek,
    daysPostpartum: f.daysSinceBirth,
    child,
    childAgeDays,
    childAgeMonths: corrected !== undefined ? corrected / 30.4 : undefined,
    babies,
    flags,
    epds: { positive: rules.epds.positive, refer: rules.epds.refer },
    bmi: f.bmi,
    ancAttended: f.pregnant ? (ancPlan(f)?.attended ?? 0) : template.id === 'anc1' ? 0 : 1,
    epdsDue,
    epdsRecentDays: lastEpds ? daysBetween(lastEpds.at, f.asOf) : undefined,
    hbDue,
    hbRecentDays: lastHb ? daysBetween(lastHb.at, f.asOf) : undefined,
    testedSinceLmp: { hiv: sinceLmp('hiv'), syphilis: sinceLmp('syphilis'), hepatitis_b: sinceLmp('hepatitis_b'), ultrasound: sinceLmp('ultrasound') },
    genotypeTested: mother.genotype !== 'unknown' || ofKind(f, 'lab').some((l) => l.test === 'genotype'),
    iptpEligible,
    onSp: iptpEligible && !flags.onCotrimoxazole && (ga ?? 0) >= 13,
    spDoses: sp.length,
    lastSpDays: sp.length ? daysBetween(sp[sp.length - 1].at, f.asOf) : undefined,
    dewormedThisPregnancy: !!lmp && medsMatching(f, /albendazole|mebendazole|deworm/i, lmp).length > 0,
    tdDoses: td.reduce((n, e) => n + e.vaccines.length, 0),
    tdThisPregnancy: tdThis.length,
    lastTdDays: td.length ? daysBetween(td[td.length - 1].at, f.asOf) : undefined,
    aspirinIndicated: !!pe,
    aspirinReasons: pe ? [pe.reason] : [],
    onAspirin: onMedication(f, /aspirin/i),
    facilityBirthNeeded: birthRisks.length > 0,
    facilityBirthReasons: birthRisks.map((r) => r.label),
    lastWeight: lastW ? { kg: lastW.weightKg!, date: shortDate(lastW.at) } : undefined,
    childDewormedDays: lastDeworm ? daysBetween(lastDeworm.at, f.asOf) : undefined,
    scheduleHas: (code: string) => sched.some((v) => v.vaccines.some((x) => vaccineKey(x) === vaccineKey(code))),
  };
}

// ---------- Immunisation ----------

/** Plain names for vaccines, for mother-facing text (translated through the pack glossary). */
export const VACCINE_PLAIN: Record<string, string> = {
  BCG: 'TB vaccine',
  OPV: 'polio drops',
  HEPB: 'hepatitis B vaccine',
  PENTA: 'five-in-one injection',
  PCV: 'pneumonia vaccine',
  ROTA: 'diarrhoea drops',
  IPV: 'polio injection',
  MALARIA: 'malaria vaccine',
  VITA: 'vitamin A',
  MCV: 'measles vaccine',
  MR: 'measles vaccine',
  YF: 'yellow fever vaccine',
  MENA: 'meningitis vaccine',
  LLIN: 'treated bed net',
  DEWORMING: 'worm medicine',
};

export function plainVaccines(codes: string[]): string {
  const names: string[] = [];
  for (const c of codes) {
    const k = vaccineKey(c);
    const base = Object.keys(VACCINE_PLAIN).find((p) => k.startsWith(p));
    const n = base ? VACCINE_PLAIN[base] : c;
    if (!names.includes(n)) names.push(n);
  }
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

interface VaccinePlan {
  due: Array<{ code: string; label: string; scheduledDays: number; overdueDays: number }>;
  deferred: Array<{ code: string; reason: string }>;
  next?: { date: string; label: string; codes: string[] };
}

function childImmunisations(f: Facts, child: Child): Array<{ key: string; at: string }> {
  const only = f.children.length === 1;
  const out: Array<{ key: string; at: string }> = [];
  for (const e of ofKind(f, 'immunisation')) {
    if (e.childId === child.id || (!e.childId && only && !e.vaccines.some((v) => /^(tt|td)\d*/i.test(v.trim())))) for (const v of e.vaccines) out.push({ key: vaccineKey(v), at: e.at });
  }
  return out;
}

/** Doses due today (including catch-up), doses held back by minimum intervals, and the next scheduled visit. */
export function vaccinePlan(f: Facts, child: Child, country: CountryCode): VaccinePlan {
  const given = childImmunisations(f, child);
  const givenAt = new Map(given.map((g) => [g.key, g.at]));
  const age = daysBetween(child.dob, f.asOf);
  const due: VaccinePlan['due'] = [];
  const deferred: VaccinePlan['deferred'] = [];
  let next: VaccinePlan['next'];
  for (const visit of IMMUNISATION_SCHEDULES[country]) {
    const missing = visit.vaccines.filter((v) => !givenAt.has(vaccineKey(v)));
    if (!missing.length) continue;
    if (visit.ageDays > age + 3) {
      if (!next) next = { date: addDays(child.dob, visit.ageDays), label: visit.label, codes: missing };
      continue;
    }
    for (const v of missing) {
      const k = vaccineKey(v);
      if ((k === 'OPV0' || k === 'HEPB0') && age > 14) continue;
      if (k === 'BCG' && age > 335) continue;
      const series = k.match(/^([A-Z]+?)(\d)$/);
      if (series && Number(series[2]) > 1) {
        const prevKey = `${series[1]}${Number(series[2]) - 1}`;
        const prevAt = givenAt.get(prevKey);
        if (!prevAt && due.some((d) => vaccineKey(d.code) === prevKey)) {
          deferred.push({ code: v, reason: `After ${prevKey.toLowerCase().replace(/^\w/, (x) => x.toUpperCase())} (4 weeks apart)` });
          continue;
        }
        if (prevAt && daysBetween(prevAt, f.asOf) < 28) {
          deferred.push({ code: v, reason: `Previous dose ${daysBetween(prevAt, f.asOf)} days ago; due from ${shortDate(addDays(prevAt, 28))}` });
          continue;
        }
      }
      due.push({ code: v, label: visit.label, scheduledDays: visit.ageDays, overdueDays: Math.max(0, age - visit.ageDays) });
    }
  }
  if (deferred.length && (!next || dayMs(next.date) > dayMs(addDays(f.asOf, 28)))) {
    next = { date: addDays(f.asOf, 28), label: 'catch-up doses', codes: deferred.map((d) => d.code) };
  }
  return { due, deferred, next };
}

// ---------- Building ----------

const PLACEHOLDERS = (country: CountryCode) => {
  const r = COUNTRY_RULES[country];
  return (s: string) => s.replace(/\{hospital\}/g, r.referralHospital).replace(/\{sameDay\}/g, r.sameDayFacility);
};

function fillInput(input: ItemInput, fill: (s: string) => string): ItemInput {
  return JSON.parse(fill(JSON.stringify(input))) as ItemInput;
}

function dyn<T>(v: T | ((c: VisitCtx) => T), c: VisitCtx): T {
  return typeof v === 'function' ? (v as (c: VisitCtx) => T)(c) : v;
}

function itemFrom(ci: CatalogueItem, c: VisitCtx, fill: (s: string) => string): ChecklistItem {
  const baby = ci.subject === 'baby' && c.child;
  const suffix = baby ? `@${c.child!.id}` : '';
  const dep = ci.dependsOn ? dyn(ci.dependsOn, c) : undefined;
  const params = ci.params ? ci.params(c) : baby ? { name: c.child!.name } : undefined;
  const textKey = ci.textKey ? dyn(ci.textKey, c) : undefined;
  const item: ChecklistItem = {
    id: `${ci.id}${suffix}`,
    baseId: ci.id,
    section: ci.section,
    subject: ci.subject,
    childId: baby ? c.child!.id : undefined,
    childName: baby ? c.child!.name : undefined,
    title: fill(dyn(ci.title, c)),
    how: ci.how ? fill(dyn(ci.how, c)) : undefined,
    why: fill(ci.why),
    sources: src(...ci.sources),
    priority: ci.priority,
    input: fillInput(dyn(ci.input, c), fill),
    emit: ci.emit,
    illustration: ci.illustration,
    once: ci.once,
    dependsOn: dep ? `${dep}${CATALOGUE.find((x) => x.id === dep)?.subject === 'baby' ? suffix : ''}` : undefined,
    textKey,
    params,
    because: ci.because?.(c).filter(Boolean),
  };
  if (textKey) item.english = renderVisitText(textKey, params);
  return item;
}

function vaccineItems(c: VisitCtx, plan: VaccinePlan): ChecklistItem[] {
  const child = c.child!;
  const srcIds = [IMMUNISATION_SOURCE[c.country], 'who-pnc-2022-rec34'];
  return plan.due.map((d) => {
    const k = vaccineKey(d.code);
    const name = vaccineList([d.code]);
    return {
      id: `d.vaccine.${k}@${child.id}`,
      baseId: `d.vaccine.${k}`,
      section: 'do' as VisitSection,
      subject: 'baby' as const,
      childId: child.id,
      childName: child.name,
      title: `Give ${name}`,
      why: `${c.country === 'NG' ? 'NPHCDA' : c.country === 'KE' ? 'KEPI' : 'Ghana Health Service'} schedule: ${d.code} at ${d.label}.${d.overdueDays > 14 ? ` ${d.overdueDays} days late: give it today (catch-up).` : ''} Check the card first; record the batch number on the card.`,
      sources: src(...srcIds),
      priority: d.overdueDays > 28 ? 1 : 2,
      input: { kind: 'done', doneLabel: 'Given today', notDoneLabel: 'Not given' },
      emit: { immunisation: true } as Emit,
      illustration: 'vaccination' as const,
      vaccines: [d.code],
      dueDate: addDays(child.dob, d.scheduledDays),
      because: d.overdueDays > 14 ? [`Due at ${d.label}, not recorded`] : undefined,
    };
  });
}

function milestoneItems(c: VisitCtx, done: Set<string>, skipped: VisitChecklist['skipped']): ChecklistItem[] {
  const child = c.child!;
  const months = c.childAgeMonths ?? 0;
  const out: ChecklistItem[] = [];
  const corrected = child.gestationAtBirthWeeks < 37 ? ` (corrected for birth at ${child.gestationAtBirthWeeks} weeks)` : '';
  const set = milestoneSetFor(months);
  if (set) {
    for (const ms of set.milestones) {
      const id = `${ms.id}@${child.id}`;
      if (done.has(id)) {
        skipped.push({ id, title: ms.label, reason: 'Already achieved at an earlier visit' });
        continue;
      }
      out.push({
        id,
        baseId: ms.id,
        section: 'milestones',
        subject: 'baby',
        childId: child.id,
        childName: child.name,
        title: ms.label,
        how: `Watch or ask. Most children (3 in 4) do this by ${set.months} months${corrected}.`,
        why: `CDC "Learn the Signs. Act Early." ${set.months}-month milestone (${ms.domain}). Missing one is a reason to play, watch and recheck; missing several, or losing a skill, needs assessment.`,
        sources: src('cdc-ltsae-2022', 'zubler-2022'),
        priority: ms.domain === 'movement' ? 3 : 4,
        input: { kind: 'milestone', ageMonths: set.months },
        textKey: ms.textKey,
        params: { name: child.name },
        english: ms.plain,
      });
    }
  }
  for (const w of WHO_MOTOR_WINDOWS) {
    if (months < w.from || months > w.to + 6) continue;
    const id = `ms.${w.id}@${child.id}`;
    if (done.has(id)) continue;
    out.push({
      id,
      baseId: `ms.${w.id}`,
      section: 'milestones',
      subject: 'baby',
      childId: child.id,
      childName: child.name,
      title: `${w.label} (WHO window ${w.from}–${w.to} months)`,
      how: `Healthy children reach this between ${w.from} and ${w.to} months${corrected}.`,
      why: `WHO Motor Development Study: 99% of healthy children in five countries, including Ghana, did this by ${w.to} months. Not yet by then: refer for assessment.${w.maySkip ? ' About 4% of children never crawl on hands and knees.' : ''}`,
      sources: src('who-motor-2006'),
      priority: months > w.to ? 2 : 3,
      input: { kind: 'milestone', ageMonths: months, windowEndMonths: w.maySkip ? undefined : w.to },
      textKey: w.textKey,
      params: { name: child.name },
      english: w.plain,
    });
  }
  if (set && set.months >= 6) {
    out.push({
      id: `ms.regression@${child.id}`,
      baseId: 'ms.regression',
      section: 'milestones',
      subject: 'baby',
      childId: child.id,
      childName: child.name,
      title: 'Has the child lost a skill they once had?',
      why: 'CDC: losing skills at any age is a reason to act early.',
      sources: src('cdc-ltsae-2022'),
      priority: 2,
      input: { kind: 'yes_no', abnormalWhen: 'yes', finding: { label: 'Lost a skill they had before', action: 'refer', urgency: 'routine', todo: 'Refer for developmental assessment (paediatrics) this month.', textKey: 'vt.milestones_concern' } },
    });
  }
  return out;
}

function tellExtras(c: VisitCtx, plan: VaccinePlan | undefined): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const child = c.child;
  if (child && plan) {
    if (plan.due.length) {
      const params = { name: child.name, vaccines: plainVaccines(plan.due.map((d) => d.code)) };
      out.push({
        id: `t.vaccines_today@${child.id}`,
        baseId: 't.vaccines_today',
        section: 'tell',
        subject: 'baby',
        childId: child.id,
        childName: child.name,
        title: 'Vaccines given today',
        why: 'WHO PNC rec. 34: immunise by the national schedule. Tell her what was given and what to expect.',
        sources: src(IMMUNISATION_SOURCE[c.country], 'who-pnc-2022-rec34'),
        priority: 2,
        input: { kind: 'told' },
        illustration: 'vaccination',
        textKey: 'vt.vaccines_today',
        params,
        english: renderVisitText('vt.vaccines_today', params),
        subKeys: ['vt.vaccines_today.side'],
        subEnglish: [renderVisitText('vt.vaccines_today.side', params)],
      });
    }
    const params: Record<string, string> = plan.next ? { name: child.name, date: shortDate(plan.next.date), vaccines: plainVaccines(plan.next.codes) } : { name: child.name };
    const key = plan.next ? 'vt.vaccines_next' : 'vt.vaccines_done';
    out.push({
      id: `t.vaccines_next@${child.id}`,
      baseId: 't.vaccines_next',
      section: 'tell',
      subject: 'baby',
      childId: child.id,
      childName: child.name,
      title: plan.next ? `Next vaccines: ${plan.next.label} (${shortDate(plan.next.date)})` : 'All routine vaccines done',
      why: 'Mothers who know the next vaccine date are more likely to come back.',
      sources: src(IMMUNISATION_SOURCE[c.country]),
      priority: 2,
      input: { kind: 'told' },
      illustration: 'calendar',
      textKey: key,
      params,
      english: renderVisitText(key, params),
      vaccines: plan.next?.codes,
      dueDate: plan.next?.date,
    });
  }
  if (child && (c.template.stage === 'infant' || c.template.id === 'pnc_6wk' || c.template.id === 'pnc_day7_14')) {
    const nextSet = nextMilestoneSet(c.childAgeMonths ?? 0);
    if (nextSet) {
      const pick = nextSet.milestones.filter((m, i, all) => m.domain === 'movement' || m.domain === 'language' || all.length <= 6 || i < 2).slice(0, 6);
      const params = { name: child.name };
      out.push({
        id: `t.milestones_next@${child.id}`,
        baseId: 't.milestones_next',
        section: 'tell',
        subject: 'baby',
        childId: child.id,
        childName: child.name,
        title: `What to expect by ${nextSet.months} months`,
        why: 'CDC "Learn the Signs. Act Early.": parents who know the next milestones spot delays early.',
        sources: src('cdc-ltsae-2022', 'zubler-2022'),
        priority: 3,
        input: { kind: 'told' },
        textKey: 'vt.milestones_next',
        params,
        english: renderVisitText('vt.milestones_next', params),
        subKeys: [...pick.map((m) => m.textKey), 'vt.milestones_watch'],
        subEnglish: [...pick.map((m) => m.plain), renderVisitText('vt.milestones_watch', params)],
      });
    }
  }
  return out;
}

function nextVisit(c: VisitCtx, plans: Map<string, VaccinePlan>): VisitChecklist['nextVisit'] {
  const t = c.template;
  const f = c.f;
  const asOf = f.asOf;
  const later = (d: string) => (dayMs(d) <= dayMs(asOf) ? addDays(asOf, 7) : d);
  if (t.stage === 'pregnancy') {
    const ga = c.ga ?? t.gaWeek ?? 12;
    const w = ANC_WEEKS.find((x) => x > ga + 1);
    const lmp = f.lmp;
    if (w !== undefined) {
      const idx = ANC_WEEKS.indexOf(w);
      const date = lmp ? addDays(lmp, w * 7) : addDays(asOf, (w - ga) * 7);
      return { date: later(date), label: `ANC contact ${Math.max(idx + 1, (t.contactNumber ?? 0) + 1)} (${w} weeks)`, templateId: `anc${idx + 1}` };
    }
    return { date: lmp ? later(addDays(lmp, 41 * 7)) : addDays(asOf, 7), label: 'Check at 41 weeks if the baby is not born', templateId: 'anc8' };
  }
  if (t.stage === 'preconception') return { date: addDays(asOf, 90), label: 'Preconception and family planning check-in', templateId: 'preconception' };
  const child = c.child;
  if (!child) return undefined;
  const age = daysBetween(child.dob, asOf);
  const small = c.babies.some((b) => c.flags.smallBaby(b));
  if (t.stage === 'birth' || t.stage === 'postpartum') {
    const nxt = t.next ? TEMPLATE_BY_ID[t.next] : undefined;
    if (small && age < 28 && nxt && (nxt.dayFrom ?? nxt.ageDays ?? 0) - age > 7) return { date: addDays(asOf, 7), label: 'Extra weekly check (small baby: weight, warmth, feeding)', templateId: t.id };
    if (nxt?.dayFrom !== undefined) return { date: later(addDays(child.dob, nxt.dayFrom)), label: nxt.label, templateId: nxt.id };
    if (nxt?.ageDays !== undefined) return { date: later(addDays(child.dob, nxt.ageDays)), label: nxt.label, templateId: nxt.id };
  }
  const nxt = VISIT_TEMPLATES.find((x) => x.stage === 'infant' && x.ageDays !== undefined && x.ageDays > age + 14);
  const plan = plans.get(child.id);
  const vacc = plan?.next;
  if (vacc && (!nxt || dayMs(vacc.date) < dayMs(addDays(child.dob, nxt.ageDays!)))) return { date: later(vacc.date), label: `${child.name}: ${vacc.label} vaccines`, templateId: undefined };
  if (nxt) return { date: later(addDays(child.dob, nxt.ageDays!)), label: nxt.label, templateId: nxt.id };
  return { date: addDays(asOf, 30), label: `${child.name}: growth check`, templateId: undefined };
}

export interface BuildOptions {
  visitTemplateId?: string;
  childId?: string;
  /** Override the facility referrals go to */
  referralFacilityId?: string;
}

export function buildVisitChecklist(mother: Mother, asOf: string, opts: BuildOptions = {}): VisitChecklist {
  const f = collectFacts(mother, asOf);
  const templateId = opts.visitTemplateId ?? dueTemplateId(mother, asOf, opts.childId);
  const template = TEMPLATE_BY_ID[templateId];
  if (!template) throw new Error(`Unknown visit template: ${templateId}`);
  const fill = PLACEHOLDERS(mother.country);

  // Babies: the requested child, or the youngest, plus a twin born the same day.
  let babies: Child[] = [];
  if (template.includesBaby) {
    const anchor = opts.childId ? f.children.find((c) => c.id === opts.childId) : f.youngest;
    if (anchor) babies = f.children.filter((c) => c.dob.slice(0, 10) === anchor.dob.slice(0, 10));
    else if (template.stage === 'birth' || template.stage === 'postpartum') {
      babies = [{ id: 'newborn', name: 'Baby', sex: 'F', dob: f.asOf, birthWeightKg: 0, gestationAtBirthWeeks: 40, feeding: 'exclusive_breastfeeding' }];
    }
  }

  const done = doneBefore(f);
  const skipped: VisitChecklist['skipped'] = [];
  const items: ChecklistItem[] = [];
  const motherCtx = makeCtx(mother, f, template, babies, babies[0]);
  const plans = new Map<string, VaccinePlan>();

  const babyCtxs = babies.map((b) => (b === babies[0] ? motherCtx : makeCtx(mother, f, template, babies, b)));
  for (const ci of CATALOGUE) {
    const ctxs = ci.subject === 'baby' ? babyCtxs : [motherCtx];
    for (const c of ctxs) {
      if (ci.subject === 'baby' && !c.child) continue;
      if (!ci.when(c)) continue;
      const it = itemFrom(ci, c, fill);
      const skip = ci.skipIf?.(c) ?? (ci.once && done.has(it.id) ? 'Checked at an earlier visit' : undefined);
      if (skip) {
        skipped.push({ id: it.id, title: it.title, reason: skip });
        continue;
      }
      items.push(it);
    }
  }

  for (const [bi, b] of babies.entries()) {
    if (b.id === 'newborn') continue;
    const c = babyCtxs[bi];
    const plan = vaccinePlan(f, b, mother.country);
    plans.set(b.id, plan);
    items.push(...vaccineItems(c, plan));
    for (const d of plan.deferred) skipped.push({ id: `d.vaccine.${vaccineKey(d.code)}@${b.id}`, title: `${vaccineList([d.code])} (${b.name})`, reason: d.reason });
    if (template.stage === 'infant' || template.id === 'pnc_6wk') items.push(...milestoneItems(c, done, skipped));
    items.push(...tellExtras(c, plan));
  }

  // Td for the mother is a vaccine: put the dose code on the item.
  for (const it of items) if (it.baseId === 'd.td') it.vaccines = [`Td${motherCtx.tdDoses + 1}`];

  const next = nextVisit(motherCtx, plans);
  if (next) {
    const params = { date: shortDate(next.date), label: next.label };
    items.push({
      id: 'bk.next',
      baseId: 'bk.next',
      section: 'book',
      subject: 'mother',
      title: `Book: ${next.label}`,
      how: `Suggested date ${shortDate(next.date)}. Change it if she cannot come that day; write it on her card.`,
      why: template.stage === 'pregnancy' ? 'WHO ANC rec. E.7: eight contacts.' : template.stage === 'infant' ? 'Vaccines and growth checks follow the national schedule.' : 'WHO PNC rec. 44: at least four postnatal contacts.',
      sources: src(template.stage === 'pregnancy' ? 'who-anc-2016-e7' : template.stage === 'infant' ? IMMUNISATION_SOURCE[mother.country] : 'who-pnc-2022-rec44'),
      priority: 2,
      input: { kind: 'book' },
      illustration: 'calendar',
      textKey: 'vt.next_visit',
      params,
      english: renderVisitText('vt.next_visit', params),
      next,
    });
  }

  // Order: section order, then priority, then mother before baby, then catalogue order (stable sort).
  const ordered = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => SECTION_ORDER.indexOf(a.it.section) - SECTION_ORDER.indexOf(b.it.section) || a.it.priority - b.it.priority || a.i - b.i)
    .map((x) => x.it);
  const sections: ChecklistSection[] = SECTION_ORDER.map((id) => ({ id, title: SECTION_TITLES[id], items: ordered.filter((i) => i.section === id) })).filter((s) => s.items.length > 0);

  const personalisation = [...new Set(ordered.flatMap((i) => (i.because?.length ? [`${i.because.join(', ')}: ${i.title.charAt(0).toLowerCase()}${i.title.slice(1)}`] : [])))];
  if (babies.length > 1) personalisation.unshift(`Twins: every baby check is repeated for ${babies.map((b) => b.name).join(' and ')}`);

  const context: string[] = [];
  if (f.pregnant && f.ga !== undefined) context.push(`${f.ga} weeks pregnant`, `G${mother.gravida} P${mother.parity}`);
  if (f.daysSinceBirth !== undefined && !f.pregnant && f.daysSinceBirth <= 42) context.push(`Day ${f.daysSinceBirth} after ${f.lastBirth?.mode === 'caesarean' ? 'caesarean' : 'birth'}`);
  for (const b of babies) if (b.id !== 'newborn') context.push(`${b.name}: ${babyAge(daysBetween(b.dob, f.asOf))}${motherCtx.flags.smallBaby(b) ? `, ${b.birthWeightKg} kg at ${b.gestationAtBirthWeeks} weeks` : ''}`);
  for (const cnd of mother.conditions) context.push(CONDITION_LABELS[cnd]);
  if (motherCtx.flags.scd && !mother.conditions.includes('sickle_cell_disease')) context.push(`Genotype ${mother.genotype}`);
  if (mother.previousCaesarean) context.push('Previous caesarean');

  const facility = facilityById(mother.facilityId);
  return {
    id: `vc-${mother.id}-${template.id}-${f.asOf}`,
    templateId: template.id,
    label: template.label,
    motherId: mother.id,
    asOf: f.asOf,
    country: mother.country,
    stage: template.stage,
    visitType: template.visitType,
    contactNumber: template.contactNumber,
    children: babies.map((b) => {
      const age = daysBetween(b.dob, f.asOf);
      const corrected = b.gestationAtBirthWeeks < 37 && age < 730 ? Math.max(0, age - (40 - b.gestationAtBirthWeeks) * 7) : undefined;
      return { id: b.id, name: b.name, ageDays: age, ageLabel: babyAge(age), correctedAgeDays: corrected };
    }),
    context,
    personalisation,
    sections,
    items: ordered,
    skipped,
    nextVisit: next,
    referralFacilityId: opts.referralFacilityId ?? facility?.referralFacilityId ?? mother.facilityId,
  };
}

// ---------- Evaluating results ----------

/** Is this item active given the answers so far (conditional items open only on an abnormal parent)? */
export function isItemActive(item: ChecklistItem, checklist: VisitChecklist, results: Record<string, ChecklistResult>): boolean {
  if (!item.dependsOn) return true;
  const parent = checklist.items.find((i) => i.id === item.dependsOn);
  if (!parent) return true;
  const r = results[parent.id];
  return !!r && findingsFor(parent, r).length > 0;
}

function bandHit(input: Extract<ItemInput, { kind: 'number' }>, v: number): FindingSpec | undefined {
  for (const b of input.bands) {
    if (b.below !== undefined && v < b.below) return b.finding;
    if (b.atLeast !== undefined && v >= b.atLeast) return b.finding;
  }
  return undefined;
}

/** Findings for one item's answer. */
export function findingsFor(item: ChecklistItem, r: ChecklistResult): FindingSpec[] {
  const inp = item.input;
  switch (inp.kind) {
    case 'normal_abnormal':
      return r.status === 'abnormal' ? [inp.abnormal] : [];
    case 'yes_no':
      return inp.finding && inp.abnormalWhen !== 'never' && r.status === inp.abnormalWhen ? [inp.finding] : [];
    case 'number': {
      if (r.value === undefined || Number.isNaN(r.value)) return [];
      const hit = bandHit(inp, r.value);
      return hit ? [hit] : [];
    }
    case 'bp': {
      if (r.value === undefined || r.value2 === undefined) return [];
      for (const b of inp.bands) {
        if ((b.systolicAtLeast !== undefined && r.value >= b.systolicAtLeast) || (b.diastolicAtLeast !== undefined && r.value2 >= b.diastolicAtLeast) || (b.systolicBelow !== undefined && r.value < b.systolicBelow)) return [b.finding];
      }
      return [];
    }
    case 'choice': {
      const o = inp.options.find((x) => x.value === r.choice);
      return o?.finding ? [o.finding] : [];
    }
    case 'multi':
      return (r.choices ?? []).map((v) => inp.options.find((o) => o.value === v)?.finding).filter((x): x is FindingSpec => !!x);
    case 'epds': {
      if (r.value === undefined) return [];
      if (r.selfHarm) return [{ label: `EPDS item 10 positive (thoughts of self-harm), total ${r.value}`, action: 'refer', urgency: 'emergency', todo: 'Do not leave her alone. Same-day mental health referral; involve a trusted family member with her consent.', symptom: 'thoughts_of_self_harm', textKey: 'alert.self_harm' }];
      if (r.value >= inp.refer) return [{ label: `EPDS ${r.value} (probable depression, ${inp.refer} or more)`, action: 'refer', urgency: 'urgent', todo: 'Refer for assessment this week (mhGAP); start Thinking Healthy sessions now.', symptom: 'low_mood', textKey: 'alert.depression' }];
      if (r.value >= inp.positive) return [{ label: `EPDS ${r.value} (possible depression, ${inp.positive} or more)`, action: 'treat', urgency: 'routine', todo: 'Weekly Thinking Healthy support; rescreen in 2–4 weeks.', symptom: 'low_mood', textKey: 'mh.support' }];
      return [];
    }
    case 'done':
      return r.status === 'not_done' && inp.notDone ? [inp.notDone] : [];
    case 'milestone':
      if (r.status !== 'not_yet') return [];
      if (inp.windowEndMonths !== undefined && inp.ageMonths > inp.windowEndMonths) {
        return [{ label: `${item.title.split(' (')[0]}: not yet, past the WHO window`, action: 'refer', urgency: 'routine', todo: 'Refer for developmental assessment (paediatrics or physiotherapy) this month.', textKey: 'vt.milestones_concern' }];
      }
      return [{ label: `${item.title.split(' (')[0]}: not yet`, action: 'recheck', urgency: 'routine', todo: 'Show the mother how to practise this in play; recheck at the next visit.' }];
    default:
      return [];
  }
}

/** Every abnormal finding in the recorded answers, most urgent first. */
export function evaluateFindings(checklist: VisitChecklist, results: Record<string, ChecklistResult>): Finding[] {
  const out: Finding[] = [];
  for (const item of checklist.items) {
    const r = results[item.id];
    if (!r || !isItemActive(item, checklist, results)) continue;
    for (const spec of findingsFor(item, r)) {
      out.push({ itemId: item.id, baseId: item.baseId, title: item.title, subject: item.subject, childId: item.childId, childName: item.childName, label: spec.label, action: spec.action, urgency: spec.urgency, todo: spec.todo, symptom: spec.symptom, textKey: spec.textKey, sources: item.sources });
    }
  }
  // Several CDC milestones not yet reached: refer for assessment.
  for (const c of checklist.children) {
    const missed = checklist.items.filter((i) => i.childId === c.id && i.section === 'milestones' && i.baseId.startsWith('ms.') && /^ms\.\d+m\./.test(i.baseId) && results[i.id]?.status === 'not_yet');
    if (missed.length >= 3) {
      out.push({ itemId: `ms.summary@${c.id}`, baseId: 'ms.summary', title: 'Development', subject: 'baby', childId: c.id, childName: c.name, label: `${missed.length} age milestones not yet reached`, action: 'refer', urgency: 'routine', todo: 'Refer for developmental assessment this month; screen hearing and vision.', textKey: 'vt.milestones_concern', sources: src('cdc-ltsae-2022', 'zubler-2022') });
    }
  }
  const rank = { emergency: 0, urgent: 1, routine: 2 } as const;
  const act = { refer: 0, treat: 1, recheck: 2 } as const;
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency] || act[a.action] - act[b.action]);
}

/** Findings shaped as engine-style alerts, for showing beside the plan's alerts before the plan refreshes. */
export function findingsToAlerts(findings: Finding[]): Alert[] {
  return findings
    .filter((f) => f.action === 'refer' && f.urgency !== 'routine')
    .map((f) => ({
      id: `visit.${f.baseId}${f.childId ? `@${f.childId}` : ''}`,
      level: f.urgency === 'emergency' ? 'emergency' : 'urgent',
      title: f.childName ? `${f.childName}: ${f.label}` : f.label,
      action: f.todo,
      reason: `Found at the visit: ${f.title}.`,
      sources: f.sources,
      subject: f.subject === 'baby' ? 'child' : 'mother',
      motherTextKey: f.textKey,
    }));
}

/**
 * Open referrals recorded at a visit in the last 14 days, as alerts. The rules engine raises alerts
 * from symptoms, vitals and labs; findings with no symptom code (club foot, cleft palate, hip, eye,
 * genital and development findings) reach the worker through this function. Merge with plan.alerts.
 */
export function referralAlerts(mother: Mother, asOf: string): Alert[] {
  const f = collectFacts(mother, asOf);
  const names = new Map(f.children.map((c) => [c.id, c.name]));
  return ofKind(f, 'referral')
    .filter((r) => r.status === 'open' && daysBetween(r.at, f.asOf) <= 14 && /^vc-/.test(r.id))
    .map((r) => {
      const place = facilityById(r.toFacilityId)?.name ?? COUNTRY_RULES[mother.country].referralHospital;
      return {
        id: `alert.visit_referral.${r.id}`,
        level: r.urgency === 'emergency' ? 'emergency' : r.urgency === 'urgent' ? 'urgent' : 'warning',
        title: `Referral open: ${r.reason}`,
        action: `${r.note ?? ''} Confirm she reached ${place}; mark the referral arrived or completed.`.trim(),
        reason: `Found at the visit on ${shortDate(r.at)}${r.childId && names.get(r.childId) ? ` (${names.get(r.childId)})` : ''}.`,
        sources: [],
        subject: r.childId ? 'child' : 'mother',
        motherTextKey: r.urgency === 'emergency' ? 'vt.refer_now' : 'vt.refer_today',
        motherTextParams: { place },
      } satisfies Alert;
    });
}

// ---------- Results to events ----------

function stampOf(asOf: string): string {
  return asOf.length <= 10 ? `${asOf}T12:00:00.000Z` : asOf;
}

/**
 * Turn recorded answers into timeline events: one visit event, vitals, growth, labs, screening,
 * feeding, immunisation, medication, symptoms (so the engine raises its alerts), and a referral
 * event per person for every finding whose action is "refer".
 */
export function checklistToEvents(checklist: VisitChecklist, results: Record<string, ChecklistResult>, workerId: string, asOf: string): ClinicalEvent[] {
  const at = stampOf(asOf);
  const base = `${checklist.id}-${at.replace(/[^0-9]/g, '').slice(0, 14)}`;
  let n = 0;
  const id = () => `${base}-${++n}`;
  const events: ClinicalEvent[] = [];
  const active = checklist.items.filter((i) => results[i.id] && results[i.id].status !== 'not_checked' && isItemActive(i, checklist, results));
  const realChild = (cid?: string) => (cid && cid !== 'newborn' ? cid : undefined);

  // Visit
  const doneIds = active.filter((i) => (i.once && results[i.id].status !== 'not_checked') || (i.section === 'milestones' && results[i.id].status === 'achieved')).map((i) => i.id);
  const book = results['bk.next'];
  const told = active.filter((i) => i.section === 'tell' && results[i.id].status === 'told').length;
  events.push({
    id: id(),
    kind: 'visit',
    at,
    recordedBy: workerId,
    visitType: checklist.visitType,
    contactNumber: checklist.contactNumber,
    attended: true,
    note: `checklist:${checklist.templateId}|answered:${active.length}/${checklist.items.length}|told:${told}${book?.date ? `|next:${book.date}` : checklist.nextVisit ? `|next:${checklist.nextVisit.date}` : ''}|done:${doneIds.join(',')}`,
  } as VisitEvent);

  // Vitals: mother, then each baby
  const groups = new Map<string, ChecklistItem[]>();
  for (const i of active) {
    const k = i.childId ?? '';
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  for (const [cid, list] of groups) {
    const childId = realChild(cid);
    const vit: Partial<VitalsEvent> = {};
    const growth: Partial<GrowthEvent> = {};
    const feed: Partial<FeedingEvent> = {};
    const vaccines: string[] = [];
    for (const i of list) {
      const r = results[i.id];
      const e = i.emit;
      if (!e) continue;
      if ('vital' in e && r.value !== undefined) (vit as Record<string, number>)[e.vital] = r.value;
      if ('bp' in e && r.value !== undefined && r.value2 !== undefined) {
        vit.systolic = r.value;
        vit.diastolic = r.value2;
      }
      if ('growth' in e && r.value !== undefined) (growth as Record<string, number>)[e.growth] = r.value;
      if ('lab' in e) {
        let value: LabEvent['value'] | undefined;
        if (i.input.kind === 'number' && r.value !== undefined) value = r.value;
        else if (i.input.kind === 'choice') value = i.input.options.find((o) => o.value === r.choice)?.labValue;
        else if (i.input.kind === 'done' && r.status === 'done') value = 'done';
        if (value !== undefined) events.push({ id: id(), kind: 'lab', at, recordedBy: workerId, test: e.lab, value, unit: e.unit, childId } as LabEvent);
      }
      if ('immunisation' in e && r.status === 'done') vaccines.push(...(i.vaccines ?? (i.baseId === 'd.deworm_child' ? ['Deworming'] : [])));
      if ('medication' in e && r.status === 'done') {
        events.push({ id: id(), kind: 'medication', at, recordedBy: workerId, action: 'start', medication: { name: e.medication, dose: e.dose, startedAt: at.slice(0, 10), prescribedBy: workerId }, childId } as MedicationEvent);
      }
      if ('screening' in e && r.value !== undefined) {
        events.push({ id: id(), kind: 'screening', at, recordedBy: workerId, instrument: 'epds', score: r.value, selfHarmFlag: !!r.selfHarm } as ScreeningEvent);
      }
      if ('feeding' in e) {
        if (e.feeding === 'latch' && r.choice) feed.latchProblem = r.choice !== 'good';
        if (e.feeding === 'ebf' && (r.status === 'yes' || r.status === 'no')) feed.status = r.status === 'yes' ? 'mixed' : 'exclusive_breastfeeding';
        if (e.feeding === 'feeds' && r.value !== undefined) feed.feedsPerDay = r.value;
        if (e.feeding === 'supply' && (r.status === 'yes' || r.status === 'no')) feed.milkSupply = r.status === 'yes' ? 'good' : 'low';
      }
    }
    if (Object.keys(vit).length) events.push({ id: id(), kind: 'vitals', at, recordedBy: workerId, childId, ...vit } as VitalsEvent);
    if (Object.keys(growth).length && childId) events.push({ id: id(), kind: 'growth', at, recordedBy: workerId, childId, ...growth } as GrowthEvent);
    if (Object.keys(feed).length && childId) {
      const child = checklist.children.find((c) => c.id === childId);
      const status: FeedingEvent['status'] = feed.status ?? ((child?.ageDays ?? 0) >= 182 ? 'complementary_with_breastmilk' : 'exclusive_breastfeeding');
      events.push({ id: id(), kind: 'feeding', at, recordedBy: workerId, childId, ...feed, status } as FeedingEvent);
    }
    if (vaccines.length) events.push({ id: id(), kind: 'immunisation', at, recordedBy: workerId, childId, vaccines } as ImmunisationEvent);
  }

  // Symptoms and referrals from findings
  const findings = evaluateFindings(checklist, results);
  const bySubject = new Map<string, Finding[]>();
  for (const fd of findings) {
    const k = fd.childId ?? '';
    bySubject.set(k, [...(bySubject.get(k) ?? []), fd]);
  }
  const rank = { emergency: 0, urgent: 1, routine: 2 } as const;
  for (const [cid, list] of bySubject) {
    const childId = realChild(cid);
    const sx = [...new Set(list.map((x) => x.symptom).filter((s): s is SymptomCode => !!s))];
    if (sx.length) {
      const worst = list.filter((x) => x.symptom).sort((a, b) => rank[a.urgency] - rank[b.urgency])[0];
      events.push({ id: id(), kind: 'symptom', at, recordedBy: workerId, childId, symptoms: sx, severity: worst.urgency === 'emergency' ? 'severe' : worst.urgency === 'urgent' ? 'moderate' : 'mild', via: 'visit' } as SymptomEvent);
    }
    const refs = list.filter((x) => x.action === 'refer').sort((a, b) => rank[a.urgency] - rank[b.urgency]);
    if (refs.length) {
      const who = refs[0].childName ? `${refs[0].childName}: ` : '';
      events.push({
        id: id(),
        kind: 'referral',
        at,
        recordedBy: workerId,
        childId,
        toFacilityId: checklist.referralFacilityId ?? '',
        reason: `${who}${[...new Set(refs.map((x) => x.label))].join('; ')}`,
        urgency: refs[0].urgency,
        status: 'open',
        note: [...new Set(refs.map((x) => x.todo))].join(' '),
      } as ReferralEvent);
    }
  }
  return events;
}

export { CDC_MILESTONES };
