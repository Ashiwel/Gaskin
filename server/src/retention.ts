/**
 * Data retention, run daily. Defaults are NDPA-minded: keep what care
 * needs, drop what it does not.
 *
 *  - Message bodies: the text of SMS/WhatsApp/email is removed after
 *    RETENTION_MESSAGE_BODY_DAYS (90). Status, channel, cost and time stay
 *    for reporting. The care plan itself is rebuilt from events, so the
 *    text is not the record.
 *  - Sync change log and applied op ids: pruned after RETENTION_OPLOG_DAYS
 *    (180). A device that has not synced for longer reloads a snapshot.
 *  - Sessions: expired sessions are deleted.
 *  - Audit log: kept RETENTION_AUDIT_DAYS (730), long enough for a
 *    regulator's question about a breach or access.
 *  - Clinical records: never deleted automatically by default. Health
 *    records must be kept for years under facility rules; records with no
 *    event for RETENTION_INACTIVE_YEARS are listed for the data protection
 *    officer to review (or deleted when RETENTION_AUTO_DELETE=true).
 */
import type { ServerConfig } from './config';
import type { DB } from './db';
import { nowIso } from './db';
import { audit } from './audit';

export interface RetentionReport {
  at: string;
  messageBodiesCleared: number;
  changesPruned: number;
  opsPruned: number;
  sessionsDeleted: number;
  auditPruned: number;
  inactiveMothers: number;
  inactiveDeleted: number;
}

const days = (n: number, now: number) => new Date(now - n * 86_400_000).toISOString();

export async function runRetention(db: DB, cfg: ServerConfig['retention'], now = Date.now()): Promise<RetentionReport> {
  const r: RetentionReport = { at: nowIso(), messageBodiesCleared: 0, changesPruned: 0, opsPruned: 0, sessionsDeleted: 0, auditPruned: 0, inactiveMothers: 0, inactiveDeleted: 0 };
  const bodyCut = days(cfg.messageBodyDays, now);
  r.messageBodiesCleared = (await db.run('UPDATE messages SET body = NULL WHERE body IS NOT NULL AND created_at < ?', [bodyCut])).changes;
  // The synced message document carries the body too
  const docs = await db.all<{ id: string; body: string }>("SELECT id, body FROM docs WHERE kind = 'message' AND updated_at < ?", [bodyCut]);
  for (const d of docs) {
    const m = JSON.parse(d.body) as { body?: string };
    if (m.body && m.body !== '[removed after retention period]') {
      m.body = '[removed after retention period]';
      await db.run("UPDATE docs SET body = ? WHERE kind = 'message' AND id = ?", [JSON.stringify(m), d.id]);
    }
  }
  const opCut = days(Math.min(cfg.opLogDays, cfg.messageBodyDays), now);
  const maxPruned = await db.get<{ m: number | null }>('SELECT MAX(seq) AS m FROM changes WHERE at < ?', [days(cfg.opLogDays, now)]);
  r.changesPruned = (await db.run('DELETE FROM changes WHERE at < ?', [days(cfg.opLogDays, now)])).changes;
  r.changesPruned += (await db.run("DELETE FROM changes WHERE kind IN ('message', 'messageStatus', 'inbound') AND at < ?", [opCut])).changes;
  if (maxPruned?.m) await db.run(db.dialect === 'postgres' ? 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value' : 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['min_seq', String(maxPruned.m)]);
  r.opsPruned = (await db.run('DELETE FROM applied_ops WHERE applied_at < ?', [days(cfg.opLogDays, now)])).changes;
  r.sessionsDeleted = (await db.run('DELETE FROM sessions WHERE expires_at < ?', [new Date(now).toISOString()])).changes;
  r.auditPruned = (await db.run('DELETE FROM audit WHERE at < ?', [days(cfg.auditDays, now)])).changes;

  const inactiveCut = days(cfg.inactiveRecordYears * 365, now);
  const inactive = await db.all<{ id: string }>(
    'SELECT m.id FROM mothers m WHERE m.deleted = 0 AND COALESCE((SELECT MAX(e.at) FROM events e WHERE e.mother_id = m.id), m.updated_at) < ?',
    [inactiveCut],
  );
  r.inactiveMothers = inactive.length;
  if (cfg.autoDeleteInactive) {
    for (const m of inactive) {
      await db.tx(async (t) => {
        await t.run('DELETE FROM events WHERE mother_id = ?', [m.id]);
        await t.run('DELETE FROM docs WHERE mother_id = ?', [m.id]);
        await t.run('DELETE FROM messages WHERE mother_id = ?', [m.id]);
        await t.run('DELETE FROM changes WHERE mother_id = ?', [m.id]);
        await t.run("UPDATE mothers SET deleted = 1, body = '{}' WHERE id = ?", [m.id]);
      });
      r.inactiveDeleted++;
    }
  }
  await audit(db, { action: 'retention.run', outcome: 'ok', detail: { ...r } });
  return r;
}

export async function minSeq(db: DB): Promise<number> {
  const row = await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'min_seq'");
  return Number(row?.value ?? 0);
}
