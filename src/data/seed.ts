import type { Channel, DemoState, InboundMessage, LanguageCode, LearnedRule, Mother, OutboundMessage, Override, RuleProposal } from '../types';
import { COUNTRIES, DEMO_START_CLOCK } from './countries';
import { FACILITIES, WORKERS } from './directory';
import { buildMothers } from './mothers';
import { CLOCK_MS, DAY_MS } from './seedKit';
import { estimateCost, parseSymptomsFromText } from '../messaging';

/** Ids of the mothers the demo script is built around. */
export const DEMO_STARS = {
  adaeze: 'm-ng-adaeze', // Lagos, 31 weeks, WhatsApp, mild anaemia, omugwo + nzu
  hauwa: 'm-ng-hauwa', // Kano, 17, 24 weeks, shared feature phone, cannot read, wankan jego
  funke: 'm-ng-funke', // Ibadan, day 5 postpartum, low milk supply, pap/ogi
  akinyi: 'm-ke-akinyi', // Kisumu, CHP case, HIV on ART
  abiba: 'm-gh-abiba', // Northern Region Ghana, CHO case, previous PPH, no phone
} as const;

const iso = (daysAgo: number, hour = 10, minute = 0) => new Date(Math.floor((CLOCK_MS - daysAgo * DAY_MS) / DAY_MS) * DAY_MS + hour * 3_600_000 + minute * 60_000).toISOString();

function overrides(): Override[] {
  return [
    // Two workers in different states propose the same change: a pending governance proposal.
    {
      id: 'ov-001',
      motherId: 'm-ng-funke',
      itemId: 'nutr.ogi_groundnut',
      action: 'add',
      item: {
        title: 'Ogi with groundnut paste for milk supply',
        category: 'nutrition',
        detail: 'Locally trusted lactation food. Thick ogi (pap) made fresh and enriched with groundnut paste and milk adds fluid, energy and protein. Pair with frequent, well-latched feeds; it does not replace them. No added kanwa.',
        motherText: 'Eat fresh ogi made thick with groundnut paste and milk, 2 times a day. Keep putting baby to the breast often.',
        priority: 3,
        audience: 'both',
      },
      reason: 'Mothers here trust ogi for milk. Adding groundnut paste turns it into real food (energy and protein), so we work with the practice instead of against it.',
      workerId: 'w-ng-folasade',
      createdAt: iso(1, 11, 20),
      proposeGlobal: true,
      status: 'active',
    },
    {
      id: 'ov-002',
      motherId: 'm-ng-zuwaira',
      itemId: 'nutr.ogi_groundnut',
      action: 'add',
      item: {
        title: 'Kunu gyada (groundnut pap) for milk supply',
        category: 'nutrition',
        detail: 'Kunu gyada (rice or millet pap cooked with groundnut milk) is the northern version of enriched pap. Families already give it after birth; encourage it with little or no kanwa.',
        motherText: 'Drink fresh kunu gyada (groundnut pap) every day. Use only a little kanwa. Keep baby on the breast often.',
        priority: 3,
        audience: 'both',
      },
      reason: 'Her mother already makes kunu for wankan jego. Groundnut kunu gives a small, preterm baby’s mother extra energy and protein; we just ask for little kanwa.',
      workerId: 'w-ng-zainab',
      createdAt: iso(2, 13, 5),
      proposeGlobal: true,
      status: 'active',
    },
    // Earlier override that led to the approved learned rule.
    {
      id: 'ov-003',
      motherId: 'm-ng-folake',
      itemId: 'nutr.scd_hydration',
      action: 'add',
      item: {
        title: 'Extra fluids and warmth (sickle cell)',
        category: 'nutrition',
        detail: 'Dehydration and cold trigger sickling crises. Counsel 3 litres of fluid a day (water, pap, soups), more in hot weather, and to keep warm; check urine colour.',
        motherText: 'Drink plenty of water every day, at least 12 cups. Keep your body warm. If your urine is dark, drink more.',
        priority: 2,
        audience: 'both',
      },
      reason: 'LUTH haematology asked for 3 L/day. Mothers with SCD in our clinic are not getting this advice from the standard plan.',
      workerId: 'w-ng-bisola',
      createdAt: iso(48, 12, 0),
      proposeGlobal: true,
      status: 'active',
    },
    // Patient-level only.
    {
      id: 'ov-004',
      motherId: 'm-ng-hauwa',
      itemId: 'family.guardian_at_visits',
      action: 'add',
      item: {
        title: 'Bring Hajiya Rabi (mother-in-law) to every visit',
        category: 'family_support',
        detail: 'Hauwa is 17 and cannot read; the shared phone is her mother-in-law’s. Decisions about transport and the birth place are made by the household, so the mother-in-law must hear the danger signs and birth plan directly.',
        motherText: 'Come to the clinic with Hajiya Rabi. She will help you remember what to do.',
        priority: 2,
        audience: 'both',
      },
      reason: 'Household decides about transport and birth place; she must hear the plan first-hand.',
      workerId: 'w-ng-zainab',
      createdAt: iso(20, 10, 40),
      proposeGlobal: false,
      status: 'active',
    },
    {
      id: 'ov-005',
      motherId: 'm-ng-saadatu',
      itemId: 'fp.spacing',
      action: 'remove',
      reason: 'Has an implant in place since 6 weeks after birth; spacing counselling already done.',
      workerId: 'w-ng-lami',
      createdAt: iso(60, 9, 30),
      proposeGlobal: false,
      status: 'active',
    },
    {
      id: 'ov-006',
      motherId: 'm-ng-omolara',
      itemId: 'nutr.protein_calcium',
      action: 'modify',
      item: {
        title: 'Diabetes-friendly plate',
        motherText: 'Half your plate vegetables (efo, ugu, garden egg), a quarter beans, fish or egg, a quarter unripe plantain or brown rice. No soft drinks or malt.',
      },
      reason: 'Has GDM: standard nutrition text pushes starchy staples; tailored to glucose control and her diet.',
      workerId: 'w-ng-bisola',
      createdAt: iso(14, 15, 10),
      proposeGlobal: false,
      status: 'active',
    },
    {
      id: 'ov-007',
      motherId: 'm-ke-nakiru',
      itemId: 'family.chp_translates',
      action: 'add',
      item: {
        title: 'CHP reads every message to her in Ng’aturkana',
        category: 'family_support',
        detail: 'No phone and cannot read; picture sheet left at home, CHP explains at each household visit.',
        motherText: 'Keep the picture sheet on the wall. Ekai will explain it at every visit.',
        priority: 3,
        audience: 'both',
      },
      reason: 'No phone, does not read; the only reliable channel is the CHP visit.',
      workerId: 'w-ke-ekai',
      createdAt: iso(55, 11, 0),
      proposeGlobal: false,
      status: 'reverted',
    },
  ];
}

function proposals(): RuleProposal[] {
  return [
    {
      id: 'prop.ov-001',
      title: 'Add "Ogi or kunu with groundnut paste for milk supply" for women in the postpartum stage in Nigeria',
      appliesWhen: { stage: 'postpartum', countries: ['NG'] },
      effect: 'add',
      itemId: 'nutr.ogi_groundnut',
      item: {
        title: 'Ogi or kunu with groundnut paste for milk supply',
        category: 'nutrition',
        detail: 'Families widely give pap (ogi, akamu, kunu) after birth to “bring the milk”. No trial shows ogi itself raises milk, but enriching it with groundnut paste and milk adds energy and protein (closest evidence: millet–soya drink RCT, Tamale). Encourage freshly made pap with little kanwa, alongside 8–12 well-latched feeds a day. Never give pap to the baby before 6 months.',
        motherText: 'Eat fresh ogi or kunu made with groundnut paste, 2 times a day. Keep putting baby to the breast often. Do not give pap to the baby.',
        priority: 3,
        audience: 'both',
      },
      rationale:
        '• Mothers here trust ogi for milk. Adding groundnut paste turns it into real food (energy and protein), so we work with the practice instead of against it.\n• Her mother already makes kunu for wankan jego. Groundnut kunu gives a small, preterm baby’s mother extra energy and protein; we just ask for little kanwa.',
      supportingOverrideIds: ['ov-001', 'ov-002'],
      supportingWorkerIds: ['w-ng-folasade', 'w-ng-zainab'],
      status: 'pending',
      createdAt: iso(2, 13, 5),
    },
    {
      id: 'prop.ov-003',
      title: 'Add "Extra fluids and warmth (sickle cell)" for women in the pregnancy stage with sickle cell disease',
      appliesWhen: { stage: 'pregnancy', conditionsAny: ['sickle_cell_disease'] },
      effect: 'add',
      itemId: 'nutr.scd_hydration',
      item: overrides()[2].item,
      rationale: '• LUTH haematology asked for 3 L/day. Mothers with SCD in our clinic are not getting this advice from the standard plan.',
      supportingOverrideIds: ['ov-003'],
      supportingWorkerIds: ['w-ng-bisola'],
      status: 'approved',
      reviewedBy: 'w-ng-bankole',
      reviewNote: 'Agree. Consistent with WHO 2025 SCD-in-pregnancy guidance on avoiding crisis triggers. Approved for all pregnant women with SCD; keep priority 2.',
      createdAt: iso(48, 12, 0),
      reviewedAt: iso(41, 16, 30),
    },
    {
      id: 'prop.ov-legacy-binder',
      title: 'Remove "Abdominal binder" advice for women in the postpartum stage after vaginal birth',
      appliesWhen: { stage: 'postpartum', countries: ['NG'] },
      effect: 'remove',
      itemId: 'trad.abdominal_binder',
      rationale: '• One worker felt binder advice confused mothers after vaginal birth.',
      supportingOverrideIds: [],
      supportingWorkerIds: ['w-ng-kemi'],
      status: 'needs_evidence',
      reviewedBy: 'w-ng-bankole',
      reviewNote: 'Evidence supports binders after caesarean for comfort; neutral after vaginal birth. Not removing without more cases. Please collect feedback.',
      createdAt: iso(30, 10, 0),
      reviewedAt: iso(27, 9, 15),
    },
  ];
}

function learnedRules(): LearnedRule[] {
  const p = proposals()[1];
  return [
    {
      id: 'rule.ov-003',
      proposalId: p.id,
      appliesWhen: p.appliesWhen,
      effect: 'add',
      itemId: 'nutr.scd_hydration',
      item: p.item,
      approvedBy: 'w-ng-bankole',
      approvedAt: p.reviewedAt!,
    },
  ];
}

function outbound(mothers: Mother[]): OutboundMessage[] {
  const msgs: Array<{ motherId: string; channel: Channel; language: LanguageCode; body: string; daysAgo: number; hour: number; status: OutboundMessage['status']; itemIds: string[]; ai: boolean; reviewedBy?: string }> = [
    { motherId: 'm-ng-adaeze', channel: 'whatsapp', language: 'en', daysAgo: 13, hour: 9, status: 'read', itemIds: ['med.iron_folate', 'nutr.iron_foods'], ai: true, reviewedBy: 'w-ng-bisola',
      body: 'Good morning Adaeze. Your blood level was a bit low at your last visit (10.1). Please take your iron tablet every day with an orange or some lemon water, not with tea. Ugu soup, beans and a little liver or kpomo with the soup help too. If you still crave nzu, tell me and we will talk about it. See you on the 17th. - Nurse Bisola, Surulere PHC' },
    { motherId: 'm-ng-adaeze', channel: 'whatsapp', language: 'en', daysAgo: 5, hour: 18, status: 'read', itemIds: ['rest.sleep_left_side'], ai: false, reviewedBy: 'w-ng-bisola',
      body: 'Hello Adaeze, thanks for your message. Leg cramps at night are common now. Stretch your calf before bed and drink water during the day. If you get a bad headache, swelling of your face or hands, bleeding or the baby moves less, come to the clinic at once. - Surulere Primary Health Centre' },
    { motherId: 'm-ng-hauwa', channel: 'sms', language: 'en', daysAgo: 9, hour: 10, status: 'delivered', itemIds: ['visit.anc_next'], ai: false, reviewedBy: 'w-ng-zainab',
      body: 'Hajiya Rabi, please bring Hauwa to Gwale PHC on Thursday for her clinic visit. Bring her card. Call us if she bleeds, has fever or a bad headache. - Gwale Primary Health Centre' },
    { motherId: 'm-ng-hauwa', channel: 'voice', language: 'ha', daysAgo: 9, hour: 16, status: 'delivered', itemIds: ['danger.pregnancy'], ai: true, reviewedBy: 'w-ng-zainab',
      body: '[Voice call script, Hausa, read by CHEW Zainab] Hauwa, idan kin ga jini, ciwon kai mai tsanani, kumburin fuska ko hannu, ko jariri bai motsa ba, ku je asibiti nan da nan.' },
    { motherId: 'm-ng-funke', channel: 'sms', language: 'yo', daysAgo: 1, hour: 12, status: 'sent', itemIds: ['bf.low_milk_plan'], ai: true, reviewedBy: 'w-ng-folasade',
      body: 'Funke, e kaaro. Fun omo ni oyan ni gbogbo wakati meji si meta, osan ati oru. Bi omo ba se n mu to, beeni wara yoo se po to. Ma fun omo ni omi tabi ogi. A o wa ri e lola. - Idikan PHC' },
    { motherId: 'm-ng-gift', channel: 'whatsapp', language: 'pcm', daysAgo: 10, hour: 19, status: 'read', itemIds: ['danger.pregnancy'], ai: false, reviewedBy: 'w-ng-blessing',
      body: 'Gift, we don see your message. Abeg come clinic now now make we check your BP, no wait till tomorrow. If your eye dey blur or belle dey pain you, go Teaching Hospital straight. - Nurse Blessing, Rumuokoro PHC' },
    { motherId: 'm-ng-ufuoma', channel: 'whatsapp', language: 'en', daysAgo: 3, hour: 17, status: 'read', itemIds: ['mh.check_in'], ai: true, reviewedBy: 'w-ng-ejiro',
      body: 'Ufuoma, thank you for telling us how you feel. You are not alone and this can get better. I will call you on Thursday at 4pm. If you ever feel you might hurt yourself or the baby, call me or go to Central Hospital Warri at once. - Ejiro, Okpe Road PHC' },
    { motherId: 'm-ke-akinyi', channel: 'sms', language: 'sw', daysAgo: 6, hour: 9, status: 'delivered', itemIds: ['med.art_pmtct'], ai: true, reviewedBy: 'w-ke-rose',
      body: 'Akinyi, kumbuka kumeza dawa zako kila siku saa ile ile. Kliniki ijayo ni Jumanne Kowino. Ukiona damu, maumivu makali ya kichwa au mtoto hachezi, nenda JOOTRH haraka. - Rose (CHP)' },
    { motherId: 'm-ke-sidi', channel: 'sms', language: 'sw', daysAgo: 2, hour: 11, status: 'failed', itemIds: ['med.iron_folate'], ai: false,
      body: 'Sidi, tafadhali meza vidonge vya damu kila siku na ule mboga za majani, maharagwe na samaki. Njoo kliniki Kilifi wiki hii. - Kilifi CRH' },
    { motherId: 'm-gh-abiba', channel: 'print', language: 'en', daysAgo: 21, hour: 13, status: 'delivered', itemIds: ['birth.facility_cemonc', 'danger.pregnancy'], ai: false, reviewedBy: 'w-gh-mariama',
      body: 'Printed picture sheet: your birth plan (Tamale Teaching Hospital), danger signs, who to call. Explained in Dagbani at home visit.' },
    { motherId: 'm-gh-ama', channel: 'sms', language: 'tw', daysAgo: 1, hour: 8, status: 'queued', itemIds: ['educ.common_symptoms'], ai: true,
      body: 'Ama, sɛ wo yafunu yɛ wo nwiinwii a, di aduane kakra mpɛn pii, na nom nsuo. Sɛ wofe biribiara na wontumi nnom nsuo a, bra ayaresabea ntɛm. - Suntreso Hospital' },
    { motherId: 'm-ng-omolara', channel: 'email', language: 'en', daysAgo: 12, hour: 7, status: 'sent', itemIds: ['med.diabetes_care'], ai: true, reviewedBy: 'w-ng-bisola',
      body: 'Dear Omolara, here is your plan after the glucose test: check fasting sugar each morning and 1 hour after meals; aim under 5.3 and 7.8. The diabetes-friendly plate is attached. Next visit in two weeks. - Surulere PHC' },
  ];
  return msgs.map((m, i) => {
    const mother = mothers.find((x) => x.id === m.motherId)!;
    const c = estimateCost(m.channel, m.body, COUNTRIES[mother.country]);
    const createdAt = iso(m.daysAgo, m.hour, 0);
    return {
      id: `out-${String(i + 1).padStart(3, '0')}`,
      motherId: m.motherId,
      channel: m.channel,
      language: m.language,
      body: m.body,
      segments: m.channel === 'sms' ? c.units : undefined,
      estCostLocal: c.local,
      estCostUSD: c.usd,
      status: m.status,
      createdAt,
      sentAt: m.status === 'draft' || m.status === 'queued' ? undefined : iso(m.daysAgo, m.hour, 4),
      planVersion: 1,
      itemIds: m.itemIds,
      aiAssisted: m.ai,
      reviewedBy: m.reviewedBy,
    };
  });
}

function inbound(): InboundMessage[] {
  const raw: Array<Omit<InboundMessage, 'parsedSymptoms'>> = [
    { id: 'in-001', motherId: 'm-ng-gift', channel: 'whatsapp', body: 'Good evening Nurse. Since afternoon my head dey bang me well well and my leg don swell, even my face small. Abeg wetin I go do?', receivedAt: iso(10, 18, 42) },
    { id: 'in-002', motherId: 'm-ng-adaeze', channel: 'whatsapp', body: 'Good evening ma. I dey feel tired well well this week and my legs dey cramp at night.', receivedAt: iso(5, 17, 51) },
    { id: 'in-003', motherId: 'm-ng-funke', channel: 'sms', body: 'Wara mi o po, omo mi n sunkun. Nipple mi n dun mi. Breast milk no dey come well.', receivedAt: iso(1, 6, 15) },
    { id: 'in-004', motherId: 'm-ng-ufuoma', channel: 'whatsapp', body: 'Good evening. I no dey sleep at all even when baby sleep. My mind dey heavy, I dey cry anyhow. I no know wetin dey do me.', receivedAt: iso(4, 21, 3) },
    { id: 'in-005', motherId: 'm-ke-sidi', channel: 'sms', body: 'Nimechoka sana na napumua kwa shida nikitembea.', receivedAt: iso(14, 19, 20) },
    { id: 'in-006', motherId: 'm-ng-ibinabo', channel: 'whatsapp', body: 'Good morning ma. I dey vomit every morning, I no fit chop rice at all. Na normal?', receivedAt: iso(3, 7, 2) },
  ];
  return raw.map((m) => ({ ...m, parsedSymptoms: parseSymptomsFromText(m.body) }));
}

/** Fully deterministic demo state at DEMO_START_CLOCK. */
export function createSeedState(): DemoState {
  const mothers = buildMothers();
  return {
    clock: DEMO_START_CLOCK,
    country: 'ALL',
    currentWorkerId: 'w-ng-bisola',
    mothers,
    workers: WORKERS.map((w) => ({ ...w })),
    facilities: FACILITIES.map((f) => ({ ...f })),
    overrides: overrides(),
    proposals: proposals(),
    learnedRules: learnedRules(),
    outbound: outbound(mothers),
    inbound: inbound(),
    planVersions: {},
  };
}
