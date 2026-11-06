/**
 * When she cannot follow a recommendation (cost, stock, side effects, declined, forgets, transport),
 * and when a test has no result. The engine never quietly downgrades:
 * - a constraint keeps the original item and adds an honest alternative (`alt.<itemId>.<reason>`);
 *   food never replaces iron and folic acid in pregnancy, so cost leads to where it is free, a food
 *   plan alongside, and an earlier Hb recheck;
 * - severe side effects or allergic signs raise an urgent alert (stop and refer the same day);
 *   reportable reactions say how to report them;
 * - declined care records her right to decide, answers the concern, and offers again; for
 *   safety-critical items the danger education stays;
 * - a missing test result is unknown, never normal. When not knowing could hide danger now, the
 *   engine escalates to "refer for this test today".
 */
import type { Alert, ConstraintEvent, ConstraintReason, DeclinedReason, LabTest, PlanItem, UnknownResult } from '../types';
import { ADVERSE_EVENT_REPORTING, COUNTRY_RULES, cite, FREE_PROGRAMMES, howToFor, renderPlanText, SIDE_EFFECTS, sideEffectGroup } from '../clinical';
import type { AlertWithShort } from './alerts';
import { addDays, daysBetween, shortDate } from './dates';
import { type Facts, isRecent, latestBp, latestLab, latestVital, ofKind, recentSymptoms } from './facts';
import { motherTextFor, type RuleCtx } from './items';
import { pickFoods } from './rulesNutrition';

const WINDOW_DAYS = 90;

/** Latest constraint per target (item + child) in the last 90 days; a later "done" clears it. */
export function activeConstraints(f: Facts): ConstraintEvent[] {
  const latest = new Map<string, ConstraintEvent>();
  for (const e of ofKind(f, 'constraint')) {
    if (daysBetween(e.at, f.asOf) > WINDOW_DAYS) continue;
    // "Not done today" lapses after two weeks unless repeated.
    if (e.temporary && daysBetween(e.at, f.asOf) > 14) continue;
    latest.set(`${e.itemId}|${e.childId ?? ''}`, e);
  }
  // A test result or a medicine start after the constraint resolves it.
  const out: ConstraintEvent[] = [];
  for (const c of latest.values()) {
    const test = testOf(c.itemId);
    if (test && ofKind(f, 'lab').some((l) => l.test === test && l.at > c.at && (!c.childId || l.childId === c.childId))) continue;
    if (c.reason !== 'side_effects' && c.reason !== 'declined' && /^med\./.test(c.itemId) && ofKind(f, 'medication').some((m) => m.action === 'start' && m.at > c.at && medMatches(c.itemId, m.medication.name))) continue;
    out.push(c);
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function medMatches(itemId: string, name: string): boolean {
  if (/iron/.test(itemId)) return /iron|ferrous|ifa/i.test(name);
  if (/folic/.test(itemId)) return /folic/i.test(name);
  if (/iptp/.test(itemId)) return /sp|iptp|sulfadoxine/i.test(name);
  if (/calcium/.test(itemId)) return /calcium/i.test(name);
  if (/art/.test(itemId)) return /art|tld|tenofovir|dolutegravir/i.test(name);
  return false;
}

const TEST_IDS: Record<string, LabTest> = {
  'test.haemoglobin': 'haemoglobin',
  'test.hb': 'haemoglobin',
  'test.urine_protein': 'urine_protein',
  'test.malaria_rdt': 'malaria_rdt',
  'test.rdt': 'malaria_rdt',
  'test.hiv': 'hiv',
  'test.syphilis': 'syphilis',
  'test.hepatitis_b': 'hepatitis_b',
  'test.genotype': 'genotype',
  'test.ultrasound': 'ultrasound',
  'test.blood_glucose_fasting': 'blood_glucose_fasting',
  'test.gdm': 'ogtt_2h',
  'test.urine_glucose': 'urine_glucose',
  'test.blood_group': 'blood_group',
};

/** The lab test a constraint target refers to, if any. */
export function testOf(itemId: string): LabTest | undefined {
  return TEST_IDS[itemId.replace(/@.*$/, '')];
}

const TEST_LABEL: Partial<Record<LabTest, string>> = {
  haemoglobin: 'Haemoglobin (Hb)',
  urine_protein: 'Urine protein',
  malaria_rdt: 'Malaria test (RDT)',
  hiv: 'HIV test',
  syphilis: 'Syphilis test',
  hepatitis_b: 'Hepatitis B test',
  genotype: 'Genotype',
  ultrasound: 'Ultrasound',
  blood_glucose_fasting: 'Fasting blood glucose',
  ogtt_2h: 'Glucose tolerance test',
};

/**
 * Tests with no result that matter now. A test is unknown when it is missing (never done, or a
 * constraint said not available, declined or not done today). `refer_for_test` when the gap could
 * hide danger today.
 */
export function computeUnknowns(f: Facts): UnknownResult[] {
  const out: UnknownResult[] = [];
  const cons = activeConstraints(f).filter((c) => testOf(c.itemId));
  const conFor = (t: LabTest, childId?: string) => cons.find((c) => testOf(c.itemId) === t && (c.childId ?? undefined) === childId);
  const perinatal = f.pregnant || (f.daysSinceBirth !== undefined && f.daysSinceBirth <= 42);
  const { mother: sx } = recentSymptoms(f, 7);

  // Urine protein unknown with BP ≥140/90 (pregnancy from 20 weeks, or postpartum): could be pre-eclampsia.
  const bp = latestBp(f);
  if (perinatal && bp && isRecent(f, bp, 7) && (bp.systolic! >= 140 || bp.diastolic! >= 90) && (!f.pregnant || (f.ga ?? 0) >= 20)) {
    const prot = latestLab(f, 'urine_protein');
    if (!prot || !isRecent(f, prot, 7)) {
      const c = conFor('urine_protein');
      out.push({ test: 'urine_protein', since: c?.at.slice(0, 10) ?? bp.at.slice(0, 10), consequence: `BP ${bp.systolic}/${bp.diastolic} with no urine protein result: pre-eclampsia cannot be ruled out. Refer for a urine test and BP review today.`, action: 'refer_for_test' });
    }
  }
  // Hb unknown with pallor or breathlessness: could be severe anaemia.
  const hbLab = latestLab(f, 'haemoglobin');
  const pale = sx.includes('pallor') || sx.includes('breathlessness');
  if (pale && (!hbLab || daysBetween(hbLab.at, f.asOf) > 28)) {
    const c = conFor('haemoglobin');
    out.push({ test: 'haemoglobin', since: c?.at.slice(0, 10) ?? f.asOf, consequence: `${sx.includes('pallor') ? 'Pale palms or eyelids' : 'Breathless'} with no recent Hb: severe anaemia cannot be ruled out. Refer for an Hb test today.`, action: 'refer_for_test' });
  }
  // Malaria test unknown with fever (mother).
  const temp = latestVital(f, 'temperatureC');
  const febrile = sx.includes('fever') || (temp && isRecent(f, temp, 2) && (temp.temperatureC ?? 0) >= 38);
  if (febrile) {
    const rdt = latestLab(f, 'malaria_rdt');
    if (!rdt || !isRecent(f, rdt, 3)) out.push({ test: 'malaria_rdt', since: conFor('malaria_rdt')?.at.slice(0, 10) ?? f.asOf, consequence: 'Fever with no malaria test: malaria cannot be ruled out. Test today, or refer for the test today.', action: 'refer_for_test' });
  }
  // Malaria test unknown with fever (each child).
  for (const ch of f.under1000) {
    const bf = ofKind(f, 'symptom').some((e) => isRecent(f, e, 7) && e.symptoms.includes('baby_fever') && (e.childId ? e.childId === ch.id : f.children[f.children.length - 1]?.id === ch.id));
    const ct = latestVital(f, 'temperatureC', ch.id);
    const hot = bf || (ct && isRecent(f, ct, 2) && (ct.temperatureC ?? 0) >= 37.5);
    if (!hot || daysBetween(ch.dob, f.asOf) < 60) continue; // under 2 months: fever is already an emergency referral
    const rdt = [...ofKind(f, 'lab')].reverse().find((l) => l.test === 'malaria_rdt' && l.childId === ch.id);
    if (!rdt || !isRecent(f, rdt, 3)) out.push({ test: 'malaria_rdt', since: f.asOf, consequence: `${ch.name.split(' ')[0]} has fever with no malaria test. Test today, or refer for the test today.`, action: 'refer_for_test', childId: ch.id });
  }
  // Any other test that a constraint left without a result: test at the next visit.
  for (const c of cons) {
    const t = testOf(c.itemId)!;
    if (out.some((u) => u.test === t && u.childId === c.childId)) continue;
    const why = c.reason === 'declined' ? 'declined' : c.temporary ? 'not done today' : c.reason === 'cannot_afford' ? 'she could not afford it' : 'not available';
    out.push({ test: t, since: c.at.slice(0, 10), consequence: `${TEST_LABEL[t] ?? t} not done (${why}). The result is unknown, not normal: do it at the next visit${c.reason === 'not_available' ? ' or refer to a facility that has it' : ''}.`, action: 'test_next_visit', childId: c.childId });
  }
  return out;
}

/** Urgent alerts for unknown results that could hide danger. Never filtered by overrides. */
export function unknownAlerts(f: Facts, unknowns: UnknownResult[]): AlertWithShort[] {
  const place = COUNTRY_RULES[f.mother.country].sameDayFacility;
  return unknowns
    .filter((u) => u.action === 'refer_for_test')
    .map((u) => ({
      alert: {
        id: `alert.untested.${u.test}${u.childId ? `@${u.childId}` : ''}`,
        level: 'urgent' as const,
        title: `Not tested: ${TEST_LABEL[u.test as LabTest] ?? u.test}`,
        action: `Refer for this test today (${place}). ${u.consequence}`,
        reason: u.consequence,
        sources: cite(u.test === 'urine_protein' ? 'who-pe-2011' : u.test === 'haemoglobin' ? 'who-anc-2016-b11' : 'who-malaria-first-trimester-2022'),
        subject: u.childId ? ('child' as const) : ('mother' as const),
        motherTextKey: 'untested.refer',
        motherTextParams: { place },
        ...(u.childId ? { childId: u.childId } : {}),
      },
      short: 'refer for the test today',
      finding: `no ${TEST_LABEL[u.test as LabTest]?.toLowerCase() ?? u.test} result`,
    }));
}

/** Severe or serious side effects: stop and refer the same day; emergencies go now. */
export function sideEffectAlerts(f: Facts): AlertWithShort[] {
  const out: AlertWithShort[] = [];
  const hospital = COUNTRY_RULES[f.mother.country].referralHospital;
  for (const c of activeConstraints(f)) {
    if (c.reason !== 'side_effects' || !c.sideEffect || daysBetween(c.at, f.asOf) > 7) continue;
    const spec = SIDE_EFFECTS[sideEffectGroup(c.itemId)];
    const syms = spec.symptoms.filter((s) => c.sideEffect!.symptoms.includes(s.code));
    const serious = syms.filter((s) => s.serious);
    if (c.sideEffect.severity !== 'severe' && !serious.length) continue;
    const emergency = syms.some((s) => s.emergency);
    const list = (syms.length ? syms.map((s) => s.label.toLowerCase()) : c.sideEffect.symptoms).join(', ');
    const report = spec.reportable ? ` ${ADVERSE_EVENT_REPORTING[f.mother.country] ?? ADVERSE_EVENT_REPORTING.default}` : '';
    out.push({
      alert: {
        id: `alert.side_effect.${c.itemId.replace(/@.*$/, '')}${c.childId ? `@${c.childId}` : ''}`,
        level: emergency ? 'emergency' : 'urgent',
        title: `Serious reaction to ${spec.label.toLowerCase()}`,
        action: `${emergency ? `Emergency referral to ${hospital} now.` : `Stop ${spec.label.toLowerCase()} and refer the same day.`} ${spec.severe}${report}`,
        reason: `Recorded ${shortDate(c.at)}: ${list} (${c.sideEffect.severity}).`,
        sources: cite(...spec.sources),
        subject: c.childId ? 'child' : 'mother',
        motherTextKey: emergency ? 'se.vaccine.severe' : spec.keys.severe,
        ...(c.childId ? { childId: c.childId } : {}),
      },
      short: emergency ? `refer to ${hospital} now` : 'stop and refer today',
      finding: `reaction to ${spec.label.toLowerCase()}`,
    });
  }
  return out;
}

const DECLINED_POINTS: Record<DeclinedReason, string> = {
  fear_of_side_effects: 'Name the common side effects honestly and how to manage them; most are mild and pass. Agree she can stop and come back if one troubles her.',
  cost: 'Tell her where it is free (public facility programmes) and what it costs elsewhere; help with transport money if a fund exists.',
  religious_or_cultural: 'Ask what matters to her and her family; look for an acceptable form or timing; offer to talk with a faith or community leader she trusts.',
  partner_or_family_objects: 'Offer a joint conversation with her partner or the elder who objects, with her consent; explain what it protects against.',
  does_not_see_need: 'Explain in plain words what it protects her and the baby from, with a local example; leave the door open.',
  distance_or_time: 'Look for a nearer place, outreach day or home visit; combine it with another visit.',
  prefers_traditional_remedy: 'Ask what she takes; many remedies can be used alongside. Discourage only what the library marks as harmful.',
  other: 'Ask about her concern and record it; answer what you can.',
};

const SAFETY_CRITICAL = /^(med\.(iron|folic|art|aspirin|iptp)|test\.(hiv|syphilis|haemoglobin|urine_protein|malaria)|imm\.|d\.vaccine|birth\.facility|visit\.pnc|test\.infant_hiv|refer\.)/;

/**
 * Add alternatives to items with a constraint, and items that answer the constraint.
 * Called after the guideline rules and before overrides.
 */
export function constraintRules(c: RuleCtx): void {
  const { f } = c;
  const cons = activeConstraints(f);
  if (!cons.length) return;
  const country = f.mother.country;
  const rules = COUNTRY_RULES[country];
  for (const k of cons) {
    const target = c.items.find((i) => i.id === k.itemId || (k.childId && i.id === `${k.itemId}@${k.childId}`));
    if (target) target.constraint = { reason: k.reason, at: k.at.slice(0, 10) };
    const base = k.itemId.replace(/@.*$/, '');
    const iron = /^med\.(iron|ifa)|^d\.ifa/.test(base);
    const title = target?.title ?? labelFor(base);
    const because = [`${reasonText(k.reason)} (${shortDate(k.at)})${k.note ? `: ${k.note}` : ''}`];
    const add = (id: string, input: Omit<PlanItem, 'id' | 'status' | 'origin' | 'because' | 'motherText' | 'motherTextKey' | 'motherTextParams'> & { key: string; params?: Record<string, string | number> }) => {
      if (c.items.some((i) => i.id === id)) return;
      const { key, params, ...rest } = input;
      const it: PlanItem = { id, ...rest, ...motherTextFor(false, key, params), status: 'active', origin: 'guideline', because, childId: k.childId };
      it.howTo = it.howTo ?? howToFor(id, it.category);
      c.items.push(it);
      if (target) {
        target.alternatives = [...(target.alternatives ?? []), { reason: k.reason, item: { title: it.title, detail: it.detail, motherText: it.motherText, motherTextKey: it.motherTextKey, motherTextParams: it.motherTextParams, howTo: it.howTo } }];
      }
    };

    switch (k.reason) {
      case 'cannot_afford':
      case 'not_available': {
        if (iron) {
          const iFoods = pickFoods(c, 'iron', 3);
          const vitC = pickFoods(c, 'vitamin_c', 1)[0];
          const food1 = iFoods[0]?.serving ?? 'one egg';
          const food2 = iFoods[1]?.serving ?? 'two handfuls of cooked green leaves';
          const fruit = vitC?.serving ?? 'an orange';
          if (k.reason === 'cannot_afford') {
            add(`alt.${base}.free`, {
              category: 'medication',
              title: 'Get iron and folic acid free',
              detail: `${country === 'NG' ? 'Iron-folate is free at public PHCs; BHCPF-accredited PHCs cover ANC at no cost. If unsure whether hers is accredited, ask at the PHC.' : FREE_PROGRAMMES[country]} Give a month's supply at this contact if in stock.`,
              key: 'alt.iron.free',
              priority: 2,
              evidence: 'A',
              sources: cite('who-anc-2016-a21', ...(country === 'NG' ? ['ng-bhcpf-2020'] : [])),
              audience: 'both',
              illustration: 'iron_tablet',
            });
          } else {
            add(`alt.${base}.not_available`, {
              category: 'medication',
              title: 'Iron and folic acid out of stock: another source',
              detail: `Out of stock here. Refer to ${rules.sameDayFacility} or the nearest public facility with stock this week; report the stock-out. Do not leave her without iron for long in pregnancy.`,
              key: 'alt.iron.not_available',
              priority: 2,
              evidence: 'A',
              sources: cite('who-anc-2016-a21'),
              audience: 'both',
              illustration: 'iron_tablet',
            });
          }
          add(`alt.${base}.food`, {
            category: 'nutrition',
            title: 'Iron-rich food plan (alongside the tablet, not instead)',
            detail: `Food cannot replace iron and folic acid in pregnancy (WHO A.2.1): diet alone does not meet pregnancy iron needs. Daily, from local foods${c.location?.region ? ` in ${c.location.region}` : ''}: ${iFoods.map((x) => x.serving).join('; ')}, with ${fruit} at the same meal for vitamin C. No tea or coffee with meals.`,
            key: 'alt.iron.food',
            params: { food1, food2, fruit },
            priority: 2,
            evidence: 'B',
            sources: cite('who-anc-2016-a21', 'who-anc-nutrition-2018'),
            audience: 'both',
            illustration: 'iron_foods',
          });
          add('test.hb_recheck_early', {
            category: 'tests',
            title: 'Recheck Hb in 4 weeks',
            detail: `Without a steady iron supply, check Hb earlier: in 4 weeks (${shortDate(addDays(f.asOf, 28))}) rather than at the next scheduled test. Treat or refer if below 11 g/dL in pregnancy (below 7: refer today).`,
            key: 'alt.hb_recheck',
            priority: 2,
            dueDate: addDays(f.asOf, 28),
            evidence: 'B',
            sources: cite('who-anc-2016-b11'),
            audience: 'both',
            illustration: 'test_tube',
          });
        } else if (testOf(base)) {
          add(`alt.${base}.${k.reason}`, {
            category: 'tests',
            title: `${TEST_LABEL[testOf(base)!] ?? title}: ${k.reason === 'cannot_afford' ? 'find a free test' : 'test elsewhere'}`,
            detail: `${k.reason === 'cannot_afford' ? `${FREE_PROGRAMMES[country]} ` : ''}Refer to ${rules.sameDayFacility} for the test. The result is unknown until then; it is not normal.`,
            key: 'alt.test.not_available',
            priority: 3,
            evidence: 'C',
            sources: cite('who-anc-2016'),
            audience: 'both',
            illustration: 'test_tube',
          });
        } else if (/^imm\.|^d\.vaccine/.test(base)) {
          add(`alt.${base}.${k.reason}`, {
            category: 'immunisation',
            title: `${title}: vaccine not given today`,
            detail: `Vaccines are free under the national programme. Book the next outreach or fixed-session day; doses given late still count and the series does not restart. ${k.reason === 'not_available' ? 'Report the stock-out to the LGA or sub-county immunisation officer.' : ''}`,
            key: 'alt.vaccine.not_available',
            priority: 2,
            evidence: 'A',
            sources: cite('who-pnc-2022-rec34'),
            audience: 'both',
            illustration: 'vaccination',
          });
        } else {
          add(`alt.${base}.${k.reason}`, {
            category: target?.category ?? 'education',
            title: `${title}: ${k.reason === 'cannot_afford' ? 'free or cheaper option' : 'another source'}`,
            detail: `${k.reason === 'cannot_afford' ? FREE_PROGRAMMES[country] : `Not available here: refer to ${rules.sameDayFacility}.`}`,
            key: k.reason === 'cannot_afford' ? 'alt.cannot_afford' : 'alt.not_available',
            priority: 3,
            evidence: 'C',
            sources: target?.sources ?? [],
            audience: 'both',
          });
        }
        break;
      }
      case 'side_effects': {
        const spec = SIDE_EFFECTS[sideEffectGroup(base)];
        const sev = k.sideEffect?.severity ?? 'mild';
        const serious = spec.symptoms.some((s) => s.serious && k.sideEffect?.symptoms.includes(s.code));
        const level = serious || sev === 'severe' ? 'severe' : sev;
        const harmless = spec.symptoms.filter((s) => s.harmless && k.sideEffect?.symptoms.includes(s.code));
        add(`alt.${base}.side_effects`, {
          category: target?.category ?? 'medication',
          title: level === 'severe' ? `Stop ${spec.label.toLowerCase()} and refer today` : level === 'moderate' ? `Side effects of ${spec.label.toLowerCase()}: adjust and review` : `Side effects of ${spec.label.toLowerCase()}: tips, keep going`,
          detail: `${level === 'severe' ? spec.severe : level === 'moderate' ? `${spec.mild} ${spec.moderate}` : spec.mild}${harmless.length ? ` ${harmless.map((h) => h.label).join('; ')}: tell her this is expected and harmless.` : ''}${spec.reportable && level === 'severe' ? ` ${ADVERSE_EVENT_REPORTING[country]}` : ''}`,
          key: spec.keys[level],
          priority: level === 'severe' ? 1 : 2,
          evidence: 'A',
          sources: cite(...spec.sources),
          audience: 'both',
          locked: level === 'severe' || undefined,
          illustration: 'medicine',
        });
        break;
      }
      case 'declined': {
        const why = k.declinedReason ?? 'other';
        const critical = SAFETY_CRITICAL.test(base);
        add(`alt.${base}.declined`, {
          category: target?.category ?? 'education',
          title: `${title}: she declined (${why.replace(/_/g, ' ')})`,
          detail: `Her decision is recorded and respected. ${DECLINED_POINTS[why]} Offer again at the next contact.${critical ? ' This item protects against serious harm: keep teaching the danger signs and follow the guideline for escalation if a danger sign appears.' : ''}`,
          key: `declined.${why}`,
          priority: critical ? 2 : 3,
          evidence: 'C',
          sources: target?.sources ?? cite('who-anc-2016'),
          audience: 'both',
          illustration: 'talk_to_someone',
        });
        if (critical) {
          add(`alt.${base}.declined_danger`, {
            category: 'danger_signs',
            title: 'Danger signs still apply',
            detail: 'Without this protection, make sure she and a family member know the danger signs and where to go at night.',
            key: 'declined.danger',
            priority: 2,
            evidence: 'A',
            sources: cite('who-smart-anc-danger'),
            audience: 'both',
            illustration: 'clinic_visit',
          });
        }
        break;
      }
      case 'forgets':
        add(`alt.${base}.forgets`, {
          category: target?.category ?? 'medication',
          title: `${title}: reminders`,
          detail: 'Link the dose to a daily habit (evening meal, prayer time), keep it where she sees it, ask a family member to remind her; offer SMS reminders if she has a phone.',
          key: 'alt.forgets',
          priority: 3,
          evidence: 'C',
          sources: target?.sources ?? [],
          audience: 'both',
          illustration: 'calendar',
        });
        break;
      case 'no_transport':
        add(`alt.${base}.no_transport`, {
          category: 'birth_preparedness',
          title: 'Transport plan',
          detail: `Agree transport before it is needed: a family member or community driver, money saved weekly, and the number to call. ${country === 'NG' ? 'Ask whether her LGA has NEMSAS or MAMII emergency transport.' : country === 'KE' ? 'Ask about county ambulance or community transport schemes.' : 'Ask about the National Ambulance Service (dial 112) and community transport.'}`,
          key: 'alt.no_transport',
          priority: 2,
          evidence: 'C',
          sources: cite('who-anc-2016'),
          audience: 'both',
          illustration: 'phone_call',
        });
        break;
    }
  }
}

/** Plan items for unknown results ("Not tested: ..."). */
export function unknownItems(c: RuleCtx, unknowns: UnknownResult[]): void {
  const place = COUNTRY_RULES[c.f.mother.country].sameDayFacility;
  for (const u of unknowns) {
    const id = `untested.${u.test}${u.childId ? `@${u.childId}` : ''}`;
    if (c.items.some((i) => i.id === id)) continue;
    const refer = u.action === 'refer_for_test';
    const it: PlanItem = {
      id,
      category: 'tests',
      title: `Not tested: ${TEST_LABEL[u.test as LabTest] ?? u.test}`,
      detail: u.consequence,
      ...motherTextFor(false, refer ? 'untested.refer' : 'untested.next', refer ? { place } : undefined),
      priority: refer ? 1 : 3,
      audience: 'both',
      dueDate: c.f.asOf,
      evidence: 'A',
      sources: [],
      because: [`No result since ${shortDate(u.since)}`],
      locked: refer || undefined,
      origin: 'guideline',
      illustration: 'test_tube',
      status: 'active',
      childId: u.childId,
    };
    it.howTo = howToFor('untested.', 'tests');
    c.items.push(it);
  }
}

function reasonText(r: ConstraintReason): string {
  return { cannot_afford: 'Cannot afford', not_available: 'Not available', side_effects: 'Side effects', declined: 'Declined', forgets: 'Forgets', no_transport: 'No transport' }[r];
}

function labelFor(id: string): string {
  const t = testOf(id);
  if (t) return TEST_LABEL[t] ?? t;
  return id.replace(/^[a-z]+\./, '').replace(/[._]/g, ' ');
}

export { renderPlanText };
export type { Alert };
