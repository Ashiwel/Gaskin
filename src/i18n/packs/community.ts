import type { LanguagePack } from '../types';

/**
 * Languages with no open dataset or model good enough to draft from, and no reviewed
 * translations yet. They fall back to plain, simple English until a team of native-speaking
 * midwives builds them. No string here is guessed.
 */
const HELP =
  'No translations yet, so Gaskin shows plain, simple English. Help build this pack: native-speaking midwives and health workers can translate and review the strings, and the pack is shared under CC BY 4.0.';

const base = {
  direction: 'ltr' as const,
  version: '0.0.1',
  licence: 'CC-BY-4.0' as const,
  status: 'none' as const,
  reviewers: [],
  ui: {},
  mother: {},
  glossary: {},
  sources: [{ label: 'Wanted: native-speaker translators and reviewers' }],
};

export const bin: LanguagePack = { ...base, code: 'bin', name: 'Edo (Bini)', nativeName: 'Ẹ̀dó', regions: ['NG'], note: HELP };
export const urh: LanguagePack = { ...base, code: 'urh', name: 'Urhobo', nativeName: 'Urhobo', regions: ['NG'], note: HELP };
export const luo: LanguagePack = { ...base, code: 'luo', name: 'Dholuo', nativeName: 'Dholuo', regions: ['KE'], note: HELP };
export const ee: LanguagePack = { ...base, code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe', regions: ['GH'], note: HELP };
export const dag: LanguagePack = { ...base, code: 'dag', name: 'Dagbani', nativeName: 'Dagbanli', regions: ['GH'], note: HELP };

/**
 * Fulfulde has several written standards (Adamawa, Sokoto, Pulaar) that differ enough that a
 * single unreviewed draft could mislead. Until a Fulfulde-speaking midwife team chooses the
 * variety and writes the strings, the pack falls back to plain English.
 */
export const ff: LanguagePack = {
  ...base,
  code: 'ff',
  name: 'Fulfulde',
  nativeName: 'Fulfulde',
  regions: ['NG'],
  note: `${HELP} Fulfulde varieties differ across Nigeria, so the team should first agree which written standard to use (for example Adamawa Fulfulde).`,
};
