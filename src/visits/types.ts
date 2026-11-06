import type { Child, Citation, ClinicalEvent, ConstraintReason, CountryCode, HowTo, IllustrationKey, LabTest, Mother, SymptomCode, VisitEvent } from '../types';
import type { Facts } from '../engine/facts';
import type { VisitTemplate } from './catalogue';

/** The steps of a guided visit, in the order the worker meets them. */
export type VisitSection = 'ask' | 'check_mother' | 'check_baby' | 'milestones' | 'do' | 'tell' | 'book';

/** What the worker does about an abnormal finding. Defaults to 'refer' where CHEW standing orders are unclear. */
export type FindingAction = 'refer' | 'treat' | 'recheck';
export type FindingUrgency = 'emergency' | 'urgent' | 'routine';

/** What counts as abnormal and what to do about it. */
export interface FindingSpec {
  /** Worker-facing description of the abnormal finding, e.g. 'Foot turned in and down, cannot be corrected' */
  label: string;
  action: FindingAction;
  urgency: FindingUrgency;
  /** What to do, worker-facing. {hospital} and {sameDay} are filled from the country rules. */
  todo: string;
  /** Symptom to record on the timeline so the rules engine raises its alert */
  symptom?: SymptomCode;
  /** Mother-facing template key to explain this finding to her (MOTHER_TEXT or VISIT_TEXT) */
  textKey?: string;
}

export interface NumberBand {
  /** Abnormal when value < below */
  below?: number;
  /** Abnormal when value >= atLeast */
  atLeast?: number;
  finding: FindingSpec;
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** Present when this option is abnormal */
  finding?: FindingSpec;
  /** Value written to a lab event when the item emits a lab result */
  labValue?: string | number;
}

export type ItemInput =
  | { kind: 'normal_abnormal'; normal: string; abnormal: FindingSpec }
  | { kind: 'yes_no'; question?: string; abnormalWhen: 'yes' | 'no' | 'never'; finding?: FindingSpec }
  | { kind: 'number'; unit: string; min: number; max: number; step: number; bands: NumberBand[]; normal?: string }
  | { kind: 'bp'; bands: Array<{ systolicAtLeast?: number; diastolicAtLeast?: number; systolicBelow?: number; finding: FindingSpec }> }
  | { kind: 'choice'; options: ChoiceOption[] }
  | { kind: 'multi'; options: ChoiceOption[]; noneLabel: string }
  | { kind: 'epds'; positive: number; refer: number }
  | { kind: 'done'; doneLabel: string; notDoneLabel: string; notDone?: FindingSpec }
  | { kind: 'told' }
  | { kind: 'milestone'; windowEndMonths?: number; ageMonths: number }
  | { kind: 'book' };

/** How a recorded answer becomes timeline data */
export type Emit =
  | { vital: 'weightKg' | 'temperatureC' | 'pulse' | 'fundalHeightCm' | 'fetalHeartRate' | 'muacCm' }
  | { bp: true }
  | { growth: 'weightKg' | 'lengthCm' | 'muacCm' | 'headCircumferenceCm' }
  | { lab: LabTest; unit?: string }
  | { immunisation: true }
  | { medication: string; dose?: string }
  | { feeding: 'latch' | 'ebf' | 'supply' | 'feeds' }
  | { screening: 'epds' };

/** One line of a built checklist. Serialisable: no functions. */
export interface ChecklistItem {
  /** Unique within the checklist. Baby items carry '@childId'. */
  id: string;
  /** Stable catalogue id, e.g. 'b.talipes', 'do.vaccine.MCV1', 'ms.9m.sits' */
  baseId: string;
  section: VisitSection;
  subject: 'mother' | 'baby';
  childId?: string;
  childName?: string;
  title: string;
  /** How to do the check, worker-facing */
  how?: string;
  /** Why this check: shown in the expander with sources */
  why: string;
  sources: Citation[];
  /** 1 highest .. 5 lowest */
  priority: 1 | 2 | 3 | 4 | 5;
  input: ItemInput;
  emit?: Emit;
  illustration?: IllustrationKey;
  /** One-time item (newborn malformation screen, vitamin K): recorded in the visit note so it is not asked again */
  once?: boolean;
  /** Only shown when this other item (same subject/child) was found abnormal */
  dependsOn?: string;
  /** Tell items: template key (MOTHER_TEXT or VISIT_TEXT) and params */
  textKey?: string;
  params?: Record<string, string | number>;
  /** Tell items: rendered English plain text */
  english?: string;
  /** Tell items: extra lines (e.g. milestones to expect), each a template key with the same params */
  subKeys?: string[];
  /** English for subKeys, same order */
  subEnglish?: string[];
  /** Vaccine items */
  vaccines?: string[];
  dueDate?: string;
  /** Book item: the proposed next visit */
  next?: { date: string; label: string; templateId?: string };
  /** Facts about her or the baby that added or changed this item */
  because?: string[];
  /** Visits v2: items that open when this item's answer is one of `answerIn` (status, choice value, or 'not_available' | 'declined' | 'not_done_today') */
  followUps?: Array<{ when: { answerIn: string[] }; items: ChecklistItem[] }>;
  /** Visits v2: steps and examples for tell items and actions */
  howTo?: HowTo;
  /** Visits v2: a test item; offers Done, Not available, Declined, Not done today. A missing result is unknown, never normal. */
  isTest?: boolean;
  /** Visits v2: the plan item or constraint target this item records against (e.g. 'med.iron_folate', 'test.haemoglobin') */
  constraintTarget?: string;
  /** Visits v2: choice value or status that records a ConstraintEvent with this reason */
  constraintOn?: Record<string, ConstraintReason>;
  /** Visits v2: GUIDES id the summary can open */
  guideId?: string;
}

export interface ChecklistSection {
  id: VisitSection;
  title: string;
  items: ChecklistItem[];
}

export interface VisitChecklist {
  id: string;
  templateId: string;
  label: string;
  motherId: string;
  asOf: string;
  country: CountryCode;
  stage: VisitTemplate['stage'];
  visitType: VisitEvent['visitType'];
  contactNumber?: number;
  children: Array<{ id: string; name: string; ageDays: number; ageLabel: string; correctedAgeDays?: number; templateId?: string; templateLabel?: string }>;
  /** The same items grouped by person: the mother first, then each child (youngest first), each with its own sections. */
  bySubject?: Array<{ childId?: string; title: string; sections: ChecklistSection[] }>;
  /** Short facts for the header, e.g. '26 weeks', 'Sickle cell disease' */
  context: string[];
  /** Why the list differs from the standard template */
  personalisation: string[];
  sections: ChecklistSection[];
  /** Flat, ordered */
  items: ChecklistItem[];
  /** Items left out because they are already done */
  skipped: Array<{ id: string; title: string; reason: string }>;
  nextVisit?: { date: string; label: string; templateId?: string };
  referralFacilityId?: string;
}

/** A recorded answer for one item. */
export interface ChecklistResult {
  itemId: string;
  status: 'normal' | 'abnormal' | 'yes' | 'no' | 'done' | 'not_done' | 'told' | 'achieved' | 'not_yet' | 'booked' | 'not_checked' | 'value' | 'not_available' | 'declined' | 'not_done_today';
  /** Number items, EPDS total, systolic for BP */
  value?: number;
  /** Diastolic for BP */
  value2?: number;
  /** Choice option value */
  choice?: string;
  /** Multi-select option values */
  choices?: string[];
  /** EPDS item 10 (self-harm) answered above zero */
  selfHarm?: boolean;
  /** Book item: chosen date */
  date?: string;
  note?: string;
}

/** Visits v2: what the summary screen shows and offers. */
export interface ChecklistSummary {
  abnormal: Finding[];
  /** Findings whose action is recheck */
  rechecks: Array<{ itemId: string; label: string }>;
  /** Active items with no answer; important = priority 1–2, a test, or a danger-sign question */
  unanswered: Array<{ itemId: string; label: string; important: boolean }>;
  /** Tests with no result (not available, declined, not done today) and what that means */
  unknowns: Array<{ itemId: string; label: string; status: 'not_available' | 'declined' | 'not_done_today' | 'unanswered'; consequence: string; referToday: boolean }>;
  recommendations: Array<{ text: string; guideId?: string; itemId?: string }>;
  /** One line per child, for multi-child visits */
  perChild: Array<{ childId: string; name: string; answered: number; total: number; findings: number }>;
}

/** An abnormal finding evaluated from a result. */
export interface Finding {
  itemId: string;
  baseId: string;
  title: string;
  subject: 'mother' | 'baby';
  childId?: string;
  childName?: string;
  label: string;
  action: FindingAction;
  urgency: FindingUrgency;
  todo: string;
  symptom?: SymptomCode;
  textKey?: string;
  sources: Citation[];
}

/** Context passed to catalogue predicates and input builders. */
export interface VisitCtx {
  mother: Mother;
  f: Facts;
  asOf: string;
  country: CountryCode;
  template: VisitTemplate;
  ga?: number;
  daysPostpartum?: number;
  child?: Child;
  childAgeDays?: number;
  /** Corrected for prematurity (born before 37 weeks) */
  childAgeMonths?: number;
  babies: Child[];
  flags: RiskFlags;
  epds: { positive: number; refer: number };
  bmi?: number;
  ancAttended: number;
  /** EPDS is due at this visit (booking, about 32 weeks, 6 weeks after birth, or history of depression) */
  epdsDue: boolean;
  epdsRecentDays?: number;
  /** A haemoglobin test is scheduled at this visit */
  hbDue: boolean;
  hbRecentDays?: number;
  testedSinceLmp: Partial<Record<'hiv' | 'syphilis' | 'hepatitis_b' | 'ultrasound', boolean>>;
  genotypeTested: boolean;
  iptpEligible: boolean;
  onSp: boolean;
  spDoses: number;
  lastSpDays?: number;
  dewormedThisPregnancy: boolean;
  tdDoses: number;
  tdThisPregnancy: number;
  lastTdDays?: number;
  aspirinIndicated: boolean;
  aspirinReasons: string[];
  onAspirin: boolean;
  facilityBirthNeeded: boolean;
  facilityBirthReasons: string[];
  lastWeight?: { kg: number; date: string };
  childDewormedDays?: number;
  /** Does the country schedule list this code (e.g. 'Deworming' in Kenya)? */
  scheduleHas: (code: string) => boolean;
}

export interface RiskFlags {
  scd: boolean;
  hiv: boolean;
  previousCaesarean: boolean;
  caesareanBirth: boolean;
  vaginalBirth: boolean;
  twins: boolean;
  hypertension: boolean;
  diabetes: boolean;
  anaemia: boolean;
  depression: boolean;
  hepatitisB: boolean;
  lowMilk: boolean;
  previousPph: boolean;
  onCotrimoxazole: boolean;
  adolescent: boolean;
  /** Per child: preterm (<37 weeks) or low birth weight (<2.5 kg) */
  smallBaby: (c?: Child) => boolean;
}

export type { ClinicalEvent };
