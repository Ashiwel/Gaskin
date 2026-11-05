/**
 * Wire types shared by the hosted front end (src/hosted) and the production
 * service (server/). Pure types and tiny helpers only, so both the browser
 * bundle and Node can import this file.
 */
import type {
  Alert,
  Channel,
  ClinicalEvent,
  CountryCode,
  InboundMessage,
  LearnedRule,
  Mother,
  OutboundMessage,
  Override,
  RuleProposal,
} from '../types';

export type HostedRole = 'worker' | 'supervisor' | 'clinical_reviewer' | 'programme_officer' | 'admin';

/** A mother's record without her timeline. Events travel separately, append-only. */
export type MotherProfile = Omit<Mother, 'events'>;

export type MessageStatus = OutboundMessage['status'];

/**
 * One change a client made while offline (or online). `opId` is unique per
 * change and makes the upload idempotent: the server stores each opId once,
 * however many times a flaky connection retries it. Clinical events are also
 * idempotent by their own `event.id`.
 */
export type SyncOp =
  | {
      opId: string;
      kind: 'mother';
      mother: MotherProfile;
      /** When the client's copy was last confirmed by the server: lets it report a conflicting edit */
      baseUpdatedAt?: string;
    }
  | { opId: string; kind: 'event'; motherId: string; event: ClinicalEvent }
  | { opId: string; kind: 'override'; override: Override }
  | { opId: string; kind: 'proposal'; proposal: RuleProposal }
  | { opId: string; kind: 'rule'; rule: LearnedRule }
  | { opId: string; kind: 'message'; message: OutboundMessage }
  | { opId: string; kind: 'inbound'; message: InboundMessage };

export type SyncOpKind = SyncOp['kind'];

export interface MessageStatusUpdate {
  messageId: string;
  motherId?: string;
  status: MessageStatus;
  at: string;
  /** Gateway id, e.g. 'africastalking_sms' */
  provider?: string;
  providerMessageId?: string;
  /** Plain-English reason for a failure, e.g. 'Number is on the do-not-disturb list' */
  reason?: string;
  costLocal?: number;
  costUSD?: number;
  currency?: string;
  /** True when no real message left the server (sandbox mode, demo backends) */
  simulated?: boolean;
}

export type ChangeKind = SyncOpKind | 'messageStatus';

/** One row of the server's change log, as returned to other devices */
export interface ChangeRow {
  seq: number;
  kind: ChangeKind;
  entityId: string;
  motherId?: string;
  at: string;
  /** User id of the author */
  by?: string;
  /**
   * mother: MotherProfile; event: { motherId, event }; override: Override;
   * proposal: RuleProposal; rule: LearnedRule; message: OutboundMessage;
   * inbound: InboundMessage; messageStatus: MessageStatusUpdate
   */
  body: unknown;
}

export interface SyncRequest {
  /** Stable id of this device/browser; its own changes are not echoed back */
  deviceId: string;
  /** Last `cursor` the device received; 0 for a first sync */
  cursor: number;
  ops: SyncOp[];
  /** Max changes to return (server caps it) */
  limit?: number;
}

export interface SyncResponse {
  cursor: number;
  /** More changes are waiting: call again with the new cursor */
  more: boolean;
  accepted: string[];
  /** Op ids the server already had (a retry): safe to drop from the outbox */
  duplicates: string[];
  /** Ops refused for good (no access to that facility, invalid body). Drop them and show the reason. */
  rejected: Array<{ opId: string; reason: string }>;
  changes: ChangeRow[];
  serverTime: string;
  /** Last-writer-wins replaced someone else's newer edit: show these to the worker */
  conflicts?: Array<{ entityId: string; kind: ChangeKind; note: string }>;
  /** The cursor is older than the server keeps: drop local copies and reload with GET /api/snapshot */
  reset?: boolean;
  /** Emergency and urgent alerts the server's engine raised for mothers touched by this upload */
  alerts?: Array<{ motherId: string; alertIds: string[]; titles: string[]; level: 'emergency' | 'urgent' }>;
}

export interface Identity {
  userId: string;
  name: string;
  role: HostedRole;
  facilityIds: string[];
  /** Matching Worker.id in the clinical data, when the account is a health worker */
  workerId?: string;
  country?: CountryCode;
  /** False for view-only viewers of the shared demo and for programme officers */
  canWrite: boolean;
  source: 'artifact' | 'server' | 'local';
}

export interface LoginRequest {
  phone: string;
  pin: string;
  deviceId?: string;
  deviceName?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: Identity;
}

export type AIProxyTask = 'personalise' | 'translate' | 'extract' | 'explain' | 'suggest';

export interface AIProxyRequest {
  task: AIProxyTask;
  /** The prompt. The server de-identifies it again before any model sees it. */
  prompt: string;
  /** The mother the prompt is about: the server scrubs everything it knows about her */
  motherId?: string;
  json?: boolean;
  tier?: 'quick' | 'default';
  maxTokens?: number;
  /** Server-sent events with the whole text so far, re-identified */
  stream?: boolean;
}

export interface AIProxyResponse {
  /** The model's reply with first names and the sign-off restored */
  text: string;
  model: string;
  /** Categories of identifiers the server removed before the call */
  removed: string[];
  bytesSent: number;
  deidentified: true;
}

export interface SendMessageRequest {
  message: OutboundMessage;
  /** Override the number or address (e.g. a carer). Otherwise the server uses the mother's own. */
  to?: string;
  recipient?: 'mother' | 'carer';
  subject?: string;
}

export interface SendMessageResponse {
  messageId: string;
  status: MessageStatus;
  updates: MessageStatusUpdate[];
  simulated: boolean;
  reason?: string;
}

/** Channel -> gateway ids the server can use, from GET /api/config */
export interface ServerPublicConfig {
  name: string;
  version: string;
  messagingMode: 'sandbox' | 'live';
  channels: Partial<Record<Channel, string>>;
  ai: { enabled: boolean; model?: string; residency: 'in_country' | 'offshore' | 'unknown' };
  suppressBelow: number;
}

/** Shape of GET /api/mothers/:id/plan alerts, for supervisors' dashboards */
export type ServerAlert = Alert & { motherId: string; facilityId: string };

/** Safe-ish random id for ops and devices, without crypto.randomUUID on old browsers */
export function randomId(prefix = ''): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return prefix + c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Delivery steps only move forward: a late 'sent' receipt never overwrites 'delivered' */
export const STATUS_RANK: Record<MessageStatus, number> = { draft: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: 5 };

export function laterStatus(a: MessageStatus, b: MessageStatus): MessageStatus {
  return STATUS_RANK[b] >= STATUS_RANK[a] ? b : a;
}

/** Union of two event lists by id, sorted by time (append-only merge) */
export function mergeEvents(a: ClinicalEvent[], b: ClinicalEvent[]): ClinicalEvent[] {
  const byId = new Map<string, ClinicalEvent>();
  for (const e of a) byId.set(e.id, e);
  for (const e of b) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.id < y.id ? -1 : 1));
}

export function splitMother(m: Mother): { profile: MotherProfile; events: ClinicalEvent[] } {
  const { events, ...profile } = m;
  return { profile, events: events ?? [] };
}
