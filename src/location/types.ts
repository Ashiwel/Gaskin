import type { Citation, CountryCode, LanguageCode } from '../types';
import type { Nutrient } from '../clinical';

/**
 * Where a worker practises, and what that means for a care plan:
 * what is grown and sold nearby, what families commonly do, where to refer,
 * how much malaria there is and which languages people speak.
 *
 * Everything here is advisory context. Clinical rules stay in src/engine and src/clinical.
 */

export type CostTier = 'cheap' | 'moderate' | 'dear';

export interface LocationFood {
  /** Name as a worker would say it, with local names in brackets */
  name: string;
  nutrients: Nutrient[];
  /** Everyday household measure, e.g. '2 oranges', 'a handful of omena' */
  householdMeasure: string;
  /** When it is plentiful and cheap, e.g. 'October to January (peak harvest)'; 'all year' */
  season: string;
  costTier: CostTier;
  /** Why it is listed for this area, in one sentence */
  why: string;
  /** Source ids from `sources` */
  sourceIds: string[];
}

export type FacilityType = 'teaching_hospital' | 'federal_medical_centre' | 'specialist_hospital' | 'general_hospital' | 'county_referral_hospital' | 'regional_hospital' | 'maternity_hospital';

export interface ReferralFacility {
  name: string;
  type: FacilityType;
  /** Town where the facility is */
  town: string;
  /** Approximate town coordinates (not the gate of the hospital), used for straight-line distance only */
  townLatLon?: [number, number];
  /**
   * Distance from the worker's community. Null until it is worked out at setup
   * from her shared location, or entered by hand. Always a placeholder in curated profiles.
   */
  distanceKm: number | null;
  note?: string;
  sourceIds: string[];
}

export type MalariaRisk = 'high' | 'moderate' | 'seasonal' | 'low';

export interface LocationProfile {
  /** Stable id, e.g. 'NG-benue' */
  id: string;
  country: CountryCode;
  /** State, county or region name as used by the engine and synthetic data */
  region: string;
  /** Kind of area: state (NG), county (KE), region (GH) */
  regionKind: 'state' | 'county' | 'region';
  capital: string;
  /** Capital coordinates, used to guess the nearest region from GPS */
  centroid: [number, number];
  /** LGA, sub-county or district, when known (filled at setup) */
  district?: string;

  /** Languages Gaskin has packs or templates for, most spoken first */
  languages: LanguageCode[];
  /** Other widely spoken languages with no Gaskin pack yet */
  otherLanguages: string[];

  localFoods: LocationFood[];
  /** One or two plain sentences on the farming year: harvests, lean season */
  seasonality: string;

  /**
   * Traditional practice ids (src/clinical TRADITIONAL_PRACTICES) for the worker to ask about here.
   * Chosen from the groups each library entry names; this is a prompt to ask, not a prevalence estimate.
   */
  prevalentPractices: string[];

  /** Feeds PlanContext.location.malariaEndemic, which decides IPTp eligibility */
  malariaEndemic: boolean;
  malariaRisk: MalariaRisk;
  malariaNote: string;

  referralFacilities: ReferralFacility[];

  /** Phones, internet and literacy for mothers in this area */
  connectivityNote: string;

  sources: Citation[];
  /** ISO date the profile was last checked */
  reviewedAt: string;
  /** 'curated' = hand-built from the cited sources; 'generated' = built at setup from open datasets */
  origin: 'curated' | 'generated' | 'country_default';
}

/** The exact shape the engine accepts as PlanContext.location (src/engine/items.ts) */
export interface PlanLocation {
  country: CountryCode;
  region: string;
  localFoods?: { name: string; nutrients: string[]; season?: string; costTier?: string }[];
  practices?: string[];
  malariaEndemic?: boolean;
}
