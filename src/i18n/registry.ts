import type { LanguagePack, PackCode, PackSummary } from './types';
import { UI_KEYS } from './uiKeys';
import { englishTemplates } from './templates';
import { readJSON, writeJSON } from './storage';
import { en } from './packs/en';
import { pcm } from './packs/pcm';
import { ha } from './packs/ha';
import { yo } from './packs/yo';
import { ig } from './packs/ig';
import { sw } from './packs/sw';
import { tw } from './packs/tw';
import { ar } from './packs/ar';
import { fr } from './packs/fr';
import { bin, urh, luo, ee, dag, ff } from './packs/community';

/**
 * Packs are bundled with the demo. The install API is asynchronous and reports progress,
 * so a real one-time download (and an offline cache) can replace the simulation without
 * changing callers.
 */
export const PACKS: Record<PackCode, LanguagePack> = { en, pcm, ha, yo, ig, sw, tw, ar, ff, fr, bin, urh, luo, ee, dag };

/** Display order: English first, then by launch country, Pidgin and French last */
export const PACK_ORDER: PackCode[] = ['en', 'ha', 'yo', 'ig', 'bin', 'urh', 'ff', 'ar', 'sw', 'luo', 'tw', 'ee', 'dag', 'pcm', 'fr'];

export const INSTALLED_KEY = 'gaskin.i18n.installed.v1';

export function isPackCode(x: string): x is PackCode {
  return Object.prototype.hasOwnProperty.call(PACKS, x);
}

export function getPack(code: PackCode): LanguagePack {
  return PACKS[code] ?? PACKS.en;
}

export function allPacks(): LanguagePack[] {
  return PACK_ORDER.map((c) => PACKS[c]);
}

const sizeCache = new Map<PackCode, number>();
export function packSizeBytes(code: PackCode): number {
  let n = sizeCache.get(code);
  if (n === undefined) {
    n = new TextEncoder().encode(JSON.stringify(getPack(code))).length;
    sizeCache.set(code, n);
  }
  return n;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${Math.round(n / 102.4) / 10} KB`;
}

export function packCoverage(code: PackCode): { mother: number; ui: number } {
  const p = getPack(code);
  const motherKeys = Object.keys(englishTemplates());
  const mother = motherKeys.filter((k) => p.mother[k] !== undefined).length / motherKeys.length;
  const ui = UI_KEYS.filter((k) => p.ui[k] !== undefined).length / UI_KEYS.length;
  return { mother, ui };
}

// ---------- Install state ----------

const listeners = new Set<() => void>();
let installVersion = 0;
const inFlight = new Map<PackCode, Promise<LanguagePack>>();
const progress = new Map<PackCode, number>();

function emit() {
  installVersion++;
  listeners.forEach((l) => l());
}

export function installedLanguages(): PackCode[] {
  const saved = readJSON<string[]>(INSTALLED_KEY, []).filter(isPackCode);
  return ['en', ...saved.filter((c) => c !== 'en')];
}

export function isInstalled(code: PackCode): boolean {
  return installedLanguages().includes(code);
}

/** Progress 0..1 of a download in flight, or undefined */
export function installProgress(code: PackCode): number | undefined {
  return progress.get(code);
}

export interface InstallOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Simulated duration in ms (0 in tests) */
  durationMs?: number;
}

/**
 * Download a pack once and keep it for offline use. Resolves with the pack.
 * In the demo the pack is bundled, so this simulates the download with progress.
 */
export function installPack(code: PackCode, opts: InstallOptions = {}): Promise<LanguagePack> {
  if (isInstalled(code)) {
    opts.onProgress?.(1);
    return Promise.resolve(getPack(code));
  }
  const existing = inFlight.get(code);
  if (existing) return existing;
  const total = opts.durationMs ?? Math.min(1800, 300 + packSizeBytes(code) / 40);
  const steps = 10;
  const p = new Promise<LanguagePack>((resolve, reject) => {
    let i = 0;
    const tick = () => {
      if (opts.signal?.aborted) {
        progress.delete(code);
        inFlight.delete(code);
        emit();
        reject(Object.assign(new Error('Download cancelled'), { name: 'AbortError' }));
        return;
      }
      i++;
      const f = Math.min(1, i / steps);
      progress.set(code, f);
      opts.onProgress?.(f);
      emit();
      if (i >= steps) {
        const saved = installedLanguages();
        if (!saved.includes(code)) writeJSON(INSTALLED_KEY, [...saved, code]);
        progress.delete(code);
        inFlight.delete(code);
        emit();
        resolve(getPack(code));
        return;
      }
      if (total <= 0) queueMicrotask(tick);
      else setTimeout(tick, total / steps);
    };
    progress.set(code, 0);
    opts.onProgress?.(0);
    emit();
    if (total <= 0) queueMicrotask(tick);
    else setTimeout(tick, total / steps);
  });
  inFlight.set(code, p);
  return p;
}

export function uninstallPack(code: PackCode): void {
  if (code === 'en') return;
  writeJSON(
    INSTALLED_KEY,
    installedLanguages().filter((c) => c !== code && c !== 'en'),
  );
  emit();
}

export function summarisePack(code: PackCode): PackSummary {
  const p = getPack(code);
  const cov = packCoverage(code);
  return {
    code: p.code,
    name: p.name,
    nativeName: p.nativeName,
    direction: p.direction,
    status: p.status,
    version: p.version,
    regions: p.regions,
    note: p.note,
    sizeBytes: packSizeBytes(code),
    motherCoverage: cov.mother,
    uiCoverage: cov.ui,
    installed: isInstalled(code),
  };
}

/** For useSyncExternalStore: re-render when installs change */
export const packStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getVersion(): number {
    return installVersion;
  },
};
