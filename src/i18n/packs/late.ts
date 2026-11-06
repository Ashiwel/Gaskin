import { englishTemplates } from '../templates';

/**
 * Mother text for a pack whose translations cover templates that another module registers later
 * (for example VISIT_TEXT, registered by the visits module with registerTemplates). A translation
 * only appears once its English source is registered, so the pack never carries orphan keys and
 * coverage counts stay honest. MOTHER_TEXT keys are always present.
 *
 * Use as a getter: `get mother() { return m(); }` with `const m = lateMother(CORE, VISITS);`
 */
export function lateMother(core: Record<string, string>, ...late: Record<string, string>[]): () => Record<string, string> {
  let seen: Record<string, string> | null = null;
  let out: Record<string, string> = core;
  return () => {
    const en = englishTemplates();
    if (en !== seen) {
      seen = en;
      out = { ...core };
      for (const table of late) for (const [k, v] of Object.entries(table)) if (en[k] !== undefined) out[k] = v;
    }
    return out;
  };
}

/**
 * A machine-draft pack built from a core table (MOTHER_TEXT keys), a late table (VISIT_TEXT keys,
 * shown once registered) and a subset of worker UI keys. Every string is a draft; anything left
 * out falls back to plain English.
 */
export function draftPack(p: {
  code: import('../types').PackCode;
  name: string;
  nativeName: string;
  note: string;
  ui: Partial<Record<import('../uiKeys').UiKey, string>>;
  core: Record<string, string>;
  visits: Record<string, string>;
  glossary: Record<string, string>;
  source: string;
  /** 'partial' when only a small, safe subset is drafted */
  status?: 'machine_draft' | 'partial';
}): import('../types').LanguagePack {
  const mother = lateMother(p.core, p.visits);
  return {
    code: p.code,
    name: p.name,
    nativeName: p.nativeName,
    direction: 'ltr',
    version: '0.1.0',
    licence: 'CC-BY-4.0',
    status: p.status ?? 'machine_draft',
    reviewers: [],
    regions: [],
    note: p.note,
    ui: p.ui,
    get mother() {
      return mother();
    },
    glossary: p.glossary,
    sources: [{ label: p.source }],
  };
}
