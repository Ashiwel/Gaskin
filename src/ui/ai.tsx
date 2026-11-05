/**
 * UI adapter for the AI layer. Everything the AI module offers beyond the
 * core contract (settings, privacy preview, copy-and-paste mode, audit log)
 * is looked up defensively so the app keeps working without it.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import * as AI from '../ai';
import * as Privacy from '../privacy';
import type { AIProvider } from '../ai';
import { IChevron, IShield } from './icons';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...a: any[]) => unknown;
const ai = AI as unknown as Record<string, unknown>;
const priv = Privacy as unknown as Record<string, unknown>;
function fn<T extends AnyFn>(name: string): T | undefined {
  const f = (ai[name] ?? priv[name]) as T | undefined;
  return typeof f === 'function' ? f : undefined;
}

export interface UIStatus {
  provider: string;
  label: string;
  live: boolean;
  lastError?: string;
  mode?: string;
}

const fallbackStatus: UIStatus = { provider: 'template', label: 'Offline templates', live: false };
type StatusStore = { get: () => UIStatus; subscribe: (f: () => void) => () => void };
function statusStore(): StatusStore {
  const s = ai.aiStatus as StatusStore | undefined;
  if (s && typeof s.get === 'function' && typeof s.subscribe === 'function') return s;
  return { get: () => fallbackStatus, subscribe: () => () => {} };
}

export function useAIStatus(): UIStatus {
  const s = statusStore();
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

let providerPromise: Promise<AIProvider> | null = null;
let providerEpoch = 0;
const epochListeners = new Set<() => void>();

export function refreshProvider() {
  providerPromise = null;
  providerEpoch += 1;
  epochListeners.forEach((l) => l());
}

export function getProvider(): Promise<AIProvider> {
  if (!providerPromise) {
    const p: Promise<AIProvider> = AI.getAIProvider().catch((err: unknown) => {
      providerPromise = null;
      throw err;
    });
    providerPromise = p;
    return p;
  }
  return providerPromise;
}

export function useProvider(): AIProvider | null {
  const [p, setP] = useState<AIProvider | null>(null);
  const [epoch, setEpoch] = useState(providerEpoch);
  useEffect(() => {
    const l = () => setEpoch(providerEpoch);
    epochListeners.add(l);
    return () => {
      epochListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    getProvider()
      .then((x) => alive && setP(x))
      .catch(() => alive && setP(null));
    return () => {
      alive = false;
    };
  }, [epoch]);
  return p;
}

export function validate(text: string, ...rest: Parameters<typeof AI.validateAIText> extends [string, ...infer R] ? R : never) {
  try {
    return AI.validateAIText(text, ...rest);
  } catch {
    return { ok: true, issues: [] as string[] };
  }
}

// ---------- Settings ----------

export type AIMode = 'auto' | 'none' | 'claude_here' | 'own_key' | 'on_device' | 'any_app' | 'mcp';

export interface UIProviderOption {
  id: string;
  mode?: string;
  label?: string;
  [k: string]: unknown;
}

export function providerOptions(): UIProviderOption[] {
  const opts = ai.PROVIDER_OPTIONS;
  return Array.isArray(opts) ? (opts as UIProviderOption[]) : [];
}

export function getSettings(): Record<string, unknown> | null {
  const g = fn<() => unknown>('getAISettings');
  try {
    return (g?.() as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/** Apply settings. Returns an error message in plain English, or null when applied. */
export function configure(settings: Record<string, unknown>): string | null {
  const c = fn<(s: unknown) => unknown>('configureAI');
  if (!c) return 'AI settings are not available in this build.';
  try {
    c(settings);
    refreshProvider();
    return null;
  } catch (e) {
    return (e as Error)?.message || 'Those settings are incomplete.';
  }
}

export function hasSettingsSupport(): boolean {
  return Boolean(fn('configureAI'));
}

// ---------- Privacy preview ----------

export type AITask = 'personalise' | 'translate' | 'explain' | 'suggest' | 'extract';

export interface PreviewOut {
  text: string;
  removed?: string[];
  categories?: string[];
  provider?: string;
  wouldSend?: boolean;
  bytes?: number;
}

export function previewText(task: AITask, args: Record<string, unknown>): PreviewOut | null {
  const p = fn<(t: string, a: unknown) => unknown>('previewForAI');
  if (!p) return null;
  try {
    const out = p(task, args) as unknown;
    if (typeof out === 'string') return { text: out };
    if (out && typeof out === 'object') {
      const o = out as Record<string, unknown>;
      const text = (o.text ?? o.prompt ?? o.preview ?? '') as string;
      const removedRaw = o.removed ?? o.categories ?? o.redactions;
      const removed = Array.isArray(removedRaw)
        ? (removedRaw as unknown[]).map((r) => (typeof r === 'string' ? r : String((r as Record<string, unknown>).category ?? (r as Record<string, unknown>).label ?? ''))).filter(Boolean)
        : undefined;
      return {
        text: typeof text === 'string' ? text : JSON.stringify(text, null, 2),
        removed,
        categories: Array.isArray(o.categories) && removedRaw !== o.categories ? (o.categories as unknown[]).map(String) : undefined,
        provider: typeof o.provider === 'string' ? o.provider : undefined,
        wouldSend: typeof o.wouldSend === 'boolean' ? o.wouldSend : undefined,
        bytes: typeof o.bytes === 'number' ? o.bytes : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Highlight placeholder tokens like [NAME], <PLACE>, {date} so the reader sees what was removed. */
function highlight(text: string): ReactNode[] {
  const parts = text.split(/(\[[A-Z_ ]{2,}[0-9]*\]|<[A-Z_ ]{2,}[0-9]*>|\{[A-Z_ ]{2,}[0-9]*\})/g);
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
}

const REMOVED_LABEL: Record<string, string> = {
  name: 'names',
  names: 'names',
  phone: 'phone numbers',
  email: 'email addresses',
  id: 'ID numbers',
  address: 'addresses',
  place: 'places',
  community: 'village or community',
  facility: 'clinic names',
  date: 'dates',
  dates: 'dates',
  age: 'exact age',
};

export function WhatAISees({ task, args, mode }: { task: AITask; args: Record<string, unknown>; mode?: string }) {
  const [open, setOpen] = useState(false);
  const status = useAIStatus();
  const preview = open ? previewText(task, args) : null;
  const off = preview?.wouldSend === false || status.provider === 'none' || mode === 'none';
  return (
    <details className="sees" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <IShield />
        What the AI sees
        <IChevron className="chev" width={14} height={14} />
      </summary>
      <div className="inner">
        <p className="small soft">
          {status.provider === 'none' || mode === 'none'
            ? 'AI is switched off, so nothing leaves this phone. Gaskin uses its own templates instead.'
            : off
              ? 'No AI service is connected, so nothing leaves this phone. If one were, this is exactly what it would receive.'
              : 'Names, phone numbers, places and dates are removed before anything leaves this phone.'}
        </p>
        {preview ? (
          <>
            {preview.removed && preview.removed.length ? (
              <div className="chips">
                {Array.from(new Set(preview.removed.map((r) => REMOVED_LABEL[r] ?? r.replace(/_/g, ' ')))).map((r) => (
                  <span key={r} className="chip green">
                    Removed {r}
                  </span>
                ))}
              </div>
            ) : null}
            <pre aria-label={off ? 'De-identified context' : 'Text that would be sent'}>{highlight(preview.text)}</pre>
            {!off && (preview.provider || preview.bytes) ? (
              <p className="tiny muted">
                {preview.provider ? `Goes to: ${preview.provider}. ` : ''}
                {preview.bytes ? `${preview.bytes.toLocaleString('en-GB')} bytes.` : ''}
              </p>
            ) : null}
          </>
        ) : open ? (
          <p className="small muted">The preview is not available on this device. Only the plan items and stage are shared, never her name or number.</p>
        ) : null}
      </div>
    </details>
  );
}

export function AIBadge() {
  const s = useAIStatus();
  const off = s.provider === 'none';
  return (
    <span className={`ai-badge${s.live ? ' live' : off ? ' off' : ''}`} title={s.lastError ? `Last live attempt failed: ${s.lastError}` : undefined}>
      <i />
      {s.label || (s.live ? 'Live AI' : 'Templates')}
    </span>
  );
}

// ---------- Manual (copy and paste) mode ----------

export interface ManualRequest {
  id: string;
  task?: string;
  prompt: string;
  instructions?: string;
  expects?: string;
}

export function onManual(listener: (r: ManualRequest) => void): () => void {
  const sub = fn<(l: (r: unknown) => void) => unknown>('onManualRequest');
  if (!sub) return () => {};
  try {
    const off = sub((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      listener({
        id: String(r.id ?? ''),
        task: (r.task ?? r.op ?? r.kind) as string | undefined,
        prompt: String(r.prompt ?? r.text ?? ''),
        instructions: typeof r.instructions === 'string' ? r.instructions : undefined,
        expects: typeof r.expects === 'string' ? r.expects : undefined,
      });
    });
    return typeof off === 'function' ? (off as () => void) : () => {};
  } catch {
    return () => {};
  }
}

export function submitManual(id: string, reply: string | null): boolean {
  const s = fn<(id: string, reply: string | null) => unknown>('submitManualReply');
  if (!s) return false;
  try {
    s(id, reply);
    return true;
  } catch {
    return false;
  }
}

export interface AuditRow {
  at: string;
  task: string;
  provider: string;
  categories: string[];
  size: number;
  destination?: string;
  removed: string[];
}

export function auditLog(): AuditRow[] {
  const g = fn<() => unknown>('getAIAuditLog');
  if (!g) return [];
  try {
    const rows = g();
    if (!Array.isArray(rows)) return [];
    return rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      const cats = (r.categories ?? r.dataCategories ?? r.fields ?? []) as unknown;
      return {
        at: String(r.at ?? r.time ?? r.timestamp ?? ''),
        task: String(r.task ?? r.op ?? ''),
        provider: String(r.provider ?? r.providerLabel ?? r.mode ?? ''),
        categories: Array.isArray(cats) ? (cats as unknown[]).map(String) : [],
        size: Number(r.bytes ?? r.size ?? r.chars ?? 0),
        destination: r.destination ? String(r.destination) : undefined,
        removed: Array.isArray(r.removed) ? (r.removed as unknown[]).map(String) : [],
      };
    });
  } catch {
    return [];
  }
}
