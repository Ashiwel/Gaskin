/**
 * UI adapter for the AI layer. Everything the AI module offers beyond the
 * core contract (settings, privacy preview, copy-and-paste mode, audit log)
 * is looked up defensively so the app keeps working without it.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import * as AI from '../ai';
import * as Privacy from '../privacy';
import type { AIProvider } from '../ai';
import { Check, ChevronDown, Lock01, Send01, ShieldTick } from '@untitledui/icons';

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
  return parts.map((p, i) =>
    i % 2 ? (
      <mark key={i} className="rounded bg-brand-primary px-0.5 font-semibold text-brand-secondary">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
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

export function removedLabels(removed?: string[]): string[] {
  return Array.from(new Set((removed ?? []).map((r) => REMOVED_LABEL[r] ?? r.replace(/_/g, ' '))));
}

/** What stays on the phone: her real details, as the worker knows them. */
export interface LocalFacts {
  name?: string;
  phone?: string;
  place?: string;
  facility?: string;
  worker?: string;
  age?: number;
}

/**
 * "What the AI sees". compact: a disclosure under a form (plan, record). side: two columns, what
 * stays on this phone and what the AI would receive, with placeholders highlighted.
 */
export function WhatAISees({ task, args, mode, layout = 'compact', local, defaultOpen }: { task: AITask; args: Record<string, unknown>; mode?: string; layout?: 'compact' | 'side'; local?: LocalFacts; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const status = useAIStatus();
  const preview = open ? previewText(task, args) : null;
  const aiOff = status.provider === 'none' || mode === 'none';
  const off = preview?.wouldSend === false || aiOff;
  const lede = aiOff
    ? 'AI is switched off, so nothing leaves this phone. Gaskin uses its own templates instead.'
    : off
      ? 'No AI service is connected, so nothing leaves this phone. If one were, this is exactly what it would receive.'
      : 'Names, phone numbers, places and dates are removed before anything leaves this phone.';
  const removed = removedLabels(preview?.removed);
  const localRows: Array<[string, string]> = local
    ? ([
        ['Her name', local.name],
        ['Phone', local.phone],
        ['Where she lives', local.place],
        ['Clinic', local.facility],
        ['Health worker', local.worker],
        ['Age', local.age ? `${local.age}` : undefined],
      ].filter(([, v]) => Boolean(v)) as Array<[string, string]>)
    : [];
  const body = preview ? (
    layout === 'side' ? (
      <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 rounded-lg bg-secondary p-3 ring-1 ring-secondary">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <Lock01 aria-hidden="true" className="size-3.5" /> Stays on this phone
          </p>
          <dl className="grid gap-1.5 text-sm">
            {localRows.map(([k, v]) => (
              <div key={k} className="flex min-w-0 justify-between gap-3">
                <dt className="shrink-0 text-tertiary">{k}</dt>
                <dd className="truncate text-end font-medium text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {removed.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {removed.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-success-primary px-2 py-0.5 text-xs font-medium text-success-primary">
                  <Check aria-hidden="true" className="size-3" /> Removed {r}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="min-w-0 rounded-lg bg-primary p-3 ring-1 ring-secondary">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <Send01 aria-hidden="true" className="size-3.5" /> {off ? 'Would be sent' : `Sent to ${preview.provider ?? 'the AI'}`}
            {preview.bytes ? <span className="ml-auto font-normal text-tertiary tnum">{preview.bytes.toLocaleString('en-GB')} bytes</span> : null}
          </p>
          <pre aria-label={off ? 'De-identified context' : 'Text that would be sent'} className="max-h-64 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-secondary">
            {highlight(preview.text)}
          </pre>
        </div>
      </div>
    ) : (
      <>
        {removed.length ? (
          <div className="flex flex-wrap gap-1">
            {removed.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-success-primary px-2 py-0.5 text-xs font-medium text-success-primary">
                <Check aria-hidden="true" className="size-3" /> Removed {r}
              </span>
            ))}
          </div>
        ) : null}
        <pre aria-label={off ? 'De-identified context' : 'Text that would be sent'} className="max-h-60 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-secondary">
          {highlight(preview.text)}
        </pre>
        {!off && (preview.provider || preview.bytes) ? (
          <p className="text-xs text-tertiary">
            {preview.provider ? `Goes to: ${preview.provider}. ` : ''}
            {preview.bytes ? `${preview.bytes.toLocaleString('en-GB')} bytes.` : ''}
          </p>
        ) : null}
      </>
    )
  ) : open ? (
    <p className="text-sm text-tertiary">The preview is not available on this device. Only the plan items and stage are shared, never her name or number.</p>
  ) : null;
  return (
    <details data-testid="what-ai-sees" open={open} className="group rounded-xl bg-primary ring-1 ring-secondary" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-secondary [&::-webkit-details-marker]:hidden">
        <ShieldTick aria-hidden="true" className="size-4.5 text-fg-brand-secondary" />
        What the AI sees
        <span className="ml-auto text-xs font-normal text-tertiary">{aiOff ? 'AI off' : off ? 'Nothing sent' : 'De-identified'}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-fg-quaternary transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-secondary px-3.5 py-3">
        <p className="text-sm text-tertiary">{lede}</p>
        {body}
      </div>
    </details>
  );
}

export function AIBadge() {
  const s = useAIStatus();
  const off = s.provider === 'none';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-secondary ring-1 ring-secondary"
      title={s.lastError ? `Last live attempt failed: ${s.lastError}` : undefined}
      data-testid="ai-badge"
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${s.live ? 'bg-success-solid' : off ? 'bg-quaternary' : 'bg-warning-solid'}`} />
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
