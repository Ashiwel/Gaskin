/**
 * HTTP transports for "bring your own AI": any OpenAI-compatible endpoint
 * (OpenAI, OpenRouter, Groq, Together, and Ollama / LM Studio / vLLM on a
 * laptop or facility hub), the Anthropic Messages API, and Google Gemini.
 * Keys are passed in from settings the UI stores on the device; they are
 * sent only to the endpoint the worker configured.
 *
 * Streaming is used when onText is given (SSE), otherwise one JSON reply.
 */
import { TransportError, abortError, type AIMode, type Transport, type TransportCallOpts } from '../pipeline';
import type { AIAuditEntry } from '../../privacy';

type FetchLike = typeof fetch;

function getFetch(): FetchLike {
  if (typeof fetch !== 'function') throw new TransportError('This browser cannot make network requests.', true);
  return fetch.bind(globalThis);
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

/** Remove the worker's key (and anything that looks like a bearer key) from text that may be shown or logged */
export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  for (const k of secrets) if (k && k.length >= 6) out = out.split(k).join('[key hidden]');
  return out.replace(/\b(?:sk|pk|rk|gsk|xai|AIza)[-_A-Za-z0-9]{12,}\b/g, '[key hidden]').replace(/Bearer\s+[-._~+/A-Za-z0-9]{12,}=*/gi, 'Bearer [key hidden]');
}

async function httpError(res: Response, who: string, secrets: Array<string | undefined> = []): Promise<TransportError> {
  let detail = '';
  try {
    const body = await res.text();
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    detail = typeof j.error === 'string' ? j.error : (j.error?.message ?? j.message ?? '');
  } catch {
    /* ignore */
  }
  const s = res.status;
  const permanent = s === 401 || s === 403 || s === 404;
  const why =
    s === 401 || s === 403
      ? `${who} rejected the key (HTTP ${s}). Check the API key in AI settings.`
      : s === 404
        ? `${who} could not find that model or address (HTTP 404). Check the model name and URL.`
        : s === 429
          ? `${who} is rate-limiting or out of credit (HTTP 429). Try again later.`
          : `${who} returned HTTP ${s}.`;
  return new TransportError(redactSecrets(detail ? `${why} ${detail.slice(0, 160)}` : why, secrets), permanent, `http_${s}`);
}

function networkError(e: unknown, who: string, url: string): Error {
  if ((e as { name?: string })?.name === 'AbortError') return abortError();
  const local = /localhost|127\.0\.0\.1|192\.168\.|10\.\d|\.local\b/.test(url);
  return new TransportError(
    local
      ? `Could not reach ${who} at ${url}. Is it running, and does it allow requests from this page (for Ollama set OLLAMA_ORIGINS)?`
      : `Could not reach ${who}. Check the internet connection${typeof location !== 'undefined' && /claude|claudeusercontent/.test(location.host) ? '; the hosted demo blocks outside network calls, so use "Claude here" or the offline templates there' : ''}.`,
    false,
    'network',
  );
}

/** Read an SSE stream and call onData for each data: payload */
async function readSSE(res: Response, onData: (data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) {
        const d = line.slice(5).trim();
        if (d && d !== '[DONE]') onData(d);
      }
    }
  }
}

interface HttpBase {
  id: string;
  label: string;
  mode: AIMode;
  destination: AIAuditEntry['destination'];
  compact: boolean;
  constrained: boolean;
  deidentify: boolean;
}

// ---------- OpenAI-compatible ----------

export interface OpenAICompatibleConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Label shown in the UI */
  label?: string;
}

export function openAICompatibleTransport(cfg: OpenAICompatibleConfig, base: Partial<HttpBase> = {}): Transport {
  const url = `${trimSlash(cfg.baseUrl)}/chat/completions`;
  const who = cfg.label ?? 'The AI server';
  return {
    id: 'openai-compatible',
    label: cfg.label ?? `${cfg.model} (OpenAI-compatible)`,
    mode: 'own_key',
    destination: 'cloud',
    compact: false,
    constrained: false,
    deidentify: true,
    ...base,
    async complete(prompt: string, o: TransportCallOpts) {
      const f = getFetch();
      const stream = Boolean(o.onText);
      const body: Record<string, unknown> = {
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: o.json || o.task === 'translate' || o.task === 'extract' ? 0 : 0.4,
        stream,
      };
      // JSON mode forces an object, so only ask for it where the reply is an object (translation); lists are parsed tolerantly
      if (o.json && o.task === 'translate') body.response_format = { type: 'json_object' };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      let res: Response;
      try {
        res = await f(url, { method: 'POST', headers, body: JSON.stringify(body), signal: o.signal });
      } catch (e) {
        throw networkError(e, who, cfg.baseUrl);
      }
      if (!res.ok) throw await httpError(res, who, [cfg.apiKey]);
      if (stream) {
        let text = '';
        try {
          await readSSE(res, (d) => {
            try {
              const j = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> };
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) {
                text += delta;
                o.onText?.(text);
              }
            } catch {
              /* ignore keep-alives */
            }
          });
        } catch (e) {
          throw networkError(e, who, cfg.baseUrl);
        }
        if (!text.trim()) throw new TransportError(`${who} returned an empty reply.`);
        return text;
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = j.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) throw new TransportError(`${who} returned an empty reply.`);
      return text;
    },
  };
}

// ---------- Anthropic Messages API ----------

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export function anthropicTransport(cfg: AnthropicConfig): Transport {
  const url = `${trimSlash(cfg.baseUrl || 'https://api.anthropic.com')}/v1/messages`;
  const who = 'Anthropic';
  return {
    id: 'anthropic',
    label: `Claude API (${cfg.model})`,
    mode: 'own_key',
    destination: 'cloud',
    compact: false,
    constrained: false,
    deidentify: true,
    async complete(prompt: string, o: TransportCallOpts) {
      const f = getFetch();
      const stream = Boolean(o.onText);
      const body = {
        model: cfg.model,
        max_tokens: o.task === 'translate' || o.task === 'extract' ? 2048 : 1024,
        messages: [{ role: 'user', content: prompt }],
        stream,
      };
      let res: Response;
      try {
        res = await f(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cfg.apiKey,
            'anthropic-version': '2023-06-01',
            // Key stays on the worker's device and is sent only to Anthropic
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify(body),
          signal: o.signal,
        });
      } catch (e) {
        throw networkError(e, who, url);
      }
      if (!res.ok) throw await httpError(res, who, [cfg.apiKey]);
      if (stream) {
        let text = '';
        try {
          await readSSE(res, (d) => {
            try {
              const j = JSON.parse(d) as { type?: string; delta?: { type?: string; text?: string } };
              if (j.type === 'content_block_delta' && j.delta?.text) {
                text += j.delta.text;
                o.onText?.(text);
              }
            } catch {
              /* ignore */
            }
          });
        } catch (e) {
          throw networkError(e, who, url);
        }
        if (!text.trim()) throw new TransportError('Anthropic returned an empty reply.');
        return text;
      }
      const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
      if (!text.trim()) throw new TransportError('Anthropic returned an empty reply.');
      return text;
    },
  };
}

// ---------- Google Gemini ----------

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export function geminiTransport(cfg: GeminiConfig): Transport {
  const root = trimSlash(cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
  const model = cfg.model.replace(/^models\//, '');
  const who = 'Google Gemini';
  return {
    id: 'gemini',
    label: `Gemini (${model})`,
    mode: 'own_key',
    destination: 'cloud',
    compact: false,
    constrained: false,
    deidentify: true,
    async complete(prompt: string, o: TransportCallOpts) {
      const f = getFetch();
      const stream = Boolean(o.onText);
      const url = `${root}/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: o.json || o.task === 'translate' || o.task === 'extract' ? 0 : 0.4,
          ...(o.json ? { responseMimeType: 'application/json' } : {}),
        },
      };
      let res: Response;
      try {
        res = await f(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
          body: JSON.stringify(body),
          signal: o.signal,
        });
      } catch (e) {
        throw networkError(e, who, url);
      }
      if (!res.ok) throw await httpError(res, who, [cfg.apiKey]);
      const pick = (j: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }) =>
        (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      if (stream) {
        let text = '';
        try {
          await readSSE(res, (d) => {
            try {
              const delta = pick(JSON.parse(d));
              if (delta) {
                text += delta;
                o.onText?.(text);
              }
            } catch {
              /* ignore */
            }
          });
        } catch (e) {
          throw networkError(e, who, url);
        }
        if (!text.trim()) throw new TransportError('Gemini returned an empty reply.');
        return text;
      }
      const text = pick(await res.json());
      if (!text.trim()) throw new TransportError('Gemini returned an empty reply.');
      return text;
    },
  };
}
