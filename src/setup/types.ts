import type { Channel, CountryCode, LanguageCode } from '../types';
import type { AISettings } from '../ai';

/** Every answer can be 'not_sure'; the rules then assume the simpler, safer case. */
export type NotSure = 'not_sure';

export type SetupRole = 'midwife' | 'nurse' | 'chew' | 'chips_agent' | 'chp' | 'cho' | 'doctor' | 'supervisor' | 'other';
export type SetupDevice = 'android_phone' | 'work_phone' | 'basic_phone' | 'shared_basic_phone' | 'laptop' | 'tablet' | 'shared_computer' | 'iphone' | 'none';
export type ComputerOs = 'windows_old' | 'windows' | 'macos' | 'linux' | 'chromebook';
export type Internet = 'none' | 'patchy' | 'fourg' | 'wifi';
export type DataBudget = 'tiny' | 'small' | 'medium' | 'large';
export type Electricity = 'reliable' | 'some_hours' | 'rarely';
export type Printer = 'own' | 'facility' | 'lga_office' | 'none';
export type AiApp = 'none' | 'chatgpt' | 'gemini' | 'meta_ai' | 'claude' | 'deepseek' | 'other';
export type AiPay = 'me' | 'programme' | 'free_only';
export type Caseload = 'under_20' | '20_50' | '50_150' | 'over_150';
export type SetupBy = 'myself' | 'supervisor' | 'programme';
export type TechComfort = 1 | 2 | 3 | 4;

/** Codes Gaskin can show its own screens in. Anything else falls back to English for now. */
export type WorkerLanguage = LanguageCode | 'fr' | 'zh' | 'other';

export interface SetupAnswers {
  workerLanguage?: WorkerLanguage;
  role?: SetupRole | NotSure;
  country?: CountryCode | 'other' | NotSure;
  /** Free text when country is 'other', e.g. 'China' */
  countryOther?: string;
  region?: string;
  /** LGA, sub-county or district, typed by the worker */
  district?: string;
  /** Only with consent, from navigator.geolocation */
  geo?: { lat: number; lon: number; accuracyM?: number };
  mothersLanguages?: Array<LanguageCode | NotSure>;
  devices?: SetupDevice[];
  computerOs?: ComputerOs | NotSure;
  internet?: Internet | NotSure;
  dataBudget?: DataBudget | NotSure;
  electricity?: Electricity | NotSure;
  printer?: Printer | NotSure;
  aiApps?: AiApp[];
  aiPay?: AiPay | NotSure;
  caseload?: Caseload | NotSure;
  setupBy?: SetupBy | NotSure;
  techComfort?: TechComfort | NotSure;
}

/** Facts about this device, read at run time and passed to the rules so they stay pure and testable. */
export interface SetupEnvironment {
  /** The page is open inside the Claude app (artifact runtime present) */
  inClaude?: boolean;
  /** WebGPU available, so a small model can run in the browser */
  webgpu?: boolean;
  /** showDirectoryPicker available (Chrome, Edge, Opera on desktop) */
  folderAccess?: boolean;
  /** Opened from file:// (e.g. a USB stick) */
  fromFile?: boolean;
}

export type RunWhere = 'phone_app' | 'laptop_usb' | 'laptop_browser' | 'facility_hub';
export type StorageChoice = 'browser' | 'folder' | 'file';
export type SetupAIMode = 'none' | 'auto' | 'on_device' | 'own_key' | 'any_app' | 'connect_assistant' | 'claude_here';
export type AssistantTarget = 'claude_desktop' | 'claude_web' | 'chatgpt' | 'other';

export interface SetupPlan {
  version: 1;
  createdAt: string;
  country: CountryCode | 'other';
  countryName: string;
  region: string;
  district?: string;
  /** Location profile id to load (src/location), or null outside the launch countries */
  locationProfileId: string | null;

  run: { where: RunWhere; label: string; reason: string };
  storage: { mode: StorageChoice; label: string; reason: string; backupEveryDays: number; locationLabel?: string };
  languages: {
    /** Language Gaskin's own screens will use (English until a pack exists) */
    ui: LanguageCode | 'fr';
    worker: WorkerLanguage;
    mothers: LanguageCode[];
    /** Packs to install now, in order */
    install: Array<LanguageCode | 'fr'>;
    notes: string[];
  };
  ai: {
    mode: SetupAIMode;
    /** Exactly what is passed to configureAI. De-identification is always on. */
    settings: AISettings;
    label: string;
    reason: string;
    deidentify: true;
    /** For own_key: what to ask for on the summary screen. Left blank, the plan drops to copy-and-paste. */
    needsKey?: { kind: 'openai_compatible' | 'anthropic' | 'gemini'; baseUrl?: string; model: string; service: string; getKeyUrl?: string };
    assistant?: AssistantTarget;
    /** What to do if this does not work */
    fallback: SetupAIMode;
  };
  channels: Array<{ channel: Channel; primary: boolean; reason: string }>;
  printing: { where: Printer; routine: string };
  sync: { routine: string; method: 'device_only' | 'usb_copy' | 'facility_hub' | 'echis_alongside' };
  firstTenMinutes: string[];
  /** Short plain notes that do not fit elsewhere (power, data, safety) */
  notes: string[];
}
