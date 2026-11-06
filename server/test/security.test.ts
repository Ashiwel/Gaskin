/**
 * Security tests for the production server. IDs (SEC-nn) refer to docs/security-review.md.
 */
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Store } from '../src/store';
import { authenticate, rotateSession, verifyPin, IDLE_DAYS } from '../src/auth';
import { configProblems, loadConfig } from '../src/config';
import { computePublicMetrics } from '../src/metrics';
import { AIProxy } from '../src/ai';
import { AfricasTalkingGateway } from '../src/messaging/africastalking';
import { WhatsAppGateway } from '../src/messaging/whatsapp';
import { TermiiGateway } from '../src/messaging/termii';
import { WebhookAuthError } from '../src/messaging/gateway';
import { FAC_A, FAC_B, makeUser, mother, profile, testConfig, testDb, visit } from './helpers';

async function setup(over: Record<string, string> = {}) {
  const db = await testDb();
  const cfg = testConfig({ CORS_ORIGINS: 'https://app.example', ...over });
  const g = createApp({ cfg, db });
  const store = new Store(db);
  const req = (path: string, init: RequestInit = {}, token?: string) =>
    g.app.request(path, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...((init.headers as Record<string, string>) ?? {}) } });
  return { db, cfg, g, store, req };
}

describe('HTTP hardening (SEC-10)', () => {
  it('sends a locked-down CSP, frame-ancestors none, HSTS and no-store on record responses', async () => {
    const { g, req, db } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    const r = await req('/api/me', {}, a.token);
    expect(r.headers.get('content-security-policy')).toMatch(/default-src 'none'/);
    expect(r.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get('strict-transport-security')).toMatch(/max-age=31536000/);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    g.close();
  });

  it('does not reflect a foreign origin in CORS', async () => {
    const { g, db } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    const evil = await g.app.request('/api/me', { headers: { origin: 'https://evil.example', authorization: `Bearer ${a.token}` } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    const ok = await g.app.request('/api/me', { headers: { origin: 'https://app.example', authorization: `Bearer ${a.token}` } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example');
    g.close();
  });

  it('accepts a token in the query string only for the event stream', async () => {
    const { g, db } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    expect((await g.app.request(`/api/snapshot?token=${a.token}`)).status).toBe(401);
    expect((await g.app.request(`/api/me?token=${a.token}`)).status).toBe(401);
    g.close();
  });

  it('validates settings keys, AI requests and admin input', async () => {
    const { g, req, db } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    const admin = await makeUser(db, 'admin', []);
    expect((await req('/api/settings/..%2f..%2fetc', { method: 'PUT', body: '{"value":1}' }, a.token)).status).toBe(400);
    expect((await req('/api/ai', { method: 'POST', body: JSON.stringify({ prompt: 'x'.repeat(70_000) }) }, a.token)).status).toBe(400);
    expect((await req('/api/ai', { method: 'POST', body: JSON.stringify({ prompt: 'hi', task: 'drop_tables' }) }, a.token)).status).toBe(400);
    const badFac = await req('/api/admin/users', { method: 'POST', body: JSON.stringify({ phone: '08035551234', pin: '482916', name: 'X', role: 'worker', facilityIds: ['no-such-facility'] }) }, admin.token);
    expect(badFac.status).toBe(400);
    expect(((await badFac.json()) as { message: string }).message).toMatch(/Unknown facility/);
    expect((await req('/api/admin/facilities', { method: 'POST', body: JSON.stringify({ id: '../x', name: 'x', country: 'NG' }) }, admin.token)).status).toBe(400);
    g.close();
  });

  it('a programme officer cannot use the AI preview to probe which names exist in records', async () => {
    const { g, req, db, store } = await setup({ AI_BASE_URL: 'http://m/v1', AI_MODEL: 'x' });
    const a = await makeUser(db, 'worker', [FAC_A]);
    await store.sync(a.user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-a', FAC_A)) }] });
    const po = await makeUser(db, 'programme_officer', [FAC_A]);
    expect((await req('/api/ai/preview', { method: 'POST', body: JSON.stringify({ prompt: 'Ngozi Eze' }) }, po.token)).status).toBe(403);
    g.close();
  });
});

describe('sign-in and sessions (SEC-11)', () => {
  it('stores PINs as salted scrypt and never the same hash twice', async () => {
    const { db, g } = await setup();
    await makeUser(db, 'worker', [FAC_A]);
    await makeUser(db, 'worker', [FAC_A]);
    const rows = await db.all<{ pin_hash: string }>('SELECT pin_hash FROM users');
    expect(rows[0].pin_hash).toMatch(/^scrypt\$16384\$/);
    expect(rows[0].pin_hash).not.toBe(rows[1].pin_hash);
    expect(verifyPin('482916', rows[0].pin_hash)).toBe(true);
    g.close();
  });

  it('rate-limits guessing one number even from many addresses, and refuses absurd PINs before hashing', async () => {
    const { db, g, req } = await setup({ PIN_MAX_ATTEMPTS: '1000' });
    const a = await makeUser(db, 'worker', [FAC_A]);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: a.phone, pin: String(100000 + i) }) })).status;
    expect(last).toBe(429);
    expect((await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '08030009999', pin: 'x'.repeat(100_000) }) })).status).toBe(400);
    g.close();
  });

  it('rotates a session: the old token dies, the new one works, and renewal stops 90 days after sign-in', async () => {
    const { db, g, req } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    const r = await req('/api/auth/refresh', { method: 'POST' }, a.token);
    expect(r.status).toBe(200);
    const { token } = (await r.json()) as { token: string };
    expect(token).not.toBe(a.token);
    expect(await authenticate(db, a.token)).toBeNull();
    expect((await authenticate(db, token))?.id).toBe(a.user.id);
    await db.run('UPDATE sessions SET created_at = ?', [new Date(Date.now() - 91 * 86_400_000).toISOString()]);
    expect(await rotateSession(db, token, 30)).toBeNull();
    g.close();
  });

  it(`ends a session left idle for more than ${IDLE_DAYS} days`, async () => {
    const { db, g } = await setup();
    const a = await makeUser(db, 'worker', [FAC_A]);
    await db.run('UPDATE sessions SET last_seen_at = ?', [new Date(Date.now() - (IDLE_DAYS + 1) * 86_400_000).toISOString()]);
    expect(await authenticate(db, a.token)).toBeNull();
    g.close();
  });
});

describe('webhooks in live mode (SEC-12)', () => {
  const post = (body: string, query: Record<string, string> = {}, headers: Record<string, string> = {}) => ({ method: 'POST', headers, query, rawBody: body, contentType: 'application/x-www-form-urlencoded' });

  it("Africa's Talking: refuses callbacks without the shared token, accepts them with it", async () => {
    const bare = new AfricasTalkingGateway({ username: 'u', apiKey: 'k', sandbox: false, requireAuth: true }, 'sms');
    await expect(bare.handleWebhook(post('from=%2B2348031112222&text=bleeding'))).rejects.toBeInstanceOf(WebhookAuthError);
    const gw = new AfricasTalkingGateway({ username: 'u', apiKey: 'k', sandbox: false, requireAuth: true, webhookToken: 'tok-1234567890' }, 'sms');
    await expect(gw.handleWebhook(post('from=%2B2348031112222&text=bleeding', { token: 'wrong-123456789' }))).rejects.toBeInstanceOf(WebhookAuthError);
    const ok = await gw.handleWebhook(post('from=%2B2348031112222&text=bleeding', { token: 'tok-1234567890' }));
    expect(ok.items[0]).toMatchObject({ type: 'inbound', text: 'bleeding' });
  });

  it('WhatsApp and Termii refuse unsigned callbacks when no secret is set in live mode', async () => {
    const wa = new WhatsAppGateway({ token: 't', phoneNumberId: 'p', apiVersion: 'v23.0', template: 't', templateLanguage: 'en', requireAuth: true });
    await expect(wa.handleWebhook({ ...post('{}'), contentType: 'application/json' })).rejects.toBeInstanceOf(WebhookAuthError);
    const te = new TermiiGateway({ apiKey: 'k', senderId: 'G', baseUrl: 'https://x', route: 'dnd', requireAuth: true });
    await expect(te.handleWebhook({ ...post('{}'), contentType: 'application/json' })).rejects.toBeInstanceOf(WebhookAuthError);
  });

  it('the live server answers a forged inbound SMS with 401 and stores nothing', async () => {
    const { g, db } = await setup({ MESSAGING_MODE: 'live', AT_USERNAME: 'u', AT_API_KEY: 'k' });
    const r = await g.app.request('/webhooks/africastalking/inbound', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'from=%2B2348031112222&text=I+am+bleeding&id=1' });
    expect(r.status).toBe(401);
    expect(await db.all("SELECT id FROM docs WHERE kind = 'inbound'")).toEqual([]);
    g.close();
  });
});

describe('configuration checks (SEC-13)', () => {
  it('names every unsafe production setting', () => {
    const env = { CORS_ORIGINS: '*', PUBLIC_URL: 'http://gaskin.example.ng', MESSAGING_MODE: 'live', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p', SUPPRESS_BELOW: '3' };
    const p = configProblems(loadConfig(env), env).join('\n');
    for (const want of [/CORS_ORIGINS/, /AUDIT_IP_SALT/, /https/, /WHATSAPP_APP_SECRET/, /SUPPRESS_BELOW/]) expect(p).toMatch(want);
    const good = { CORS_ORIGINS: 'https://app.example', PUBLIC_URL: 'https://gaskin.example.ng', AUDIT_IP_SALT: 'x'.repeat(32) };
    expect(configProblems(loadConfig(good), good)).toEqual([]);
  });
});

describe('public metrics never re-identify (SEC-14)', () => {
  it('withholds a rate whose numerator is small even when the denominator is large, and applies secondary suppression to stages', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A, FAC_B]);
    // 12 delivered mothers, 3 of them in a facility; plus 3 pregnant. Enrolled 15 is published, so with
    // "pregnant" hidden (3) the postpartum/infant counts would give it away unless they are hidden too.
    const ops = [];
    for (let i = 0; i < 3; i++) ops.push({ opId: `p-${i}`, kind: 'mother' as const, mother: profile(mother(`p-${i}`, FAC_A)) });
    const born = '2026-10-01T09:00:00.000Z';
    for (let i = 0; i < 12; i++) {
      const m = mother(`d-${i}`, FAC_A, { pregnancy: undefined, events: [visit(`v-${i}`, '2026-09-01T09:00:00.000Z', 1)] });
      ops.push({ opId: `m-${i}`, kind: 'mother' as const, mother: profile(m) });
      ops.push({ opId: `e-${i}`, kind: 'event' as const, motherId: m.id, event: { id: `b-${i}`, kind: 'birth', at: born, recordedBy: 'w', birth: { date: born, mode: 'vaginal', place: i < 3 ? 'facility' : 'home', complications: ['none'] }, child: { id: `c-${i}`, name: 'Baby', sex: 'F', dob: born, birthWeightKg: 3, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' } } as never });
    }
    await store.sync(user, { deviceId: 'd', cursor: 0, ops });
    const pm = await computePublicMetrics(db, store, { suppressBelow: 10, now: new Date('2026-11-05T09:00:00Z') });
    const ng = pm.countries.NG;
    expect(ng.facilityBirths.denominator.value).toBe(12);
    expect(ng.facilityBirths.percent).toBeNull(); // 3 of 12 would print as 25%
    expect(ng.mothersEnrolled.value).toBe(15);
    expect(ng.stage.pregnancy.suppressed).toBe(true);
    const hidden = Object.values(ng.stage).filter((x) => x.suppressed).length;
    expect(hidden).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(pm)).not.toMatch(/d-\d|Ngozi|Itire/);
  });
});

describe('AI proxy: placeholders for other people are never restored as hers (SEC-03)', () => {
  it("another mother's name in a prompt comes back as [PERSON], not as this mother's first name", async () => {
    const db = await testDb();
    const store = new Store(db);
    const cfg = testConfig({ AI_BASE_URL: 'http://m/v1', AI_MODEL: 'x' });
    const { user } = await makeUser(db, 'worker', [FAC_A], 'Bisola Adebayo');
    await store.sync(user, {
      deviceId: 'd',
      cursor: 0,
      ops: [
        { opId: '1', kind: 'mother', mother: profile(mother('m-1', FAC_A, { name: 'Chiamaka Okonkwo' })) },
        { opId: '2', kind: 'mother', mother: profile(mother('m-2', FAC_A, { name: 'Halima Garba', community: 'Tudun Wada' })) },
      ],
    });
    const echo = (async (_u: string | URL, init?: RequestInit) => {
      const content = JSON.parse(String(init?.body)).messages[1].content as string;
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }) as typeof fetch;
    const proxy = new AIProxy(cfg, db, store, echo);
    const r = await proxy.complete(user, { task: 'personalise', prompt: 'Hello Chiamaka. Halima Garba from Tudun Wada will come with you.', motherId: 'm-1' });
    expect(r.text).toContain('Hello Chiamaka.');
    expect(r.text).not.toMatch(/Halima|Garba|Tudun/);
    expect(r.text).not.toMatch(/Chiamaka from|Chiamaka will/);
  });
});
