/**
 * Hosted Gaskin: one Backend interface, three implementations, chosen
 * automatically.
 *
 *   inside the claude.ai artifact viewer  -> artifactBackend (shared `db`)
 *   a Gaskin server URL is configured      -> httpBackend (sign in with phone + PIN)
 *   otherwise                              -> localBackend (this device, USB stick)
 *
 * The server URL comes from, in order: `pickBackend({ serverUrl })`, the
 * `?server=` query parameter (saved for next time), a URL saved by login(),
 * or the build-time VITE_GASKIN_SERVER_URL.
 */
import type { Backend } from './backend';
import { createArtifactBackend, type ArtifactBackendOptions } from './artifactBackend';
import { createHttpBackend, savedSession, SERVER_URL_KEY, type HttpBackendOptions } from './httpBackend';
import { createLocalBackend, type LocalBackendOptions } from './localBackend';
import { artifactRuntime } from './runtime';
import { readLocal, writeLocal } from './kv';
import { BackendError } from './backend';

export * from './backend';
export * from './syncTypes';
export { createArtifactBackend, ARTIFACT_CAPABILITIES, chunkEvents, toArtifactDocs } from './artifactBackend';
export { createHttpBackend, login, savedSession, clearSession, getDeviceId, SERVER_URL_KEY } from './httpBackend';
export { createLocalBackend, toSnapshot, fromSnapshot } from './localBackend';
export { artifactRuntime } from './runtime';

export type PickReason = 'artifact' | 'server' | 'server_needs_login' | 'local';

export interface PickOptions {
  /** Force a choice (tests, settings screen) */
  prefer?: 'artifact' | 'http' | 'local';
  serverUrl?: string;
  artifact?: ArtifactBackendOptions;
  http?: Partial<HttpBackendOptions>;
  local?: LocalBackendOptions;
}

export interface Picked {
  backend: Backend;
  reason: PickReason;
  /** Set when a server is configured but nobody is signed in: show the phone + PIN screen, then call pickBackend again */
  serverUrl?: string;
}

function envServerUrl(): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_GASKIN_SERVER_URL || undefined;
  } catch {
    return undefined;
  }
}

/** The configured Gaskin server URL, if any */
export function configuredServerUrl(explicit?: string): string | undefined {
  if (explicit) return explicit.replace(/\/+$/, '');
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('server') : null;
    if (q && /^https?:\/\//.test(q)) {
      writeLocal(SERVER_URL_KEY, q.replace(/\/+$/, ''));
      return q.replace(/\/+$/, '');
    }
  } catch {
    /* no location */
  }
  return readLocal(SERVER_URL_KEY) ?? savedSession()?.baseUrl ?? envServerUrl();
}

/**
 * Choose and open the right backend. Never throws: when a server is
 * configured but there is no session, it resolves the local backend with
 * reason 'server_needs_login' so the UI can show sign-in, and the worker can
 * still work offline meanwhile.
 */
export async function pickBackend(o: PickOptions = {}): Promise<Picked> {
  const inArtifact = !!artifactRuntime() || !!o.artifact?.runtime;
  if (o.prefer === 'artifact' || (!o.prefer && inArtifact)) {
    const backend = await createArtifactBackend(o.artifact);
    return { backend, reason: backend.kind === 'artifact' ? 'artifact' : 'local' };
  }
  const url = o.prefer === 'local' ? undefined : configuredServerUrl(o.serverUrl ?? o.http?.baseUrl);
  if (url) {
    try {
      const backend = await createHttpBackend({ ...o.http, baseUrl: url });
      return { backend, reason: 'server', serverUrl: url };
    } catch (e) {
      if (!(e instanceof BackendError) || e.code !== 'unauthorised') console.warn('[gaskin] server backend failed, using this device', e);
      const backend = await createLocalBackend({ ...o.local, fallbackReason: 'Sign in to sync with the Gaskin server. Until then, changes stay on this device.' });
      return { backend, reason: 'server_needs_login', serverUrl: url };
    }
  }
  return { backend: await createLocalBackend(o.local), reason: 'local' };
}
