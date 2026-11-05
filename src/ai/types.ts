import type { CarePlan, Channel, ExtractedFinding, LanguageCode, Mother, PlanItem } from '../types';

export interface PersonaliseArgs {
  plan: CarePlan;
  mother: Mother;
  channel: Channel;
  language: LanguageCode;
  itemIds: string[];
  maxChars?: number;
  signal?: AbortSignal;
  onText?: (t: string) => void;
  /**
   * Optional additions to CONTRACTS.md (all optional, so callers coded to the
   * contract still work): used for the sign-off and the emergency line.
   */
  facilityName?: string;
  workerName?: string;
  emergencyLine?: string;
}

export interface TranslateArgs {
  texts: Record<string, string>;
  language: LanguageCode;
  signal?: AbortSignal;
  /** Optional (extension): lets the privacy layer scrub her identifiers from the texts */
  mother?: Mother;
  plan?: CarePlan;
  channel?: Channel;
}

export interface ExtractArgs {
  text: string;
  signal?: AbortSignal;
  /** Optional (extension): lets the privacy layer scrub her identifiers and convert dates relative to the plan */
  mother?: Mother;
  plan?: CarePlan;
}

export interface ExplainArgs {
  plan: CarePlan;
  mother: Mother;
  signal?: AbortSignal;
  onText?: (t: string) => void;
}

export interface SuggestArgs {
  plan: CarePlan;
  mother: Mother;
  signal?: AbortSignal;
}

export type SuggestedItem = Pick<PlanItem, 'title' | 'detail' | 'motherText' | 'category'>;

export type AIProvider = {
  id: string;
  label: string;
  live: boolean;
  personaliseMessage(a: PersonaliseArgs): Promise<string>;
  translate(a: TranslateArgs): Promise<Record<string, string>>;
  extractFindings(a: ExtractArgs): Promise<ExtractedFinding[]>;
  explainPlan(a: ExplainArgs): Promise<string>;
  suggestItems(a: SuggestArgs): Promise<SuggestedItem[]>;
};

export interface AIStatus {
  /** Provider answering: 'claude-sample' | 'openai-compatible' | 'anthropic' | 'gemini' | 'on-device-server' | 'on-device-browser' | 'any-app' | 'template' | 'none' (AI switched off) */
  provider: string;
  /** Human label for the UI badge */
  label: string;
  /** True when a live model is answering */
  live: boolean;
  /** Settings mode in force: auto, none, claude_here, own_key, on_device, any_app */
  mode?: string;
  /** Last live failure, in plain English, when the template answered instead */
  lastError?: string;
  /** Which operation fell back */
  lastFallbackOp?: string;
  at?: string;
}

export const EXTRACTION_FIELDS = [
  'systolic',
  'diastolic',
  'haemoglobin',
  'temperature',
  'weight',
  'gestational_weeks',
  'urine_protein',
  'diagnosis',
  'medication',
  'plan',
  'follow_up',
] as const;

export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];
