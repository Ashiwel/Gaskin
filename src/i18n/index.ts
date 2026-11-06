/**
 * Gaskin language system.
 *
 * Two audiences, two languages, one screen: the worker reads the plan in her language and
 * clinical register; the mother sees or hears it in her language in plain words. The worker's
 * language (set at onboarding) drives the interface; each patient's language (set at
 * registration, default from her location) is used only for mother-facing content.
 *
 * Packs download once and then work offline. Anything not translated falls back to plain
 * English and says so; nothing is guessed. Draft translations are labelled as drafts, and
 * danger signs in a draft or fallback language always carry their picture and the English line.
 */
export type {
  PackCode,
  PackStatus,
  Confidence,
  LanguagePack,
  PackSource,
  MotherRendering,
  WorkerRendering,
  DualRendering,
  PackSummary,
} from './types';
export { EN_UI, UI_KEYS } from './uiKeys';
export type { UiKey } from './uiKeys';
export {
  PACKS,
  PACK_ORDER,
  getPack,
  allPacks,
  isPackCode,
  installedLanguages,
  isInstalled,
  installPack,
  uninstallPack,
  installProgress,
  summarisePack,
  packCoverage,
  packSizeBytes,
  formatBytes,
  packStore,
} from './registry';
export type { InstallOptions } from './registry';
export {
  t,
  uiConfidence,
  dirFor,
  renderMotherText,
  renderUntemplated,
  englishMotherText,
  renderForBoth,
  placeholdersOf,
  illustrationForAlert,
  isAlert,
} from './render';
export { registerTemplates, englishTemplates, englishTemplate, templateSources } from './templates';
export { markChecked, unmarkChecked, isCheckedLocally, getLocalReview, listLocalReviews, reviewStore, hashText, REVIEWS_KEY } from './reviews';
export type { LocalReview } from './reviews';
export { backTranslate, setBackTranslator, backTranslatePrompt, hasTemplate } from './backTranslate';
export type { BackTranslateArgs, BackTranslator } from './backTranslate';
export { defaultPatientLanguage, motherLanguageInfo, REGION_LANGUAGE } from './patientLanguage';
export type { LocationLike, PatientLanguage } from './patientLanguage';
// Language identity beyond packs (any BCP-47 tag): see src/geo
export { packFor, packStateFor, packStateLabel, PACK_STATE_LABELS, NO_PACK_NOTE } from '../geo/languages';
export type { PackState } from '../geo/languages';
export { LanguagePicker, DualLanguageView, ShowToMother, ConfidenceBadge } from './components';
export type { LanguagePickerProps, DualLanguageViewProps, ShowToMotherProps, ConfidenceBadgeProps } from './components';
