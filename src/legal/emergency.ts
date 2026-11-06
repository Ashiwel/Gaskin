export type EmergencyCountry = 'NG' | 'KE' | 'GH' | 'ZA';

export interface EmergencyNumbers {
  country: EmergencyCountry;
  countryName: string;
  /** The number to tell her first */
  primary: string;
  numbers: Array<{ number: string; label: string; note?: string }>;
  /** Verified maternal or health helplines; empty when none could be verified */
  helplines: Array<{ number: string; label: string; note?: string }>;
  sources: Array<{ label: string; url: string }>;
  checkedAt: string;
  caveat?: string;
}

/**
 * Checked 5 Nov 2026.
 * - Nigeria: 112 is the toll-free national emergency number (NCC); it reaches police, fire, road safety
 *   and other first responders, and at launch was live in some states only.
 * - Kenya: 999 and 112 are the general emergency lines (HapaKenya guide, March 2026). 911 is Safaricom-only.
 *   No single national ambulance number was confirmed, so none is listed.
 * - Ghana: 112 reaches police, fire and the National Ambulance Service; 191/192/193 were retired in 2020
 *   (Citi Newsroom, Jan 2020) and the National Ambulance Service still tells the public to dial 112 (Citi Newsroom, July 2026).
 *   The brief listed 193 for the ambulance; the sources say it no longer works, so it is omitted.
 * - South Africa: ambulance 10177 from a landline, 112 from a mobile (Gauteng Department of Health; Western Cape Government).
 */
export const EMERGENCY_NUMBERS: Record<EmergencyCountry, EmergencyNumbers> = {
  NG: {
    country: 'NG',
    countryName: 'Nigeria',
    primary: '112',
    numbers: [{ number: '112', label: 'National emergency number (free)', note: 'Reaches police, fire and other first responders. It may not work in every state yet.' }],
    helplines: [],
    sources: [{ label: 'Nigerian Communications Commission: 112 national emergency number', url: 'https://ncc.gov.ng/node/1397' }],
    checkedAt: '2026-11-05',
    caveat: 'If 112 does not connect, go straight to the nearest hospital.',
  },
  KE: {
    country: 'KE',
    countryName: 'Kenya',
    primary: '999',
    numbers: [
      { number: '999', label: 'Police and general emergency (free)' },
      { number: '112', label: 'General emergency (free)' },
    ],
    helplines: [],
    sources: [{ label: 'HapaKenya: how to contact emergency services (March 2026)', url: 'https://hapakenya.com/2026/03/09/how-to-contact-emergency-services-in-nairobi-nationwide' }],
    checkedAt: '2026-11-05',
    caveat: 'There is no single national ambulance number. Ask your clinic for the county ambulance number and save it.',
  },
  GH: {
    country: 'GH',
    countryName: 'Ghana',
    primary: '112',
    numbers: [{ number: '112', label: 'Police, fire and National Ambulance Service', note: 'The old 191, 192 and 193 lines were replaced by 112.' }],
    helplines: [],
    sources: [
      { label: 'Citi Newsroom: 112 replaces 191, 192 and 193 (January 2020)', url: 'https://www.citinewsroom.com/?p=589149' },
      { label: 'Citi Newsroom: National Ambulance Service urges the public to call 112 (July 2026)', url: 'https://www.citinewsroom.com/2026/07/equip-ambulances-beyond-stretchers-and-sirens-ambulance-service-appeals-to-govt/' },
    ],
    checkedAt: '2026-11-05',
  },
  ZA: {
    country: 'ZA',
    countryName: 'South Africa',
    primary: '10177',
    numbers: [
      { number: '10177', label: 'Ambulance (from a landline)' },
      { number: '112', label: 'Emergency from a mobile phone' },
    ],
    helplines: [],
    sources: [
      { label: 'Gauteng Department of Health: call 112 from a mobile, 10177 from a landline', url: 'https://www.gauteng.gov.za/Announcements/AnnouncementDetails/EA2BC69F-667E-4193-B156-9BAE3023F3D1' },
      { label: 'Western Cape Government: know who to call in an emergency', url: 'https://www.westerncape.gov.za/local-government/know-who-you-can-call-emergency' },
    ],
    checkedAt: '2026-11-05',
  },
};

/** The number to show her, e.g. "112" or "10177 (or 112 from a mobile)". Undefined for an unknown country. */
export function emergencyNumberFor(country: string): string | undefined {
  const e = EMERGENCY_NUMBERS[country as EmergencyCountry];
  if (!e) return undefined;
  if (country === 'ZA') return '10177 (or 112 from a mobile)';
  if (country === 'KE') return '999 or 112';
  return e.primary;
}
