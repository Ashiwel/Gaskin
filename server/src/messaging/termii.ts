/**
 * Termii SMS (Nigeria). POST {base}/api/sms/send with JSON.
 *
 * Route. `channel: "dnd"` is Termii's transactional route: it reaches
 * numbers on the NCC do-not-disturb register, needs an approved sender ID,
 * and costs more than `generic`. Care-plan reminders and danger-sign alerts
 * are transactional and consented, so the default is `dnd`. `generic` is
 * cheaper but silently fails for DND numbers and is barred from sending
 * between 8pm and 8am.
 *
 * Delivery reports: set the webhook URL in the Termii dashboard to
 * {PUBLIC_URL}/webhooks/termii. When TERMII_WEBHOOK_SECRET is set, the
 * X-Termii-Signature header (HMAC-SHA512 of the body) is checked.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Channel } from '../../../src/types';
import type { MessageStatus } from '../../../src/hosted/syncTypes';
import {
  type FetchFn,
  type GatewaySendRequest,
  type GatewaySendResult,
  type MessageGateway,
  type WebhookRequest,
  type WebhookResult,
  WebhookAuthError,
  digitsOnly,
} from './gateway';

export interface TermiiOptions {
  apiKey: string;
  senderId: string;
  baseUrl: string;
  route: 'dnd' | 'generic';
  webhookSecret?: string;
  /** Refuse unsigned callbacks when no secret is configured (live mode) */
  requireAuth?: boolean;
  fetch?: FetchFn;
}

function mapStatus(s: string): { status: MessageStatus; reason?: string } {
  const t = s.toLowerCase();
  if (t.includes('dnd')) return { status: 'failed', reason: 'The number is on the do-not-disturb list. Send on the DND (transactional) route.' };
  if (t.startsWith('delivered')) return { status: 'delivered' };
  if (t.includes('sent') || t.includes('received') || t.includes('accepted') || t.includes('pending')) return { status: 'sent' };
  if (t.includes('expired')) return { status: 'failed', reason: 'The message expired before the phone came back into coverage.' };
  if (t.includes('reject')) return { status: 'failed', reason: 'The network rejected the message (check the sender ID).' };
  return { status: 'failed', reason: `Termii reported: ${s}` };
}

export class TermiiGateway implements MessageGateway {
  readonly id = 'termii_sms';
  readonly label = 'Termii SMS';
  readonly channels: Channel[] = ['sms'];
  readonly simulated = false;
  private fetch: FetchFn;
  private o: TermiiOptions;

  constructor(o: TermiiOptions) {
    this.o = o;
    this.fetch = o.fetch ?? fetch;
  }

  async send(req: GatewaySendRequest): Promise<GatewaySendResult> {
    const res = await this.fetch(`${this.o.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        api_key: this.o.apiKey,
        to: digitsOnly(req.to),
        from: this.o.senderId,
        sms: req.body,
        type: 'plain',
        channel: this.o.route,
      }),
    });
    let j: { message_id?: string; message?: string; code?: string } = {};
    try {
      j = (await res.json()) as typeof j;
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok || !j.message_id) return { status: 'failed', reason: j.message ? `Termii: ${j.message}` : `Termii returned HTTP ${res.status}.` };
    return { status: 'queued', providerMessageId: String(j.message_id) };
  }

  async handleWebhook(req: WebhookRequest): Promise<WebhookResult> {
    if (!this.o.webhookSecret && this.o.requireAuth) throw new WebhookAuthError('TERMII_WEBHOOK_SECRET is not set, so Termii callbacks are refused in live mode');
    if (this.o.webhookSecret) {
      const sig = req.headers['x-termii-signature'] ?? '';
      const want = createHmac('sha512', this.o.webhookSecret).update(req.rawBody).digest('hex');
      if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) throw new WebhookAuthError('Bad Termii signature');
    }
    const j = JSON.parse(req.rawBody || '{}') as { type?: string; message_id?: string; id?: string; status?: string; cost?: string | number; sender?: string; message?: string; sent_at?: string };
    const at = new Date().toISOString();
    if (j.type === 'inbound' && j.sender && j.message) return { items: [{ type: 'inbound', channel: 'sms', from: j.sender, text: j.message, at }] };
    const id = j.message_id ?? j.id;
    if (!id || !j.status) return { items: [] };
    const m = mapStatus(j.status);
    const cost = j.cost != null && j.cost !== '' ? Number(j.cost) : undefined;
    return {
      items: [{ type: 'receipt', providerMessageId: String(id), status: m.status, reason: m.reason, at, cost: cost != null && Number.isFinite(cost) ? { local: cost, currency: 'NGN', units: 1, unitLabel: 'SMS' } : undefined }],
    };
  }
}
