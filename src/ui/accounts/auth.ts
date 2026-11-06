/**
 * UI adapter over src/auth (several workers on one device). The AuthStore holds profiles, PIN and
 * recovery-code hashes, lockout with backoff, sessions with auto-lock and an audit log; this file
 * adds what screens need on top: a persistent store instance, a React hook, the lock state the
 * shell shows (her PIN screen rather than the picker after a lock), the PIN length for the keypad,
 * a switch request, and demo profiles for the reviewer presets.
 *
 * Sessions live in memory only, so after a reload everyone types her PIN again. Demo profiles made
 * by a preset (PIN 2580, shown on the lock screen) resume without one while the session is fresh,
 * so the hosted demo does not ask reviewers for a PIN on every reload.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  AuthError,
  can as authCan,
  getAuthStore,
  pinProblem as authPinProblem,
  profileFromWorker,
  type Action,
  type AuthRole as StoreRole,
  type WorkerProfile,
  type UnlockStatus as StoreUnlock,
} from '../../auth';
import { localStorageKV, memoryKV } from '../../storage/kv';
import type { Mother, Worker } from '../../types';

export type Profile = WorkerProfile;
export type AuthAction = Action;

/** What a screen offers when adding a worker. */
export type RoleChoice = 'worker' | 'supervisor' | 'clinical_reviewer' | 'programme_officer' | 'personal';

export const ROLE_LABEL: Record<RoleChoice | 'admin', string> = {
  worker: 'Health worker',
  supervisor: 'Supervisor',
  clinical_reviewer: 'Clinical reviewer',
  programme_officer: 'Programme officer',
  admin: 'Facility admin',
  personal: 'Personal use',
};

export const ROLE_HINT: Record<RoleChoice, string> = {
  worker: 'Sees her own mothers, records visits and sends messages.',
  supervisor: 'Also adds workers, resets PINs and shares out mothers.',
  clinical_reviewer: 'Also reviews and approves changes to the care rules.',
  programme_officer: 'Sees Insights for the area. Does not open records.',
  personal: 'A mother using Gaskin for herself and her family.',
};

export function roleOf(p: Pick<Profile, 'role' | 'personal' | 'isSupervisor' | 'isClinicalReviewer'>): RoleChoice | 'admin' {
  if (p.personal) return 'personal';
  if (p.role === 'worker' && p.isSupervisor) return 'supervisor';
  if (p.role === 'worker' && p.isClinicalReviewer) return 'clinical_reviewer';
  return p.role;
}

export function roleLabel(p: Profile): string {
  return ROLE_LABEL[roleOf(p)];
}

export const DEMO_PIN = '2580';

// ---------------------------------------------------------------------------
// The store instance (persistent) and UI state
// ---------------------------------------------------------------------------

const store = getAuthStore({ kv: localStorageKV() ?? memoryKV() });

const UI_KEY = 'gaskin.accounts.ui.v1';
interface UiState {
  /** Last signed-in profile: the lock screen shows her after a lock or reload */
  lastId?: string | null;
  /** Lock pressed (session ended, her PIN screen shows) */
  locked?: boolean;
  /** Digits in each PIN, so the keypad knows when to check (never the PIN) */
  pinLength?: Record<string, number>;
  /** Profiles made by a reviewer preset (PIN 2580) */
  demoIds?: string[];
  /** Last activity, ms */
  lastActive?: number;
}

function readUi(): UiState {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY);
    return raw ? (JSON.parse(raw) as UiState) : {};
  } catch {
    return {};
  }
}
let ui: UiState = readUi();
let switchTo: string | null = null;
let ready = false;
let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  for (const l of listeners) l();
}
function saveUi(patch: Partial<UiState>) {
  ui = { ...ui, ...patch };
  try {
    globalThis.localStorage?.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
  bump();
}

store.subscribe(bump);

const loading: Promise<void> = store
  .load()
  .catch(() => undefined)
  .then(async () => {
    // Resume a fresh demo session (the PIN is public: 2580).
    const id = ui.lastId;
    const fresh = ui.lastActive && Date.now() - ui.lastActive < autoLockMinutes() * 60_000;
    if (id && !ui.locked && fresh && ui.demoIds?.includes(id) && store.getWorker(id)?.active) {
      await store.login(id, DEMO_PIN).catch(() => undefined);
    }
    ready = true;
    bump();
  });

export function whenReady(): Promise<void> {
  return loading;
}

export const accountsStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getVersion: () => version,
};

export interface AccountsView {
  ready: boolean;
  profiles: Profile[];
  all: Profile[];
  current: Profile | null;
  /** Someone is signed out by a lock: show her PIN screen */
  lockedProfile: Profile | null;
}

export function useAccounts(): AccountsView {
  useSyncExternalStore(accountsStore.subscribe, accountsStore.getVersion, accountsStore.getVersion);
  return { ready, profiles: listProfiles(), all: listProfiles(true), current: currentProfile(), lockedProfile: lockedProfile() };
}

export function listProfiles(includeInactive = false): Profile[] {
  return store.listWorkers({ includeInactive });
}

export function currentProfile(): Profile | null {
  try {
    return store.current();
  } catch {
    return null;
  }
}

function lockedProfile(): Profile | null {
  if (currentProfile()) return null;
  const id = ui.lastId;
  if (!id) return null;
  const p = store.getWorker(id);
  return p?.active ? p : null;
}

export function getProfile(id: string): Profile | undefined {
  return store.getWorker(id);
}

export function can(p: Profile | null | undefined, action: Action): boolean {
  if (!p) return false;
  try {
    return authCan(p, action);
  } catch {
    return false;
  }
}

export function pinLengthOf(id: string): number {
  return ui.pinLength?.[id] ?? 4;
}

export function isDemoProfile(id: string): boolean {
  return Boolean(ui.demoIds?.includes(id));
}

export function pinProblem(pin: string): string | null {
  return authPinProblem(pin);
}

function message(e: unknown): string {
  return e instanceof AuthError || e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface NewProfile {
  name: string;
  role: RoleChoice;
  pin: string;
  /** Worker.id in the clinical data, so her caseload follows; a new id is made otherwise */
  id?: string;
  cadre?: WorkerProfile['cadre'];
  facilityId?: string;
  country?: WorkerProfile['country'];
  /** Sign her in at once (the first worker) */
  signIn?: boolean;
  demo?: boolean;
}

function newId(prefix: string) {
  const a = new Uint8Array(5);
  try {
    globalThis.crypto.getRandomValues(a);
  } catch {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}-${[...a].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Add a profile with a PIN. Returns her one-time recovery code (show it once). */
export async function createProfile(input: NewProfile): Promise<{ profile: Profile; recoveryCode: string }> {
  const personal = input.role === 'personal';
  const role: StoreRole = input.role === 'personal' ? 'worker' : input.role;
  const id = input.id && !store.getWorker(input.id) ? input.id : newId(personal ? 'self' : 'w-local');
  const { worker, recoveryCode } = await store.addWorker(
    {
      id,
      name: input.name.trim(),
      role,
      cadre: personal ? 'self' : (input.cadre ?? 'midwife'),
      facilityId: input.facilityId ?? 'local',
      country: input.country,
      communities: [],
      languages: ['en'],
      isClinicalReviewer: input.role === 'clinical_reviewer',
      isSupervisor: input.role === 'supervisor',
      personal,
    },
    input.pin,
  );
  saveUi({ pinLength: { ...(ui.pinLength ?? {}), [worker.id]: input.pin.length }, demoIds: input.demo ? [...(ui.demoIds ?? []), worker.id] : ui.demoIds });
  if (input.signIn) await signIn(worker.id, input.pin);
  return { profile: worker, recoveryCode };
}

export async function updateProfile(id: string, patch: Partial<Omit<WorkerProfile, 'id' | 'createdAt' | 'createdBy'>>): Promise<string | null> {
  try {
    await store.updateWorker(id, patch);
    return null;
  } catch (e) {
    return message(e);
  }
}

export async function setRole(id: string, role: RoleChoice): Promise<string | null> {
  return updateProfile(id, {
    role: role === 'personal' ? 'worker' : role,
    isSupervisor: role === 'supervisor',
    isClinicalReviewer: role === 'clinical_reviewer',
  });
}

export async function setActive(id: string, active: boolean): Promise<string | null> {
  try {
    if (active) await store.reactivateWorker(id);
    else await store.deactivateWorker(id);
    return null;
  } catch (e) {
    return message(e);
  }
}

// ---------------------------------------------------------------------------
// PIN, lock and recovery
// ---------------------------------------------------------------------------

export interface UnlockStatus {
  locked: boolean;
  secondsLeft: number;
  attemptsLeft: number;
  nextLockMinutes: number;
}

export function unlockStatus(id: string): UnlockStatus {
  let s: StoreUnlock;
  try {
    s = store.unlockStatus(id);
  } catch {
    return { locked: false, secondsLeft: 0, attemptsLeft: 5, nextLockMinutes: 1 };
  }
  const left = s.lockedUntil ? Math.max(0, Math.ceil((Date.parse(s.lockedUntil) - Date.now()) / 1000)) : 0;
  return { locked: s.locked && left > 0, secondsLeft: left, attemptsLeft: s.attemptsLeft, nextLockMinutes: s.nextLockMinutes };
}

async function signIn(id: string, pin: string) {
  await store.login(id, pin);
  switchTo = null;
  saveUi({ lastId: id, locked: false, lastActive: Date.now() });
}

/** Check her PIN and sign her in (unlock, or switch to her). */
export async function verifyPin(id: string, pin: string): Promise<{ ok: boolean; message?: string; status: UnlockStatus }> {
  try {
    await signIn(id, pin);
    return { ok: true, status: unlockStatus(id) };
  } catch (e) {
    const st = unlockStatus(id);
    const msg = st.locked
      ? `Too many wrong PINs. Try again in ${waitWords(st.secondsLeft)}, or use your recovery code.`
      : e instanceof AuthError && e.code === 'wrong_pin'
        ? `That PIN is not right. ${st.attemptsLeft} ${st.attemptsLeft === 1 ? 'try' : 'tries'} left.`
        : message(e);
    return { ok: false, message: msg, status: st };
  }
}

export function waitWords(s: number): string {
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? '' : 's'}`;
}

/** Her one-time recovery code sets a new PIN. Returns the next recovery code. */
/**
 * Reset a forgotten PIN with the recovery code. Returns the replacement recovery code. With
 * `signInNow: false` the caller signs her in later (`signInAfterRecovery`), so the lock screen can
 * show the new code first: signing in at once closes the lock screen and the new code is never seen.
 */
export async function resetPinWithRecoveryCode(id: string, code: string, newPin: string, opts: { signInNow?: boolean } = {}): Promise<{ ok: boolean; message?: string; recoveryCode?: string }> {
  try {
    const next = await store.resetPinWithRecoveryCode(id, code, newPin);
    saveUi({ pinLength: { ...(ui.pinLength ?? {}), [id]: newPin.length } });
    if (opts.signInNow !== false) await signIn(id, newPin).catch(() => undefined);
    else pendingRecoverySignIn = { id, pin: newPin };
    return { ok: true, recoveryCode: next };
  } catch (e) {
    return { ok: false, message: e instanceof AuthError && e.code === 'wrong_code' ? 'That recovery code is not right. Check each letter, or ask your supervisor.' : message(e) };
  }
}

let pendingRecoverySignIn: { id: string; pin: string } | null = null;

/** Sign in after a recovery reset, once she has seen her new recovery code. */
export async function signInAfterRecovery(): Promise<void> {
  const p = pendingRecoverySignIn;
  pendingRecoverySignIn = null;
  if (p) await signIn(p.id, p.pin).catch(() => undefined);
}

/** A supervisor resets a colleague's PIN after typing her own. Returns the colleague's new recovery code. */
export async function resetPinBySupervisor(supervisorId: string, supervisorPin: string, targetId: string, newPin: string): Promise<{ ok: boolean; message?: string; recoveryCode?: string }> {
  try {
    const code = await store.resetPinBySupervisor(supervisorId, supervisorPin, targetId, newPin);
    saveUi({ pinLength: { ...(ui.pinLength ?? {}), [targetId]: newPin.length } });
    return { ok: true, recoveryCode: code };
  } catch (e) {
    return { ok: false, message: e instanceof AuthError && (e.code === 'wrong_pin' || e.code === 'locked') ? `Your own PIN was not accepted. ${message(e)}` : message(e) };
  }
}

export async function changePin(id: string, currentPin: string, newPin: string): Promise<{ ok: boolean; message?: string; recoveryCode?: string }> {
  try {
    const code = await store.changePin(id, currentPin, newPin);
    saveUi({ pinLength: { ...(ui.pinLength ?? {}), [id]: newPin.length } });
    return { ok: true, recoveryCode: code };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}

/** Lock now: ends the session, and her PIN screen shows. */
export function lockNow(): void {
  const me = currentProfile();
  if (!me) return;
  void store.logout().then(() => saveUi({ lastId: me.id, locked: true }));
}

/** Log out: the next person chooses her name. */
export function logOut(): void {
  void store.logout().then(() => saveUi({ lastId: null, locked: false }));
}

/** Ask to switch worker: her PIN screen shows over the app. */
export function requestSwitch(id: string | null): void {
  switchTo = id;
  bump();
}

export function switchTarget(): Profile | null {
  if (!switchTo) return null;
  const p = store.getWorker(switchTo);
  return p?.active ? p : null;
}

/** Push back the auto-lock. */
export function touch(): void {
  store.touch();
  ui.lastActive = Date.now();
  try {
    globalThis.localStorage?.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

/** Auto-lock minutes in force (set by a supervisor; 5 by default). */
export function autoLockMinutes(): number {
  try {
    return store.getSession()?.autoLockMinutes ?? (store as unknown as { data?: { autoLockMinutes?: number } }).data?.autoLockMinutes ?? 5;
  } catch {
    return 5;
  }
}

export async function setAutoLockMinutes(m: number): Promise<string | null> {
  try {
    await store.setAutoLockMinutes(m);
    bump();
    return null;
  } catch (e) {
    return message(e);
  }
}

/** Called on a timer: if the session timed out, show her PIN screen. */
export function checkAutoLock(): void {
  const last = ui.lastId;
  if (last && !store.current() && !ui.locked) saveUi({ locked: true });
}

export function authAudit() {
  try {
    return store.auditLog();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Demo profiles for the reviewer presets
// ---------------------------------------------------------------------------

/**
 * Profiles for a preset's worker, her facility colleagues and the clinical reviewers, all with
 * PIN 2580, then signs in as the preset's worker. The first profile is added with supervisor
 * rights so it can add the others, then set back to her real role.
 */
export async function seedDemoProfiles(workers: Worker[], mothers: Mother[], signInWorkerId: string): Promise<void> {
  await loading;
  const target = workers.find((w) => w.id === signInWorkerId);
  if (!target) return;
  const people = [target, ...workers.filter((w) => w.id !== target.id && (w.facilityId === target.facilityId || w.isClinicalReviewer))];
  const missing = people.filter((w) => !store.getWorker(w.id));
  const demoIds = new Set(ui.demoIds ?? []);
  if (missing.length) {
    let actor = currentProfile();
    const empty = store.isEmpty();
    for (const w of missing) {
      const p = profileFromWorker(w, mothers, new Date().toISOString());
      if (empty && !actor) {
        // First profile on the device: give her rights to add the rest, then restore her role.
        await store.addWorker({ ...p, isSupervisor: true }, DEMO_PIN);
        await store.login(p.id, DEMO_PIN);
        actor = currentProfile();
        demoIds.add(p.id);
        continue;
      }
      if (!actor || !authCan(actor, 'manage_workers')) {
        // Someone without rights is signed in: borrow a demo supervisor if there is one.
        const sup = store.listWorkers().find((x) => demoIds.has(x.id) && authCan(x, 'manage_workers'));
        if (!sup) break;
        await store.login(sup.id, DEMO_PIN);
        actor = currentProfile();
      }
      await store.addWorker(p, DEMO_PIN);
      demoIds.add(p.id);
    }
    const first = people[0];
    const created = store.getWorker(first.id);
    if (created && created.isSupervisor && !profileFromWorker(first).isSupervisor) {
      await store.login(first.id, DEMO_PIN).catch(() => undefined);
      await store.updateWorker(first.id, { isSupervisor: false }).catch(() => undefined);
    }
  }
  const lengths = { ...(ui.pinLength ?? {}) };
  for (const id of demoIds) lengths[id] = 4;
  saveUi({ demoIds: [...demoIds], pinLength: lengths });
  if (store.getWorker(signInWorkerId)) await signIn(signInWorkerId, DEMO_PIN).catch(() => undefined);
}

/** Demo panel: switch to a demo profile without typing (its PIN is public). */
export async function demoSwitch(id: string): Promise<boolean> {
  if (!isDemoProfile(id)) return false;
  try {
    await signIn(id, DEMO_PIN);
    return true;
  } catch {
    return false;
  }
}

/** Keep the session alive while the app is in use, and lock it when it times out. */
export function useAutoLock(): void {
  useEffect(() => {
    let last = 0;
    const onAct = () => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      touch();
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    evs.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const t = window.setInterval(() => {
      checkAutoLock();
      bump();
    }, 15_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, onAct));
      window.clearInterval(t);
    };
  }, []);
}

/** Forget every profile, PIN and session on this device (Delete my data, Reset demo). */
export async function clearAccounts(): Promise<void> {
  await store.logout().catch(() => undefined);
  try {
    for (const k of Object.keys(globalThis.localStorage ?? {})) if (k === UI_KEY || k.startsWith('gaskin.kv.gaskin.auth')) globalThis.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  const kv = localStorageKV();
  await kv?.del('gaskin.auth.v1');
  ui = {};
  await store.load().catch(() => undefined);
  bump();
}
