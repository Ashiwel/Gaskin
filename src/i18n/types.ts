import type { CountryCode, IllustrationKey, LanguageCode } from '../types';
import type { UiKey } from './uiKeys';

/** Every language Gaskin can carry a pack for. French is extra to the core LanguageCode set (francophone neighbours). */
export type PackCode = LanguageCode | 'fr';

/**
 * Pack status.
 * - reviewed: native-speaking midwives have checked every string.
 * - machine_draft: a full draft, not yet reviewed. Never use with patients unchecked.
 * - partial: some strings only; the rest falls back to plain English.
 * - none: no translations yet; everything falls back to plain English.
 */
export type PackStatus = 'reviewed' | 'machine_draft' | 'partial' | 'none';

/** Confidence for one rendered line. 'fallback' means the English source was shown instead. */
export type Confidence = 'reviewed' | 'draft' | 'fallback';

export interface PackSource {
  label: string;
  url?: string;
}

/**
 * A language pack. Strings are plain text; confidence is kept in one place:
 * the pack default comes from `status` ('reviewed' -> 'reviewed', otherwise 'draft'),
 * and `confidence` overrides it per entry, keyed 'ui:<key>', 'mother:<key>' or 'glossary:<term>'.
 * A string that is missing is never guessed: it renders in plain English with confidence 'fallback'.
 */
export interface LanguagePack {
  code: PackCode;
  /** English name */
  name: string;
  /** Name in the language itself */
  nativeName: string;
  direction: 'ltr' | 'rtl';
  version: string;
  licence: 'CC-BY-4.0';
  status: PackStatus;
  /** Names or roles of the people who reviewed the pack */
  reviewers: string[];
  /** Where the language is mostly used among Gaskin's launch countries */
  regions: CountryCode[];
  /** Plain-English note for the worker about the state of this pack */
  note: string;
  /** Worker-interface strings */
  ui: Partial<Record<UiKey, string>>;
  /** Mother-facing templates, same keys and {placeholders} as MOTHER_TEXT */
  mother: Record<string, string>;
  /** Translations of placeholder values (food servings, 'the baby', month abbreviations) */
  glossary: Record<string, string>;
  confidence?: Record<string, Confidence>;
  sources: PackSource[];
}

export interface MotherRendering {
  text: string;
  /** The language the text is actually in ('en' when it fell back) */
  lang: PackCode;
  confidence: Confidence;
  /** The English plain-language source line */
  english: string;
  /** Template key, when there is one */
  key?: string;
  /** Why it fell back: no template key, no translation of the template, or a value missing from the glossary */
  missing?: 'key' | 'template' | 'glossary';
  /** A worker on this device ticked "I checked this" for this exact text */
  checkedLocally: boolean;
  dir: 'ltr' | 'rtl';
}

export interface WorkerRendering {
  lang: PackCode;
  dir: 'ltr' | 'rtl';
  /** Category or alert-level label in the worker's language */
  heading: string;
  headingConfidence: Confidence;
  /** Clinical title and detail, as the engine wrote them (English clinical register) */
  title: string;
  detail: string;
  clinicalLang: 'en';
  /** The mother's line, shown to the worker in the worker's own language so she knows what is being said */
  plain: MotherRendering | null;
}

export interface DualRendering {
  kind: 'item' | 'alert';
  id: string;
  /** Danger signs, referral items and every alert */
  isDanger: boolean;
  level?: 'emergency' | 'urgent' | 'warning';
  illustration: IllustrationKey;
  worker: WorkerRendering;
  /** Null when the item is for the worker only */
  mother: MotherRendering | null;
  english: string;
  /** Always true for danger lines that are not reviewed, and whenever a pictogram exists */
  showPictogram: boolean;
  /** Danger line in a draft language: show the English line beneath */
  showEnglishBeneath: boolean;
}

export interface PackSummary {
  code: PackCode;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  status: PackStatus;
  version: string;
  regions: CountryCode[];
  note: string;
  /** Approximate download size in bytes */
  sizeBytes: number;
  /** Share of mother templates translated, 0..1 */
  motherCoverage: number;
  /** Share of UI keys translated, 0..1 */
  uiCoverage: number;
  installed: boolean;
}
