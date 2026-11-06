import type { Child, Risk } from '../types';
import { cite } from '../clinical';
import { daysBetween } from './dates';
import { type Facts, ageDays, growthFor, hasCondition, isYoungest, labNumber, labPositive, latestBp, latestEpds, latestLab } from './facts';

/**
 * Risk factors that change the plan. Each carries a plain-English reason from her record.
 * Pre-eclampsia "high risk" follows WHO 2021 / USPSTF-ACOG-NICE criteria (any one of: previous
 * pre-eclampsia, chronic hypertension, pre-existing diabetes, multiple pregnancy) or two or more
 * moderate factors (first birth, age ≥35, BMI >30). The notes flag the WHO list as needing primary
 * confirmation; criteria are shared by all major guidelines.
 */
export function computeRisks(f: Facts): Risk[] {
  const m = f.mother;
  const risks: Risk[] = [];
  const add = (code: string, label: string, severity: Risk['severity'], reason: string, sourceIds: string[]) =>
    risks.push({ code, label, severity, reason, sources: cite(...sourceIds) });

  // ---- Pre-eclampsia risk ----
  const high: string[] = [];
  if (hasCondition(f, 'pre_eclampsia_history')) high.push('previous pre-eclampsia');
  if (hasCondition(f, 'chronic_hypertension')) high.push('chronic high blood pressure');
  if (hasCondition(f, 'diabetes_preexisting')) high.push('diabetes before pregnancy');
  if (f.pregnant && (m.pregnancy?.fetuses ?? 1) > 1) high.push('twins or more');
  const moderate: string[] = [];
  if (f.pregnant && m.parity === 0) moderate.push('first birth');
  if (m.age >= 35) moderate.push(`age ${m.age}`);
  if ((f.bmi ?? 0) > 30 || hasCondition(f, 'obesity')) moderate.push(f.bmi ? `BMI ${f.bmi}` : 'obesity');
  if (f.pregnant && (high.length > 0 || moderate.length >= 2)) {
    add(
      'pre_eclampsia_high_risk',
      'High risk of pre-eclampsia',
      'high',
      high.length > 0 ? `${cap(high.join(', '))}.` : `Two or more moderate risk factors: ${moderate.join(', ')}.`,
      ['who-aspirin-2021', 'perinatology-pe-criteria'],
    );
  }

  // ---- Current BP ----
  const bp = latestBp(f);
  if (bp && ageDays(f, bp) <= 14 && (bp.systolic! >= 140 || bp.diastolic! >= 90)) {
    const severe = bp.systolic! >= 160 || bp.diastolic! >= 110;
    add('hypertension_current', severe ? 'Severe hypertension' : 'Raised blood pressure', severe ? 'urgent' : 'high', `BP ${bp.systolic}/${bp.diastolic} recorded ${ageDays(f, bp) === 0 ? 'today' : `${ageDays(f, bp)} days ago`}.`, ['who-pe-2011']);
  }

  // ---- Age and parity ----
  if (m.age < 18) add('adolescent', 'Adolescent mother', 'moderate', `Age ${m.age}: higher risk of pre-eclampsia, anaemia, preterm birth and depression; needs youth-friendly care.`, ['who-smart-anc-dak']);
  if (m.age >= 35) add('advanced_maternal_age', 'Mother aged 35 or over', 'moderate', `Age ${m.age}.`, ['perinatology-pe-criteria']);
  if (m.parity >= 5) add('grand_multipara', 'Grand multipara (5+ births)', 'high', `${m.parity} previous births: higher risk of bleeding after birth; plan facility birth.`, ['who-anc-2016']);

  // ---- Obstetric history ----
  if (m.previousCaesarean) add('previous_caesarean', 'Previous caesarean', 'high', 'Scar on the womb: must give birth in a facility that can do caesareans.', ['who-anc-2016']);
  if (m.previousPPH) add('previous_pph', 'Previous heavy bleeding after birth', 'high', 'PPH in a past birth: higher risk again; facility birth and a blood donor needed.', ['who-anc-2016']);
  if (m.previousStillbirth) add('previous_stillbirth', 'Previous stillbirth', 'high', 'Past stillbirth: closer monitoring of fetal growth and movements.', ['who-anc-2016-b21']);
  if (f.pregnant && (m.pregnancy?.fetuses ?? 1) > 1) add('multiple_pregnancy', 'Twin pregnancy', 'high', `${m.pregnancy!.fetuses} babies: higher risk of anaemia, pre-eclampsia, preterm birth and bleeding.`, ['who-anc-2016-b24']);

  // ---- Medical conditions ----
  if (hasCondition(f, 'sickle_cell_disease') || m.genotype === 'SS' || m.genotype === 'SC') {
    add('sickle_cell_disease', 'Sickle cell disease', f.pregnant ? 'urgent' : 'high', `Genotype ${m.genotype}: 4–11× higher maternal death risk in pregnancy; needs specialist care.`, ['who-scd-2025', 'who-scd-2025-summary']);
  }
  const hivLab = latestLab(f, 'hiv');
  if (hasCondition(f, 'hiv') || labPositive(hivLab)) add('hiv', 'Living with HIV', 'high', 'HIV: lifelong ART, viral load monitoring and infant prophylaxis and testing to prevent transmission.', ['who-hiv-2021', 'who-anc-2016-b17']);
  if (hasCondition(f, 'hepatitis_b') || labPositive(latestLab(f, 'hepatitis_b'))) add('hepatitis_b', 'Hepatitis B', 'high', 'Baby needs hepatitis B vaccine within 24 hours of birth.', ['ng-nphcda-immunisation']);
  if (labPositive(latestLab(f, 'syphilis'))) add('syphilis', 'Syphilis positive', 'high', 'Positive syphilis test: treat her and her partner; baby needs assessment at birth.', ['who-anc-2016-b17']);
  if (hasCondition(f, 'chronic_hypertension')) add('chronic_hypertension', 'Chronic hypertension', 'high', 'High blood pressure before pregnancy.', ['who-pe-2011']);
  if (hasCondition(f, 'diabetes_preexisting')) add('diabetes', 'Diabetes', 'high', 'Diabetes before pregnancy: needs doctor-led care.', ['who-anc-2016-b14']);
  const ogtt = labNumber(latestLab(f, 'ogtt_2h'));
  const fpg = labNumber(latestLab(f, 'blood_glucose_fasting'));
  // IADPSG/WHO 2013: fasting ≥5.1 or 2 h ≥8.5 mmol/L.
  if (hasCondition(f, 'gestational_diabetes') || (ogtt !== undefined && ogtt >= 8.5) || (fpg !== undefined && fpg >= 5.1)) {
    add('gdm', 'Gestational diabetes', 'high', ogtt !== undefined && ogtt >= 8.5 ? `2-hour OGTT ${ogtt} mmol/L (≥8.5).` : fpg !== undefined && fpg >= 5.1 ? `Fasting glucose ${fpg} mmol/L (≥5.1).` : 'Diagnosed gestational diabetes.', ['iadpsg-gdm', 'who-anc-2016-b14']);
  }
  if (hasCondition(f, 'epilepsy')) add('epilepsy', 'Epilepsy', 'high', 'Needs doctor review of medicines and folic acid; fits in pregnancy need urgent care.', ['who-anc-2016']);
  if (hasCondition(f, 'asthma')) add('asthma', 'Asthma', 'moderate', 'Keep using inhalers; worse asthma needs review.', ['who-anc-2016']);
  if (hasCondition(f, 'thyroid_disorder')) add('thyroid', 'Thyroid disorder', 'moderate', 'Needs doctor review of thyroid medicine dose.', ['who-anc-2016']);
  if (hasCondition(f, 'depression_history')) add('depression_history', 'History of depression', 'moderate', 'Prior depression is the strongest predictor of postpartum depression in Nigerian data.', ['ppd-ilorin-2026']);

  // ---- Anaemia ----
  const hbLab = latestLab(f, 'haemoglobin');
  const hb = labNumber(hbLab);
  if (hb !== undefined && ageDays(f, hbLab!) <= 120) {
    if (hb < 7) add('severe_anaemia', 'Severe anaemia', 'urgent', `Hb ${hb} g/dL.`, ['who-anc-2016-b11']);
    else if (hb < 10) add('moderate_anaemia', 'Moderate anaemia', 'high', `Hb ${hb} g/dL.`, ['who-anc-2016-b11']);
    else if (hb < 11) add('mild_anaemia', 'Mild anaemia', 'moderate', `Hb ${hb} g/dL (below 11 in pregnancy).`, ['who-anc-2016-b11']);
  } else if (hasCondition(f, 'anaemia')) {
    add('anaemia', 'Anaemia', 'moderate', 'Anaemia on record; no recent Hb.', ['who-anc-2016-b11']);
  }

  // ---- Malaria ----
  const rdt = latestLab(f, 'malaria_rdt');
  if (hasCondition(f, 'malaria_current') || (rdt && labPositive(rdt) && ageDays(f, rdt) <= 28)) {
    add('malaria', 'Malaria', 'high', 'Current or recent malaria: treat and protect with IPTp and a treated net.', ['who-anc-2016-c6', 'ng-mip-2018']);
  }

  // ---- Nutrition ----
  if (f.bmi !== undefined && f.bmi < 18.5) add('underweight', 'Underweight', 'moderate', `BMI ${f.bmi} (below 18.5): energy and protein support; underweight was the strongest PPCM risk factor in PEACE.`, ['who-anc-2016-a13', 'peace-2020']);
  else if (hasCondition(f, 'underweight')) add('underweight', 'Underweight', 'moderate', 'Underweight on record.', ['who-anc-2016-a13']);
  if (f.bmi !== undefined && f.bmi >= 30) add('obesity', 'Obesity', 'moderate', `BMI ${f.bmi}: screen for gestational diabetes; higher pre-eclampsia risk.`, ['perinatology-pe-criteria']);
  const muac = [...f.events].reverse().find((e) => e.kind === 'vitals' && !e.childId && e.muacCm !== undefined);
  if (muac && muac.kind === 'vitals' && muac.muacCm! < 23) add('low_muac', 'Low arm circumference', 'moderate', `MUAC ${muac.muacCm} cm (below 23 cm): at risk of undernutrition.`, ['who-anc-2016-a13']);

  // ---- Mental health ----
  const epds = latestEpds(f);
  if (epds && ageDays(f, epds) <= 90 && (epds.score >= 10 || epds.selfHarmFlag)) {
    add('perinatal_depression', 'Perinatal depression risk', epds.selfHarmFlag || epds.score >= 13 ? 'urgent' : 'high', `EPDS ${epds.score}${epds.selfHarmFlag ? ' with self-harm thoughts' : ''}.`, ['epds-nigeria-adewuya', 'who-pnc-2022-rec18']);
  }

  // ---- Birth complications (postpartum) ----
  if (f.lastBirth && f.daysSinceBirth !== undefined && f.daysSinceBirth <= 42) {
    const c = f.lastBirth.complications.filter((x) => x !== 'none');
    if (c.includes('pph') || (f.lastBirth.bloodLossMl ?? 0) >= 500) add('pph_this_birth', 'Bled heavily at this birth', 'high', `${f.lastBirth.bloodLossMl ? `${f.lastBirth.bloodLossMl} mL blood loss` : 'PPH'} at birth: check Hb and give iron.`, ['who-pnc-2022-rec20']);
    if (c.includes('pre_eclampsia') || c.includes('eclampsia')) add('postpartum_pre_eclampsia', 'Pre-eclampsia at this birth', 'high', 'BP can rise again in the first week after birth; check BP at every postnatal contact.', ['who-pe-2011', 'who-pnc-2022-rec1']);
    if (c.includes('sepsis')) add('postpartum_sepsis', 'Infection at this birth', 'high', 'Watch for fever and foul discharge.', ['who-pnc-2022-rec1']);
    if (f.lastBirth.mode === 'caesarean') add('caesarean_recovery', 'Recovering from caesarean', 'moderate', 'Wound care, pain relief and watch for infection and clots.', ['who-pnc-2022-rec1']);
    if (f.lastBirth.place !== 'facility') add('non_facility_birth', 'Birth outside a facility', 'moderate', `Born ${f.lastBirth.place === 'in_transit' ? 'on the way' : f.lastBirth.place === 'tba' ? 'with a TBA' : 'at home'}: first postnatal check, vitamin K and birth vaccines may be missing.`, ['who-pnc-2022-rec44']);
  }

  // ---- Baby: every child under 1,000 days (the youngest keeps the original codes) ----
  for (const child of f.under1000) {
    risks.push(...childRisks(f, child));
  }

  // ---- Several children: short birth interval ----
  // WHO: wait at least 24 months from a birth before the next pregnancy; conception under 18 months
  // after a birth raises the risk of preterm birth, low birth weight and small-for-age babies (Conde-Agudelo 2006).
  if (f.pregnant && f.interpregnancyDays !== undefined && f.interpregnancyDays >= 0) {
    const months = Math.floor(f.interpregnancyDays / 30.4);
    if (f.interpregnancyDays < 18 * 30.4) {
      add('short_birth_interval', 'Short birth interval', months < 6 ? 'high' : 'moderate', `Conceived ${months} months after her last birth (under 18 months): higher risk of preterm birth, low birth weight and anaemia. WHO advises waiting at least 24 months.`, ['who-birth-spacing-2005', 'conde-agudelo-2006']);
    } else if (f.interpregnancyDays < 24 * 30.4) {
      add('birth_interval_under_24m', 'Birth interval under 2 years', 'low', `Conceived ${months} months after her last birth (WHO advises at least 24 months).`, ['who-birth-spacing-2005']);
    }
  }
  if (f.concurrent) {
    add('pregnant_with_young_child', 'Pregnant while caring for a child under 2', 'moderate', `Caring for ${f.under1000.map((c) => c.name.split(' ')[0]).join(' and ')} while pregnant: extra food, iron and help at home.`, ['who-birth-spacing-2005', 'lopez-fernandez-2017']);
  }
  if (f.under1000.length >= 2 && new Set(f.under1000.map((c) => c.dob.slice(0, 10))).size >= 2 && !f.pregnant) {
    add('two_young_children', 'Two children under 1,000 days', 'moderate', `${f.under1000.map((c) => c.name.split(' ')[0]).join(' and ')} are both under 1,000 days: two feeding, vaccine and growth schedules.`, ['who-birth-spacing-2005']);
  }

  // ---- Social ----
  if (m.incomeBand === 'very_low') add('financial_hardship', 'Very low income', 'moderate', 'Cost may stop her reaching care: plan transport money and free services.', ['ng-bhcpf-2020']);

  const order = { urgent: 0, high: 1, moderate: 2, low: 3 } as const;
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Simple growth faltering check without growth-standard tables:
 * no weight gain (or loss) between the last two weights ≥14 days apart,
 * or under birth weight after 14 days. Flag for full WHO chart assessment.
 */
function poorGrowth(child: { dob: string; birthWeightKg: number }, weights: Array<{ at: string; kg: number }>): string | undefined {
  if (weights.length === 0) return undefined;
  const last = weights[weights.length - 1];
  const ageAtLast = Math.round((Date.parse(last.at.slice(0, 10)) - Date.parse(child.dob.slice(0, 10))) / 86_400_000);
  if (ageAtLast >= 14 && last.kg < child.birthWeightKg) return `Weighs ${last.kg} kg at ${ageAtLast} days, below birth weight (${child.birthWeightKg} kg).`;
  for (let i = weights.length - 2; i >= 0; i--) {
    const gap = Math.round((Date.parse(last.at.slice(0, 10)) - Date.parse(weights[i].at.slice(0, 10))) / 86_400_000);
    if (gap >= 14) {
      if (last.kg <= weights[i].kg) return `No weight gain over ${gap} days (${weights[i].kg} → ${last.kg} kg).`;
      return undefined;
    }
  }
  return undefined;
}

/** Risks for one child under 1,000 days. The youngest keeps the original codes; a sibling's carry '@childId'. */
export function childRisks(f: Facts, child: Child): Risk[] {
  const out: Risk[] = [];
  const suffix = isYoungest(f, child) ? '' : `@${child.id}`;
  const add = (code: string, label: string, severity: Risk['severity'], reason: string, sourceIds: string[]) =>
    out.push({ code: `${code}${suffix}`, label, severity, reason, sources: cite(...sourceIds) });
  const age = daysBetween(child.dob, f.asOf);
  // Birth weight and gestation matter most early; after the first year they stop driving the plan.
  if (child.birthWeightKg > 0 && child.birthWeightKg < 2.5 && (age <= 365 || !suffix)) add('low_birth_weight', `Low birth weight (${child.name})`, child.birthWeightKg < 1.5 ? 'urgent' : 'high', `${child.birthWeightKg} kg at birth: kangaroo care, frequent breastfeeding, extra growth checks.`, ['who-kmc-2022']);
  if (child.gestationAtBirthWeeks < 37 && (age <= 365 || !suffix)) add('preterm', `Born preterm (${child.name})`, child.gestationAtBirthWeeks < 32 ? 'urgent' : 'high', `Born at ${child.gestationAtBirthWeeks} weeks.`, ['who-kmc-2022']);
  const g = growthFor(f, child).filter((x) => x.weightKg !== undefined);
  const poor = poorGrowth(child, g.map((x) => ({ at: x.at, kg: x.weightKg! })));
  if (poor) add('poor_growth', `Poor growth (${child.name})`, 'high', poor, ['who-sam-2009', 'who-cf-2023']);
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
