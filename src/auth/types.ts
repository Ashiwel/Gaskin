import type { CountryCode, LanguageCode, WorkerRole } from '../types';
import type { HostedRole } from '../hosted/syncTypes';

/** Same roles as the hosted server (server/src/auth.ts), so a local profile maps to an account one-to-one. */
export type AuthRole = HostedRole;

export const AUTH_ROLES: AuthRole[] = ['worker', 'supervisor', 'clinical_reviewer', 'programme_officer', 'admin'];

export interface WorkerProfile {
  /** Matches Worker.id in the clinical data */
  id: string;
  name: string;
  role: AuthRole;
  /** Professional cadre (midwife, CHEW, CHP...), or 'self' for a woman using Gaskin for herself */
  cadre: WorkerRole | 'self';
  facilityId: string;
  country?: CountryCode;
  /** Communities she covers (matches Mother.community) */
  communities: string[];
  /** Mothers assigned to her beyond Mother.assignedWorkerId (cover for a colleague) */
  caseloadMotherIds?: string[];
  languages: LanguageCode[];
  isClinicalReviewer: boolean;
  isSupervisor: boolean;
  /** Personal use: one person, her own record only */
  personal?: boolean;
  /** Phone for the hosted server login (phone + PIN), optional locally */
  phone?: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
}

export type Action =
  | 'view_own_caseload'
  | 'view_facility'
  | 'edit_plan'
  | 'approve_proposals'
  | 'publish_releases'
  | 'view_insights_community'
  | 'view_insights_wider'
  | 'manage_workers'
  | 'export_data'
  | 'change_settings';

export interface PinRecord {
  alg: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  hash: string;
}

export interface WrappedKey {
  salt: string;
  iv: string;
  iterations: number;
  data: string;
}

export interface Credentials {
  pin: PinRecord;
  recovery: PinRecord;
  failedAttempts: number;
  /** Number of lockouts since the last successful sign-in; sets the next backoff */
  lockLevel: number;
  lockedUntil?: string;
  pinSetAt: string;
  /** The device data key, wrapped by a key from her PIN and by a key from her recovery code */
  dataKey?: { byPin: WrappedKey; byRecovery: WrappedKey };
}

export interface Session {
  workerId: string;
  startedAt: string;
  lastActiveAt: string;
  /** Minutes of inactivity before the screen locks and needs the PIN again */
  autoLockMinutes: number;
}

export type AuthAuditAction =
  | 'worker.create'
  | 'worker.update'
  | 'worker.deactivate'
  | 'worker.reactivate'
  | 'pin.set'
  | 'pin.verify'
  | 'pin.lockout'
  | 'pin.reset.supervisor'
  | 'pin.reset.recovery'
  | 'session.login'
  | 'session.logout'
  | 'session.autolock'
  | 'session.switch'
  | 'datakey.unlock';

export interface AuthAuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: AuthAuditAction;
  targetId?: string;
  outcome: 'ok' | 'denied' | 'error';
  detail?: string;
}

export interface UnlockStatus {
  locked: boolean;
  lockedUntil?: string;
  attemptsLeft: number;
  /** Minutes the next lockout will last if she gets it wrong again */
  nextLockMinutes: number;
  active: boolean;
}

export class AuthError extends Error {
  code: 'locked' | 'wrong_pin' | 'weak_pin' | 'forbidden' | 'not_found' | 'inactive' | 'wrong_code' | 'invalid' | 'unsupported';
  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
