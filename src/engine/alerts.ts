import type { Alert, SymptomCode } from '../types';
import { cite, COUNTRY_RULES } from '../clinical';
import { daysBetween, shortDate } from './dates';
import { facilityById } from '../data/directory';
import { referralWhen } from '../visits/text';
import { computeUnknowns, sideEffectAlerts, unknownAlerts } from './constraints';
import {
  type Facts,
  ageDays,
  hasCondition,
  isRecent,
  labNumber,
  labPositive,
  latestBp,
  latestEpds,
  latestLab,
  latestVital,
  ofKind,
  recentSymptoms,
  symptomSeverity,
  babySymptomsFor,
  growthFor,
  isYoungest,
} from './facts';

/**
 * Hard-coded, deterministic danger-sign layer.
 * These alerts are computed from the record alone. Overrides, learned rules and the AI
 * layer never see or change this function's output: buildPlan adds them last, unfiltered.
 *
 * Action text follows NPHCDA Standing Orders practice as reported (CHEWs refer hypertension
 * and pre-eclampsia; antihypertensives and MgSO4 are facility tasks). Where scope is unclear
 * the action is "refer", never "give".
 */

export interface AlertWithShort {
  alert: Alert;
  /** Very short form for the plan summary, e.g. 'refer to General Hospital today' */
  short: string;
  /** Short finding for the summary, e.g. 'BP 168/112 with headache' */
  finding: string;
}

const RECENT_DAYS = 7;

export function computeAlerts(f: Facts): AlertWithShort[] {
  const out: AlertWithShort[] = [];
  const rules = COUNTRY_RULES[f.mother.country];
  const hospital = rules.referralHospital;
  const { mother: sx } = recentSymptoms(f, RECENT_DAYS);
  const has = (s: SymptomCode) => sx.includes(s);
  const pregnant = f.pregnant;
  const postpartum = !pregnant && f.daysSinceBirth !== undefined && f.daysSinceBirth >= 0 && f.daysSinceBirth <= 42;
  const perinatal = pregnant || postpartum;
  const add = (a: Alert, short: string, finding: string) => out.push({ alert: a, short, finding });

  // ---------- Hypertensive disorders ----------
  // Thresholds: hypertension ≥140/90; severe ≥160/110 (ISSHP / WHO usage; the research notes
  // flag that the WHO primary source was not retrieved, so the plan item carries a review note).
  const bp = latestBp(f);
  const bpRecent = bp && isRecent(f, bp, RECENT_DAYS) ? bp : undefined;
  const severeFeatures = (['severe_headache', 'blurred_vision', 'severe_abdominal_pain'] as SymptomCode[]).filter(has);
  const prot = latestLab(f, 'urine_protein');
  const protein = prot && isRecent(f, prot, RECENT_DAYS) ? labNumber(prot) ?? 0 : 0;
  const convulsing = has('convulsions');
  let bpAlertRaised = false;
  if (perinatal && bpRecent) {
    const s = bpRecent.systolic!;
    const d = bpRecent.diastolic!;
    const bpText = `${s}/${d}`;
    const when = ageDays(f, bpRecent) === 0 ? 'today' : `on ${shortDate(bpRecent.at)}`;
    const severeRange = s >= 160 || d >= 110;
    const raised = s >= 140 || d >= 90;
    const featureText = severeFeatures.map(symptomPhrase).join(', ');
    const sources = cite('who-pe-2011', 'who-smart-anc-danger', 'ng-standing-orders-2015', 'ng-clip-2016');
    const stabilise = `Lay her on her left side, keep her calm and accompanied, and arrange transport now. Do not give diazepam. Only a trained, authorised provider gives magnesium sulphate or BP medicine; if none is present, refer without delay.`;
    if (raised && convulsing) {
      bpAlertRaised = true;
      add(
        {
          id: 'alert.eclampsia',
          level: 'emergency',
          title: 'Eclampsia: fits with high blood pressure',
          action: `Emergency referral to ${hospital} now. Protect her from injury, turn her on her left side, keep the airway clear. ${stabilise}`,
          reason: `BP ${bpText} ${when} and fits reported.`,
          sources,
          subject: 'mother',
        },
        `emergency transfer to ${hospital} now`,
        `fits with BP ${bpText}`,
      );
    } else if (severeRange || (raised && (severeFeatures.length > 0 || protein >= 2))) {
      bpAlertRaised = true;
      const why = severeRange
        ? `BP ${bpText} ${when} is in the severe range (≥160/110)${featureText ? ` with ${featureText}` : ''}${protein >= 2 ? ` and protein ${protein}+ in urine` : ''}.`
        : `BP ${bpText} ${when} with ${[featureText, protein >= 2 ? `protein ${protein}+ in urine` : ''].filter(Boolean).join(' and ')}.`;
      const severeFeat = severeRange || severeFeatures.length > 0;
      add(
        {
          id: 'alert.severe_pre_eclampsia',
          level: severeFeat ? 'emergency' : 'urgent',
          title: severeFeat ? 'Severe pre-eclampsia signs' : 'Pre-eclampsia: high BP with protein in urine',
          action: severeFeat
            ? `Refer to ${hospital} now for assessment and treatment (BP control and magnesium sulphate). ${stabilise}`
            : `Refer to ${hospital} today for pre-eclampsia assessment (bloods, BP series, fetal check). Teach her to go immediately if headache, blurred vision, belly pain or fits start.`,
          reason: why,
          sources,
          subject: 'mother',
        },
        severeFeat ? `refer to ${hospital} now` : `refer to ${hospital} today`,
        `BP ${bpText}${featureText ? ` with ${featureText}` : ''}`,
      );
    } else if (raised) {
      bpAlertRaised = true;
      add(
        {
          id: 'alert.hypertension',
          level: 'urgent',
          title: pregnant ? 'Raised blood pressure in pregnancy' : 'Raised blood pressure after birth',
          action: `Same-day review: repeat BP after 15 minutes of rest and test urine for protein. If still ≥140/90, refer to ${rules.sameDayFacility} today. Teach the danger signs of pre-eclampsia.`,
          reason: `BP ${bpText} ${when}${pregnant && f.ga !== undefined ? ` at ${f.ga} weeks` : ''}.`,
          sources: cite('who-pe-2011', 'ng-standing-orders-2015'),
          subject: 'mother',
        },
        `repeat BP and refer to ${rules.sameDayFacility} today`,
        `raised BP (${bpText})`,
      );
    }
  }

  if (convulsing && !bpAlertRaised) {
    add(
      {
        id: 'alert.convulsions',
        level: 'emergency',
        title: perinatal ? 'Fits: treat as eclampsia until proven otherwise' : 'Fits (convulsions)',
        action: `Emergency referral to ${hospital} now. Protect from injury, left side, clear airway. Check BP if possible. Do not give diazepam; magnesium sulphate only by an authorised provider.`,
        reason: 'Fits reported in the last week.',
        sources: cite('who-smart-anc-danger', 'who-pe-2011', 'ng-clip-2016'),
        subject: 'mother',
      },
      `emergency transfer to ${hospital}`,
      'fits reported',
    );
  }

  // Headache or blurred vision without a recent BP reading: measure today.
  if (perinatal && !bpRecent && (has('severe_headache') || has('blurred_vision') || has('swelling_face_hands'))) {
    const what = (['severe_headache', 'blurred_vision', 'swelling_face_hands'] as SymptomCode[]).filter(has).map(symptomPhrase).join(', ');
    add(
      {
        id: 'alert.check_bp_now',
        level: 'urgent',
        title: 'Possible pre-eclampsia: measure BP today',
        action: `See her today: measure BP and test urine for protein. If BP ≥140/90 or no BP machine is available, refer to ${rules.sameDayFacility} today.`,
        reason: `${capitalise(what)} reported with no BP reading in the last week.`,
        sources: cite('who-smart-anc-danger', 'who-pe-2011'),
        subject: 'mother',
      },
      'measure BP today',
      what,
    );
  }

  // ---------- Bleeding ----------
  if (pregnant && has('vaginal_bleeding')) {
    add(
      {
        id: 'alert.vaginal_bleeding',
        level: 'emergency',
        title: 'Bleeding in pregnancy',
        action: `Emergency referral to ${hospital} now. Do not do a vaginal examination. Keep her lying down on her left side, bring a relative who can donate blood.`,
        reason: `Vaginal bleeding reported${f.ga !== undefined ? ` at ${f.ga} weeks` : ''}.`,
        sources: cite('who-smart-anc-danger'),
        subject: 'mother',
      },
      `emergency transfer to ${hospital}`,
      'vaginal bleeding',
    );
  }
  const pphNow = has('heavy_postpartum_bleeding') || (!pregnant && f.daysSinceBirth !== undefined && f.daysSinceBirth <= 42 && has('vaginal_bleeding') && symptomSeverity(f, 'vaginal_bleeding') === 'severe');
  if (pphNow) {
    add(
      {
        id: 'alert.postpartum_haemorrhage',
        level: 'emergency',
        title: 'Heavy bleeding after birth',
        action: `Emergency referral to ${hospital} now. Rub the womb firmly through the belly, empty the bladder, keep her warm and lying flat, and go with a blood donor. Give misoprostol only if you are trained and authorised under your standing orders.`,
        reason: `Heavy bleeding reported${f.daysSinceBirth !== undefined ? ` on day ${f.daysSinceBirth} after birth` : ''}.`,
        sources: cite('who-pnc-2022-rec1', 'ng-standing-orders-2015'),
        subject: 'mother',
      },
      `emergency transfer to ${hospital}`,
      'heavy bleeding after birth',
    );
  }

  // ---------- Infection and fever ----------
  const temp = latestVital(f, 'temperatureC');
  const tempRecent = temp && isRecent(f, temp, RECENT_DAYS) ? temp.temperatureC : undefined;
  const fever = (tempRecent !== undefined && tempRecent >= 38) || has('fever');
  if (postpartum && has('foul_discharge')) {
    add(
      {
        id: 'alert.puerperal_sepsis',
        level: fever ? 'emergency' : 'urgent',
        title: fever ? 'Possible sepsis after birth' : 'Bad-smelling discharge after birth',
        action: fever
          ? `Emergency referral to ${hospital} now for antibiotics. Give fluids by mouth on the way.`
          : `Refer to ${rules.sameDayFacility} today for examination and antibiotics. Check temperature and pulse.`,
        reason: `Bad-smelling discharge${fever ? ' with fever' : ''}, day ${f.daysSinceBirth} after birth.`,
        sources: cite('who-pnc-2022-rec1'),
        subject: 'mother',
      },
      fever ? `refer to ${hospital} now` : 'refer today for antibiotics',
      'foul discharge',
    );
  } else if (perinatal && fever) {
    add(
      {
        id: 'alert.maternal_fever',
        level: 'urgent',
        title: pregnant ? 'Fever in pregnancy' : 'Fever after birth',
        action: `Same day: test for malaria (RDT) and look for infection (urine, breasts, wound, womb). Positive RDT: treat per national guideline (first trimester: artemether-lumefantrine, WHO 2022) or refer. Refer to ${hospital} now if very unwell, confused, breathing fast or bleeding.`,
        reason: `${tempRecent !== undefined && tempRecent >= 38 ? `Temperature ${tempRecent}°C` : 'Fever reported'}${pregnant && f.ga !== undefined ? ` at ${f.ga} weeks` : ''}.`,
        sources: cite('who-smart-anc-danger', 'who-malaria-first-trimester-2022', 'who-pnc-2022-rec1'),
        subject: 'mother',
      },
      'malaria test and check for infection today',
      'fever',
    );
  }
  if (postpartum && has('breast_pain_redness') && fever) {
    add(
      {
        id: 'alert.mastitis',
        level: 'urgent',
        title: 'Painful red breast with fever',
        action: `Refer to ${rules.sameDayFacility} today (possible mastitis or abscess). Keep breastfeeding or expressing from that breast; it is safe for the baby.`,
        reason: 'Painful, red breast with fever.',
        sources: cite('who-pnc-2022-rec1'),
        subject: 'mother',
      },
      'same-day review for mastitis',
      'painful red breast with fever',
    );
  }

  // ---------- Pregnancy-specific ----------
  if (pregnant && has('reduced_fetal_movement') && (f.ga ?? 0) >= 28) {
    add(
      {
        id: 'alert.reduced_fetal_movement',
        level: 'urgent',
        title: 'Baby moving less',
        action: `Same day: send her to ${rules.sameDayFacility} for a fetal heart check today; do not wait until tomorrow. Refer to ${hospital} if no heartbeat is heard or movements stay reduced.`,
        reason: `Reduced fetal movements at ${f.ga} weeks.`,
        sources: cite('who-anc-2016-b21', 'cronin-2019-sleep'),
        subject: 'mother',
      },
      'fetal heart check today',
      'baby moving less',
    );
  }
  if (pregnant && has('severe_abdominal_pain') && !bpAlertRaised) {
    add(
      {
        id: 'alert.severe_abdominal_pain',
        level: 'emergency',
        title: 'Severe belly pain in pregnancy',
        action: `Emergency referral to ${hospital} now (rule out abruption, ectopic pregnancy, labour, pre-eclampsia).`,
        reason: `Severe abdominal pain${f.ga !== undefined ? ` at ${f.ga} weeks` : ''}.`,
        sources: cite('who-smart-anc-danger'),
        subject: 'mother',
      },
      `refer to ${hospital} now`,
      'severe belly pain',
    );
  }
  if (pregnant && has('leaking_fluid')) {
    const preterm = (f.ga ?? 40) < 37;
    add(
      {
        id: 'alert.ruptured_membranes',
        level: preterm ? 'emergency' : 'urgent',
        title: preterm ? 'Waters broken before 37 weeks' : 'Waters broken',
        action: preterm
          ? `Refer to ${hospital} now (preterm rupture of membranes: needs antibiotics and assessment). No vaginal examination.`
          : `She should go to her planned birth facility now. No vaginal examination at home.`,
        reason: `Fluid leaking at ${f.ga} weeks.`,
        sources: cite('who-smart-anc-danger'),
        subject: 'mother',
      },
      preterm ? `refer to ${hospital} now` : 'go to birth facility now',
      'waters broken',
    );
  }
  if (pregnant && has('nausea_vomiting') && symptomSeverity(f, 'nausea_vomiting') === 'severe') {
    add(
      {
        id: 'alert.severe_vomiting',
        level: 'urgent',
        title: 'Severe vomiting in pregnancy',
        action: `Refer to ${rules.sameDayFacility} today if she cannot keep fluids down (risk of dehydration).`,
        reason: 'Severe vomiting reported.',
        sources: cite('who-smart-anc-danger'),
        subject: 'mother',
      },
      'same-day review for vomiting',
      'severe vomiting',
    );
  }
  if (pregnant && (f.ga ?? 0) >= 41) {
    add(
      {
        id: 'alert.post_term',
        level: 'warning',
        title: '41 weeks or more: confirm birth or refer',
        action: `Call or visit today. If she has not given birth, refer to ${hospital} for assessment (WHO: return at 41 weeks). If she has, record the birth so postnatal visits start.`,
        reason: `${f.ga} weeks by LMP; no birth recorded.`,
        sources: cite('who-anc-2016-e7'),
        subject: 'mother',
      },
      'confirm birth or refer today',
      `${f.ga} weeks, no birth recorded`,
    );
  }

  // ---------- Thrombosis, breathlessness, heart failure ----------
  const ppcmWindow = pregnant || (f.daysSinceBirth !== undefined && f.daysSinceBirth <= 150);
  if (ppcmWindow && has('calf_pain_swelling')) {
    add(
      {
        id: 'alert.dvt',
        level: has('breathlessness') ? 'emergency' : 'urgent',
        title: has('breathlessness') ? 'Possible clot in leg and lung' : 'Possible clot in the leg (DVT)',
        action: has('breathlessness')
          ? `Emergency referral to ${hospital} now (possible pulmonary embolism).`
          : `Refer to ${hospital} today for assessment. Do not massage the leg.`,
        reason: `Painful or swollen calf${pregnant ? ' in pregnancy' : ' after birth'}.`,
        sources: cite('who-pnc-2022-rec1'),
        subject: 'mother',
      },
      has('breathlessness') ? `refer to ${hospital} now` : `refer to ${hospital} today`,
      'painful swollen calf',
    );
  }
  if (ppcmWindow && has('breathlessness') && !has('calf_pain_swelling')) {
    const severe = symptomSeverity(f, 'breathlessness') === 'severe';
    const ppcmNote = !pregnant
      ? ' Breathlessness in the months after birth can be peripartum cardiomyopathy, common in northern Nigeria.'
      : '';
    add(
      {
        id: 'alert.breathlessness',
        level: severe ? 'emergency' : 'urgent',
        title: !pregnant ? 'Breathless after birth: check heart' : 'Breathlessness in pregnancy',
        action: `${severe ? `Emergency referral to ${hospital} now.` : `Refer to ${hospital} today for heart and chest assessment.`} Check BP, pulse and leg swelling. Ask if she must sleep sitting up.${ppcmNote}`,
        reason: `Breathlessness reported${!pregnant && f.daysSinceBirth !== undefined ? `, day ${f.daysSinceBirth} after birth` : ''}.`,
        sources: cite('who-smart-anc-danger', 'peace-2020'),
        subject: 'mother',
      },
      severe ? `refer to ${hospital} now` : `refer to ${hospital} today`,
      'breathlessness',
    );
  }

  // ---------- Mental health ----------
  const epds = latestEpds(f);
  const epdsRecent = epds && ageDays(f, epds) <= 60 ? epds : undefined;
  if (has('thoughts_of_self_harm') || epdsRecent?.selfHarmFlag) {
    add(
      {
        id: 'alert.self_harm',
        level: 'emergency',
        title: 'Thoughts of self-harm',
        action: `Same-day action: do not leave her alone if at immediate risk. Talk privately and kindly, ask about a plan, remove means, involve a trusted family member with her consent, and refer for mental health assessment today (mhGAP-trained provider or ${hospital}).`,
        reason: epdsRecent?.selfHarmFlag ? `EPDS item 10 answered positively on ${shortDate(epdsRecent.at)}.` : 'She reported thoughts of harming herself.',
        sources: cite('who-pnc-2022-rec18', 'epds-nigeria-adewuya', 'exponate-2019'),
        subject: 'mother',
      },
      'same-day mental health referral',
      'thoughts of self-harm',
    );
  }
  if (epdsRecent && !epdsRecent.selfHarmFlag) {
    const { positive, refer, source } = rules.epds;
    if (epdsRecent.score >= refer) {
      add(
        {
          id: 'alert.depression',
          level: 'urgent',
          title: 'Probable depression (EPDS)',
          action: `Refer for assessment and treatment within the week (stepped care: problem-solving therapy by a trained maternal care provider, physician review if severe). Start Thinking Healthy support now and rescreen in 2–4 weeks.`,
          reason: `EPDS ${epdsRecent.score} on ${shortDate(epdsRecent.at)} (referral cut-off ${refer} for ${f.mother.country === 'NG' ? 'Nigerian women, Adewuya validation' : 'this country'}).`,
          sources: cite(source, 'exponate-2019', 'who-pnc-2022-rec18'),
          subject: 'mother',
        },
        'mental health referral this week',
        `EPDS ${epdsRecent.score}`,
      );
    } else if (epdsRecent.score >= positive) {
      add(
        {
          id: 'alert.low_mood_screen',
          level: 'warning',
          title: 'Positive mood screen (EPDS)',
          action: 'Follow up within a week: offer Thinking Healthy-style support sessions and rescreen in 2–4 weeks. Refer if the score rises or she feels worse.',
          reason: `EPDS ${epdsRecent.score} on ${shortDate(epdsRecent.at)} (positive screen ≥${positive}).`,
          sources: cite(source, 'who-thinking-healthy-2015'),
          subject: 'mother',
        },
        'follow up mood within a week',
        `EPDS ${epdsRecent.score}`,
      );
    }
  }

  // ---------- Anaemia ----------
  const hbLab = latestLab(f, 'haemoglobin');
  const hb = hbLab && ageDays(f, hbLab) <= 90 ? labNumber(hbLab) : undefined;
  if (hb !== undefined && hb < 7) {
    add(
      {
        id: 'alert.severe_anaemia',
        level: 'urgent',
        title: 'Severe anaemia',
        action: `Refer to ${hospital} today for assessment and possible transfusion. Emergency if she is breathless, has chest pain or is bleeding.`,
        reason: `Hb ${hb} g/dL on ${shortDate(hbLab!.at)} (severe: below 7).`,
        sources: cite('who-anc-2016-b11', 'who-anc-2016-a21'),
        subject: 'mother',
      },
      `refer to ${hospital} today`,
      `Hb ${hb} g/dL`,
    );
  } else if (hb !== undefined && hb < 10 && (perinatal || hasCondition(f, 'sickle_cell_disease'))) {
    add(
      {
        id: 'alert.moderate_anaemia',
        level: 'warning',
        title: 'Moderate anaemia',
        action: `Refer to the midwife or doctor this week for a treatment dose of iron (unless she has sickle cell disease), malaria test and deworming check. Recheck Hb in 4 weeks.`,
        reason: `Hb ${hb} g/dL on ${shortDate(hbLab!.at)} (moderate: 7–9.9).`,
        sources: cite('who-anc-2016-b11', 'who-anc-2016-a21'),
        subject: 'mother',
      },
      'treat anaemia this week',
      `Hb ${hb} g/dL`,
    );
  }

  // ---------- Malaria, HIV, SCD pathways ----------
  const rdt = latestLab(f, 'malaria_rdt');
  if (pregnant && rdt && labPositive(rdt) && isRecent(f, rdt, 14) && !out.some((a) => a.alert.id === 'alert.maternal_fever')) {
    add(
      {
        id: 'alert.malaria_pregnancy',
        level: 'urgent',
        title: 'Malaria in pregnancy',
        action: `Treat today per national guideline or refer. First trimester: artemether-lumefantrine is now preferred (WHO 2022). Refer to ${hospital} now if any sign of severe malaria (vomiting, confusion, fits, breathlessness, very pale).`,
        reason: `Positive malaria RDT on ${shortDate(rdt.at)}${f.ga !== undefined ? ` at ${f.ga} weeks` : ''}.`,
        sources: cite('who-malaria-first-trimester-2022', 'ng-mip-2018'),
        subject: 'mother',
      },
      'treat malaria today',
      'malaria',
    );
  }
  if (pregnant && hasCondition(f, 'sickle_cell_disease')) {
    add(
      {
        id: 'alert.scd_pathway',
        level: 'warning',
        title: 'Sickle cell disease: high-risk pregnancy pathway',
        action: `Make sure she is booked with a specialist team (obstetrician, haematologist) at ${hospital}, with fetal growth scans every 4 weeks from 24 weeks. Any pain crisis, fever or breathlessness in pregnancy: refer the same day.`,
        reason: `Sickle cell disease (${f.mother.genotype}) in pregnancy: 4–11 times higher risk of maternal death (WHO 2025).`,
        sources: cite('who-scd-2025', 'who-scd-2025-summary'),
        subject: 'mother',
      },
      'specialist ANC pathway',
      'sickle cell disease',
    );
  }

  // ---------- Newborn and infant danger signs (WHO PNC rec 25, IMCI / PSBI 2024) ----------
  // Every child under 1,000 days gets her own checks. The youngest keeps the original alert ids
  // (compatibility); an older sibling's alerts carry '@childId'. Every child alert carries childId.
  for (const child of f.under1000) {
    const youngestChild = isYoungest(f, child);
    const suffix = youngestChild ? '' : `@${child.id}`;
    const age = daysBetween(child.dob, f.asOf);
    const bsxChild = babySymptomsFor(f, child, RECENT_DAYS);
    const childAdd = (a: Alert, short: string, finding: string) => add({ ...a, id: `${a.id}${suffix}`, childId: child.id }, short, finding);
    const young = age < 60; // young infant 0–59 days
    const babyTemp = latestVital(f, 'temperatureC', child.id);
    const bt = babyTemp && isRecent(f, babyTemp, 2) ? babyTemp.temperatureC : undefined;
    const bhas = (s: SymptomCode) => bsxChild.includes(s);
    const signs: string[] = [];
    if (bhas('baby_not_feeding')) signs.push('not feeding');
    if (bhas('baby_convulsions')) signs.push('fits');
    if (bhas('baby_fast_breathing')) signs.push('fast breathing');
    if (bhas('baby_chest_indrawing')) signs.push('chest indrawing');
    if (bhas('baby_lethargic')) signs.push('very sleepy or floppy');
    if (bhas('baby_vomiting_everything')) signs.push('vomits everything');
    if (bhas('baby_cold') || (bt !== undefined && bt < 35.5)) signs.push(bt !== undefined && bt < 35.5 ? `cold (${bt}°C)` : 'cold');
    const febrile = bhas('baby_fever') || (bt !== undefined && bt >= 37.5);
    if (febrile && young) signs.push(bt !== undefined ? `fever (${bt}°C)` : 'fever');
    if (bhas('baby_yellow_skin') && age <= 1) signs.push('yellow in the first day');
    if (bhas('baby_cord_redness') && symptomSeverity(f, 'baby_cord_redness', 2, child.id, youngestChild) === 'severe') signs.push('cord redness spreading');
    const name = child.name || 'Baby';
    if (signs.length > 0) {
      childAdd(
        {
          id: young ? 'alert.newborn_danger' : 'alert.child_danger',
          level: 'emergency',
          title: young ? `Newborn danger signs: ${name}` : `Child danger signs: ${name}`,
          action: `Emergency referral to ${hospital} now. Keep ${name} warm skin-to-skin and keep breastfeeding on the way if able. ${young ? 'If referral is truly impossible, WHO 2024 allows simplified antibiotic treatment by trained providers only.' : 'Give the first dose of pre-referral treatment only if trained and authorised under iCCM.'}`,
          reason: `${name} (${age} days): ${signs.join(', ')}.`,
          sources: cite(young ? 'who-psbi-2024' : 'who-pnc-2022-rec25', 'who-pnc-2022-rec25'),
          subject: 'child',
        },
        `refer ${name} to ${hospital} now`,
        `${name}: ${signs.join(', ')}`,
      );
    } else {
      if (febrile) {
        childAdd(
          {
            id: 'alert.child_fever',
            level: 'urgent',
            title: `Fever: ${name}`,
            action: `Same day: malaria RDT and check for danger signs. Treat positive RDT under iCCM if trained, otherwise refer to ${rules.sameDayFacility} today.`,
            reason: `${name} (${age} days) has fever${bt !== undefined ? ` (${bt}°C)` : ''}.`,
            sources: cite('who-pnc-2022-rec25'),
            subject: 'child',
          },
          'malaria test today',
          `${name}: fever`,
        );
      }
      if (bhas('baby_yellow_skin')) {
        childAdd(
          {
            id: 'alert.jaundice',
            level: 'urgent',
            title: `Yellow skin: ${name}`,
            action: `See today. Press the skin of the palms and soles: if yellow there, or the baby is under 2 days old, feeding poorly or very sleepy, refer to ${hospital} now. Otherwise breastfeed often and recheck tomorrow.`,
            reason: `${name} (${age} days) has yellow skin or eyes.`,
            sources: cite('who-pnc-2022-rec25', 'who-pnc-2022-rec26'),
            subject: 'child',
          },
          'check jaundice today',
          `${name}: yellow skin`,
        );
      }
      if (bhas('baby_cord_redness')) {
        childAdd(
          {
            id: 'alert.cord_infection',
            level: 'urgent',
            title: `Cord redness: ${name}`,
            action: `See today. If redness spreads onto the belly skin, or there is pus or a bad smell with fever, refer to ${hospital} now. Keep the cord clean and dry; nothing else on it.`,
            reason: `${name} (${age} days) has redness around the cord.`,
            sources: cite('who-pnc-2022-rec25', 'who-pnc-2022-rec32'),
            subject: 'child',
          },
          'check cord today',
          `${name}: cord redness`,
        );
      }
      if (bhas('baby_diarrhoea')) {
        childAdd(
          {
            id: 'alert.child_diarrhoea',
            level: 'urgent',
            title: `Diarrhoea: ${name}`,
            action: young
              ? `Refer to ${rules.sameDayFacility} today (diarrhoea under 2 months). Keep breastfeeding.`
              : `Same day: ORS and zinc under iCCM if trained (age 2–59 months); keep breastfeeding. Refer now if blood in stool, sunken eyes, unable to drink or vomits everything.`,
            reason: `${name} (${age} days) has diarrhoea.`,
            sources: cite('who-pnc-2022-rec25'),
            subject: 'child',
          },
          'ORS and zinc or refer today',
          `${name}: diarrhoea`,
        );
      }
    }
    // Severe acute malnutrition: MUAC < 11.5 cm from 6 months (WHO/UNICEF 2009).
    const growth = growthFor(f, child);
    const muac = [...growth].reverse().find((g) => g.muacCm !== undefined);
    if (muac && age >= 182 && muac.muacCm! < 11.5 && daysBetween(muac.at, f.asOf) <= 30) {
      childAdd(
        {
          id: 'alert.severe_malnutrition',
          level: 'urgent',
          title: `Severe acute malnutrition: ${name}`,
          action: `Refer to the nearest outpatient therapeutic (CMAM) site this week; refer to ${hospital} today if any danger sign, swelling of both feet or not eating.`,
          reason: `MUAC ${muac.muacCm} cm on ${shortDate(muac.at)} (below 11.5 cm).`,
          sources: cite('who-sam-2009'),
          subject: 'child',
        },
        'refer for malnutrition treatment',
        `${name}: MUAC ${muac.muacCm} cm`,
      );
    }
  }

  // ---------- Open referrals from guided visits ----------
  // Findings with no symptom code (club foot, cleft palate, hips, eyes, development) reach the
  // worker here, so every caller of buildPlan (UI, Insights, MCP server, server) sees them.
  for (const a of visitReferralAlerts(f)) add(a, a.level === 'warning' ? 'referral open' : 'refer today', a.title.replace(/^Referral open: /, ''));

  // ---------- Unknown results that could hide danger, and serious side effects ----------
  for (const a of unknownAlerts(f, computeUnknowns(f))) if (!out.some((x) => x.alert.id === a.alert.id)) out.push(a);
  for (const a of sideEffectAlerts(f)) out.push(a);

  // Order: emergency, urgent, warning; stable within level.
  const rank = { emergency: 0, urgent: 1, warning: 2 } as const;
  return out.sort((a, b) => rank[a.alert.level] - rank[b.alert.level]);
}

export function symptomPhrase(s: SymptomCode): string {
  switch (s) {
    case 'severe_headache':
      return 'severe headache';
    case 'blurred_vision':
      return 'blurred vision';
    case 'severe_abdominal_pain':
      return 'upper belly pain';
    case 'swelling_face_hands':
      return 'swelling of face or hands';
    default:
      return s.replace(/_/g, ' ');
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Mother-facing line for an open referral, matching its urgency: emergency "go now", urgent
 * "go today", routine "go to {place} within N weeks". Every line names the place. Keys live in
 * src/visits/text.ts; the finding's own explanation is told at the visit.
 */
function referralText(urgency: 'emergency' | 'urgent' | 'routine', place: string, note: string | undefined): { key: string; params: Record<string, string> } {
  if (urgency === 'emergency') return { key: 'vt.refer_now', params: { place } };
  if (urgency === 'urgent') return { key: 'vt.refer_today', params: { place } };
  return { key: 'vt.refer_within', params: { place, when: referralWhen(note) ?? 'soon' } };
}

/**
 * Open referrals recorded by a guided visit checklist (event ids start with `vc-`) in the last
 * 14 days. Same ids as visits/referralAlerts, so merging the two never duplicates.
 */
export function visitReferralAlerts(f: Facts): Alert[] {
  const names = new Map(f.children.map((c) => [c.id, c.name]));
  const hospital = COUNTRY_RULES[f.mother.country].referralHospital;
  return ofKind(f, 'referral')
    .filter((r) => r.status === 'open' && /^vc-/.test(r.id) && daysBetween(r.at, f.asOf) <= 14)
    .map((r) => {
      const child = r.childId ? names.get(r.childId) : undefined;
      const place = facilityById(r.toFacilityId)?.name ?? hospital;
      const text = referralText(r.urgency, place, r.note);
      return {
        id: `alert.visit_referral.${r.id}`,
        level: r.urgency === 'emergency' ? 'emergency' : r.urgency === 'urgent' ? 'urgent' : 'warning',
        title: `Referral open: ${r.reason}`,
        action: `${r.note ?? ''} Confirm she reached ${place}; mark the referral arrived or completed.`.trim(),
        reason: `Found at the visit on ${shortDate(r.at)}${child ? ` (${child})` : ''}.`,
        sources: [],
        subject: r.childId ? 'child' : 'mother',
        ...(r.childId ? { childId: r.childId } : {}),
        motherTextKey: text.key,
        motherTextParams: text.params,
      } satisfies Alert;
    });
}
