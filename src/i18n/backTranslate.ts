import type { PackCode } from './types';
import { getPack } from './registry';
import { englishTemplate } from './templates';

/**
 * Back-translation: show the worker what a translated line says, in her own language.
 * Optional. It needs a live AI provider; with AI off it returns null and the UI says so.
 *
 * Privacy: only the pack's template is sent, with {name} kept as a placeholder, so no
 * name or other identifier leaves the device. Pack templates are public (CC-BY-4.0).
 */
export interface BackTranslateArgs {
  /** Template key, so the template (not her filled-in line) is what gets sent */
  key?: string;
  /** The translated line, used only when there is no key */
  text: string;
  from: PackCode;
  to: PackCode;
  signal?: AbortSignal;
}

export type BackTranslator = (a: BackTranslateArgs) => Promise<string | null>;

let custom: BackTranslator | null = null;

/** Replace the back-translator (tests, or a dedicated service) */
export function setBackTranslator(fn: BackTranslator | null): void {
  custom = fn;
}

function sourceFor(a: BackTranslateArgs): string {
  if (a.key) {
    const tmpl = getPack(a.from).mother[a.key];
    if (tmpl) return tmpl;
  }
  return a.text;
}

export function backTranslatePrompt(text: string, from: PackCode, to: PackCode): string {
  const f = getPack(from).name;
  const t = getPack(to).name;
  return [
    `A health worker wants to check a draft ${f} translation written for a mother.`,
    `Translate the ${f} text below back into ${t}, word for word as far as it reads naturally. Do not correct, improve or explain it.`,
    'If any part is unclear, ungrammatical or could mean something different, add one short line starting "Note:" in the same language as the translation.',
    'Keep {placeholders} exactly as written.',
    '',
    text,
  ].join('\n');
}

/**
 * Returns the back-translation, or null when no AI is available.
 * Never throws for AI failures (returns null); aborts reject.
 */
export async function backTranslate(a: BackTranslateArgs): Promise<string | null> {
  if (custom) return custom(a);
  const source = sourceFor(a);
  if (a.from === a.to) return source;
  try {
    const ai = await import('../ai');
    const provider = (await ai.getAIProvider()) as { live: boolean; id: string; transport?: { complete(p: string, o: { task: 'translate'; json: boolean; tier: 'quick'; signal?: AbortSignal }): Promise<string>; destination?: string; mode?: string } };
    if (!provider.live || !provider.transport) return null;
    const prompt = backTranslatePrompt(source, a.from, a.to);
    const out = await provider.transport.complete(prompt, { task: 'translate', json: false, tier: 'quick', signal: a.signal });
    try {
      const priv = await import('../privacy');
      priv.recordAICall({
        provider: provider.id,
        mode: provider.transport.mode ?? 'auto',
        task: 'back-translate',
        categories: ['translation template (no patient data)'],
        removed: [],
        bytes: priv.byteLength(prompt),
        destination: (provider.transport.destination as 'cloud') ?? 'cloud',
        deidentified: true,
        outcome: 'sent',
      });
    } catch {
      /* audit is best effort */
    }
    return out.trim() || null;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    return null;
  }
}

/** True when a template key exists (helper for callers deciding whether to offer the check) */
export function hasTemplate(key: string | undefined): boolean {
  return !!key && englishTemplate(key) !== undefined;
}
