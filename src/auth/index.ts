/**
 * Several health workers on one device or facility. Contract: CONTRACTS.md, "Workers".
 */
export { AuthStore, getAuthStore, _resetAuthStore, unlockStatus, resetPinWithRecoveryCode, resetPinBySupervisor, MAX_ATTEMPTS, LOCK_MINUTES, DEFAULT_AUTO_LOCK_MINUTES } from './store';
export type { AuthStoreOptions } from './store';
export { can, caseloadFor, inOwnCaseload, profileFromWorker, hostedRole } from './permissions';
export { hashSecret, verifySecret, pinProblem, newRecoveryCode, normaliseRecoveryCode, constantTimeEqual, PIN_ITERATIONS } from './pin';
export { stampEvent, stampOverride, revertOverride, stampOutbound, stampInbound, stampProposal, missingActors } from './actor';
export { AuthError, AUTH_ROLES } from './types';
export type { Action, AuthRole, WorkerProfile, Credentials, Session, UnlockStatus, AuthAuditEntry, AuthAuditAction, PinRecord, WrappedKey } from './types';
