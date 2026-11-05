/**
 * End to end: start the real server on a port, sign two health workers in
 * through the HTTP API, and sync two simulated phones with the front end's
 * own httpBackend. One phone records visits offline and loses its
 * connection mid-upload; both must end with the same timeline and no
 * duplicates.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serve } from '@hono/node-server';
import type { AddressInfo } from 'node:net';
import type { ClinicalEvent } from '../../src/types';
import { createHttpBackend, login } from '../../src/hosted/httpBackend';
import { createMemoryKV } from '../../src/hosted/kv';
import type { Backend } from '../../src/hosted/backend';
import { createApp, type GaskinServer } from '../src/app';
import type { DB } from '../src/db';
import { createUser } from '../src/auth';
import { FAC_A, mother, outbound, testConfig, testDb, visit, waitFor } from './helpers';

let base = '';
let g: GaskinServer;
let db: DB;
let server: ReturnType<typeof serve>;

beforeAll(async () => {
  db = await testDb();
  await createUser(db, { phone: '08030000111', pin: '482916', name: 'Amina Bello', role: 'worker', facilityIds: [FAC_A], country: 'NG' });
  await createUser(db, { phone: '08030000222', pin: '593017', name: 'Bisi Adeyemi', role: 'supervisor', facilityIds: [FAC_A], country: 'NG' });
  await createUser(db, { phone: '08030000333', pin: '604128', name: 'Programme Officer', role: 'programme_officer', facilityIds: [FAC_A], country: 'NG' });
  g = createApp({ cfg: testConfig(), db });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: g.app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  g.close();
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
});

/** A phone whose network can be cut */
function phoneFetch() {
  const state = { offline: false, dropNextReply: false };
  const fn = (async (url: string | URL, init?: RequestInit) => {
    if (state.offline) throw new TypeError('fetch failed');
    const res = await fetch(url, init);
    if (state.dropNextReply && String(url).endsWith('/api/sync')) {
      // The server processed the upload, but the reply never reached the phone
      state.dropNextReply = false;
      throw new TypeError('network connection was lost');
    }
    return res;
  }) as typeof fetch;
  return { fn, state };
}

async function phone(phoneNo: string, pin: string, deviceId: string) {
  const net = phoneFetch();
  const s = await login(base, phoneNo, pin, { fetch: net.fn });
  const b = (await createHttpBackend({ baseUrl: base, token: s.token, fetch: net.fn, kv: createMemoryKV(), deviceId, live: false, pollMs: 60_000, debounceMs: 5 })) as Backend & { sync(): Promise<void> };
  return { b, net, s };
}

describe('server integration: two clients syncing', () => {
  it('rejects a wrong PIN and refuses calls without a session', async () => {
    await expect(login(base, '08030000111', '000000')).rejects.toMatchObject({ code: 'unauthorised' });
    const res = await fetch(`${base}/api/me`);
    expect(res.status).toBe(401);
  });

  it('merges offline work from two phones, idempotently, with no duplicates', async () => {
    const amina = await phone('08030000111', '482916', 'phone-amina');
    const bisi = await phone('08030000222', '593017', 'phone-bisi');
    expect(amina.s.user.role).toBe('worker');
    expect((await amina.b.whoami()).facilityIds).toEqual([FAC_A]);

    // Amina registers a mother and records her first visit
    const m = mother('m-int-1', FAC_A, { events: [visit('ev-1', '2026-09-01T09:00:00.000Z', 1)] });
    await amina.b.load();
    await amina.b.saveMother(m);
    await amina.b.sync();

    // Bisi's phone sees her
    await bisi.b.load();
    await bisi.b.sync();
    const seen = (await bisi.b.load())!.mothers.find((x) => x.id === 'm-int-1');
    expect(seen?.events.map((e) => e.id)).toEqual(['ev-1']);

    // Both go offline and record different visits for her
    amina.net.state.offline = true;
    bisi.net.state.offline = true;
    await amina.b.appendEvents('m-int-1', [visit('ev-amina', '2026-10-01T09:00:00.000Z', 2)]);
    await bisi.b.appendEvents('m-int-1', [visit('ev-bisi', '2026-10-02T09:00:00.000Z', 3)]);
    await expect(amina.b.sync()).rejects.toBeTruthy();
    expect(amina.b.status()).toMatchObject({ online: false, pending: 1 });

    // Amina reconnects, but the reply to her upload is lost on the way back
    amina.net.state.offline = false;
    amina.net.state.dropNextReply = true;
    await expect(amina.b.sync()).rejects.toBeTruthy();
    expect(amina.b.status().pending).toBe(1); // she cannot know it arrived
    await amina.b.sync(); // retry: the server recognises the op id
    expect(amina.b.status().pending).toBe(0);

    bisi.net.state.offline = false;
    await bisi.b.sync();
    await amina.b.sync();

    const ids = (b: Backend) =>
      b.load().then((s) => s!.mothers.find((x) => x.id === 'm-int-1')!.events.map((e: ClinicalEvent) => e.id).sort());
    expect(await ids(amina.b)).toEqual(['ev-1', 'ev-amina', 'ev-bisi']);
    expect(await ids(bisi.b)).toEqual(['ev-1', 'ev-amina', 'ev-bisi']);
    const rows = await db.all("SELECT id FROM events WHERE mother_id = 'm-int-1'");
    expect(rows).toHaveLength(3);

    amina.b.close();
    bisi.b.close();
  });

  it('sends a message through the sandbox gateway and the other phone sees the delivery receipt', async () => {
    const amina = await phone('08030000111', '482916', 'phone-amina-2');
    const bisi = await phone('08030000222', '593017', 'phone-bisi-2');
    await amina.b.load();
    await bisi.b.load();
    const statuses: string[] = [];
    const r = await amina.b.sendMessage({ message: outbound('msg-int-1', 'm-int-1') }, { onStatus: (u) => statuses.push(u.status) });
    expect(r).toMatchObject({ status: 'queued', simulated: true });
    await waitFor(async () => (await g.store.messageStatuses(['msg-int-1']))['msg-int-1'] === 'delivered');
    await bisi.b.sync();
    const out = (await bisi.b.load())!.outbound.find((m) => m.id === 'msg-int-1');
    expect(out?.status).toBe('delivered');
    amina.b.close();
    bisi.b.close();
  });

  it('serves DHIS2 exports to supervisors only, with small counts withheld, and public metrics without login', async () => {
    const amina = await phone('08030000111', '482916', 'phone-amina-3');
    const officer = await phone('08030000333', '604128', 'phone-officer');
    const denied = await fetch(`${base}/api/reports/dhis2?period=202610`, { headers: { Authorization: `Bearer ${amina.s.token}` } });
    expect(denied.status).toBe(403);
    const ok = await fetch(`${base}/api/reports/dhis2?period=202610`, { headers: { Authorization: `Bearer ${officer.s.token}` } });
    const exp = (await ok.json()) as { dataValueSets: Array<{ orgUnit: string; dataValues: Array<{ dataElement: string; value: string }> }>; suppressed: Array<{ orgUnit: string; dataElement: string }> };
    const fac = exp.dataValueSets.find((s) => s.orgUnit === FAC_A)!;
    // Two ANC contacts in October at this facility: withheld, never shown as 2
    expect(fac.dataValues.find((d) => d.dataElement === 'GASKIN_ANC_TOTAL')).toBeUndefined();
    expect(exp.suppressed).toContainEqual({ orgUnit: FAC_A, dataElement: 'GASKIN_ANC_TOTAL' });

    const pub = await fetch(`${base}/api/public/metrics`);
    expect(pub.status).toBe(200);
    const body = (await pub.json()) as { countries: Record<string, { mothersEnrolled: { value: number | null; suppressed?: boolean } }> };
    expect(body.countries.NG.mothersEnrolled).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(body)).not.toMatch(/m-int-1|Ngozi|Itire/);

    // Officers cannot read named records
    const snap = await fetch(`${base}/api/snapshot`, { headers: { Authorization: `Bearer ${officer.s.token}` } });
    expect(((await snap.json()) as { mothers: unknown[] }).mothers).toEqual([]);
    amina.b.close();
    officer.b.close();
  });

  it('writes an audit trail without record content', async () => {
    const rows = await db.all<{ action: string; detail: string | null }>('SELECT action, detail FROM audit');
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['auth.login', 'records.sync', 'message.send', 'report.dhis2']) expect(actions.has(a)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/Ngozi|Itire|0803111|clinic visit/);
  });
});
