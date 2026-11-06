/**
 * Device preferences from Settings: appearance, region and units, visits, notifications,
 * messaging, printing and privacy. One small external store kept in browser storage under
 * `gaskin.prefs.v1`, readable from any screen with usePrefs() or getPrefs().
 *
 * Appearance is applied to <html> here (text size, reduced motion, density) so it works on every
 * screen. Formatting helpers (dates, weight, temperature, money) are exported for other screens.
 */
import { useSyncExternalStore } from 'react';
import type { Channel } from '../../types';

export const PREFS_KEY = 'gaskin.prefs.v1';

export type TextSize = 'small' | 'default' | 'large' | 'largest';
export type MotionPref = 'system' | 'reduce' | 'full';
export type Density = 'comfortable' | 'compact';
export type DateFormat = 'd_mon_yyyy' | 'dd_mm_yyyy' | 'mm_dd_yyyy' | 'yyyy_mm_dd';
export type WeightUnit = 'kg' | 'lb';
export type TempUnit = 'c' | 'f';
export type CurrencyDisplay = 'local' | 'local_and_usd' | 'usd';
export type Situation = 'routine' | 'reminder' | 'danger' | 'carer';
export type PaperSize = 'a4' | 'letter';

export interface Prefs {
  textSize: TextSize;
  motion: MotionPref;
  density: Density;
  dateFormat: DateFormat;
  weight: WeightUnit;
  temperature: TempUnit;
  currency: CurrencyDisplay;
  /** Default language for newly registered mothers ('' follows her place) */
  motherLanguage: string;
  /** Days before a due contact that a reminder goes to her */
  visitReminderDays: number;
  /** Remind her the day before a visit too */
  visitReminderDayBefore: boolean;
  notifyDueContacts: boolean;
  notifyReplies: boolean;
  quietHours: boolean;
  quietFrom: string;
  quietTo: string;
  channels: Record<Situation, Channel>;
  senderName: string;
  carerMessages: boolean;
  smsParts: 1 | 2 | 3;
  paper: PaperSize;
  blackAndWhite: boolean;
  /** '' prints in her own language */
  handoutLanguage: string;
  /** Minutes of inactivity before the PIN screen; 0 = never */
  autoLockMinutes: number;
  /** Months to keep records of mothers who left care; 0 = keep until deleted */
  retentionMonths: number;
}

export const DEFAULT_PREFS: Prefs = {
  textSize: 'default',
  motion: 'system',
  density: 'comfortable',
  dateFormat: 'd_mon_yyyy',
  weight: 'kg',
  temperature: 'c',
  currency: 'local',
  motherLanguage: '',
  visitReminderDays: 2,
  visitReminderDayBefore: true,
  notifyDueContacts: true,
  notifyReplies: true,
  quietHours: true,
  quietFrom: '21:00',
  quietTo: '07:00',
  channels: { routine: 'whatsapp', reminder: 'sms', danger: 'sms', carer: 'sms' },
  senderName: '',
  carerMessages: true,
  smsParts: 2,
  paper: 'a4',
  blackAndWhite: true,
  handoutLanguage: '',
  autoLockMinutes: 5,
  retentionMonths: 0,
};

function read(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...p, channels: { ...DEFAULT_PREFS.channels, ...(p.channels ?? {}) } };
  } catch {
    return DEFAULT_PREFS;
  }
}

let current: Prefs = read();
const listeners = new Set<() => void>();

export const prefsStore = {
  get: (): Prefs => current,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(patch: Partial<Prefs>): void {
    current = { ...current, ...patch };
    try {
      globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(current));
    } catch {
      /* storage blocked: the choice still holds for this session */
    }
    applyPrefs(current);
    for (const l of listeners) l();
  },
  reset(): void {
    current = DEFAULT_PREFS;
    try {
      globalThis.localStorage?.removeItem(PREFS_KEY);
    } catch {
      /* ignore */
    }
    applyPrefs(current);
    for (const l of listeners) l();
  },
};

export function getPrefs(): Prefs {
  return current;
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const p = useSyncExternalStore(prefsStore.subscribe, prefsStore.get, prefsStore.get);
  return [p, prefsStore.set];
}

// ---------------------------------------------------------------------------
// Appearance on <html>
// ---------------------------------------------------------------------------

const TEXT_PX: Record<TextSize, string> = { small: '93.75%', default: '100%', large: '112.5%', largest: '125%' };

const STYLE_ID = 'gaskin-prefs-style';
const CSS = `
html[data-motion='reduce'] *, html[data-motion='reduce'] *::before, html[data-motion='reduce'] *::after {
  animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important; scroll-behavior: auto !important;
}
html[data-density='compact'] { --spacing: 0.225rem; }
`;

/** Apply appearance preferences to the document (safe to call before React renders). */
export function applyPrefs(p: Prefs = current): void {
  if (typeof document === 'undefined') return;
  try {
    const root = document.documentElement;
    root.style.fontSize = p.textSize === 'default' ? '' : TEXT_PX[p.textSize];
    if (p.motion === 'system') root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', p.motion);
    root.setAttribute('data-density', p.density);
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  } catch {
    /* never block start-up */
  }
}

applyPrefs(current);

/** True when animation should be avoided, by preference or by the device setting. */
export function prefersReducedMotion(): boolean {
  if (current.motion === 'reduce') return true;
  if (current.motion === 'full') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers for other screens
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** A date in the chosen format, e.g. 9 Nov 2026, 09/11/2026, 11/09/2026 or 2026-11-09. */
export function formatDatePref(iso: string, fmt: DateFormat = current.dateFormat): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  switch (fmt) {
    case 'dd_mm_yyyy':
      return `${pad(day)}/${pad(m + 1)}/${y}`;
    case 'mm_dd_yyyy':
      return `${pad(m + 1)}/${pad(day)}/${y}`;
    case 'yyyy_mm_dd':
      return `${y}-${pad(m + 1)}-${pad(day)}`;
    default:
      return `${day} ${MONTHS[m]} ${y}`;
  }
}

export function formatWeight(kg: number, unit: WeightUnit = current.weight): string {
  return unit === 'lb' ? `${(kg * 2.20462).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;
}

export function formatTemperature(c: number, unit: TempUnit = current.temperature): string {
  return unit === 'f' ? `${((c * 9) / 5 + 32).toFixed(1)} °F` : `${c.toFixed(1)} °C`;
}

/** Money in the chosen display: local only, local with US dollars, or US dollars only. */
export function formatMoney(local: number, currencyCode: string, usd?: number, display: CurrencyDisplay = current.currency): string {
  const fmt = (v: number, code: string) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code, maximumFractionDigits: v < 10 ? 2 : 0 }).format(v);
    } catch {
      return `${code} ${v.toFixed(2)}`;
    }
  };
  if (display === 'usd' && usd !== undefined) return fmt(usd, 'USD');
  if (display === 'local_and_usd' && usd !== undefined) return `${fmt(local, currencyCode)} (${fmt(usd, 'USD')})`;
  return fmt(local, currencyCode);
}

/** Characters allowed in one SMS message at the chosen length (GSM-7: 160, then 153 per part). */
export function smsCharLimit(parts: 1 | 2 | 3 = current.smsParts): number {
  return parts === 1 ? 160 : parts * 153;
}

/** Inside quiet hours now (danger alerts ignore quiet hours). */
export function inQuietHours(at: Date = new Date(), p: Prefs = current): boolean {
  if (!p.quietHours) return false;
  const mins = at.getHours() * 60 + at.getMinutes();
  const [fh, fm] = p.quietFrom.split(':').map(Number);
  const [th, tm] = p.quietTo.split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? mins >= from && mins < to : mins >= from || mins < to;
}
