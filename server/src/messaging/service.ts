/**
 * Messaging service: picks the gateway for a channel, enforces consent and
 * quiet hours, sends, stores the message (with a hashed recipient), logs the
 * estimated and actual cost, and turns delivery receipts into status
 * updates that sync to every device.
 *
 * Routing (MESSAGING_MODE=live):
 *   sms      -> Termii (Nigeria, DND route) when configured, else Africa's Talking
 *   voice    -> Africa's Talking voice
 *   whatsapp -> WhatsApp Cloud API
 *   email    -> SMTP
 * Anything not configured, and everything in sandbox mode, goes to the
 * sandbox gateway, which never sends a real message.
 */
import { createHash } from 'node:crypto';
import type { Channel, CountryCode, Mother, OutboundMessage } from '../../../src/types';
import type { MessageStatusUpdate, SendMessageRequest, SendMessageResponse } from '../../../src/hosted/syncTypes';
import { COUNTRIES } from '../../../src/data/countries';
import { estimateCost } from '../../../src/messaging';
import type { ServerConfig } from '../config';
import { type DB, nowIso } from '../db';
import type { Store } from '../store';
import { normalisePhone } from '../auth';
import { AfricasTalkingGateway } from './africastalking';
import type { FetchFn, GatewayWebhookItem, MessageGateway, WebhookRequest, WebhookResult } from './gateway';
import { SandboxGateway } from './sandbox';
import { SmtpGateway } from './smtp';
import { TermiiGateway } from './termii';
import { WhatsAppGateway } from './whatsapp';

export interface InboundHandler {
  (msg: { channel: Channel; from: string; text: string; at: string; providerMessageId?: string }): Promise<void>;
}

export class MessagingService {
  readonly gateways = new Map<string, MessageGateway>();
  readonly routes: Partial<Record<Channel, MessageGateway>> = {};
  readonly sandbox: SandboxGateway;
  private listeners = new Set<(u: MessageStatusUpdate) => void>();
  private cfg: ServerConfig;
  private db: DB;
  private store: Store;
  onInbound?: InboundHandler;

  constructor(cfg: ServerConfig, db: DB, store: Store, opts: { fetch?: FetchFn; gateways?: MessageGateway[] } = {}) {
    this.cfg = cfg;
    this.db = db;
    this.store = store;
    this.sandbox = new SandboxGateway((item, gw) => void this.applyReceipt(gw, item), cfg.messaging.sandboxDelays);
    this.register(this.sandbox);
    const c = cfg.messaging.creds;
    const live = cfg.messaging.mode === 'live';
    if (c.africastalking) {
      const at = c.africastalking;
      const voiceScript = (sessionId: string) => this.voiceScript(sessionId);
      const webhookToken = process.env.AT_WEBHOOK_TOKEN || undefined;
      this.register(new AfricasTalkingGateway({ ...at, fetch: opts.fetch, voiceScript, webhookToken, requireAuth: live }, 'sms'));
      this.register(new AfricasTalkingGateway({ ...at, fetch: opts.fetch, voiceScript, webhookToken, requireAuth: live }, 'voice'));
    }
    // In live mode an unauthenticated webhook could forge delivery receipts or a "danger sign" SMS from a mother,
    // so every gateway refuses callbacks it cannot verify.
    if (c.termii) this.register(new TermiiGateway({ ...c.termii, webhookSecret: process.env.TERMII_WEBHOOK_SECRET, requireAuth: live, fetch: opts.fetch }));
    if (c.whatsapp) this.register(new WhatsAppGateway({ ...c.whatsapp, requireAuth: live, fetch: opts.fetch }));
    if (c.smtp) this.register(new SmtpGateway(c.smtp));
    for (const g of opts.gateways ?? []) this.register(g);

    const pick = (...ids: string[]) => ids.map((i) => this.gateways.get(i)).find(Boolean);
    for (const ch of ['sms', 'voice', 'whatsapp', 'email'] as Channel[]) this.routes[ch] = this.sandbox;
    if (live) {
      this.routes.sms = pick('termii_sms', 'africastalking_sms') ?? this.sandbox;
      this.routes.voice = pick('africastalking_voice') ?? this.sandbox;
      this.routes.whatsapp = pick('whatsapp_cloud') ?? this.sandbox;
      this.routes.email = pick('smtp_email') ?? this.sandbox;
    }
  }

  register(g: MessageGateway): void {
    this.gateways.set(g.id, g);
  }

  publicRoutes(): Partial<Record<Channel, string>> {
    const out: Partial<Record<Channel, string>> = {};
    for (const [ch, g] of Object.entries(this.routes)) if (g) out[ch as Channel] = g.id;
    return out;
  }

  onStatus(fn: (u: MessageStatusUpdate) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(u: MessageStatusUpdate) {
    for (const fn of this.listeners) fn(u);
  }

  recipientHash(to: string): string {
    return createHash('sha256').update(`gaskin:${to}`).digest('hex').slice(0, 32);
  }

  /** Inside the local quiet hours (default 20:00–08:00)? Nigerian bulk SMS rules bar promotional traffic at night, and mothers sleep. */
  inQuietHours(now = new Date()): boolean {
    const q = this.cfg.messaging.quietHours;
    if (!q) return false;
    const h = (now.getUTCHours() + this.cfg.messaging.timezoneOffsetHours + 24) % 24;
    const [start, end] = q;
    return start > end ? h >= start || h < end : h >= start && h < end;
  }

  async send(user: { id: string; facilityIds: string[] }, req: SendMessageRequest): Promise<SendMessageResponse> {
    const m = req.message;
    const mother = await this.store.mother(m.motherId);
    if (!mother) return this.refuse(m, 'Unknown mother.');
    if (!user.facilityIds.includes(mother.facilityId)) return this.refuse(m, 'You do not have access to this mother.');
    if (!mother.consent?.messaging) return this.refuse(m, 'She has not consented to messages. Record her consent first.');
    if (m.channel === 'print') return this.refuse(m, 'Printed handouts are not sent by the server.');

    const country = (mother.country ?? this.cfg.messaging.defaultCountry) as CountryCode;
    const to = this.resolveRecipient(mother, req, country);
    if (!to) return this.refuse(m, m.channel === 'email' ? 'No email address on her record.' : 'No phone number on her record.');
    if (m.channel === 'whatsapp' && !mother.phone?.hasWhatsApp && req.recipient !== 'carer') return this.refuse(m, 'Her record says she does not use WhatsApp. Send by SMS.');

    const urgent = m.itemIds.some((i) => i.startsWith('alert') || i.startsWith('danger')) || /danger|urgent|emergency/i.test(m.id);
    // Quiet hours delay routine messages; we queue them with a note rather than sending at 2am.
    const quiet = !urgent && this.inQuietHours();

    const gw = this.routes[m.channel] ?? this.sandbox;
    const est = estimateCost(m.channel, m.body, COUNTRIES[country]);
    const createdAt = nowIso();
    const firstName = mother.name.split(/\s+/)[0];
    const facility = await this.db.get<{ name: string }>('SELECT name FROM facilities WHERE id = ?', [mother.facilityId]);

    await this.db.run(
      `INSERT INTO messages (id, mother_id, facility_id, channel, provider, provider_message_id, recipient_hash, status, reason, body, segments, cost_local, cost_usd, currency, simulated, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, mother.id, mother.facilityId, m.channel, gw.id, this.recipientHash(to), quiet ? 'Held for quiet hours' : null, m.body, est.units, est.local, est.usd, COUNTRIES[country].currency, gw.simulated ? 1 : 0, user.id, createdAt, createdAt],
    );
    await this.logCost(m.id, gw.id, m.channel, country, est.units, est.unitLabel, est.local, est.usd, COUNTRIES[country].currency, 'estimate');
    // The message record syncs to other devices like any other document
    await this.db.tx((db) => this.store.saveDoc(db, user, undefined, 'message', m.id, { ...m, status: 'queued' } satisfies OutboundMessage, mother.facilityId, mother.id));

    if (quiet) {
      const u: MessageStatusUpdate = { messageId: m.id, motherId: mother.id, status: 'queued', at: createdAt, provider: gw.id, reason: 'Held until 8am (quiet hours). Danger-sign alerts are never held.', simulated: gw.simulated };
      return { messageId: m.id, status: 'queued', updates: [u], simulated: gw.simulated, reason: u.reason };
    }
    return this.dispatch(gw, m, mother, to, country, firstName, facility?.name, req.subject, urgent);
  }

  private async dispatch(gw: MessageGateway, m: OutboundMessage, mother: Mother, to: string, country: CountryCode, firstName: string, facilityName: string | undefined, subject: string | undefined, urgent: boolean): Promise<SendMessageResponse> {
    let result;
    try {
      const lastIn = await this.db.get<{ updated_at: string }>("SELECT updated_at FROM docs WHERE kind = 'inbound' AND mother_id = ? ORDER BY updated_at DESC LIMIT 1", [mother.id]);
      result = await gw.send({ messageId: m.id, channel: m.channel, to, body: m.body, subject, language: m.language, country, urgent, firstName, facilityName, lastInboundAt: lastIn?.updated_at });
    } catch (e) {
      result = { status: 'failed' as const, reason: `${gw.label} could not be reached: ${(e as Error).message.slice(0, 120)}` };
    }
    await this.db.run('UPDATE messages SET provider_message_id = ?, updated_at = ? WHERE id = ?', [result.providerMessageId ?? null, nowIso(), m.id]);
    if (result.cost) await this.logCost(m.id, gw.id, m.channel, country, result.cost.units, result.cost.unitLabel, result.cost.local, result.cost.usd, result.cost.currency, 'provider');
    const u: MessageStatusUpdate = { messageId: m.id, motherId: mother.id, status: result.status, at: nowIso(), provider: gw.id, providerMessageId: result.providerMessageId, reason: result.reason, simulated: gw.simulated };
    if (result.status !== 'queued') await this.store.recordMessageStatus(u);
    this.emit(u);
    return { messageId: m.id, status: result.status, updates: [u], simulated: gw.simulated, reason: result.reason };
  }

  private refuse(m: OutboundMessage, reason: string): SendMessageResponse {
    const u: MessageStatusUpdate = { messageId: m.id, motherId: m.motherId, status: 'failed', at: nowIso(), reason };
    return { messageId: m.id, status: 'failed', updates: [u], simulated: false, reason };
  }

  private resolveRecipient(mother: Mother, req: SendMessageRequest, country: CountryCode): string | undefined {
    if (req.message.channel === 'email') return req.to ?? mother.email;
    const raw = req.to ?? mother.phone?.number;
    return raw ? normalisePhone(raw, country) : undefined;
  }

  async logCost(messageId: string, provider: string, channel: Channel, country: string, units: number | undefined, unitLabel: string | undefined, local: number | undefined, usd: number | undefined, currency: string | undefined, source: 'estimate' | 'provider'): Promise<void> {
    await this.db.run('INSERT INTO message_costs (message_id, provider, channel, country, units, unit_label, cost_local, cost_usd, currency, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      messageId,
      provider,
      channel,
      country,
      units ?? null,
      unitLabel ?? null,
      local ?? null,
      usd ?? null,
      currency ?? null,
      source,
      nowIso(),
    ]);
  }

  /** A provider webhook arrived */
  async handleWebhook(gatewayId: string, req: WebhookRequest): Promise<WebhookResult | null> {
    const gw = this.gateways.get(gatewayId);
    if (!gw?.handleWebhook) return null;
    const res = await gw.handleWebhook(req);
    for (const item of res.items) {
      if (item.type === 'receipt') await this.applyReceipt(gw.id, item);
      else await this.onInbound?.(item);
    }
    return res;
  }

  /** Delivery receipt -> stored status -> sync change -> live listeners */
  async applyReceipt(gatewayId: string, item: Extract<GatewayWebhookItem, { type: 'receipt' }>): Promise<void> {
    const row = await this.db.get<{ id: string; mother_id: string; channel: Channel; facility_id: string | null }>(
      'SELECT id, mother_id, channel, facility_id FROM messages WHERE provider = ? AND provider_message_id = ?',
      [gatewayId, item.providerMessageId],
    );
    if (!row) return;
    if (item.cost && (item.cost.local != null || item.cost.usd != null)) {
      const mother = await this.db.get<{ country: string }>('SELECT country FROM mothers WHERE id = ?', [row.mother_id]);
      await this.logCost(row.id, gatewayId, row.channel, mother?.country ?? '', item.cost.units, item.cost.unitLabel, item.cost.local, item.cost.usd, item.cost.currency, 'provider');
    }
    const u: MessageStatusUpdate = {
      messageId: row.id,
      motherId: row.mother_id,
      status: item.status,
      at: item.at,
      provider: gatewayId,
      providerMessageId: item.providerMessageId,
      reason: item.reason,
      costLocal: item.cost?.local,
      costUSD: item.cost?.usd,
      currency: item.cost?.currency,
      simulated: this.gateways.get(gatewayId)?.simulated,
    };
    const changed = await this.store.recordMessageStatus(u);
    if (changed) this.emit(u);
  }

  /** What to say when Africa's Talking connects a voice call */
  private async voiceScript(sessionId: string): Promise<{ text: string; language: string } | undefined> {
    const row = await this.db.get<{ body: string | null }>("SELECT body FROM messages WHERE provider = 'africastalking_voice' AND provider_message_id = ?", [sessionId]);
    return row?.body ? { text: row.body, language: 'en' } : undefined;
  }

  /** Send messages held for quiet hours once the morning comes (called every few minutes) */
  async releaseHeld(): Promise<number> {
    if (this.inQuietHours()) return 0;
    const held = await this.db.all<{ id: string }>("SELECT id FROM messages WHERE status = 'queued' AND reason = 'Held for quiet hours' AND provider_message_id IS NULL");
    let n = 0;
    for (const h of held) {
      const doc = await this.db.get<{ body: string; updated_by: string | null }>("SELECT body, updated_by FROM docs WHERE kind = 'message' AND id = ?", [h.id]);
      if (!doc) continue;
      const m = JSON.parse(doc.body) as OutboundMessage;
      const mother = await this.store.mother(m.motherId);
      if (!mother) continue;
      const country = (mother.country ?? this.cfg.messaging.defaultCountry) as CountryCode;
      const to = this.resolveRecipient(mother, { message: m }, country);
      if (!to) continue;
      await this.db.run('UPDATE messages SET reason = NULL WHERE id = ?', [h.id]);
      const gw = this.routes[m.channel] ?? this.sandbox;
      await this.dispatch(gw, m, mother, to, country, mother.name.split(/\s+/)[0], undefined, undefined, false);
      n++;
    }
    return n;
  }

  close(): void {
    this.sandbox.close();
  }
}
