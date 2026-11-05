/**
 * An in-memory stand-in for the artifact runtime's `db` and `user`
 * capabilities, shared between several "viewers", so tests can check what
 * one viewer's writes look like to another. Mirrors contract 0.2.96: paths
 * alternate collection/document, snapshots are delivered asynchronously,
 * documents are replaced whole by set(), and bodies are cloned.
 */
import type { RtClaude, RtCollectionRef, RtDB, RtDocRef, RtDocSnapshot, RtQuerySnapshot, RtUser } from '../runtime';

type Listener = () => void;

export class FakeStore {
  docs = new Map<string, Record<string, unknown>>();
  listeners = new Set<Listener>();
  writes = 0;
  /** Paths whose writes reject with invalid_argument (rules) */
  denyWrite: (path: string, viewer: string) => boolean = () => false;
  latency = 1;

  notify(): void {
    for (const l of this.listeners) setTimeout(l, this.latency);
  }
}

function snap(id: string, data: Record<string, unknown> | undefined): RtDocSnapshot {
  const frozen = data ? JSON.parse(JSON.stringify(data)) : undefined;
  return { id, exists: !!data, data: () => frozen, metadata: { fromCache: false, hasPendingWrites: false } };
}

function segs(p: string): string[] {
  return p.split('/').filter(Boolean);
}

export function fakeViewer(store: FakeStore, viewerId: string, opts: { canWrite?: boolean | null; canEdit?: boolean; name?: string } = {}): RtClaude {
  const err = (code: string) => Object.assign(new Error(code), { code, message: code });
  const docRef = (path: string): RtDocRef => {
    if (segs(path).length % 2) throw new TypeError(`document path needs an even number of segments: ${path}`);
    const id = segs(path).at(-1)!;
    return {
      id,
      path,
      async get() {
        await new Promise((r) => setTimeout(r, store.latency));
        if (path.startsWith('data/users/') && segs(path)[2] !== viewerId) return snap(id, undefined);
        return snap(id, store.docs.get(path));
      },
      async set(data) {
        await new Promise((r) => setTimeout(r, store.latency));
        if (opts.canWrite === false || store.denyWrite(path, viewerId)) throw err('invalid_argument');
        if (JSON.stringify(data).length > 256 * 1024) throw err('invalid_argument');
        store.docs.set(path, JSON.parse(JSON.stringify(data)));
        store.writes++;
        store.notify();
      },
      async update(data) {
        const cur = store.docs.get(path);
        if (!cur) throw err('invalid_argument');
        await this.set({ ...cur, ...data });
      },
      async delete() {
        store.docs.delete(path);
        store.notify();
      },
      onSnapshot(next) {
        const fire = () => next(snap(id, store.docs.get(path)));
        store.listeners.add(fire);
        setTimeout(fire, store.latency);
        return () => store.listeners.delete(fire);
      },
      collection: (sub: string) => collRef(`${path}/${sub}`),
    };
  };
  const collRef = (path: string): RtCollectionRef => {
    if (segs(path).length % 2 === 0) throw new TypeError(`collection path needs an odd number of segments: ${path}`);
    const n = segs(path).length + 1;
    const read = (): RtQuerySnapshot => {
      const docs = [...store.docs.entries()].filter(([p]) => p.startsWith(path + '/') && segs(p).length === n).sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, d]) => snap(segs(p).at(-1)!, d));
      return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false } };
    };
    const q = {
      path,
      doc: (id?: string) => docRef(`${path}/${id ?? Math.random().toString(36).slice(2)}`),
      async get() {
        return read();
      },
      onSnapshot(next: (s: RtQuerySnapshot) => void) {
        const fire = () => next(read());
        store.listeners.add(fire);
        setTimeout(fire, store.latency);
        return () => store.listeners.delete(fire);
      },
      limit: () => q,
    };
    return q;
  };
  const db: RtDB = { doc: docRef, collection: collRef };
  const user: RtUser = {
    isOwner: async () => false,
    canEdit: async () => opts.canEdit ?? false,
    can: async () => (opts.canWrite === undefined ? true : opts.canWrite),
    id: async () => viewerId,
    me: async () => ({ id: viewerId, name: opts.name ?? '', isOwner: false, canEdit: opts.canEdit ?? false }),
  };
  return {
    async use(name: string) {
      await new Promise((r) => setTimeout(r, 1));
      return name === 'db' ? db : name === 'user' ? user : null;
    },
  };
}
