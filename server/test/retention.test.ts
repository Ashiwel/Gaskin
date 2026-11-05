import { describe, expect, it } from 'vitest';
import { runRetention } from '../src/retention';
import { MessagingService } from '../src/messaging/service';
import { Store } from '../src/store';
import { FAC_A, makeUser, mother, outbound, profile, testConfig, testDb } from './helpers';

describe('retention', () => {
  it('clears old message text but keeps status and cost; never deletes clinical records by default', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    await store.sync(user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1')) }] });
    const svc = new MessagingService(testConfig(), db, store);
    await svc.send(user, { message: outbound('msg-old', 'm-1') });
    svc.close();
    const later = Date.now() + 91 * 86_400_000;
    const r = await runRetention(db, testConfig().retention, later);
    expect(r.messageBodiesCleared).toBe(1);
    const row = await db.get<{ body: string | null; status: string }>("SELECT body, status FROM messages WHERE id = 'msg-old'");
    expect(row!.body).toBeNull();
    expect(await db.all("SELECT * FROM message_costs WHERE message_id = 'msg-old'")).not.toHaveLength(0);
    const doc = await db.get<{ body: string }>("SELECT body FROM docs WHERE kind = 'message' AND id = 'msg-old'");
    expect(JSON.parse(doc!.body).body).toBe('[removed after retention period]');
    expect(await store.mother('m-1')).toBeTruthy();
  });
});
