/**
 * On-device AI: nothing leaves the worker's device (or facility network).
 *
 * - local_server: an OpenAI-compatible server on the same laptop or a
 *   facility hub (Ollama http://localhost:11434/v1, LM Studio
 *   http://localhost:1234/v1, llama.cpp, vLLM).
 * - in_browser: WebLLM running a small model on the device's GPU through
 *   WebGPU. The library is loaded at run time from jsDelivr (not an npm
 *   dependency) and only when WebGPU exists. First use downloads the model
 *   weights (about 0.7 to 1.5 GB) once; inside the hosted claude.ai demo the
 *   page's network is sandboxed, so the download fails there and we say so.
 *
 * Small models are weaker, so on-device runs are constrained: only
 * personalise / translate / extract, short prompts, and the template result
 * whenever the output fails validation.
 */
import { makeLiveProvider, TransportError, abortError, type LiveProviderOptions, type Transport, type TransportCallOpts } from '../pipeline';
import type { AIProvider } from '../types';
import { openAICompatibleTransport } from './http';

export const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm';

/** Small models suitable for phones and modest laptops (MLC prebuilt ids) */
export const WEBLLM_MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B (best multilingual of the three)', approxDownloadMB: 1000 },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (smallest, fastest)', approxDownloadMB: 880 },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B (largest, slowest)', approxDownloadMB: 1900 },
] as const;

export interface OnDeviceConfig {
  kind: 'local_server' | 'in_browser';
  baseUrl?: string;
  model: string;
  /** De-identify prompts even though nothing leaves the device (default true) */
  deidentify?: boolean;
}

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as unknown as { gpu?: unknown }).gpu);
}

export interface WebLLMProgress {
  progress: number;
  text: string;
}
type ProgressListener = (p: WebLLMProgress) => void;
const progressListeners = new Set<ProgressListener>();

/** Model download / load progress for the UI */
export function onWebLLMProgress(l: ProgressListener): () => void {
  progressListeners.add(l);
  return () => {
    progressListeners.delete(l);
  };
}

interface WebLLMEngine {
  chat: {
    completions: {
      create(req: Record<string, unknown>): Promise<unknown>;
    };
  };
  interruptGenerate?: () => void;
}

let enginePromise: Promise<WebLLMEngine> | null = null;
let engineModel = '';

async function loadEngine(model: string): Promise<WebLLMEngine> {
  if (enginePromise && engineModel === model) return enginePromise;
  if (!hasWebGPU()) throw new TransportError('This device has no WebGPU, so in-browser AI cannot run. Use a local server, another AI mode, or the offline templates.', true, 'no_webgpu');
  engineModel = model;
  enginePromise = (async () => {
    let lib: { CreateMLCEngine: (m: string, o: Record<string, unknown>) => Promise<WebLLMEngine> };
    try {
      lib = (await import(/* @vite-ignore */ WEBLLM_URL)) as typeof lib;
    } catch {
      throw new TransportError(
        'Could not load the in-browser AI library. This needs internet the first time; the hosted demo blocks outside downloads, so run Gaskin from your own copy to use on-device AI.',
        true,
        'webllm_load',
      );
    }
    try {
      return await lib.CreateMLCEngine(model, {
        initProgressCallback: (p: { progress?: number; text?: string }) => {
          for (const l of progressListeners) l({ progress: p.progress ?? 0, text: p.text ?? '' });
        },
      });
    } catch (e) {
      throw new TransportError(
        `Could not download or start the model ${model}: ${(e as Error)?.message ?? e}. The first download needs about 1 GB over internet; the hosted demo cannot download weights.`,
        true,
        'webllm_weights',
      );
    }
  })();
  enginePromise.catch(() => {
    enginePromise = null;
  });
  return enginePromise;
}

export function webLLMTransport(model: string, deidentify = true): Transport {
  return {
    id: 'on-device-browser',
    label: `On this device (${model.split('-').slice(0, 3).join(' ')})`,
    mode: 'on_device',
    destination: 'on_device',
    compact: true,
    constrained: true,
    deidentify,
    async complete(prompt: string, o: TransportCallOpts) {
      const engine = await loadEngine(model);
      if (o.signal?.aborted) throw abortError();
      const onAbort = () => engine.interruptGenerate?.();
      o.signal?.addEventListener('abort', onAbort);
      try {
        const stream = Boolean(o.onText);
        const req: Record<string, unknown> = {
          messages: [{ role: 'user', content: prompt }],
          temperature: o.json ? 0 : 0.3,
          max_tokens: 700,
          stream,
        };
        if (stream) {
          let text = '';
          const it = (await engine.chat.completions.create(req)) as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>;
          for await (const chunk of it) {
            if (o.signal?.aborted) throw abortError();
            const d = chunk.choices?.[0]?.delta?.content;
            if (d) {
              text += d;
              o.onText?.(text);
            }
          }
          return text;
        }
        const r = (await engine.chat.completions.create(req)) as { choices?: Array<{ message?: { content?: string } }> };
        if (o.signal?.aborted) throw abortError();
        return r.choices?.[0]?.message?.content ?? '';
      } finally {
        o.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

export function onDeviceTransport(cfg: OnDeviceConfig): Transport {
  const deid = cfg.deidentify !== false;
  if (cfg.kind === 'in_browser') return webLLMTransport(cfg.model, deid);
  return openAICompatibleTransport(
    { baseUrl: cfg.baseUrl || 'http://localhost:11434/v1', model: cfg.model, label: `Local AI server (${cfg.model})` },
    { id: 'on-device-server', mode: 'on_device', destination: 'on_device', compact: true, constrained: true, deidentify: deid },
  );
}

export function createOnDeviceProvider(cfg: OnDeviceConfig, opts?: LiveProviderOptions): AIProvider {
  return makeLiveProvider(onDeviceTransport(cfg), opts);
}
