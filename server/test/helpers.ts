import type { Mother, ClinicalEvent, OutboundMessage } from '../../src/types';
import { loadConfig, type ServerConfig } from '../src/config';
import { openDb, type DB } from '../src/db';
import { createUser, login, type AuthedUser } from '../src/auth';
import { seedFacilities } from '../src/seed';
import type { HostedRole } from '../../src/hosted/syncTypes';

/** GASKIN_TEST_DB=postgres://... runs the suite against Postgres (each test gets a clean schema) */
export async function testDb(): Promise<DB> {
  const url = process.env.GASKIN_TEST_DB;
  if (url) {
    const db = await openDb(url);
    for (const t of ['users', 'user_facilities', 'facilities', 'sessions', 'mothers', 'events', 'docs', 'changes', 'applied_ops', 'messages', 'message_costs', 'audit', 'user_settings', 'meta'])
      await db.run(`DELETE FROM ${t}`);
    await seedFacilities(db);
    return db;
  }
  const db = await openDb('sqlite::memory:');
  await seedFacilities(db);
  return db;
}

export function testConfig(over: Record<string, string> = {}): ServerConfig {
  return loadConfig({ DATABASE_URL: 'sqlite::memory:', SANDBOX_SENT_MS: '20', SANDBOX_DELIVERED_MS: '60', QUIET_HOURS: 'off', ...over });
}

let n = 0;
export async function makeUser(db: DB, role: HostedRole, facilityIds: string[], name = 'Test Worker'): Promise<{ user: AuthedUser; token: string; phone: string; pin: string }> {
  const phone = `+234803000${String(1000 + ++n).slice(-4)}`;
  const pin = '482916';
  await createUser(db, { phone, pin, name, role, facilityIds, country: 'NG' });
  const r = await login(db, { tokenDays: 1, pinMaxAttempts: 5, pinLockMinutes: 15, defaultCountry: 'NG' }, phone, pin, { id: `dev-${n}` });
  if (!r.ok) throw new Error('login failed');
  return { user: r.user, token: r.token, phone, pin };
}

export const FAC_A = 'f-ng-surulere-phc';
export const FAC_B = 'f-ng-limh';

export function mother(id: string, facilityId = FAC_A, over: Partial<Mother> = {}): Mother {
  return {
    id,
    name: 'Ngozi Eze',
    age: 27,
    country: 'NG',
    region: 'Lagos',
    community: 'Itire',
    language: 'en',
    literacy: 'good',
    phone: { access: 'smartphone', number: '08031112222', hasWhatsApp: true },
    incomeBand: 'low',
    gravida: 2,
    parity: 1,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [],
    allergies: [],
    genotype: 'AA',
    medications: [],
    pregnancy: { lmp: '2026-06-01', fetuses: 1, plannedBirthPlace: 'facility' },
    children: [],
    practicesMentioned: [],
    assignedWorkerId: 'w-ng-bisola',
    facilityId,
    enrolledAt: '2026-07-01T09:00:00.000Z',
    consent: { dataProcessing: true, messaging: true, recordedAt: '2026-07-01T09:00:00.000Z', recordedBy: 'w-ng-bisola' },
    events: [],
    ...over,
  };
}

export function visit(id: string, at: string, contactNumber = 1, visitType: 'anc' | 'pnc' = 'anc'): ClinicalEvent {
  return { id, kind: 'visit', at, recordedBy: 'w-ng-bisola', visitType, contactNumber, attended: true };
}

export function outbound(id: string, motherId: string, channel: OutboundMessage['channel'] = 'sms', body = 'Your next clinic visit is on Monday. Take your iron tablet daily.'): OutboundMessage {
  return { id, motherId, channel, language: 'en', body, estCostLocal: 2, estCostUSD: 0.0015, status: 'draft', createdAt: new Date().toISOString(), planVersion: 1, itemIds: ['visits.anc'], aiAssisted: false };
}

export function profile(m: Mother) {
  const { events: _e, ...p } = m;
  void _e;
  return p;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(fn: () => Promise<T | undefined | null | false> | T | undefined | null | false, ms = 3000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error('timed out waiting');
    await sleep(20);
  }
}
