/**
 * Browser storage with a memory fallback. Every access is wrapped: storage can be
 * missing (tests, private windows) or throw (blocked site data), and Gaskin must work regardless.
 */
const memory = new Map<string, string>();

function store(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key) ?? memory.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    store()?.setItem(key, raw);
  } catch {
    /* memory copy is enough for this session */
  }
}

/** Test helper */
export function _clearStorage(keys: string[]): void {
  for (const k of keys) {
    memory.delete(k);
    try {
      store()?.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}
