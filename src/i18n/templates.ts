import { MOTHER_TEXT } from '../clinical/motherText';

/**
 * English plain-language template sources that packs translate.
 * MOTHER_TEXT (plan items and alerts) is built in; other modules (for example the visits
 * module's VISIT_TEXT) are added with registerTemplates so packs can translate them as well.
 * Keys must be unique across sources; a clash throws so it is caught in tests.
 */
const sources = new Map<string, Record<string, string>>([['mother', MOTHER_TEXT]]);
let merged: Record<string, string> | null = null;

export function registerTemplates(source: string, templates: Record<string, string>): void {
  for (const [name, other] of sources) {
    if (name === source) continue;
    const clash = Object.keys(templates).find((k) => other[k] !== undefined && other[k] !== templates[k]);
    if (clash) throw new Error(`Template key ${clash} from ${source} clashes with ${name}`);
  }
  sources.set(source, templates);
  merged = null;
}

export function englishTemplates(): Record<string, string> {
  if (!merged) merged = Object.assign({}, ...sources.values()) as Record<string, string>;
  return merged;
}

export function englishTemplate(key: string): string | undefined {
  return englishTemplates()[key];
}

export function templateSources(): string[] {
  return [...sources.keys()];
}
