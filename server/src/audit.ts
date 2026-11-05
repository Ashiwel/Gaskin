/**
 * Audit log: who did what to which record, when, and whether it worked.
 * Never the content of a record, message or AI prompt. IP addresses are
 * stored as a salted hash so the log can show "same place" without keeping
 * a raw address (an IP address is personal data under the NDPA).
 */
import { createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import { nowIso } from './db';

const IP_SALT = process.env.AUDIT_IP_SALT ?? randomBytes(16).toString('hex');

export interface AuditEntry {
  userId?: string;
  role?: string;
  action: string;
  entity?: string;
  entityId?: string;
  facilityId?: string;
  ip?: string;
  outcome: 'ok' | 'denied' | 'error' | 'blocked';
  /** Short, content-free detail: counts, ids, categories. Never names or text. */
  detail?: Record<string, unknown>;
}

export async function audit(db: DB, e: AuditEntry): Promise<void> {
  try {
    await db.run('INSERT INTO audit (at, user_id, role, action, entity, entity_id, facility_id, ip_hash, outcome, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      nowIso(),
      e.userId ?? null,
      e.role ?? null,
      e.action,
      e.entity ?? null,
      e.entityId ?? null,
      e.facilityId ?? null,
      e.ip ? createHash('sha256').update(IP_SALT + e.ip).digest('hex').slice(0, 16) : null,
      e.outcome,
      e.detail ? JSON.stringify(e.detail).slice(0, 2000) : null,
    ]);
  } catch (err) {
    // Auditing must not take the service down, but it must be visible
    console.error('[audit] write failed', (err as Error).message);
  }
}
