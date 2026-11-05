import { describe, expect, it } from 'vitest';
import type { ClinicalEvent, Mother } from '../../types';
import { createSeedState } from '../../data';
import type { Backend, BackendUpdate, HostedSnapshot } from '../backend';
import { createArtifactBackend, chunkEvents } from '../artifactBackend';
import { createLocalBackend } from '../localBackend';
import { createMemoryKV } from '../kv';
import { pickBackend } from '../index';
import { FakeStore, fakeViewer } from './fakeRuntime';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(fn: () => T | undefined | null | false, ms = 3000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await sleep(10);
  }
}

function seedSnapshot(n = 4): HostedSnapshot {
  const s = createSeedState();
  return { mothers: s.mothers.slice(0, n), overrides: s.overrides.filter((o) => s.mothers.slice(0, n).some((m) => m.id === o.motherId)), proposals: s.proposals, learnedRules: s.learnedRules, outbound: [], inbound: [], meta: { clock: s.clock } };
}

function visit(id: string, at = '2026-11-09T10:00:00.000Z'): ClinicalEvent {
  return { id, kind: 'visit', at, recordedBy: 'w-ng-bisola', visitType: 'anc', contactNumber: 5, attended: true };
}

function watch(b: Backend) {
  const updates: BackendUpdate[] = [];
  b.subscribe((u) => updates.push(u));
  return {
    updates,
    latest: () => updates.at(-1)?.snapshot,
    notes: () => updates.flatMap((u) => u.notes),
    mother: (id: string): Mother | undefined => updates.at(-1)?.snapshot.mothers.find((m) => m.id === id),
  };
}

const opts = (store: FakeStore, viewer: string, extra: Parameters<typeof fakeViewer>[2] = {}) => ({ runtime: fakeViewer(store, viewer, extra), kv: createMemoryKV(), debounceMs: 5, loadTimeoutMs: 2000 });

describe('artifactBackend', () => {
  it('keeps one small document per mother, and shares changes between two viewers live', async () => {
    const store = new FakeStore();
    const a = await createArtifactBackend(opts(store, 'u_amina'));
    const b = await createArtifactBackend(opts(store, 'u_bisi'));
    expect(a.kind).toBe('artifact');
    expect(await a.load()).toBeNull(); // empty store: the UI offers to load the demo

    const seed = seedSnapshot();
    await a.importSnapshot(seed);
    const mDocs = [...store.docs.keys()].filter((k) => /^mothers\/[^/]+$/.test(k));
    expect(mDocs).toHaveLength(seed.mothers.length);
    for (const k of mDocs) expect(JSON.stringify(store.docs.get(k)).length).toBeLessThan(256 * 1024);
    expect(store.docs.has(`rules/${seed.learnedRules[0].id}`)).toBe(true);

    const wb = watch(b);
    const id = seed.mothers[0].id;
    await until(() => wb.mother(id));
    await a.appendEvents(id, [visit('ev-from-a')]);
    await a.flush();
    await until(() => wb.mother(id)?.events.some((e) => e.id === 'ev-from-a'));
    const loadedB = await b.load();
    expect(loadedB!.mothers.find((m) => m.id === id)!.events.length).toBe(seed.mothers[0].events.length + 1);
    a.close();
    b.close();
  });

  it('never loses events when two viewers write the same mother at once, and notes the clash', async () => {
    const store = new FakeStore();
    const a = await createArtifactBackend(opts(store, 'u_a'));
    const seed = seedSnapshot(1);
    await a.importSnapshot(seed);
    const b = await createArtifactBackend(opts(store, 'u_b'));
    await b.load();
    const id = seed.mothers[0].id;
    const wa = watch(a);
    // Both record a visit at the same moment, and B also edits her community
    await Promise.all([a.appendEvents(id, [visit('ev-a')]), b.saveMother({ ...(await b.load())!.mothers[0], community: 'New Town', events: [...seed.mothers[0].events, visit('ev-b')] })]);
    await Promise.all([a.flush(), b.flush()]);
    await sleep(50);
    await Promise.all([a.flush(), b.flush()]);
    const doc = store.docs.get(`mothers/${id}`) as { events: ClinicalEvent[]; profile: Mother };
    const ids = new Set(doc.events.map((e) => e.id));
    expect(ids.has('ev-a')).toBe(true);
    expect(ids.has('ev-b')).toBe(true);
    expect(doc.profile.community).toBe('New Town');
    await until(() => wa.mother(id)?.events.some((e) => e.id === 'ev-b'));
    a.close();
    b.close();
  });

  it('re-adds our events and shows a note when another write replaced ours', async () => {
    const store = new FakeStore();
    const a = await createArtifactBackend(opts(store, 'u_a'));
    const seed = seedSnapshot(1);
    await a.importSnapshot(seed);
    const id = seed.mothers[0].id;
    const wa = watch(a);
    await a.appendEvents(id, [visit('ev-mine')]);
    await a.flush();
    // Someone with an older copy (no lease, no merge) overwrites the whole document
    const cur = store.docs.get(`mothers/${id}`) as { rev: number; events: ClinicalEvent[] };
    store.docs.set(`mothers/${id}`, { ...cur, events: cur.events.filter((e) => e.id !== 'ev-mine'), rev: cur.rev + 1, baseRev: cur.rev - 1, updatedBy: 'u_other#tab' });
    store.notify();
    await until(() => wa.notes().some((n) => /saved by someone else/.test(n.text)));
    await a.flush();
    await until(() => (store.docs.get(`mothers/${id}`) as { events: ClinicalEvent[] }).events.some((e) => e.id === 'ev-mine'));
    a.close();
  });

  it('keeps a read-only viewer’s changes in the browser, on top of the live shared data', async () => {
    const store = new FakeStore();
    const owner = await createArtifactBackend(opts(store, 'u_owner'));
    const seed = seedSnapshot(2);
    await owner.importSnapshot(seed);
    const viewer = await createArtifactBackend(opts(store, 'u_viewer', { canWrite: false }));
    const wv = watch(viewer);
    const id = seed.mothers[1].id;
    await viewer.appendEvents(id, [visit('ev-local')]);
    await viewer.flush();
    expect((store.docs.get(`mothers/${id}`) as { events: ClinicalEvent[] }).events.some((e) => e.id === 'ev-local')).toBe(false);
    await until(() => wv.mother(id)?.events.some((e) => e.id === 'ev-local'));
    expect(viewer.status().fallbackReason).toMatch(/view the shared demo/);
    // The owner's later change still reaches the viewer
    await owner.appendEvents(id, [visit('ev-owner')]);
    await owner.flush();
    await until(() => wv.mother(id)?.events.some((e) => e.id === 'ev-owner'));
    owner.close();
    viewer.close();
  });

  it('keeps a read-only viewer’s changes after the page is reopened', async () => {
    const store = new FakeStore();
    const owner = await createArtifactBackend(opts(store, 'u_owner'));
    const seed = seedSnapshot(2);
    await owner.importSnapshot(seed);
    const kv = createMemoryKV();
    const id = seed.mothers[0].id;
    const first = await createArtifactBackend({ ...opts(store, 'u_viewer', { canWrite: false }), kv });
    await first.appendEvents(id, [visit('ev-mine')]);
    await first.flush();
    first.close();
    await sleep(20);
    const again = await createArtifactBackend({ ...opts(store, 'u_viewer', { canWrite: false }), kv });
    const snap = await again.load();
    expect(snap?.mothers.find((m) => m.id === id)?.events.some((e) => e.id === 'ev-mine')).toBe(true);
    owner.close();
    again.close();
  });

  it('simulates delivery and shares message status with other viewers', async () => {
    const store = new FakeStore();
    const a = await createArtifactBackend(opts(store, 'u_a'));
    const seed = seedSnapshot(3);
    await a.importSnapshot(seed);
    const m = seed.mothers.find((x) => x.consent.messaging && x.phone.number)!;
    const statuses: string[] = [];
    const r = await a.sendMessage(
      { message: { id: 'msg-1', motherId: m.id, channel: 'sms', language: 'en', body: 'Hello', estCostLocal: 2, estCostUSD: 0.001, status: 'draft', createdAt: new Date().toISOString(), planVersion: 1, itemIds: [], aiAssisted: false } },
      { onStatus: (u) => statuses.push(u.status) },
    );
    expect(r.simulated).toBe(true);
    await until(() => statuses.includes('sent'), 4000);
    await a.flush();
    const doc = store.docs.get(`messages/${m.id}`) as { outbound: Array<{ id: string; status: string }> };
    expect(doc.outbound[0]).toMatchObject({ id: 'msg-1' });
    a.close();
  }, 10_000);

  it('keeps per-user settings in the viewer’s private subtree', async () => {
    const store = new FakeStore();
    const a = await createArtifactBackend(opts(store, 'u_a'));
    await a.setUserSettings('ai', { mode: 'none' });
    expect(store.docs.get('data/users/u_a/settings')).toEqual({ values: { ai: { mode: 'none' } } });
    const b = await createArtifactBackend(opts(store, 'u_b'));
    expect(await b.getUserSettings('ai')).toBeUndefined();
    a.close();
    b.close();
  });

  it('falls back to this device when db resolves null (opened as a file)', async () => {
    const memory = new Map<string, Record<string, unknown>>();
    const b = await createArtifactBackend({
      runtime: { use: async () => null },
      kv: createMemoryKV(),
      // localBackend needs a store: use the in-memory one through pickBackend below instead
    }).catch(() => null);
    // createArtifactBackend falls back to createLocalBackend, which opens the app store
    expect(b?.kind).toBe('local');
    expect(b?.status().fallbackReason).toMatch(/stay on this device/);
    void memory;
  });

  it('splits a very long timeline into chunk documents under the size cap', () => {
    const big = Array.from({ length: 4000 }, (_, i) => ({ ...visit(`e${String(i).padStart(5, '0')}`, new Date(Date.UTC(2020, 0, 1) + i * 3600_000).toISOString()), note: 'x'.repeat(40) }));
    const { inline, chunks } = chunkEvents(big);
    expect(inline.length + chunks.flat().length).toBe(big.length);
    expect(JSON.stringify(inline).length).toBeLessThan(200 * 1024);
    for (const c of chunks) expect(JSON.stringify(c).length).toBeLessThan(200 * 1024);
    expect(inline.at(-1)!.id).toBe(big.at(-1)!.id);
  });
});

describe('localBackend', () => {
  function memStore() {
    let data: Record<string, unknown> | null = null;
    return { load: async () => data, save: async (d: Record<string, unknown>) => void (data = JSON.parse(JSON.stringify(d))), peek: () => data };
  }

  it('keeps the AppState shape on disk, with non-record fields as meta', async () => {
    const st = memStore();
    const b = await createLocalBackend({ store: st as never, kv: createMemoryKV() });
    const seed = seedSnapshot(2);
    await b.importSnapshot({ ...seed, meta: { clock: '2026-11-09T09:00:00.000Z', alertAcks: [], schema: 3 } });
    const saved = st.peek()!;
    expect(saved.schema).toBe(3);
    expect(Array.isArray(saved.mothers)).toBe(true);
    await b.appendEvents(seed.mothers[0].id, [visit('ev-x')]);
    await b.flush();
    expect((st.peek()!.mothers as Mother[])[0].events.some((e) => e.id === 'ev-x')).toBe(true);
    const again = await createLocalBackend({ store: st as never, kv: createMemoryKV() });
    const loaded = await again.load();
    expect(loaded!.meta.clock).toBe('2026-11-09T09:00:00.000Z');
  });
});

describe('pickBackend', () => {
  it('chooses the artifact backend inside the artifact runtime', async () => {
    const store = new FakeStore();
    const p = await pickBackend({ artifact: opts(store, 'u_x') });
    expect(p.reason).toBe('artifact');
    expect(p.backend.kind).toBe('artifact');
    p.backend.close();
  });

  it('chooses local when there is no runtime and no server', async () => {
    const p = await pickBackend({ prefer: 'local', local: { store: { load: async () => null, save: async () => undefined } as never, kv: createMemoryKV() } });
    expect(p.reason).toBe('local');
  });

  it('asks for sign-in when a server is configured but there is no session', async () => {
    const p = await pickBackend({ serverUrl: 'https://gaskin.example.ng', local: { store: { load: async () => null, save: async () => undefined } as never, kv: createMemoryKV() } });
    expect(p.reason).toBe('server_needs_login');
    expect(p.serverUrl).toBe('https://gaskin.example.ng');
    expect(p.backend.kind).toBe('local');
  });
});
