import { describe, expect, it } from 'vitest';
import type { MessageStatusUpdate } from '../../src/hosted/syncTypes';
import { MessagingService } from '../src/messaging/service';
import { AfricasTalkingGateway } from '../src/messaging/africastalking';
import { TermiiGateway } from '../src/messaging/termii';
import { WhatsAppGateway, templateParam } from '../src/messaging/whatsapp';
import { Store } from '../src/store';
import { FAC_A, makeUser, mother, outbound, profile, testConfig, testDb, waitFor } from './helpers';

async function setup(over: Partial<ReturnType<typeof mother>> = {}) {
  const db = await testDb();
  const store = new Store(db);
  const { user } = await makeUser(db, 'worker', [FAC_A]);
  await store.sync(user, { deviceId: 'd', cursor: 0, ops: [{ opId: 'm', kind: 'mother', mother: profile(mother('m-1', FAC_A, over)) }] });
  const svc = new MessagingService(testConfig(), db, store);
  return { db, store, user, svc };
}

describe('messaging gateway (sandbox)', () => {
  it('sends, then delivery receipts move the status to sent and delivered, logged with cost', async () => {
    const { db, user, svc } = await setup();
    const seen: MessageStatusUpdate[] = [];
    svc.onStatus((u) => seen.push(u));
    const r = await svc.send(user, { message: outbound('msg-1', 'm-1') });
    expect(r.simulated).toBe(true);
    expect(r.status).toBe('queued');
    await waitFor(() => seen.some((u) => u.status === 'delivered'));
    expect(seen.map((u) => u.status)).toEqual(['queued', 'sent', 'delivered']);

    const row = await db.get<{ status: string; recipient_hash: string; body: string; provider: string }>('SELECT status, recipient_hash, body, provider FROM messages WHERE id = ?', ['msg-1']);
    expect(row!.status).toBe('delivered');
    expect(row!.provider).toBe('sandbox');
    // The number is stored only as a hash
    expect(row!.recipient_hash).not.toContain('0803');
    const cost = await db.all<{ source: string; units: number; currency: string }>('SELECT source, units, currency FROM message_costs WHERE message_id = ?', ['msg-1']);
    expect(cost[0]).toMatchObject({ source: 'estimate', units: 1, currency: 'NGN' });

    // Every receipt is in the sync change log, so other devices see it
    const changes = await db.all<{ body: string }>("SELECT body FROM changes WHERE kind = 'messageStatus' AND entity_id = 'msg-1'");
    expect(changes.map((c) => JSON.parse(c.body).status)).toEqual(['sent', 'delivered']);
  });

  it('a late "sent" receipt never moves a delivered message backwards', async () => {
    const { store, user, svc } = await setup();
    await svc.send(user, { message: outbound('msg-2', 'm-1') });
    await waitFor(async () => (await store.messageStatuses(['msg-2']))['msg-2'] === 'delivered');
    const changed = await store.recordMessageStatus({ messageId: 'msg-2', status: 'sent', at: new Date().toISOString() });
    expect(changed).toBe(false);
    expect((await store.messageStatuses(['msg-2']))['msg-2']).toBe('delivered');
  });

  it('reports a do-not-disturb failure in plain English', async () => {
    const { user, svc } = await setup({ phone: { access: 'feature', number: '08030000000', hasWhatsApp: false } });
    const seen: MessageStatusUpdate[] = [];
    svc.onStatus((u) => seen.push(u));
    await svc.send(user, { message: outbound('msg-3', 'm-1') });
    const failed = await waitFor(() => seen.find((u) => u.status === 'failed'));
    expect(failed.reason).toMatch(/do-not-disturb/);
  });

  it('refuses to message a mother without messaging consent', async () => {
    const { user, svc } = await setup({ consent: { dataProcessing: true, messaging: false, recordedAt: '2026-07-01T00:00:00.000Z', recordedBy: 'w' } });
    const r = await svc.send(user, { message: outbound('msg-4', 'm-1') });
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/consent/);
  });
});

describe('provider adapters', () => {
  it("Africa's Talking: parses the send reply and the delivery report", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101, status: 'Success', cost: 'NGN 2.2000', messageId: 'ATXid_1' }] } }), { status: 201 })) as typeof fetch;
    const gw = new AfricasTalkingGateway({ username: 'sandbox', apiKey: 'k', sandbox: true, fetch: fetchFn }, 'sms');
    const r = await gw.send({ messageId: 'x', channel: 'sms', to: '+2348031112222', body: 'hi', language: 'en', country: 'NG', urgent: false });
    expect(r).toMatchObject({ status: 'sent', providerMessageId: 'ATXid_1', cost: { local: 2.2, currency: 'NGN' } });
    const dlr = await gw.handleWebhook({ method: 'POST', headers: {}, query: {}, contentType: 'application/x-www-form-urlencoded', rawBody: 'id=ATXid_1&status=Rejected&failureReason=DoNotDisturbRejection&phoneNumber=%2B2348031112222' });
    expect(dlr.items[0]).toMatchObject({ type: 'receipt', providerMessageId: 'ATXid_1', status: 'failed' });
    expect((dlr.items[0] as { reason: string }).reason).toMatch(/do-not-disturb/);
  });

  it('Termii: sends on the DND route by default', async () => {
    let body: Record<string, string> = {};
    const fetchFn = (async (_u: string | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ message_id: '9122821270554876574', message: 'Successfully Sent' }), { status: 200 });
    }) as typeof fetch;
    const gw = new TermiiGateway({ apiKey: 'k', senderId: 'Gaskin', baseUrl: 'https://api.ng.termii.com', route: 'dnd', fetch: fetchFn });
    const r = await gw.send({ messageId: 'x', channel: 'sms', to: '+2348031112222', body: 'hi', language: 'en', country: 'NG', urgent: true });
    expect(body.channel).toBe('dnd');
    expect(body.to).toBe('2348031112222');
    expect(r.providerMessageId).toBe('9122821270554876574');
  });

  it('WhatsApp: uses the utility template outside the 24-hour window and free text inside it', async () => {
    const sent: Array<{ type: string }> = [];
    const fetchFn = (async (_u: string | URL, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
    }) as typeof fetch;
    const gw = new WhatsAppGateway({ token: 't', phoneNumberId: '1', apiVersion: 'v23.0', template: 'gaskin_care_update', templateLanguage: 'en', fetch: fetchFn });
    const base = { messageId: 'x', channel: 'whatsapp' as const, to: '+2348031112222', body: 'Line one\nLine two', language: 'en' as const, country: 'NG' as const, urgent: false, firstName: 'Ngozi', facilityName: 'Surulere PHC' };
    await gw.send(base);
    await gw.send({ ...base, lastInboundAt: new Date().toISOString() });
    expect(sent.map((s) => s.type)).toEqual(['template', 'text']);
    expect(templateParam('a\nb\tc    d')).toBe('a · b · c   d');
    const wh = await gw.handleWebhook({
      method: 'POST',
      headers: {},
      query: {},
      contentType: 'application/json',
      rawBody: JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read', timestamp: '1762300000' }], messages: [{ from: '2348031112222', id: 'wamid.in', type: 'text', text: { body: 'I have a bad headache' } }] } }] }] }),
    });
    expect(wh.items.map((i) => i.type)).toEqual(['receipt', 'inbound']);
  });
});
