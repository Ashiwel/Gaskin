/**
 * Malaria by country, for places with no curated location profile.
 *
 * Source: WHO World Malaria Report 2024 (data for 2023), Annex: countries and areas with indigenous
 * malaria cases, and WHO certifications of elimination to 2025 (e.g. Cabo Verde 2024, Egypt 2024,
 * Georgia 2025, Suriname 2025, Timor-Leste 2025). IPTp follows the WHO Guidelines for malaria
 * (2025 update): IPTp-SP for pregnant women in areas of moderate to high transmission in Africa.
 *
 * Country level is coarse: transmission inside a country varies a lot (South Africa has malaria only
 * in parts of Limpopo, Mpumalanga and KwaZulu-Natal). Treat these as defaults to check against
 * national guidelines; a curated location profile always wins.
 */
import type { Citation } from '../types';

export const MALARIA_SOURCES: Citation[] = [
  { id: 'who-wmr-2024', label: 'WHO World Malaria Report 2024: countries with indigenous malaria cases in 2023', url: 'https://www.who.int/teams/global-malaria-programme/reports/world-malaria-report-2024' },
  { id: 'who-malaria-guidelines', label: 'WHO Guidelines for malaria: IPTp-SP in areas of moderate to high transmission in Africa', url: 'https://www.who.int/publications/i/item/guidelines-for-malaria' },
];

/**
 * African countries with moderate to high transmission where IPTp-SP is national policy
 * (WHO WMR 2024, IPTp coverage tables). Kenya gives IPTp only in endemic zones; its curated rules apply.
 */
export const IPTP_COUNTRIES = new Set([
  'AO', 'BJ', 'BF', 'BI', 'CM', 'CF', 'TD', 'KM', 'CG', 'CI', 'CD', 'GQ', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LR', 'MG', 'MW', 'ML', 'MR',
  'MZ', 'NE', 'NG', 'ST', 'SN', 'SL', 'SO', 'SS', 'SD', 'TZ', 'TG', 'UG', 'ZM', 'ZW',
]);

/** Other countries with indigenous malaria (WHO WMR 2024), usually low or focal transmission; no IPTp policy */
export const OTHER_ENDEMIC = new Set([
  // Africa (low or focal)
  'BW', 'ER', 'ET', 'NA', 'RW', 'ZA', 'SZ', 'DJ',
  // Eastern Mediterranean
  'AF', 'IR', 'PK', 'SA', 'YE',
  // South-East Asia
  'BD', 'IN', 'ID', 'MM', 'NP', 'TH', 'KP',
  // Western Pacific
  'KH', 'LA', 'PG', 'PH', 'SB', 'VU', 'VN', 'KR',
  // Americas
  'BO', 'BR', 'CO', 'CR', 'DO', 'EC', 'GT', 'GY', 'HT', 'HN', 'MX', 'NI', 'PA', 'PE', 'VE', 'GF',
]);

/** Where malaria occurs inside low-transmission countries, for the note shown to the worker */
const FOCAL_NOTE: Record<string, string> = {
  ZA: 'Malaria occurs only in parts of Limpopo, Mpumalanga and northern KwaZulu-Natal, mostly September to May.',
  BW: 'Malaria occurs mainly in the north (Okavango, Chobe), in the rainy season.',
  NA: 'Malaria occurs mainly in the north (Kavango, Zambezi, Kunene, Ohangwena), in the rainy season.',
  SZ: 'Malaria occurs at low levels in the lowveld (east), in the rainy season.',
  ET: 'Malaria is seasonal and unstable, mainly below 2,000 m; highland cities such as Addis Ababa have little.',
  ER: 'Malaria is seasonal and mainly in the western lowlands.',
  RW: 'Malaria is common in the east and south; Rwanda stopped IPTp in 2008 in favour of nets and prompt testing.',
};

export interface MalariaDefault {
  /** Feeds IPTp eligibility (PlanContext.location.malariaEndemic) */
  iptp: boolean;
  /** Any indigenous transmission in the country */
  endemic: boolean;
  risk: 'high' | 'moderate' | 'seasonal' | 'low';
  note: string;
}

export function malariaDefault(country: string | undefined): MalariaDefault {
  const c = (country ?? '').toUpperCase();
  if (IPTP_COUNTRIES.has(c)) {
    return { iptp: true, endemic: true, risk: 'moderate', note: 'Malaria is common here (WHO World Malaria Report 2024), so plans include IPTp from 13 weeks, a treated net, and testing any fever. Check your national guideline.' };
  }
  if (OTHER_ENDEMIC.has(c)) {
    return {
      iptp: false,
      endemic: true,
      risk: 'low',
      note: `${FOCAL_NOTE[c] ?? 'Malaria occurs in parts of the country.'} WHO does not advise IPTp at this level of transmission, so plans do not include it. Test any fever, and use a treated net in malaria areas.`,
    };
  }
  return { iptp: false, endemic: false, risk: 'low', note: 'No local malaria transmission reported to WHO. Ask about recent travel if she has a fever.' };
}
