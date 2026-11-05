import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseMode, createStore, memoryKV, openKV, localStorageKV, type StorageCapabilities } from '.';
import { pwaSupport, registerPWA } from './pwa';

const CAPS: StorageCapabilities = { indexedDB: true, localStorage: true, folderAccess: false, fromFile: false, inIframe: false, ios: false, mobile: false, serviceWorker: true, persist: false };

// ---------- A fake File System Access folder ----------

class FakeFile {
  dir: FakeDir;
  name: string;
  constructor(dir: FakeDir, name: string) {
    this.dir = dir;
    this.name = name;
  }
  async getFile() {
    const text = this.dir.files.get(this.name) ?? '';
    return { text: async () => text };
  }
  async createWritable() {
    let buf = '';
    return {
      write: async (d: string) => {
        if (this.dir.root.unplugged) throw new Error('NotFoundError');
        buf += d;
      },
      close: async () => {
        this.dir.files.set(this.name, buf);
      },
    };
  }
}

class FakeDir {
  kind = 'directory' as const;
  files = new Map<string, string>();
  dirs = new Map<string, FakeDir>();
  perm: 'granted' | 'prompt' | 'denied' = 'granted';
  grantOnRequest = true;
  unplugged = false;
  root: FakeDir;
  name: string;
  constructor(name: string, root?: FakeDir) {
    this.name = name;
    this.root = root ?? this;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw new Error('NotFoundError');
      this.files.set(name, '');
    }
    return new FakeFile(this, name);
  }
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    if (!this.dirs.has(name)) {
      if (!opts?.create) throw new Error('NotFoundError');
      this.dirs.set(name, new FakeDir(name, this.root));
    }
    return this.dirs.get(name)!;
  }
  async removeEntry(name: string) {
    this.files.delete(name);
  }
  async *entries(): AsyncIterableIterator<[string, { kind: string; name: string }]> {
    for (const n of this.files.keys()) yield [n, { kind: 'file', name: n }];
  }
  async queryPermission() {
    return this.root.perm;
  }
  async requestPermission() {
    if (this.root.grantOnRequest) this.root.perm = 'granted';
    return this.root.perm;
  }
}

function clock(start = '2026-11-05T14:02:00Z') {
  let t = new Date(start).getTime();
  return { now: () => new Date(t), advance: (min: number) => (t += min * 60_000) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('key-value fallbacks', () => {
  it('uses localStorage when IndexedDB is missing, memory when both are blocked', async () => {
    const mem = new Map<string, string>();
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;
    const a = await openKV({ indexedDB: null, localStorage: ls });
    expect(a.kind).toBe('localstorage');
    await a.set('x', { n: 1 });
    expect(await a.get('x')).toEqual({ n: 1 });

    const b = await openKV({ indexedDB: null, localStorage: null });
    expect(b.kind).toBe('memory');
  });

  it('IndexedDB that throws on open falls through without throwing', async () => {
    const broken = { open: () => { throw new Error('SecurityError'); } } as unknown as IDBFactory;
    const kv = await openKV({ indexedDB: broken, localStorage: null });
    expect(kv.kind).toBe('memory');
  });

  it('localStorage that throws on write reports false instead of throwing', async () => {
    const ls = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => undefined } as unknown as Storage;
    const kv = localStorageKV(ls)!;
    expect(await kv.set('a', 1)).toBe(false);
  });
});

describe('chooseMode', () => {
  it('picks browser normally, file on iPhone or file:// without folder access, folder only when remembered', () => {
    expect(chooseMode(CAPS)).toBe('browser');
    expect(chooseMode({ ...CAPS, ios: true })).toBe('file');
    expect(chooseMode({ ...CAPS, fromFile: true })).toBe('file');
    expect(chooseMode({ ...CAPS, folderAccess: true })).toBe('browser');
    expect(chooseMode({ ...CAPS, folderAccess: true }, 'folder')).toBe('folder');
    expect(chooseMode({ ...CAPS, folderAccess: false }, 'folder')).toBe('browser');
    expect(chooseMode({ ...CAPS, indexedDB: false, localStorage: false })).toBe('file');
  });
});

describe('browser mode', () => {
  it('saves, loads and reports a plain status', async () => {
    const c = clock();
    const kv = memoryKV();
    const store = await createStore<{ n: number }>({ mode: 'browser', saveDebounceMs: 0, deps: { kv, caps: CAPS, now: c.now, download: () => true, persist: async () => true } });
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.message));
    expect(await store.load()).toBeNull();
    const s = await store.save({ n: 1 });
    expect(s.state).toBe('saved');
    expect(s.message).toMatch(/^Saved on this device at \d\d:\d\d/);
    expect(await store.load()).toEqual({ n: 1 });
    expect(seen.some((m) => m.startsWith('Saved'))).toBe(true);
  });

  it('coalesces rapid saves into one write with the latest data', async () => {
    const kv = memoryKV();
    const spy = vi.spyOn(kv, 'set');
    const store = await createStore<{ n: number }>({ mode: 'browser', saveDebounceMs: 5, deps: { kv, caps: CAPS, download: () => true, persist: async () => false } });
    spy.mockClear();
    const p1 = store.save({ n: 1 });
    const p2 = store.save({ n: 2 });
    const p3 = store.save({ n: 3 });
    expect(p1).toBe(p2);
    await p3;
    const dataWrites = spy.mock.calls.filter(([k]) => k === 'data');
    expect(dataWrites.length).toBe(1);
    expect((dataWrites[0][1] as { data: { n: number } }).data.n).toBe(3);
  });

  it('when storage refuses every write, says so instead of claiming it saved', async () => {
    const kv = memoryKV();
    kv.set = async () => false;
    const store = await createStore<{ n: number }>({ mode: 'browser', saveDebounceMs: 0, deps: { kv, caps: CAPS, download: () => true, persist: async () => false } });
    const s = await store.save({ n: 1 });
    expect(s.state).toBe('error');
    expect(s.message).toMatch(/Download a backup/);
  });
});

describe('file mode (automatic backup downloads)', () => {
  it('downloads a backup when due, then not again until the interval passes', async () => {
    const c = clock();
    const downloads: string[] = [];
    const store = await createStore<{ n: number }>({ mode: 'file', backupEveryDays: 3, saveDebounceMs: 0, deps: { kv: memoryKV(), caps: { ...CAPS, ios: true }, now: c.now, download: (name) => (downloads.push(name), true), persist: async () => false } });
    await store.save({ n: 1 });
    expect(downloads).toEqual(['gaskin-backup-2026-11-05T14-02.json']);
    c.advance(60 * 24);
    await store.save({ n: 2 });
    expect(downloads.length).toBe(1);
    c.advance(60 * 24 * 3);
    const s = await store.save({ n: 3 });
    expect(downloads.length).toBe(2);
    expect(s.message).toMatch(/Last backup file 9 Nov/);
  });

  it('imports a backup file (envelope or raw) and rejects junk in plain English', async () => {
    const store = await createStore<{ n: number }>({ mode: 'browser', saveDebounceMs: 0, deps: { kv: memoryKV(), caps: CAPS, download: () => true, persist: async () => false } });
    const env = new Blob([JSON.stringify({ app: 'gaskin', format: 1, savedAt: 'x', data: { n: 7 } })]);
    expect(await store.importFile(env)).toEqual({ n: 7 });
    expect(await store.load()).toEqual({ n: 7 });
    expect(await store.importFile(new Blob([JSON.stringify({ n: 8 })]))).toEqual({ n: 8 });
    await expect(store.importFile(new Blob(['not json']))).rejects.toThrow(/not a Gaskin backup/);
  });

  it('exportFile downloads the latest data', async () => {
    const files: Array<[string, string]> = [];
    const store = await createStore<{ n: number }>({ mode: 'browser', saveDebounceMs: 0, deps: { kv: memoryKV(), caps: CAPS, download: (n, t) => (files.push([n, t]), true), persist: async () => false } });
    expect(await store.exportFile()).toBe(false); // nothing yet
    await store.save({ n: 4 });
    expect(await store.exportFile()).toBe(true);
    expect(JSON.parse(files[0][1]).data).toEqual({ n: 4 });
  });
});

describe('folder mode (File System Access)', () => {
  const folderDeps = (dir: FakeDir, kv = memoryKV(), c = clock()) => ({
    kv,
    caps: { ...CAPS, folderAccess: true },
    now: c.now,
    download: () => true,
    persist: async () => false,
    showDirectoryPicker: async () => dir,
  });

  it('writes gaskin-data.json and rolling backups to the chosen folder, with a USB status line', async () => {
    const dir = new FakeDir('GASKIN');
    const c = clock();
    const store = await createStore<{ n: number }>({ mode: 'folder', describeAs: 'usb', keepBackups: 3, backupIntervalMin: 60, saveDebounceMs: 0, deps: folderDeps(dir, memoryKV(), c) });
    expect(await store.chooseFolder()).toBe(true);
    const s = await store.save({ n: 1 });
    expect(s.message).toBe(`Saved to USB stick GASKIN at ${String(c.now().getHours()).padStart(2, '0')}:${String(c.now().getMinutes()).padStart(2, '0')}`);
    expect(JSON.parse(dir.files.get('gaskin-data.json')!).data).toEqual({ n: 1 });
    const backups = dir.dirs.get('backups')!;
    expect([...backups.files.keys()]).toEqual(['gaskin-data-2026-11-05T14-02.json']);

    // Within the hour: no new rolling copy. After: new copies, oldest pruned to keepBackups.
    c.advance(10);
    await store.save({ n: 2 });
    expect(backups.files.size).toBe(1);
    for (let i = 0; i < 4; i++) {
      c.advance(61);
      await store.save({ n: 3 + i });
    }
    expect(backups.files.size).toBe(3);
    expect([...backups.files.keys()].sort()[0]).toBe('gaskin-data-2026-11-05T16-14.json');
  });

  it('remembers the folder, asks again for permission on the next start, and keeps saving in the browser meanwhile', async () => {
    const dir = new FakeDir('GASKIN');
    const kv = memoryKV();
    const first = await createStore<{ n: number }>({ mode: 'folder', saveDebounceMs: 0, deps: folderDeps(dir, kv) });
    await first.chooseFolder();
    await first.save({ n: 1 });

    // New session: browser forgot the permission
    dir.perm = 'prompt';
    const second = await createStore<{ n: number }>({ mode: 'auto', saveDebounceMs: 0, deps: folderDeps(dir, kv) });
    expect(second.mode).toBe('folder');
    expect(await second.load()).toEqual({ n: 1 }); // from the browser mirror
    expect(second.status().state).toBe('needs_permission');
    const s = await second.save({ n: 2 });
    expect(s.state).toBe('needs_permission');
    expect(s.message).toMatch(/Reconnect/);
    expect(JSON.parse(dir.files.get('gaskin-data.json')!).data).toEqual({ n: 1 });

    expect(await second.reconnectFolder()).toBe(true);
    await second.save({ n: 3 });
    expect(JSON.parse(dir.files.get('gaskin-data.json')!).data).toEqual({ n: 3 });
  });

  it('opens records already on a stick from another computer instead of overwriting them', async () => {
    const dir = new FakeDir('GASKIN');
    dir.files.set('gaskin-data.json', JSON.stringify({ app: 'gaskin', format: 1, savedAt: 'x', data: { n: 99 } }));
    const store = await createStore<{ n: number }>({ mode: 'folder', saveDebounceMs: 0, deps: folderDeps(dir) });
    await store.save({ n: 1 }); // before a folder: browser only
    await store.chooseFolder();
    expect(JSON.parse(dir.files.get('gaskin-data.json')!).data).toEqual({ n: 99 });
    expect(await store.load()).toEqual({ n: 99 });
  });

  it('a pulled-out stick does not lose data: it reports and mirrors to the browser', async () => {
    const dir = new FakeDir('GASKIN');
    const kv = memoryKV();
    const store = await createStore<{ n: number }>({ mode: 'folder', describeAs: 'usb', saveDebounceMs: 0, deps: folderDeps(dir, kv) });
    await store.chooseFolder();
    dir.unplugged = true;
    const s = await store.save({ n: 5 });
    expect(s.state).toBe('error');
    expect(s.message).toMatch(/USB stick GASKIN not found\. Saved in this browser/);
    expect(((await kv.get('data')) as { data: { n: number } }).data).toEqual({ n: 5 });
  });

  it('without a picker, folder mode falls back to browser', async () => {
    const store = await createStore<{ n: number }>({ mode: 'folder', deps: { kv: memoryKV(), caps: CAPS, showDirectoryPicker: undefined, download: () => true, persist: async () => false } });
    expect(store.mode).toBe('browser');
    expect(await store.chooseFolder()).toBe(false);
  });

  it('a cancelled picker keeps the current mode', async () => {
    const store = await createStore<{ n: number }>({
      mode: 'browser',
      deps: { kv: memoryKV(), caps: { ...CAPS, folderAccess: true }, download: () => true, persist: async () => false, showDirectoryPicker: async () => { throw new DOMException('aborted', 'AbortError'); } },
    });
    expect(await store.chooseFolder()).toBe(false);
    expect(store.mode).toBe('browser');
  });
});

describe('PWA registration guard', () => {
  it('does nothing outside a browser (and so from file:// or a sandbox)', async () => {
    expect(pwaSupport().ok).toBe(false);
    expect(await registerPWA()).toBe(false);
  });
});
