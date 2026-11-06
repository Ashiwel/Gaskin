/**
 * Where Gaskin keeps its records, chosen automatically and reported in plain words.
 *
 * Three modes:
 * - 'folder'  Chrome, Edge or Opera on a computer: a folder the worker picks (it can be on a USB stick).
 *             Writes gaskin-data.json after every change, plus rolling timestamped copies in backups/.
 *             The folder handle is remembered in IndexedDB; permission is re-checked on every start.
 * - 'browser' Everything else with working storage: IndexedDB (localStorage if IndexedDB fails).
 * - 'file'    Like 'browser', plus an automatic backup file download every few days, for browsers
 *             that cannot write to folders but where losing browser data is likely (iPhone, Firefox).
 *
 * Every mode also mirrors the latest data into browser storage, so pulling out the USB stick
 * mid-visit loses nothing. Nothing in this module throws to the caller.
 *
 * Usage:
 *   const store = createStore<AppState>({ mode: 'auto' });
 *   const data = await store.load();
 *   store.subscribe((s) => show(s.message)); // "Saved to USB stick GASKIN at 14:02"
 *   store.save(state);
 */
import { openKV, type KV } from './kv';
import { decryptJSON, decryptWithPassphrase, deriveKey, encryptJSON, encryptionSession, isEncrypted, PassphraseError, passphraseProblem, type DataKey, type EncryptedEnvelope } from './crypto';
import { MAX_IMPORT_BYTES } from './validate';

export { openKV, memoryKV, localStorageKV, safeLocalStorage } from './kv';
export {
  deriveKey,
  encryptJSON,
  decryptJSON,
  decryptWithPassphrase,
  isEncrypted,
  passphraseProblem,
  encryptionSession,
  lock as lockEncryption,
  PassphraseError,
  ENCRYPTED_FORMAT,
  MIN_PASSPHRASE_LENGTH,
  DEFAULT_ITERATIONS,
} from './crypto';
export type { DataKey, EncryptedEnvelope } from './crypto';
export { validateImportedState, MAX_IMPORT_BYTES } from './validate';
export type { KV } from './kv';
export { registerPWA, pwaSupport, selfHostedCSP } from './pwa';

export type StorageMode = 'browser' | 'folder' | 'file';

export interface StorageCapabilities {
  indexedDB: boolean;
  localStorage: boolean;
  /** showDirectoryPicker exists and the page is not in a cross-origin frame */
  folderAccess: boolean;
  /** Opened from file:// (USB stick, downloaded file) */
  fromFile: boolean;
  inIframe: boolean;
  /** iOS or iPadOS Safari, where unused site data can be cleared after about seven days */
  ios: boolean;
  mobile: boolean;
  serviceWorker: boolean;
  /** navigator.storage.persist exists */
  persist: boolean;
}

// ---------- File System Access API (not all in lib.dom) ----------

type PermState = 'granted' | 'denied' | 'prompt';
interface DirHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandleLike>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
  removeEntry(name: string): Promise<void>;
  entries?(): AsyncIterableIterator<[string, { kind: string; name: string }]>;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermState>;
}
interface FileHandleLike {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
type DirPicker = (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>;

// ---------- Status ----------

export type StoreState = 'idle' | 'loading' | 'saving' | 'saved' | 'needs_folder' | 'needs_permission' | 'needs_passphrase' | 'error';

export interface StoreStatus {
  mode: StorageMode;
  state: StoreState;
  /** Plain sentence for the status line, e.g. "Saved to USB stick GASKIN at 14:02" */
  message: string;
  savedAt?: string;
  /** Folder name, or 'this browser' */
  where: string;
  lastBackupAt?: string;
  /** A backup file is due (browser mode shows a reminder; file mode downloads one) */
  backupDue: boolean;
  /** The browser kept data even under storage pressure (navigator.storage.persist) */
  persisted?: boolean;
  kvKind?: KV['kind'];
  /** Files and the browser copy are encrypted with a passphrase */
  encrypted?: boolean;
  /** Encrypted, and the passphrase has not been entered in this session */
  locked?: boolean;
}

export interface GaskinStore<T> {
  readonly mode: StorageMode;
  /** Latest saved data from the chosen place; null on first run */
  load(): Promise<T | null>;
  /** Save (coalesced: rapid calls write once with the latest data) */
  save(data: T): Promise<StoreStatus>;
  /** Write any coalesced save at once (the page is closing or being hidden). */
  flushNow?(): Promise<StoreStatus>;
  subscribe(fn: (s: StoreStatus) => void): () => void;
  status(): StoreStatus;
  /** Folder mode: ask the worker to pick a folder. Call from a click. */
  chooseFolder(): Promise<boolean>;
  /** Folder mode: re-ask permission for the remembered folder. Call from a click. */
  reconnectFolder(): Promise<boolean>;
  /** Download a backup file now */
  exportFile(): Promise<boolean>;
  /** Read a backup file the worker picked; returns the data (and saves it) or throws a plain-English Error */
  importFile(file: Blob): Promise<T>;
  /** Switch mode (e.g. after onboarding). Data is carried over. */
  setMode(mode: StorageMode): Promise<void>;
  /**
   * Turn on passphrase encryption: re-writes the browser copy and the folder file encrypted.
   * Throws a plain-English PassphraseError for a weak passphrase. Rolling backups written before
   * this stay in plain text until they roll off; tell the worker to delete old backups.
   */
  enableEncryption(passphrase: string): Promise<void>;
  /** Turn encryption off (needs the store unlocked). Writes plain text from now on. */
  disableEncryption(): Promise<void>;
  /** Enter the passphrase for this session. Resolves the decrypted data; throws PassphraseError when wrong. */
  unlock(passphrase: string): Promise<T | null>;
  /** Forget the key in memory; saves are refused until unlock() again. */
  lock(): void;
  /** Is encryption on for this store? */
  isEncrypted(): Promise<boolean>;
}

export interface StoreOptions {
  /** 'auto' picks folder only when a folder was chosen before; otherwise browser, or file on iPhone */
  mode?: StorageMode | 'auto';
  /** Days between automatic backup files (file mode) or reminders (browser mode). Default 3. */
  backupEveryDays?: number;
  /** Rolling copies kept in the folder's backups/ directory. Default 10. */
  keepBackups?: number;
  /** At most one rolling copy per this many minutes. Default 60. */
  backupIntervalMin?: number;
  /** How to describe the folder: 'usb' says "USB stick" */
  describeAs?: 'usb' | 'folder';
  saveDebounceMs?: number;
  /** Test seams */
  deps?: Partial<StoreDeps>;
}

export interface StoreDeps {
  kv: KV;
  now: () => Date;
  showDirectoryPicker: DirPicker | undefined;
  download: (fileName: string, text: string) => boolean;
  caps: StorageCapabilities;
  persist: () => Promise<boolean>;
}

const DATA_FILE = 'gaskin-data.json';
const BACKUP_DIR = 'backups';
const K = { data: 'data', handle: 'folderHandle', mode: 'mode', lastBackup: 'lastBackupAt', encrypted: 'encryptionOn' } as const;

interface Envelope<T> {
  app: 'gaskin';
  format: 1;
  savedAt: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export function detectCapabilities(): StorageCapabilities {
  const w = globalThis as unknown as Window & typeof globalThis;
  let inIframe = false;
  try {
    inIframe = typeof window !== 'undefined' && window.top !== window.self;
  } catch {
    inIframe = true; // cross-origin parent
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  let ls = false;
  try {
    const s = w.localStorage;
    s.setItem('__g', '1');
    s.removeItem('__g');
    ls = true;
  } catch {
    ls = false;
  }
  const picker = typeof (w as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
  return {
    indexedDB: typeof w.indexedDB !== 'undefined',
    localStorage: ls,
    folderAccess: picker && !inIframe,
    fromFile: typeof location !== 'undefined' && location.protocol === 'file:',
    inIframe,
    ios,
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || ios,
    serviceWorker: Boolean(nav && 'serviceWorker' in nav),
    persist: Boolean(nav?.storage && typeof nav.storage.persist === 'function'),
  };
}

/** The mode to use when nothing was chosen yet */
export function chooseMode(caps: StorageCapabilities, remembered?: StorageMode | null): StorageMode {
  if (remembered === 'folder' && caps.folderAccess) return 'folder';
  if (remembered === 'browser' || remembered === 'file') return remembered;
  // iPhones clear site data after weeks unused, and file:// pages on most browsers get throwaway storage:
  // both need automatic backup files.
  if (caps.ios || (caps.fromFile && !caps.folderAccess)) return 'file';
  if (!caps.indexedDB && !caps.localStorage) return 'file';
  return 'browser';
}

function defaultDownload(fileName: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

async function defaultPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const stamp = (d: Date) => d.toISOString().slice(0, 16).replace(/:/g, '-'); // 2026-11-05T14-02
const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
};

function parseJSONFile(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('This file is not a Gaskin backup. It could not be read.');
  }
}

function unwrapParsed<T>(parsed: unknown): T {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as Envelope<T>).app === 'gaskin' && 'data' in (parsed as object)) return (parsed as Envelope<T>).data;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T; // older backups were the raw state
  throw new Error('This file is not a Gaskin backup.');
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export async function createStore<T>(opts: StoreOptions = {}): Promise<GaskinStore<T>> {
  const caps = opts.deps?.caps ?? detectCapabilities();
  const kv = opts.deps?.kv ?? (await openKV());
  const d: StoreDeps = {
    kv,
    caps,
    now: opts.deps?.now ?? (() => new Date()),
    showDirectoryPicker: 'showDirectoryPicker' in (opts.deps ?? {}) ? opts.deps!.showDirectoryPicker : caps.folderAccess ? ((globalThis as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker?.bind(globalThis)) : undefined,
    download: opts.deps?.download ?? defaultDownload,
    persist: opts.deps?.persist ?? defaultPersist,
  };
  const everyDays = opts.backupEveryDays ?? 3;
  const keep = opts.keepBackups ?? 10;
  const intervalMs = (opts.backupIntervalMin ?? 60) * 60_000;
  const noun = opts.describeAs === 'usb' ? 'USB stick' : 'folder';

  const remembered = (await kv.get<StorageMode>(K.mode)) ?? null;
  let mode: StorageMode = opts.mode && opts.mode !== 'auto' ? opts.mode : chooseMode(caps, remembered);
  if (mode === 'folder' && !d.showDirectoryPicker) mode = chooseMode({ ...caps, folderAccess: false }, null);

  let handle: DirHandle | null = null;
  let lastRollingAt = 0;
  let lastBackupAt = (await kv.get<string>(K.lastBackup)) ?? undefined;
  let persisted: boolean | undefined;
  const listeners = new Set<(s: StoreStatus) => void>();

  const backupDue = () => !lastBackupAt || d.now().getTime() - new Date(lastBackupAt).getTime() >= everyDays * 86_400_000;
  const browserWhere = 'this browser';
  let status: StoreStatus = { mode, state: 'idle', message: 'Not saved yet', where: mode === 'folder' ? noun : browserWhere, backupDue: backupDue(), kvKind: kv.kind, lastBackupAt };

  const emit = (patch: Partial<StoreStatus>) => {
    status = { ...status, mode, backupDue: backupDue(), lastBackupAt, persisted, kvKind: kv.kind, encrypted: encryptionOn, locked: encryptionOn && !encryptionSession.get(), ...patch };
    for (const fn of listeners) {
      try {
        fn(status);
      } catch {
        /* a broken listener must not stop saving */
      }
    }
  };

  // ----- folder helpers -----

  async function permission(h: DirHandle, ask: boolean): Promise<PermState> {
    try {
      const q = await h.queryPermission?.({ mode: 'readwrite' });
      if (q === 'granted' || !h.queryPermission) return 'granted';
      if (!ask || !h.requestPermission) return q ?? 'prompt';
      return await h.requestPermission({ mode: 'readwrite' });
    } catch {
      return 'denied';
    }
  }

  /** The folder file, decrypted when needed. 'locked' when it is encrypted and no key is in memory. */
  async function readFolder(h: DirHandle): Promise<T | null | 'locked'> {
    let parsed: unknown;
    try {
      const fh = await h.getFileHandle(DATA_FILE);
      parsed = parseJSONFile(await (await fh.getFile()).text());
    } catch {
      return null; // no file yet, or unreadable
    }
    if (isEncrypted(parsed)) {
      const k = await keyFor(parsed);
      if (!k) return 'locked';
      try {
        return unwrapParsed<T>(await decryptJSON(parsed, k));
      } catch {
        return 'locked';
      }
    }
    try {
      return unwrapParsed<T>(parsed);
    } catch {
      return null;
    }
  }

  // ----- encryption helpers -----

  let encryptionOn = (await kv.get<boolean>(K.encrypted)) === true;
  /** The session key if it matches this envelope's salt (a file from another stick has its own salt) */
  async function keyFor(env: EncryptedEnvelope): Promise<DataKey | null> {
    const k = encryptionSession.get();
    if (!k) return null;
    const salt = atob(env.kdf.salt);
    const mine = String.fromCharCode(...k.salt);
    return salt === mine && env.kdf.iterations === k.iterations ? k : null;
  }
  /** Text to write to a file: the envelope, encrypted when encryption is on */
  async function sealed(env: Envelope<T>): Promise<string | null> {
    if (!encryptionOn) return JSON.stringify(env);
    const k = encryptionSession.get();
    if (!k) return null;
    return JSON.stringify(await encryptJSON(env, k));
  }
  async function readLocal(): Promise<Envelope<T> | null | 'locked'> {
    const local = await kv.get<Envelope<T> | EncryptedEnvelope | T>(K.data);
    if (!local) return null;
    if (isEncrypted(local)) {
      const k = await keyFor(local);
      if (!k) return 'locked';
      try {
        return await decryptJSON<Envelope<T>>(local, k);
      } catch {
        return 'locked';
      }
    }
    return typeof local === 'object' && (local as Envelope<T>).app === 'gaskin' ? (local as Envelope<T>) : ({ app: 'gaskin', format: 1, savedAt: '', data: local as T } as Envelope<T>);
  }

  async function writeText(dir: DirHandle, name: string, text: string): Promise<void> {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  async function rolling(h: DirHandle, text: string): Promise<void> {
    const now = d.now();
    if (now.getTime() - lastRollingAt < intervalMs) return;
    try {
      const dir = await h.getDirectoryHandle(BACKUP_DIR, { create: true });
      await writeText(dir, `gaskin-data-${stamp(now)}.json`, text);
      lastRollingAt = now.getTime();
      lastBackupAt = now.toISOString();
      await kv.set(K.lastBackup, lastBackupAt);
      if (dir.entries) {
        const names: string[] = [];
        for await (const [name, e] of dir.entries()) if (e.kind === 'file' && /^gaskin-data-.*\.json$/.test(name)) names.push(name);
        names.sort(); // timestamps sort as text
        for (const old of names.slice(0, Math.max(0, names.length - keep))) await dir.removeEntry(old).catch(() => undefined);
      }
    } catch {
      /* a failed rolling copy never blocks the main save */
    }
  }

  async function rememberedHandle(): Promise<DirHandle | null> {
    if (handle) return handle;
    const h = await kv.get<DirHandle>(K.handle);
    return h && typeof h === 'object' && h.kind === 'directory' ? h : null;
  }

  // ----- saving -----

  let pending: T | undefined;
  let hasPending = false;
  let inFlight: Promise<StoreStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fire: (() => void) | null = null;

  async function writeNow(data: T): Promise<StoreStatus> {
    const now = d.now();
    const env: Envelope<T> = { app: 'gaskin', format: 1, savedAt: now.toISOString(), data };
    const text = await sealed(env);
    if (text === null) {
      // Encrypted and locked: never fall back to writing plain text
      return (emit({ state: 'needs_passphrase', message: 'Enter your passphrase to save. Nothing was written.', locked: true }), status);
    }
    emit({ state: 'saving' });
    const mirrored = await kv.set(K.data, encryptionOn ? JSON.parse(text) : env);

    if (mode === 'folder') {
      const h = await rememberedHandle();
      if (!h) return (emit({ state: 'needs_folder', message: mirrored ? `Saved in ${browserWhere} at ${hhmm(now)}. Choose a folder to keep records on your ${noun}.` : 'Choose a folder to save your records.', savedAt: mirrored ? now.toISOString() : status.savedAt, where: browserWhere }), status);
      const p = await permission(h, false);
      if (p !== 'granted') return (emit({ state: 'needs_permission', message: `Saved in ${browserWhere} at ${hhmm(now)}. Press "Reconnect" to keep saving to ${noun} ${h.name}.`, savedAt: now.toISOString(), where: browserWhere }), status);
      try {
        await writeText(h, DATA_FILE, text);
        await rolling(h, text);
        handle = h;
        return (emit({ state: 'saved', savedAt: now.toISOString(), where: `${noun} ${h.name}`, message: `Saved to ${noun} ${h.name} at ${hhmm(now)}` }), status);
      } catch {
        return (emit({ state: 'error', savedAt: mirrored ? now.toISOString() : status.savedAt, where: browserWhere, message: mirrored ? `${opts.describeAs === 'usb' ? 'USB stick' : 'Folder'} ${h.name} not found. Saved in ${browserWhere} at ${hhmm(now)}; plug it back in and press "Reconnect".` : `Could not save. Plug the ${noun} back in and press "Reconnect".` }), status);
      }
    }

    if (!mirrored) return (emit({ state: 'error', message: 'This browser is not keeping data. Download a backup file now.', where: browserWhere }), status);
    if (persisted === undefined && caps.persist) persisted = await d.persist().catch(() => false);

    if (mode === 'file' && backupDue()) {
      const ok = d.download(`gaskin-backup-${stamp(now)}.json`, text);
      if (ok) {
        lastBackupAt = now.toISOString();
        await kv.set(K.lastBackup, lastBackupAt);
      }
    }
    const tail = mode === 'file' && lastBackupAt ? `. Last backup file ${dayMonth(lastBackupAt)}` : '';
    return (emit({ state: 'saved', savedAt: now.toISOString(), where: browserWhere, message: `Saved on this device at ${hhmm(now)}${tail}` }), status);
  }

  async function flush(): Promise<StoreStatus> {
    while (hasPending) {
      const data = pending as T;
      hasPending = false;
      pending = undefined;
      await writeNow(data);
    }
    return status;
  }

  // ----- the API -----

  const store: GaskinStore<T> = {
    get mode() {
      return mode;
    },
    async load() {
      emit({ state: 'loading', message: 'Opening your records…' });
      const localRead = await readLocal();
      if (localRead === 'locked') {
        emit({ state: 'needs_passphrase', message: 'Your records are locked. Enter your passphrase to open them.' });
        return null;
      }
      const localData = localRead;
      if (mode === 'folder') {
        const h = await rememberedHandle();
        if (!h) {
          emit({ state: 'needs_folder', message: 'Choose where to keep your records.', where: browserWhere });
          return localData?.data ?? null;
        }
        const p = await permission(h, false);
        if (p !== 'granted') {
          emit({ state: 'needs_permission', message: `Press "Reconnect" to open your records on ${noun} ${h.name}.`, where: browserWhere });
          return localData?.data ?? null;
        }
        handle = h;
        const fromFolder = await readFolder(h);
        if (fromFolder === 'locked') {
          emit({ state: 'needs_passphrase', where: `${noun} ${h.name}`, message: `The records on ${noun} ${h.name} are locked. Enter the passphrase to open them.` });
          return null;
        }
        emit({ state: 'idle', where: `${noun} ${h.name}`, message: fromFolder ? `Opened from ${noun} ${h.name}` : `Ready to save to ${noun} ${h.name}` });
        return fromFolder ?? localData?.data ?? null;
      }
      emit({ state: 'idle', message: localData ? 'Opened from this device' : 'Not saved yet' });
      return localData?.data ?? null;
    },
    save(data: T) {
      pending = data;
      hasPending = true;
      const delay = opts.saveDebounceMs ?? 400;
      if (!inFlight) {
        inFlight = new Promise<StoreStatus>((resolve) => {
          fire = () => {
            fire = null;
            if (timer) clearTimeout(timer);
            timer = null;
            flush().then((s) => {
              inFlight = null;
              resolve(s);
            });
          };
          timer = setTimeout(() => fire?.(), delay);
        });
      }
      return inFlight;
    },
    async flushNow() {
      // Run the waiting save now instead of after the debounce; callers of save() still resolve.
      if (fire) fire();
      return inFlight ?? status;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    status: () => status,
    async chooseFolder() {
      if (!d.showDirectoryPicker) return false;
      try {
        const h = await d.showDirectoryPicker({ id: 'gaskin-data', mode: 'readwrite' });
        if ((await permission(h, true)) !== 'granted') return false;
        handle = h;
        const stored = kv.structured ? await kv.set(K.handle, h) : false; // folder handles survive only in IndexedDB
        mode = 'folder';
        await kv.set(K.mode, mode);
        // If the folder already holds records (e.g. the stick came from another computer), keep them;
        // otherwise copy the browser's records in.
        const existing = await readFolder(h);
        if (!existing) {
          const local = await kv.get<Envelope<T> | EncryptedEnvelope>(K.data);
          // The browser copy is already encrypted when encryption is on, so it is copied as it is
          if (local) await writeText(h, DATA_FILE, JSON.stringify(local)).catch(() => undefined);
        }
        emit({ state: 'idle', where: `${noun} ${h.name}`, message: stored ? `Records will be saved to ${noun} ${h.name}` : `Saving to ${noun} ${h.name} until this browser closes` });
        return true;
      } catch {
        return false; // cancelled
      }
    },
    async reconnectFolder() {
      const h = await rememberedHandle();
      if (!h) return store.chooseFolder();
      if ((await permission(h, true)) !== 'granted') return false;
      handle = h;
      emit({ state: 'idle', where: `${noun} ${h.name}`, message: `Reconnected to ${noun} ${h.name}` });
      if (hasPending) await flush();
      return true;
    },
    async exportFile() {
      // The browser copy is stored encrypted when encryption is on, so the backup file is too
      const local = await kv.get<Envelope<T> | EncryptedEnvelope>(K.data);
      if (!local) return false;
      const now = d.now();
      const ok = d.download(`gaskin-backup-${stamp(now)}.json`, JSON.stringify(local));
      if (ok) {
        lastBackupAt = now.toISOString();
        await kv.set(K.lastBackup, lastBackupAt);
        emit({});
      }
      return ok;
    },
    async importFile(file: Blob) {
      let text: string;
      try {
        text = await file.text();
      } catch {
        throw new Error('The file could not be opened.');
      }
      if (text.length > MAX_IMPORT_BYTES) throw new Error('This file is too large to be a Gaskin backup.');
      let parsed = parseJSONFile(text);
      if (isEncrypted(parsed)) {
        const k = await keyFor(parsed);
        if (!k) throw new PassphraseError('wrong_passphrase', 'This backup is encrypted with a different passphrase. Open it with importEncrypted() and its own passphrase.');
        parsed = await decryptJSON(parsed, k);
      }
      const data = unwrapParsed<T>(parsed);
      if (timer) clearTimeout(timer);
      inFlight = null;
      hasPending = false;
      await writeNow(data);
      return data;
    },
    async isEncrypted() {
      return encryptionOn;
    },
    async enableEncryption(passphrase: string) {
      const problem = passphraseProblem(passphrase);
      if (problem) throw new PassphraseError('weak_passphrase', problem);
      const current = await readLocal();
      if (current === 'locked') throw new PassphraseError('wrong_passphrase', 'Unlock with the current passphrase first.');
      encryptionSession.set(await deriveKey(passphrase));
      encryptionOn = true;
      await kv.set(K.encrypted, true);
      if (current) await writeNow(current.data);
      emit({});
    },
    async disableEncryption() {
      const current = await readLocal();
      if (current === 'locked') throw new PassphraseError('wrong_passphrase', 'Unlock first, then turn encryption off.');
      encryptionOn = false;
      await kv.set(K.encrypted, false);
      if (current) await writeNow(current.data);
      encryptionSession.set(null);
      emit({});
    },
    async unlock(passphrase: string) {
      // The browser copy, else the folder file, holds this store's salt
      let env: EncryptedEnvelope | null = null;
      const local = await kv.get<unknown>(K.data);
      if (isEncrypted(local)) env = local;
      else if (mode === 'folder') {
        const h = await rememberedHandle();
        if (h && (await permission(h, false)) === 'granted') {
          try {
            const parsed = parseJSONFile(await (await (await h.getFileHandle(DATA_FILE)).getFile()).text());
            if (isEncrypted(parsed)) env = parsed;
          } catch {
            /* no file */
          }
        }
      }
      if (!env) return store.load();
      const { key } = await decryptWithPassphrase(env, passphrase); // throws PassphraseError when wrong
      encryptionSession.set(key);
      encryptionOn = true;
      await kv.set(K.encrypted, true);
      return store.load();
    },
    lock() {
      encryptionSession.set(null);
      emit({ state: 'needs_passphrase', message: 'Locked. Enter your passphrase to open your records.' });
    },
    async setMode(next: StorageMode) {
      if (next === 'folder' && !d.showDirectoryPicker) next = chooseMode({ ...caps, folderAccess: false }, null);
      mode = next;
      await kv.set(K.mode, mode);
      emit({ where: mode === 'folder' ? (handle ? `${noun} ${handle.name}` : noun) : browserWhere });
    },
  };
  return store;
}

// ---------------------------------------------------------------------------
// One shared store for the app
// ---------------------------------------------------------------------------

let shared: Promise<GaskinStore<unknown>> | null = null;

/** The app-wide store (created on first call). Options apply only to the first call. */
export function getAppStore<T>(opts?: StoreOptions): Promise<GaskinStore<T>> {
  if (!shared) shared = createStore<unknown>(opts);
  return shared as Promise<GaskinStore<T>>;
}

/** Test helper */
export function _resetAppStore(): void {
  shared = null;
}
