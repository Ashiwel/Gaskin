import type { LanguagePack } from '../types';
import { EN_UI } from '../uiKeys';
import { englishTemplates } from '../templates';

/** English: the source language. Mother text comes straight from the clinical table. */
export const en: LanguagePack = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  direction: 'ltr',
  version: '1.0.0',
  licence: 'CC-BY-4.0',
  status: 'reviewed',
  reviewers: ['Gaskin clinical lead (plain-language source text)'],
  regions: ['NG', 'KE', 'GH'],
  note: 'Plain, simple English. This is the source text and the fallback for every other language.',
  ui: { ...EN_UI },
  /** Always the full English source, including templates registered later (e.g. VISIT_TEXT) */
  get mother() {
    return englishTemplates();
  },
  glossary: {},
  sources: [{ label: 'Gaskin clinical knowledge base, src/clinical/motherText.ts' }],
};
