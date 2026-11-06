/**
 * Several health workers on one device: local profiles, PINs, lockout with backoff, sessions with
 * auto-lock, switching worker, recovery, and an audit log.
 *
 * Lockout: 5 wrong PINs lock the profile for 1 minute; each further lockout lasts longer (5, 15,
 * then 60 minutes) and the count resets on a correct PIN. A lockout always ends on its own; it is never
 * permanent. Recovery: (a) the one-time recovery code shown when she set her PIN (only its hash is kept),
 * (b) a supervisor or facility admin resets it after confirming her own PIN. For a sole user (personal
 * mode, a single-worker device) the recovery code is the only route, so when storage encryption is on
 * the data key is wrapped twice: by a key from her PIN and by a key from her recovery code.
 *
 * Every lockout, reset, recovery, sign-in and change to a profile is audited (no PINs or codes are logged).
 */
import type { KV } from '../storage/kv';
import { memoryKV } from '../storage/kv';
import { can } from './permissions';
import { hashSecret, importDataKey, newRecoveryCode, normaliseRecoveryCode, pinProblem, PIN_ITERATIONS, randomBytes, unwrapRaw, verifySecret, wrapRaw } from './pin';
import { AuthError, type AuthAuditEntry, type Credentials, type Session, type UnlockStatus, type WorkerProfile } from './types';

export const MAX_ATTEMPTS = 5;
/** Minutes locked after the 1st, 2nd, 3rd and later lockouts */
export const LOCK_MINUTES = [1, 5, 15, 60];
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

const KEY = 'gaskin.auth.v1';

interface Persisted {
  workers: WorkerProfile[];
  credentials: Record<string, Credentials>;
  audit: AuthAuditEntry[];
  autoLockMinutes: number;
  encryptData: boolean;
}

export interface AuthStoreOptions {
  kv?: KV;
  now?: () => string;
  /** PBKDF2 iterations (tests may lower it; production keeps 210,000) */
  iterations?: number;
  autoLockMinutes?: number;
  /** Wrap a device data key with each worker's PIN and recovery code (storage encryption on) */
  encryptData?: boolean;
}

export class AuthStore {
  private data: Persisted;
  private session: Session | null = null;
  private dataKeyRaw: Uint8Array | null = null;
  private kv: KV;
  private now: () => string;
  private iterations: number;
  private listeners = new Set<() => void>();

  constructor(opts: AuthStoreOptions = {}) {
    this.kv = opts.kv ?? memoryKV();
    this.now = opts.now ?? (() => new Date().toISOString());
    this.iterations = opts.iterations ?? PIN_ITERATIONS;
    this.data = { workers: [], credentials: {}, audit: [], autoLockMinutes: opts.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES, encryptData: !!opts.encryptData };
  }

  /** Load saved profiles. Safe to call more than once. */
  async load(): Promise<void> {
    const saved = await this.kv.get<Persisted>(KEY);
    if (saved && Array.isArray(saved.workers)) this.data = { ...this.data, ...saved };
    this.emit();
  }

  private async save(): Promise<void> {
    await this.kv.set(KEY, this.data);
    this.emit();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private audit(actorId: string, action: AuthAuditEntry['action'], outcome: AuthAuditEntry['outcome'], targetId?: string, detail?: string): void {
    this.data.audit.push({ id: `aa-${this.data.audit.length + 1}-${Date.parse(this.now()).toString(36)}`, at: this.now(), actorId, action, targetId, outcome, detail });
    if (this.data.audit.length > 2000) this.data.audit = this.data.audit.slice(-2000);
  }

  // ---------- Profiles ----------

  listWorkers(opts: { includeInactive?: boolean } = {}): WorkerProfile[] {
    return this.data.workers.filter((w) => opts.includeInactive || w.active);
  }

  getWorker(id: string): WorkerProfile | undefined {
    return this.data.workers.find((w) => w.id === id);
  }

  /** True when no profile exists yet: the first profile is created without a signed-in actor. */
  isEmpty(): boolean {
    return this.data.workers.length === 0;
  }

  /**
   * Add a worker and set her PIN. The first profile on a device needs no actor (she becomes the
   * admin or the sole user); after that, only a signed-in supervisor or admin can add workers.
   * Returns her one-time recovery code: show it once and ask her to write it down.
   */
  async addWorker(profile: Omit<WorkerProfile, 'active' | 'createdAt' | 'createdBy'>, pin: string): Promise<{ worker: WorkerProfile; recoveryCode: string }> {
    const first = this.isEmpty();
    const actor = first ? profile.id : this.requireActor('manage_workers');
    if (this.getWorker(profile.id)) throw new AuthError('invalid', `A worker with id ${profile.id} already exists.`);
    const worker: WorkerProfile = { ...profile, active: true, createdAt: this.now(), createdBy: actor };
    this.data.workers.push(worker);
    const code = await this.setCredentials(worker.id, pin, first);
    this.audit(actor, 'worker.create', 'ok', worker.id, `${worker.role}${first ? ' (first profile)' : ''}`);
    await this.save();
    return { worker, recoveryCode: code };
  }

  async updateWorker(id: string, patch: Partial<Omit<WorkerProfile, 'id' | 'createdAt' | 'createdBy'>>): Promise<WorkerProfile> {
    const actor = this.session?.workerId;
    const self = actor === id && !('role' in patch) && !('isSupervisor' in patch) && !('isClinicalReviewer' in patch) && !('active' in patch);
    const by = self ? actor! : this.requireActor('manage_workers');
    const w = this.mustGet(id);
    Object.assign(w, patch);
    this.audit(by, 'worker.update', 'ok', id, Object.keys(patch).join(','));
    await this.save();
    return w;
  }

  async deactivateWorker(id: string): Promise<void> {
    const actor = this.requireActor('manage_workers');
    if (actor === id) throw new AuthError('invalid', 'You cannot deactivate your own profile while signed in.');
    const w = this.mustGet(id);
    w.active = false;
    w.deactivatedAt = this.now();
    w.deactivatedBy = actor;
    this.audit(actor, 'worker.deactivate', 'ok', id);
    await this.save();
  }

  async reactivateWorker(id: string): Promise<void> {
    const actor = this.requireActor('manage_workers');
    const w = this.mustGet(id);
    w.active = true;
    w.deactivatedAt = undefined;
    w.deactivatedBy = undefined;
    this.audit(actor, 'worker.reactivate', 'ok', id);
    await this.save();
  }

  // ---------- PIN and lockout ----------

  private async setCredentials(id: string, pin: string, first: boolean): Promise<string> {
    const problem = pinProblem(pin);
    if (problem) throw new AuthError('weak_pin', problem);
    const code = newRecoveryCode();
    const prev = this.data.credentials[id];
    const cred: Credentials = {
      pin: await hashSecret(pin, this.iterations),
      recovery: await hashSecret(normaliseRecoveryCode(code), this.iterations),
      failedAttempts: 0,
      lockLevel: 0,
      pinSetAt: this.now(),
    };
    if (this.data.encryptData) {
      // First profile creates the device data key; later profiles wrap the key that is unlocked now.
      let raw = this.dataKeyRaw;
      if (!raw && first) raw = randomBytes(32);
      if (!raw && prev?.dataKey) raw = null; // cannot rewrap without the key: kept unwrapped below
      if (raw) {
        this.dataKeyRaw = raw;
        cred.dataKey = { byPin: await wrapRaw(raw, pin, this.iterations), byRecovery: await wrapRaw(raw, normaliseRecoveryCode(code), this.iterations) };
      }
    }
    this.data.credentials[id] = cred;
    this.audit(this.session?.workerId ?? id, 'pin.set', 'ok', id);
    return code;
  }

  /** Change her own PIN (needs the current one). Returns a new recovery code; the old one stops working. */
  async changePin(id: string, currentPin: string, newPin: string): Promise<string> {
    await this.verifyPin(id, currentPin);
    if (this.data.encryptData && !this.dataKeyRaw) await this.unlockDataKeyWith(id, currentPin, 'pin');
    const code = await this.setCredentials(id, newPin, false);
    await this.save();
    return code;
  }

  unlockStatus(id: string): UnlockStatus {
    const c = this.data.credentials[id];
    const w = this.getWorker(id);
    const now = Date.parse(this.now());
    const lockedUntil = c?.lockedUntil && Date.parse(c.lockedUntil) > now ? c.lockedUntil : undefined;
    return {
      locked: !!lockedUntil,
      lockedUntil,
      attemptsLeft: c ? Math.max(0, MAX_ATTEMPTS - c.failedAttempts) : 0,
      nextLockMinutes: LOCK_MINUTES[Math.min(c?.lockLevel ?? 0, LOCK_MINUTES.length - 1)],
      active: !!w?.active,
    };
  }

  /** Check a PIN. Throws AuthError('locked' | 'wrong_pin' | 'inactive' | 'not_found'). */
  async verifyPin(id: string, pin: string): Promise<true> {
    const w = this.getWorker(id);
    const c = this.data.credentials[id];
    if (!w || !c) throw new AuthError('not_found', 'No such profile on this device.');
    if (!w.active) throw new AuthError('inactive', 'This profile has been deactivated. Ask your supervisor.');
    const st = this.unlockStatus(id);
    if (st.locked) {
      this.audit(id, 'pin.verify', 'denied', id, 'locked');
      await this.save();
      throw new AuthError('locked', `Too many wrong PINs. Try again after ${new Date(st.lockedUntil!).toISOString().slice(11, 16)} UTC, or use your recovery code.`);
    }
    // A lockout that has ended gives a fresh set of attempts.
    if (c.lockedUntil && !st.locked) {
      c.lockedUntil = undefined;
      c.failedAttempts = 0;
    }
    const ok = await verifySecret(pin, c.pin);
    if (ok) {
      c.failedAttempts = 0;
      c.lockLevel = 0;
      this.audit(id, 'pin.verify', 'ok', id);
      await this.save();
      return true;
    }
    c.failedAttempts += 1;
    if (c.failedAttempts >= MAX_ATTEMPTS) {
      const minutes = LOCK_MINUTES[Math.min(c.lockLevel, LOCK_MINUTES.length - 1)];
      c.lockedUntil = new Date(Date.parse(this.now()) + minutes * 60_000).toISOString();
      c.lockLevel += 1;
      this.audit(id, 'pin.lockout', 'denied', id, `${minutes} min`);
    } else {
      this.audit(id, 'pin.verify', 'denied', id, `${MAX_ATTEMPTS - c.failedAttempts} left`);
    }
    await this.save();
    throw new AuthError(c.lockedUntil ? 'locked' : 'wrong_pin', c.lockedUntil ? `Too many wrong PINs. Locked for ${LOCK_MINUTES[Math.min(c.lockLevel - 1, LOCK_MINUTES.length - 1)]} minutes.` : `Wrong PIN. ${MAX_ATTEMPTS - c.failedAttempts} tries left.`);
  }

  /**
   * Recovery route (a): her one-time recovery code sets a new PIN, clears any lockout, and returns a
   * new recovery code (the used one stops working). Wrong codes count towards the same lockout.
   */
  async resetPinWithRecoveryCode(id: string, code: string, newPin: string): Promise<string> {
    const c = this.data.credentials[id];
    const w = this.getWorker(id);
    if (!w || !c) throw new AuthError('not_found', 'No such profile on this device.');
    if (!w.active) throw new AuthError('inactive', 'This profile has been deactivated. Ask your supervisor.');
    const st = this.unlockStatus(id);
    if (st.locked && c.failedAttempts >= MAX_ATTEMPTS + 5) throw new AuthError('locked', 'Too many wrong codes. Wait and try again.');
    const norm = normaliseRecoveryCode(code);
    if (!(await verifySecret(norm, c.recovery))) {
      c.failedAttempts += 1;
      this.audit(id, 'pin.reset.recovery', 'denied', id, 'wrong code');
      await this.save();
      throw new AuthError('wrong_code', 'That recovery code is not right.');
    }
    if (this.data.encryptData && c.dataKey) this.dataKeyRaw = await unwrapRaw(c.dataKey.byRecovery, norm);
    const next = await this.setCredentials(id, newPin, false);
    this.audit(id, 'pin.reset.recovery', 'ok', id);
    await this.save();
    return next;
  }

  /**
   * Recovery route (b): a signed-in supervisor or facility admin resets another worker's PIN after
   * confirming her own PIN. Returns the worker's new recovery code.
   */
  async resetPinBySupervisor(supervisorId: string, supervisorPin: string, targetId: string, newPin: string): Promise<string> {
    const sup = this.getWorker(supervisorId);
    if (!sup || !can(sup, 'manage_workers')) {
      this.audit(supervisorId, 'pin.reset.supervisor', 'denied', targetId, 'not allowed');
      await this.save();
      throw new AuthError('forbidden', 'Only a supervisor or facility admin can reset another worker’s PIN.');
    }
    if (supervisorId === targetId) throw new AuthError('invalid', 'Use change PIN or your recovery code for your own PIN.');
    const target = this.mustGet(targetId);
    if (sup.role !== 'admin' && target.facilityId !== sup.facilityId) {
      this.audit(supervisorId, 'pin.reset.supervisor', 'denied', targetId, 'other facility');
      await this.save();
      throw new AuthError('forbidden', 'You can reset PINs only for workers at your facility.');
    }
    await this.verifyPin(supervisorId, supervisorPin);
    if (this.data.encryptData && !this.dataKeyRaw) await this.unlockDataKeyWith(supervisorId, supervisorPin, 'pin');
    const code = await this.setCredentials(targetId, newPin, false);
    this.audit(supervisorId, 'pin.reset.supervisor', 'ok', targetId);
    await this.save();
    return code;
  }

  // ---------- Sessions ----------

  /** Sign in (or switch to) a worker. Ends any other session first. */
  async login(id: string, pin: string): Promise<Session> {
    const prev = this.session?.workerId;
    await this.verifyPin(id, pin);
    if (this.data.encryptData && this.data.credentials[id].dataKey) await this.unlockDataKeyWith(id, pin, 'pin');
    this.session = { workerId: id, startedAt: this.now(), lastActiveAt: this.now(), autoLockMinutes: this.data.autoLockMinutes };
    this.audit(id, prev && prev !== id ? 'session.switch' : 'session.login', 'ok', id, prev && prev !== id ? `from ${prev}` : undefined);
    await this.save();
    return this.session;
  }

  /** Switch worker: same as login, recorded as a switch. */
  switchWorker(id: string, pin: string): Promise<Session> {
    return this.login(id, pin);
  }

  async logout(): Promise<void> {
    if (!this.session) return;
    this.audit(this.session.workerId, 'session.logout', 'ok', this.session.workerId);
    this.session = null;
    this.dataKeyRaw = null;
    await this.save();
  }

  /** Record activity (a tap, a keypress) to push back the auto-lock. */
  touch(): void {
    if (this.session && !this.isLocked()) this.session.lastActiveAt = this.now();
  }

  /** True when there is no session, or it has been idle longer than the auto-lock time. */
  isLocked(): boolean {
    if (!this.session) return true;
    const idle = (Date.parse(this.now()) - Date.parse(this.session.lastActiveAt)) / 60_000;
    return idle >= this.session.autoLockMinutes;
  }

  /** The signed-in worker, or null when nobody is signed in or the session has auto-locked. */
  current(): WorkerProfile | null {
    if (!this.session) return null;
    if (this.isLocked()) {
      this.audit(this.session.workerId, 'session.autolock', 'ok', this.session.workerId);
      this.session = null;
      this.dataKeyRaw = null;
      void this.save();
      return null;
    }
    return this.getWorker(this.session.workerId) ?? null;
  }

  getSession(): Session | null {
    return this.current() ? this.session : null;
  }

  async setAutoLockMinutes(minutes: number): Promise<void> {
    const actor = this.requireActor('change_settings');
    if (!(minutes >= 1 && minutes <= 120)) throw new AuthError('invalid', 'Auto-lock must be between 1 and 120 minutes.');
    this.data.autoLockMinutes = minutes;
    if (this.session) this.session.autoLockMinutes = minutes;
    this.audit(actor, 'worker.update', 'ok', undefined, `autoLock=${minutes}`);
    await this.save();
  }

  // ---------- Data key (storage encryption) ----------

  private async unlockDataKeyWith(id: string, secret: string, via: 'pin' | 'recovery'): Promise<void> {
    const dk = this.data.credentials[id]?.dataKey;
    if (!dk) return;
    this.dataKeyRaw = await unwrapRaw(via === 'pin' ? dk.byPin : dk.byRecovery, via === 'pin' ? secret : normaliseRecoveryCode(secret));
    this.audit(id, 'datakey.unlock', 'ok', id, via);
  }

  /** The device data key as an AES-GCM CryptoKey while someone is signed in (storage encryption on). */
  async dataKey(): Promise<CryptoKey | null> {
    if (!this.current() || !this.dataKeyRaw) return null;
    return importDataKey(this.dataKeyRaw);
  }

  // ---------- Audit ----------

  auditLog(): AuthAuditEntry[] {
    return [...this.data.audit];
  }

  // ---------- Helpers ----------

  private mustGet(id: string): WorkerProfile {
    const w = this.getWorker(id);
    if (!w) throw new AuthError('not_found', 'No such profile on this device.');
    return w;
  }

  private requireActor(action: Parameters<typeof can>[1]): string {
    const me = this.current();
    if (!me) throw new AuthError('forbidden', 'Sign in first.');
    if (!can(me, action)) {
      this.audit(me.id, 'worker.update', 'denied', undefined, action);
      throw new AuthError('forbidden', 'You do not have permission to do that.');
    }
    return me.id;
  }
}

// ---------- Default store and convenience exports ----------

let defaultStore: AuthStore | null = null;

export function getAuthStore(opts?: AuthStoreOptions): AuthStore {
  if (!defaultStore) defaultStore = new AuthStore(opts);
  return defaultStore;
}

export function _resetAuthStore(): void {
  defaultStore = null;
}

export function unlockStatus(workerId: string): UnlockStatus {
  return getAuthStore().unlockStatus(workerId);
}

export function resetPinWithRecoveryCode(workerId: string, code: string, newPin: string): Promise<string> {
  return getAuthStore().resetPinWithRecoveryCode(workerId, code, newPin);
}

export function resetPinBySupervisor(supervisorId: string, supervisorPin: string, targetId: string, newPin: string): Promise<string> {
  return getAuthStore().resetPinBySupervisor(supervisorId, supervisorPin, targetId, newPin);
}
