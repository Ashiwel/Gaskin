import { describe, expect, it } from 'vitest';
import { AIProxy, AIProxyError } from '../src/ai';
import { Store } from '../src/store';
import { FAC_A, makeUser, mother, profile, testConfig, testDb } from './helpers';

function fakeModel() {
  const calls: Array<{ url: string; body: { messages: Array<{ role: string; content: string }> } }> = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello [MOTHER], please come to [FACILITY] on Monday.' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fn, calls };
}

describe('AI proxy', () => {
  const cfg = testConfig({ AI_BASE_URL: 'http://model.local/v1', AI_MODEL: 'qwen2.5-7b-instruct', AI_RESIDENCY: 'in_country' });

  it('de-identifies the prompt on the server before calling the model, and restores names in the reply', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A], 'Bisola Adebayo');
    const m = mother('m-1', FAC_A, { name: 'Chiamaka Okonkwo', community: 'Itire', phone: { access: 'smartphone', number: '0803 111 2222', hasWhatsApp: true }, email: 'chiamaka@example.com' });
    await store.sync(user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(m) }] });
    const model = fakeModel();
    const proxy = new AIProxy(cfg, db, store, model.fn);

    // A client that skipped its own de-identification (or a modified one)
    const leaky = 'Write a reminder for Chiamaka Okonkwo of Itire (phone 0803 111 2222, chiamaka@example.com), aged 27, seen by Bisola Adebayo at Surulere PHC on 3 November 2026.';
    const r = await proxy.complete(user, { task: 'personalise', prompt: leaky, motherId: 'm-1' });

    expect(model.calls).toHaveLength(1);
    expect(model.calls[0].url).toBe('http://model.local/v1/chat/completions');
    const sent = model.calls[0].body.messages.map((x) => x.content).join('\n');
    for (const secret of ['Chiamaka', 'Okonkwo', 'Itire', '0803', '2222', 'chiamaka@example.com', 'Bisola', 'Adebayo', 'Surulere', '3 November 2026', 'aged 27'])
      expect(sent).not.toContain(secret);
    expect(sent).toContain('[MOTHER]');
    expect(sent).toContain('[PHONE]');
    expect(r.deidentified).toBe(true);
    expect(r.removed).toEqual(expect.arrayContaining(['name', 'phone number', 'email', 'community']));
    // Re-identified locally on the way back: first name only
    expect(r.text).toContain('Hello Chiamaka,');
    expect(r.text).not.toContain('Okonkwo');

    // The audit row records the call without content
    const rows = await db.all<{ action: string; outcome: string; detail: string }>("SELECT action, outcome, detail FROM audit WHERE action LIKE 'ai.%'");
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('ok');
    expect(rows[0].detail).not.toMatch(/Chiamaka|Itire|reminder/);
  });

  it('scrubs other mothers in the worker’s scope even when the prompt is not about them', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    await store.sync(user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-2', FAC_A, { name: 'Halima Garba', community: 'Tudun Wada' })) }] });
    const model = fakeModel();
    const proxy = new AIProxy(cfg, db, store, model.fn);
    await proxy.complete(user, { task: 'explain', prompt: 'Compare with Halima Garba from Tudun Wada.' });
    const sent = model.calls[0].body.messages[1].content;
    expect(sent).not.toMatch(/Halima|Garba|Tudun Wada/);
  });

  it('refuses a mother outside the worker’s facilities and sends nothing', async () => {
    const db = await testDb();
    const store = new Store(db);
    const a = await makeUser(db, 'worker', [FAC_A]);
    const b = await makeUser(db, 'worker', ['f-ng-limh']);
    await store.sync(a.user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1')) }] });
    const model = fakeModel();
    const proxy = new AIProxy(cfg, db, store, model.fn);
    await expect(proxy.complete(b.user, { task: 'personalise', prompt: 'x', motherId: 'm-1' })).rejects.toBeInstanceOf(AIProxyError);
    expect(model.calls).toHaveLength(0);
  });

  it('is off, and says so, when no model is configured', async () => {
    const db = await testDb();
    const store = new Store(db);
    const { user } = await makeUser(db, 'worker', [FAC_A]);
    const proxy = new AIProxy(testConfig(), db, store, fakeModel().fn);
    expect(proxy.enabled).toBe(false);
    await expect(proxy.complete(user, { task: 'explain', prompt: 'hi' })).rejects.toMatchObject({ status: 503 });
  });
});
