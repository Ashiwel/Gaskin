/**
 * HTTP API (Hono). Routes:
 *
 *   GET  /healthz                         liveness (no data)
 *   GET  /api/config                      public: messaging mode, AI on/off, suppression threshold
 *   POST /api/auth/login                  { phone, pin, deviceId?, deviceName? } -> token
 *   POST /api/auth/logout
 *   GET  /api/me                          Identity
 *   GET  /api/snapshot                    everything the user may see, plus a cursor
 *   POST /api/sync                        SyncRequest -> SyncResponse (offline-first merge)
 *   GET  /api/events                      server-sent events: { type: 'changes' } nudges and message receipts
 *   GET  /api/mothers/:id/plan            the engine's plan for one mother, computed on the server
 *   GET  /api/alerts                      emergency/urgent alerts for the user's facilities
 *   POST /api/messages/send               SendMessageRequest -> SendMessageResponse
 *   POST /api/ai                          AIProxyRequest -> AIProxyResponse (or SSE when stream: true)
 *   POST /api/ai/preview                  what the server would send (de-identified), without sending
 *   GET  /api/settings/:key  PUT ...      per-user settings
 *   GET  /api/reports/dhis2?period=YYYYMM aggregate dataValueSets (supervisors, programme officers)
 *   POST /api/reports/dhis2/push          push to the configured DHIS2
 *   GET  /api/reports/costs?from=&to=     message cost log totals
 *   GET  /api/public/metrics              public, de-identified metrics (no login)
 *   GET  /api/audit                       audit log (admin, supervisor)
 *   POST /api/admin/users                 create an account (admin)
 *   POST /api/admin/facilities            create or update a facility (admin)
 *   *    /webhooks/:gateway[/:kind]       delivery receipts and inbound messages
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import type { InboundMessage, LearnedRule, Override } from '../../src/types';
import type { AIProxyRequest, LoginRequest, SendMessageRequest, ServerPublicConfig, SyncRequest } from '../../src/hosted/syncTypes';
import { buildPlan } from '../../src/engine';
import { parseSymptomsFromText } from '../../src/messaging';
import type { ServerConfig } from './config';
import type { DB } from './db';
import { nowIso, upsert } from './db';
import { type AuthedUser, CAN, authenticate, createUser, login, logout, normalisePhone, rotateSession, toIdentity, ROLES } from './auth';
import { audit } from './audit';
import { Store } from './store';
import { MessagingService } from './messaging/service';
import { WebhookAuthError, type FetchFn, type MessageGateway } from './messaging/gateway';
import { AIProxy, AIProxyError } from './ai';
import { buildDataValueSets, loadMapping, pushToDhis2 } from './dhis2';
import { computePublicMetrics, type PublicMetrics } from './metrics';
import { minSeq } from './retention';

type Env = { Variables: { user: AuthedUser; token: string } };

export interface AppDeps {
  cfg: ServerConfig;
  db: DB;
  fetch?: FetchFn;
  gateways?: MessageGateway[];
}

export interface GaskinServer {
  app: Hono<Env>;
  store: Store;
  messaging: MessagingService;
  ai: AIProxy;
  /** Nudge every connected device that changes are waiting */
  notify: (facilityIds: string[] | 'all') => void;
  close: () => void;
}

const VERSION = '0.1.0';

function ipOf(c: Context, trust: boolean): string | undefined {
  if (trust) {
    const xf = c.req.header('x-forwarded-for');
    if (xf) return xf.split(',')[0].trim();
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress;
}

export function createApp(deps: AppDeps): GaskinServer {
  const { cfg, db } = deps;
  const store = new Store(db);
  const messaging = new MessagingService(cfg, db, store, { fetch: deps.fetch, gateways: deps.gateways });
  const ai = new AIProxy(cfg, db, store, deps.fetch);
  const app = new Hono<Env>();
  const mapping = loadMapping(cfg.dhis2.mappingFile);

  // Live listeners for /api/events
  type Live = { user: AuthedUser; send: (event: string, data: unknown) => void };
  const live = new Set<Live>();
  const notify = (facilityIds: string[] | 'all') => {
    for (const l of live) if (facilityIds === 'all' || facilityIds.some((f) => l.user.facilityIds.includes(f))) l.send('changes', { at: nowIso() });
  };
  messaging.onStatus((u) => {
    if (!live.size || !u.motherId) return;
    void store.motherRow(u.motherId).then((row) => {
      if (!row) return;
      for (const l of live) if (CAN.readRecords(l.user.role) && l.user.facilityIds.includes(row.facility_id)) l.send('message', u);
    });
  });

  // Inbound SMS/WhatsApp: match the number to a mother the server knows, store it, flag danger signs
  messaging.onInbound = async (msg) => {
    const country = cfg.messaging.defaultCountry;
    const from = normalisePhone(msg.from, country);
    const mothers = await store.mothersAt('all');
    const mother = mothers.find((m) => m.phone?.number && normalisePhone(m.phone.number, m.country) === from);
    if (!mother) {
      await audit(db, { action: 'inbound.unmatched', outcome: 'ok', detail: { channel: msg.channel } });
      return;
    }
    const inbound: InboundMessage = {
      id: `in-${msg.providerMessageId ?? Date.now().toString(36)}`,
      motherId: mother.id,
      channel: msg.channel,
      body: msg.text.slice(0, 2000),
      receivedAt: msg.at,
      parsedSymptoms: parseSymptomsFromText(msg.text),
    };
    await db.tx((t) => store.saveDoc(t, undefined, undefined, 'inbound', inbound.id, inbound, mother.facilityId, mother.id));
    notify([mother.facilityId]);
  };

  // ---------- Middleware ----------

  // The server serves JSON, SSE and webhook replies, never pages, so its CSP forbids everything,
  // including being framed (clickjacking) and loading anything.
  app.use(
    '*',
    secureHeaders({
      crossOriginResourcePolicy: 'cross-origin',
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
      xFrameOptions: 'DENY',
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
    }),
  );
  // Responses hold health records: no shared cache, proxy or browser history may keep them
  app.use('/api/*', async (c, next) => {
    await next();
    if (c.req.path !== '/api/public/metrics' && c.req.path !== '/api/config') c.header('Cache-Control', 'no-store');
  });
  app.use(
    '/api/*',
    cors({
      // '*' reflects any origin and is for local development only; loadConfig refuses it in production
      origin: (origin) => (cfg.corsOrigins.includes('*') ? origin : cfg.corsOrigins.includes(origin) ? origin : null) ?? '',
      allowHeaders: ['Authorization', 'Content-Type', 'X-Device-Id'],
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use('/api/*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => c.json({ error: 'too_large', message: 'The upload is too large. Sync in smaller batches.' }, 413) }));

  const requireAuth = async (c: Context<Env>, next: () => Promise<void>) => {
    const h = c.req.header('authorization') ?? '';
    // EventSource cannot set headers, so /api/events alone may carry the token in the query string.
    // Everywhere else a query token is refused: URLs end up in proxy logs, history and Referer headers.
    const q = c.req.path === '/api/events' ? c.req.query('token') : undefined;
    const token = h.startsWith('Bearer ') ? h.slice(7) : (q ?? '');
    const user = await authenticate(db, token);
    if (!user) return c.json({ error: 'unauthorised', message: 'Please sign in again.' }, 401);
    c.set('user', user);
    c.set('token', token);
    await next();
  };

  // Login rate limit per IP and per phone number, on top of the per-account lock. The per-number
  // limit also slows an attacker who rotates addresses to guess one worker's PIN, and an attacker who
  // tries one PIN across many numbers is held by the per-IP limit. Both maps are bounded.
  const limiter = (max: number, windowMs: number, cap = 10_000) => {
    const m = new Map<string, { n: number; reset: number }>();
    return (key: string): boolean => {
      const now = Date.now();
      const a = m.get(key);
      if (!a || a.reset < now) {
        if (m.size >= cap) for (const [k, v] of m) if (v.reset < now || m.size >= cap) m.delete(k); else break;
        m.set(key, { n: 1, reset: now + windowMs });
        return false;
      }
      a.n++;
      return a.n > max;
    };
  };
  const ipLimit = limiter(30, 15 * 60_000);
  const phoneLimit = limiter(10, 15 * 60_000);
  const tooMany = (ip: string | undefined) => ipLimit(ip ?? 'unknown');

  // ---------- Public ----------

  app.get('/healthz', (c) => c.json({ ok: true, version: VERSION }));

  app.get('/api/config', (c) => {
    const body: ServerPublicConfig = {
      name: 'Gaskin',
      version: VERSION,
      messagingMode: cfg.messaging.mode,
      channels: messaging.publicRoutes(),
      ai: { enabled: ai.enabled, model: ai.enabled ? cfg.ai.model : undefined, residency: cfg.ai.residency },
      suppressBelow: cfg.suppressBelow,
    };
    return c.json(body);
  });

  let metricsCache: { at: number; body: PublicMetrics } | null = null;
  app.get('/api/public/metrics', async (c) => {
    if (!metricsCache || Date.now() - metricsCache.at > 3600_000) metricsCache = { at: Date.now(), body: await computePublicMetrics(db, store, { suppressBelow: cfg.suppressBelow }) };
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('Access-Control-Allow-Origin', '*');
    return c.json(metricsCache.body);
  });

  app.post('/api/auth/login', async (c) => {
    const ip = ipOf(c, cfg.trustProxy);
    if (tooMany(ip)) return c.json({ error: 'rate_limited', message: 'Too many sign-in attempts from this network. Wait 15 minutes.' }, 429);
    const b = (await c.req.json().catch(() => ({}))) as Partial<LoginRequest>;
    if (typeof b.phone !== 'string' || typeof b.pin !== 'string' || b.phone.length > 32 || b.pin.length > 16) return c.json({ error: 'invalid', message: 'Enter your phone number and PIN.' }, 400);
    if (phoneLimit(normalisePhone(b.phone, cfg.messaging.defaultCountry))) return c.json({ error: 'rate_limited', message: 'Too many sign-in attempts for this number. Wait 15 minutes.' }, 429);
    const r = await login(db, { ...cfg, defaultCountry: cfg.messaging.defaultCountry }, b.phone, b.pin, { id: b.deviceId, name: b.deviceName });
    if (!r.ok) {
      await audit(db, { action: 'auth.login', outcome: 'denied', ip, detail: { reason: r.reason } });
      const msg = r.reason === 'locked' ? `Too many wrong PINs. Try again after ${new Date(r.retryAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.` : r.reason === 'inactive' ? 'This account is switched off. Ask your supervisor.' : 'The phone number or PIN is not right.';
      return c.json({ error: r.reason, message: msg, retryAt: r.retryAt }, r.reason === 'locked' ? 423 : 401);
    }
    await audit(db, { userId: r.user.id, role: r.user.role, action: 'auth.login', outcome: 'ok', ip });
    return c.json({ token: r.token, expiresAt: r.expiresAt, user: toIdentity(r.user) });
  });

  // ---------- Authenticated ----------

  app.use('/api/*', async (c, next) => {
    const p = c.req.path;
    if (p === '/api/config' || p === '/api/public/metrics' || p === '/api/auth/login') return next();
    return requireAuth(c, next);
  });

  app.post('/api/auth/logout', async (c) => {
    await logout(db, c.get('token'));
    await audit(db, { userId: c.get('user').id, action: 'auth.logout', outcome: 'ok' });
    return c.json({ ok: true });
  });

  app.get('/api/me', (c) => c.json(toIdentity(c.get('user'))));

  // Swap the session token for a fresh one (the app calls this weekly and after a role change),
  // so a token copied from an old phone stops working without the worker signing in again.
  app.post('/api/auth/refresh', async (c) => {
    const user = c.get('user');
    const r = await rotateSession(db, c.get('token'), cfg.tokenDays);
    if (!r) return c.json({ error: 'unauthorised', message: 'Please sign in again.' }, 401);
    await audit(db, { userId: user.id, role: user.role, action: 'auth.refresh', outcome: 'ok' });
    return c.json({ token: r.token, expiresAt: r.expiresAt, user: toIdentity(user) });
  });

  app.get('/api/snapshot', async (c) => {
    const user = c.get('user');
    const snap = await store.snapshot(user);
    await audit(db, { userId: user.id, role: user.role, action: 'records.snapshot', outcome: 'ok', ip: ipOf(c, cfg.trustProxy), detail: { mothers: snap.mothers.length } });
    return c.json(snap);
  });

  app.post('/api/sync', async (c) => {
    const user = c.get('user');
    const req = (await c.req.json().catch(() => null)) as SyncRequest | null;
    if (!req || typeof req.deviceId !== 'string') return c.json({ error: 'invalid', message: 'deviceId and ops are required.' }, 400);
    const floor = await minSeq(db);
    if (req.cursor > 0 && req.cursor < floor) return c.json({ cursor: 0, more: false, accepted: [], duplicates: [], rejected: [], changes: [], serverTime: nowIso(), reset: true });
    const r = await store.sync({ ...user, deviceId: req.deviceId }, req);
    // Run the engine for every mother this upload touched: emergency alerts go to supervisors at once
    const alerts: Array<NonNullable<Awaited<ReturnType<typeof alertsFor>>>> = [];
    for (const id of r.touchedMotherIds) {
      const a = await alertsFor(id);
      if (a) alerts.push(a);
    }
    if (r.accepted.length) {
      const facs = new Set<string>();
      for (const id of r.touchedMotherIds) {
        const row = await store.motherRow(id);
        if (row) facs.add(row.facility_id);
      }
      notify(facs.size ? [...facs] : 'all');
      ai.invalidate();
    }
    await audit(db, {
      userId: user.id,
      role: user.role,
      action: 'records.sync',
      outcome: r.rejected.length ? 'denied' : 'ok',
      ip: ipOf(c, cfg.trustProxy),
      detail: { accepted: r.accepted.length, duplicates: r.duplicates.length, rejected: r.rejected.length, pulled: r.changes.length, mothers: r.touchedMotherIds.length },
    });
    const { touchedMotherIds: _t, ...body } = r;
    void _t;
    return c.json({ ...body, alerts });
  });

  async function planFor(motherId: string) {
    const mother = await store.mother(motherId);
    if (!mother) return null;
    const overrides = (await store.docs<Override>('override', [mother.facilityId])).filter((o) => o.motherId === motherId);
    const rules = await store.docs<LearnedRule>('rule', 'global');
    return { mother, plan: buildPlan(mother, nowIso(), { overrides, learnedRules: rules }) };
  }

  async function alertsFor(motherId: string) {
    try {
      const r = await planFor(motherId);
      if (!r) return null;
      const urgent = r.plan.alerts.filter((a) => a.level === 'emergency' || a.level === 'urgent');
      if (!urgent.length) return null;
      return { motherId, alertIds: urgent.map((a) => a.id), titles: urgent.map((a) => a.title), level: urgent.some((a) => a.level === 'emergency') ? ('emergency' as const) : ('urgent' as const) };
    } catch {
      return null;
    }
  }

  app.get('/api/mothers/:id/plan', async (c) => {
    const user = c.get('user');
    const row = await store.motherRow(c.req.param('id'));
    if (!row || !CAN.readRecords(user.role) || !user.facilityIds.includes(row.facility_id)) return c.json({ error: 'not_found' }, 404);
    const r = await planFor(row.id);
    await audit(db, { userId: user.id, role: user.role, action: 'records.plan', entity: 'mother', entityId: row.id, facilityId: row.facility_id, outcome: 'ok' });
    return c.json(r?.plan ?? null);
  });

  app.get('/api/alerts', async (c) => {
    const user = c.get('user');
    if (!CAN.readRecords(user.role)) return c.json([]);
    const mothers = await store.mothersAt(user.facilityIds);
    const rules = await store.docs<LearnedRule>('rule', 'global');
    const overrides = await store.docs<Override>('override', user.facilityIds);
    const out = [];
    for (const m of mothers) {
      try {
        const plan = buildPlan(m, nowIso(), { overrides: overrides.filter((o) => o.motherId === m.id), learnedRules: rules });
        for (const a of plan.alerts) if (a.level !== 'warning') out.push({ ...a, motherId: m.id, facilityId: m.facilityId });
      } catch {
        /* skip a record the engine cannot read */
      }
    }
    return c.json(out);
  });

  app.post('/api/messages/send', async (c) => {
    const user = c.get('user');
    if (!CAN.writeRecords(user.role)) return c.json({ error: 'forbidden', message: 'Your role cannot send messages.' }, 403);
    const req = (await c.req.json().catch(() => null)) as SendMessageRequest | null;
    if (!req?.message?.id || !req.message.motherId || !req.message.channel || typeof req.message.body !== 'string') return c.json({ error: 'invalid', message: 'message with id, motherId, channel and body is required.' }, 400);
    const r = await messaging.send(user, req);
    await audit(db, { userId: user.id, role: user.role, action: 'message.send', entity: 'message', entityId: req.message.id, outcome: r.status === 'failed' ? 'denied' : 'ok', detail: { channel: req.message.channel, status: r.status, simulated: r.simulated } });
    const row = await store.motherRow(req.message.motherId);
    if (row) notify([row.facility_id]);
    return c.json(r);
  });

  const aiError = (c: Context, e: unknown) => {
    if (e instanceof AIProxyError) return c.json({ error: e.code, message: e.message }, e.status as 400);
    console.error('[ai] unexpected failure'); // never log the error object: it may hold content
    return c.json({ error: 'server', message: 'The AI service failed.' }, 500);
  };

  app.post('/api/ai', async (c) => {
    const user = c.get('user');
    if (!CAN.writeRecords(user.role)) return c.json({ error: 'forbidden', message: 'Your role cannot use the AI service.' }, 403);
    const req = (await c.req.json().catch(() => null)) as AIProxyRequest | null;
    if (!req || typeof req.prompt !== 'string' || req.prompt.length > 64_000 || (req.motherId !== undefined && typeof req.motherId !== 'string')) return c.json({ error: 'invalid', message: 'Invalid request.' }, 400);
    if (req.task !== undefined && !['personalise', 'translate', 'extract', 'explain', 'suggest', 'back_translate'].includes(String(req.task))) return c.json({ error: 'invalid', message: 'Unknown AI task.' }, 400);
    const ip = ipOf(c, cfg.trustProxy);
    if (req.stream) {
      return streamSSE(c, async (s) => {
        try {
          const r = await ai.complete(user, req, ip, (text) => void s.writeSSE({ event: 'text', data: JSON.stringify({ text }) }));
          await s.writeSSE({ event: 'done', data: JSON.stringify(r) });
        } catch (e) {
          const err = e instanceof AIProxyError ? { error: e.code, message: e.message, status: e.status } : { error: 'server', message: 'The AI service failed.', status: 500 };
          await s.writeSSE({ event: 'error', data: JSON.stringify(err) });
        }
      });
    }
    try {
      return c.json(await ai.complete(user, req, ip));
    } catch (e) {
      return aiError(c, e);
    }
  });

  app.post('/api/ai/preview', async (c) => {
    const user = c.get('user');
    const user0 = c.get('user');
    // Preview runs the same scrub as a real call and returns which identifiers it found, so it needs the same role
    if (!CAN.writeRecords(user0.role)) return c.json({ error: 'forbidden', message: 'Your role cannot use the AI service.' }, 403);
    const req = (await c.req.json().catch(() => null)) as AIProxyRequest | null;
    if (!req?.prompt || typeof req.prompt !== 'string' || req.prompt.length > 64_000) return c.json({ error: 'invalid' }, 400);
    try {
      const d = await ai.deidentifyPrompt(user, req);
      return c.json({ text: d.text, removed: d.removed, leaks: d.leaks, wouldSend: ai.enabled && !d.leaks.length, model: cfg.ai.model, residency: cfg.ai.residency });
    } catch (e) {
      return aiError(c, e);
    }
  });

  const settingKey = (k: string) => /^[A-Za-z0-9._-]{1,80}$/.test(k);
  app.get('/api/settings/:key', async (c) => {
    if (!settingKey(c.req.param('key'))) return c.json({ error: 'invalid' }, 400);
    const row = await db.get<{ value: string }>('SELECT value FROM user_settings WHERE user_id = ? AND key = ?', [c.get('user').id, c.req.param('key')]);
    return c.json({ value: row ? JSON.parse(row.value) : null });
  });

  app.put('/api/settings/:key', async (c) => {
    if (!settingKey(c.req.param('key'))) return c.json({ error: 'invalid' }, 400);
    const b = (await c.req.json().catch(() => ({}))) as { value?: unknown };
    const v = JSON.stringify(b.value ?? null);
    if (v.length > 64 * 1024) return c.json({ error: 'too_large' }, 413);
    await db.run(upsert(db, 'user_settings', ['user_id', 'key', 'value', 'updated_at'], ['user_id', 'key']), [c.get('user').id, c.req.param('key').slice(0, 80), v, nowIso()]);
    return c.json({ ok: true });
  });

  // ---------- Reports ----------

  async function dhis2Export(user: AuthedUser, period: string) {
    const facs = user.role === 'programme_officer' || user.role === 'admin' ? await db.all<{ id: string; dhis2_org_unit: string | null }>('SELECT id, dhis2_org_unit FROM facilities ORDER BY id') : await db.all<{ id: string; dhis2_org_unit: string | null }>(`SELECT id, dhis2_org_unit FROM facilities WHERE id IN (${user.facilityIds.map(() => '?').join(',') || "''"}) ORDER BY id`, user.facilityIds);
    const byFacility = [];
    for (const f of facs) byFacility.push({ facilityId: f.id, dhis2OrgUnit: f.dhis2_org_unit, mothers: await store.mothersAt([f.id]) });
    return buildDataValueSets(byFacility, period, { suppressBelow: cfg.suppressBelow, mapping, dataSet: cfg.dhis2.dataSet });
  }

  const validPeriod = (p: string | undefined) => (p && /^\d{6}$/.test(p) ? p : undefined);

  app.get('/api/reports/dhis2', async (c) => {
    const user = c.get('user');
    if (!CAN.aggregates(user.role)) return c.json({ error: 'forbidden', message: 'Reports are for supervisors and programme officers.' }, 403);
    const period = validPeriod(c.req.query('period')) ?? nowIso().slice(0, 7).replace('-', '');
    const exp = await dhis2Export(user, period);
    await audit(db, { userId: user.id, role: user.role, action: 'report.dhis2', outcome: 'ok', detail: { period, sets: exp.dataValueSets.length, suppressed: exp.suppressed.length } });
    return c.json(exp);
  });

  app.post('/api/reports/dhis2/push', async (c) => {
    const user = c.get('user');
    if (user.role !== 'programme_officer' && user.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    if (!cfg.dhis2.url || !cfg.dhis2.username || !cfg.dhis2.password) return c.json({ error: 'unavailable', message: 'DHIS2_URL, DHIS2_USERNAME and DHIS2_PASSWORD are not set.' }, 503);
    const b = (await c.req.json().catch(() => ({}))) as { period?: string };
    const period = validPeriod(b.period);
    if (!period) return c.json({ error: 'invalid', message: 'period must be YYYYMM.' }, 400);
    const exp = await dhis2Export(user, period);
    const results = await pushToDhis2(exp, { url: cfg.dhis2.url, username: cfg.dhis2.username, password: cfg.dhis2.password }, deps.fetch);
    await audit(db, { userId: user.id, role: user.role, action: 'report.dhis2.push', outcome: results.every((r) => r.status < 300) ? 'ok' : 'error', detail: { period, statuses: results.map((r) => r.status) } });
    return c.json({ period, results, suppressed: exp.suppressed.length });
  });

  app.get('/api/reports/costs', async (c) => {
    const user = c.get('user');
    if (!CAN.costs(user.role)) return c.json({ error: 'forbidden' }, 403);
    const isDay = (x: string | undefined) => !!x && /^\d{4}-\d{2}-\d{2}/.test(x) && !Number.isNaN(Date.parse(x));
    const from = isDay(c.req.query('from')) ? c.req.query('from')! : '1970-01-01';
    const to = isDay(c.req.query('to')) ? c.req.query('to')! : '9999-12-31';
    const rows = await db.all(
      `SELECT channel, provider, currency, source, COUNT(DISTINCT message_id) AS messages, SUM(units) AS units, SUM(cost_local) AS cost_local, SUM(cost_usd) AS cost_usd
       FROM message_costs WHERE at >= ? AND at <= ? GROUP BY channel, provider, currency, source ORDER BY channel, provider`,
      [from, to],
    );
    return c.json({ from, to, rows, note: "'estimate' rows come from Gaskin's price table when a message is sent; 'provider' rows are what the gateway reported." });
  });

  app.get('/api/audit', async (c) => {
    const user = c.get('user');
    if (!CAN.readAudit(user.role)) return c.json({ error: 'forbidden' }, 403);
    const limit = Math.min(Number(c.req.query('limit') ?? 200) || 200, 1000);
    const rows =
      user.role === 'admin'
        ? await db.all('SELECT * FROM audit ORDER BY id DESC LIMIT ?', [limit])
        : await db.all(`SELECT * FROM audit WHERE facility_id IN (${user.facilityIds.map(() => '?').join(',') || "''"}) OR user_id = ? ORDER BY id DESC LIMIT ?`, [...user.facilityIds, user.id, limit]);
    return c.json(rows);
  });

  // ---------- Admin ----------

  app.post('/api/admin/users', async (c) => {
    const user = c.get('user');
    if (!CAN.manageUsers(user.role)) return c.json({ error: 'forbidden' }, 403);
    const b = (await c.req.json().catch(() => ({}))) as Parameters<typeof createUser>[1];
    if (typeof b.phone !== 'string' || typeof b.pin !== 'string' || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 120 || !ROLES.includes(b.role) || !Array.isArray(b.facilityIds) || b.facilityIds.length > 200 || !b.facilityIds.every((f) => typeof f === 'string' && f.length <= 120))
      return c.json({ error: 'invalid', message: 'phone, pin, name, role and facilityIds are required.' }, 400);
    const known = new Set((await db.all<{ id: string }>('SELECT id FROM facilities')).map((r) => r.id));
    const unknownFac = b.facilityIds.find((f) => !known.has(f));
    if (unknownFac) return c.json({ error: 'invalid', message: `Unknown facility ${unknownFac}. Create it first.` }, 400);
    try {
      const id = await createUser(db, b);
      await audit(db, { userId: user.id, role: user.role, action: 'admin.user.create', entity: 'user', entityId: id, outcome: 'ok', detail: { role: b.role, facilities: b.facilityIds.length } });
      return c.json({ id });
    } catch (e) {
      // Never echo a database error: it can carry SQL, table names or another account's details
      const msg = (e as Error).message;
      return c.json({ error: 'invalid', message: /unique/i.test(msg) ? 'That phone number already has an account.' : /PIN|role/.test(msg) ? msg : 'The account could not be created.' }, 400);
    }
  });

  app.post('/api/admin/facilities', async (c) => {
    const user = c.get('user');
    if (!CAN.manageUsers(user.role)) return c.json({ error: 'forbidden' }, 403);
    const b = (await c.req.json().catch(() => ({}))) as { id?: string; name?: string; country?: string; region?: string; dhis2OrgUnit?: string };
    if (typeof b.id !== 'string' || !/^[A-Za-z0-9._-]{1,120}$/.test(b.id) || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200 || !['NG', 'KE', 'GH'].includes(String(b.country)))
      return c.json({ error: 'invalid', message: 'id (letters, digits, dot, dash), name and country (NG, KE or GH) are required.' }, 400);
    await db.run(upsert(db, 'facilities', ['id', 'name', 'country', 'region', 'dhis2_org_unit'], ['id']), [b.id, b.name, b.country, b.region ?? null, b.dhis2OrgUnit ?? null]);
    await audit(db, { userId: user.id, role: user.role, action: 'admin.facility.upsert', entity: 'facility', entityId: b.id, outcome: 'ok' });
    ai.invalidate();
    return c.json({ ok: true });
  });

  // ---------- Live updates ----------

  app.get('/api/events', (c) => {
    const user = c.get('user');
    return streamSSE(c, async (s) => {
      let open = true;
      const me: Live = {
        user,
        send: (event, data) => {
          if (!open) return;
          void s.writeSSE({ event, data: JSON.stringify(data) }).catch(() => (open = false));
        },
      };
      live.add(me);
      s.onAbort(() => {
        open = false;
        live.delete(me);
      });
      await s.writeSSE({ event: 'hello', data: JSON.stringify({ at: nowIso() }) });
      while (open) {
        await s.sleep(25_000);
        if (open) await s.writeSSE({ event: 'ping', data: '{}' }).catch(() => (open = false));
      }
    });
  });

  // ---------- Webhooks ----------

  const webhook = async (c: Context, gatewayId: string) => {
    const rawBody = c.req.method === 'GET' ? '' : await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    try {
      const r = await messaging.handleWebhook(gatewayId, { method: c.req.method, headers, query: c.req.query(), rawBody, contentType: headers['content-type'] ?? '' });
      if (!r) return c.text('unknown gateway', 404);
      notify('all');
      if (r.response) return c.body(r.response.body, r.response.status as 200, { 'Content-Type': r.response.contentType });
      return c.text('ok');
    } catch (e) {
      if (e instanceof WebhookAuthError) {
        await audit(db, { action: `webhook.${gatewayId}`, outcome: 'denied', ip: ipOf(c, cfg.trustProxy) });
        return c.text('bad signature', 401);
      }
      console.error(`[webhook] ${gatewayId} failed`);
      return c.text('error', 500);
    }
  };
  app.all('/webhooks/africastalking/sms', (c) => webhook(c, 'africastalking_sms'));
  app.all('/webhooks/africastalking/inbound', (c) => webhook(c, 'africastalking_sms'));
  app.all('/webhooks/africastalking/voice', (c) => webhook(c, 'africastalking_voice'));
  app.all('/webhooks/termii', (c) => webhook(c, 'termii_sms'));
  app.all('/webhooks/whatsapp', (c) => webhook(c, 'whatsapp_cloud'));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[server] error', err.name); // no message: it may hold record content
    return c.json({ error: 'server', message: 'Something went wrong on the server.' }, 500);
  });

  return {
    app,
    store,
    messaging,
    ai,
    notify,
    close: () => messaging.close(),
  };
}
