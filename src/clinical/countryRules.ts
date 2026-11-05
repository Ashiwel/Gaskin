import type { CountryCode } from '../types';

/**
 * Setting profile: where national guidance differs from WHO, or where WHO
 * recommendations are context-specific, the switch lives here.
 */
export interface CountryRules {
  /** Name of the usual referral level for emergencies, for worker-facing text */
  referralHospital: string;
  /** Where to go for same-day review of urgent problems */
  sameDayFacility: string;
  /** IPTp-SP policy: 'all' = all pregnant women; 'endemic_zones' = only in malaria-endemic areas */
  iptp: 'all' | 'endemic_zones';
  /** Regions where IPTp applies when iptp = 'endemic_zones' (lake and coast endemic counties) */
  iptpRegions?: string[];
  /** Cord care policy */
  cordCare: 'chlorhexidine' | 'dry';
  /** EPDS cut-offs: positive screen (support + follow-up) and probable major depression (refer) */
  epds: { positive: number; refer: number; source: string };
  /** Calcium: WHO A.3 applies where dietary calcium is low (assumed for all three countries) */
  lowCalciumIntake: boolean;
  /** Folic acid dose for women with sickle cell disease */
  scdFolicAcid: 'national_5mg' | 'who_2025';
  /** Frontline cadre name for worker-facing text */
  cadre: string;
  /** Maternity financing note for birth preparedness */
  financing: string;
  financingSource: string;
}

export const COUNTRY_RULES: Record<CountryCode, CountryRules> = {
  NG: {
    referralHospital: 'General Hospital (CEmONC)',
    sameDayFacility: 'the PHC midwife or General Hospital',
    iptp: 'all',
    cordCare: 'chlorhexidine', // FMoH chlorhexidine scale-up strategy 2016: 7.1% gel, all birth settings
    epds: { positive: 10, refer: 12, source: 'epds-nigeria-adewuya' }, // Adewuya validation; EXPONATE used ≥12
    lowCalciumIntake: true,
    scdFolicAcid: 'national_5mg',
    cadre: 'CHEW',
    financing: 'BHCPF covers ANC, delivery, caesarean and postnatal care at accredited PHCs; ask whether her LGA is a MAMII LGA (free emergency obstetric care and NEMSAS transport) and whether she is enrolled in the state health insurance scheme.',
    financingSource: 'ng-bhcpf-2020',
  },
  KE: {
    referralHospital: 'county referral hospital (Level 4/5)',
    sameDayFacility: 'the nearest Level 3+ facility',
    iptp: 'endemic_zones',
    // Lake-endemic and coast-endemic counties. Confirm against the national malaria strategy before deployment.
    iptpRegions: ['Kisumu', 'Siaya', 'Homa Bay', 'Migori', 'Busia', 'Kakamega', 'Vihiga', 'Bungoma', 'Kilifi', 'Kwale', 'Mombasa', 'Tana River', 'Lamu', 'Taita Taveta'],
    cordCare: 'dry',
    epds: { positive: 10, refer: 13, source: 'who-pnc-2022-rec18' },
    lowCalciumIntake: true,
    scdFolicAcid: 'who_2025',
    cadre: 'CHP',
    financing: 'SHA Linda Jamii covers ANC, delivery and postnatal care. She must be registered with SHA before labour; registration in labour is no longer accepted.',
    financingSource: 'ke-linda-jamii',
  },
  GH: {
    referralHospital: 'district hospital',
    sameDayFacility: 'the CHPS midwife or health centre',
    iptp: 'all',
    cordCare: 'dry',
    epds: { positive: 10, refer: 13, source: 'who-pnc-2022-rec18' },
    lowCalciumIntake: true,
    scdFolicAcid: 'who_2025',
    cadre: 'CHO',
    financing: 'Free maternal care under NHIS covers ANC, delivery, emergencies and postnatal care to 3 months after birth. Check her NHIS card is active.',
    financingSource: 'gh-free-maternal-care',
  },
};
