import type { AIStatus } from './types';

type Listener = (s: AIStatus) => void;

let current: AIStatus = { provider: 'template', label: 'Offline templates', live: false };
const listeners = new Set<Listener>();

/** Current AI status snapshot for the UI badge */
export function getAIStatus(): AIStatus {
  return current;
}

/** Subscribe to status changes; returns an unsubscribe function. Fires immediately with the current value. */
export function onAIStatus(listener: Listener): () => void {
  listeners.add(listener);
  try {
    listener(current);
  } catch {
    /* listener errors are the listener's problem */
  }
  return () => {
    listeners.delete(listener);
  };
}

export function setAIStatus(patch: Partial<AIStatus>): void {
  current = { ...current, ...patch, at: new Date().toISOString() };
  for (const l of listeners) {
    try {
      l(current);
    } catch {
      /* ignore */
    }
  }
}

/** Minimal observable for UIs that prefer `aiStatus.get()` / `aiStatus.subscribe()` (works with useSyncExternalStore) */
export const aiStatus = {
  get: getAIStatus,
  subscribe: (fn: () => void) => onAIStatus(() => fn()),
};

/** Test helper */
export function _resetAIStatus(): void {
  current = { provider: 'template', label: 'Offline templates', live: false };
}
