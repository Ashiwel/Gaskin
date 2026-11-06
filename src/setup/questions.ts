/**
 * The onboarding questionnaire: one plain question per screen, big picture answers,
 * and always a "Not sure" choice. Questions branch on earlier answers through `showIf`.
 *
 * Text is plain English here; the wizard looks up `setup.q.<id>` and `setup.a.<id>.<value>`
 * in the worker's language when a pack has them, and falls back to this text.
 */
import type { CountryCode, LanguageCode } from '../types';
import { LOCATION_PROFILES } from '../location';
import { countryName, hasAreaData, listAreasSync, listCountries, listRegions, loadAreas, placeWords, searchCountries, searchRegions, findRegion, type Area, type Country, type Region } from '../geo/places';
import { NO_PACK_NOTE, PACK_STATE_LABELS, allLanguages, languagesFor, searchLanguages, type LanguageChoice } from '../geo/languages';
import { resolveCountryCode } from './recommend';
import type { SetupAnswers } from './types';

export type IconKey =
  | 'midwife' | 'nurse' | 'chw' | 'doctor' | 'supervisor' | 'person' | 'question'
  | 'flag' | 'map' | 'pin' | 'globe' | 'speech' | 'speech_many'
  | 'phone_smart' | 'phone_basic' | 'phone_shared' | 'laptop' | 'tablet' | 'computer_shared' | 'iphone' | 'none'
  | 'windows' | 'apple' | 'linux' | 'chromebook'
  | 'signal_none' | 'signal_low' | 'signal_mid' | 'wifi'
  | 'coins_1' | 'coins_2' | 'coins_3' | 'coins_4'
  | 'bulb_on' | 'bulb_half' | 'bulb_off'
  | 'printer' | 'building' | 'office'
  | 'spark' | 'chat' | 'wallet' | 'gift'
  | 'people_few' | 'people_some' | 'people_many' | 'people_crowd'
  | 'hand' | 'team' | 'star_1' | 'star_2' | 'star_3' | 'star_4' | 'check';

export interface QuestionOption {
  value: string | number;
  label: string;
  /** One short line under the label */
  hint?: string;
  icon: IconKey;
  /** Picking this clears the other choices in a multi-select ('none', 'not sure') */
  exclusive?: boolean;
}

export type QuestionKind = 'single' | 'multi' | 'choice_or_text' | 'location' | 'text' | 'country' | 'region' | 'area' | 'language' | 'languages';

export interface Question {
  id: keyof SetupAnswers | 'location';
  kind: QuestionKind;
  /** For the structured place and language questions: how the UI should draw and fill it (see PlaceQuestion) */
  place?: PlaceQuestion;
  /** The location question also asks for the local area (LGA, sub-county, district) under the region; answer goes to `district` */
  area?: Extract<PlaceQuestion, { kind: 'area' }>;
  title: string;
  /** One reassuring line: why we ask */
  help?: string;
  options: (a: SetupAnswers) => QuestionOption[];
  /** Hide this question unless the earlier answers make it relevant */
  showIf?: (a: SetupAnswers) => boolean;
  /** The worker may skip; the rules treat a skip like "Not sure" */
  skippable: boolean;
}

/**
 * Structured place and language questions. The UI builds a combobox (Country, Region, Area) or a
 * language picker from these: `pinned`/`top` are shown as big choices, `all`/`search` back the
 * searchable list behind "More…", and `freeText` says whether typing a name not in the list is allowed.
 */
export type PlaceQuestion =
  | { kind: 'country'; pinned: () => Country[]; all: () => Country[]; search: (q: string) => Country[]; freeText: false }
  | { kind: 'region'; label: (a: SetupAnswers) => string; all: (a: SetupAnswers) => Region[]; search: (a: SetupAnswers, q: string) => Region[]; freeText: true }
  | { kind: 'area'; label: (a: SetupAnswers) => string; hasList: (a: SetupAnswers) => boolean; load: (a: SetupAnswers) => Promise<Area[]>; now: (a: SetupAnswers) => Area[] | null; freeText: true }
  | {
      kind: 'language';
      /** 'worker': one language for Gaskin's screens; 'mothers': several, for mothers' messages; 'self': her own language (personal use) */
      audience: 'worker' | 'mothers' | 'self';
      multiple: boolean;
      /** Top suggestions for the place (the first few of languagesFor) */
      top: (a: SetupAnswers) => LanguageChoice[];
      /** The full list for "More languages": the place's first, then every language Gaskin can name */
      all: (a: SetupAnswers) => LanguageChoice[];
      search: (a: SetupAnswers, q: string) => LanguageChoice[];
      /** Only languages with screens (a pack with UI strings, or English) may be chosen */
      requirePack: boolean;
      /** Badge wording for each pack state ('none' → 'Coming soon') */
      labels: typeof PACK_STATE_LABELS;
      noPackNote: string;
    };

/** The ISO code the answers point at ('' when unknown) */
export const answerCountry = (a: SetupAnswers): string => resolveCountryCode(a);
/** The place to resolve languages for */
export const answerPlace = (a: SetupAnswers) => ({ country: answerCountry(a), region: a.regionCode ?? (a.region !== 'not_sure' ? a.region : undefined), area: a.district });

/** How many suggestions to show before "More languages" */
export const TOP_LANGUAGES = { worker: 4, mothers: 6, self: 4 } as const;

/** The patch to apply when a country is picked from the list (keeps the launch-country contract) */
export function countryAnswer(code: string): Pick<SetupAnswers, 'country' | 'countryCode' | 'countryOther'> {
  const c = code.toUpperCase();
  const launch = c === 'NG' || c === 'KE' || c === 'GH';
  return { countryCode: c, country: launch ? (c as CountryCode) : 'other', countryOther: launch ? undefined : countryName(c) };
}

/** The patch to apply when a region is picked (name for display and the engine, code for lookups) */
export function regionAnswer(country: string, regionCodeOrName: string): Pick<SetupAnswers, 'region' | 'regionCode' | 'district'> {
  const r = findRegion(country, regionCodeOrName);
  return r ? { region: r.name, regionCode: r.code, district: undefined } : { region: regionCodeOrName, regionCode: undefined, district: undefined };
}

const isWorkerScreens = (l: LanguageChoice) => l.tag === 'en' || (l.packCode !== undefined && l.pack !== 'none');

function languageQuestion(audience: 'worker' | 'mothers' | 'self'): PlaceQuestion {
  const requirePack = audience !== 'mothers';
  return {
    kind: 'language',
    audience,
    multiple: audience === 'mothers',
    requirePack,
    labels: PACK_STATE_LABELS,
    noPackNote: NO_PACK_NOTE,
    top: (a) => {
      const all = languagesFor(answerPlace(a));
      const list = requirePack ? all.filter(isWorkerScreens) : all;
      const top = list.slice(0, TOP_LANGUAGES[audience]);
      // English is always offered
      return top.some((l) => l.tag === 'en') ? top : [...top.slice(0, TOP_LANGUAGES[audience] - 1), ...all.filter((l) => l.tag === 'en')];
    },
    all: (a) => {
      const all = allLanguages(answerPlace(a));
      return requirePack ? all.filter(isWorkerScreens) : all;
    },
    search: (a, q) => {
      const found = searchLanguages(q, answerPlace(a), 80);
      return requirePack ? found.filter(isWorkerScreens) : found;
    },
  };
}

export const NOT_SURE: QuestionOption = { value: 'not_sure', label: 'Not sure', icon: 'question', exclusive: true };

/** Languages the worker can choose for Gaskin's own screens. Order: launch countries first. */
export const WORKER_LANGUAGE_OPTIONS: QuestionOption[] = [
  { value: 'en', label: 'English', icon: 'speech' },
  { value: 'pcm', label: 'Naijá (Pidgin)', icon: 'speech' },
  { value: 'ha', label: 'Hausa', icon: 'speech' },
  { value: 'yo', label: 'Yorùbá', icon: 'speech' },
  { value: 'ig', label: 'Igbo', icon: 'speech' },
  { value: 'sw', label: 'Kiswahili', icon: 'speech' },
  { value: 'tw', label: 'Twi', icon: 'speech' },
  { value: 'fr', label: 'Français', icon: 'speech' },
  { value: 'zh', label: '中文 (Chinese)', icon: 'speech' },
  { value: 'other', label: 'Another language', hint: 'Gaskin will use English for now', icon: 'globe' },
];

/** Language names for the mothers' languages question */
export const MOTHER_LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English', pcm: 'Pidgin', ha: 'Hausa', yo: 'Yorùbá', ig: 'Igbo', sw: 'Kiswahili', tw: 'Twi',
  bin: 'Edo (Bini)', urh: 'Urhobo', ar: 'Shuwa Arabic', dag: 'Dagbani', luo: 'Dholuo', ee: 'Ewe', ff: 'Fulfulde',
};

const COUNTRY_LANGS: Record<CountryCode, LanguageCode[]> = {
  NG: ['en', 'pcm', 'ha', 'yo', 'ig', 'ff', 'bin', 'urh', 'ar'],
  KE: ['sw', 'en', 'luo'],
  GH: ['en', 'tw', 'dag', 'ee', 'ha'],
};

const ROLE_OPTIONS: Record<CountryCode | 'any', QuestionOption[]> = {
  NG: [
    { value: 'midwife', label: 'Midwife', icon: 'midwife' },
    { value: 'nurse', label: 'Nurse', icon: 'nurse' },
    { value: 'chew', label: 'CHEW or JCHEW', hint: 'Community Health Extension Worker', icon: 'chw' },
    { value: 'chips_agent', label: 'CHIPS agent', icon: 'chw' },
    { value: 'doctor', label: 'Doctor', icon: 'doctor' },
    { value: 'supervisor', label: 'Supervisor or programme officer', icon: 'supervisor' },
  ],
  KE: [
    { value: 'chp', label: 'Community Health Promoter (CHP)', icon: 'chw' },
    { value: 'nurse', label: 'Nurse or nurse-midwife', icon: 'nurse' },
    { value: 'midwife', label: 'Midwife', icon: 'midwife' },
    { value: 'doctor', label: 'Clinical officer or doctor', icon: 'doctor' },
    { value: 'supervisor', label: 'CHA or supervisor', icon: 'supervisor' },
  ],
  GH: [
    { value: 'cho', label: 'Community Health Officer (CHO)', icon: 'chw' },
    { value: 'midwife', label: 'Midwife', icon: 'midwife' },
    { value: 'nurse', label: 'Community health nurse', icon: 'nurse' },
    { value: 'doctor', label: 'Doctor or physician assistant', icon: 'doctor' },
    { value: 'supervisor', label: 'Supervisor or programme officer', icon: 'supervisor' },
  ],
  any: [
    { value: 'midwife', label: 'Midwife', icon: 'midwife' },
    { value: 'nurse', label: 'Nurse', icon: 'nurse' },
    { value: 'chew', label: 'Community health worker', icon: 'chw' },
    { value: 'doctor', label: 'Doctor', icon: 'doctor' },
    { value: 'supervisor', label: 'Supervisor or programme officer', icon: 'supervisor' },
  ],
};

const isLaunchCountry = (c: SetupAnswers['country']): c is CountryCode => c === 'NG' || c === 'KE' || c === 'GH';
const hasComputer = (a: SetupAnswers) => (a.devices ?? []).some((d) => d === 'laptop' || d === 'shared_computer');
const usesAnyAi = (a: SetupAnswers) => (a.aiApps ?? []).some((x) => x !== 'none');

/** First question: who will use Gaskin */
export const AUDIENCE_OPTIONS: QuestionOption[] = [
  { value: 'health_worker', label: 'A health worker', hint: 'Midwife, nurse, CHEW, CHIPS agent, CHP, CHO or doctor', icon: 'midwife' },
  { value: 'supervisor', label: 'A supervisor or programme officer', hint: 'You look after health workers or the numbers for an area', icon: 'supervisor' },
  { value: 'personal', label: 'Myself or my family', hint: 'You are pregnant, or caring for a baby or young child', icon: 'person' },
];

/** First question for everyone: who will use Gaskin. Its answer picks the flow (see visibleQuestions). */
export const AUDIENCE_QUESTION: Question = {
  id: 'audience',
  kind: 'single',
  title: 'Who will use Gaskin?',
  help: 'Gaskin sets itself up around the answer.',
  options: () => AUDIENCE_OPTIONS,
  skippable: false,
};

/** Local area (LGA, sub-county, district, municipality): a list where Gaskin has one, free text elsewhere */
export const AREA_QUESTION: Extract<PlaceQuestion, { kind: 'area' }> = {
  kind: 'area',
  label: (a) => placeWords(answerCountry(a)).area,
  hasList: (a) => hasAreaData(answerCountry(a)),
  load: (a) => loadAreas(answerCountry(a), a.regionCode ?? a.region),
  now: (a) => listAreasSync(answerCountry(a), a.regionCode ?? a.region),
  freeText: true,
};

/** The health worker and supervisor flow (supervisors skip the role question) */
export const QUESTIONS: Question[] = [
  {
    id: 'country',
    kind: 'country',
    title: 'Which country are you in?',
    help: 'This sets the languages, the emergency number and the health advice for your area.',
    // Plain options for simple renderers: the three launch countries, then "Another country" (search)
    options: () => [
      ...listCountries().slice(0, 3).map((c) => ({ value: c.code, label: c.name, icon: 'flag' as const })),
      { value: 'other', label: 'Another country', hint: 'Search all countries', icon: 'globe' },
      NOT_SURE,
    ],
    place: { kind: 'country', pinned: () => listCountries().slice(0, 3), all: listCountries, search: (q) => searchCountries(q, 250), freeText: false },
    skippable: false,
  },
  {
    id: 'location',
    kind: 'region',
    title: 'Where do you work?',
    help: 'This lets Gaskin suggest local foods, nearby hospitals, the right malaria advice and the languages people speak.',
    options: (a) => {
      const regions = listRegions(answerCountry(a));
      if (regions.length) return [...regions.map((r) => ({ value: r.name, label: r.name, icon: 'map' as const })), NOT_SURE];

      return isLaunchCountry(a.country)
        ? [...LOCATION_PROFILES.filter((p) => p.country === a.country).map((p) => ({ value: p.region, label: p.region, icon: 'map' as const })), NOT_SURE]
        : [NOT_SURE];
    },
    place: { kind: 'region', label: (a) => placeWords(answerCountry(a)).region, all: (a) => listRegions(answerCountry(a)), search: (a, q) => searchRegions(answerCountry(a), q), freeText: true },
    area: AREA_QUESTION,
    skippable: true,
  },
  {
    id: 'workerLanguage',
    kind: 'language',
    title: 'Which language do you want Gaskin in?',
    help: 'Suggested for where you are. You can change it any time.',
    // Plain options for simple renderers: the place's languages that have screens, then "More languages".
    // Before a country is chosen, the fixed list. Never another country's languages as suggestions.
    options: (a) => {
      if (!answerCountry(a)) return WORKER_LANGUAGE_OPTIONS;
      const top = (languageQuestion('worker') as Extract<PlaceQuestion, { kind: 'language' }>).top(a);
      return [
        ...top.map((l) => ({ value: l.code, label: l.nativeName, hint: l.nativeName !== l.name ? l.name : undefined, icon: 'speech' as const })),
        { value: 'other', label: 'More languages', hint: 'Search every language Gaskin has screens in', icon: 'globe' as const },
      ];
    },
    place: languageQuestion('worker'),
    skippable: false,
  },
  {
    id: 'role',
    kind: 'single',
    title: 'What is your work?',
    showIf: (a) => a.audience !== 'supervisor',
    options: (a) => [...ROLE_OPTIONS[isLaunchCountry(a.country) ? a.country : 'any'], { value: 'other', label: 'Something else', icon: 'person' }, NOT_SURE],
    skippable: true,
  },
  {
    id: 'mothersLanguages',
    kind: 'languages',
    title: 'Which languages do the mothers you see speak?',
    help: 'Pick all that apply. Gaskin will get messages ready in these. Languages marked Coming soon use plain English for now.',
    options: (a) => {
      const top = (languageQuestion('mothers') as Extract<PlaceQuestion, { kind: 'language' }>).top(a);
      if (top.length) return [...top.map((l) => ({ value: l.code, label: l.nativeName, hint: l.pack === 'none' ? `${l.name !== l.nativeName ? `${l.name}. ` : ''}${PACK_STATE_LABELS.none}` : l.nativeName !== l.name ? l.name : undefined, icon: 'speech_many' as const })), NOT_SURE];
      const langs = isLaunchCountry(a.country) ? COUNTRY_LANGS[a.country] : (['en'] as LanguageCode[]);
      return [...langs.map((l) => ({ value: l, label: MOTHER_LANGUAGE_LABELS[l], icon: 'speech_many' as const })), NOT_SURE];
    },
    place: languageQuestion('mothers'),
    skippable: true,
  },
  {
    id: 'devices',
    kind: 'multi',
    title: 'What can you use for work?',
    help: 'Pick everything you can use, even if it is shared.',
    options: () => [
      { value: 'android_phone', label: 'My own smartphone (Android)', icon: 'phone_smart' },
      { value: 'work_phone', label: 'A work phone from the programme', hint: 'For example eCHIS or a CHPS tablet', icon: 'phone_smart' },
      { value: 'iphone', label: 'iPhone', icon: 'iphone' },
      { value: 'basic_phone', label: 'A basic phone (buttons, no apps)', icon: 'phone_basic' },
      { value: 'shared_basic_phone', label: 'A phone I share with others', icon: 'phone_shared' },
      { value: 'laptop', label: 'A laptop or desktop', icon: 'laptop' },
      { value: 'tablet', label: 'A tablet', icon: 'tablet' },
      { value: 'shared_computer', label: 'A computer at the facility or office', icon: 'computer_shared' },
      { value: 'none', label: 'None of these', icon: 'none', exclusive: true },
    ],
    skippable: false,
  },
  {
    id: 'computerOs',
    kind: 'single',
    title: 'What kind of computer is it?',
    help: 'Look at the start screen. If unsure, choose "Not sure".',
    showIf: hasComputer,
    options: () => [
      { value: 'windows_old', label: 'Old Windows (7 or 8)', icon: 'windows' },
      { value: 'windows', label: 'Windows 10 or 11', icon: 'windows' },
      { value: 'macos', label: 'Mac', icon: 'apple' },
      { value: 'linux', label: 'Linux', icon: 'linux' },
      { value: 'chromebook', label: 'Chromebook', icon: 'chromebook' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'internet',
    kind: 'single',
    title: 'How is the internet where you work?',
    options: () => [
      { value: 'none', label: 'No internet', icon: 'signal_none' },
      { value: 'patchy', label: 'Comes and goes (2G or 3G)', icon: 'signal_low' },
      { value: 'fourg', label: 'Good mobile data (4G)', icon: 'signal_mid' },
      { value: 'wifi', label: 'Wi-Fi or fast internet', icon: 'wifi' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'dataBudget',
    kind: 'single',
    title: 'How much data do you buy each month?',
    showIf: (a) => a.internet !== 'none',
    options: () => [
      { value: 'tiny', label: 'Very little, or none', hint: 'Under 500 MB', icon: 'coins_1' },
      { value: 'small', label: 'A small bundle', hint: 'About 1 to 2 GB', icon: 'coins_2' },
      { value: 'medium', label: 'A medium bundle', hint: 'About 3 to 10 GB', icon: 'coins_3' },
      { value: 'large', label: 'Plenty, or unlimited', icon: 'coins_4' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'electricity',
    kind: 'single',
    title: 'How often do you have electricity to charge?',
    options: () => [
      { value: 'reliable', label: 'Most of the day', icon: 'bulb_on' },
      { value: 'some_hours', label: 'Some hours, or from a generator or solar', icon: 'bulb_half' },
      { value: 'rarely', label: 'Rarely', icon: 'bulb_off' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'printer',
    kind: 'single',
    title: 'Can you print?',
    help: 'Printed picture cards help mothers who do not read or have no phone.',
    options: () => [
      { value: 'own', label: 'Yes, I have a printer', icon: 'printer' },
      { value: 'facility', label: 'At my facility', icon: 'building' },
      { value: 'lga_office', label: 'At the LGA, district or county office', icon: 'office' },
      { value: 'none', label: 'No', icon: 'none' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'aiApps',
    kind: 'multi',
    title: 'Have you used any AI apps?',
    help: 'Gaskin works without AI. AI can help write messages in more languages.',
    options: () => [
      { value: 'none', label: 'No, never', icon: 'none', exclusive: true },
      { value: 'meta_ai', label: 'Meta AI in WhatsApp', icon: 'chat' },
      { value: 'chatgpt', label: 'ChatGPT', icon: 'spark' },
      { value: 'gemini', label: 'Gemini', icon: 'spark' },
      { value: 'claude', label: 'Claude', icon: 'spark' },
      { value: 'deepseek', label: 'DeepSeek, Qwen or Doubao', icon: 'spark' },
      { value: 'other', label: 'Another AI app', icon: 'spark' },
    ],
    skippable: true,
  },
  {
    id: 'aiPay',
    kind: 'single',
    title: 'Can you or your programme pay for AI?',
    showIf: usesAnyAi,
    options: () => [
      { value: 'free_only', label: 'No, free only', icon: 'gift' },
      { value: 'me', label: 'I pay for an AI plan', icon: 'wallet' },
      { value: 'programme', label: 'My programme pays', icon: 'building' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'caseload',
    kind: 'single',
    title: 'How many mothers and babies do you look after?',
    options: () => [
      { value: 'under_20', label: 'Fewer than 20', icon: 'people_few' },
      { value: '20_50', label: '20 to 50', icon: 'people_some' },
      { value: '50_150', label: '50 to 150', icon: 'people_many' },
      { value: 'over_150', label: 'More than 150', icon: 'people_crowd' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'setupBy',
    kind: 'single',
    title: 'Who asked you to use Gaskin?',
    options: () => [
      { value: 'myself', label: 'I found it myself', icon: 'hand' },
      { value: 'supervisor', label: 'My supervisor', icon: 'supervisor' },
      { value: 'programme', label: 'A state, county or national programme', icon: 'team' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'techComfort',
    kind: 'single',
    title: 'How easy do you find phones and computers?',
    options: () => [
      { value: 1, label: 'Hard. I need help.', icon: 'star_1' },
      { value: 2, label: 'I can call and send messages.', icon: 'star_2' },
      { value: 3, label: 'I use WhatsApp and apps every day.', icon: 'star_3' },
      { value: 4, label: 'Easy. I set up apps for others.', icon: 'star_4' },
      NOT_SURE,
    ],
    skippable: true,
  },
];

/** Personal use (a woman, mother or family member using Gaskin for herself): only what she needs */
export const PERSONAL_QUESTIONS: Question[] = [
  QUESTIONS.find((q) => q.id === 'country')!,
  { ...QUESTIONS.find((q) => q.id === 'location')!, title: 'Where do you live?' },
  {
    id: 'languageTag',
    kind: 'language',
    title: 'Which language do you read best?',
    help: 'Languages marked Coming soon show in English for now.',
    options: (a) => (languageQuestion('self') as Extract<PlaceQuestion, { kind: 'language' }>).top(a).map((l) => ({ value: l.code, label: l.nativeName, hint: l.nativeName !== l.name ? l.name : undefined, icon: 'speech' as const })),
    place: languageQuestion('self'),
    skippable: false,
  },
  {
    id: 'personalStage',
    kind: 'multi',
    title: 'What is happening for you now?',
    help: 'Pick all that apply.',
    options: () => [
      { value: 'pregnant', label: 'I am pregnant', icon: 'person' },
      { value: 'child_under_2', label: 'I have a baby or child under 2', icon: 'people_few' },
      { value: 'planning', label: 'I am planning a pregnancy', icon: 'hand' },
      { value: 'other', label: 'I care for someone else', hint: 'A daughter, sister, wife or friend', icon: 'team', exclusive: true },
    ],
    skippable: true,
  },
  {
    id: 'clinicRegistered',
    kind: 'single',
    title: 'Are you registered at a clinic or health centre?',
    help: 'Gaskin works best alongside a midwife or nurse who knows you.',
    options: () => [
      { value: 'yes', label: 'Yes', hint: 'I go for check-ups', icon: 'building' },
      { value: 'no', label: 'Not yet', icon: 'none' },
      NOT_SURE,
    ],
    skippable: true,
  },
  {
    id: 'phone',
    kind: 'single',
    title: 'What phone will you use?',
    options: () => [
      { value: 'smartphone', label: 'My own smartphone', icon: 'phone_smart' },
      { value: 'basic_phone', label: 'A basic phone (buttons, no apps)', icon: 'phone_basic' },
      { value: 'shared_phone', label: 'A phone I share', icon: 'phone_shared' },
      NOT_SURE,
    ],
    skippable: true,
  },
  QUESTIONS.find((q) => q.id === 'internet')!,
];

/** The questions to show for the current answers, in order */
export function visibleQuestions(a: SetupAnswers): Question[] {
  const flow = a.audience === 'personal' ? PERSONAL_QUESTIONS : QUESTIONS;
  return [AUDIENCE_QUESTION, ...flow].filter((q) => !q.showIf || q.showIf(a));
}
