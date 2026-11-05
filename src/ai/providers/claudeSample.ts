/**
 * Live Claude inside the published claude.ai Artifact, through the artifact
 * runtime's `sample` capability. Calls spend the viewer's own Claude usage
 * and the first call asks the viewer to allow it.
 *
 * - `window.claude` is absent outside the artifact: guarded.
 * - `claude.use("sample")` resolves the function or null (~10 s if no
 *   viewer answers); we also time out ourselves at 10 s.
 * - Calls are memoryless: the prompt carries instructions, data and format.
 * - Errors reject with {code, message, text?}. We never retry. Codes that
 *   mean "not available in this view" disable the provider for the session.
 */
import { makeLiveProvider, TransportError, abortError, type Transport, type TransportCallOpts, type LiveProviderOptions } from '../pipeline';
import type { AIProvider } from '../types';

export interface SampleError {
  code: string;
  message: string;
  text?: string;
}
type SampleTextUpdate = { text: string; delta: string };
type SampleOptions = {
  onText?: (u: SampleTextUpdate) => void;
  signal?: AbortSignal;
  modelTier?: 'default' | 'complex' | 'quick';
  cache?: boolean;
};
export interface SampleFn {
  (input: string, options?: SampleOptions): Promise<{ text: string; truncated?: boolean }>;
  json?: <T = unknown>(input: string, options?: SampleOptions) => Promise<T>;
}

/** Codes that mean: stop using `sample` for this session */
export const PERMANENT_SAMPLE_CODES = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
  'session_expired',
  'queue_overflow',
]);

const CODE_COPY: Record<string, string> = {
  not_granted: 'Claude was not allowed for this page, so Gaskin is using its offline templates.',
  sampling_disabled: 'Claude is not available on this account, so Gaskin is using its offline templates.',
  not_declared: 'This page is not set up to use Claude.',
  capability_disabled: 'Claude cannot be used in this view.',
  capability_removed: 'This Claude app is too old for live AI.',
  session_expired: 'Your Claude session expired. Sign in again to use live AI.',
  rate_limited: 'Claude is busy or your usage limit was reached. Try again later.',
  refused: 'Claude declined this request.',
  empty_completion: 'Claude returned nothing.',
  invalid_json: 'Claude did not return the expected format.',
  prompt_too_large: 'The request was too large.',
  upstream_error: 'Claude could not be reached just now.',
};

export const SAMPLE_TIMEOUT_MS = 10_000;

/** Resolve the `sample` function, or null when not in a Claude viewer. Never throws; gives up after 10 s. */
export async function resolveSample(timeoutMs = SAMPLE_TIMEOUT_MS): Promise<SampleFn | null> {
  const w = (typeof window !== 'undefined' ? window : undefined) as unknown as { claude?: { use?: (n: string) => Promise<unknown> } } | undefined;
  const use = w?.claude?.use;
  if (typeof use !== 'function') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const got = await Promise.race([
      Promise.resolve(use.call(w!.claude, 'sample')).catch(() => null),
      new Promise<null>((res) => {
        timer = setTimeout(() => res(null), timeoutMs);
      }),
    ]);
    return typeof got === 'function' ? (got as SampleFn) : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function sampleTransport(sample: SampleFn): Transport {
  return {
    id: 'claude-sample',
    label: 'Claude (in this page)',
    mode: 'claude_here',
    destination: 'artifact_host',
    compact: false,
    constrained: false,
    deidentify: true,
    async complete(prompt: string, o: TransportCallOpts) {
      const options: SampleOptions = {
        modelTier: o.tier,
        signal: o.signal,
        onText: o.onText ? ({ text }) => o.onText!(text) : undefined,
      };
      try {
        // Text calls for everything; JSON is parsed tolerantly by the pipeline, which lets us stream and use one code path
        const r = await sample(prompt, options);
        return r.text;
      } catch (err) {
        const e = err as SampleError;
        if (e?.code === 'cancelled') throw abortError();
        const code = e?.code ?? 'upstream_error';
        throw new TransportError(CODE_COPY[code] ?? `Claude error (${code}).`, PERMANENT_SAMPLE_CODES.has(code), code);
      }
    },
  };
}

export function createClaudeSampleProvider(sample: SampleFn, opts?: LiveProviderOptions): AIProvider {
  return makeLiveProvider(sampleTransport(sample), opts);
}
