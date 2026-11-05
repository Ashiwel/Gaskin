/**
 * The saved setup: a tiny external store so any screen can read the plan with useSetup().
 * Kept in browser storage under 'gaskin.setup.v1'. Every access is guarded.
 */
import { useSyncExternalStore } from 'react';
import type { SetupAnswers, SetupPlan } from './types';

export const SETUP_KEY = 'gaskin.setup.v1';
/** Same key the Settings screen uses, so AI chosen here is restored on the next start */
export const AI_SETTINGS_KEY = 'gaskin.ai-settings.v1';

export interface SavedSetup {
  plan: SetupPlan;
  answers: SetupAnswers;
  completedAt: string;
  /** What actually happened when the plan was applied */
  applied?: { languages: string[]; aiMode: string; aiError?: string; storageMode: string; locationProfileId: string | null };
}

function read(): SavedSetup | null {
  try {
    const raw = globalThis.localStorage?.getItem(SETUP_KEY);
    return raw ? (JSON.parse(raw) as SavedSetup) : null;
  } catch {
    return null;
  }
}

let current: SavedSetup | null = read();
const listeners = new Set<() => void>();

export const setupStore = {
  get(): SavedSetup | null {
    return current;
  },
  set(next: SavedSetup | null): void {
    current = next;
    try {
      if (next) globalThis.localStorage?.setItem(SETUP_KEY, JSON.stringify(next));
      else globalThis.localStorage?.removeItem(SETUP_KEY);
    } catch {
      /* storage blocked: the plan still holds for this session */
    }
    for (const fn of listeners) fn();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** The saved setup, or null before onboarding. Re-renders when it changes. */
export function useSetup(): SavedSetup | null {
  return useSyncExternalStore(setupStore.subscribe, setupStore.get, setupStore.get);
}

export function getSetupPlan(): SetupPlan | null {
  return current?.plan ?? null;
}

/** Whether onboarding has been completed on this device */
export function isSetupDone(): boolean {
  return Boolean(current);
}

/** Forget the setup (Settings > "Run setup again") */
export function resetSetup(): void {
  setupStore.set(null);
}
