/**
 * Server-side data store and sync merge.
 *
 * Sync contract (POST /api/sync):
 *  1. The client uploads the ops it made since its last sync, each with a
 *     unique opId, plus its cursor.
 *  2. The server applies each op once. `applied_ops` remembers every opId,
 *     so a retry after a dropped connection is a duplicate, not a second
 *     write. Clinical events are also keyed by their own id and are
 *     append-only: an event is never changed or removed by sync.
 *  3. Mothers, overrides, proposals, rules and message records are
 *     last-writer-wins documents. When a write replaces a version another
 *     user saved after the one this client last saw, the response carries a
 *     conflict note so the worker can check the record.
 *  4. Every accepted write appends a row to `changes`. The client receives
 *     rows after its cursor, for the facilities it may see, except the rows
 *     its own device wrote.
 *
 * Facility scoping: a worker may read and write only mothers whose
 * facilityId is in her facility list. Proposals and approved rules are
 * global (no facility) because they change the shared knowledge base.
 */
import type { ClinicalEvent, InboundMessage, LearnedRule, Mother, OutboundMessage, Override, RuleProposal } from '../../src/types';
import type {
  ChangeKind,
  ChangeRow,
  MessageStatusUpdate,
  MotherProfile,
  SyncOp,
  SyncRequest,
  SyncResponse,
} from '../../src/hosted/syncTypes';
import { STATUS_RANK } from '../../src/hosted/syncTypes';
import { type AuthedUser, CAN } from './auth';
import { type DB, insertIgnore, nowIso, upsert } from './db';

export const MAX_OPS_PER_SYNC = 500;
export const MAX_CHANGES_PER_PULL = 1000;
const MAX_OP_BYTES = 256 * 1024;

export interface Conflict {
  entityId: string;
  kind: ChangeKind;
  /** Plain English for the worker */
  note: string;
}

export interface SyncResult extends SyncResponse {
  conflicts: Conflict[];
  /** Mothers whose timeline or record changed in this upload (for alert checks) */
  touchedMotherIds: string[];
}

type MotherRow = { id: string; facility_id: string; country: string; body: string; updated_at: string; updated_by: string | null };

function isStr(v: unknown, max = 200): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

/** Shape checks only: the server is not the clinical validator, but it refuses garbage */
export function validateOp(op: unknown): string | null {
  const o = op as SyncOp;
  if (!o || typeof o !== 'object') return 'Not an object.';
  if (!isStr(o.opId, 120)) return 'Missing opId.';
  let size = 0;
  try {
    size = JSON.stringify(o).length;
  } catch {
    return 'Not JSON.';
  }
  if (size > MAX_OP_BYTES) return 'Too large.';
  switch (o.kind) {
    case 'mother':
      if (!o.mother || !isStr(o.mother.id) || !isStr(o.mother.facilityId) || !isStr(o.mother.name, 300)) return 'Mother needs id, name and facilityId.';
      return null;
    case 'event':
      if (!isStr(o.motherId) || !o.event || !isStr(o.event.id) || !isStr(o.event.kind, 40) || !isStr(o.event.at, 40)) return 'Event needs id, kind and at.';
      if (Number.isNaN(Date.parse(o.event.at))) return 'Event time is not a date.';
      return null;
    case 'override':
      return o.override && isStr(o.override.id) && isStr(o.override.motherId) ? null : 'Override needs id and motherId.';
    case 'proposal':
      return o.proposal && isStr(o.proposal.id) ? null : 'Proposal needs an id.';
    case 'rule':
      return o.rule && isStr(o.rule.id) ? null : 'Rule needs an id.';
    case 'message':
      return o.message && isStr(o.message.id) && isStr(o.message.motherId) ? null : 'Message needs id and motherId.';
    case 'inbound':
      return o.message && isStr(o.message.id) && isStr(o.message.motherId) ? null : 'Inbound message needs id and motherId.';
    default:
      return `Unknown kind ${(o as { kind?: string }).kind}.`;
  }
}

export class Store {
  db: DB;
  constructor(db: DB) {
    this.db = db;
  }

  // ---------- Reads ----------

  async motherRow(id: string, db: DB = this.db): Promise<MotherRow | undefined> {
    return db.get<MotherRow>('SELECT id, facility_id, country, body, updated_at, updated_by FROM mothers WHERE id = ? AND deleted = 0', [id]);
  }

  async eventsFor(motherId: string, db: DB = this.db): Promise<ClinicalEvent[]> {
    const rows = await db.all<{ body: string }>('SELECT body FROM events WHERE mother_id = ? ORDER BY at, id', [motherId]);
    return rows.map((r) => JSON.parse(r.body) as ClinicalEvent);
  }

  async mother(id: string, db: DB = this.db): Promise<Mother | undefined> {
    const row = await this.motherRow(id, db);
    if (!row) return undefined;
    const profile = JSON.parse(row.body) as MotherProfile;
    return { ...profile, events: await this.eventsFor(id, db) };
  }

  /** Every mother at these facilities, with events */
  async mothersAt(facilityIds: string[] | 'all'): Promise<Mother[]> {
    const rows =
      facilityIds === 'all'
        ? await this.db.all<MotherRow>('SELECT * FROM mothers WHERE deleted = 0 ORDER BY id')
        : facilityIds.length === 0
          ? []
          : await this.db.all<MotherRow>(`SELECT * FROM mothers WHERE deleted = 0 AND facility_id IN (${facilityIds.map(() => '?').join(',')}) ORDER BY id`, facilityIds);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const evs = await this.db.all<{ mother_id: string; body: string }>(
      `SELECT mother_id, body FROM events WHERE mother_id IN (${ids.map(() => '?').join(',')}) ORDER BY at, id`,
      ids,
    );
    const byMother = new Map<string, ClinicalEvent[]>();
    for (const e of evs) {
      const list = byMother.get(e.mother_id) ?? [];
      list.push(JSON.parse(e.body) as ClinicalEvent);
      byMother.set(e.mother_id, list);
    }
    return rows.map((r) => ({ ...(JSON.parse(r.body) as MotherProfile), events: byMother.get(r.id) ?? [] }));
  }

  async docs<T>(kind: string, facilityIds: string[] | 'all' | 'global'): Promise<T[]> {
    let rows: Array<{ body: string }>;
    if (facilityIds === 'all' || facilityIds === 'global') rows = await this.db.all('SELECT body FROM docs WHERE kind = ? ORDER BY id', [kind]);
    else if (!facilityIds.length) rows = [];
    else
      rows = await this.db.all(
        `SELECT body FROM docs WHERE kind = ? AND (facility_id IS NULL OR facility_id IN (${facilityIds.map(() => '?').join(',')})) ORDER BY id`,
        [kind, ...facilityIds],
      );
    return rows.map((r) => JSON.parse(r.body) as T);
  }

  async currentCursor(db: DB = this.db): Promise<number> {
    const r = await db.get<{ m: number | null }>('SELECT MAX(seq) AS m FROM changes');
    return Number(r?.m ?? 0);
  }

  /** Full state a user may see, for a first load (cursor 0) */
  async snapshot(user: AuthedUser) {
    const scope = CAN.readRecords(user.role) ? user.facilityIds : [];
    const cursor = await this.currentCursor();
    const outbound = await this.docs<OutboundMessage>('message', scope);
    // Bring stored delivery status onto the message records
    const statuses = await this.messageStatuses(outbound.map((m) => m.id));
    return {
      cursor,
      mothers: await this.mothersAt(scope),
      overrides: await this.docs<Override>('override', scope),
      proposals: await this.docs<RuleProposal>('proposal', 'global'),
      learnedRules: await this.docs<LearnedRule>('rule', 'global'),
      outbound: outbound.map((m) => (statuses[m.id] ? { ...m, status: statuses[m.id] } : m)),
      inbound: await this.docs<InboundMessage>('inbound', scope),
    };
  }

  async messageStatuses(ids: string[]): Promise<Record<string, OutboundMessage['status']>> {
    if (!ids.length) return {};
    const out: Record<string, OutboundMessage['status']> = {};
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const rows = await this.db.all<{ id: string; status: OutboundMessage['status'] }>(`SELECT id, status FROM messages WHERE id IN (${chunk.map(() => '?').join(',')})`, chunk);
      for (const r of rows) out[r.id] = r.status;
    }
    return out;
  }

  // ---------- Change log ----------

  async appendChange(
    db: DB,
    c: { kind: ChangeKind; entityId: string; motherId?: string; facilityId?: string | null; by?: string; deviceId?: string; body: unknown },
  ): Promise<number> {
    const r = await db.run('INSERT INTO changes (kind, entity_id, mother_id, facility_id, at, by_user, device_id, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      c.kind,
      c.entityId,
      c.motherId ?? null,
      c.facilityId ?? null,
      nowIso(),
      c.by ?? null,
      c.deviceId ?? null,
      JSON.stringify(c.body),
    ]);
    return r.lastId ?? 0;
  }

  async changesSince(user: AuthedUser, deviceId: string, cursor: number, limit: number, db: DB = this.db): Promise<{ rows: ChangeRow[]; cursor: number; more: boolean }> {
    const max = await this.currentCursor(db);
    const scope = CAN.readRecords(user.role) ? user.facilityIds : [];
    const facClause = scope.length ? `facility_id IN (${scope.map(() => '?').join(',')}) OR ` : '';
    const rows = await db.all<{ seq: number; kind: ChangeKind; entity_id: string; mother_id: string | null; at: string; by_user: string | null; body: string }>(
      `SELECT seq, kind, entity_id, mother_id, at, by_user, body FROM changes
       WHERE seq > ? AND seq <= ? AND (${facClause}facility_id IS NULL) AND (device_id IS NULL OR device_id <> ?)
       ORDER BY seq LIMIT ?`,
      [cursor, max, ...scope, deviceId, limit],
    );
    const more = rows.length === limit;
    return {
      rows: rows.map((r) => ({ seq: Number(r.seq), kind: r.kind, entityId: r.entity_id, motherId: r.mother_id ?? undefined, at: r.at, by: r.by_user ?? undefined, body: JSON.parse(r.body) })),
      cursor: more ? Number(rows[rows.length - 1].seq) : Math.max(cursor, max),
      more,
    };
  }

  // ---------- Sync ----------

  async sync(user: AuthedUser, req: SyncRequest): Promise<SyncResult> {
    if (!isStr(req?.deviceId, 120)) throw new Error('deviceId is required.');
    const ops = Array.isArray(req.ops) ? req.ops.slice(0, MAX_OPS_PER_SYNC) : [];
    const limit = Math.min(Math.max(1, Number(req.limit) || MAX_CHANGES_PER_PULL), MAX_CHANGES_PER_PULL);
    const cursor = Math.max(0, Number(req.cursor) || 0);
    const accepted: string[] = [];
    const duplicates: string[] = [];
    const rejected: Array<{ opId: string; reason: string }> = [];
    const conflicts: Conflict[] = [];
    const touched = new Set<string>();

    const pulled = await this.db.tx(async (db) => {
      for (const op of ops) {
        const bad = validateOp(op);
        if (bad) {
          rejected.push({ opId: (op as { opId?: string })?.opId ?? '?', reason: bad });
          continue;
        }
        const seen = await db.get('SELECT op_id FROM applied_ops WHERE op_id = ?', [op.opId]);
        if (seen) {
          duplicates.push(op.opId);
          continue;
        }
        const res = await this.applyOp(db, user, req.deviceId, op);
        if (res.ok === false) {
          rejected.push({ opId: op.opId, reason: res.reason });
          continue;
        }
        await db.run(insertIgnore(db, 'applied_ops', ['op_id', 'user_id', 'applied_at']), [op.opId, user.id, nowIso()]);
        if (res.ok === 'duplicate') duplicates.push(op.opId);
        else accepted.push(op.opId);
        if (res.conflict) conflicts.push(res.conflict);
        if (res.motherId) touched.add(res.motherId);
      }
      return this.changesSince(user, req.deviceId, cursor, limit, db);
    });

    return {
      cursor: pulled.cursor,
      more: pulled.more,
      accepted,
      duplicates,
      rejected,
      conflicts,
      changes: pulled.rows,
      serverTime: nowIso(),
      touchedMotherIds: [...touched],
    };
  }

  private canTouch(user: AuthedUser, facilityId: string | undefined | null): boolean {
    return CAN.writeRecords(user.role) && !!facilityId && user.facilityIds.includes(facilityId);
  }

  /** Apply one op inside the sync transaction */
  async applyOp(
    db: DB,
    user: AuthedUser,
    deviceId: string | undefined,
    op: SyncOp,
  ): Promise<{ ok: true | 'duplicate'; conflict?: Conflict; motherId?: string } | { ok: false; reason: string }> {
    const now = nowIso();
    switch (op.kind) {
      case 'mother': {
        const m = op.mother as MotherProfile & { events?: unknown };
        const { events: _drop, ...profile } = m;
        void _drop;
        const existing = await this.motherRow(m.id, db);
        if (!this.canTouch(user, m.facilityId)) return { ok: false, reason: 'You do not have access to this facility.' };
        if (existing && !this.canTouch(user, existing.facility_id)) return { ok: false, reason: 'This mother is registered at a facility you cannot access.' };
        let conflict: Conflict | undefined;
        const base = op.baseUpdatedAt;
        if (existing && existing.updated_by && existing.updated_by !== user.id && base && existing.updated_at > base) {
          conflict = { entityId: m.id, kind: 'mother', note: `${profile.name.split(' ')[0]}'s record was also changed by someone else. Your version was saved; check the details.` };
        }
        await db.run(upsert(db, 'mothers', ['id', 'facility_id', 'country', 'body', 'updated_at', 'updated_by', 'deleted'], ['id']), [
          m.id,
          m.facilityId,
          m.country ?? 'NG',
          JSON.stringify(profile),
          now,
          user.id,
          0,
        ]);
        await this.appendChange(db, { kind: 'mother', entityId: m.id, motherId: m.id, facilityId: m.facilityId, by: user.id, deviceId, body: profile });
        return { ok: true, conflict, motherId: m.id };
      }
      case 'event': {
        const mother = await this.motherRow(op.motherId, db);
        if (!mother) return { ok: false, reason: 'Unknown mother. Sync her record before her events.' };
        if (!this.canTouch(user, mother.facility_id)) return { ok: false, reason: 'You do not have access to this mother.' };
        const r = await db.run(insertIgnore(db, 'events', ['id', 'mother_id', 'facility_id', 'kind', 'at', 'body', 'created_by', 'created_at']), [
          op.event.id,
          op.motherId,
          mother.facility_id,
          op.event.kind,
          op.event.at,
          JSON.stringify(op.event),
          user.id,
          now,
        ]);
        if (r.changes === 0) return { ok: 'duplicate', motherId: op.motherId };
        await this.appendChange(db, { kind: 'event', entityId: op.event.id, motherId: op.motherId, facilityId: mother.facility_id, by: user.id, deviceId, body: { motherId: op.motherId, event: op.event } });
        return { ok: true, motherId: op.motherId };
      }
      case 'override': {
        const mother = await this.motherRow(op.override.motherId, db);
        if (!mother || !this.canTouch(user, mother.facility_id)) return { ok: false, reason: 'You do not have access to this mother.' };
        return this.saveDoc(db, user, deviceId, 'override', op.override.id, op.override, mother.facility_id, op.override.motherId);
      }
      case 'proposal': {
        if (!CAN.writeRecords(user.role)) return { ok: false, reason: 'Your role cannot propose rule changes.' };
        // Only a clinical reviewer may set a review outcome
        const prev = await db.get<{ body: string }>("SELECT body FROM docs WHERE kind = 'proposal' AND id = ?", [op.proposal.id]);
        const prevStatus = prev ? (JSON.parse(prev.body) as RuleProposal).status : 'pending';
        if (op.proposal.status !== prevStatus && op.proposal.status !== 'pending' && !CAN.approveRules(user.role))
          return { ok: false, reason: 'Only a clinical reviewer can approve or reject a proposal.' };
        return this.saveDoc(db, user, deviceId, 'proposal', op.proposal.id, op.proposal, null);
      }
      case 'rule': {
        if (!CAN.approveRules(user.role)) return { ok: false, reason: 'Only a clinical reviewer can approve rules.' };
        return this.saveDoc(db, user, deviceId, 'rule', op.rule.id, op.rule, null);
      }
      case 'message': {
        const mother = await this.motherRow(op.message.motherId, db);
        if (!mother || !this.canTouch(user, mother.facility_id)) return { ok: false, reason: 'You do not have access to this mother.' };
        return this.saveDoc(db, user, deviceId, 'message', op.message.id, op.message, mother.facility_id, op.message.motherId);
      }
      case 'inbound': {
        const mother = await this.motherRow(op.message.motherId, db);
        if (!mother || !this.canTouch(user, mother.facility_id)) return { ok: false, reason: 'You do not have access to this mother.' };
        return this.saveDoc(db, user, deviceId, 'inbound', op.message.id, op.message, mother.facility_id, op.message.motherId);
      }
    }
  }

  async saveDoc(
    db: DB,
    user: { id: string } | undefined,
    deviceId: string | undefined,
    kind: 'override' | 'proposal' | 'rule' | 'message' | 'inbound',
    id: string,
    body: unknown,
    facilityId: string | null,
    motherId?: string,
  ): Promise<{ ok: true; motherId?: string }> {
    await db.run(upsert(db, 'docs', ['kind', 'id', 'mother_id', 'facility_id', 'body', 'updated_at', 'updated_by'], ['kind', 'id']), [
      kind,
      id,
      motherId ?? null,
      facilityId,
      JSON.stringify(body),
      nowIso(),
      user?.id ?? null,
    ]);
    await this.appendChange(db, { kind, entityId: id, motherId, facilityId, by: user?.id, deviceId, body });
    return { ok: true, motherId };
  }

  /** Apply a delivery receipt: status only moves forward, and every step is broadcast */
  async recordMessageStatus(u: MessageStatusUpdate): Promise<boolean> {
    return this.db.tx(async (db) => {
      const row = await db.get<{ status: OutboundMessage['status']; facility_id: string | null; mother_id: string }>('SELECT status, facility_id, mother_id FROM messages WHERE id = ?', [u.messageId]);
      if (!row) return false;
      const forward = u.status === 'failed' ? row.status !== 'delivered' && row.status !== 'read' : STATUS_RANK[u.status] > STATUS_RANK[row.status] || row.status === 'failed';
      if (!forward && u.status === row.status) return false;
      if (!forward) return false;
      await db.run('UPDATE messages SET status = ?, reason = COALESCE(?, reason), updated_at = ? WHERE id = ?', [u.status, u.reason ?? null, nowIso(), u.messageId]);
      await this.appendChange(db, { kind: 'messageStatus', entityId: u.messageId, motherId: row.mother_id, facilityId: row.facility_id, body: { ...u, motherId: row.mother_id } });
      return true;
    });
  }
}
