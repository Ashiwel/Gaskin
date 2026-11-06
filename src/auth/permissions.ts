import type { Mother, Worker } from '../types';
import type { Action, AuthRole, WorkerProfile } from './types';

/**
 * What a profile may do. Mirrors the hosted server's CAN table (server/src/auth.ts):
 * - worker: her own caseload; edit plans; community insights.
 * - supervisor (role or isSupervisor): the facility's caseload, wider insights, manage workers, export, settings.
 * - clinical_reviewer (role or isClinicalReviewer): as supervisor for records, plus approve proposals;
 *   publishing a release needs a reviewer who is also a supervisor (two hats, one person accountable).
 * - programme_officer: aggregate insights only; no named records.
 * - admin: manages workers and settings; not a clinical role, so no records unless also scoped.
 * - personal (a woman using Gaskin for herself): her own record, export and settings; nothing else.
 */
export function can(w: Pick<WorkerProfile, 'role' | 'isSupervisor' | 'isClinicalReviewer' | 'active'> & { personal?: boolean }, action: Action): boolean {
  if (!w.active) return false;
  if (w.personal) return action === 'view_own_caseload' || action === 'export_data' || action === 'change_settings';
  const role = w.role;
  const clinical = role === 'worker' || role === 'supervisor' || role === 'clinical_reviewer';
  const sup = role === 'supervisor' || w.isSupervisor;
  const reviewer = role === 'clinical_reviewer' || w.isClinicalReviewer;
  switch (action) {
    case 'view_own_caseload':
      return clinical;
    case 'view_facility':
      return clinical && (sup || reviewer);
    case 'edit_plan':
      return clinical;
    case 'approve_proposals':
      return reviewer && clinical;
    case 'publish_releases':
      return reviewer && (sup || role === 'clinical_reviewer') && clinical;
    case 'view_insights_community':
      return role !== 'admin';
    case 'view_insights_wider':
      return sup || reviewer || role === 'programme_officer';
    case 'manage_workers':
      return sup || role === 'admin';
    case 'export_data':
      return sup || role === 'admin';
    case 'change_settings':
      return sup || role === 'admin';
    default:
      return false;
  }
}

/** Is this mother in the worker's own caseload? Assigned to her, or added to her caseload as cover. */
export function inOwnCaseload(w: Pick<WorkerProfile, 'id' | 'caseloadMotherIds'>, m: Pick<Mother, 'id' | 'assignedWorkerId'>): boolean {
  return m.assignedWorkerId === w.id || !!w.caseloadMotherIds?.includes(m.id);
}

/**
 * The mothers a worker sees: her own by default; the whole facility when asked for and permitted.
 * A personal-use profile sees only the record whose id matches her caseload list.
 */
export function caseloadFor<M extends Pick<Mother, 'id' | 'assignedWorkerId' | 'facilityId'>>(w: WorkerProfile, mothers: M[], scope: 'own' | 'facility' = 'own'): M[] {
  if (!w.active) return [];
  if (w.personal) return mothers.filter((m) => w.caseloadMotherIds?.includes(m.id) || m.assignedWorkerId === w.id);
  if (scope === 'facility' && can(w, 'view_facility')) return mothers.filter((m) => m.facilityId === w.facilityId || inOwnCaseload(w, m));
  if (!can(w, 'view_own_caseload')) return [];
  return mothers.filter((m) => inOwnCaseload(w, m));
}

/** Local profile from a seed Worker (same roles as the hosted server). */
export function profileFromWorker(w: Worker, mothers: Mother[] = [], createdAt = '2026-01-01T00:00:00.000Z'): WorkerProfile {
  const role: AuthRole = w.isClinicalReviewer ? 'clinical_reviewer' : 'worker';
  const mine = mothers.filter((m) => m.assignedWorkerId === w.id);
  return {
    id: w.id,
    name: w.name,
    role,
    cadre: w.role,
    facilityId: w.facilityId,
    country: w.country,
    communities: [...new Set(mine.map((m) => m.community))],
    languages: [...new Set(['en' as const, ...mine.map((m) => m.language)])],
    isClinicalReviewer: !!w.isClinicalReviewer,
    isSupervisor: !!w.isClinicalReviewer || w.role === 'obgyn' || w.role === 'doctor',
    active: true,
    createdAt,
    createdBy: 'seed',
  };
}

/** The hosted Identity role for a profile, for logging in to the server with the same account. */
export function hostedRole(w: WorkerProfile): AuthRole {
  if (w.role === 'worker' && w.isClinicalReviewer) return 'clinical_reviewer';
  if (w.role === 'worker' && w.isSupervisor) return 'supervisor';
  return w.role;
}
