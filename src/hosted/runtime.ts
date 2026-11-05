/**
 * The small part of the claude.ai artifact runtime that the hosted demo
 * uses (`db` and `user`), typed locally. The platform's own type
 * definitions are authoritative; these mirror runtime contract 0.2.96.
 * `window.claude` exists only inside the artifact viewer, and only `use()`
 * is promised on it.
 */

export interface RtSnapshotMetadata {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export interface RtDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: RtSnapshotMetadata;
}

export interface RtQuerySnapshot {
  docs: RtDocSnapshot[];
  size: number;
  empty: boolean;
  metadata: RtSnapshotMetadata;
}

export interface RtDbError {
  code: string;
  message: string;
}

export type RtUnsubscribe = () => void;

export interface RtDocRef {
  id: string;
  path: string;
  get(): Promise<RtDocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: RtDocSnapshot) => void, error?: (e: RtDbError) => void): RtUnsubscribe;
  collection(path: string): RtCollectionRef;
}

export interface RtQuery {
  get(): Promise<RtQuerySnapshot>;
  onSnapshot(next: (s: RtQuerySnapshot) => void, error?: (e: RtDbError) => void): RtUnsubscribe;
  limit(n: number): RtQuery;
}

export interface RtCollectionRef extends RtQuery {
  path: string;
  doc(id?: string): RtDocRef;
}

export interface RtDB {
  doc(path: string): RtDocRef;
  collection(path: string): RtCollectionRef;
}

export interface RtUser {
  isOwner(): Promise<boolean>;
  canEdit(): Promise<boolean>;
  can(name: string): Promise<boolean | null>;
  id(): Promise<string | null>;
  me(): Promise<{ id: string | null; name: string; isOwner: boolean; canEdit: boolean }>;
}

export interface RtClaude {
  use(name: string): Promise<unknown>;
}

/** The runtime's `claude` object when this page is inside the artifact viewer, else undefined */
export function artifactRuntime(): RtClaude | undefined {
  try {
    const c = (globalThis as { claude?: RtClaude }).claude;
    return c && typeof c.use === 'function' ? c : undefined;
  } catch {
    return undefined;
  }
}

/** claude.use(name), never rejecting, resolving null after `ms` if the viewer does not answer */
export async function requestCapability<T>(name: string, ms = 10_000, rt: RtClaude | undefined = artifactRuntime()): Promise<T | null> {
  if (!rt) return null;
  return new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    Promise.resolve()
      .then(() => rt.use(name))
      .then(
        (v) => {
          clearTimeout(t);
          resolve((v as T) ?? null);
        },
        () => {
          clearTimeout(t);
          resolve(null);
        },
      );
  });
}

/** Document ids may only use letters, digits and _ - . ~ : @ +. Others are escaped as ~XX (reversible). */
export function safeSegment(id: string): string {
  const s = id.replace(/[^A-Za-z0-9_\-.:@+]/g, (c) => '~' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  const out = s === '.' || s === '..' ? s.replace(/\./g, '~2e') : s;
  return out.slice(0, 200) || '~';
}
