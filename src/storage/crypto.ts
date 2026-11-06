/**
 * Optional passphrase encryption at rest for Gaskin data files and browser copies.
 *
 * Why: a USB stick with gaskin-data.json in plain text is a health record that anyone who
 * finds the stick can read. With a passphrase set, every file Gaskin writes (the data file,
 * rolling backups, downloaded backup files and the browser mirror) holds only ciphertext.
 *
 * How: AES-256-GCM with a key derived from the passphrase by PBKDF2-SHA-256 (600,000
 * iterations by default, OWASP 2023), a fresh 16-byte salt per passphrase and a fresh
 * 12-byte IV per write. WebCrypto only: no dependency, works offline and from file://
 * in every browser Gaskin supports. The passphrase itself is never stored; the derived
 * key lives in memory until the page closes or `lock()` is called.
 *
 * Honest limits: this protects data at rest on a lost stick or a shared laptop. It does
 * not protect data while Gaskin is open and unlocked, against malware on the computer,
 * or against a weak passphrase (it can be guessed offline, slowly). A forgotten passphrase
 * cannot be recovered: there is no back door, so keep an unencrypted backup in a safe place
 * or write the passphrase down and lock it away.
 *
 * File format (JSON, so it is recognisable and the MCP server can say what it is):
 *   { app: 'gaskin', format: 'gaskin-encrypted', v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256',
 *     iterations, salt }, cipher: { name: 'AES-GCM', iv }, data: <base64 ciphertext> }
 */

export const ENCRYPTED_FORMAT = 'gaskin-encrypted';
export const DEFAULT_ITERATIONS = 600_000;
/** Below this the passphrase is too easy to guess offline */
export const MIN_PASSPHRASE_LENGTH = 10;

export interface EncryptedEnvelope {
  app: 'gaskin';
  format: typeof ENCRYPTED_FORMAT;
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

export interface DataKey {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}

export class PassphraseError extends Error {
  code: 'wrong_passphrase' | 'weak_passphrase' | 'unsupported' | 'corrupt';
  constructor(code: PassphraseError['code'], message: string) {
    super(message);
    this.name = 'PassphraseError';
    this.code = code;
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new PassphraseError('unsupported', 'This browser cannot encrypt. Use Chrome, Edge, Firefox or Safari from 2020 or later, opened from a file or https.');
  return s;
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Plain-English check of a new passphrase; returns the problem or null */
export function passphraseProblem(p: string): string | null {
  if (typeof p !== 'string' || p.length < MIN_PASSPHRASE_LENGTH) return `Use at least ${MIN_PASSPHRASE_LENGTH} characters. Three or four ordinary words work well.`;
  if (/^(.)\1+$/.test(p) || /^(?:0123456789|1234567890|password|passphrase|gaskin)/i.test(p)) return 'That passphrase is too easy to guess.';
  return null;
}

/** Derive the data key. Call once per session after the worker types her passphrase. */
export async function deriveKey(passphrase: string, salt?: Uint8Array, iterations = DEFAULT_ITERATIONS): Promise<DataKey> {
  const s = subtle();
  const useSalt = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const base = await s.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await s.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: useSalt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { key, salt: useSalt, iterations };
}

export function isEncrypted(x: unknown): x is EncryptedEnvelope {
  const e = x as EncryptedEnvelope;
  return !!e && typeof e === 'object' && e.app === 'gaskin' && e.format === ENCRYPTED_FORMAT && typeof e.data === 'string' && !!e.kdf && !!e.cipher;
}

export async function encryptJSON(value: unknown, k: DataKey): Promise<EncryptedEnvelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k.key, plain as BufferSource));
  return {
    app: 'gaskin',
    format: ENCRYPTED_FORMAT,
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: k.iterations, salt: b64(k.salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    data: b64(ct),
  };
}

/** Decrypt with a key already derived for this file's salt. Throws PassphraseError('wrong_passphrase') on a bad key or tampered file. */
export async function decryptJSON<T = unknown>(env: EncryptedEnvelope, k: DataKey): Promise<T> {
  if (!isEncrypted(env) || env.v !== 1 || env.cipher.name !== 'AES-GCM' || env.kdf.name !== 'PBKDF2') throw new PassphraseError('corrupt', 'This encrypted file is damaged or from a newer Gaskin.');
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(env.cipher.iv) as BufferSource }, k.key, unb64(env.data) as BufferSource);
  } catch {
    throw new PassphraseError('wrong_passphrase', 'The passphrase is not right, or the file has been changed. Nothing was opened.');
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Derive the key for this file's own salt and iterations, then decrypt. */
export async function decryptWithPassphrase<T = unknown>(env: EncryptedEnvelope, passphrase: string): Promise<{ data: T; key: DataKey }> {
  if (!isEncrypted(env)) throw new PassphraseError('corrupt', 'This is not an encrypted Gaskin file.');
  // A ceiling stops a hostile file from freezing the browser; the rounds a file was written with are its own business
  const iterations = Math.min(Math.max(Math.floor(Number(env.kdf.iterations)) || DEFAULT_ITERATIONS, 1), 5_000_000);
  const key = await deriveKey(passphrase, unb64(env.kdf.salt), iterations);
  return { data: await decryptJSON<T>(env, key), key };
}

// ---------------------------------------------------------------------------
// Session key holder: one key for the open session, never persisted
// ---------------------------------------------------------------------------

let sessionKey: DataKey | null = null;
const keyListeners = new Set<() => void>();

export const encryptionSession = {
  /** The key in memory, or null when locked / encryption is off */
  get(): DataKey | null {
    return sessionKey;
  },
  set(k: DataKey | null): void {
    sessionKey = k;
    for (const fn of keyListeners) fn();
  },
  subscribe(fn: () => void): () => void {
    keyListeners.add(fn);
    return () => keyListeners.delete(fn);
  },
};

/** Forget the key (for example when the worker locks Gaskin or hands over the laptop). */
export function lock(): void {
  encryptionSession.set(null);
}
