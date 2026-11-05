import { cite, FREE_PROGRAMMES } from '../clinical';
import { addDays, daysBetween, dayMs, ordinal, shortDate } from './dates';
import { hasCondition, labNumber, labPositive, latestLab, maternalVaccines, medsMatching, ofKind, onMedication, recentSymptoms } from './facts';
import { addItem, cap, list, type RuleCtx } from './items';
import { ancPlan } from './schedule';
import { foodAdvice } from './rulesNutrition';

/** Antenatal rules: WHO ANC 2016 package, adapted per country. */
export function pregnancyRules(c: RuleCtx): void {
  const { f, s, rules } = c;
  const m = f.mother;
  const ga = f.ga!;
  const lmp = f.lmp!;
  const atWeek = (w: number) => addDays(lmp, w * 7);
  const scd = hasCondition(f, 'sickle_cell_disease') || m.genotype === 'SS' || m.genotype === 'SC';
  const hiv = hasCondition(f, 'hiv') || labPositive(latestLab(f, 'hiv'));
  const riskCodes = new Set(s.risks.map((r) => r.code));
  const gaText = `${ga} weeks`;

  // ---------- Visits: 8-contact schedule ----------
  const anc = ancPlan(f)!;
  if (anc.next) {
    const n = anc.next;
    const overdue = n.overdueDays > 0;
    addItem(c, {
      id: 'visit.anc_next',
      category: 'visits',
      title: n.contactNumber === 1 ? 'Book first antenatal contact' : n.missedWeek ? `ANC contact ${n.contactNumber} overdue: see her now` : `ANC contact ${n.contactNumber} at ${n.week} weeks`,
      detail: `${n.contactNumber === 1 ? (n.lateBooking ? `She is ${gaText} and not yet booked: book now (WHO: first contact by 12 weeks).` : 'First contact by 12 weeks.') : `Next of the 8 WHO contacts (12, 20, 26, 30, 34, 36, 38, 40 weeks), due ${shortDate(n.due)}.`}${n.missedWeek ? ` The ${n.missedWeek}-week contact was missed (${n.overdueDays} days ago); see her now and then follow the schedule.` : overdue ? ` Overdue by ${n.overdueDays} days: call her today.` : ''} At each contact: BP, urine protein, weight, fundal height, fetal heart and movements, danger signs, IPTp if due, IFA refill, mood check.${m.country === 'GH' ? ' Ask her to bring her MCH Record Book.' : ''}`,
      text: n.contactNumber === 1 ? { key: 'visit.anc_next.booking' } : overdue ? { key: 'visit.anc_next.overdue' } : { key: 'visit.anc_next.date', params: { date: shortDate(n.due) } },
      priority: overdue || n.lateBooking ? 2 : 3,
      timing: n.contactNumber === 1 ? 'As soon as possible' : `${n.week} weeks`,
      dueDate: n.due,
      evidence: 'A',
      sources: cite('who-anc-2016-e7', ...(m.country === 'NG' ? ['ng-mip-2018'] : m.country === 'GH' ? ['gh-mch-record-book'] : [])),
      because: [`${cap(gaText)} pregnant`, `${anc.attended} of 8 contacts attended so far`, n.missedWeek ? `The ${n.missedWeek}-week contact was missed` : overdue ? `Contact ${n.contactNumber} was due ${shortDate(n.due)}` : ''],
      illustration: 'clinic_visit',
    });
  }
  if (anc.remaining.length > 0) {
    addItem(c, {
      id: 'visit.anc_schedule',
      category: 'visits',
      title: 'Remaining antenatal contacts',
      detail: `Planned: ${anc.remaining.map((r) => `${r.week} wk (${shortDate(r.due)})`).join(', ')}. If not delivered by 41 weeks, she returns for assessment.`,
      text: { key: 'visit.anc_schedule', params: { dates: anc.remaining.map((r) => shortDate(r.due)).join(', ') } },
      priority: 4,
      evidence: 'A',
      sources: cite('who-anc-2016-e7'),
      because: [`EDD ${shortDate(f.edd!)}`],
      illustration: 'calendar',
    });
  }

  // ---------- Danger signs ----------
  addItem(c, {
    id: 'danger.pregnancy',
    category: 'danger_signs',
    title: 'Pregnancy danger signs: go to the facility now',
    detail: 'Teach and check understanding at every contact (WHO SMART ANC danger signs): bleeding, fits, severe headache or blurred vision, fever, severe belly pain, water leaking, baby moving less (after 28 weeks), swelling of face or hands, fast or difficult breathing, severe vomiting. Agree how she will reach the facility at any hour.',
    text: { key: 'danger.pregnancy' },
    priority: 1,
    evidence: 'A',
    sources: cite('who-smart-anc-danger', 'who-anc-2016-b21'),
    because: [`${cap(gaText)} pregnant`],
    locked: true,
    illustration: ga >= 28 ? 'danger_baby_movement' : 'danger_bleeding',
  });

  // ---------- Iron and folic acid ----------
  const hbLab = latestLab(f, 'haemoglobin', lmp);
  const hb = labNumber(hbLab);
  if (scd) {
    // WHO 2025 SCD guideline vs Nigerian practice: flagged for the clinical advisory board.
    const onSp = c.location?.malariaEndemic ?? (rules.iptp === 'all' || (rules.iptpRegions ?? []).includes(m.region));
    if (rules.scdFolicAcid === 'national_5mg') {
      addItem(c, {
        id: 'med.folic_acid_high_dose',
        category: 'medication',
        title: 'Folic acid 5 mg daily (sickle cell disease); no routine iron',
        detail: 'Nigerian practice for women with sickle cell disease: folic acid 5 mg daily throughout pregnancy. Do NOT give routine iron; iron only if iron deficiency is confirmed by the specialist team (WHO 2025). Conflict to note: WHO 2025 advises up to 5 mg only outside malaria-endemic areas, and 400 µg for women receiving IPTp-SP so as not to reduce SP efficacy. Nigeria is malaria-endemic, so the specialist must agree the folic acid dose together with the malaria prevention plan.',
        text: { key: 'med.folic_acid_high_dose' },
        priority: 2,
        timing: 'Daily through pregnancy and after birth',
        evidence: 'B',
        sources: cite('who-scd-2025-summary', 'who-scd-2025'),
        because: [`Sickle cell disease (${m.genotype})`, 'Dose to be confirmed by clinical advisory board (WHO 2025 vs national practice)'],
        illustration: 'iron_tablet',
      });
    } else {
      const highDoseOk = !onSp;
      addItem(c, {
        id: 'med.folic_acid_scd',
        category: 'medication',
        title: `Folic acid ${highDoseOk ? 'up to 5 mg' : '400 µg'} daily (sickle cell disease); no routine iron`,
        detail: `WHO 2025 SCD-in-pregnancy guideline: ${highDoseOk ? 'outside IPTp-SP areas, folic acid up to 5 mg daily' : 'women receiving IPTp-SP take folic acid 400 µg so as not to reduce SP efficacy'}. Iron is not routine; give only if iron deficiency is confirmed.`,
        text: { key: 'med.folic_acid_scd' },
        priority: 2,
        timing: 'Daily through pregnancy',
        evidence: 'B',
        sources: cite('who-scd-2025-summary', 'who-scd-2025'),
        because: [`Sickle cell disease (${m.genotype})`, onSp ? 'Receiving IPTp-SP' : 'Not in an IPTp-SP area'],
        illustration: 'iron_tablet',
      });
    }
  } else if (hb !== undefined && hb < 11) {
    // WHO 2012: treat anaemia with 120 mg elemental iron + 400 µg folic acid daily until Hb normal.
    addItem(c, {
      id: 'med.iron_treatment',
      category: 'medication',
      title: 'Treatment-dose iron for anaemia',
      detail: `Hb ${hb} g/dL on ${shortDate(hbLab!.at)}. WHO: treat with 120 mg elemental iron + 400 µg folic acid daily until Hb is normal (≥11 g/dL), then return to 60 mg + 400 µg. Prescribed by the midwife or doctor; check malaria (RDT) and give deworming after the first trimester. Recheck Hb in 4 weeks. Take with orange or tomato, not with tea, pap or calcium.`,
      text: { key: 'med.iron_treatment' },
      priority: hb < 7 ? 1 : 2,
      timing: 'Daily until Hb ≥11, then preventive dose',
      evidence: 'A',
      sources: cite('who-ifa-2012', 'who-anc-2016-a21', 'who-anc-2016-b11'),
      because: [`Hb ${hb} g/dL (anaemia below 11 in pregnancy)`],
      illustration: 'iron_tablet',
    });
  } else {
    addItem(c, {
      id: 'med.iron_folate',
      category: 'medication',
      title: 'Iron and folic acid every day',
      detail: `Daily oral iron 60 mg elemental + folic acid 400 µg (WHO A.2.1 allows 30–60 mg; 60 mg preferred where anaemia in pregnancy is common, as in ${m.country === 'NG' ? 'Nigeria' : m.country === 'GH' ? 'Ghana (51%)' : 'Kenya'}). Continue to 3 months after birth. Side effects (nausea, dark stools, constipation) ease if taken at night with food. Not with tea, pap or calcium tablets.`,
      text: { key: 'med.iron_folate' },
      priority: 2,
      timing: 'Daily until 3 months after birth',
      evidence: 'A',
      sources: cite('who-anc-2016-a21'),
      because: [`${cap(gaText)} pregnant`, hb !== undefined ? `Hb ${hb} g/dL` : 'Hb not yet checked'],
      illustration: 'iron_tablet',
    });
  }

  // ---------- Calcium ----------
  if (rules.lowCalciumIntake) {
    const highPe = riskCodes.has('pre_eclampsia_high_risk');
    addItem(c, {
      id: 'med.calcium',
      category: 'medication',
      title: 'Calcium 1.5–2 g daily',
      detail: `WHO A.3 (context-specific, populations with low dietary calcium): 1.5–2 g elemental calcium daily in divided doses from 20 weeks to the end of pregnancy, to reduce pre-eclampsia. Take at least 2 hours apart from iron.${highPe ? ' Especially important: she is at high risk of pre-eclampsia.' : ''}`,
      text: { key: 'med.calcium' },
      priority: highPe ? 2 : 3,
      timing: ga < 20 ? 'From 20 weeks' : 'Daily until birth',
      dueDate: ga < 20 ? atWeek(20) : undefined,
      evidence: 'B',
      sources: cite('who-anc-2016-a3'),
      because: ['Low dietary calcium is common in her community', highPe ? 'High pre-eclampsia risk' : ''],
      illustration: 'medicine',
    });
  }

  // ---------- Aspirin for high pre-eclampsia risk ----------
  const peRisk = s.risks.find((r) => r.code === 'pre_eclampsia_high_risk');
  if (peRisk && ga < 36) {
    const taking = onMedication(f, /aspirin/i);
    addItem(c, {
      id: 'med.aspirin',
      category: 'medication',
      title: 'Low-dose aspirin to prevent pre-eclampsia',
      detail: `High pre-eclampsia risk (${peRisk.reason.replace(/\.$/, '')}). WHO 2021: low-dose aspirin 75 mg daily (NICE uses 75–150 mg), starting from 12 weeks, ideally before 16 and before 20 weeks, or as soon as care begins if later; continue until birth. Must be prescribed by the midwife or doctor (not a CHEW standing-order drug): ${taking ? 'she is taking it; check adherence.' : ga < 12 ? `arrange prescription to start at 12 weeks (${shortDate(atWeek(12))}).` : 'refer for prescription now.'}`,
      text: { key: 'med.aspirin' },
      priority: 1,
      timing: 'Nightly from 12 weeks until birth',
      dueDate: ga < 12 ? atWeek(12) : taking ? undefined : f.asOf,
      evidence: 'B',
      sources: cite('who-aspirin-2021', 'perinatology-pe-criteria'),
      because: [peRisk.reason, taking ? 'Already prescribed' : 'Not yet started'],
      locked: true,
      illustration: 'medicine',
    });
  }

  // ---------- Malaria: IPTp-SP and nets ----------
  const malariaZone = c.location?.malariaEndemic ?? (rules.iptp === 'all' || (rules.iptpRegions ?? []).includes(m.region));
  const onCotrimoxazole = onMedication(f, /cotrimoxazole|co-trimoxazole|septrin/i);
  if (malariaZone) {
    const doses = medsMatching(f, /\b(sp|iptp|sulfadoxine|fansidar)\b/i, lmp);
    const last = doses[doses.length - 1];
    const earliest = atWeek(13);
    const nextDue = last ? addDays(last.at, 28) : earliest;
    const due = dayMs(nextDue) > dayMs(earliest) ? nextDue : earliest;
    const ke = m.country === 'KE';
    const scdNote = scd ? ' Sickle cell disease: agree the malaria prevention plan with the specialist (SP and high-dose folic acid interact; Nigerian practice often uses proguanil, unverified).' : '';
    addItem(c, {
      id: 'med.iptp',
      category: 'medication',
      title: onCotrimoxazole ? 'Malaria prevention: no SP while on cotrimoxazole' : `IPTp-SP malaria prevention (dose ${doses.length + 1})`,
      detail: onCotrimoxazole
        ? 'She takes cotrimoxazole (HIV). Do not give SP; cotrimoxazole protects against malaria. Keep the treated net.'
        : `WHO C.6: sulfadoxine-pyrimethamine as directly observed therapy at each scheduled contact from 13 weeks (second trimester), doses at least 1 month apart, aim for 3 or more. ${doses.length} dose${doses.length === 1 ? '' : 's'} given this pregnancy${last ? `, last on ${shortDate(last.at)}` : ''}; next ${ga < 13 ? `from 13 weeks (${shortDate(earliest)})` : `due ${shortDate(due)}`}. Not in the first trimester.${ke ? ` Kenya gives IPTp only in malaria-endemic zones; ${m.region} is endemic.` : ''} CHEWs may give IPTp under task-sharing (WHO E.5.2).${scdNote}`,
      text: { key: onCotrimoxazole ? 'med.iptp.cotrimoxazole' : ga < 13 ? 'med.iptp.later' : 'med.iptp' },
      priority: 2,
      timing: 'Each scheduled contact from 13 weeks, ≥4 weeks apart',
      dueDate: onCotrimoxazole ? undefined : due,
      evidence: 'B',
      sources: cite('who-anc-2016-c6', 'who-mip-anc-brief', ...(m.country === 'NG' ? ['ng-mip-2018'] : [])),
      because: [ke ? `Lives in ${m.region}, a malaria-endemic county` : 'Lives in a malaria-endemic area', c.location?.malariaEndemic !== undefined ? 'Malaria status from location profile' : '', `${cap(gaText)} pregnant`, `${doses.length} IPTp dose${doses.length === 1 ? '' : 's'} so far`, scd ? 'Dose to be confirmed by clinical advisory board (WHO 2025 vs national practice)' : ''],
      locked: true,
      illustration: 'medicine',
    });
  }
  addItem(c, {
    id: 'rest.itn',
    category: 'rest_and_sleep',
    title: 'Sleep under a treated mosquito net every night',
    detail: `Insecticide-treated net for her and, after birth, the baby.${m.country === 'KE' && !malariaZone ? ` Kenya gives IPTp only in malaria-endemic zones; ${m.region} is not malaria-endemic, so the net is her main protection when travelling to endemic areas.` : ' Nets are free at ANC in public facilities.'}`,
    text: { key: 'rest.itn' },
    priority: 3,
    evidence: 'A',
    sources: cite('who-anc-2016-c6', 'ng-mip-2018'),
    because: [malariaZone ? 'Malaria-endemic area' : 'Malaria risk when travelling'],
    illustration: 'mosquito_net',
  });

  // ---------- Tetanus-diphtheria ----------
  const td = maternalVaccines(f).flatMap((e) => e.vaccines);
  const tdThisPreg = maternalVaccines(f).filter((e) => dayMs(e.at) >= dayMs(lmp));
  if (tdThisPreg.length < 2) {
    addItem(c, {
      id: 'imm.td',
      category: 'immunisation',
      title: 'Tetanus-diphtheria (Td) vaccine',
      detail: `WHO C.5: check tetanus vaccination status at every contact and vaccinate according to previous doses. ${td.length} dose${td.length === 1 ? '' : 's'} recorded in total, ${tdThisPreg.length} this pregnancy. With no previous doses: 2 doses 4 weeks apart, the second at least 2 weeks before birth. Protects her and the newborn from tetanus (only 58% of Nigerian births protected, NDHS 2023–24).`,
      text: { key: 'imm.td' },
      priority: 3,
      dueDate: f.asOf,
      evidence: 'A',
      sources: cite('who-anc-2016-c5', 'ng-ndhs-2024'),
      because: [`${tdThisPreg.length} Td dose${tdThisPreg.length === 1 ? '' : 's'} recorded this pregnancy`],
      illustration: 'vaccination',
    });
  }

  // ---------- Tests ----------
  const done = (t: Parameters<typeof latestLab>[1]) => latestLab(f, t, lmp);
  const missingTests = [
    !done('hiv') && !hiv ? 'HIV' : '',
    !done('syphilis') ? 'syphilis' : '',
    !done('hepatitis_b') && !hasCondition(f, 'hepatitis_b') ? 'hepatitis B' : '',
  ].filter(Boolean);
  addItem(c, {
    id: 'test.hiv_syphilis_hbv',
    category: 'tests',
    title: missingTests.length ? `Test for ${list(missingTests)}` : 'HIV, syphilis and hepatitis B tests done',
    detail: missingTests.length
      ? `Provider-initiated testing at first contact (WHO B.1.7); dual HIV/syphilis rapid test where available. Retest HIV in the third trimester per national guideline. Missing: ${list(missingTests)}.`
      : 'Booking tests recorded. Retest HIV in the third trimester per national guideline if negative.',
    text: { key: 'test.hiv_syphilis_hbv' },
    priority: missingTests.length ? 2 : 5,
    dueDate: missingTests.length ? f.asOf : undefined,
    evidence: 'A',
    sources: cite('who-anc-2016-b17'),
    because: [missingTests.length ? `No ${list(missingTests)} result this pregnancy` : 'Results recorded'],
    illustration: 'test_tube',
    status: missingTests.length ? 'active' : 'done',
  });
  const hbDueThird = ga >= 28 && (!hbLab || daysBetween(hbLab.at, f.asOf) > 56);
  if (!hbLab || hbDueThird) {
    addItem(c, {
      id: 'test.haemoglobin',
      category: 'tests',
      title: 'Check haemoglobin',
      detail: `Hb by haemoglobinometer or FBC (WHO B.1.1) at booking and again in the third trimester. ${hbLab ? `Last Hb ${hb} g/dL on ${shortDate(hbLab.at)}.` : 'No Hb recorded this pregnancy.'}`,
      text: { key: 'test.blood_level' },
      priority: 3,
      dueDate: f.asOf,
      evidence: 'B',
      sources: cite('who-anc-2016-b11'),
      because: [hbLab ? `Last Hb more than 8 weeks ago, now ${gaText}` : 'No Hb this pregnancy'],
      illustration: 'test_tube',
    });
  }
  if (m.genotype === 'unknown') {
    addItem(c, {
      id: 'test.genotype',
      category: 'tests',
      title: 'Check genotype (sickle cell)',
      detail: 'Genotype unknown. Sickle cell disease is common in Nigeria and needs a specialist pathway; AS mothers need partner testing to counsel on the baby.',
      text: { key: 'test.genotype' },
      priority: 3,
      dueDate: f.asOf,
      evidence: 'C',
      sources: cite('who-scd-2025'),
      because: ['Genotype not recorded'],
      illustration: 'test_tube',
    });
  }
  if (ga < 24 && !done('ultrasound')) {
    addItem(c, {
      id: 'test.ultrasound',
      category: 'tests',
      title: 'One ultrasound scan before 24 weeks',
      detail: `WHO B.2.4: one scan before 24 weeks to date the pregnancy, find twins and check the placenta and baby. Book before ${shortDate(atWeek(24))}.`,
      text: { key: 'test.ultrasound' },
      priority: 3,
      dueDate: atWeek(Math.min(23, Math.max(ga, 18))),
      evidence: 'A',
      sources: cite('who-anc-2016-b24'),
      because: [`${cap(gaText)}, no scan recorded`],
      illustration: 'clinic_visit',
    });
  }
  // GDM: WHO makes no universal-screening recommendation; screen by risk with 75 g OGTT at 24–28 weeks.
  const glycosuria = labPositive(latestLab(f, 'urine_glucose', lmp)) || (labNumber(latestLab(f, 'urine_glucose', lmp)) ?? 0) > 0;
  const gdmReasons = [
    (f.bmi ?? 0) >= 30 || hasCondition(f, 'obesity') ? (f.bmi ? `BMI ${f.bmi}` : 'obesity') : '',
    m.age >= 35 ? `age ${m.age}` : '',
    m.previousStillbirth ? 'previous stillbirth' : '',
    glycosuria ? 'glucose in urine' : '',
  ].filter(Boolean);
  if (riskCodes.has('gdm') || hasCondition(f, 'diabetes_preexisting')) {
    addItem(c, {
      id: 'med.diabetes_care',
      category: 'medication',
      title: hasCondition(f, 'diabetes_preexisting') ? 'Diabetes in pregnancy: doctor-led care' : 'Gestational diabetes: diet, activity and glucose checks',
      detail: 'Refer for doctor or diabetes-clinic management (diet, glucose monitoring, medicine if needed); plan birth at a facility with newborn care. Regular meals; swap sugary drinks for water; more beans and vegetables, smaller portions of starch.',
      text: { key: 'med.diabetes_care' },
      priority: 2,
      evidence: 'B',
      sources: cite('iadpsg-gdm', 'who-anc-2016-b14'),
      because: [s.risks.find((r) => r.code === 'gdm' || r.code === 'diabetes')?.reason ?? 'Diabetes'],
      locked: true,
      illustration: 'balanced_plate',
    });
  } else if (gdmReasons.length && !done('ogtt_2h')) {
    addItem(c, {
      id: 'test.gdm',
      category: 'tests',
      title: 'Glucose tolerance test at 24–28 weeks',
      detail: `Risk-based screening (WHO makes no universal-screening recommendation): 75 g OGTT at 24–28 weeks. GDM if fasting ≥5.1, 1 h ≥10.0 or 2 h ≥8.5 mmol/L (IADPSG/WHO 2013).`,
      text: { key: 'test.sugar' },
      priority: 3,
      dueDate: ga < 24 ? atWeek(24) : f.asOf,
      evidence: 'B',
      sources: cite('iadpsg-gdm', 'who-anc-2016-b14'),
      because: gdmReasons.map(cap),
      illustration: 'test_tube',
    });
  }

  // ---------- Deworming ----------
  const dewormed = medsMatching(f, /albendazole|mebendazole|deworm/i, lmp).length > 0;
  if (!dewormed) {
    addItem(c, {
      id: 'med.deworming',
      category: 'medication',
      title: 'Deworming after the first trimester',
      detail: 'WHO C.4 (context-specific, endemic areas): single dose albendazole 400 mg or mebendazole 500 mg after the first trimester, given by an authorised provider.',
      text: { key: 'med.deworming' },
      priority: 4,
      dueDate: ga < 14 ? atWeek(14) : f.asOf,
      evidence: 'B',
      sources: cite('who-anc-2016-c4'),
      because: ['No deworming recorded this pregnancy', hb !== undefined && hb < 11 ? `Hb ${hb} g/dL` : ''],
      illustration: 'medicine',
    });
  }

  // ---------- HIV: PMTCT ----------
  if (hiv) {
    addItem(c, {
      id: 'med.art_pmtct',
      category: 'medication',
      title: 'HIV treatment every day (prevents passing HIV to baby)',
      detail: 'Lifelong ART for all pregnant and breastfeeding women with HIV (WHO consolidated guidelines). Check adherence and viral load per national PMTCT guideline; plan infant ARV prophylaxis and early infant diagnosis at 6 weeks. Do not give IPTp-SP if she takes cotrimoxazole. Ask privately about herbs, which may interact with ARVs.',
      text: { key: 'med.art' },
      priority: 1,
      evidence: 'A',
      sources: cite('who-hiv-2021', 'herb-drug-2026'),
      because: ['Living with HIV'],
      locked: true,
      illustration: 'medicine',
    });
  }

  // ---------- Sickle cell disease pathway ----------
  if (scd) {
    addItem(c, {
      id: 'visit.scd_specialist',
      category: 'visits',
      title: 'Specialist sickle cell pregnancy care',
      detail: `WHO 2025: multidisciplinary care (obstetrician, haematologist, midwife, paediatrician) at ${rules.referralHospital}; fetal growth scans every 4 weeks from 24 to 32 weeks, then every 3 weeks to birth; individual pain plan; consider hydroxyurea after the first trimester by shared decision; thromboprophylaxis assessment. Plan birth at a facility with blood and specialist care.`,
      text: { key: 'visit.scd_specialist' },
      priority: 1,
      dueDate: ga >= 24 ? f.asOf : atWeek(24),
      evidence: 'B',
      sources: cite('who-scd-2025', 'who-scd-2025-summary'),
      because: [`Sickle cell disease (${m.genotype})`],
      locked: true,
      illustration: 'clinic_visit',
    });
  }

  // ---------- Common symptoms (WHO ANC D recommendations) ----------
  const { mother: sx } = recentSymptoms(f, 14);
  const comfort: Array<[string, string, string, string]> = [];
  if (sx.includes('nausea_vomiting')) comfort.push(['nausea', 'Nausea: ginger, chamomile or vitamin B6; small dry snacks.', 'educ.symptom.nausea', 'nausea_vomiting']);
  if (sx.includes('heartburn')) comfort.push(['heartburn', 'Heartburn: small meals, avoid lying down after eating; antacid if needed.', 'educ.symptom.heartburn', 'heartburn']);
  if (sx.includes('leg_cramps')) comfort.push(['leg cramps', 'Leg cramps: stretching; magnesium or calcium may help.', 'educ.symptom.leg_cramps', 'leg_cramps']);
  if (sx.includes('constipation')) comfort.push(['constipation', 'Constipation: more water, fruit, vegetables and beans (fibre).', 'educ.symptom.constipation', 'constipation']);
  if (sx.includes('back_pain')) comfort.push(['back pain', 'Back or pelvic pain: regular exercise, support belt, warm compress.', 'educ.symptom.back_pain', 'back_pain']);
  // One item per discomfort, so each has its own translatable template.
  for (const [label, workerText, key, code] of comfort) {
    addItem(c, {
      id: `educ.symptom_${code}`,
      category: 'education',
      title: `Comfort for ${label}`,
      detail: `WHO ANC D.1–D.6 (recommended): ${workerText}`,
      text: { key },
      priority: 4,
      evidence: 'A',
      sources: cite('who-anc-2016-d'),
      because: [`Reported ${label}`],
      illustration: 'rest',
    });
  }

  // ---------- Nutrition ----------
  foodAdvice(c, 'pregnancy');
  addItem(c, {
    id: 'educ.substances',
    category: 'education',
    title: 'No alcohol or smoking; limit coffee and cola',
    detail: 'WHO B.1.5–B.1.6: ask about tobacco (and second-hand smoke) and alcohol at every contact; A.10: lower caffeine if over 300 mg a day (about 3 cups of coffee).',
    text: { key: 'educ.substances' },
    priority: 5,
    evidence: 'A',
    sources: cite('who-anc-2016-b15', 'who-anc-nutrition-2018'),
    because: ['Routine for every pregnancy'],
    illustration: 'water',
    audience: 'mother',
  });

  // ---------- Rest and activity ----------
  if (ga >= 28) {
    addItem(c, {
      id: 'rest.sleep_left_side',
      category: 'rest_and_sleep',
      title: 'Go to sleep on your side',
      detail: 'From 28 weeks, going to sleep on the back is linked to late stillbirth (IPD meta-analysis, aOR 2.63 vs left side). Advise settling to sleep on either side, left preferred; if she wakes on her back, just turn over.',
      text: { key: 'rest.sleep_side' },
      priority: 3,
      evidence: 'B',
      sources: cite('cronin-2019-sleep'),
      because: [`${cap(gaText)} (from 28 weeks)`],
      illustration: 'sleep_left_side',
    });
  }
  addItem(c, {
    id: 'activity.pregnancy',
    category: 'activity',
    title: 'Stay active: walk every day',
    detail: `WHO A.1.1: counsel on keeping physically active; regular exercise prevents back and pelvic pain.${riskCodes.has('hypertension_current') ? ' With raised BP, gentle walking only.' : ''} Avoid heavy lifting and very hard farm work late in pregnancy.`,
    text: { key: 'activity.pregnancy' },
    priority: 4,
    evidence: 'A',
    sources: cite('who-anc-2016-a1'),
    because: ['Healthy pregnancy'],
    illustration: 'walking',
  });

  // ---------- Birth preparedness ----------
  const highRiskBirth = s.risks.filter((r) =>
    ['previous_caesarean', 'grand_multipara', 'multiple_pregnancy', 'previous_pph', 'sickle_cell_disease', 'pre_eclampsia_high_risk', 'hypertension_current', 'adolescent', 'severe_anaemia', 'moderate_anaemia', 'previous_stillbirth', 'gdm', 'diabetes', 'hiv'].includes(r.code),
  );
  const homePlanned = m.pregnancy?.plannedBirthPlace === 'home' || m.pregnancy?.plannedBirthPlace === 'tba';
  if (highRiskBirth.length) {
    addItem(c, {
      id: 'birth.facility_cemonc',
      category: 'birth_preparedness',
      title: `Plan birth at a hospital that can do caesareans and transfusions`,
      detail: `High-risk birth: ${list(highRiskBirth.map((r) => r.label.toLowerCase()))}. Plan delivery at ${rules.referralHospital}${homePlanned ? '; she currently plans a home or TBA birth, so discuss this with her and her family' : ''}. Agree the route, transport and who decides when labour starts.`,
      text: { key: 'birth.hospital' },
      priority: 1,
      evidence: 'C',
      sources: cite('who-anc-2016', 'ng-mamii'),
      because: highRiskBirth.map((r) => r.label),
      locked: true,
      illustration: 'birth_bag',
    });
  } else if (homePlanned) {
    addItem(c, {
      id: 'birth.facility',
      category: 'birth_preparedness',
      title: 'Plan to give birth with a skilled attendant',
      detail: `She plans a ${m.pregnancy?.plannedBirthPlace === 'tba' ? 'TBA' : 'home'} birth. Explore why (cost, respect, distance, family). Offer the TBA or a relative as her companion at the facility. If she stays home, the 24-hour postnatal check and birth vaccines must be arranged in advance.`,
      text: { key: 'birth.skilled' },
      priority: 2,
      evidence: 'A',
      sources: cite('tba-2026', 'who-pnc-2022-rec44'),
      because: [`Planned birth place: ${m.pregnancy?.plannedBirthPlace}`],
      illustration: 'birth_bag',
    });
  }
  if (ga >= 24 || highRiskBirth.length) {
    addItem(c, {
      id: 'birth.plan',
      category: 'birth_preparedness',
      title: 'Birth plan: place, transport, money, companion',
      detail: `Agree: where she will give birth; how to get there at night (phone numbers of a driver or emergency transport); money saved for transport and supplies${m.incomeBand === 'very_low' || m.incomeBand === 'low' ? ` (${FREE_PROGRAMMES[m.country]})` : ''}; who will come with her and who cares for other children; a birth bag (clean cloths, baby clothes, pads, wrapper)${m.country === 'GH' ? ', and her MCH Record Book' : ''}. ${rules.financing}`,
      text: { key: 'birth.plan' },
      priority: ga >= 32 ? 2 : 3,
      dueDate: ga < 32 ? atWeek(32) : f.asOf,
      evidence: 'C',
      sources: cite('who-anc-2016', rules.financingSource),
      because: [`${cap(gaText)}`, `Income: ${m.incomeBand.replace('_', ' ')}`],
      illustration: 'birth_bag',
    });
  }
  const donorReasons = s.risks.filter((r) => ['previous_pph', 'grand_multipara', 'multiple_pregnancy', 'sickle_cell_disease', 'severe_anaemia', 'moderate_anaemia', 'previous_caesarean'].includes(r.code));
  if (donorReasons.length && ga >= 28) {
    addItem(c, {
      id: 'birth.blood_donor',
      category: 'birth_preparedness',
      title: 'Identify two blood donors',
      detail: `Higher bleeding risk (${list(donorReasons.map((r) => r.label.toLowerCase()))}). Ask her to name two healthy relatives who will come with her and can donate blood${m.bloodGroup ? ` (her group: ${m.bloodGroup})` : '; check her blood group'}.`,
      text: { key: 'birth.blood_donor' },
      priority: 2,
      evidence: 'C',
      sources: cite('who-anc-2016'),
      because: donorReasons.map((r) => r.label),
      illustration: 'family_support',
    });
  }
  if (m.country === 'KE') {
    addItem(c, {
      id: 'birth.sha_registration',
      category: 'birth_preparedness',
      title: 'Register with SHA before labour',
      detail: 'Linda Jamii (SHA) covers ANC, delivery and PNC, but registration is required before labour; registration in labour is no longer accepted. Help her register now.',
      text: { key: 'birth.sha' },
      priority: 2,
      dueDate: f.asOf,
      evidence: 'C',
      sources: cite('ke-linda-jamii'),
      because: ['Kenya: maternity cover needs prior SHA registration'],
      illustration: 'calendar',
    });
  }
  if (ga >= 36 || (f.edd && daysBetween(f.asOf, f.edd) <= 28)) {
    addItem(c, {
      id: 'visit.birth_notification',
      category: 'visits',
      title: 'Birth notification: tell us the day the baby comes',
      detail: `EDD ${shortDate(f.edd!)}. Ask her or a named family member to send a message or call the ${rules.cadre} as soon as the baby is born (wherever the birth happens), so the 24-hour postnatal check, birth vaccines and cord care happen on time.${m.phone.access === 'none' ? ' She has no phone: agree whose phone will be used.' : ''}`,
      text: { key: 'visit.birth_notification' },
      priority: 2,
      dueDate: f.edd,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec44'),
      because: [`EDD ${shortDate(f.edd!)}`],
      illustration: 'phone_call',
    });
  }

  // ---------- Breastfeeding preparation ----------
  if (ga >= 28) {
    addItem(c, {
      id: 'bf.prepare',
      category: 'breastfeeding',
      title: 'Get ready to breastfeed',
      detail: 'Counsel before birth: skin-to-skin and breastfeeding within the first hour, colostrum is the first food, nothing else (no water, glucose, pap or herbs) until 6 months, feed on demand 8–12 times a day. Involve the grandmother and partner, who often decide on prelacteal feeds.',
      text: { key: 'bf.prepare' },
      priority: 3,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec42', 'agho-2016-prelacteal', 'costenbader-2025-bf'),
      because: [`${cap(gaText)}`, m.parity === 0 ? 'First baby' : `${ordinal(m.parity + 1)} baby`],
      illustration: 'breastfeeding',
    });
  }

  // ---------- Family planning (counsel before birth) ----------
  if (ga >= 32) {
    addItem(c, {
      id: 'fp.plan_postpartum',
      category: 'family_planning',
      title: 'Choose a family planning method for after birth',
      detail: 'Counsel in late pregnancy so she can start a method soon after birth (implant or IUD can be placed before discharge). Spacing births at least 2 years apart lowers risk for her and the next baby.',
      text: { key: 'fp.plan_ahead' },
      priority: 4,
      evidence: 'A',
      sources: cite('who-pnc-2022-rec24', 'who-birth-spacing-2005'),
      because: [`${cap(gaText)}`, m.parity >= 3 ? `${m.parity} previous births` : ''],
      illustration: 'family_planning',
    });
  }

  // ---------- Mental health screening ----------
  const epdsDue = mentalHealthScreenDue(c);
  if (epdsDue) {
    addItem(c, {
      id: 'mh.epds_screen',
      category: 'mental_health',
      title: 'Mood screen (EPDS)',
      detail: `Screen with EPDS at booking, in the third trimester (32–36 weeks) and at 6 weeks after birth. ${m.country === 'NG' ? 'Nigerian validation (Adewuya): ≥10 positive screen, ≥12 probable major depression.' : `Positive ≥${rules.epds.positive}; refer ≥${rules.epds.refer}.`} Item 10 (self-harm) positive at any score: same-day action.`,
      text: { key: 'mh.screen.pregnancy' },
      priority: 3,
      audience: 'worker',
      dueDate: epdsDue,
      evidence: 'A',
      sources: cite(rules.epds.source, 'who-pnc-2022-rec18'),
      because: [ga < 16 ? 'Booking screen' : 'Third-trimester screen', hasCondition(f, 'depression_history') ? 'History of depression' : ''],
      illustration: 'talk_to_someone',
    });
  }

  // ---------- Adolescent ----------
  if (m.age < 18) {
    addItem(c, {
      id: 'family.adolescent',
      category: 'family_support',
      title: 'Adolescent mother: youth-friendly care',
      detail: `Age ${m.age}. Use the WHO DAK adolescent pathway: private, non-judgemental contacts; extra attention to anaemia, BP, nutrition and mood; involve a trusted adult${m.consent.guardianInvolved ? ' (guardian involved)' : ' if she agrees'}; support to stay in school.`,
      text: { key: 'family.young_mother' },
      priority: 3,
      evidence: 'C',
      sources: cite('who-smart-anc-dak'),
      because: [`Age ${m.age}`],
      illustration: 'family_support',
    });
  }
}

/** Is an EPDS screen due now? Returns a due date or undefined. */
export function mentalHealthScreenDue(c: RuleCtx): string | undefined {
  const { f } = c;
  const screens = ofKind(f, 'screening').filter((x) => x.instrument === 'epds');
  const since = (iso: string) => screens.some((x) => dayMs(x.at) >= dayMs(iso));
  if (f.pregnant && f.lmp && f.ga !== undefined) {
    if (!since(f.lmp)) return f.asOf; // booking screen
    const third = addDays(f.lmp, 32 * 7);
    if (f.ga >= 28 && !since(addDays(f.lmp, 28 * 7))) return f.ga >= 32 ? f.asOf : third;
    return undefined;
  }
  if (f.lastBirth && f.daysSinceBirth !== undefined) {
    const sixWk = addDays(f.lastBirth.date, 42);
    if (!since(addDays(f.lastBirth.date, 28))) return f.daysSinceBirth >= 42 ? f.asOf : sixWk;
  }
  return undefined;
}
