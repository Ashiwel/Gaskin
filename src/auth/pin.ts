/**
 * PIN and recovery-code hashing with WebCrypto: PBKDF2-SHA-256, a fresh 16-byte salt per secret,
 * 210,000 iterations (OWASP 2023 minimum for PBKDF2-HMAC-SHA256), 32-byte output, constant-time compare.
 * Works offline and from file:// in every browser Gaskin supports, and in Node 20+ for tests.
 *
 * A 4–8 digit PIN is weak against offline guessing whatever the hash, so the real protection is the
 * lockout with backoff (src/auth/store.ts) and, where it matters, storage encryption.
 */
import { AuthError, type PinRecord, type WrappedKey } from './types';

export const PIN_ITERATIONS = 210_000;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new AuthError('unsupported', 'This browser cannot protect a PIN. Open Gaskin from a file or https in an up-to-date browser.');
  return s;
}

export function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Compare without stopping at the first difference, so timing does not reveal how much matched. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i % (a.length || 1)] ?? 0) ^ (b[i % (b.length || 1)] ?? 0);
  return diff === 0;
}

async function pbkdf2(secret: string, salt: Uint8Array, iterations: number, bits = 256): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const out = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, bits);
  return new Uint8Array(out);
}

export async function hashSecret(secret: string, iterations = PIN_ITERATIONS): Promise<PinRecord> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(secret, salt, iterations);
  return { alg: 'PBKDF2-SHA256', iterations, salt: b64(salt), hash: b64(hash) };
}

export async function verifySecret(secret: string, rec: PinRecord): Promise<boolean> {
  if (rec.alg !== 'PBKDF2-SHA256') return false;
  const got = await pbkdf2(secret, unb64(rec.salt), rec.iterations);
  return constantTimeEqual(got, unb64(rec.hash));
}

/** Same rules as the hosted server (server/src/auth.ts validPin). */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return 'The PIN must be 4 to 8 digits.';
  if (/^(\d)\1+$/.test(pin)) return 'Choose a PIN that is not one digit repeated.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Choose a PIN that is not a run of digits such as 1234.';
  return null;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

/** A one-time recovery code, e.g. 'K7QM-3XRP-9HWD-TB4F' (80 bits). Shown once; only its hash is stored. */
export function newRecoveryCode(): string {
  const bytes = randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s.match(/.{4}/g)!.join('-');
}

export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').match(/.{1,4}/g)?.join('-') ?? '';
}

// ---------- Data key wrapping ----------

async function wrappingKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const bits = await pbkdf2(`gaskin-datakey:${secret}`, salt, iterations);
  return subtle().importKey('raw', bits as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt 32 raw data-key bytes with a key derived from a secret (PIN or recovery code). */
export async function wrapRaw(raw: Uint8Array, secret: string, iterations = PIN_ITERATIONS): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const k = await wrappingKey(secret, salt, iterations);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, raw as BufferSource));
  return { salt: b64(salt), iv: b64(iv), iterations, data: b64(ct) };
}

export async function unwrapRaw(w: WrappedKey, secret: string): Promise<Uint8Array> {
  const k = await wrappingKey(secret, unb64(w.salt), w.iterations);
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(w.iv) as BufferSource }, k, unb64(w.data) as BufferSource));
  } catch {
    throw new AuthError('wrong_pin', 'That PIN or code does not open the data key.');
  }
}

/** Import raw data-key bytes as a non-extractable AES-GCM key for storage encryption. */
export async function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
