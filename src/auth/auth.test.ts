import { describe, expect, it } from 'vitest';
import { memoryKV } from '../storage/kv';
import { createSeedState } from '../data';
import { AuthStore, can, caseloadFor, constantTimeEqual, hashSecret, hostedRole, missingActors, pinProblem, profileFromWorker, verifySecret, PIN_ITERATIONS, type WorkerProfile } from './index';

// Lower iterations in tests only; production uses 210,000 (asserted below).
const ITER = 1000;

function clock(start = '2026-11-05T09:00:00.000Z') {
  let t = Date.parse(start);
  return { now: () => new Date(t).toISOString(), advance: (min: number) => (t += min * 60_000) };
}

const base = (id: string, over: Partial<WorkerProfile> = {}): Omit<WorkerProfile, 'active' | 'createdAt' | 'createdBy'> => ({
  id,
  name: id,
  role: 'worker',
  cadre: 'midwife',
  facilityId: 'f1',
  communities: [],
  languages: ['en'],
  isClinicalReviewer: false,
  isSupervisor: false,
  ...over,
});

async function setup(opts: { encryptData?: boolean } = {}) {
  const c = clock();
  const kv = memoryKV();
  const store = new AuthStore({ kv, now: c.now, iterations: ITER, encryptData: opts.encryptData });
  const sup = await store.addWorker(base('sup', { role: 'supervisor', isSupervisor: true }), '4826');
  await store.login('sup', '4826');
  const w = await store.addWorker(base('amina'), '7391');
  return { store, c, kv, supCode: sup.recoveryCode, aminaCode: w.recoveryCode };
}

describe('PIN hashing', () => {
  it('uses PBKDF2 with 210,000 iterations and a fresh salt, and compares in constant time', async () => {
    expect(PIN_ITERATIONS).toBe(210_000);
    const a = await hashSecret('2468', ITER);
    const b = await hashSecret('2468', ITER);
    expect(a.salt).not.toBe(b.salt);
    expect(await verifySecret('2468', a)).toBe(true);
    expect(await verifySecret('2469', a)).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(pinProblem('1234')).toBeTruthy();
    expect(pinProblem('0000')).toBeTruthy();
    expect(pinProblem('7391')).toBeNull();
  });
});

describe('lockout and recovery', () => {
  it('locks after 5 wrong PINs with growing backoff (1, 5, 15, 60 minutes), never permanently', async () => {
    const { store, c } = await setup();
    const wrong = async () => store.verifyPin('amina', '0001').catch((e) => e.code);
    for (let i = 0; i < 4; i++) expect(await wrong()).toBe('wrong_pin');
    expect(store.unlockStatus('amina').attemptsLeft).toBe(1);
    expect(await wrong()).toBe('locked');
    let st = store.unlockStatus('amina');
    expect(st.locked).toBe(true);
    expect(Date.parse(st.lockedUntil!) - Date.parse(c.now())).toBe(60_000);
    expect(await store.verifyPin('amina', '7391').catch((e) => e.code)).toBe('locked'); // right PIN still refused while locked
    c.advance(1);
    for (let i = 0; i < 5; i++) await wrong();
    st = store.unlockStatus('amina');
    expect(Date.parse(st.lockedUntil!) - Date.parse(c.now())).toBe(5 * 60_000);
    c.advance(5);
    for (let i = 0; i < 5; i++) await wrong();
    expect(Date.parse(store.unlockStatus('amina').lockedUntil!) - Date.parse(c.now())).toBe(15 * 60_000);
    c.advance(15);
    for (let i = 0; i < 5; i++) await wrong();
    expect(Date.parse(store.unlockStatus('amina').lockedUntil!) - Date.parse(c.now())).toBe(60 * 60_000);
    c.advance(60);
    expect(await store.verifyPin('amina', '7391')).toBe(true);
    expect(store.unlockStatus('amina')).toMatchObject({ locked: false, attemptsLeft: 5, nextLockMinutes: 1 });
    expect(store.auditLog().filter((a) => a.action === 'pin.lockout')).toHaveLength(4);
  });

  it('resets a PIN with the one-time recovery code, which then stops working', async () => {
    const { store, aminaCode } = await setup();
    for (let i = 0; i < 5; i++) await store.verifyPin('amina', '0001').catch(() => undefined);
    expect(store.unlockStatus('amina').locked).toBe(true);
    const next = await store.resetPinWithRecoveryCode('amina', aminaCode.toLowerCase(), '5820');
    expect(next).not.toBe(aminaCode);
    expect(store.unlockStatus('amina').locked).toBe(false);
    expect(await store.verifyPin('amina', '5820')).toBe(true);
    await expect(store.resetPinWithRecoveryCode('amina', aminaCode, '6931')).rejects.toMatchObject({ code: 'wrong_code' });
    expect(store.auditLog().some((a) => a.action === 'pin.reset.recovery' && a.outcome === 'ok')).toBe(true);
  });

  it('a supervisor resets another worker’s PIN after confirming her own; a worker cannot', async () => {
    const { store } = await setup();
    await expect(store.resetPinBySupervisor('sup', '9999', 'amina', '5820')).rejects.toMatchObject({ code: 'wrong_pin' });
    await store.resetPinBySupervisor('sup', '4826', 'amina', '5820');
    expect(await store.verifyPin('amina', '5820')).toBe(true);
    await expect(store.resetPinBySupervisor('amina', '5820', 'sup', '1357')).rejects.toMatchObject({ code: 'forbidden' });
    const log = store.auditLog().filter((a) => a.action === 'pin.reset.supervisor');
    expect(log.map((a) => a.outcome)).toEqual(['ok', 'denied']);
    expect(JSON.stringify(store.auditLog())).not.toMatch(/5820|4826/);
  });

  it('with storage encryption, the data key opens with the PIN or the recovery code', async () => {
    const c = clock();
    const store = new AuthStore({ kv: memoryKV(), now: c.now, iterations: ITER, encryptData: true });
    const { recoveryCode } = await store.addWorker(base('me', { personal: true, cadre: 'self' }), '7391');
    await store.login('me', '7391');
    const k1 = await store.dataKey();
    expect(k1).toBeTruthy();
    const iv = new Uint8Array(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1!, new TextEncoder().encode('her record'));
    await store.logout();
    expect(await store.dataKey()).toBeNull();
    await store.resetPinWithRecoveryCode('me', recoveryCode, '5820');
    await store.login('me', '5820');
    const k2 = (await store.dataKey())!;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k2, ct);
    expect(new TextDecoder().decode(pt)).toBe('her record');
  });
});

describe('sessions and workers', () => {
  it('auto-locks after inactivity, switches worker, logs out, and persists', async () => {
    const { store, c, kv } = await setup();
    expect(store.current()?.id).toBe('sup');
    c.advance(3);
    store.touch();
    c.advance(4);
    expect(store.current()?.id).toBe('sup');
    c.advance(6);
    expect(store.current()).toBeNull();
    expect(store.auditLog().some((a) => a.action === 'session.autolock')).toBe(true);
    await store.login('sup', '4826');
    await store.switchWorker('amina', '7391');
    expect(store.current()?.id).toBe('amina');
    expect(store.auditLog().some((a) => a.action === 'session.switch')).toBe(true);
    await store.logout();
    expect(store.current()).toBeNull();
    const again = new AuthStore({ kv, now: c.now, iterations: ITER });
    await again.load();
    expect(again.listWorkers().map((w) => w.id)).toEqual(['sup', 'amina']);
  });

  it('only a supervisor or admin adds, deactivates or reactivates workers; deactivated workers cannot sign in', async () => {
    const { store } = await setup();
    await store.deactivateWorker('amina');
    await expect(store.login('amina', '7391')).rejects.toMatchObject({ code: 'inactive' });
    await store.reactivateWorker('amina');
    await store.login('amina', '7391');
    await expect(store.addWorker(base('kemi'), '2580')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(store.deactivateWorker('sup')).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('permissions and caseload', () => {
  const p = (over: Partial<WorkerProfile>): WorkerProfile => ({ ...base('x'), active: true, createdAt: '', createdBy: '', ...over });
  it('can() follows the roles', () => {
    const worker = p({});
    const sup = p({ role: 'supervisor', isSupervisor: true });
    const rev = p({ role: 'clinical_reviewer', isClinicalReviewer: true });
    const po = p({ role: 'programme_officer' });
    const admin = p({ role: 'admin' });
    const me = p({ personal: true, cadre: 'self' });
    expect(can(worker, 'view_own_caseload')).toBe(true);
    expect(can(worker, 'view_facility')).toBe(false);
    expect(can(worker, 'approve_proposals')).toBe(false);
    expect(can(sup, 'view_facility')).toBe(true);
    expect(can(sup, 'manage_workers')).toBe(true);
    expect(can(rev, 'approve_proposals')).toBe(true);
    expect(can(rev, 'publish_releases')).toBe(true);
    expect(can(po, 'view_own_caseload')).toBe(false);
    expect(can(po, 'view_insights_wider')).toBe(true);
    expect(can(admin, 'manage_workers')).toBe(true);
    expect(can(admin, 'edit_plan')).toBe(false);
    expect(can(me, 'view_own_caseload')).toBe(true);
    expect(can(me, 'view_facility')).toBe(false);
    expect(can({ ...worker, active: false }, 'view_own_caseload')).toBe(false);
  });

  it('a worker sees her own mothers by default and the facility when permitted; seed workers map to hosted roles', () => {
    const seed = createSeedState();
    const bisola = profileFromWorker(seed.workers.find((w) => w.id === 'w-ng-bisola')!, seed.mothers);
    const own = caseloadFor(bisola, seed.mothers);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((m) => m.assignedWorkerId === 'w-ng-bisola')).toBe(true);
    expect(caseloadFor(bisola, seed.mothers, 'facility')).toEqual(own);
    const bankole = profileFromWorker(seed.workers.find((w) => w.id === 'w-ng-bankole')!, seed.mothers);
    expect(hostedRole(bankole)).toBe('clinical_reviewer');
    const sup = { ...bisola, isSupervisor: true };
    expect(caseloadFor(sup, seed.mothers, 'facility').length).toBeGreaterThanOrEqual(own.length);
    // Seed data: every event, override, message and approval names its actor.
    expect(missingActors(seed)).toEqual([]);
  });
});
