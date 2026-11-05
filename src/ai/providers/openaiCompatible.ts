/**
 * Provider for self-hosted and hosted open-weight or commercial models
 * through any OpenAI-compatible chat completions endpoint: Ollama, LM
 * Studio, vLLM, llama.cpp server on a laptop or facility hub, or OpenAI,
 * OpenRouter, Groq, Together. This keeps Gaskin free of any hard
 * dependency on a closed model (Digital Public Goods platform independence).
 *
 * Configured at build time from VITE_AI_BASE_URL, VITE_AI_MODEL and
 * VITE_AI_API_KEY (selected in 'auto' mode only when VITE_AI_BASE_URL is
 * set), or at run time from AI settings ('own_key' / 'on_device').
 */
import { makeLiveProvider, type LiveProviderOptions } from '../pipeline';
import type { AIProvider } from '../types';
import { openAICompatibleTransport, type OpenAICompatibleConfig } from './http';

export type { OpenAICompatibleConfig } from './http';

function env(): Record<string, string | undefined> {
  try {
    return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

/** Build-time configuration, or null when VITE_AI_BASE_URL is not set */
export function openAICompatibleConfigFromEnv(): OpenAICompatibleConfig | null {
  const e = env();
  const baseUrl = e.VITE_AI_BASE_URL?.trim();
  if (!baseUrl) return null;
  return { baseUrl, model: e.VITE_AI_MODEL?.trim() || 'llama3.2', apiKey: e.VITE_AI_API_KEY?.trim() || undefined };
}

export function isOpenAICompatibleConfigured(): boolean {
  return openAICompatibleConfigFromEnv() !== null;
}

export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig, opts?: LiveProviderOptions): AIProvider {
  return makeLiveProvider(openAICompatibleTransport(cfg), opts);
}
