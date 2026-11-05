import type { Child } from '../types';
import { cite, IMMUNISATION_SOURCE, LOCAL_FOODS } from '../clinical';
import { addDays, babyAge, daysBetween, dayMs, shortDate } from './dates';
import { growthFor, hasCondition, labNumber, labPositive, latestFeeding, latestLab, medsMatching, ofKind, recentSymptoms } from './facts';
import { addItem, list, type RuleCtx } from './items';
import { foodAdvice, pickFoods } from './rulesNutrition';
import { mentalHealthScreenDue } from './rulesPregnancy';
import { immunisationStatus, pncContacts, vaccineList } from './schedule';

/** Postpartum mother, days 0–42 (WHO PNC 2022). */
export function postpartumRules(c: RuleCtx): void {
  const { f, s, rules } = c;
  const m = f.mother;
  const d = f.daysSinceBirth!;
  const birth = f.lastBirth!;
  const comps = birth.complications.filter((x) => x !== 'none');
  const name = f.youngest?.name ?? 'the baby';

  // ---------- PNC contacts: within 24 h, 48–72 h, 7–14 days, 6 weeks ----------
  const pnc = pncContacts(f) ?? [];
  const extraRisk = s.risks.filter((r) => ['pph_this_birth', 'postpartum_pre_eclampsia', 'low_birth_weight', 'preterm', 'hiv', 'perinatal_depression', 'postpartum_sepsis', 'caesarean_recovery', 'non_facility_birth'].includes(r.code));
  for (const ct of pnc) {
    if (ct.status === 'upcoming' && daysBetween(f.asOf, ct.due) > 14) continue; // only near-term contacts as items
    const late = ct.status === 'overdue' || ct.status === 'missed';
    const what =
      ct.id === 'visit.pnc_24h'
        ? `Mother: bleeding, womb firmness, temperature, pulse, BP (within 6 h and again), passed urine. Baby: breathing, warmth, cord, first breastfeed, vitamin K, eye care, birth vaccines.`
        : ct.id === 'visit.pnc_day3'
          ? `Mother: bleeding, fever, BP, breasts, perineum or wound, mood. Baby: feeding (8–12 times a day), jaundice, cord, warmth, danger signs. Observe a full breastfeed.`
          : ct.id === 'visit.pnc_day7_14'
            ? `Mother: bleeding, wound healing, breasts, mood, BP if hypertensive. Baby: weight back to birth weight by day 10–14, cord off and dry, feeding, jaundice.`
            : `Mother: recovery, BP, Hb if anaemic, EPDS, family planning method started. Baby: weight, 6-week vaccines, feeding.`;
    addItem(c, {
      id: ct.id,
      category: 'visits',
      title: ct.label,
      detail: `${ct.status === 'done' ? `Done on ${shortDate(ct.doneOn!)}.` : late ? `${ct.status === 'missed' ? 'Missed' : 'Overdue'}: window was day ${ct.start}–${ct.end} (${shortDate(ct.due)}). Visit as soon as possible.` : `Window day ${ct.start}–${ct.end} after birth, from ${shortDate(ct.due)}. First-week contacts ideally at home.`} Check: ${what}${extraRisk.length && ct.status !== 'done' ? ` Higher-risk dyad (${list(extraRisk.map((r) => r.label.toLowerCase()))}): consider extra contacts.` : ''}`,
      text: ct.status === 'done' ? { key: 'visit.after_birth.done', params: { date: shortDate(ct.doneOn!) } } : { key: 'visit.after_birth.due', params: { name, date: shortDate(late ? f.asOf : ct.due) } },
      priority: ct.status === 'done' ? 5 : late || ct.status === 'due' ? 1 : 2,
      timing: `Day ${ct.start}–${ct.end} after birth`,
      dueDate: ct.status === 'done' ? undefined : late ? f.asOf : ct.due,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec44', 'who-pnc-2022-rec1', ...(extraRisk.length ? ['who-pnc-model-2023'] : [])),
      because: [`Day ${d} after birth`, birth.place !== 'facility' ? `Born ${birth.place === 'home' ? 'at home' : birth.place === 'tba' ? 'with a TBA' : 'on the way'}` : '', late ? 'Contact window passed' : ''],
      illustration: d <= 14 ? 'phone_call' : 'clinic_visit',
      status: ct.status === 'done' ? 'done' : 'active',
      locked: ct.status !== 'done' && ct.id !== 'visit.pnc_6wk' ? true : undefined,
    });
  }

  // ---------- Danger signs ----------
  addItem(c, {
    id: 'danger.postpartum',
    category: 'danger_signs',
    title: 'Danger signs after birth: go to the facility now',
    detail: 'Teach her and her carer: heavy bleeding (soaking a pad in under an hour), fits, severe headache or blurred vision, fever or bad-smelling discharge, breathlessness or needing to sleep sitting up, painful swollen calf, painful red breast with fever, thoughts of harming herself or the baby. BP can rise again in the first week.',
    text: { key: 'danger.postpartum' },
    priority: 1,
    evidence: 'A',
    sources: cite('who-pnc-2022-rec1', 'who-smart-anc-danger'),
    because: [`Day ${d} after birth`],
    locked: true,
    illustration: 'danger_bleeding',
  });

  // ---------- Medicines ----------
  const scd = hasCondition(f, 'sickle_cell_disease') || m.genotype === 'SS' || m.genotype === 'SC';
  const hb = labNumber(latestLab(f, 'haemoglobin'));
  if (scd) {
    addItem(c, {
      id: rules.scdFolicAcid === 'national_5mg' ? 'med.folic_acid_high_dose' : 'med.folic_acid_scd',
      category: 'medication',
      title: `Folic acid ${rules.scdFolicAcid === 'national_5mg' ? '5 mg' : ''} daily; no routine iron (sickle cell disease)`.replace('  ', ' '),
      detail: `Continue folic acid after birth; iron only if iron deficiency is confirmed (WHO 2025 SCD guideline). Postnatal thromboprophylaxis per local guidance.${rules.scdFolicAcid === 'national_5mg' ? ' Nigerian practice is 5 mg daily; WHO 2025 gives up to 5 mg outside SP use.' : ''}`,
      text: { key: 'med.folic_acid.after_birth' },
      priority: 2,
      evidence: 'B',
      sources: cite('who-scd-2025-summary'),
      because: [`Sickle cell disease (${m.genotype})`, ...(rules.scdFolicAcid === 'national_5mg' ? ['Dose to be confirmed by clinical advisory board (WHO 2025 vs national practice)'] : [])],
      illustration: 'iron_tablet',
    });
  } else {
    const bled = s.risks.some((r) => r.code === 'pph_this_birth');
    addItem(c, {
      id: 'med.iron_folate',
      category: 'medication',
      title: 'Iron and folic acid for 3 months after birth',
      detail: `WHO PNC rec. 20 (context-specific, anaemia prevalence ≥20%): oral iron ± folic acid for 6–12 weeks after birth; continue the pregnancy IFA tablet (60 mg + 400 µg).${bled ? ' She bled heavily at birth: check Hb at the day 7–14 contact; treatment dose if below 11.' : ''}${hb !== undefined ? ` Last Hb ${hb} g/dL.` : ''}`,
      text: { key: 'med.iron_folate.after_birth' },
      priority: bled || (hb !== undefined && hb < 10) ? 2 : 3,
      timing: 'Daily for 3 months after birth',
      evidence: 'B',
      sources: cite('who-pnc-2022-rec20', 'who-ifa-2012'),
      because: [`Day ${d} after birth`, bled ? 'Heavy bleeding at birth' : '', hb !== undefined ? `Hb ${hb} g/dL` : ''],
      illustration: 'iron_tablet',
    });
  }
  if (hasCondition(f, 'hiv') || labPositive(latestLab(f, 'hiv'))) {
    addItem(c, {
      id: 'med.art_pmtct',
      category: 'medication',
      title: 'HIV treatment every day while breastfeeding',
      detail: `Continue ART; infant ARV prophylaxis per national PMTCT guideline; early infant diagnosis (PCR) at 6 weeks. Exclusive breastfeeding with maternal ART is recommended where formula is not safe.`,
      text: { key: 'med.art.after_birth', params: { name } },
      priority: 1,
      evidence: 'A',
      sources: cite('who-hiv-2021'),
      because: ['Living with HIV'],
      locked: true,
      illustration: 'medicine',
    });
  }
  if (comps.includes('pre_eclampsia') || comps.includes('eclampsia') || hasCondition(f, 'chronic_hypertension')) {
    addItem(c, {
      id: 'visit.postpartum_bp',
      category: 'visits',
      title: 'Check BP at every postnatal contact',
      detail: `Hypertensive disorder in this pregnancy. BP can peak 3–6 days after birth. Check BP at day 3, day 7 and 6 weeks; refer if ≥140/90 with symptoms or ≥160/110. Ensure her antihypertensive is prescribed by a doctor and continued.`,
      text: { key: 'visit.bp_after_birth' },
      priority: 1,
      dueDate: f.asOf,
      evidence: 'A',
      sources: cite('who-pe-2011', 'who-pnc-2022-rec1'),
      because: comps.includes('eclampsia') ? ['Eclampsia at birth'] : comps.includes('pre_eclampsia') ? ['Pre-eclampsia at birth'] : ['Chronic hypertension'],
      locked: true,
      illustration: 'blood_pressure',
    });
  }
  if (birth.mode === 'caesarean') {
    addItem(c, {
      id: 'educ.caesarean_wound',
      category: 'education',
      title: 'Caesarean wound care',
      detail: 'Keep the wound clean and dry; watch for redness, pus, fever or wound opening. Paracetamol for pain. A soft binder may help comfort (RCT evidence after caesarean). No heavy lifting for 6 weeks. Next birth must be in a hospital.',
      text: { key: 'educ.caesarean_wound' },
      priority: 2,
      evidence: 'C',
      sources: cite('who-pnc-2022-rec1', 'lin-2025-binder'),
      because: ['Caesarean birth'],
      illustration: 'handwashing',
    });
  }

  // ---------- Breastfeeding ----------
  breastfeedingRules(c);

  // ---------- Nutrition ----------
  foodAdvice(c, 'lactation');

  // ---------- Rest ----------
  addItem(c, {
    id: 'rest.postpartum',
    category: 'rest_and_sleep',
    title: 'Rest when the baby sleeps',
    detail: 'Encourage rest and practical help with chores for at least the first 6 weeks; gentle walking from the first days, more activity as she feels able (WHO PNC recs 22–23). Baby sleeps on the back, under a treated net, near the mother.',
    text: { key: 'rest.after_birth', params: { name } },
    priority: 4,
    evidence: 'A',
    sources: cite('who-pnc-2022-rec22', 'who-pnc-2022-rec33'),
    because: [`Day ${d} after birth`],
    illustration: 'rest',
  });

  // ---------- Family planning ----------
  addItem(c, {
    id: 'fp.postpartum',
    category: 'family_planning',
    title: 'Family planning: choose a method by 6 weeks',
    detail: `WHO PNC rec. 24: counsel on postpartum contraception. Exclusive breastfeeding (LAM) protects only if the baby is under 6 months, fully breastfed day and night, and periods have not returned. Progestogen-only methods, implant and IUD are safe while breastfeeding. Wait at least 2 years before the next pregnancy (WHO birth spacing).${m.parity >= 4 ? ` She has had ${m.parity + 1} births: discuss long-acting methods.` : ''}`,
    text: { key: 'fp.after_birth' },
    priority: d >= 21 ? 3 : 4,
    dueDate: addDays(birth.date, 42),
    evidence: 'A',
    sources: cite('who-pnc-2022-rec24', 'who-birth-spacing-2005', 'ng-tsts-2025'),
    because: [`Day ${d} after birth`, m.parity >= 4 ? `${m.parity + 1} births` : ''],
    illustration: 'family_planning',
  });

  // ---------- Family support ----------
  addItem(c, {
    id: 'family.partner_support',
    category: 'family_support',
    title: 'Involve partner and family',
    detail: `WHO PNC rec. 52: involve men in postnatal care. Ask who helps at home; agree that a family member will learn the danger signs for mother and baby, and who will take them to the facility at night.${m.householdNotes ? ` Household: ${m.householdNotes}` : ''}`,
    text: { key: 'family.partner' },
    priority: 4,
    evidence: 'B',
    sources: cite('who-pnc-2022-rec52'),
    because: [`Day ${d} after birth`],
    illustration: 'family_support',
  });

  mentalHealthItems(c);
}

/** Breastfeeding support, including the low milk supply plan. */
export function breastfeedingRules(c: RuleCtx): void {
  const { f, s } = c;
  const child = f.youngest;
  if (!child) return;
  const age = f.youngestAgeDays!;
  if (age > 730) return;
  const name = child.name;
  const feeding = latestFeeding(f, child.id);
  const status = child.feeding;
  const { mother: sx } = recentSymptoms(f, 14);
  const lowSupply = feeding?.milkSupply === 'low' || feeding?.milkSupply === 'very_low' || sx.includes('low_milk_supply');
  const latch = feeding?.latchProblem || sx.includes('cracked_nipples') || sx.includes('breast_pain_redness');
  const hiv = s.risks.some((r) => r.code === 'hiv');

  if (age < 183) {
    const notExclusive = status === 'mixed' || status === 'formula' || status === 'complementary_with_breastmilk' || status === 'complementary_no_breastmilk';
    addItem(c, {
      id: 'bf.exclusive',
      category: 'breastfeeding',
      title: notExclusive ? `Return to breast milk only for ${name}` : `Breast milk only until 6 months`,
      detail: `WHO PNC rec. 42: exclusive breastfeeding to 6 months (${shortDate(addDays(child.dob, 182))}), on demand, 8–12 feeds in 24 hours including at night. No water, glucose water, pap or herbs (prelacteal and early feeds were 55–66% in Nigeria).${notExclusive ? ` Currently ${status.replace(/_/g, ' ')}: find out what else ${name} gets and why, and support relactation if milk is reduced.` : ''}${hiv ? ' With HIV: exclusive breastfeeding plus maternal ART; avoid mixed feeding.' : ''}`,
      text: { key: 'bf.only_breast_milk', params: { name } },
      priority: notExclusive ? 2 : 3,
      timing: `Until ${shortDate(addDays(child.dob, 182))}`,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec42', 'agho-2016-prelacteal'),
      because: [`${name} is ${babyAge(age)} old`, `Feeding: ${status.replace(/_/g, ' ')}`],
      illustration: 'breastfeeding',
    });
  }

  if (age <= 14 || latch) {
    addItem(c, {
      id: 'bf.latch',
      category: 'breastfeeding',
      title: latch ? 'Fix the latch: sore or cracked nipples' : 'Good position and latch',
      detail: `Observe a full feed. Good attachment: mouth wide open, more areola above than below, lower lip turned out, chin touching the breast; baby's body close and facing the breast. ${latch ? 'Sore or cracked nipples usually mean poor attachment: correct it, rub a little breast milk on the nipple after feeds. Painful red breast with fever: same-day review.' : 'Skin-to-skin as much as possible in the first days.'}`,
      text: { key: 'bf.latch', params: { name } },
      priority: latch ? 2 : 3,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec42'),
      because: [latch ? 'Latch problem or sore nipples reported' : `${name} is ${babyAge(age)} old`],
      illustration: 'breastfeeding_latch',
    });
  }

  if (lowSupply) {
    addItem(c, {
      id: 'bf.low_milk_plan',
      category: 'breastfeeding',
      title: 'Plan for low milk supply',
      detail: `Step 1, assess: count wet nappies (6+ a day after day 5) and weigh ${name}; ${s.latest.infantWeightKg ? `last weight ${s.latest.infantWeightKg} kg` : 'no recent weight'}. Step 2, basics: feed 8–12 times in 24 h including at night, both breasts, correct latch, skin-to-skin, stop water/pap/bottles, rest and drink to thirst. Step 3, food-based galactagogues if she wants: moringa leaves (supported: RCTs show more milk, low–moderate certainty), pap or millet-soya drink (plausible: Ghana RCT analogue). Fenugreek is weak and has side effects. Galactagogues never replace assessment. Refer if ${name} is not gaining weight or has fewer wet nappies.`,
      text: { key: 'bf.more_milk', params: { name } },
      priority: 2,
      dueDate: f.asOf,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec42', 'ammar-2025-moringa', 'lactmed-moringa', 'tahiru-2025-zimso', 'lactmed-fenugreek'),
      because: [feeding?.milkSupply ? `Milk supply reported ${feeding.milkSupply.replace('_', ' ')}` : 'She worries her milk is low', feeding?.feedsPerDay !== undefined ? `${feeding.feedsPerDay} feeds a day` : ''],
      illustration: 'skin_to_skin',
    });
  }

  if (age >= 183) {
    addItem(c, {
      id: 'bf.continue',
      category: 'breastfeeding',
      title: 'Keep breastfeeding to 2 years and beyond',
      detail: 'WHO 2023: continue breastfeeding to 2 years or beyond alongside family foods.',
      text: { key: 'bf.continue', params: { name } },
      priority: 4,
      evidence: 'A',
      sources: cite('who-cf-2023'),
      because: [`${name} is ${babyAge(age)} old`],
      illustration: 'breastfeeding',
    });
  }
}

/** Newborn and infant care for the youngest child (to 1,000 days). */
export function babyRules(c: RuleCtx): void {
  const { f, s, rules } = c;
  const child = f.youngest;
  if (!child || f.youngestAgeDays === undefined || f.youngestAgeDays > 1000) return;
  const age = f.youngestAgeDays;
  const name = child.name;
  const m = f.mother;
  const small = child.birthWeightKg < 2.5 || child.gestationAtBirthWeeks < 37;

  // ---------- Danger signs ----------
  addItem(c, {
    id: age < 60 ? 'danger.newborn' : 'danger.child',
    category: 'danger_signs',
    title: age < 60 ? `Newborn danger signs for ${name}` : `Danger signs for ${name}`,
    detail:
      age < 60
        ? 'WHO PNC rec. 25 and the 2024 young-infant algorithm: not feeding well, fits, fast breathing (60+ a minute), severe chest indrawing, moves only when stimulated, temperature 37.5°C or more or below 35.5°C, yellow skin in the first day or yellow palms/soles, cord redness spreading to the skin. Any sign: go to hospital now.'
        : 'IMCI general danger signs: unable to drink or breastfeed, vomits everything, fits, very sleepy or unconscious; also fast breathing or chest indrawing, fever, diarrhoea with sunken eyes or blood, swelling of both feet.',
    text: { key: age < 60 ? 'danger.newborn' : 'danger.child', params: { name } },
    priority: 1,
    evidence: 'A',
    sources: cite(age < 60 ? 'who-psbi-2024' : 'who-pnc-2022-rec25', 'who-pnc-2022-rec25'),
    because: [`${name} is ${babyAge(age)} old`],
    locked: true,
    illustration: 'baby_danger',
  });

  // ---------- Newborn essentials ----------
  if (age <= 14) {
    const chx = rules.cordCare === 'chlorhexidine';
    addItem(c, {
      id: 'baby.cord_care',
      category: 'baby_care',
      title: chx ? 'Cord care: chlorhexidine gel once a day for 7 days' : 'Cord care: clean and dry',
      detail: chx
        ? `Nigeria national policy (FMoH chlorhexidine strategy 2016, on the EML; WHO PNC rec. 32b context-specific): apply 7.1% chlorhexidine digluconate gel (= 4% chlorhexidine) to the stump once daily for 7 days from day 1, in all birth settings. Nothing else on the cord: no ash, dung, herbs, shea butter or hot compress. ${age <= 7 ? `Day ${age + 1} of 7.` : 'Course complete; keep dry until it falls off.'} Cochrane 2026: chlorhexidine reduces cord infection in LMICs.`
        : `WHO PNC rec. 32a: clean, dry cord care; keep the stump uncovered and clean, wash with clean water if soiled. Nothing on the cord (no ash, herbs, shea butter, hot compress).`,
      text: { key: chx ? 'baby.cord_gel' : 'baby.cord_dry', params: { name } },
      priority: 2,
      timing: chx ? 'Daily, day 1–7' : 'Until the cord falls off',
      evidence: chx ? 'B' : 'A',
      sources: cite('who-pnc-2022-rec32', ...(chx ? ['ng-chx-strategy', 'cochrane-chx-2026'] : []), 'abegunde-2017-cord'),
      because: [`${name} is ${babyAge(age)} old`, chx ? 'Nigerian national cord care policy' : ''],
      illustration: 'cord_care',
    });
    addItem(c, {
      id: 'baby.thermal_care',
      category: 'baby_care',
      title: small ? `Kangaroo care for ${name}: skin-to-skin day and night` : 'Keep the baby warm',
      detail: small
        ? `${name}: ${child.birthWeightKg} kg at ${child.gestationAtBirthWeeks} weeks. WHO 2022: immediate kangaroo mother care, skin-to-skin for as many hours a day as possible, exclusive breastfeeding at least every 2–3 hours, extra follow-up and weight checks. Others (father, grandmother) can take turns.`
        : 'Delay the first bath to at least 24 hours (WHO PNC rec. 30); dress the baby in one more layer than an adult; cap; skin-to-skin; keep the room warm.',
      text: { key: small ? 'baby.skin_to_skin' : 'baby.warm', params: { name } },
      priority: small ? 1 : 3,
      evidence: 'A',
      sources: cite(small ? 'who-kmc-2022' : 'who-pnc-2022-rec30', 'who-pnc-2022-rec30'),
      because: small ? [child.birthWeightKg < 2.5 ? `Birth weight ${child.birthWeightKg} kg` : '', child.gestationAtBirthWeeks < 37 ? `Born at ${child.gestationAtBirthWeeks} weeks` : ''] : [`${name} is ${babyAge(age)} old`],
      locked: small || undefined,
      illustration: small ? 'skin_to_skin' : 'warm_baby',
    });
  } else if (small && age <= 90) {
    addItem(c, {
      id: 'baby.thermal_care',
      category: 'baby_care',
      title: `Kangaroo care for ${name} until growing well`,
      detail: `Low birth weight or preterm (${child.birthWeightKg} kg, ${child.gestationAtBirthWeeks} weeks): continue skin-to-skin and frequent breastfeeding; weigh every 1–2 weeks until gaining steadily.`,
      text: { key: 'baby.skin_to_skin.continue', params: { name } },
      priority: 2,
      evidence: 'A',
      sources: cite('who-kmc-2022'),
      because: [`Birth weight ${child.birthWeightKg} kg`],
      illustration: 'skin_to_skin',
    });
  }
  if (age <= 42) {
    addItem(c, {
      id: 'baby.safe_sleep',
      category: 'baby_care',
      title: 'Safe sleep: on the back, under a net',
      detail: 'WHO PNC rec. 33: supine sleeping. Firm surface near the mother, no pillows or heavy covers over the face, under an insecticide-treated net. Back-carrying is fine with the face uncovered.',
      text: { key: 'baby.safe_sleep', params: { name } },
      priority: 3,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec33', 'babywearing-2026'),
      because: [`${name} is ${babyAge(age)} old`],
      illustration: 'mosquito_net',
    });
    if (s.risks.some((r) => r.code === 'hiv')) {
      addItem(c, {
        id: 'test.infant_hiv',
        category: 'tests',
        title: `HIV prophylaxis and 6-week test for ${name}`,
        detail: 'Infant ARV prophylaxis per national PMTCT guideline from birth; early infant diagnosis (DNA PCR) at 6 weeks with the first vaccines; cotrimoxazole from 6 weeks per national guideline.',
        text: { key: 'test.infant_hiv', params: { name } },
        priority: 1,
        dueDate: addDays(child.dob, 42),
        evidence: 'A',
        sources: cite('who-hiv-2021'),
        because: ['Mother living with HIV'],
        locked: true,
        illustration: 'test_tube',
      });
    }
  }

  // ---------- Immunisation ----------
  const imm = immunisationStatus(f, child);
  if (imm.next) {
    const n = imm.next;
    const overdue = n.overdueDays > 0;
    addItem(c, {
      id: 'imm.child_next',
      category: 'immunisation',
      title: `${name}: ${n.label} vaccines${overdue ? ' (overdue)' : ''}`,
      detail: `Due ${shortDate(n.due)}: ${vaccineList(n.missing)}.${overdue ? ` ${n.overdueDays} days overdue: give at the next opportunity; doses do not need restarting.` : ''}${imm.overdue.length > n.missing.length ? ` Also missing: ${vaccineList(imm.overdue.filter((v) => !n.missing.includes(v)))}.` : ''}${m.country === 'KE' ? ' Malaria vaccine only in designated endemic sub-counties; yellow fever only in high-risk counties.' : ''}${m.country === 'GH' ? ' Record doses in the MCH Record Book.' : ''}`,
      text: overdue ? { key: 'imm.child_next.now', params: { name } } : { key: 'imm.child_next.date', params: { name, date: shortDate(n.due) } },
      priority: overdue ? 2 : 3,
      dueDate: overdue ? f.asOf : n.due,
      evidence: 'A',
      sources: cite(IMMUNISATION_SOURCE[m.country], 'who-pnc-2022-rec34'),
      because: [`${name} is ${babyAge(age)} old`, overdue ? `${n.label} doses were due ${shortDate(n.due)}` : ''],
      illustration: 'vaccination',
    });
  }

  // ---------- Growth monitoring ----------
  const weights = growthFor(f, child).filter((g) => g.weightKg !== undefined);
  const last = weights[weights.length - 1];
  const poor = s.risks.find((r) => r.code === 'poor_growth');
  const interval = small && age < 180 ? 14 : 30;
  const due = last ? addDays(last.at, interval) : f.asOf;
  addItem(c, {
    id: 'baby.growth_monitoring',
    category: 'baby_care',
    title: poor ? `${name} is not growing well: weigh and assess` : `Weigh ${name} ${interval === 14 ? 'every 2 weeks' : 'every month'}`,
    detail: `${last ? `Last weight ${last.weightKg} kg on ${shortDate(last.at)}.` : 'No weight since birth recorded.'} Plot on the WHO growth chart${m.country === 'GH' ? ' in the MCH Record Book' : ''}; from 6 months measure MUAC (below 11.5 cm = severe acute malnutrition, refer).${poor ? ` ${poor.reason} Assess feeding, illness and mother's milk; refer if no gain at the next weigh.` : ''}`,
    text: { key: interval === 14 ? 'baby.weigh.fortnightly' : 'baby.weigh.monthly', params: { name } },
    priority: poor ? 2 : 4,
    dueDate: dayMs(due) < dayMs(f.asOf) ? f.asOf : due,
    evidence: 'A',
    sources: cite('who-sam-2009', ...(small ? ['who-kmc-2022'] : [])),
    because: [`${name} is ${babyAge(age)} old`, poor ? poor.reason : '', small ? 'Low birth weight or preterm' : ''],
    illustration: 'growth_chart',
  });

  // ---------- Complementary feeding from 6 months ----------
  if (age >= 152) complementaryFeeding(c, child, age);

  // ---------- Vitamin A ----------
  if (age >= 168) {
    const given = medsMatching(f, /vitamin a/i).length + (ofKind(f, 'immunisation').some((e) => e.vaccines.some((v) => /vita/i.test(v))) ? 1 : 0);
    const nextDose = age < 365 ? 'at 6 months (100,000 IU)' : 'every 6 months (200,000 IU)';
    addItem(c, {
      id: 'med.vitamin_a_child',
      category: 'medication',
      title: `Vitamin A for ${name} ${nextDose}`,
      detail: `Routine programme: 100,000 IU at 6 months, 200,000 IU at 12 months and every 6 months to 5 years (NPHCDA/GHS/KEPI schedules).${given ? ' At least one dose recorded.' : ' No dose recorded yet.'}`,
      text: { key: age < 365 ? 'med.vitamin_a.first' : 'med.vitamin_a.repeat', params: { name } },
      priority: 3,
      dueDate: age < 182 ? addDays(child.dob, 182) : undefined,
      evidence: 'A',
      sources: cite(IMMUNISATION_SOURCE[m.country]),
      because: [`${name} is ${babyAge(age)} old`],
      illustration: 'medicine',
    });
  }
}

function complementaryFeeding(c: RuleCtx, child: Child, age: number): void {
  const { f } = c;
  const name = child.name;
  const band = f.mother.incomeBand;
  // Meal frequency and texture by age (WHO/PAHO 2003 guiding principles; WHO 2023 guideline).
  const stage =
    age < 182
      ? { label: 'starting soon', meals: 'start at 6 months', texture: 'thick, smooth porridge', amount: '2–3 spoonfuls to start' }
      : age < 274
        ? { label: '6–8 months', meals: '2–3 meals a day plus 1–2 snacks', texture: 'thick mashed foods (not watery pap)', amount: 'start with 2–3 spoonfuls, build to half a 250 mL cup' }
        : age < 365
          ? { label: '9–11 months', meals: '3–4 meals a day plus 1–2 snacks', texture: 'finely chopped or mashed foods and finger foods', amount: 'half a 250 mL cup per meal' }
          : { label: '12–23 months', meals: '3–4 meals a day plus 1–2 snacks', texture: 'family foods, chopped if needed', amount: 'three-quarters to a full 250 mL cup per meal' };
  const animal = pickFoods(c, 'protein', 6).filter((x) => /egg|fish|crayfish|omena|dagaa|momoni|liver|meat|chicken/i.test(x.name)).slice(0, 2);
  const greens = pickFoods(c, 'iron', 6).filter((x) => /ugu|efo|sukuma|managu|kontomire|ayoyo|leaves|greens|moringa/i.test(x.name)).slice(0, 1);
  const legume = pickFoods(c, 'protein', 6).filter((x) => /bean|ndengu|groundnut|soy|agushie/i.test(x.name)).slice(0, 1);
  const staple = LOCAL_FOODS[f.mother.country].find((x) => /ogi|uji|koko/i.test(x.name));
  const nm = (x: { name: string }) => x.name.split(' (')[0].toLowerCase();
  const enrich = f.mother.country === 'NG' ? 'ogi with groundnut paste and crayfish' : f.mother.country === 'KE' ? 'uji with groundnut or milk' : 'koko with groundnut or soy';
  addItem(c, {
    id: 'nutr.complementary_feeding',
    category: 'nutrition',
    title: age < 182 ? `Get ready: ${name} starts food at 6 months` : `Feeding ${name} (${stage.label})`,
    detail: `WHO 2023: start at 6 months while breastfeeding continues. ${stage.meals}; ${stage.texture}; ${stage.amount}. Every day an animal-source food (${animal.map(nm).join(', ') || 'egg or small fish'}), plus ${legume.map(nm)[0] ?? 'beans'} and ${greens.map(nm)[0] ?? 'dark green leaves'}. Enrich porridge: ${staple ? enrich : 'add groundnut or soy'}. No sugary drinks or sweets. Responsive feeding: patient, encourage, never force. Wash hands and utensils.${band === 'very_low' ? ' Cheapest options: beans, crayfish, egg and local greens; ask about MNP or fortified flour programmes if available.' : ''}`,
    text: { key: age < 182 ? 'nutr.first_foods.prepare' : age < 274 ? 'nutr.first_foods.6_8' : age < 365 ? 'nutr.first_foods.9_11' : 'nutr.first_foods.12_23', params: { name, food: enrich.split(' with ')[1] } },
    priority: age < 182 ? 3 : 2,
    dueDate: age < 182 ? addDays(child.dob, 182) : undefined,
    evidence: 'A',
    sources: cite('who-cf-2023', 'who-cf-2023-summary', 'who-cf-principles-2003'),
    because: [`${name} is ${babyAge(age)} old`, `Income: ${band.replace('_', ' ')}`],
    illustration: 'complementary_food',
  });
}

/** Mental health items for pregnancy and the first year. */
export function mentalHealthItems(c: RuleCtx): void {
  const { f, s, rules } = c;
  const m = f.mother;
  const epds = s.latest.epds;
  const due = mentalHealthScreenDue(c);
  if (due && !f.pregnant) {
    addItem(c, {
      id: 'mh.epds_screen',
      category: 'mental_health',
      title: 'Mood screen (EPDS) at 6 weeks',
      detail: `WHO PNC rec. 18: screen for postnatal depression and anxiety with a validated tool. ${m.country === 'NG' ? 'Nigerian cut-offs (Adewuya): ≥10 positive, ≥12 probable major depression.' : `Positive ≥${rules.epds.positive}; refer ≥${rules.epds.refer}.`} Item 10 positive: same-day action. Ask about violence at home in private.`,
      text: { key: 'mh.screen.after_birth' },
      priority: 3,
      audience: 'worker',
      dueDate: due,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec18', rules.epds.source),
      because: ['Postnatal screen due', hasCondition(f, 'depression_history') ? 'History of depression' : ''],
      illustration: 'talk_to_someone',
    });
  }
  if (epds !== undefined && epds >= rules.epds.positive) {
    addItem(c, {
      id: 'mh.thinking_healthy',
      category: 'mental_health',
      title: 'Thinking Healthy support sessions',
      detail: `EPDS ${epds}. WHO Thinking Healthy (CHW-delivered CBT): weekly sessions to identify unhelpful thoughts, practise healthier ones, and do small pleasant and baby-play activities; involve a family supporter. Rescreen in 2–4 weeks. ${epds >= rules.epds.refer ? 'Score is above the referral cut-off: also refer for assessment (stepped care, EXPONATE model).' : 'Refer if the score rises or she feels worse.'} Ask about violence at home in private (prior depression and marital violence predicted PPD in Ilorin).`,
      text: { key: 'mh.support' },
      priority: epds >= rules.epds.refer ? 1 : 2,
      dueDate: f.asOf,
      evidence: 'A',
      sources: cite('who-thinking-healthy-2015', rules.epds.source, 'exponate-2019', 'ppd-ilorin-2026'),
      because: [`EPDS ${epds}`, hasCondition(f, 'depression_history') ? 'History of depression' : ''],
      locked: epds >= rules.epds.refer ? true : undefined,
      illustration: 'talk_to_someone',
    });
  } else if (hasCondition(f, 'depression_history') || s.recentSymptoms.includes('low_mood') || s.recentSymptoms.includes('anxiety') || s.recentSymptoms.includes('insomnia')) {
    addItem(c, {
      id: 'mh.check_in',
      category: 'mental_health',
      title: 'Check in on her mood',
      detail: `${hasCondition(f, 'depression_history') ? 'History of depression (strongest predictor of postpartum depression in Nigerian data). ' : ''}${s.recentSymptoms.some((x) => ['low_mood', 'anxiety', 'insomnia'].includes(x)) ? 'She reported low mood, worry or poor sleep. ' : ''}Ask how she is feeling at each contact; screen with EPDS if not done in the last month.`,
      text: { key: 'mh.check_in' },
      priority: 3,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec18', 'ppd-ilorin-2026'),
      because: [hasCondition(f, 'depression_history') ? 'History of depression' : '', s.recentSymptoms.includes('low_mood') ? 'Reported low mood' : '', s.recentSymptoms.includes('anxiety') ? 'Reported anxiety' : ''],
      illustration: 'talk_to_someone',
    });
  }
}

/** Infant stage (42 days to 1,000 days): mother's own care alongside the baby. */
export function infantStageMotherRules(c: RuleCtx): void {
  const { f } = c;
  const name = f.youngest!.name;
  const age = f.youngestAgeDays!;
  addItem(c, {
    id: 'fp.spacing',
    category: 'family_planning',
    title: 'Birth spacing: wait 2 years before the next pregnancy',
    detail: `WHO birth spacing: at least 24 months from birth to the next conception. ${age < 183 && f.youngest!.feeding === 'exclusive_breastfeeding' ? 'LAM protects only until 6 months with full breastfeeding and no periods; plan a method now.' : 'Confirm she is using a method she is happy with; offer implants, injectables or IUD.'}`,
    text: { key: 'fp.spacing' },
    priority: 3,
    evidence: 'A',
    sources: cite('who-birth-spacing-2005', 'who-pnc-2022-rec24', 'ng-tsts-2025'),
    because: [`${name} is ${babyAge(age)} old`],
    illustration: 'family_planning',
  });
  if (age <= 365) foodAdvice(c, 'lactation');
  mentalHealthItems(c);
}

/** Preconception: folic acid, FP, screening. */
export function preconceptionRules(c: RuleCtx): void {
  const { f } = c;
  const m = f.mother;
  const scd = hasCondition(f, 'sickle_cell_disease') || m.genotype === 'SS' || m.genotype === 'SC';
  addItem(c, {
    id: scd ? 'med.folic_acid_scd' : 'med.folic_acid_preconception',
    category: 'medication',
    title: scd ? 'Folic acid daily (sickle cell disease)' : 'Folic acid 400 µg daily if planning pregnancy',
    detail: scd
      ? 'Women with SCD take folic acid daily (Nigerian practice 5 mg; WHO 2025 SCD guideline). Plan pregnancy with the specialist team.'
      : 'WHO: 400 µg folic acid daily from when she starts trying to conceive until 12 weeks of pregnancy, to prevent neural tube defects.',
    text: { key: scd ? 'med.folic_acid_scd' : 'med.folic_acid_preconception' },
    priority: 3,
    evidence: 'A',
    sources: cite(scd ? 'who-scd-2025-summary' : 'who-folic-periconception'),
    because: [scd ? `Sickle cell disease (${m.genotype})` : 'Not currently pregnant', ...(scd && COUNTRY_SCD_NOTE(m.country) ? [COUNTRY_SCD_NOTE(m.country)!] : [])],
    illustration: 'iron_tablet',
  });
  addItem(c, {
    id: 'fp.preconception',
    category: 'family_planning',
    title: 'Family planning and pregnancy timing',
    detail: 'Ask whether she wants a pregnancy now or later; offer a method if later. If she may be pregnant (late period), book ANC by 12 weeks.',
    text: { key: 'fp.timing' },
    priority: 4,
    evidence: 'A',
    sources: cite('who-birth-spacing-2005'),
    because: ['Not currently pregnant'],
    illustration: 'family_planning',
  });
  mentalHealthItems(c);
}

function COUNTRY_SCD_NOTE(country: string): string | undefined {
  return country === 'NG' ? 'Dose to be confirmed by clinical advisory board (WHO 2025 vs national practice)' : undefined;
}

