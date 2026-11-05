/**
 * "Any AI app" (copy and paste). For workers who already have a free AI
 * app (ChatGPT, Gemini, Meta AI in WhatsApp, Claude) but no API key. The
 * provider emits a manual request holding a short, de-identified,
 * self-contained prompt; the UI shows it with a Copy button; the worker
 * pastes the app's reply back with submitManualReply; guardrails then run
 * and the template result replaces anything that fails.
 *
 * Note: the worker's own AI app account and its terms apply to what is
 * pasted there. The prompt is de-identified, but it is still pseudonymised
 * health information, so the mother's consent to AI use still applies.
 */
import { makeLiveProvider, abortError, TransportError, type LiveProviderOptions, type Transport, type TransportCallOpts } from '../pipeline';
import type { AIProvider } from '../types';

export interface ManualRequest {
  id: string;
  /** personalise | translate | extract */
  task: string;
  /** The exact text to copy into the AI app */
  prompt: string;
  /** Plain-English instruction for the worker */
  instructions: string;
  /** 'text' or 'json': what the reply should look like */
  expects: 'text' | 'json';
  createdAt: string;
}

type Listener = (r: ManualRequest) => void;
const listeners = new Set<Listener>();
const pending = new Map<string, { req: ManualRequest; resolve: (t: string) => void; reject: (e: unknown) => void; cleanup: () => void }>();
let seq = 0;

/** Subscribe to copy-and-paste requests. Returns an unsubscribe function. Pending requests are replayed to a new listener. */
export function onManualRequest(listener: Listener): () => void {
  listeners.add(listener);
  for (const p of pending.values()) {
    try {
      listener(p.req);
    } catch {
      /* ignore */
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Requests waiting for a pasted reply */
export function getPendingManualRequests(): ManualRequest[] {
  return [...pending.values()].map((p) => p.req);
}

/** Give the pasted reply for a request. Returns false if the id is unknown. Passing null or empty text cancels. */
export function submitManualReply(id: string, text: string | null): boolean {
  const p = pending.get(id);
  if (!p) return false;
  if (text == null || !text.trim()) return cancelManualRequest(id);
  pending.delete(id);
  p.cleanup();
  p.resolve(text);
  return true;
}

/** Cancel a request: the template result is used instead */
export function cancelManualRequest(id: string): boolean {
  const p = pending.get(id);
  if (!p) return false;
  pending.delete(id);
  p.cleanup();
  p.reject(new TransportError('The copy-and-paste request was cancelled, so the offline template was used.', false, 'manual_cancelled'));
  return true;
}

const INSTRUCTIONS: Record<string, string> = {
  personalise: 'Copy this into your AI app (ChatGPT, Gemini, Meta AI or Claude), then paste its reply here. Gaskin checks the reply before you send anything.',
  translate: 'Copy this into your AI app, then paste its reply here. The reply should look like {"t1": "..."}.',
  extract: 'Copy this into your AI app, then paste its reply here. The reply should be a list in square brackets [...].',
};

export function manualTransport(): Transport {
  return {
    id: 'any-app',
    label: 'Any AI app (copy and paste)',
    mode: 'any_app',
    destination: 'copy_paste',
    compact: true,
    constrained: true,
    deidentify: true,
    complete(prompt: string, o: TransportCallOpts) {
      if (o.signal?.aborted) return Promise.reject(abortError());
      return new Promise<string>((resolve, reject) => {
        const id = `manual-${Date.now().toString(36)}-${++seq}`;
        const req: ManualRequest = {
          id,
          task: o.task,
          prompt,
          instructions: INSTRUCTIONS[o.task] ?? INSTRUCTIONS.personalise,
          expects: o.json ? 'json' : 'text',
          createdAt: new Date().toISOString(),
        };
        const onAbort = () => {
          if (pending.delete(id)) reject(abortError());
        };
        o.signal?.addEventListener('abort', onAbort);
        pending.set(id, {
          req,
          resolve: (t) => {
            o.onText?.(t);
            resolve(t);
          },
          reject,
          cleanup: () => o.signal?.removeEventListener('abort', onAbort),
        });
        for (const l of listeners) {
          try {
            l(req);
          } catch {
            /* ignore */
          }
        }
      });
    },
  };
}

export function createManualProvider(opts?: LiveProviderOptions): AIProvider {
  return makeLiveProvider(manualTransport(), opts);
}

/** Test helper */
export function _resetManual(): void {
  for (const id of [...pending.keys()]) cancelManualRequest(id);
  listeners.clear();
}
