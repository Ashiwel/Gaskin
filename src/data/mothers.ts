/**
 * The synthetic caseload: 40 fictional mothers across Nigeria (27), Kenya (7)
 * and Ghana (6). Every name, number and story is invented. Facility names are
 * real public facilities, used for local authenticity only.
 *
 * Demo stars come first: Adaeze (Lagos, 31 weeks), Hauwa (Kano, 17, 24 weeks),
 * Funke (Ibadan, day 5 postpartum, low milk), Akinyi (Kisumu, CHP case),
 * Abiba (Northern Region Ghana, CHO case).
 */
import type { Child, Consent, Medication, Mother } from '../types';
import { EventBuilder, ancHistory, birthAndFollowUp, dateAgo, rngFor, CLOCK_MS, DAY_MS } from './seedKit';

type MotherBase = Omit<Mother, 'events' | 'medications' | 'consent' | 'children' | 'allergies' | 'conditions' | 'practicesMentioned' | 'previousCaesarean' | 'previousStillbirth' | 'previousPPH' | 'enrolledAt'> & {
  enrolledDaysAgo: number;
  consent?: Partial<Consent>;
  children?: Child[];
  allergies?: string[];
  conditions?: Mother['conditions'];
  practicesMentioned?: string[];
  previousCaesarean?: boolean;
  previousStillbirth?: boolean;
  previousPPH?: boolean;
};

function mk(base: MotherBase, history: (b: EventBuilder) => void): Mother {
  const b = new EventBuilder(base.id, base.assignedWorkerId, base.facilityId, rngFor(base.id));
  history(b);
  const events = b.build();
  const enrolledAt = dateAgo(base.enrolledDaysAgo);

  // Children: those given plus any born in the event history (latest last).
  const children = [...(base.children ?? [])];
  let lastBirth: Mother['birth'];
  for (const e of events) {
    if (e.kind === 'birth') {
      if (!children.some((c) => c.id === e.child.id)) children.push(e.child);
      lastBirth = e.birth;
    }
  }
  // Child feeding status mirrors the latest feeding event for that child.
  for (const e of events) {
    if (e.kind === 'feeding' && e.childId) {
      const i = children.findIndex((c) => c.id === e.childId);
      if (i >= 0) children[i] = { ...children[i], feeding: e.status };
    }
  }

  // Current medications: started, not stopped, ongoing (daily / twice daily / nightly).
  const meds = new Map<string, Medication>();
  for (const e of events) {
    if (e.kind !== 'medication' || e.childId) continue;
    if (e.action === 'stop') meds.delete(e.medication.name);
    else if (/daily|tds|bd|nocte|twice|three times|weekly|monthly/i.test(e.medication.frequency ?? '')) meds.set(e.medication.name, e.medication);
  }
  // Pregnancy-only meds end at birth.
  if (lastBirth) {
    for (const [k, v] of meds) if (/IPTp|aspirin|calcium/i.test(k) && v.startedAt < lastBirth.date) meds.delete(k);
  }

  const { enrolledDaysAgo: _e, consent, ...rest } = base;
  void _e;
  return {
    allergies: [],
    conditions: [],
    practicesMentioned: [],
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    ...rest,
    children,
    birth: lastBirth ?? base.birth,
    medications: [...meds.values()],
    enrolledAt,
    consent: {
      dataProcessing: true,
      messaging: true,
      recordedAt: enrolledAt,
      recordedBy: base.assignedWorkerId,
      ...consent,
    },
    events,
  };
}

const lmp = (weeks: number, days = 0) => dateAgo(weeks * 7 + days);
const older = (id: string, name: string, sex: 'F' | 'M', yearsAgo: number, monthsExtra = 0, bw = 3.1): Child => ({
  id,
  name,
  sex,
  dob: new Date(CLOCK_MS - Math.round((yearsAgo * 365.25 + monthsExtra * 30.4) * DAY_MS)).toISOString().slice(0, 10),
  birthWeightKg: bw,
  gestationAtBirthWeeks: 39,
  feeding: 'complementary_no_breastmilk',
});

/** Days ago of the n-th week of a pregnancy whose LMP was `lmpDaysAgo` days ago. */
const atWeek = (lmpDaysAgo: number, week: number, plusDays = 0) => lmpDaysAgo - week * 7 - plusDays;

export function buildMothers(): Mother[] {
  const M: Mother[] = [];

  // =====================================================================
  // DEMO STARS
  // =====================================================================

  // (a) Adaeze Okafor: Enugu-born, lives in Surulere, Lagos. 31 weeks, mild anaemia, omugwo and nzu.
  {
    const L = 31 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ng-adaeze',
          name: 'Adaeze Okafor',
          age: 29,
          country: 'NG',
          region: 'Lagos',
          community: 'Surulere (Aguda), Lagos',
          language: 'ig',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0101', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Sells provisions from a kiosk at Ojuelegba',
          householdNotes: 'Husband Chukwuemeka is a bus conductor (danfo). First child Chidera is 4. Her mother-in-law will come from Nsukka for omugwo after the birth. Rents one room in a face-me-I-face-you.',
          ethnicity: 'Igbo',
          religion: 'Christian (Catholic)',
          gravida: 2,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 162,
          prePregnancyWeightKg: 61,
          pregnancy: { lmp: lmp(31, 3), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-adaeze-1', 'Chidera Okafor', 'F', 4, 2, 3.2)],
          practicesMentioned: ['omugwo', 'nzu_clay'],
          assignedWorkerId: 'w-ng-bisola',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: atWeek(L, 13),
          consent: { preferredChannel: 'whatsapp' },
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 13, country: 'NG', iptp: true, prePregnancyWeightKg: 61, bp: { s: 108, d: 68 }, hb: [10.6, 10.1], genotype: 'AA', bloodGroup: 'O+', ultrasoundText: 'Single live intrauterine fetus, 19+4 weeks by biometry, placenta fundal, liquor adequate.' });
          b.add(atWeek(L, 26, 2), { kind: 'symptom', symptoms: ['fatigue', 'heartburn'], severity: 'mild', via: 'visit', note: 'Tired after standing at the kiosk all day. Says she chews nzu "small small" for the heartburn and spitting.' });
          b.add(atWeek(L, 30, 4), { kind: 'symptom', symptoms: ['fatigue', 'leg_cramps'], severity: 'mild', via: 'whatsapp', recordedBy: 'mother', note: 'WhatsApp: "Good evening ma. I dey feel tired well well this week and my legs dey cramp at night."' });
          b.add(atWeek(L, 30, 4), { kind: 'visit', visitType: 'remote_checkin', attended: true, note: 'Called back on WhatsApp voice: no danger signs, advised rest, iron with orange, leg stretches.' });
        },
      ),
    );
  }

  // (b) Hauwa Ibrahim: 17, Kano, first pregnancy 24 weeks, shared feature phone, cannot read, guardian involved, wankan jego.
  {
    const L = 24 * 7 + 1;
    M.push(
      mk(
        {
          id: 'm-ng-hauwa',
          name: 'Hauwa Ibrahim',
          age: 17,
          country: 'NG',
          region: 'Kano',
          community: 'Gwale, Kano Municipal',
          language: 'ha',
          literacy: 'none',
          phone: { access: 'shared', number: '+234 800 000 0102', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Helps her mother-in-law sell kosai (bean cakes)',
          householdNotes: 'Married at 16. Lives in her husband’s family compound; husband Sani (24) is an okada rider. The phone belongs to her mother-in-law, Hajiya Rabi, who attends visits and has agreed to the care plan. Wants to follow wankan jego after the birth as her mother did.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 1,
          parity: 0,
          genotype: 'AS',
          bloodGroup: 'B+',
          heightCm: 152,
          prePregnancyWeightKg: 47,
          pregnancy: { lmp: lmp(24, 1), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['wankan_jego', 'food_taboo_protein'],
          assignedWorkerId: 'w-ng-zainab',
          facilityId: 'f-ng-gwale-phc',
          enrolledDaysAgo: atWeek(L, 16),
          consent: { guardianInvolved: true },
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 16, country: 'NG', iptp: true, prePregnancyWeightKg: 47, bp: { s: 104, d: 64 }, hb: [10.5], genotype: 'AS', bloodGroup: 'B+', ultrasoundText: 'Single live fetus, 20+2 weeks, normal anatomy survey, placenta posterior.' });
          b.add(atWeek(L, 16), { kind: 'symptom', symptoms: ['nausea_vomiting'], severity: 'mild', via: 'visit', note: 'Mother-in-law says Hauwa avoids eggs "so the baby will not be a thief" (local belief).' });
          b.add(atWeek(L, 21), { kind: 'visit', visitType: 'home_visit', attended: true, recordedBy: 'w-ng-hadiza', note: 'CHIPS home visit: explained danger signs with picture card to Hauwa and Hajiya Rabi. Net in use.' });
        },
      ),
    );
  }

  // (c) Funke Adeyemi: Ibadan, day 5 after first birth, low milk supply, pap/ogi.
  {
    const birthAgo = 5;
    const L = birthAgo + 39 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ng-funke',
          name: 'Funke Adeyemi',
          age: 26,
          country: 'NG',
          region: 'Oyo',
          community: 'Idikan, Ibadan North-East',
          language: 'yo',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0103', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Apprentice hairdresser',
          householdNotes: 'First baby. Husband Tunde is a welder. Her mother (Iya Funke) moved in after the birth and is preparing ogi with every meal "to bring the milk". Baby has had some water from Iya Funke.',
          ethnicity: 'Yoruba',
          religion: 'Christian (Pentecostal)',
          gravida: 1,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 160,
          prePregnancyWeightKg: 58,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['pap_ogi', 'hot_water_compress', 'omugwo', 'prelacteal_feeds'],
          assignedWorkerId: 'w-ng-folasade',
          facilityId: 'f-ng-idikan-phc',
          enrolledDaysAgo: atWeek(L, 14),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 14, untilWeek: 39, country: 'NG', iptp: true, prePregnancyWeightKg: 58, bp: { s: 112, d: 70 }, hb: [11.2, 10.9], genotype: 'AA', bloodGroup: 'A+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['perineal_tear'], bloodLossMl: 300 },
            child: { id: 'c-funke-1', name: 'Ayomide Adeyemi', sex: 'F', birthWeightKg: 3.0, gestationAtBirthWeeks: 39 },
            country: 'NG',
            pncDays: [1, 3],
            bp: { s: 114, d: 72 },
            feedingAt: (age) =>
              age <= 1
                ? { status: 'exclusive_breastfeeding', milkSupply: 'good', feedsPerDay: 8 }
                : { status: 'mixed', milkSupply: 'low', latchProblem: true, feedsPerDay: 6 },
          });
          b.add(1, { kind: 'symptom', symptoms: ['low_milk_supply', 'cracked_nipples'], severity: 'moderate', via: 'sms', recordedBy: 'mother', note: 'SMS: "Wara mi o po, omo mi n sunkun. Nipple mi n dun mi." (My milk is not much, the baby keeps crying. My nipple hurts.)' });
        },
      ),
    );
  }

  // (d) Akinyi Odhiambo: Kisumu, CHP case. 33 weeks, HIV on ART, feature phone.
  {
    const L = 33 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ke-akinyi',
          name: 'Akinyi Odhiambo',
          age: 23,
          country: 'KE',
          region: 'Kisumu',
          community: 'Kowino, Kisumu East',
          language: 'luo',
          literacy: 'basic',
          phone: { access: 'feature', number: '+254 700 000 201', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells omena (dried fish) at Kibuye market',
          householdNotes: 'Second pregnancy. Partner Otieno is a fisherman at Dunga beach, often away for days. Disclosed HIV status to her sister, not yet to partner. CHP Rose visits monthly through eCHIS.',
          ethnicity: 'Luo',
          religion: 'Christian (Anglican)',
          gravida: 2,
          parity: 1,
          genotype: 'unknown',
          bloodGroup: 'O+',
          heightCm: 165,
          prePregnancyWeightKg: 56,
          conditions: ['hiv'],
          pregnancy: { lmp: lmp(33, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-akinyi-1', 'Baraka Odhiambo', 'M', 3, 5, 3.0)],
          practicesMentioned: ['moringa', 'food_taboo_protein'],
          assignedWorkerId: 'w-ke-rose',
          facilityId: 'f-ke-kowino-disp',
          enrolledDaysAgo: atWeek(L, 15),
        },
        (b) => {
          b.med(400, 'start', { name: 'Tenofovir/lamivudine/dolutegravir (TLD)', dose: '1 tablet', frequency: 'daily' }, undefined, 'On ART since 2023 (CCC number on file).');
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 15, country: 'KE', iptp: true, prePregnancyWeightKg: 56, bp: { s: 106, d: 66 }, hb: [11.0, 10.8], genotype: 'unknown', bloodGroup: 'O+', hiv: 'known_positive' });
          b.lab(atWeek(L, 16), 'hiv', 'positive', undefined, 'Viral load 68 copies/mL (suppressed) on TLD.');
          b.add(atWeek(L, 28), { kind: 'visit', visitType: 'home_visit', attended: true, recordedBy: 'w-ke-rose', note: 'CHP home visit (eCHIS): ART adherence good, pill count matches. Birth plan at JOOTRH discussed; SHA registration done.' });
          b.add(atWeek(L, 32, 3), { kind: 'symptom', symptoms: ['back_pain'], severity: 'mild', via: 'sms', recordedBy: 'mother', note: 'SMS: "Nyaka adhi clinic, ngeya lit matin." (I will come to clinic, my back hurts a little.)' });
        },
      ),
    );
  }

  // (e) Abiba Fuseini: Northern Region, Ghana, CHO case. 35 weeks, grand multipara, previous PPH, no phone.
  {
    const L = 35 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-gh-abiba',
          name: 'Abiba Fuseini',
          age: 34,
          country: 'GH',
          region: 'Northern',
          community: 'Kpalsogu, Kumbungu District',
          language: 'dag',
          literacy: 'none',
          phone: { access: 'none', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Shea nut picker and processor (women’s group)',
          householdNotes: 'Sixth pregnancy. Husband Alhassan farms maize and groundnut; co-wife in the compound. Bled heavily after her fifth birth at home in 2024 and was carried to Tamale by motor-king. The nearest CHPS midwife is 4 km away.',
          ethnicity: 'Dagomba',
          religion: 'Muslim',
          gravida: 6,
          parity: 5,
          previousPPH: true,
          genotype: 'AS',
          bloodGroup: 'O+',
          heightCm: 158,
          prePregnancyWeightKg: 54,
          pregnancy: { lmp: lmp(35, 4), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-abiba-1', 'Wumpini Fuseini', 'M', 14), older('c-abiba-2', 'Napari Fuseini', 'F', 11), older('c-abiba-3', 'Mahama Fuseini', 'M', 7), older('c-abiba-4', 'Fuseina Fuseini', 'F', 2, 3, 2.9)],
          practicesMentioned: ['baby_massage_shea', 'labour_herbs', 'hot_water_compress'],
          assignedWorkerId: 'w-gh-mariama',
          facilityId: 'f-gh-kpalsogu-chps',
          enrolledDaysAgo: atWeek(L, 18),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 18, country: 'GH', iptp: true, prePregnancyWeightKg: 54, bp: { s: 112, d: 72 }, hb: [10.2, 10.6], genotype: 'AS', bloodGroup: 'O+' });
          b.add(atWeek(L, 18), { kind: 'referral', toFacilityId: 'f-gh-tth', reason: 'Grand multipara with previous postpartum haemorrhage: plan birth at a facility with blood and theatre.', urgency: 'routine', status: 'open', note: 'Birth plan: Tamale Teaching Hospital. Husband to arrange transport at first pains.' });
          b.add(atWeek(L, 30), { kind: 'visit', visitType: 'home_visit', attended: true, recordedBy: 'w-gh-mariama', note: 'CHO home visit with husband and co-wife present. Explained why she must not deliver at home this time. Community volunteer will alert the CHPS when labour starts.' });
        },
      ),
    );
  }

  // =====================================================================
  // NIGERIA
  // =====================================================================

  // Preconception: Ngozi Eze, Enugu, AS genotype, previous stillbirth, planning next pregnancy.
  M.push(
    mk(
      {
        id: 'm-ng-ngozi',
        name: 'Ngozi Eze',
        age: 31,
        country: 'NG',
        region: 'Enugu',
        community: 'Abakpa Nike, Enugu East',
        language: 'ig',
        literacy: 'good',
        phone: { access: 'smartphone', number: '+234 800 000 0106', hasWhatsApp: true },
        email: 'ngozi.eze.demo@example.org',
        incomeBand: 'middle',
        occupation: 'Primary school teacher',
        householdNotes: 'Stillbirth at 37 weeks in 2025 (first pregnancy). Husband Obinna (AS) and Ngozi (AS) were counselled together about sickle cell risk. Trying to conceive.',
        ethnicity: 'Igbo',
        religion: 'Christian (Anglican)',
        gravida: 1,
        parity: 1,
        previousStillbirth: true,
        genotype: 'AS',
        bloodGroup: 'A+',
        heightCm: 166,
        prePregnancyWeightKg: 68,
        practicesMentioned: [],
        assignedWorkerId: 'w-ng-chioma',
        facilityId: 'f-ng-abakpa-phc',
        enrolledDaysAgo: 62,
      },
      (b) => {
        b.visit(62, 'anc', { note: 'Preconception visit: wants to try again. Grief counselling offered.' });
        b.vitals(62, { systolic: 116, diastolic: 74, weightKg: 68.4 });
        b.lab(62, 'haemoglobin', 12.1, 'g/dL');
        b.lab(62, 'genotype', 'AS');
        b.lab(62, 'hiv', 'negative');
        b.lab(62, 'syphilis', 'negative');
        b.med(62, 'start', { name: 'Folic acid', dose: '400 µg', frequency: 'daily' });
        b.add(62, { kind: 'screening', instrument: 'phq9', score: 6 });
        b.add(20, { kind: 'report', author: 'Dr Uchenna Ike, ESUTH Parklane (O&G)', text: 'Preconception review. Mrs Ngozi Eze, 31, P1 (fresh stillbirth at 37 wks, 2025, cause unexplained; placenta not examined). BP 118/76, Hb 12.1, FBS 4.6 mmol/L, VDRL non-reactive. Couple both AS: counselled on 1 in 4 risk of SS; offered prenatal diagnosis. Advice: folic acid 400 mcg daily, early booking before 12 weeks, early dating scan, serial growth scans from 28 weeks, kick counts from 28 weeks.' });
      },
    ),
  );

  // Preconception: Rakiya Musa, Kaduna, underweight.
  M.push(
    mk(
      {
        id: 'm-ng-rakiya',
        name: 'Rakiya Musa',
        age: 22,
        country: 'NG',
        region: 'Kaduna',
        community: 'Kawo, Kaduna North',
        language: 'ha',
        literacy: 'basic',
        phone: { access: 'feature', number: '+234 800 000 0107', hasWhatsApp: false },
        incomeBand: 'very_low',
        occupation: 'Grinds pepper for neighbours',
        householdNotes: 'Married two years. Lost weight during a long malaria illness; meals are often tuwo with little soup. Husband works at a block industry.',
        ethnicity: 'Hausa',
        religion: 'Muslim',
        gravida: 0,
        parity: 0,
        conditions: ['underweight', 'anaemia'],
        genotype: 'AA',
        bloodGroup: 'O+',
        heightCm: 158,
        prePregnancyWeightKg: 43,
        assignedWorkerId: 'w-ng-rebecca',
        facilityId: 'f-ng-kawo-phc',
        enrolledDaysAgo: 34,
      },
      (b) => {
        b.visit(34, 'anc', { note: 'Preconception and family planning visit. Wants a baby next year.' });
        b.vitals(34, { systolic: 102, diastolic: 64, weightKg: 43.2, muacCm: 21.8 });
        b.lab(34, 'haemoglobin', 9.6, 'g/dL');
        b.lab(34, 'malaria_rdt', 'negative');
        b.med(34, 'start', { name: 'Ferrous sulphate + folic acid (iron-folate)', dose: '60 mg iron + 400 µg folic acid', frequency: 'daily' });
        b.visit(6, 'anc', { note: 'Follow-up: taking tablets; nausea with them, advised to take after food.' });
        b.vitals(6, { weightKg: 44.0, muacCm: 22.0 });
      },
    ),
  );

  // T1: Ibinabo Briggs, Port Harcourt, 10 weeks, obesity, nausea. Pidgin speaker.
  {
    const L = 10 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ng-ibinabo',
          name: 'Ibinabo Briggs',
          age: 28,
          country: 'NG',
          region: 'Rivers',
          community: 'Rumuokoro, Obio/Akpor',
          language: 'pcm',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0108', hasWhatsApp: true },
          incomeBand: 'middle',
          occupation: 'Customer care agent at a telecoms office',
          householdNotes: 'First pregnancy. Kalabari; family from Buguma. Husband works offshore two weeks on, two off.',
          ethnicity: 'Ijaw (Kalabari)',
          religion: 'Christian (Pentecostal)',
          gravida: 1,
          parity: 0,
          conditions: ['obesity'],
          genotype: 'AA',
          bloodGroup: 'B+',
          heightCm: 163,
          prePregnancyWeightKg: 88,
          pregnancy: { lmp: lmp(10, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['ginger_nausea'],
          assignedWorkerId: 'w-ng-blessing',
          facilityId: 'f-ng-rumuokoro-phc',
          enrolledDaysAgo: 9,
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 9, country: 'NG', iptp: true, prePregnancyWeightKg: 88, bp: { s: 124, d: 80 }, hb: [11.8], genotype: 'AA', bloodGroup: 'B+' });
          b.add(3, { kind: 'symptom', symptoms: ['nausea_vomiting', 'fatigue'], severity: 'moderate', via: 'whatsapp', recordedBy: 'mother', note: 'WhatsApp: "Good morning ma. I dey vomit every morning, I no fit chop rice at all. Na normal?"' });
        },
      ),
    );
  }

  // T1: Bilkisu Lawal, Bauchi, 38, grand multipara, 11 weeks.
  {
    const L = 11 * 7 + 5;
    M.push(
      mk(
        {
          id: 'm-ng-bilkisu',
          name: 'Bilkisu Lawal',
          age: 38,
          country: 'NG',
          region: 'Bauchi',
          community: 'Yelwa, Bauchi LGA',
          language: 'ha',
          literacy: 'none',
          phone: { access: 'shared', number: '+234 800 000 0109', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Sells groundnut oil and kuli-kuli',
          householdNotes: 'Seventh pregnancy. Six living children; the eldest daughter (19) helps at home. Previous births at home with a TBA. Uses her son’s phone.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 7,
          parity: 6,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 155,
          prePregnancyWeightKg: 60,
          pregnancy: { lmp: lmp(11, 5), fetuses: 1, plannedBirthPlace: 'home' },
          children: [older('c-bilkisu-1', 'Maryam Lawal', 'F', 19), older('c-bilkisu-2', 'Umar Lawal', 'M', 16), older('c-bilkisu-3', 'Hassana Lawal', 'F', 12), older('c-bilkisu-4', 'Husseina Lawal', 'F', 12), older('c-bilkisu-5', 'Abdullahi Lawal', 'M', 7), older('c-bilkisu-6', 'Aisha Lawal', 'F', 3)],
          practicesMentioned: ['tba_birth', 'agbo'],
          assignedWorkerId: 'w-ng-lami',
          facilityId: 'f-ng-yelwa-phc',
          enrolledDaysAgo: 4,
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 11, country: 'NG', iptp: true, prePregnancyWeightKg: 60, bp: { s: 128, d: 82 }, hb: [10.9], genotype: 'AA', bloodGroup: 'A+' });
        },
      ),
    );
  }

  // T2: Folake Ogunbiyi, Lagos, sickle cell disease (SS), 22 weeks.
  {
    const L = 22 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ng-folake',
          name: 'Folake Ogunbiyi',
          age: 30,
          country: 'NG',
          region: 'Lagos',
          community: 'Itire, Surulere',
          language: 'yo',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0110', hasWhatsApp: true },
          email: 'folake.o.demo@example.org',
          incomeBand: 'middle',
          occupation: 'Fashion designer with a small shop',
          householdNotes: 'Lives with sickle cell disease (SS); two crises a year before pregnancy. Co-managed with LUTH haematology. Husband Damilola is supportive and attends visits.',
          ethnicity: 'Yoruba',
          religion: 'Christian (Anglican)',
          gravida: 2,
          parity: 0,
          conditions: ['sickle_cell_disease'],
          genotype: 'SS',
          bloodGroup: 'O+',
          heightCm: 160,
          prePregnancyWeightKg: 52,
          pregnancy: { lmp: lmp(22, 3), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['agbo'],
          assignedWorkerId: 'w-ng-bisola',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: atWeek(L, 9),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 9, country: 'NG', iptp: true, prePregnancyWeightKg: 52, bp: { s: 104, d: 64 }, hb: [8.2], genotype: 'SS', bloodGroup: 'O+', ironRegime: 'scd' });
          b.med(atWeek(L, 9), 'start', { name: 'Proguanil (malaria prophylaxis, SCD)', dose: '200 mg', frequency: 'daily' });
          b.add(atWeek(L, 9), { kind: 'referral', toFacilityId: 'f-ng-luth', reason: 'Sickle cell disease in pregnancy: joint obstetric–haematology care.', urgency: 'routine', status: 'completed' });
          b.add(atWeek(L, 11), { kind: 'report', author: 'Dr Titilayo Adeyemo, Haematology, LUTH', text: 'Haematology clinic letter. Mrs Folake Ogunbiyi, 30, HbSS, G2P0 (one miscarriage), 11/40. Steady-state Hb 8.0–8.5 g/dL; today 8.2 g/dL, retics 9%. No crisis since conception. Plan: folic acid 5 mg daily, proguanil 200 mg daily, no routine iron unless ferritin low, low-dose aspirin 75 mg from 12 weeks, generous oral fluids (3 L/day), avoid cold and dehydration, review here every 4 weeks, serial growth scans from 24 weeks. Admit if pain crisis, fever ≥38 °C or chest symptoms.' });
          b.med(atWeek(L, 12), 'start', { name: 'Aspirin (low dose)', dose: '75 mg', frequency: 'nocte' });
          b.lab(atWeek(L, 19), 'haemoglobin', 7.9, 'g/dL', 'LUTH haematology clinic');
          b.add(atWeek(L, 21), { kind: 'symptom', symptoms: ['back_pain', 'fatigue'], severity: 'moderate', via: 'whatsapp', recordedBy: 'mother', note: 'WhatsApp: "Ẹ kú alẹ́ ma. Ẹ̀yìn mi ń dùn mí díẹ̀ since yesterday, not like crisis pain. I am drinking water."' });
          b.add(atWeek(L, 21), { kind: 'visit', visitType: 'remote_checkin', attended: true, note: 'Phone check: no fever, pain 3/10, drinking well. Paracetamol and rest; return if worse.' });
        },
      ),
    );
  }

  // T2: Ifeoma Nnaji, Enugu, chronic hypertension, 20 weeks.
  {
    const L = 20 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-ng-ifeoma',
          name: 'Ifeoma Nnaji',
          age: 36,
          country: 'NG',
          region: 'Enugu',
          community: 'New Haven, Enugu North',
          language: 'ig',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0111', hasWhatsApp: true },
          incomeBand: 'middle',
          occupation: 'Trader in Ogbete Main Market (fabrics)',
          householdNotes: 'Fourth pregnancy. Known hypertension for 3 years. Husband Ikenna travels to Onitsha for business weekly.',
          ethnicity: 'Igbo',
          religion: 'Christian (Catholic)',
          gravida: 4,
          parity: 3,
          conditions: ['chronic_hypertension'],
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 164,
          prePregnancyWeightKg: 79,
          pregnancy: { lmp: lmp(20, 4), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-ifeoma-1', 'Chinedu Nnaji', 'M', 10), older('c-ifeoma-2', 'Chiamaka Nnaji', 'F', 7), older('c-ifeoma-3', 'Somtochukwu Nnaji', 'M', 4)],
          practicesMentioned: ['nzu_clay', 'pepper_soup'],
          assignedWorkerId: 'w-ng-chioma',
          facilityId: 'f-ng-abakpa-phc',
          enrolledDaysAgo: atWeek(L, 12),
        },
        (b) => {
          b.med(1100, 'start', { name: 'Amlodipine', dose: '5 mg', frequency: 'daily' });
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 12, country: 'NG', iptp: true, prePregnancyWeightKg: 79, bp: { s: 142, d: 90, risePerWeek: -0.3 }, hb: [11.4], genotype: 'AA', bloodGroup: 'A+' });
          b.med(atWeek(L, 12), 'stop', { name: 'Amlodipine', dose: '5 mg', frequency: 'daily' }, undefined, 'Switched at booking.');
          b.med(atWeek(L, 12), 'start', { name: 'Methyldopa', dose: '250 mg', frequency: 'three times daily' });
          b.med(atWeek(L, 12), 'start', { name: 'Aspirin (low dose)', dose: '75 mg', frequency: 'nocte' });
          b.med(atWeek(L, 12), 'start', { name: 'Calcium carbonate', dose: '1.5 g elemental', frequency: 'daily' });
          b.add(atWeek(L, 12), { kind: 'referral', toFacilityId: 'f-ng-esuth', reason: 'Chronic hypertension in pregnancy: specialist review.', urgency: 'routine', status: 'completed' });
          b.add(atWeek(L, 14), { kind: 'report', author: 'Dr Chinwe Eze, Consultant Obstetrician, ESUTH Parklane', text: 'Antenatal clinic letter. Mrs Ifeoma Nnaji, 36, G4P3, 14 weeks. Chronic hypertension x 3 years on amlodipine, switched to methyldopa 250 mg tds at booking. Today BP 138/88 mmHg, urinalysis protein nil, Hb 11.4 g/dL, creatinine 68 µmol/L, LFTs normal. Continue methyldopa; low-dose aspirin 75 mg nocte to 36 weeks; calcium 1.5 g daily. BP check every 2 weeks at PHC; anomaly scan at 20–22 weeks; review here at 28 weeks or sooner if BP ≥150/100 or proteinuria.' });
          b.visit(atWeek(L, 17), 'anc', { note: 'BP check only (fortnightly).' });
          b.vitals(atWeek(L, 17), { systolic: 136, diastolic: 86 });
        },
      ),
    );
  }

  // T3 (28 weeks): Omolara Dada, Lagos, GDM on OGTT, obese, middle income.
  {
    const L = 28 * 7 + 1;
    M.push(
      mk(
        {
          id: 'm-ng-omolara',
          name: 'Omolara Dada',
          age: 34,
          country: 'NG',
          region: 'Lagos',
          community: 'Gbagada Phase 2, Kosofe',
          language: 'en',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0112', hasWhatsApp: true },
          email: 'omolara.dada.demo@example.org',
          incomeBand: 'high',
          occupation: 'Bank relationship manager',
          householdNotes: 'Third pregnancy. Mother had type 2 diabetes. Busy schedule; prefers email summaries.',
          ethnicity: 'Yoruba',
          religion: 'Christian (Methodist)',
          gravida: 3,
          parity: 2,
          conditions: ['gestational_diabetes', 'obesity'],
          genotype: 'AA',
          bloodGroup: 'B+',
          heightCm: 168,
          prePregnancyWeightKg: 94,
          pregnancy: { lmp: lmp(28, 1), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-omolara-1', 'Tiwatope Dada', 'F', 6, 0, 3.9), older('c-omolara-2', 'Oluwadamilare Dada', 'M', 3, 0, 4.1)],
          assignedWorkerId: 'w-ng-bisola',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: atWeek(L, 10),
          consent: { preferredChannel: 'email' },
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 10, country: 'NG', iptp: true, prePregnancyWeightKg: 94, bp: { s: 122, d: 78 }, hb: [12.2, 11.6], genotype: 'AA', bloodGroup: 'B+', weightGainFactor: 1.2 });
          b.lab(atWeek(L, 25), 'blood_glucose_fasting', 5.4, 'mmol/L');
          b.lab(atWeek(L, 25), 'ogtt_2h', 9.4, 'mmol/L', '75 g OGTT');
          b.add(atWeek(L, 26), { kind: 'referral', toFacilityId: 'f-ng-limh', reason: 'Gestational diabetes: diet review and glucose monitoring plan.', urgency: 'routine', status: 'completed' });
          b.lab(atWeek(L, 27), 'blood_glucose_fasting', 5.0, 'mmol/L', 'Home glucometer, after diet change');
        },
      ),
    );
  }

  // T3 (36 weeks): Gift Wokoma, Port Harcourt, previous caesarean. Pidgin speaker. Sent a WhatsApp headache message 10 days ago (resolved).
  {
    const L = 36 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ng-gift',
          name: 'Gift Wokoma',
          age: 31,
          country: 'NG',
          region: 'Rivers',
          community: 'Mile 3 (Diobu), Port Harcourt',
          language: 'pcm',
          literacy: 'basic',
          phone: { access: 'smartphone', number: '+234 800 000 0113', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Sells roasted plantain (bole) and fish',
          householdNotes: 'Second baby. First birth was an emergency caesarean for obstructed labour at RSUTH (2023). Wants to try a vaginal birth this time; partner prefers a "church midwife".',
          ethnicity: 'Ikwerre',
          religion: 'Christian (Pentecostal)',
          gravida: 2,
          parity: 1,
          previousCaesarean: true,
          genotype: 'AA',
          bloodGroup: 'O-',
          heightCm: 157,
          prePregnancyWeightKg: 64,
          pregnancy: { lmp: lmp(36, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-gift-1', 'Precious Wokoma', 'F', 3, 1, 3.3)],
          practicesMentioned: ['bleeding_home_remedies'],
          assignedWorkerId: 'w-ng-blessing',
          facilityId: 'f-ng-rumuokoro-phc',
          enrolledDaysAgo: atWeek(L, 14),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 14, country: 'NG', iptp: true, prePregnancyWeightKg: 64, bp: { s: 116, d: 74 }, hb: [11.0, 10.7, 11.1], genotype: 'AA', bloodGroup: 'O-' });
          b.med(atWeek(L, 28), 'start', { name: 'Anti-D immunoglobulin', dose: '1500 IU IM', frequency: 'single dose' }, undefined, 'Rhesus negative, antibody screen negative.');
          b.add(atWeek(L, 34), { kind: 'referral', toFacilityId: 'f-ng-rsuth', reason: 'Previous caesarean: plan birth where theatre and blood are available (trial of labour).', urgency: 'routine', status: 'arrived' });
          b.add(10, { kind: 'symptom', symptoms: ['severe_headache', 'swelling_face_hands'], severity: 'moderate', via: 'whatsapp', recordedBy: 'mother', note: 'Parsed from WhatsApp message.' }, b.time(10, 18, 42));
          b.add(10, { kind: 'visit', visitType: 'emergency', attended: true, note: 'Came in same evening after call-back. BP normal, urine protein nil, mild ankle oedema only. Headache settled with rest and paracetamol.' }, b.time(10, 20, 5));
          b.add(10, { kind: 'vitals', systolic: 124, diastolic: 80, temperatureC: 36.8, pulse: 88 }, b.time(10, 20, 12));
          b.add(10, { kind: 'lab', test: 'urine_protein', value: 0, note: 'Dipstick: nil' }, b.time(10, 20, 15));
        },
      ),
    );
  }

  // T3 (32 weeks): Bukola Oladipo, Ibadan, twins.
  {
    const L = 32 * 7;
    M.push(
      mk(
        {
          id: 'm-ng-bukola',
          name: 'Bukola Oladipo',
          age: 27,
          country: 'NG',
          region: 'Oyo',
          community: 'Bodija, Ibadan North',
          language: 'yo',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0114', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells àmàlà and ewédú at a buka',
          householdNotes: 'Twins on scan ("ìbejì"); the family is delighted. Mother-in-law plans to help. Long hours standing at the buka.',
          ethnicity: 'Yoruba',
          religion: 'Muslim',
          gravida: 2,
          parity: 1,
          genotype: 'AS',
          bloodGroup: 'O+',
          heightCm: 161,
          prePregnancyWeightKg: 63,
          pregnancy: { lmp: lmp(32, 0), fetuses: 2, plannedBirthPlace: 'facility' },
          children: [older('c-bukola-1', 'Abdulmalik Oladipo', 'M', 2, 10, 3.2)],
          practicesMentioned: ['agbo', 'eating_less'],
          assignedWorkerId: 'w-ng-folasade',
          facilityId: 'f-ng-idikan-phc',
          enrolledDaysAgo: atWeek(L, 15),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 15, country: 'NG', iptp: true, prePregnancyWeightKg: 63, bp: { s: 114, d: 72, risePerWeek: 0.5 }, hb: [10.8, 10.3], genotype: 'AS', bloodGroup: 'O+', fetuses: 2, ultrasoundText: 'Live dichorionic diamniotic twins, 18+5 weeks, concordant growth.' });
          b.add(atWeek(L, 20), { kind: 'referral', toFacilityId: 'f-ng-adeoyo', reason: 'Twin pregnancy: specialist ANC and planned facility birth.', urgency: 'routine', status: 'completed' });
          b.lab(atWeek(L, 28), 'ultrasound', 'DCDA twins, 28+1 weeks, EFW 1.12 kg and 1.05 kg (concordant), both cephalic/breech.');
        },
      ),
    );
  }

  // Labour imminent (39+5): Amina Garba, Kano, previous PPH, planning home birth.
  {
    const L = 39 * 7 + 5;
    M.push(
      mk(
        {
          id: 'm-ng-amina',
          name: 'Amina Garba',
          age: 25,
          country: 'NG',
          region: 'Kano',
          community: 'Dorayi Karama, Gwale',
          language: 'ha',
          literacy: 'none',
          phone: { access: 'shared', number: '+234 800 000 0115', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Home-based, makes caps (hula) for sale',
          householdNotes: 'Third pregnancy. Bled heavily after second birth at home (2024). Husband’s family prefers home birth with the local TBA (Inna Ladi). Transport money not yet saved.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 3,
          parity: 2,
          previousPPH: true,
          genotype: 'AA',
          bloodGroup: 'B+',
          heightCm: 154,
          prePregnancyWeightKg: 55,
          pregnancy: { lmp: lmp(39, 5), fetuses: 1, plannedBirthPlace: 'home' },
          children: [older('c-amina-1', 'Fatima Garba', 'F', 5), older('c-amina-2', 'Usman Garba', 'M', 2, 1)],
          practicesMentioned: ['tba_birth', 'wankan_jego', 'bleeding_home_remedies'],
          assignedWorkerId: 'w-ng-zainab',
          facilityId: 'f-ng-gwale-phc',
          enrolledDaysAgo: atWeek(L, 18),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 18, country: 'NG', iptp: true, prePregnancyWeightKg: 55, bp: { s: 112, d: 70 }, hb: [10.4, 10.0, 10.3], genotype: 'AA', bloodGroup: 'B+' });
          b.add(atWeek(L, 36), { kind: 'referral', toFacilityId: 'f-ng-mmsh', reason: 'Previous PPH: birth must be in a facility with blood. Family still considering home birth.', urgency: 'routine', status: 'open' });
          b.med(atWeek(L, 36), 'start', { name: 'Misoprostol (for advance distribution)', dose: '600 µg oral after birth only if born outside facility', frequency: 'single dose' }, undefined, 'Given with counselling under community distribution programme.');
          b.add(2, { kind: 'visit', visitType: 'home_visit', attended: true, recordedBy: 'w-ng-hadiza', note: 'CHIPS visit: no contractions yet. Husband agreed in principle to go to Murtala at first pains; NEMSAS number given.' });
        },
      ),
    );
  }

  // Missed-visits defaulter (30 weeks): Halima Yusuf, Kaduna.
  {
    const L = 30 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-ng-halima',
          name: 'Halima Yusuf',
          age: 29,
          country: 'NG',
          region: 'Kaduna',
          community: 'Rigasa, Igabi LGA',
          language: 'ha',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0116', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Tailor (works from home)',
          householdNotes: 'Fourth pregnancy. Stopped coming after 20 weeks; neighbour says she travelled to her mother in Zaria. Phone often switched off.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 4,
          parity: 3,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 159,
          prePregnancyWeightKg: 57,
          pregnancy: { lmp: lmp(30, 4), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-halima-1', 'Sadiq Yusuf', 'M', 9), older('c-halima-2', 'Zahra Yusuf', 'F', 6), older('c-halima-3', 'Nana Yusuf', 'F', 3)],
          assignedWorkerId: 'w-ng-rebecca',
          facilityId: 'f-ng-kawo-phc',
          enrolledDaysAgo: atWeek(L, 16),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 16, missedFromWeek: 26, country: 'NG', iptp: true, prePregnancyWeightKg: 57, bp: { s: 110, d: 70 }, hb: [10.9], genotype: 'AA', bloodGroup: 'O+' });
          b.add(atWeek(L, 27), { kind: 'visit', visitType: 'home_visit', attended: false, recordedBy: 'w-ng-rebecca', note: 'Home visit: not at home. Left message with co-tenant.' });
        },
      ),
    );
  }

  // T2 (18 weeks): Ivie Osagie, Benin City, Edo speaker, malaria episode 18 days ago (treated).
  {
    const L = 18 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ng-ivie',
          name: 'Ivie Osagie',
          age: 23,
          country: 'NG',
          region: 'Edo',
          community: 'Oregbeni, Ikpoba-Okha, Benin City',
          language: 'bin',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0117', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells pure water and soft drinks',
          householdNotes: 'First pregnancy. Lives with her aunt near the Oregbeni market. Partner Osaze is a mechanic.',
          ethnicity: 'Edo (Bini)',
          religion: 'Christian (Pentecostal)',
          gravida: 1,
          parity: 0,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 165,
          prePregnancyWeightKg: 60,
          pregnancy: { lmp: lmp(18, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['agbo'],
          assignedWorkerId: 'w-ng-osaze',
          facilityId: 'f-ng-oregbeni-phc',
          enrolledDaysAgo: atWeek(L, 11),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 11, country: 'NG', iptp: false, prePregnancyWeightKg: 60, bp: { s: 108, d: 68 }, hb: [11.6], genotype: 'AA', bloodGroup: 'A+' });
          b.add(18, { kind: 'symptom', symptoms: ['fever', 'fatigue', 'nausea_vomiting'], severity: 'moderate', via: 'visit', note: 'Fever and body pains for 2 days. Had taken agbo from a roadside seller before coming.' });
          b.visit(18, 'emergency', { note: 'Walk-in with fever.' });
          b.vitals(18, { temperatureC: 38.6, pulse: 104, systolic: 104, diastolic: 64 });
          b.lab(18, 'malaria_rdt', 'positive', undefined, 'P. falciparum');
          b.med(18, 'start', { name: 'Artemether-lumefantrine', dose: '80/480 mg', frequency: 'twice daily for 3 days' });
          b.med(15, 'stop', { name: 'Artemether-lumefantrine', dose: '80/480 mg', frequency: 'twice daily for 3 days' }, undefined, 'Course completed.');
          b.visit(11, 'anc', { note: 'Malaria follow-up: well, afebrile. First IPTp-SP dose given (directly observed).' });
          b.vitals(11, { temperatureC: 36.7, systolic: 110, diastolic: 70 });
          b.med(11, 'start', { name: 'Sulfadoxine-pyrimethamine (IPTp-SP)', dose: '3 tablets (1500/75 mg) DOT', frequency: 'single dose' }, undefined, 'IPTp dose 1');
          b.lab(11, 'haemoglobin', 10.4, 'g/dL', 'After malaria');
        },
      ),
    );
  }

  // T2 (15 weeks): Asmau Bello, Fulani, Kaduna, moderate anaemia.
  {
    const L = 15 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ng-asmau',
          name: 'Asmau Bello',
          age: 24,
          country: 'NG',
          region: 'Kaduna',
          community: 'Rugan Fulani settlement, Kawo',
          language: 'ff',
          literacy: 'none',
          phone: { access: 'shared', number: '+234 800 000 0118', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Sells fura da nono (millet and fermented milk)',
          householdNotes: 'Pastoralist family; the household may move with the cattle in the dry season. Husband’s phone. Speaks Fulfulde and some Hausa.',
          ethnicity: 'Fulani',
          religion: 'Muslim',
          gravida: 3,
          parity: 2,
          conditions: ['anaemia'],
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 160,
          prePregnancyWeightKg: 50,
          pregnancy: { lmp: lmp(15, 3), fetuses: 1, plannedBirthPlace: 'home' },
          children: [older('c-asmau-1', 'Aliyu Bello', 'M', 5), older('c-asmau-2', 'Jamila Bello', 'F', 2, 6)],
          practicesMentioned: ['eating_less', 'nzu_clay'],
          assignedWorkerId: 'w-ng-rebecca',
          facilityId: 'f-ng-kawo-phc',
          enrolledDaysAgo: atWeek(L, 13),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 13, country: 'NG', iptp: true, prePregnancyWeightKg: 50, bp: { s: 100, d: 62 }, hb: [8.6], genotype: 'AA', bloodGroup: 'O+' });
          b.add(atWeek(L, 13), { kind: 'symptom', symptoms: ['fatigue', 'breathlessness'], severity: 'mild', via: 'visit', note: 'Breathless walking back from the market. Eats clay (kasa) when she craves it.' });
        },
      ),
    );
  }

  // Postpartum day 2: Yetunde Balogun, Lagos, PPH at LIMH, discharge summary today.
  {
    const birthAgo = 2;
    const L = birthAgo + 39 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ng-yetunde',
          name: 'Yetunde Balogun',
          age: 33,
          country: 'NG',
          region: 'Lagos',
          community: 'Lawanson, Surulere',
          language: 'yo',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0119', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Cashier at a supermarket',
          householdNotes: 'Third baby. Husband Rotimi is a security guard on night shifts. Older children are 7 and 4. Her sister will stay for two weeks.',
          ethnicity: 'Yoruba',
          religion: 'Christian (Baptist)',
          gravida: 3,
          parity: 3,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 163,
          prePregnancyWeightKg: 66,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-yetunde-1', 'Oluwaseun Balogun', 'M', 7), older('c-yetunde-2', 'Ifeoluwa Balogun', 'F', 4)],
          practicesMentioned: ['hot_water_compress', 'abdominal_binder'],
          assignedWorkerId: 'w-ng-bisola',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: atWeek(L, 12),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 12, untilWeek: 39, country: 'NG', iptp: true, prePregnancyWeightKg: 66, bp: { s: 114, d: 72 }, hb: [11.6, 11.2], genotype: 'AA', bloodGroup: 'A+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['pph'], bloodLossMl: 800 },
            child: { id: 'c-yetunde-3', name: 'Tiwalola Balogun', sex: 'F', birthWeightKg: 3.2, gestationAtBirthWeeks: 39 },
            country: 'NG',
            pncDays: [1],
            bp: { s: 118, d: 76 },
          });
          b.lab(1, 'haemoglobin', 8.9, 'g/dL', 'Post-delivery FBC, LIMH');
          b.med(0, 'start', { name: 'Ferrous sulphate', dose: '200 mg', frequency: 'three times daily' });
          b.med(0, 'start', { name: 'Folic acid', dose: '5 mg', frequency: 'daily' });
          b.add(0, {
            kind: 'report',
            author: 'Dr Adebisi Ogundipe, Registrar (O&G), Lagos Island Maternity Hospital',
            text: 'LAGOS ISLAND MATERNITY HOSPITAL: DISCHARGE SUMMARY. Mrs Yetunde Balogun, 33, G3P3. Admitted in active labour at 39+2 weeks. SVD of a live female, 3.2 kg, Apgar 8 and 9. Third stage complicated by primary PPH (estimated blood loss 800 mL) from uterine atony; managed with oxytocin infusion, misoprostol 800 µg SL and bimanual compression. No transfusion. Post-delivery Hb 8.9 g/dL (booking 11.6). BP 118/76 mmHg. Breastfeeding established. Discharged on day 2 on ferrous sulphate 200 mg tds, folic acid 5 mg daily, paracetamol 1 g prn. Plan: PHC review on day 3 and day 7, repeat FBC in 2 weeks; return at once if heavy bleeding, fever, dizziness or fainting.',
            note: 'Uploaded by the PHC midwife from the paper discharge summary.',
          });
        },
      ),
    );
  }

  // Postpartum day 12: Zuwaira Umar, 16, Kano, home birth with TBA, preterm LBW baby.
  {
    const birthAgo = 12;
    const L = birthAgo + 35 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ng-zuwaira',
          name: 'Zuwaira Umar',
          age: 16,
          country: 'NG',
          region: 'Kano',
          community: 'Kofar Mata, Kano Municipal',
          language: 'ha',
          literacy: 'basic',
          phone: { access: 'shared', number: '+234 800 000 0120', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Was in JSS2 before marriage',
          householdNotes: 'First baby, born early at home with a TBA. Her mother Malama Hadiza attends visits and consented with her. Baby’s cord was dressed with ash and hot compress by the grandmother; baby given water in the first days.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 1,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 150,
          prePregnancyWeightKg: 44,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'tba' },
          practicesMentioned: ['cord_substances', 'prelacteal_feeds', 'wankan_jego', 'hot_water_compress'],
          assignedWorkerId: 'w-ng-zainab',
          facilityId: 'f-ng-gwale-phc',
          enrolledDaysAgo: atWeek(L, 22),
          consent: { guardianInvolved: true },
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 22, untilWeek: 35, country: 'NG', iptp: true, prePregnancyWeightKg: 44, bp: { s: 106, d: 66 }, hb: [10.1, 10.4], genotype: 'AA', bloodGroup: 'O+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'tba', complications: ['preterm'], bloodLossMl: undefined },
            child: { id: 'c-zuwaira-1', name: 'Abdullahi Umar', sex: 'M', birthWeightKg: 2.1, gestationAtBirthWeeks: 35 },
            country: 'NG',
            pncDays: [3, 10],
            bp: { s: 108, d: 68 },
            birthVaccinesDay: 3,
            feedingAt: (age) => (age < 7 ? { status: 'mixed', milkSupply: 'good', feedsPerDay: 7 } : { status: 'exclusive_breastfeeding', milkSupply: 'good', feedsPerDay: 10 }),
          });
          b.add(birthAgo - 3, { kind: 'referral', toFacilityId: 'f-ng-mmsh', reason: 'Preterm low-birth-weight baby (2.1 kg) born at home: assessment and kangaroo mother care teaching.', urgency: 'urgent', status: 'completed', childId: 'c-zuwaira-1' });
          b.med(birthAgo - 3, 'start', { name: 'Chlorhexidine 7.1% gel (cord)', dose: 'apply to stump', frequency: 'daily for 7 days' }, 'c-zuwaira-1', 'Started at first contact after ash was cleaned off.');
          b.add(birthAgo - 4, { kind: 'report', author: 'Dr Musa Danladi, Paediatrics SCBU, Murtala Muhammad Specialist Hospital', text: 'SCBU review. Baby Abdullahi Umar, day 4, born at home at about 35 weeks, birth weight 2.1 kg (TBA scale). Today 2.02 kg, temp 36.4 °C, RR 48, feeding at breast but tires; cord stump clean after removal of ash. No jaundice requiring phototherapy (TSB 9.8 mg/dL). Taught kangaroo mother care to mother (16) and grandmother. Exclusive breastfeeding 2–3 hourly. BCG, OPV0, HepB0 given. Discharged to PHC: weigh at day 10 and weekly until 2.5 kg; return if not feeding, cold, fast breathing or yellow to the soles.' });
        },
      ),
    );
  }

  // Postpartum day 30: Ufuoma Edewor, Sapele, Urhobo, raised EPDS.
  {
    const birthAgo = 30;
    const L = birthAgo + 38 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-ng-ufuoma',
          name: 'Ufuoma Edewor',
          age: 33,
          country: 'NG',
          region: 'Delta',
          community: 'Okpe Road, Sapele',
          language: 'urh',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0121', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Sells foodstuff (garri, palm oil) at Sapele main market',
          householdNotes: 'Second baby after a 6-year gap. Husband Oghenekaro lost his job at the timber company in August. Her mother died last year, so no one came for the postpartum stay. Not sleeping well.',
          ethnicity: 'Urhobo',
          religion: 'Christian (Catholic)',
          gravida: 2,
          parity: 2,
          conditions: ['depression_history'],
          genotype: 'AA',
          bloodGroup: 'B+',
          heightCm: 167,
          prePregnancyWeightKg: 71,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-ufuoma-1', 'Oghenetega Edewor', 'F', 6, 2)],
          practicesMentioned: ['postpartum_confinement', 'pepper_soup'],
          assignedWorkerId: 'w-ng-ejiro',
          facilityId: 'f-ng-okpe-phc',
          enrolledDaysAgo: atWeek(L, 14),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 14, untilWeek: 38, country: 'NG', iptp: true, prePregnancyWeightKg: 71, bp: { s: 118, d: 76 }, hb: [11.4, 11.0], genotype: 'AA', bloodGroup: 'B+', epds: 8 });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 250 },
            child: { id: 'c-ufuoma-2', name: 'Ejiroghene Edewor', sex: 'M', birthWeightKg: 3.4, gestationAtBirthWeeks: 38 },
            country: 'NG',
            pncDays: [1, 3, 9],
            bp: { s: 116, d: 74 },
            epds: 9,
          });
          b.add(4, { kind: 'symptom', symptoms: ['insomnia', 'low_mood', 'anxiety'], severity: 'moderate', via: 'whatsapp', recordedBy: 'mother', note: 'WhatsApp: "Good evening. I no dey sleep at all even when baby sleep. My mind dey heavy, I dey cry anyhow. I no know wetin dey do me."' });
          b.visit(3, 'home_visit', { note: 'Home visit after WhatsApp message. Talked for 40 minutes; husband present. No thoughts of self-harm on direct questioning.' });
          b.add(3, { kind: 'screening', instrument: 'epds', score: 13, selfHarmFlag: false });
          b.add(3, { kind: 'referral', toFacilityId: 'f-ng-gh-warri', reason: 'EPDS 13 with history of depression: mental health review (mhGAP).', urgency: 'routine', status: 'open' });
        },
      ),
    );
  }

  // Infant 2 months: Chidinma Okeke, Lagos, back at work, mixed feeding.
  {
    const birthAgo = 61;
    const L = birthAgo + 39 * 7;
    M.push(
      mk(
        {
          id: 'm-ng-chidinma',
          name: 'Chidinma Okeke',
          age: 28,
          country: 'NG',
          region: 'Lagos',
          community: 'Ojuelegba, Surulere',
          language: 'en',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0122', hasWhatsApp: true },
          incomeBand: 'middle',
          occupation: 'Pharmacy sales assistant',
          householdNotes: 'First baby. Went back to work at 6 weeks; baby stays with a neighbour who gives formula during the day.',
          ethnicity: 'Igbo',
          religion: 'Christian (Catholic)',
          gravida: 1,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 165,
          prePregnancyWeightKg: 62,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['omugwo', 'baby_massage_shea'],
          assignedWorkerId: 'w-ng-kemi',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: atWeek(L, 11),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 11, untilWeek: 39, country: 'NG', iptp: true, prePregnancyWeightKg: 62, bp: { s: 112, d: 70 }, hb: [11.9, 11.4], genotype: 'AA', bloodGroup: 'O+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 200 },
            child: { id: 'c-chidinma-1', name: 'Kamsiyochukwu Okeke', sex: 'M', birthWeightKg: 3.3, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 112, d: 70 },
            feedingAt: (age) => (age < 42 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'mixed', milkSupply: 'good', feedsPerDay: 5 }),
          });
          b.med(42, 'start', { name: 'Progestogen-only pill (levonorgestrel)', dose: '30 µg', frequency: 'daily' }, undefined, 'Postpartum family planning at 6 weeks (breastfeeding-safe).');
        },
      ),
    );
  }

  // Infant 4 months: Aderonke Salami, Ibadan, exclusive breastfeeding on track.
  {
    const birthAgo = 122;
    const L = birthAgo + 40 * 7;
    M.push(
      mk(
        {
          id: 'm-ng-aderonke',
          name: 'Aderonke Salami',
          age: 31,
          country: 'NG',
          region: 'Oyo',
          community: 'Agodi Gate, Ibadan',
          language: 'yo',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0123', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells adire fabric',
          householdNotes: 'Second baby. Grandmother massages the baby with shea butter (òrí) daily.',
          ethnicity: 'Yoruba',
          religion: 'Muslim',
          gravida: 2,
          parity: 2,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 162,
          prePregnancyWeightKg: 64,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-aderonke-1', 'Ridwan Salami', 'M', 4)],
          practicesMentioned: ['baby_massage_shea', 'back_carrying'],
          assignedWorkerId: 'w-ng-folasade',
          facilityId: 'f-ng-idikan-phc',
          enrolledDaysAgo: atWeek(L, 13),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 13, untilWeek: 40, country: 'NG', iptp: true, prePregnancyWeightKg: 64, bp: { s: 110, d: 70 }, hb: [11.3, 11.0], genotype: 'AA', bloodGroup: 'A+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 250 },
            child: { id: 'c-aderonke-2', name: 'Aisha Salami', sex: 'F', birthWeightKg: 3.1, gestationAtBirthWeeks: 40 },
            country: 'NG',
            bp: { s: 110, d: 70 },
          });
        },
      ),
    );
  }

  // Infant 6 months: Obiageli Nwankwo, Enugu, starting complementary food; egg taboo.
  {
    const birthAgo = 184;
    const L = birthAgo + 39 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ng-obiageli',
          name: 'Obiageli Nwankwo',
          age: 35,
          country: 'NG',
          region: 'Enugu',
          community: 'Emene, Enugu East',
          language: 'ig',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0124', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Farmer (cassava and okra) and palm-wine seller',
          householdNotes: 'Fourth baby. Husband’s mother says babies who eat eggs will grow up to steal; plans to start akamu (pap) only.',
          ethnicity: 'Igbo',
          religion: 'Christian (Catholic)',
          gravida: 4,
          parity: 4,
          genotype: 'AS',
          bloodGroup: 'O+',
          heightCm: 160,
          prePregnancyWeightKg: 67,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-obiageli-1', 'Ebuka Nwankwo', 'M', 12), older('c-obiageli-2', 'Ugochi Nwankwo', 'F', 9), older('c-obiageli-3', 'Kosisochukwu Nwankwo', 'F', 5)],
          practicesMentioned: ['food_taboo_protein', 'pap_ogi'],
          assignedWorkerId: 'w-ng-chioma',
          facilityId: 'f-ng-abakpa-phc',
          enrolledDaysAgo: atWeek(L, 16),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 16, untilWeek: 39, country: 'NG', iptp: true, prePregnancyWeightKg: 67, bp: { s: 118, d: 76 }, hb: [10.9, 10.8], genotype: 'AS', bloodGroup: 'O+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 300 },
            child: { id: 'c-obiageli-4', name: 'Chukwuebuka Nwankwo', sex: 'M', birthWeightKg: 3.4, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 116, d: 74 },
            feedingAt: (age) => (age < 180 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'complementary_with_breastmilk' }),
          });
        },
      ),
    );
  }

  // Infant 9 months: Kaltuma Abakar, Shuwa Arab, Maiduguri, faltering growth.
  {
    const birthAgo = 275;
    const L = birthAgo + 38 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-ng-kaltuma',
          name: 'Kaltuma Abakar',
          age: 20,
          country: 'NG',
          region: 'Borno',
          community: 'Gwange ward, Maiduguri (host community)',
          language: 'ar',
          literacy: 'none',
          phone: { access: 'shared', number: '+234 800 000 0125', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Collects and sells firewood',
          householdNotes: 'Family displaced from Dikwa in 2022, now renting in Gwange. Husband does casual labour. Food is mostly millet porridge (kunu) and a little soup. Speaks Shuwa Arabic and some Kanuri.',
          ethnicity: 'Shuwa Arab',
          religion: 'Muslim',
          gravida: 2,
          parity: 2,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 157,
          prePregnancyWeightKg: 48,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'home' },
          children: [older('c-kaltuma-1', 'Ahmat Abakar', 'M', 2, 10, 2.8)],
          practicesMentioned: ['early_complementary', 'back_carrying'],
          assignedWorkerId: 'w-ng-fatimakb',
          facilityId: 'f-ng-gwange-phc',
          enrolledDaysAgo: birthAgo - 5,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'home', complications: ['none'] },
            child: { id: 'c-kaltuma-2', name: 'Halime Abakar', sex: 'F', birthWeightKg: 2.7, gestationAtBirthWeeks: 38 },
            country: 'NG',
            pncDays: [5, 12, 45],
            bp: { s: 108, d: 68 },
            birthVaccinesDay: 5,
            epiDelay: 9,
            weightOverride: (age, e) => (age > 200 ? Math.min(e, 6.9 - (age - 200) * 0.002) : e),
            feedingAt: (age) => (age < 120 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'complementary_with_breastmilk' }),
          });
          b.add(30, { kind: 'symptom', symptoms: ['baby_diarrhoea'], severity: 'mild', via: 'visit', childId: 'c-kaltuma-2', note: 'Three days of loose stools; ORS and zinc given; resolved.' });
          b.med(30, 'start', { name: 'ORS + zinc', dose: 'Zinc 10 mg', frequency: 'daily for 10 days' }, 'c-kaltuma-2');
          b.add(4, { kind: 'growth', childId: 'c-kaltuma-2', weightKg: 6.7, lengthCm: 66.0, muacCm: 12.1 });
          b.add(4, { kind: 'referral', toFacilityId: 'f-ng-umth', reason: 'Growth faltering: no weight gain over 2 months, MUAC 12.1 cm (moderate). Enrol in supplementary feeding / CMAM OTP review.', urgency: 'routine', status: 'open', childId: 'c-kaltuma-2' });
        },
      ),
    );
  }

  // Infant 14 months: Saadatu Abubakar, Bauchi.
  {
    const birthAgo = 427;
    const L = birthAgo + 39 * 7 + 1;
    M.push(
      mk(
        {
          id: 'm-ng-saadatu',
          name: 'Saadatu Abubakar',
          age: 30,
          country: 'NG',
          region: 'Bauchi',
          community: 'Gwallaga, Bauchi',
          language: 'ha',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0126', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells zobo and kunu drinks',
          householdNotes: 'Third child. Using an implant for family planning since 6 weeks.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 3,
          parity: 3,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 158,
          prePregnancyWeightKg: 59,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-saadatu-1', 'Muhammad Abubakar', 'M', 8), older('c-saadatu-2', 'Khadija Abubakar', 'F', 4)],
          practicesMentioned: ['back_carrying'],
          assignedWorkerId: 'w-ng-lami',
          facilityId: 'f-ng-yelwa-phc',
          enrolledDaysAgo: birthAgo + 20,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 300 },
            child: { id: 'c-saadatu-3', name: 'Fatima Abubakar', sex: 'F', birthWeightKg: 3.0, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 114, d: 72 },
          });
          b.med(birthAgo - 43, 'start', { name: 'Etonogestrel implant (Implanon NXT)', dose: '68 mg', frequency: 'single insertion (3 years)' });
        },
      ),
    );
  }

  // Infant 20 months: Abimbola Ojo, Lagos.
  {
    const birthAgo = 610;
    const L = birthAgo + 39 * 7 + 5;
    M.push(
      mk(
        {
          id: 'm-ng-abimbola',
          name: 'Abimbola Ojo',
          age: 27,
          country: 'NG',
          region: 'Lagos',
          community: 'Akerele, Surulere',
          language: 'en',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+234 800 000 0127', hasWhatsApp: true },
          incomeBand: 'middle',
          occupation: 'Primary school teacher',
          householdNotes: 'First child, still breastfeeding at night. Speaks Yoruba at home, English at work.',
          ethnicity: 'Yoruba',
          religion: 'Christian (Pentecostal)',
          gravida: 1,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'B+',
          heightCm: 166,
          prePregnancyWeightKg: 63,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          assignedWorkerId: 'w-ng-kemi',
          facilityId: 'f-ng-surulere-phc',
          enrolledDaysAgo: birthAgo + 30,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'caesarean', place: 'facility', complications: ['none'], bloodLossMl: 600 },
            child: { id: 'c-abimbola-1', name: 'Oluwatobiloba Ojo', sex: 'M', birthWeightKg: 3.6, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 112, d: 72 },
          });
          b.visit(20, 'child_health', { note: '19-month growth and development check. Walking, says 6 words.' });
          b.add(20, { kind: 'growth', childId: 'c-abimbola-1', weightKg: 11.0, lengthCm: 81.6, muacCm: 15.1 });
          b.add(20, { kind: 'feeding', status: 'complementary_with_breastmilk', childId: 'c-abimbola-1', note: 'Family diet; breastfeeds at night.' });
        },
      ),
    );
  }

  // =====================================================================
  // KENYA
  // =====================================================================

  // T1 (9 weeks): Njeri Mwangi, Nairobi (Mathare).
  {
    const L = 9 * 7 + 1;
    M.push(
      mk(
        {
          id: 'm-ke-njeri',
          name: 'Njeri Mwangi',
          age: 21,
          country: 'KE',
          region: 'Nairobi',
          community: 'Mathare 4A, Nairobi',
          language: 'sw',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+254 700 000 202', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Mama mboga (vegetable vendor)',
          householdNotes: 'First pregnancy. Not yet registered with SHA. Lives with her partner Kevin, a matatu tout.',
          ethnicity: 'Kikuyu',
          religion: 'Christian (Catholic)',
          gravida: 1,
          parity: 0,
          genotype: 'unknown',
          bloodGroup: 'A+',
          heightCm: 160,
          prePregnancyWeightKg: 55,
          pregnancy: { lmp: lmp(9, 1), fetuses: 1, plannedBirthPlace: 'facility' },
          assignedWorkerId: 'w-ke-wanjiru',
          facilityId: 'f-ke-pumwani',
          enrolledDaysAgo: 5,
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 8, country: 'KE', iptp: false, prePregnancyWeightKg: 55, bp: { s: 110, d: 70 }, hb: [12.0], genotype: 'unknown', bloodGroup: 'A+' });
        },
      ),
    );
  }

  // T3 (28 weeks): Sidi Kazungu, Kilifi, anaemia.
  {
    const L = 28 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-ke-sidi',
          name: 'Sidi Kazungu',
          age: 26,
          country: 'KE',
          region: 'Kilifi',
          community: 'Mnarani, Kilifi North',
          language: 'sw',
          literacy: 'basic',
          phone: { access: 'feature', number: '+254 700 000 203', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells mandazi and makuti thatch',
          householdNotes: 'Third pregnancy. Mijikenda (Giriama). Husband is a fisherman. Eats little meat; prefers ugali with mchicha.',
          ethnicity: 'Mijikenda (Giriama)',
          religion: 'Muslim',
          gravida: 3,
          parity: 2,
          conditions: ['anaemia'],
          genotype: 'unknown',
          bloodGroup: 'O+',
          heightCm: 158,
          prePregnancyWeightKg: 52,
          pregnancy: { lmp: lmp(28, 3), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-sidi-1', 'Kahindi Kazungu', 'M', 6), older('c-sidi-2', 'Dama Kazungu', 'F', 3)],
          practicesMentioned: ['food_taboo_protein'],
          assignedWorkerId: 'w-ke-kadzo',
          facilityId: 'f-ke-kilifi-crh',
          enrolledDaysAgo: atWeek(L, 17),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 17, country: 'KE', iptp: true, prePregnancyWeightKg: 52, bp: { s: 108, d: 66 }, hb: [9.8, 9.2], genotype: 'unknown', bloodGroup: 'O+' });
          b.add(atWeek(L, 27), { kind: 'symptom', symptoms: ['fatigue', 'breathlessness'], severity: 'mild', via: 'sms', recordedBy: 'mother', note: 'SMS: "Nimechoka sana na napumua kwa shida nikitembea." (I am very tired and breathless when walking.)' });
        },
      ),
    );
  }

  // Infant 9 months: Atieno Ouma, Kisumu, on track.
  {
    const birthAgo = 276;
    const L = birthAgo + 39 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-ke-atieno',
          name: 'Atieno Ouma',
          age: 19,
          country: 'KE',
          region: 'Kisumu',
          community: 'Nyalenda B, Kisumu Central',
          language: 'luo',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+254 700 000 204', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Hair salon assistant; finishing secondary school in the evenings',
          householdNotes: 'First baby. Lives with her mother. Baby’s father is at university in Eldoret.',
          ethnicity: 'Luo',
          religion: 'Christian (SDA)',
          gravida: 1,
          parity: 1,
          genotype: 'unknown',
          bloodGroup: 'B+',
          heightCm: 164,
          prePregnancyWeightKg: 54,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          assignedWorkerId: 'w-ke-rose',
          facilityId: 'f-ke-kowino-disp',
          enrolledDaysAgo: birthAgo + 120,
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 14, untilWeek: 39, country: 'KE', iptp: true, prePregnancyWeightKg: 54, bp: { s: 108, d: 68 }, hb: [11.4, 11.1], genotype: 'unknown', bloodGroup: 'B+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['perineal_tear'], bloodLossMl: 350 },
            child: { id: 'c-atieno-1', name: 'Achieng Ouma', sex: 'F', birthWeightKg: 3.0, gestationAtBirthWeeks: 39 },
            country: 'KE',
            bp: { s: 110, d: 70 },
            feedingAt: (age) => (age < 180 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'complementary_with_breastmilk' }),
          });
          b.med(birthAgo - 45, 'start', { name: 'Depot medroxyprogesterone (DMPA)', dose: '150 mg IM', frequency: 'every 3 months' });
        },
      ),
    );
  }

  // Infant 2 months: Nakiru Lokwawi, Turkana, home birth, no phone.
  {
    const birthAgo = 63;
    M.push(
      mk(
        {
          id: 'm-ke-nakiru',
          name: 'Nakiru Lokwawi',
          age: 22,
          country: 'KE',
          region: 'Turkana',
          community: 'Nawoitorong, Lodwar',
          language: 'sw',
          literacy: 'none',
          phone: { access: 'none', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Weaves baskets from doum palm; household keeps goats',
          householdNotes: 'Second baby, born at home with her mother-in-law. Speaks Ng’aturkana and some Swahili; the CHP translates. Water is fetched from a borehole 3 km away.',
          ethnicity: 'Turkana',
          religion: 'Christian (AIC)',
          gravida: 2,
          parity: 2,
          genotype: 'unknown',
          heightCm: 168,
          prePregnancyWeightKg: 51,
          children: [older('c-nakiru-1', 'Ekai Lokwawi', 'M', 3, 2, 2.9)],
          practicesMentioned: ['colostrum_discard', 'cord_substances', 'food_taboo_protein'],
          assignedWorkerId: 'w-ke-ekai',
          facilityId: 'f-ke-lodwar-crh',
          enrolledDaysAgo: birthAgo - 4,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'home', complications: ['none'] },
            child: { id: 'c-nakiru-2', name: 'Akai Lokwawi', sex: 'F', birthWeightKg: 2.8, gestationAtBirthWeeks: 39 },
            country: 'KE',
            pncDays: [4, 12, 44],
            bp: { s: 106, d: 66 },
            birthVaccinesDay: 4,
            feedingAt: (age) => (age < 5 ? { status: 'mixed', milkSupply: 'good' } : { status: 'exclusive_breastfeeding', milkSupply: 'good' }),
          });
          b.lab(birthAgo - 4, 'hiv', 'negative', undefined, 'Postnatal HIV test');
        },
      ),
    );
  }

  // Postpartum day 12: Wambui Kariuki, Nairobi, after caesarean at Pumwani.
  {
    const birthAgo = 12;
    const L = birthAgo + 38 * 7 + 6;
    M.push(
      mk(
        {
          id: 'm-ke-wambui',
          name: 'Wambui Kariuki',
          age: 32,
          country: 'KE',
          region: 'Nairobi',
          community: 'Eastleigh North, Nairobi',
          language: 'en',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+254 700 000 205', hasWhatsApp: true },
          email: 'wambui.k.demo@example.org',
          incomeBand: 'middle',
          occupation: 'Accounts clerk',
          householdNotes: 'Second baby by emergency caesarean (fetal distress). SHA Linda Jamii covered the surgery. Husband on leave for two weeks.',
          ethnicity: 'Kikuyu',
          religion: 'Christian (PCEA)',
          gravida: 2,
          parity: 2,
          genotype: 'unknown',
          bloodGroup: 'A+',
          heightCm: 163,
          prePregnancyWeightKg: 70,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-wambui-1', 'Mumbi Kariuki', 'F', 5)],
          assignedWorkerId: 'w-ke-wanjiru',
          facilityId: 'f-ke-pumwani',
          enrolledDaysAgo: atWeek(L, 12),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 12, untilWeek: 38, country: 'KE', iptp: false, prePregnancyWeightKg: 70, bp: { s: 116, d: 74 }, hb: [12.4, 11.8], genotype: 'unknown', bloodGroup: 'A+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'caesarean', place: 'facility', complications: ['none'], bloodLossMl: 700 },
            child: { id: 'c-wambui-2', name: 'Baraka Kariuki', sex: 'M', birthWeightKg: 3.5, gestationAtBirthWeeks: 38 },
            country: 'KE',
            pncDays: [1, 3, 9],
            bp: { s: 118, d: 76 },
            epds: 7,
          });
          b.add(1, { kind: 'symptom', symptoms: ['breast_pain_redness'], severity: 'mild', via: 'whatsapp', recordedBy: 'mother', note: 'WhatsApp: "Left breast is sore and a bit hard since yesterday, no fever."' });
        },
      ),
    );
  }

  // =====================================================================
  // GHANA
  // =====================================================================

  // T2 (20 weeks): Naa Adjeley Tetteh, Accra, previous stillbirth.
  {
    const L = 20 * 7 + 2;
    M.push(
      mk(
        {
          id: 'm-gh-naa',
          name: 'Naa Adjeley Tetteh',
          age: 32,
          country: 'GH',
          region: 'Greater Accra',
          community: 'Korle Gonno, Accra',
          language: 'en',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+233 20 000 0301', hasWhatsApp: true },
          incomeBand: 'middle',
          occupation: 'Fishmonger (smoked fish wholesaler)',
          householdNotes: 'Ga. Stillbirth at 34 weeks in 2024. Anxious about this pregnancy; MCH Record Book carried at every visit.',
          ethnicity: 'Ga',
          religion: 'Christian (Methodist)',
          gravida: 3,
          parity: 1,
          previousStillbirth: true,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 164,
          prePregnancyWeightKg: 72,
          pregnancy: { lmp: lmp(20, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-naa-1', 'Nii Armah Tetteh', 'M', 6)],
          practicesMentioned: ['agbo'],
          assignedWorkerId: 'w-gh-efua',
          facilityId: 'f-gh-korle-bu',
          enrolledDaysAgo: atWeek(L, 10),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 10, country: 'GH', iptp: true, prePregnancyWeightKg: 72, bp: { s: 118, d: 76 }, hb: [11.8], genotype: 'AA', bloodGroup: 'O+', epds: undefined, ultrasoundText: 'Single live fetus, 12+3 weeks, NT 1.4 mm.' });
          b.add(atWeek(L, 18), { kind: 'screening', instrument: 'phq2', score: 3 });
        },
      ),
    );
  }

  // T1 (12 weeks): Ama Serwaa, Kumasi, nausea, ginger.
  {
    const L = 12 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-gh-ama',
          name: 'Ama Serwaa Owusu',
          age: 34,
          country: 'GH',
          region: 'Ashanti',
          community: 'Suntreso, Kumasi',
          language: 'tw',
          literacy: 'basic',
          phone: { access: 'feature', number: '+233 20 000 0302', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Trader at Kejetia market (cloth)',
          householdNotes: 'Third pregnancy. Asante. Husband Kwabena drives a trotro.',
          ethnicity: 'Asante',
          religion: 'Christian (Presbyterian)',
          gravida: 3,
          parity: 2,
          genotype: 'AS',
          bloodGroup: 'B+',
          heightCm: 160,
          prePregnancyWeightKg: 68,
          pregnancy: { lmp: lmp(12, 4), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-ama-1', 'Kofi Owusu', 'M', 8), older('c-ama-2', 'Akua Owusu', 'F', 4)],
          practicesMentioned: ['ginger_nausea', 'agbo'],
          assignedWorkerId: 'w-gh-akosua',
          facilityId: 'f-gh-suntreso',
          enrolledDaysAgo: 6,
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 11, country: 'GH', iptp: true, prePregnancyWeightKg: 68, bp: { s: 120, d: 78 }, hb: [11.2], genotype: 'AS', bloodGroup: 'B+' });
          b.add(2, { kind: 'symptom', symptoms: ['nausea_vomiting'], severity: 'mild', via: 'sms', recordedBy: 'mother', note: 'SMS: "Me yafunu yɛ me nwiinwii na mefe anɔpa biara." (My stomach churns and I vomit every morning.)' });
        },
      ),
    );
  }

  // Infant 4 months: Abena Asante, Kumasi, mixed feeding.
  {
    const birthAgo = 124;
    const L = birthAgo + 39 * 7 + 4;
    M.push(
      mk(
        {
          id: 'm-gh-abena',
          name: 'Abena Asante',
          age: 25,
          country: 'GH',
          region: 'Ashanti',
          community: 'Aboabo, Kumasi',
          language: 'tw',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+233 20 000 0303', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Seamstress',
          householdNotes: 'First baby. Grandmother gives koko (millet porridge) "because the baby is still hungry".',
          ethnicity: 'Asante',
          religion: 'Christian (Pentecostal)',
          gravida: 1,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 161,
          prePregnancyWeightKg: 57,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['early_complementary', 'pap_ogi'],
          assignedWorkerId: 'w-gh-akosua',
          facilityId: 'f-gh-suntreso',
          enrolledDaysAgo: atWeek(L, 12),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 12, untilWeek: 39, country: 'GH', iptp: true, prePregnancyWeightKg: 57, bp: { s: 110, d: 70 }, hb: [11.5, 11.0], genotype: 'AA', bloodGroup: 'O+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 250 },
            child: { id: 'c-abena-1', name: 'Kwame Asante', sex: 'M', birthWeightKg: 3.2, gestationAtBirthWeeks: 39 },
            country: 'GH',
            bp: { s: 112, d: 70 },
            feedingAt: (age) => (age < 90 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'mixed', milkSupply: 'good' }),
          });
        },
      ),
    );
  }

  // Postpartum day 30: Apoka Akolgo, Upper East, home birth, colostrum discarded.
  {
    const birthAgo = 30;
    const L = birthAgo + 39 * 7 + 3;
    M.push(
      mk(
        {
          id: 'm-gh-apoka',
          name: 'Apoka Akolgo',
          age: 19,
          country: 'GH',
          region: 'Upper East',
          community: 'Sumbrungu, Bolgatanga Municipal',
          language: 'en',
          literacy: 'basic',
          phone: { access: 'shared', number: '+233 20 000 0304', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Weaves Bolga baskets',
          householdNotes: 'First baby, born at home at night before transport came. Speaks Gurene (Frafra); the CHO reads messages to her in Gurene. Shares her husband’s phone.',
          ethnicity: 'Frafra (Gurunsi)',
          religion: 'Traditional / Christian',
          gravida: 1,
          parity: 1,
          genotype: 'unknown',
          bloodGroup: 'O+',
          heightCm: 159,
          prePregnancyWeightKg: 49,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['colostrum_discard', 'baby_massage_shea'],
          assignedWorkerId: 'w-gh-asibi',
          facilityId: 'f-gh-sumbrungu-chps',
          enrolledDaysAgo: atWeek(L, 16),
        },
        (b) => {
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 16, untilWeek: 39, country: 'GH', iptp: true, prePregnancyWeightKg: 49, bp: { s: 106, d: 66 }, hb: [10.8, 10.6], genotype: 'unknown', bloodGroup: 'O+' });
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'home', complications: ['none'] },
            child: { id: 'c-apoka-1', name: 'Atampoka Akolgo', sex: 'F', birthWeightKg: 2.9, gestationAtBirthWeeks: 39 },
            country: 'GH',
            pncDays: [2, 8],
            bp: { s: 108, d: 68 },
            birthVaccinesDay: 2,
            feedingAt: (age) => (age < 3 ? { status: 'mixed', milkSupply: 'good' } : { status: 'exclusive_breastfeeding', milkSupply: 'good', feedsPerDay: 9 }),
          });
        },
      ),
    );
  }

  // Infant 14 months: Dzifa Agbeko, Ewe, Ashaiman.
  {
    const birthAgo = 428;
    const L = birthAgo + 40 * 7;
    M.push(
      mk(
        {
          id: 'm-gh-dzifa',
          name: 'Dzifa Agbeko',
          age: 29,
          country: 'GH',
          region: 'Greater Accra',
          community: 'Ashaiman, Tema',
          language: 'ee',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+233 20 000 0305', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Sells kenkey and fried fish',
          householdNotes: 'Second child. Family from Ho, Volta Region; speaks Ewe at home and Twi at the market.',
          ethnicity: 'Ewe',
          religion: 'Christian (EP Church)',
          gravida: 2,
          parity: 2,
          genotype: 'AA',
          bloodGroup: 'A+',
          heightCm: 162,
          prePregnancyWeightKg: 60,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          children: [older('c-dzifa-1', 'Elikem Agbeko', 'M', 5)],
          assignedWorkerId: 'w-gh-efua',
          facilityId: 'f-gh-korle-bu',
          enrolledDaysAgo: birthAgo + 30,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: birthAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 300 },
            child: { id: 'c-dzifa-2', name: 'Enyonam Agbeko', sex: 'F', birthWeightKg: 3.1, gestationAtBirthWeeks: 40 },
            country: 'GH',
            bp: { s: 114, d: 72 },
          });
        },
      ),
    );
  }

  // =====================================================================
  // SEVERAL CHILDREN WITHIN THE FIRST 1,000 DAYS
  // =====================================================================

  // (s1) Ngozi Chukwu: Enugu, pregnant at 20 weeks while breastfeeding Ebube (10 months). Short birth interval.
  {
    const L = 20 * 7 + 2; // LMP 142 days ago
    const ebubeAgo = 305; // 10 months
    M.push(
      mk(
        {
          id: 'm-ng-ngozic',
          name: 'Ngozi Chukwu',
          age: 27,
          country: 'NG',
          region: 'Enugu',
          community: 'Abakpa Nike, Enugu East',
          language: 'ig',
          literacy: 'basic',
          phone: { access: 'feature', number: '+234 800 000 0128', hasWhatsApp: false },
          incomeBand: 'low',
          occupation: 'Sells vegetables at Abakpa market',
          householdNotes: 'Second pregnancy. Ebube (10 months) still breastfeeds day and night. Husband Ikenna is a mechanic. Her mother-in-law keeps hens in the compound and helps with Ebube on market days. The pregnancy was not planned; she had not started family planning after Ebube.',
          ethnicity: 'Igbo',
          religion: 'Christian (Catholic)',
          gravida: 2,
          parity: 1,
          genotype: 'AA',
          bloodGroup: 'O+',
          heightCm: 159,
          prePregnancyWeightKg: 55,
          pregnancy: { lmp: lmp(20, 2), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['omugwo'],
          assignedWorkerId: 'w-ng-chioma',
          facilityId: 'f-ng-abakpa-phc',
          enrolledDaysAgo: ebubeAgo + 200,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: ebubeAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 350 },
            child: { id: 'c-ngozic-1', name: 'Ebube Chukwu', sex: 'M', birthWeightKg: 3.1, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 112, d: 70 },
            feedingAt: (age) => (age < 183 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : { status: 'complementary_with_breastmilk' }),
          });
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 14, country: 'NG', iptp: true, prePregnancyWeightKg: 55, bp: { s: 108, d: 68 }, hb: [10.4], genotype: 'AA', bloodGroup: 'O+', ultrasoundText: 'Single live intrauterine fetus, 18+6 weeks, placenta anterior, liquor adequate.' });
          b.add(atWeek(L, 19), { kind: 'symptom', symptoms: ['fatigue'], severity: 'mild', via: 'visit', note: 'Tired: still breastfeeding Ebube at night and selling at the market. Asks whether breastfeeding will harm the new baby.' });
          b.add(atWeek(L, 19), { kind: 'constraint', itemId: 'med.iron_folate', reason: 'side_effects', sideEffect: { symptoms: ['nausea', 'constipation'], severity: 'mild' }, note: 'Stopped the blood tablets for a week because of nausea.' });
        },
      ),
    );
  }

  // (s2) Halima Musa: Kaduna, Zainab (3 months) and Aliyu (15 months), born 12 months apart.
  {
    const aliyuAgo = 456; // 15 months
    const zainabAgo = 91; // 3 months
    const L = zainabAgo + 39 * 7;
    M.push(
      mk(
        {
          id: 'm-ng-halimam',
          name: 'Halima Musa',
          age: 24,
          country: 'NG',
          region: 'Kaduna',
          community: 'Kawo, Kaduna North',
          language: 'ha',
          literacy: 'basic',
          phone: { access: 'shared', number: '+234 800 000 0129', hasWhatsApp: false },
          incomeBand: 'very_low',
          occupation: 'Makes and sells kunu at home',
          householdNotes: 'Two children 12 months apart. Stopped breastfeeding Aliyu when she found she was pregnant with Zainab, on her mother-in-law’s advice. Husband Musa is a tricycle (keke) driver. Aliyu missed his 9-month vaccines when Zainab was born.',
          ethnicity: 'Hausa',
          religion: 'Muslim',
          gravida: 2,
          parity: 2,
          genotype: 'AS',
          bloodGroup: 'B+',
          heightCm: 155,
          prePregnancyWeightKg: 50,
          pregnancy: { lmp: dateAgo(L), fetuses: 1, plannedBirthPlace: 'facility' },
          practicesMentioned: ['wankan_jego'],
          assignedWorkerId: 'w-ng-rebecca',
          facilityId: 'f-ng-kawo-phc',
          enrolledDaysAgo: aliyuAgo + 150,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: aliyuAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 300 },
            child: { id: 'c-halimam-1', name: 'Aliyu Musa', sex: 'M', birthWeightKg: 3.0, gestationAtBirthWeeks: 39 },
            country: 'NG',
            bp: { s: 110, d: 70 },
            skipVaccines: ['MCV1', 'YF', 'MenA'],
            feedingAt: (age) => (age < 183 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : age < 250 ? { status: 'complementary_with_breastmilk' } : { status: 'complementary_no_breastmilk' }),
          });
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 16, untilWeek: 39, country: 'NG', iptp: true, prePregnancyWeightKg: 50, bp: { s: 106, d: 66 }, hb: [10.2, 10.0], genotype: 'AS', bloodGroup: 'B+' });
          birthAndFollowUp(b, {
            birthDaysAgo: zainabAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 400 },
            child: { id: 'c-halimam-2', name: 'Zainab Musa', sex: 'F', birthWeightKg: 2.7, gestationAtBirthWeeks: 38 },
            country: 'NG',
            bp: { s: 112, d: 72 },
          });
          b.add(20, { kind: 'constraint', itemId: 'nutr.complementary_feeding', childId: 'c-halimam-1', reason: 'cannot_afford', note: 'Cannot afford eggs or milk for Aliyu every day.' });
        },
      ),
    );
  }

  // (s3) Wanjiku Njoroge: Nairobi, twins Amani and Baraka (6 weeks) and Neema (22 months).
  {
    const neemaAgo = 669; // 22 months
    const twinsAgo = 42;
    const L = twinsAgo + 36 * 7;
    M.push(
      mk(
        {
          id: 'm-ke-wanjiku',
          name: 'Wanjiku Njoroge',
          age: 30,
          country: 'KE',
          region: 'Nairobi',
          community: 'Kariobangi North, Nairobi',
          language: 'sw',
          literacy: 'good',
          phone: { access: 'smartphone', number: '+254 700 000 206', hasWhatsApp: true },
          incomeBand: 'low',
          occupation: 'Tailor (works from home)',
          householdNotes: 'Twins born by caesarean at 36 weeks at Pumwani; Neema is 22 months. Husband Kamau is a matatu conductor. Her sister comes on weekends. Neema is jealous of the twins and wakes at night.',
          children: [{ id: 'c-wanjiku-3', name: 'Baraka Njoroge', sex: 'M', dob: dateAgo(42), birthWeightKg: 2.3, gestationAtBirthWeeks: 36, feeding: 'exclusive_breastfeeding' }],
          ethnicity: 'Kikuyu',
          religion: 'Christian (PCEA)',
          gravida: 2,
          parity: 2,
          genotype: 'unknown',
          bloodGroup: 'A+',
          heightCm: 164,
          prePregnancyWeightKg: 62,
          pregnancy: { lmp: dateAgo(L), fetuses: 2, plannedBirthPlace: 'facility' },
          assignedWorkerId: 'w-ke-wanjiru',
          facilityId: 'f-ke-pumwani',
          enrolledDaysAgo: neemaAgo + 120,
        },
        (b) => {
          birthAndFollowUp(b, {
            birthDaysAgo: neemaAgo,
            birth: { mode: 'vaginal', place: 'facility', complications: ['none'], bloodLossMl: 300 },
            child: { id: 'c-wanjiku-1', name: 'Neema Njoroge', sex: 'F', birthWeightKg: 3.2, gestationAtBirthWeeks: 40 },
            country: 'KE',
            bp: { s: 114, d: 72 },
            feedingAt: (age) => (age < 183 ? { status: 'exclusive_breastfeeding', milkSupply: 'good' } : age < 420 ? { status: 'complementary_with_breastmilk' } : { status: 'complementary_no_breastmilk' }),
          });
          ancHistory(b, { lmpDaysAgo: L, bookingWeek: 12, untilWeek: 36, country: 'KE', iptp: false, prePregnancyWeightKg: 62, bp: { s: 112, d: 72 }, hb: [11.2, 10.5], genotype: 'unknown', bloodGroup: 'A+', fetuses: 2, ultrasoundText: 'Live dichorionic diamniotic twins, 13+2 weeks.' });
          for (const [id, name, sex, bw] of [['c-wanjiku-2', 'Amani Njoroge', 'M', 2.4], ['c-wanjiku-3', 'Baraka Njoroge', 'M', 2.3]] as const) {
            birthAndFollowUp(b, {
              secondTwin: id === 'c-wanjiku-3',
              birthDaysAgo: twinsAgo,
              birth: { mode: 'caesarean', place: 'facility', complications: ['preterm'], bloodLossMl: 700 },
              child: { id, name, sex, birthWeightKg: bw, gestationAtBirthWeeks: 36 },
              country: 'KE',
              pncDays: [1, 3, 10],
              bp: { s: 118, d: 76 },
            });
          }
        },
      ),
    );
  }

  return M;
}
