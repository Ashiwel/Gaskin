import { describe, expect, it } from 'vitest';
import { Store } from '../src/store';
import { FAC_A, FAC_B, makeUser, mother, profile, testDb, visit } from './helpers';

describe('sync merge', () => {
  it('applies each op once: a retried upload is a duplicate, not a second write', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    const m = mother('m-1');
    const ops = [
      { opId: 'op-1', kind: 'mother' as const, mother: profile(m) },
      { opId: 'op-2', kind: 'event' as const, motherId: 'm-1', event: visit('e-1', '2026-08-01T09:00:00.000Z') },
      { opId: 'op-3', kind: 'event' as const, motherId: 'm-1', event: visit('e-2', '2026-09-01T09:00:00.000Z', 2) },
    ];
    const first = await store.sync(user, { deviceId: 'phone-a', cursor: 0, ops });
    expect(first.accepted).toEqual(['op-1', 'op-2', 'op-3']);
    expect(first.rejected).toEqual([]);

    // The connection dropped before the reply arrived: the phone sends the same batch again
    const retry = await store.sync(user, { deviceId: 'phone-a', cursor: 0, ops });
    expect(retry.accepted).toEqual([]);
    expect(retry.duplicates).toEqual(['op-1', 'op-2', 'op-3']);

    const events = await db.all('SELECT id FROM events WHERE mother_id = ?', ['m-1']);
    expect(events).toHaveLength(2);
    const changes = await db.all("SELECT seq FROM changes WHERE kind = 'event'");
    expect(changes).toHaveLength(2);
  });

  it('treats the same event id from two devices as one event (append-only, idempotent by event id)', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    await store.sync(user, { deviceId: 'a', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1')) }] });
    const ev = visit('e-shared', '2026-08-01T09:00:00.000Z');
    const a = await store.sync(user, { deviceId: 'a', cursor: 0, ops: [{ opId: 'a-1', kind: 'event', motherId: 'm-1', event: ev }] });
    // A different op id carrying the same event (exported and re-imported, say)
    const b = await store.sync(user, { deviceId: 'b', cursor: 0, ops: [{ opId: 'b-1', kind: 'event', motherId: 'm-1', event: { ...ev, note: 'edited copy' } }] });
    expect(a.accepted).toEqual(['a-1']);
    expect(b.duplicates).toEqual(['b-1']);
    const m = await store.mother('m-1');
    expect(m!.events).toHaveLength(1);
    // The first write wins: events are never overwritten
    expect(m!.events[0].note).toBeUndefined();
  });

  it('returns other devices’ changes after the cursor, never echoing the device’s own', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    const a1 = await store.sync(user, { deviceId: 'a', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1')) }] });
    expect(a1.changes).toHaveLength(0);
    const b1 = await store.sync(user, { deviceId: 'b', cursor: 0, ops: [{ opId: 'b-1', kind: 'event', motherId: 'm-1', event: visit('e-b', '2026-08-02T09:00:00.000Z') }] });
    expect(b1.changes.map((c) => c.kind)).toEqual(['mother']);
    const a2 = await store.sync(user, { deviceId: 'a', cursor: a1.cursor, ops: [] });
    expect(a2.changes.map((c) => c.entityId)).toEqual(['e-b']);
    const a3 = await store.sync(user, { deviceId: 'a', cursor: a2.cursor, ops: [] });
    expect(a3.changes).toEqual([]);
  });

  it('scopes reads and writes to the worker’s facilities', async () => {
    const db = await testDb();
    const store = new Store(db);
    const a = await makeUser(db, 'worker', [FAC_A]);
    const b = await makeUser(db, 'worker', [FAC_B]);
    await store.sync(a.user, { deviceId: 'a', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1', FAC_A)) }] });
    const denied = await store.sync(b.user, { deviceId: 'b', cursor: 0, ops: [{ opId: 'x', kind: 'event', motherId: 'm-1', event: visit('e-x', '2026-08-02T09:00:00.000Z') }] });
    expect(denied.rejected[0]).toMatchObject({ opId: 'x' });
    expect(denied.changes).toEqual([]);
    const officer = await makeUser(db, 'programme_officer', [FAC_A]);
    const o = await store.sync(officer.user, { deviceId: 'o', cursor: 0, ops: [] });
    expect(o.changes).toEqual([]);
  });

  it('only a clinical reviewer can approve a proposal or publish a rule', async () => {
    const db = await testDb();
    const store = new Store(db);
    const w = await makeUser(db, 'worker', [FAC_A]);
    const r = await makeUser(db, 'clinical_reviewer', [FAC_A]);
    const proposal = { id: 'p-1', title: 'x', appliesWhen: {}, effect: 'remove' as const, itemId: 'i', rationale: 'r', supportingOverrideIds: [], supportingWorkerIds: [], status: 'pending' as const, createdAt: '2026-08-01T00:00:00.000Z' };
    expect((await store.sync(w.user, { deviceId: 'w', cursor: 0, ops: [{ opId: 'p1', kind: 'proposal', proposal }] })).accepted).toEqual(['p1']);
    const approved = { ...proposal, status: 'approved' as const };
    expect((await store.sync(w.user, { deviceId: 'w', cursor: 0, ops: [{ opId: 'p2', kind: 'proposal', proposal: approved }] })).rejected).toHaveLength(1);
    expect((await store.sync(r.user, { deviceId: 'r', cursor: 0, ops: [{ opId: 'p3', kind: 'proposal', proposal: approved }] })).accepted).toEqual(['p3']);
    const rule = { id: 'lr-1', proposalId: 'p-1', appliesWhen: {}, effect: 'remove' as const, itemId: 'i', approvedBy: 'r', approvedAt: '2026-08-02T00:00:00.000Z' };
    expect((await store.sync(w.user, { deviceId: 'w', cursor: 0, ops: [{ opId: 'r1', kind: 'rule', rule }] })).rejected).toHaveLength(1);
  });

  it('flags a last-writer-wins conflict when someone else saved the record after the client’s copy', async () => {
    const db = await testDb();
    const store = new Store(db);
    const a = await makeUser(db, 'worker', [FAC_A], 'Amina');
    const b = await makeUser(db, 'worker', [FAC_A], 'Bisi');
    const m = mother('m-1');
    await store.sync(a.user, { deviceId: 'a', cursor: 0, ops: [{ opId: 'm1', kind: 'mother', mother: profile(m) }] });
    const base = '2000-01-01T00:00:00.000Z';
    const r = await store.sync(b.user, { deviceId: 'b', cursor: 0, ops: [{ opId: 'm2', kind: 'mother', mother: { ...profile(m), community: 'Ojuelegba' }, baseUpdatedAt: base }] });
    expect(r.accepted).toEqual(['m2']);
    expect(r.conflicts[0].note).toMatch(/also changed by someone else/);
    expect((await store.mother('m-1'))!.community).toBe('Ojuelegba');
  });

  it('rejects malformed ops without failing the batch', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    const r = await store.sync(user, {
      deviceId: 'a',
      cursor: 0,
      ops: [
        { opId: 'bad', kind: 'event', motherId: 'm-1', event: { id: 'e', kind: 'visit', at: 'not a date' } } as never,
        { opId: 'ok', kind: 'mother', mother: profile(mother('m-1')) },
      ],
    });
    expect(r.rejected.map((x) => x.opId)).toEqual(['bad']);
    expect(r.accepted).toEqual(['ok']);
  });
});
