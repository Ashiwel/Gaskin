/**
 * Worker accounts: phone number + PIN, roles, and per-facility scoping.
 *
 * PINs are hashed with scrypt and a per-user salt. After `pinMaxAttempts`
 * wrong PINs the account locks for `pinLockMinutes`, because a 4–6 digit PIN
 * can be guessed by brute force otherwise. Session tokens are 32 random bytes;
 * only their SHA-256 is stored, so a stolen database cannot be replayed.
 *
 * Roles:
 *  - worker: reads and writes mothers at her own facilities.
 *  - supervisor: as worker, across the facilities she supervises; sees
 *    message costs and team dashboards.
 *  - clinical_reviewer: as supervisor, and approves rule proposals (learned rules).
 *  - programme_officer: aggregate reports only (DHIS2, metrics, costs); no
 *    named records.
 *  - admin: manages accounts and facilities; reads audit logs. Not a
 *    clinical role: admins do not read records unless also scoped.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { HostedRole, Identity } from '../../src/hosted/syncTypes';
import type { CountryCode } from '../../src/types';
import { type DB, nowIso } from './db';

export const ROLES: HostedRole[] = ['worker', 'supervisor', 'clinical_reviewer', 'programme_officer', 'admin'];

export interface UserRow {
  id: string;
  phone: string;
  name: string;
  role: HostedRole;
  pin_hash: string;
  worker_id: string | null;
  country: string | null;
  active: number;
  failed_attempts: number;
  locked_until: string | null;
}

export interface AuthedUser {
  id: string;
  name: string;
  role: HostedRole;
  facilityIds: string[];
  workerId?: string;
  country?: CountryCode;
  deviceId?: string;
}

export const CAN = {
  readRecords: (r: HostedRole) => r === 'worker' || r === 'supervisor' || r === 'clinical_reviewer',
  writeRecords: (r: HostedRole) => r === 'worker' || r === 'supervisor' || r === 'clinical_reviewer',
  approveRules: (r: HostedRole) => r === 'clinical_reviewer',
  aggregates: (r: HostedRole) => r !== 'worker',
  costs: (r: HostedRole) => r !== 'worker',
  manageUsers: (r: HostedRole) => r === 'admin',
  readAudit: (r: HostedRole) => r === 'admin' || r === 'supervisor',
};

/** Normalise a Nigerian, Kenyan or Ghanaian number to E.164 (+234..., +254..., +233...) */
export function normalisePhone(input: string, country: CountryCode = 'NG'): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  const cc = { NG: '234', KE: '254', GH: '233' }[country];
  if (digits.startsWith(cc)) return '+' + digits;
  if (digits.startsWith('0')) return `+${cc}${digits.slice(1)}`;
  return `+${cc}${digits}`;
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, n, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(pin, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function validPin(pin: string): boolean {
  if (!/^\d{4,8}$/.test(pin)) return false;
  // Refuse the PINs everyone tries first
  if (/^(\d)\1+$/.test(pin)) return false;
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return false;
  return true;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function newId(prefix: string): string {
  return `${prefix}${randomBytes(9).toString('base64url')}`;
}

export async function createUser(
  db: DB,
  u: { phone: string; pin: string; name: string; role: HostedRole; facilityIds: string[]; workerId?: string; country?: CountryCode },
): Promise<string> {
  if (!ROLES.includes(u.role)) throw new Error(`Unknown role ${u.role}`);
  if (!validPin(u.pin)) throw new Error('The PIN must be 4 to 8 digits and not an easy sequence such as 1234 or 0000.');
  const phone = normalisePhone(u.phone, u.country);
  const id = newId('u_');
  const now = nowIso();
  await db.tx(async (t) => {
    await t.run(
      'INSERT INTO users (id, phone, name, role, pin_hash, worker_id, country, active, failed_attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)',
      [id, phone, u.name, u.role, hashPin(u.pin), u.workerId ?? null, u.country ?? null, now, now],
    );
    for (const f of u.facilityIds) await t.run('INSERT INTO user_facilities (user_id, facility_id) VALUES (?, ?)', [id, f]);
  });
  return id;
}

export async function facilitiesFor(db: DB, userId: string): Promise<string[]> {
  const rows = await db.all<{ facility_id: string }>('SELECT facility_id FROM user_facilities WHERE user_id = ? ORDER BY facility_id', [userId]);
  return rows.map((r) => r.facility_id);
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: string; user: AuthedUser }
  | { ok: false; reason: 'invalid' | 'locked' | 'inactive'; retryAt?: string };

export async function login(
  db: DB,
  cfg: { tokenDays: number; pinMaxAttempts: number; pinLockMinutes: number; defaultCountry: CountryCode },
  phoneIn: string,
  pin: string,
  device?: { id?: string; name?: string },
): Promise<LoginResult> {
  const phone = normalisePhone(phoneIn, cfg.defaultCountry);
  const u = await db.get<UserRow>('SELECT * FROM users WHERE phone = ?', [phone]);
  const now = new Date();
  if (!u) {
    // Spend the same time as a real check, so timing does not reveal which numbers have accounts
    verifyPin(pin, hashPin('000000'));
    return { ok: false, reason: 'invalid' };
  }
  if (!u.active) return { ok: false, reason: 'inactive' };
  if (u.locked_until && new Date(u.locked_until) > now) return { ok: false, reason: 'locked', retryAt: u.locked_until };
  if (!verifyPin(pin, u.pin_hash)) {
    const attempts = u.failed_attempts + 1;
    const lock = attempts >= cfg.pinMaxAttempts ? new Date(now.getTime() + cfg.pinLockMinutes * 60_000).toISOString() : null;
    await db.run('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?', [lock ? 0 : attempts, lock, now.toISOString(), u.id]);
    return lock ? { ok: false, reason: 'locked', retryAt: lock } : { ok: false, reason: 'invalid' };
  }
  await db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [now.toISOString(), u.id]);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + cfg.tokenDays * 86_400_000).toISOString();
  await db.run('INSERT INTO sessions (token_hash, user_id, device_id, device_name, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    sha256(token),
    u.id,
    device?.id ?? null,
    device?.name?.slice(0, 80) ?? null,
    now.toISOString(),
    expiresAt,
    now.toISOString(),
  ]);
  return { ok: true, token, expiresAt, user: await toAuthed(db, u, device?.id) };
}

async function toAuthed(db: DB, u: UserRow, deviceId?: string | null): Promise<AuthedUser> {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    facilityIds: await facilitiesFor(db, u.id),
    workerId: u.worker_id ?? undefined,
    country: (u.country as CountryCode | null) ?? undefined,
    deviceId: deviceId ?? undefined,
  };
}

export async function authenticate(db: DB, token: string | undefined): Promise<AuthedUser | null> {
  if (!token) return null;
  const s = await db.get<{ user_id: string; expires_at: string; device_id: string | null; last_seen_at: string | null }>(
    'SELECT user_id, expires_at, device_id, last_seen_at FROM sessions WHERE token_hash = ?',
    [sha256(token)],
  );
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const u = await db.get<UserRow>('SELECT * FROM users WHERE id = ? AND active = 1', [s.user_id]);
  if (!u) return null;
  // Touch at most once a minute
  if (!s.last_seen_at || Date.now() - new Date(s.last_seen_at).getTime() > 60_000)
    await db.run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [nowIso(), sha256(token)]);
  return toAuthed(db, u, s.device_id);
}

export async function logout(db: DB, token: string): Promise<void> {
  await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
}

export function toIdentity(u: AuthedUser): Identity {
  return {
    userId: u.id,
    name: u.name,
    role: u.role,
    facilityIds: u.facilityIds,
    workerId: u.workerId,
    country: u.country,
    canWrite: CAN.writeRecords(u.role),
    source: 'server',
  };
}
