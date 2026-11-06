/**
 * Personal use: the record of the woman using Gaskin for herself, made when she creates her
 * profile, from what she said at onboarding (country, area, language, stage). Without it, "My day"
 * would show the first mother on the device. She adds dates later ("Getting started" on My day).
 */
import type { CountryCode, LanguageCode, Mother } from '../../types';
import { isPackCode } from '../../i18n';

const ENGINE_COUNTRIES: CountryCode[] = ['NG', 'KE', 'GH'];

export interface PersonalAnswers {
  countryCode?: string;
  country?: string;
  region?: string;
  district?: string;
  workerLanguage?: string;
  languageTag?: string;
  personalStage?: string[];
  clinicRegistered?: string;
}

/** Her own record, or null where the rules engine has no country rules yet (then nothing is made). */
export function personalMother(id: string, name: string, a: PersonalAnswers, clock: string): Mother | null {
  const country = (a.countryCode ?? a.country) as CountryCode;
  if (!ENGINE_COUNTRIES.includes(country)) return null;
  const lang = a.workerLanguage && isPackCode(a.workerLanguage) ? (a.workerLanguage as LanguageCode) : 'en';
  const now = clock;
  return {
    id,
    name: name.trim(),
    // Onboarding does not ask her age; her consent says she is 18 or older (or helped by a guardian).
    age: 18,
    country,
    region: a.region ?? '',
    community: a.district ?? a.region ?? '',
    area: a.district,
    language: lang,
    ...(a.languageTag ? { languageTag: a.languageTag } : {}),
    literacy: 'good',
    phone: { access: 'smartphone', hasWhatsApp: false },
    incomeBand: 'low',
    gravida: a.personalStage?.includes('pregnant') ? 1 : 0,
    parity: 0,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [],
    allergies: [],
    genotype: 'unknown',
    medications: [],
    children: [],
    practicesMentioned: [],
    assignedWorkerId: id,
    facilityId: 'self',
    enrolledAt: now,
    consent: { dataProcessing: true, messaging: false, recordedAt: now, recordedBy: id },
    events: [],
    ...(a.clinicRegistered === 'yes' ? { selfCare: { registeredWithClinicAt: now.slice(0, 10) } } : {}),
  };
}
