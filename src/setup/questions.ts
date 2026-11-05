/**
 * The onboarding questionnaire: one plain question per screen, big picture answers,
 * and always a "Not sure" choice. Questions branch on earlier answers through `showIf`.
 *
 * Text is plain English here; the wizard looks up `setup.q.<id>` and `setup.a.<id>.<value>`
 * in the worker's language when a pack has them, and falls back to this text.
 */
import type { CountryCode, LanguageCode } from '../types';
import { LOCATION_PROFILES } from '../location';
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

export type QuestionKind = 'single' | 'multi' | 'choice_or_text' | 'location' | 'text';

export interface Question {
  id: keyof SetupAnswers | 'location';
  kind: QuestionKind;
  title: string;
  /** One reassuring line: why we ask */
  help?: string;
  options: (a: SetupAnswers) => QuestionOption[];
  /** Hide this question unless the earlier answers make it relevant */
  showIf?: (a: SetupAnswers) => boolean;
  /** The worker may skip; the rules treat a skip like "Not sure" */
  skippable: boolean;
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

export const QUESTIONS: Question[] = [
  {
    id: 'workerLanguage',
    kind: 'single',
    title: 'Which language do you want Gaskin in?',
    help: 'You can change this later.',
    options: () => WORKER_LANGUAGE_OPTIONS,
    skippable: false,
  },
  {
    id: 'country',
    kind: 'choice_or_text',
    title: 'Which country do you work in?',
    options: () => [
      { value: 'NG', label: 'Nigeria', icon: 'flag' },
      { value: 'KE', label: 'Kenya', icon: 'flag' },
      { value: 'GH', label: 'Ghana', icon: 'flag' },
      { value: 'other', label: 'Another country', hint: 'Type its name', icon: 'globe' },
      NOT_SURE,
    ],
    skippable: false,
  },
  {
    id: 'location',
    kind: 'location',
    title: 'Where do you work?',
    help: 'This lets Gaskin suggest local foods, nearby hospitals and the right malaria advice.',
    options: (a) =>
      isLaunchCountry(a.country)
        ? [
            ...LOCATION_PROFILES.filter((p) => p.country === a.country).map((p) => ({ value: p.region, label: p.region, icon: 'map' as const })),
            { value: '__other', label: 'Somewhere else', hint: 'Type the name', icon: 'pin' as const },
            NOT_SURE,
          ]
        : [NOT_SURE],
    skippable: true,
  },
  {
    id: 'role',
    kind: 'single',
    title: 'What is your work?',
    options: (a) => [...ROLE_OPTIONS[isLaunchCountry(a.country) ? a.country : 'any'], { value: 'other', label: 'Something else', icon: 'person' }, NOT_SURE],
    skippable: true,
  },
  {
    id: 'mothersLanguages',
    kind: 'multi',
    title: 'Which languages do the mothers you see speak?',
    help: 'Pick all that apply. Gaskin will get messages ready in these.',
    options: (a) => {
      const langs = isLaunchCountry(a.country) ? COUNTRY_LANGS[a.country] : (['en', 'pcm', 'ha', 'yo', 'ig', 'sw', 'tw'] as LanguageCode[]);
      return [...langs.map((l) => ({ value: l, label: MOTHER_LANGUAGE_LABELS[l], icon: 'speech_many' as const })), NOT_SURE];
    },
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

/** The questions to show for the current answers, in order */
export function visibleQuestions(a: SetupAnswers): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(a));
}
