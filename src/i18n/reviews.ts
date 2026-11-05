import type { PackCode } from './types';
import { readJSON, writeJSON } from './storage';

/**
 * "I checked this": a worker who speaks the language confirms one translated line on this device.
 * The check is tied to the exact text (by hash), so if the pack changes the line, the check lapses.
 * A local check never changes the pack's confidence; it is shown beside it.
 */
export const REVIEWS_KEY = 'gaskin.i18n.reviews.v1';

export interface LocalReview {
  lang: PackCode;
  key: string;
  textHash: string;
  at: string;
  workerId?: string;
}

type ReviewMap = Record<string, LocalReview>;

const listeners = new Set<() => void>();
let version = 0;

export function hashText(s: string): string {
  // FNV-1a, 32-bit: short and stable, enough to notice a changed line
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function id(lang: PackCode, key: string, text: string): string {
  return `${lang}|${key}|${hashText(text)}`;
}

export function getLocalReview(lang: PackCode, key: string, text: string): LocalReview | undefined {
  return readJSON<ReviewMap>(REVIEWS_KEY, {})[id(lang, key, text)];
}

export function isCheckedLocally(lang: PackCode, key: string, text: string): boolean {
  return !!getLocalReview(lang, key, text);
}

export function markChecked(lang: PackCode, key: string, text: string, opts: { workerId?: string; at?: string } = {}): LocalReview {
  const all = readJSON<ReviewMap>(REVIEWS_KEY, {});
  const r: LocalReview = { lang, key, textHash: hashText(text), at: opts.at ?? new Date().toISOString(), workerId: opts.workerId };
  all[id(lang, key, text)] = r;
  writeJSON(REVIEWS_KEY, all);
  bump();
  return r;
}

export function unmarkChecked(lang: PackCode, key: string, text: string): void {
  const all = readJSON<ReviewMap>(REVIEWS_KEY, {});
  delete all[id(lang, key, text)];
  writeJSON(REVIEWS_KEY, all);
  bump();
}

/** Every local check, for export to the pack maintainers */
export function listLocalReviews(): LocalReview[] {
  return Object.values(readJSON<ReviewMap>(REVIEWS_KEY, {}));
}

function bump() {
  version++;
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore */
export const reviewStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getVersion(): number {
    return version;
  },
};
