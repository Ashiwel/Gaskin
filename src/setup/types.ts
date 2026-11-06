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

/** Who will use Gaskin (first onboarding question) */
export type SetupAudience = 'health_worker' | 'supervisor' | 'personal';

/** What the setup is for: a worker's caseload, a supervisor's area, or a person's own care */
export type SetupMode = 'worker' | 'supervisor' | 'personal';

/** Personal use: where she is in her journey (several can be true) */
export type PersonalStage = 'pregnant' | 'child_under_2' | 'planning' | 'other';

export interface SetupAnswers {
  /** Who will use Gaskin. Missing means a health worker (older saved setups). */
  audience?: SetupAudience;
  workerLanguage?: WorkerLanguage;
  role?: SetupRole | NotSure;
  country?: CountryCode | 'other' | NotSure;
  /**
   * ISO 3166-1 alpha-2 for any country (src/geo listCountries). Set together with `country`, which stays
   * 'NG' | 'KE' | 'GH' for the launch countries and 'other' elsewhere.
   */
  countryCode?: string;
  /** Free text when country is 'other', e.g. 'China' (the country's name when chosen from the list) */
  countryOther?: string;
  /** Region name as listed by src/geo listRegions (e.g. 'Lagos', 'KwaZulu-Natal'), or typed */
  region?: string;
  /** ISO 3166-2 code of the region, when chosen from the list (e.g. 'NG-LA', 'ZA-KZN') */
  regionCode?: string;
  /** LGA, sub-county, district or municipality: chosen from src/geo loadAreas, or typed where there is no list */
  district?: string;
  /** Only with consent, from navigator.geolocation */
  geo?: { lat: number; lon: number; accuracyM?: number };
  /**
   * Mothers' languages. Pack codes (LanguageCode) as before, or any BCP-47 tag from src/geo languagesFor
   * (e.g. 'tiv', 'nso'), so a language with no pack can still be recorded.
   */
  mothersLanguages?: Array<LanguageCode | NotSure | (string & {})>;
  /** BCP-47 tag of the worker's (or, in personal use, her own) language when it has no pack; the screens use English */
  languageTag?: string;
  /** Personal use */
  personalStage?: PersonalStage[];
  /** Personal use: registered for antenatal or child care at a clinic */
  clinicRegistered?: 'yes' | 'no' | NotSure;
  /** Personal use: phone she will use */
  phone?: 'smartphone' | 'basic_phone' | 'shared_phone' | NotSure;
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
  /** worker: a caseload; supervisor: an area's workers and numbers; personal: her own care (no caseload) */
  mode: SetupMode;
  country: CountryCode | 'other';
  /** ISO 3166-1 alpha-2 for any country ('' when unknown) */
  countryCode: string;
  countryName: string;
  region: string;
  /** ISO 3166-2 code, when the region matched the bundled list */
  regionCode?: string;
  district?: string;
  /** Location profile id to load (src/location), or null outside the launch countries */
  locationProfileId: string | null;

  run: { where: RunWhere; label: string; reason: string };
  storage: { mode: StorageChoice; label: string; reason: string; backupEveryDays: number; locationLabel?: string };
  languages: {
    /** Language Gaskin's own screens will use (English until a pack exists) */
    ui: LanguageCode | 'fr';
    worker: WorkerLanguage;
    /** Pack codes for the mothers' languages that have a pack (as before) */
    mothers: LanguageCode[];
    /** Every mothers' language as a BCP-47 tag, with its pack (if any). Pack 'none' shows "Coming soon". */
    motherLanguages?: Array<{ tag: string; name: string; nativeName: string; packCode?: string; pack: 'reviewed' | 'draft' | 'partial' | 'none' }>;
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
  /** Personal use only: nudges to register at a clinic and see a health worker, with the nearest facilities */
  personal?: {
    stage: PersonalStage[];
    clinicRegistered: 'yes' | 'no' | 'not_sure';
    nudges: string[];
    /** From the location profile; empty outside curated areas (the UI then says to ask locally) */
    nearestFacilities: Array<{ name: string; town: string; distanceKm: number | null }>;
  };
}
