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
  language: LanguageCode;
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
  | 'baby_vomiting_everything';

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

export type ClinicalEvent =
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
