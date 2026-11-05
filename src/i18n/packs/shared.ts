/** Shared wording for draft packs */
export const DRAFT_NOTE =
  'Draft translation, not yet reviewed. Native-speaking midwives must review every line before it is used with mothers. Danger signs are always shown with their picture and the English line.';

const ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Month glossary for date placeholders. The engine writes dates as '12 Nov'; each pack gives a
 * pattern with {d} (day number) and {m} (month name in the language).
 */
export function monthGlossary(pattern: string, months: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  ABBR.forEach((a, i) => {
    out[`date:${a}`] = pattern.replace('{m}', months[i]);
  });
  return out;
}
