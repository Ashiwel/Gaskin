/**
 * Gaskin core types. This file is the contract between modules:
 * clinical knowledge base, rules engine, synthetic data, AI layer,
 * messaging, illustrations and UI. Change it deliberately.
 */

// ---------- Reference ----------

export type CountryCode = 'NG' | 'KE' | 'GH';

/**
 * en English, pcm Nigerian Pidgin, ha Hausa, yo Yoruba, ig Igbo, sw Swahili, tw Twi,
 * bin Edo (Bini), urh Urhobo, ar Arabic (Shuwa), dag Dagbani, luo Dholuo, ee Ewe, ff Fulfulde
 */
export type LanguageCode = 'en' | 'pcm' | 'ha' | 'yo' | 'ig' | 'sw' | 'tw' | 'bin' | 'urh' | 'ar' | 'dag' | 'luo' | 'ee' | 'ff';

/**
 * Extra languages with draft packs for francophone, lusophone and Bantu-speaking Africa
 * (src/i18n/packs): pt Portuguese (Mozambique, Angola), zu isiZulu, xh isiXhosa, rw Kinyarwanda,
 * ln Lingala, ny Chichewa/Nyanja, sn chiShona, lg Luganda, ki Gĩkũyũ, st Sesotho, tn Setswana.
 * Kept apart from LanguageCode so exhaustive Record<LanguageCode, …> tables elsewhere still compile;
 * fold them into LanguageCode when those tables gain entries.
 */
export type ExtraLanguageCode = 'pt' | 'zu' | 'xh' | 'rw' | 'ln' | 'ny' | 'sn' | 'lg' | 'ki' | 'st' | 'tn';

export type Channel = 'sms' | 'whatsapp' | 'email' | 'voice' | 'print';

export interface Citation {
  /** Stable id, e.g. 'who-anc-2016' */
  id: string;
  /** Short human label, e.g. 'WHO ANC 2016, rec. A.1.1' */
  label: string;
  url?: string;
}

export interface ChannelCost {
  channel: Channel;
  /** Cost of one billable unit in local currency */
  unitCostLocal: number;
  unitCostUSD: number;
  /** What a unit is: one SMS segment, one WhatsApp utility template, etc. */
  unit: string;
  notes?: string;
  source?: Citation;
}

export interface CountryProfile {
  code: CountryCode;
  name: string;
  currency: string; // 'NGN' | 'KES' | 'GHS'
  currencySymbol: string;
  languages: LanguageCode[];
  /** Regions/states used in synthetic data */
  regions: string[];
  /** Frontline worker role names in this country, e.g. CHEW, CHP, CHO */
  workerRoles: string[];
  /** National guideline sources layered on WHO */
  guidelineSources: Citation[];
  channelCosts: ChannelCost[];
  /** Emergency / referral line shown to mothers */
  emergencyLine?: string;
}

// ---------- People ----------

export type WorkerRole =
  | 'midwife'
  | 'nurse'
  | 'chew' // Nigeria Community Health Extension Worker
  | 'jchew'
  | 'chips_agent' // Nigeria CHIPS
  | 'chp' // Kenya Community Health Promoter
  | 'cho' // Ghana Community Health Officer
  | 'doctor'
  | 'obgyn'
  | 'paediatrician';

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;
  facilityId: string;
  country: CountryCode;
  yearsExperience: number;
  /** Seniors can approve global rule changes */
  isClinicalReviewer?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: 'phc' | 'general_hospital' | 'teaching_hospital' | 'private_clinic' | 'chps_compound' | 'dispensary';
  country: CountryCode;
  region: string;
  /** Where to refer urgent cases from this facility */
  referralFacilityId?: string;
}

export type IncomeBand = 'very_low' | 'low' | 'middle' | 'high';
export type Literacy = 'none' | 'basic' | 'good';
export type PhoneAccess = 'none' | 'shared' | 'feature' | 'smartphone';
export type Genotype = 'AA' | 'AS' | 'SS' | 'AC' | 'SC' | 'unknown';

export type ConditionCode =
  | 'sickle_cell_disease'
  | 'hiv'
  | 'chronic_hypertension'
  | 'diabetes_preexisting'
  | 'gestational_diabetes'
  | 'pre_eclampsia_history'
  | 'anaemia'
  | 'asthma'
  | 'epilepsy'
  | 'obesity'
  | 'underweight'
  | 'hepatitis_b'
  | 'malaria_current'
  | 'depression_history'
  | 'thyroid_disorder';

export interface Medication {
  name: string;
  dose?: string;
  frequency?: string;
  startedAt: string; // ISO date
  stoppedAt?: string;
  prescribedBy?: string;
}

export interface Child {
  id: string;
  name: string;
  sex: 'F' | 'M';
  dob: string; // ISO date
  birthWeightKg: number;
  gestationAtBirthWeeks: number;
  feeding: 'exclusive_breastfeeding' | 'mixed' | 'formula' | 'complementary_with_breastmilk' | 'complementary_no_breastmilk';
}

export interface Pregnancy {
  /** Last menstrual period, ISO date. EDD derived. */
  lmp: string;
  /** Fetuses: 1 singleton, 2 twins */
  fetuses: number;
  /** Planned place of birth */
  plannedBirthPlace?: 'facility' | 'home' | 'tba';
}

export interface Birth {
  date: string;
  mode: 'vaginal' | 'assisted' | 'caesarean';
  place: 'facility' | 'home' | 'tba' | 'in_transit';
  complications: Array<'pph' | 'pre_eclampsia' | 'eclampsia' | 'sepsis' | 'obstructed_labour' | 'perineal_tear' | 'retained_placenta' | 'preterm' | 'none'>;
  bloodLossMl?: number;
}

export interface Consent {
  dataProcessing: boolean;
  messaging: boolean;
  preferredChannel?: Channel;
  /** For adolescents, guardian involvement recorded */
  guardianInvolved?: boolean;
  recordedAt: string;
  recordedBy: string; // worker id
}

export interface Mother {
  id: string;
  name: string;
  age: number;
  country: CountryCode;
  region: string;
  community: string;
  /** Pack used for her messages and handouts ('en' when her language has no pack yet) */
  language: LanguageCode;
  /**
   * Optional. The language she actually speaks, as a BCP-47 tag (e.g. 'zu', 'tiv', 'nso'), even when
   * Gaskin has no pack for it. Rendering uses packFor(languageTag) when a pack exists, else plain
   * English with a visible "Coming soon" note (motherLanguageInfo in src/i18n). See src/geo languagesFor and packFor.
   */
  languageTag?: string;
  /** Optional. LGA, sub-county, district or municipality (src/geo loadAreas) */
  area?: string;
  literacy: Literacy;
  phone: { access: PhoneAccess; number?: string; hasWhatsApp: boolean };
  email?: string;
  incomeBand: IncomeBand;
  occupation?: string;
  householdNotes?: string;
  ethnicity?: string;
  religion?: string;

  gravida: number;
  parity: number;
  previousCaesarean: boolean;
  previousStillbirth: boolean;
  previousPPH: boolean;
  conditions: ConditionCode[];
  allergies: string[];
  genotype: Genotype;
  bloodGroup?: string; // e.g. 'O+'
  heightCm?: number;
  prePregnancyWeightKg?: number;

  medications: Medication[];
  pregnancy?: Pregnancy;
  birth?: Birth;
  children: Child[];

  /** Traditional practices she or her family follow or plan (ids from the traditional practices library) */
  practicesMentioned: string[];

  assignedWorkerId: string;
  facilityId: string;
  enrolledAt: string;
  consent: Consent;

  /** Everything that happens is an event; state is derived from events */
  events: ClinicalEvent[];
  /** Personal use: what she has told Gaskin about her own care (ISO dates) */
  selfCare?: { registeredWithClinicAt?: string; clinicName?: string; nextCheckupAt?: string };
}

// ---------- Events (append-only timeline) ----------

interface EventBase {
  id: string;
  at: string; // ISO datetime
  recordedBy: string; // worker id, 'mother' (self-report via SMS/WhatsApp) or 'system'
  /** Child id when the event concerns the baby */
  childId?: string;
  note?: string;
}

export interface VisitEvent extends EventBase {
  kind: 'visit';
  visitType: 'anc' | 'pnc' | 'child_health' | 'home_visit' | 'remote_checkin' | 'emergency';
  /** e.g. ANC contact number */
  contactNumber?: number;
  facilityId?: string;
  attended: boolean;
}

export interface VitalsEvent extends EventBase {
  kind: 'vitals';
  systolic?: number;
  diastolic?: number;
  weightKg?: number;
  temperatureC?: number;
  pulse?: number;
  fundalHeightCm?: number;
  fetalHeartRate?: number;
  muacCm?: number;
}

export type LabTest =
  | 'haemoglobin' // g/dL
  | 'hiv'
  | 'syphilis'
  | 'hepatitis_b'
  | 'malaria_rdt'
  | 'urine_protein' // 0, 1 (+), 2 (++), 3 (+++)
  | 'urine_glucose'
  | 'blood_glucose_fasting' // mmol/L
  | 'ogtt_2h' // mmol/L
  | 'genotype'
  | 'blood_group'
  | 'ultrasound';

export interface LabEvent extends EventBase {
  kind: 'lab';
  test: LabTest;
  /** Numeric value or categorical result */
  value: number | 'positive' | 'negative' | string;
  unit?: string;
}

export type SymptomCode =
  | 'vaginal_bleeding'
  | 'severe_headache'
  | 'blurred_vision'
  | 'convulsions'
  | 'fever'
  | 'severe_abdominal_pain'
  | 'reduced_fetal_movement'
  | 'swelling_face_hands'
  | 'breathlessness'
  | 'leaking_fluid'
  | 'painful_urination'
  | 'nausea_vomiting'
  | 'heartburn'
  | 'back_pain'
  | 'leg_cramps'
  | 'constipation'
  | 'fatigue'
  | 'low_mood'
  | 'anxiety'
  | 'thoughts_of_self_harm'
  | 'heavy_postpartum_bleeding'
  | 'foul_discharge'
  | 'breast_pain_redness'
  | 'cracked_nipples'
  | 'low_milk_supply'
  | 'insomnia'
  | 'calf_pain_swelling'
  // newborn / infant
  | 'baby_not_feeding'
  | 'baby_fever'
  | 'baby_cold'
  | 'baby_convulsions'
  | 'baby_fast_breathing'
  | 'baby_chest_indrawing'
  | 'baby_yellow_skin'
  | 'baby_cord_redness'
  | 'baby_lethargic'
  | 'baby_diarrhoea'
  | 'baby_vomiting_everything'
  // found at a visit
  | 'pallor';

export interface SymptomEvent extends EventBase {
  kind: 'symptom';
  symptoms: SymptomCode[];
  severity?: 'mild' | 'moderate' | 'severe';
  /** How the symptom reached us */
  via: 'visit' | 'sms' | 'whatsapp' | 'voice' | 'worker_call';
}

export interface ScreeningEvent extends EventBase {
  kind: 'screening';
  instrument: 'epds' | 'phq9' | 'phq2';
  score: number;
  /** EPDS item 10 (self-harm) answered positively */
  selfHarmFlag?: boolean;
}

export interface BirthEvent extends EventBase {
  kind: 'birth';
  birth: Birth;
  child: Child;
}

export interface FeedingEvent extends EventBase {
  kind: 'feeding';
  status: Child['feeding'];
  milkSupply?: 'good' | 'low' | 'very_low';
  feedsPerDay?: number;
  latchProblem?: boolean;
}

export interface GrowthEvent extends EventBase {
  kind: 'growth';
  weightKg?: number;
  lengthCm?: number;
  muacCm?: number;
  headCircumferenceCm?: number;
}

export interface ImmunisationEvent extends EventBase {
  kind: 'immunisation';
  vaccines: string[]; // e.g. ['BCG','OPV0','HepB0']
}

export interface MedicationEvent extends EventBase {
  kind: 'medication';
  action: 'start' | 'stop';
  medication: Medication;
}

/** Free-text report from a doctor or facility, optionally parsed into structured findings by AI */
export interface ReportEvent extends EventBase {
  kind: 'report';
  author: string;
  text: string;
  extracted?: ExtractedFinding[];
  extractionConfirmedBy?: string;
}

export interface ReferralEvent extends EventBase {
  kind: 'referral';
  toFacilityId: string;
  reason: string;
  urgency: 'emergency' | 'urgent' | 'routine';
  status: 'open' | 'arrived' | 'completed' | 'not_completed';
}

/** Why a recommended test, medicine, vaccine, food or trip could not happen. */
export type ConstraintReason = 'cannot_afford' | 'not_available' | 'side_effects' | 'declined' | 'forgets' | 'no_transport';

/** Why she declined. Her right to decide is recorded; the plan answers the concern and offers again. */
export type DeclinedReason = 'fear_of_side_effects' | 'cost' | 'religious_or_cultural' | 'partner_or_family_objects' | 'does_not_see_need' | 'distance_or_time' | 'prefers_traditional_remedy' | 'other';

/** A recommendation could not be followed. The engine answers with an alternative (never a silent downgrade). */
export interface ConstraintEvent extends EventBase {
  kind: 'constraint';
  /** Plan item id or checklist base id, e.g. 'med.iron_folate', 'test.haemoglobin', 'd.vaccine.PENTA2' */
  itemId: string;
  reason: ConstraintReason;
  /** Set when the item could not be done today but may be later (tests: "not done today") */
  temporary?: boolean;
  /** Required when reason is 'declined' */
  declinedReason?: DeclinedReason;
  /** Required when reason is 'side_effects'. Symptom codes come from SIDE_EFFECTS (src/clinical/sideEffects.ts). */
  sideEffect?: { symptoms: string[]; severity: 'mild' | 'moderate' | 'severe' };
}

export type ClinicalEvent =
  | ConstraintEvent
  | VisitEvent
  | VitalsEvent
  | LabEvent
  | SymptomEvent
  | ScreeningEvent
  | BirthEvent
  | FeedingEvent
  | GrowthEvent
  | ImmunisationEvent
  | MedicationEvent
  | ReportEvent
  | ReferralEvent;

export interface ExtractedFinding {
  field: string; // e.g. 'systolic', 'haemoglobin', 'diagnosis'
  value: string;
  confidence: 'high' | 'medium' | 'low';
}

// ---------- Derived state ----------

export type JourneyStage = 'preconception' | 'pregnancy' | 'postpartum' | 'infant';

/** One child under 1,000 days, as of asOf. */
export interface ChildState {
  childId: string;
  name: string;
  sex: Child['sex'];
  dob: string;
  ageDays: number;
  /** Corrected for prematurity (born before 37 weeks), to 2 years */
  correctedAgeDays?: number;
  feeding: Child['feeding'];
  /** Same date of birth as a sibling */
  twin: boolean;
  latestWeightKg?: number;
  latestWeightAt?: string;
  latestMuacCm?: number;
  immunisation: { next?: { label: string; due: string; missing: string[]; overdueDays: number }; overdue: string[] };
  /** Next CDC milestone set to check, in months */
  milestonesDueMonths?: number;
  risks: Risk[];
}

/** A test that should have a result but does not (not available, declined, not done today, or never done). */
export interface UnknownResult {
  test: string;
  since: string;
  /** What not knowing could hide, and what to do */
  consequence: string;
  /** 'refer' when the missing result could hide danger now */
  action: 'refer_for_test' | 'test_next_visit';
  childId?: string;
}

export interface PatientState {
  motherId: string;
  asOf: string;
  stage: JourneyStage;
  trimester?: 1 | 2 | 3;
  gestationalWeeks?: number;
  edd?: string;
  daysPostpartum?: number;
  /** Youngest child's age in days */
  infantAgeDays?: number;
  infant?: Child;
  /** Every child under 1,000 days, youngest last. `infant` is the youngest, kept for compatibility. */
  children?: ChildState[];
  /** Pregnant while also caring for a child under 1,000 days */
  concurrent?: boolean;
  /** Months from the last birth to this conception (LMP), when pregnant again */
  interpregnancyMonths?: number;
  /** Tests with no result that matter now */
  unknowns?: UnknownResult[];
  /** Constraints recorded in the last 90 days, latest per item */
  constraints?: Array<{ itemId: string; reason: ConstraintReason; at: string; childId?: string }>;
  latest: {
    systolic?: number;
    diastolic?: number;
    haemoglobin?: number;
    weightKg?: number;
    epds?: number;
    milkSupply?: FeedingEvent['milkSupply'];
    infantWeightKg?: number;
  };
  /** Symptoms reported in the last 7 days */
  recentSymptoms: SymptomCode[];
  ancContactsAttended: number;
  risks: Risk[];
  /** Who the worker should contact next: higher score = sooner. Reasons are short, worker-facing. */
  contactPriority?: { score: number; reasons: string[] };
}

export type Severity = 'low' | 'moderate' | 'high' | 'urgent';

export interface Risk {
  code: string; // e.g. 'pre_eclampsia_risk', 'severe_anaemia'
  label: string;
  severity: Severity;
  /** Plain explanation of what triggered it */
  reason: string;
  sources: Citation[];
}

// ---------- Care plan ----------

export type PlanCategory =
  | 'danger_signs'
  | 'visits'
  | 'tests'
  | 'medication'
  | 'nutrition'
  | 'rest_and_sleep'
  | 'activity'
  | 'breastfeeding'
  | 'baby_care'
  | 'immunisation'
  | 'mental_health'
  | 'family_support'
  | 'birth_preparedness'
  | 'family_planning'
  | 'traditional_practice'
  | 'education';

/**
 * Evidence grade. A/B/C follow guideline strength.
 * trad_* grade traditional practices; 'expert' means learned from approved expert overrides.
 */
export type EvidenceGrade =
  | 'A' // strong guideline recommendation, high/moderate certainty
  | 'B' // conditional/context-specific recommendation
  | 'C' // good practice point / expert consensus
  | 'trad_supported' // traditional practice with supporting evidence
  | 'trad_plausible' // plausible mechanism, under-studied
  | 'trad_neutral' // harmless, cultural value
  | 'trad_harmful' // evidence of harm: reframe or discourage
  | 'expert'; // from approved expert feedback

export type IllustrationKey =
  | 'danger_bleeding'
  | 'danger_headache'
  | 'danger_fever'
  | 'danger_convulsion'
  | 'danger_baby_movement'
  | 'danger_swelling'
  | 'danger_breathing'
  | 'baby_danger'
  | 'clinic_visit'
  | 'iron_tablet'
  | 'medicine'
  | 'mosquito_net'
  | 'balanced_plate'
  | 'protein_foods'
  | 'iron_foods'
  | 'water'
  | 'sleep_left_side'
  | 'rest'
  | 'walking'
  | 'breastfeeding'
  | 'breastfeeding_latch'
  | 'skin_to_skin'
  | 'cord_care'
  | 'vaccination'
  | 'complementary_food'
  | 'handwashing'
  | 'family_support'
  | 'talk_to_someone'
  | 'birth_bag'
  | 'blood_pressure'
  | 'test_tube'
  | 'calendar'
  | 'phone_call'
  | 'family_planning'
  | 'warm_baby'
  | 'growth_chart';

/** Steps and concrete examples for doing a recommendation. Every string has a template key in PLAN_TEXT for translation. */
export interface HowTo {
  steps: string[];
  examples?: string[];
  /** What to avoid, if anything */
  avoid?: string[];
  stepKeys?: string[];
  exampleKeys?: string[];
  avoidKeys?: string[];
  illustration?: IllustrationKey;
  /** Id in GUIDES (src/clinical/guides.ts) */
  guideId?: string;
}

export interface PlanAlternative {
  reason: ConstraintReason;
  item: { title: string; detail: string; motherText: string; motherTextKey?: string; motherTextParams?: Record<string, string | number>; howTo?: HowTo };
}

export interface PlanItem {
  /** Stable rule id, e.g. 'med.iron_folate'. Overrides target this id. */
  id: string;
  category: PlanCategory;
  title: string;
  /** Detail for the health worker: what and why */
  detail: string;
  /** Short plain-language instruction for the mother (English source text) */
  motherText: string;
  /** Template key in MOTHER_TEXT (src/clinical/motherText.ts) that motherText was rendered from */
  motherTextKey?: string;
  /** Values for the template's {placeholders} */
  motherTextParams?: Record<string, string | number>;
  /** 1 highest .. 5 lowest */
  priority: 1 | 2 | 3 | 4 | 5;
  audience: 'mother' | 'worker' | 'both';
  /** e.g. 'Daily until 3 months after birth', 'By 28 weeks' */
  timing?: string;
  dueDate?: string;
  evidence: EvidenceGrade;
  sources: Citation[];
  /** Why this item is in her plan: the facts that triggered it */
  because: string[];
  /** Safety-critical items cannot be removed by a single worker */
  locked?: boolean;
  origin: 'guideline' | 'traditional' | 'learned_rule' | 'worker_added' | 'ai_suggested';
  illustration?: IllustrationKey;
  /** Set when an override changed or removed this item */
  overriddenBy?: string; // override id
  status: 'active' | 'removed' | 'done';
  /** The child this item is about, when she has more than one child under 1,000 days */
  childId?: string;
  /** How to do it: steps and examples */
  howTo?: HowTo;
  /** What to offer when she cannot do it (tests, medicines, vaccines, food, transport) */
  alternatives?: PlanAlternative[];
  /** Set when a recorded constraint changed this item */
  constraint?: { reason: ConstraintReason; at: string };
  /** Worker-only content (clinical detail, standing orders); hidden in personal mode */
  workerOnly?: boolean;
}

export interface Alert {
  id: string;
  level: 'emergency' | 'urgent' | 'warning';
  title: string;
  /** What to do right now */
  action: string;
  reason: string;
  sources: Citation[];
  /** Mother or child */
  subject: 'mother' | 'child';
  /** What to tell the mother right now, in plain words (rendered English) */
  motherText?: string;
  /** Template key in MOTHER_TEXT */
  motherTextKey?: string;
  motherTextParams?: Record<string, string | number>;
  /** The child this alert is about */
  childId?: string;
}

export interface NextContact {
  date: string;
  type: VisitEvent['visitType'];
  label: string; // e.g. 'ANC contact 5 (30 weeks)'
}

export interface CarePlan {
  motherId: string;
  version: number;
  generatedAt: string;
  state: PatientState;
  /** One or two sentence summary for the worker */
  summary: string;
  alerts: Alert[];
  items: PlanItem[];
  nextContact?: NextContact;
  changes?: PlanDiff;
}

export interface PlanDiff {
  added: string[]; // item ids
  removed: string[];
  changed: string[];
  newAlerts: string[];
}

// ---------- Expert feedback and learning ----------

export interface Override {
  id: string;
  motherId: string;
  /** Target item id; for 'add', the id of the new item */
  itemId: string;
  action: 'remove' | 'modify' | 'add';
  /** For modify/add: the replacement or new item content */
  item?: Partial<PlanItem> & { title: string };
  reason: string;
  workerId: string;
  createdAt: string;
  /** Applies to this patient now; optionally proposed for everyone like her */
  proposeGlobal: boolean;
  /** Patient-level overrides are active immediately. Global proposals need review. */
  status: 'active' | 'reverted';
  /** Worker who reverted it */
  revertedBy?: string;
  revertedAt?: string;
}

/** A proposal to change the knowledge base, raised from one or more overrides */
export interface RuleProposal {
  id: string;
  title: string;
  /** The situation in which the change should apply */
  appliesWhen: RuleCondition;
  effect: Override['action'];
  itemId: string;
  item?: Override['item'];
  rationale: string;
  supportingOverrideIds: string[];
  /** Distinct workers who made a similar change */
  supportingWorkerIds: string[];
  status: 'pending' | 'approved' | 'rejected' | 'needs_evidence';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  /** Worker whose override raised the proposal */
  createdBy?: string;
}

/** Structured condition for learned rules; all present fields must match */
export interface RuleCondition {
  stage?: JourneyStage;
  conditionsAny?: ConditionCode[];
  riskCodesAny?: string[];
  incomeBands?: IncomeBand[];
  countries?: CountryCode[];
  minAge?: number;
  maxAge?: number;
}

export interface LearnedRule {
  id: string;
  proposalId: string;
  appliesWhen: RuleCondition;
  effect: Override['action'];
  itemId: string;
  item?: Override['item'];
  approvedBy: string;
  approvedAt: string;
}

// ---------- Messaging ----------

export interface OutboundMessage {
  id: string;
  motherId: string;
  channel: Channel;
  language: LanguageCode;
  body: string;
  /** SMS segments (160 GSM-7 chars, 70 if Unicode) */
  segments?: number;
  estCostLocal: number;
  estCostUSD: number;
  status: 'draft' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
  sentAt?: string;
  planVersion: number;
  itemIds: string[];
  /** Was the text written or translated by AI (reviewed by a worker before sending)? */
  aiAssisted: boolean;
  reviewedBy?: string;
  /** Worker who drafted or queued it */
  createdBy?: string;
  /** Worker who pressed send */
  sentBy?: string;
}

/** Inbound message from the mother (symptom report, question, reply) */
export interface InboundMessage {
  id: string;
  motherId: string;
  channel: Channel;
  body: string;
  receivedAt: string;
  /** Symptoms the system recognised in the text */
  parsedSymptoms?: SymptomCode[];
  /** Worker who read and handled it */
  handledBy?: string;
}

// ---------- Knowledge base entries (for the library screen) ----------

export interface TraditionalPractice {
  id: string;
  name: string;
  /** Local names, e.g. { yo: 'agbo', ig: 'omugwo' } */
  localNames?: Partial<Record<LanguageCode, string>>;
  countries: CountryCode[];
  groups?: string[]; // e.g. ['Igbo','Yoruba']
  stage: JourneyStage[];
  description: string;
  grade: Extract<EvidenceGrade, 'trad_supported' | 'trad_plausible' | 'trad_neutral' | 'trad_harmful'>;
  /** What the science says */
  evidenceSummary: string;
  /** How the worker should respond: affirm, adapt, or reframe */
  guidance: string;
  /** Mother-facing line */
  motherText: string;
  sources: Citation[];
}

// ---------- App-level ----------

export interface DemoState {
  /** The simulated "today" for the whole demo */
  clock: string;
  country: CountryCode | 'ALL';
  currentWorkerId: string;
  mothers: Mother[];
  workers: Worker[];
  facilities: Facility[];
  overrides: Override[];
  proposals: RuleProposal[];
  learnedRules: LearnedRule[];
  outbound: OutboundMessage[];
  inbound: InboundMessage[];
  /** Last plan version per mother, to show what changed */
  planVersions: Record<string, { version: number; itemIds: string[]; alertIds: string[] }>;
}
