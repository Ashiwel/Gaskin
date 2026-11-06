/**
 * Gaskin geography and language resolution: every country, first-level regions for every country
 * (ISO 3166-2), second-level areas for Nigeria, Kenya, Ghana and South Africa, and the languages to
 * offer for a place with the Gaskin pack that serves each. Bundled, offline. Sources: SOURCES.md.
 */
export {
  PINNED_COUNTRIES,
  AREA_COUNTRIES,
  listCountries,
  getCountry,
  countryName,
  searchCountries,
  findCountry,
  listRegions,
  findRegion,
  searchRegions,
  placeWords,
  hasAreaData,
  loadAreas,
  listAreasSync,
  findArea,
  fold,
} from './places';
export type { Country, Region, Area, PlaceWords } from './places';
export {
  languagesFor,
  allLanguages,
  searchLanguages,
  languageNames,
  describeLanguage,
  languageSource,
  packFor,
  packStateFor,
  packStateLabel,
  defaultLanguageForPlace,
  PACK_STATE_LABELS,
  NO_PACK_NOTE,
} from './languages';
export type { LanguageChoice, PackState, PlaceInput } from './languages';
export { CURATED_AREAS, EXTRA_LANGUAGE_NAMES } from './curated';
export type { CuratedArea } from './curated';
export { malariaDefault, IPTP_COUNTRIES, OTHER_ENDEMIC, MALARIA_SOURCES } from './malaria';
export type { MalariaDefault } from './malaria';
