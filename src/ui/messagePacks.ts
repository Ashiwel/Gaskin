/**
 * Lets the no-AI message templates (src/messaging) write in the mother's language using the
 * language packs (src/i18n). A line the pack does not translate stays in plain English, so
 * nothing is guessed. Pidgin keeps the hand-written messaging pack.
 */
import { registerLanguagePack, hasLanguagePack } from '../messaging';
import { allPacks, registerTemplates, renderMotherText, type PackCode } from '../i18n';
import { VISIT_TEXT } from '../visits/text';
import type { LanguageCode, PlanItem } from '../types';

let done = false;

export function registerMessagePacks(): void {
  if (done) return;
  done = true;
  // Visit lines (and visit-referral alerts) are translated by the packs like plan lines.
  try {
    registerTemplates('visits', VISIT_TEXT);
  } catch {
    /* already registered */
  }
  for (const p of allPacks()) {
    const code = p.code as PackCode;
    if (code === 'en' || code === 'fr' || hasLanguagePack(code as LanguageCode)) continue;
    if (!Object.keys(p.mother).length) continue;
    const line = (key: string, params?: Record<string, string | number>) => {
      try {
        const r = renderMotherText(key, params ?? {}, code);
        return r.confidence === 'fallback' ? undefined : r.text;
      } catch {
        return undefined;
      }
    };
    registerLanguagePack({
      language: code as LanguageCode,
      greeting: (n) => `${n},`,
      signOff: (f) => `- ${f}`,
      replyHint: '',
      alert: {
        emergency: line('alert.go_now') ?? 'Go to the hospital now. Do not wait.',
        urgent: line('alert.go_today') ?? 'Go to the clinic today.',
        warning: line('alert.go_today') ?? 'Go to the clinic today.',
      },
      item: (i: PlanItem) => (i.motherTextKey ? line(i.motherTextKey, i.motherTextParams) : undefined),
    });
  }
}
