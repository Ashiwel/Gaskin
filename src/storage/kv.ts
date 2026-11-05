/**
 * A tiny key-value layer: IndexedDB when it works, localStorage when it does not,
 * memory as a last resort (private windows, blocked storage, sandboxed previews).
 * Every call is wrapped in try/catch; nothing here throws to the caller.
 *
 * IndexedDB is preferred because it holds far more than localStorage (about 5 MB)
 * and can store a folder handle, which localStorage cannot.
 */

export interface KV {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Whether values that are not JSON (folder handles) survive */
  readonly structured: boolean;
}

const DB_NAME = 'gaskin';
const STORE = 'kv';

type IDBFactoryLike = Pick<IDBFactory, 'open'>;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Open the Gaskin database, or null if IndexedDB is missing or refuses (Firefox private mode, sandbox) */
export async function openIDB(factory: IDBFactoryLike | undefined = globalThis.indexedDB, timeoutMs = 3000): Promise<IDBDatabase | null> {
  if (!factory) return null;
  try {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
    };
    return await Promise.race([req(open), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
  } catch {
    return null;
  }
}

export function idbKV(db: IDBDatabase): KV {
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    kind: 'indexeddb',
    structured: true,
    async get<T>(key: string) {
      try {
        return (await req(tx('readonly').get(key))) as T | undefined;
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        await req(tx('readwrite').put(value, key));
        return true;
      } catch {
        return false;
      }
    },
    async del(key) {
      try {
        await req(tx('readwrite').delete(key));
      } catch {
        /* ignore */
      }
    },
  };
}

export function localStorageKV(ls: Storage | undefined = safeLocalStorage()): KV | null {
  if (!ls) return null;
  const P = 'gaskin.kv.';
  return {
    kind: 'localstorage',
    structured: false,
    async get<T>(key: string) {
      try {
        const raw = ls.getItem(P + key);
        return raw == null ? undefined : (JSON.parse(raw) as T);
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        ls.setItem(P + key, JSON.stringify(value));
        return true;
      } catch {
        return false; // quota exceeded or blocked
      }
    },
    async del(key) {
      try {
        ls.removeItem(P + key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    kind: 'memory',
    structured: true,
    async get<T>(key: string) {
      return m.get(key) as T | undefined;
    },
    async set(key, value) {
      m.set(key, value);
      return true;
    },
    async del(key) {
      m.delete(key);
    },
  };
}

/** localStorage, or undefined when access throws (sandboxed iframes, blocked cookies) */
export function safeLocalStorage(): Storage | undefined {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return undefined;
    const k = '__gaskin_probe__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return ls;
  } catch {
    return undefined;
  }
}

/** The best available key-value store */
export async function openKV(opts: { indexedDB?: IDBFactoryLike | null; localStorage?: Storage | null } = {}): Promise<KV> {
  const factory = opts.indexedDB === null ? undefined : (opts.indexedDB ?? globalThis.indexedDB);
  const db = await openIDB(factory);
  if (db) return idbKV(db);
  const ls = opts.localStorage === null ? null : localStorageKV(opts.localStorage ?? safeLocalStorage());
  return ls ?? memoryKV();
}
