/**
 * The one interface the front end uses to load and save shared data, with
 * three implementations:
 *
 *  - artifactBackend: the hosted demo on claude.ai, on the artifact `db`
 *    capability (shared, live, durable), with `user` for identity.
 *  - httpBackend: the production service in server/ (phone + PIN login,
 *    offline-first sync, real SMS/WhatsApp/voice/email, AI proxy).
 *  - localBackend: this device only (single file, USB stick, PWA).
 *
 * The store calls `pickBackend()` once at start-up, `load()`s a snapshot,
 * `subscribe()`s for changes made elsewhere, and calls the write methods as
 * the worker acts. Writes are optimistic: the subscriber hears the new
 * snapshot at once, and the backend saves in the background (debounced and
 * retried; queued while offline).
 */
import type {
  ClinicalEvent,
  InboundMessage,
  LearnedRule,
  Mother,
  OutboundMessage,
  Override,
  RuleProposal,
} from '../types';
import type {
  AIProxyRequest,
  AIProxyResponse,
  Identity,
  MessageStatusUpdate,
  SendMessageRequest,
  SendMessageResponse,
} from './syncTypes';

export type BackendKind = 'artifact' | 'http' | 'local';

/** Shared, non-clinical demo settings everyone sees (the simulated clock, content release) */
export type SharedMeta = Record<string, unknown> & {
  clock?: string;
  libraryVersion?: string;
};

export interface HostedSnapshot {
  mothers: Mother[];
  overrides: Override[];
  proposals: RuleProposal[];
  learnedRules: LearnedRule[];
  outbound: OutboundMessage[];
  inbound: InboundMessage[];
  meta: SharedMeta;
}

/** Something the worker should see: a write that replaced someone else's, or a save that failed */
export interface BackendNote {
  id: string;
  at: string;
  level: 'info' | 'warning' | 'error';
  /** Plain English, ready to show */
  text: string;
  motherId?: string;
}

export interface BackendStatus {
  kind: BackendKind;
  /** e.g. 'Shared demo workspace', 'Gaskin server (Kaduna)', 'This device only' */
  label: string;
  /** The shared store or server answered recently */
  online: boolean;
  /** Changes not yet confirmed by the shared store or server */
  pending: number;
  lastSyncAt?: string;
  /** The data shown has not been confirmed yet (cached, or loading) */
  stale: boolean;
  /** Why this backend fell back, e.g. 'Shared storage is not available here, so changes stay on this device' */
  fallbackReason?: string;
}

export interface BackendUpdate {
  snapshot: HostedSnapshot;
  /** Mothers whose record or timeline changed in this update ('all' after a reload) */
  changedMotherIds: string[] | 'all';
  /** Notes raised since the previous update */
  notes: BackendNote[];
  /** Delivery receipts that arrived since the previous update */
  messageUpdates: MessageStatusUpdate[];
  status: BackendStatus;
  /** 'remote' when someone else (or the server) caused it */
  origin: 'local' | 'remote';
}

export interface SendOptions {
  /** Called with each delivery step as receipts arrive (also delivered through subscribe) */
  onStatus?: (u: MessageStatusUpdate) => void;
}

export interface AIProxyCallOptions {
  signal?: AbortSignal;
  /** Whole text so far, while streaming */
  onText?: (text: string) => void;
}

export interface Backend {
  readonly kind: BackendKind;

  /** Read the current shared state. `null` means the store is empty (seed it or show onboarding). */
  load(): Promise<HostedSnapshot | null>;

  /** Hear every change, local or remote. Returns an unsubscribe function. Subscribe once. */
  subscribe(listener: (u: BackendUpdate) => void): () => void;

  /** Append clinical events to a mother's timeline. Idempotent by event id; never overwrites. */
  appendEvents(motherId: string, events: ClinicalEvent[]): Promise<void>;

  /** Create or update a mother's record (registration, contact details, consent). Last writer wins. */
  saveMother(mother: Mother): Promise<void>;

  saveOverride(override: Override): Promise<void>;

  saveProposal(proposal: RuleProposal): Promise<void>;

  /** Approved rules (clinical reviewers only on the server) */
  saveRule(rule: LearnedRule): Promise<void>;

  /** Record a message from a mother (simulated phone, or a gateway on the server) */
  saveInbound(message: InboundMessage): Promise<void>;

  /**
   * Send (or, on the demo backends, simulate sending) a message. Resolves with
   * the first status; later receipts arrive through `opts.onStatus` and `subscribe`.
   */
  sendMessage(req: SendMessageRequest, opts?: SendOptions): Promise<SendMessageResponse>;

  /**
   * De-identified AI call through the server. Only the http backend has one;
   * the others reject with an Error whose `code` is 'unavailable' (the AI
   * layer then uses its own providers).
   */
  aiProxy(req: AIProxyRequest, opts?: AIProxyCallOptions): Promise<AIProxyResponse>;
  /** True when aiProxy can be used now */
  hasAIProxy(): boolean;

  /** Who is using Gaskin here, and what they may do */
  whoami(): Promise<Identity>;

  /** Shared demo settings (simulated clock, library version) */
  saveMeta(patch: SharedMeta): Promise<void>;

  /** This user's own settings (language, AI choice), private to them */
  getUserSettings<T = unknown>(key: string): Promise<T | undefined>;
  setUserSettings(key: string, value: unknown): Promise<void>;

  /** Write a whole snapshot into an empty store (explicit "load demo data", or import). */
  importSnapshot(s: HostedSnapshot): Promise<void>;

  /** Save everything pending now (before unload, export or logout) */
  flush(): Promise<void>;

  status(): BackendStatus;

  /** Stop listening and timers */
  close(): void;
}

export class BackendError extends Error {
  code: 'unavailable' | 'unauthorised' | 'forbidden' | 'offline' | 'invalid' | 'conflict' | 'server';
  constructor(code: BackendError['code'], message: string) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
  }
}

export function emptySnapshot(): HostedSnapshot {
  return { mothers: [], overrides: [], proposals: [], learnedRules: [], outbound: [], inbound: [], meta: {} };
}

/** A small listener set shared by the implementations */
export class Listeners<T> {
  private fns = new Set<(v: T) => void>();
  add(fn: (v: T) => void): () => void {
    this.fns.add(fn);
    return () => {
      this.fns.delete(fn);
    };
  }
  emit(v: T): void {
    for (const fn of [...this.fns]) {
      try {
        fn(v);
      } catch (e) {
        console.error('[gaskin] backend listener failed', e);
      }
    }
  }
  get size(): number {
    return this.fns.size;
  }
}

export function noteId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
