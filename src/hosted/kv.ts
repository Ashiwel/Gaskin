/**
 * Namespaced key-value storage for the hosted backends, on top of
 * src/storage's KV (IndexedDB, then localStorage, then memory). Nothing here
 * throws: storage can be blocked in private windows, previews and sandboxed
 * frames, and the app must still run.
 */
import { openKV as openStorageKV, memoryKV, safeLocalStorage, type KV as StorageKV } from '../storage/kv';

export interface KV {
  readonly kind: StorageKV['kind'];
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export function prefixed(base: StorageKV, prefix: string): KV {
  return {
    kind: base.kind,
    get: <T>(k: string) => base.get<T>(prefix + k).catch(() => undefined),
    set: async (k, v) => {
      await base.set(prefix + k, JSON.parse(JSON.stringify(v ?? null))).catch(() => false);
    },
    del: (k) => base.del(prefix + k).catch(() => undefined),
  };
}

let shared: Promise<StorageKV> | null = null;

/** Open (once) the best store available, namespaced by prefix */
export async function openKV(prefix = 'gaskin.hosted.'): Promise<KV> {
  if (!shared) shared = openStorageKV().catch(() => memoryKV());
  return prefixed(await shared, prefix);
}

/** For tests */
export function createMemoryKV(): KV {
  return prefixed(memoryKV(), '');
}

/** Synchronous read for small values (device id, server URL, session token) */
export function readLocal(key: string): string | null {
  try {
    return safeLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    const ls = safeLocalStorage();
    if (value == null) ls?.removeItem(key);
    else ls?.setItem(key, value);
  } catch {
    /* blocked */
  }
}
