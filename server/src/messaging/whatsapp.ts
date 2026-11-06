/**
 * Meta WhatsApp Cloud API.
 *
 * Templates and price. Outside the 24-hour customer-service window a
 * business may only send an approved template. Meta prices marketing
 * templates at roughly eight times utility templates, so Gaskin registers
 * one UTILITY template, specific to her care ("your next clinic visit",
 * "your care plan was updated"), never promotional, for example:
 *
 *   name: gaskin_care_update   category: UTILITY   language: en
 *   body: "Hello {{1}}, this is your health worker at {{2}}. {{3}}"
 *
 * {{3}} carries the worker-reviewed message (no newlines, at most 1,024
 * characters; Meta rejects tabs, newlines and runs of 4+ spaces in
 * parameters). Meta may re-categorise a template it judges promotional;
 * check the category after approval. Register one template per language.
 * Inside the 24-hour window (she wrote to us) a free-form text is sent instead.
 *
 * Webhook: {PUBLIC_URL}/webhooks/whatsapp. GET answers Meta's verification
 * challenge with WHATSAPP_VERIFY_TOKEN; POST is checked against
 * X-Hub-Signature-256 with WHATSAPP_APP_SECRET. Statuses sent, delivered,
 * read and failed update the message; incoming texts become inbound messages.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Channel } from '../../../src/types';
import type { MessageStatus } from '../../../src/hosted/syncTypes';
import {
  type FetchFn,
  type GatewaySendRequest,
  type GatewaySendResult,
  type GatewayWebhookItem,
  type MessageGateway,
  type WebhookRequest,
  type WebhookResult,
  WebhookAuthError,
  digitsOnly,
} from './gateway';

export interface WhatsAppOptions {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  appSecret?: string;
  verifyToken?: string;
  /** Refuse unsigned callbacks when no app secret is configured (live mode) */
  requireAuth?: boolean;
  template: string;
  templateLanguage: string;
  fetch?: FetchFn;
}

const WINDOW_MS = 24 * 3600 * 1000;

/** Meta's rules for template parameters: no newlines or tabs, no 4+ spaces, max 1,024 characters */
export function templateParam(s: string, max = 1024): string {
  const flat = s.replace(/[\r\n\t]+/g, ' · ').replace(/ {4,}/g, '   ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

const ERROR_COPY: Record<number, string> = {
  131026: 'This number is not on WhatsApp, or cannot receive messages. Send by SMS instead.',
  131047: 'More than 24 hours since she last wrote: a template is needed.',
  131049: 'Meta did not deliver this message to keep engagement healthy. Try SMS.',
  131050: 'She has stopped marketing messages from this business.',
  131051: 'This message type is not supported.',
  132000: 'The template parameters do not match the approved template.',
  132001: 'The template does not exist in this language.',
  132015: 'The template is paused because of low quality.',
  132016: 'The template is disabled.',
  130472: 'The number is part of a Meta experiment and did not receive the message.',
  131056: 'Too many messages to this number in a short time.',
};

export class WhatsAppGateway implements MessageGateway {
  readonly id = 'whatsapp_cloud';
  readonly label = 'WhatsApp Cloud API';
  readonly channels: Channel[] = ['whatsapp'];
  readonly simulated = false;
  private fetch: FetchFn;
  private o: WhatsAppOptions;

  constructor(o: WhatsAppOptions) {
    this.o = o;
    this.fetch = o.fetch ?? fetch;
  }

  async send(req: GatewaySendRequest): Promise<GatewaySendResult> {
    const inWindow = req.lastInboundAt != null && Date.now() - new Date(req.lastInboundAt).getTime() < WINDOW_MS;
    const payload = inWindow
      ? { messaging_product: 'whatsapp', recipient_type: 'individual', to: digitsOnly(req.to), type: 'text', text: { body: req.body.slice(0, 4096), preview_url: false } }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digitsOnly(req.to),
          type: 'template',
          template: {
            name: this.o.template,
            language: { code: req.language === 'en' ? this.o.templateLanguage : req.language },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: templateParam(req.firstName || 'there', 60) },
                  { type: 'text', text: templateParam(req.facilityName || 'the clinic', 100) },
                  { type: 'text', text: templateParam(req.body) },
                ],
              },
            ],
          },
        };
    const res = await this.fetch(`https://graph.facebook.com/${this.o.apiVersion}/${this.o.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { code?: number; message?: string } };
    if (!res.ok || !j.messages?.[0]?.id) {
      const code = j.error?.code ?? 0;
      return { status: 'failed', reason: ERROR_COPY[code] ?? `WhatsApp: ${j.error?.message ?? `HTTP ${res.status}`}` };
    }
    return { status: 'queued', providerMessageId: j.messages[0].id };
  }

  async handleWebhook(req: WebhookRequest): Promise<WebhookResult> {
    if (req.method === 'GET') {
      const given = req.query['hub.verify_token'] ?? '';
      const ok = req.query['hub.mode'] === 'subscribe' && !!this.o.verifyToken && given.length === this.o.verifyToken.length && timingSafeEqual(Buffer.from(given), Buffer.from(this.o.verifyToken));
      return { items: [], response: ok ? { status: 200, contentType: 'text/plain', body: req.query['hub.challenge'] ?? '' } : { status: 403, contentType: 'text/plain', body: 'forbidden' } };
    }
    if (!this.o.appSecret && this.o.requireAuth) throw new WebhookAuthError('WHATSAPP_APP_SECRET is not set, so WhatsApp callbacks are refused in live mode');
    if (this.o.appSecret) {
      const sig = (req.headers['x-hub-signature-256'] ?? '').replace(/^sha256=/, '');
      const want = createHmac('sha256', this.o.appSecret).update(req.rawBody).digest('hex');
      if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) throw new WebhookAuthError('Bad WhatsApp signature');
    }
    type Status = { id: string; status: string; timestamp?: string; errors?: Array<{ code: number; title?: string }>; pricing?: { billable?: boolean; category?: string } };
    type Msg = { from: string; id: string; timestamp?: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } };
    const body = JSON.parse(req.rawBody || '{}') as { entry?: Array<{ changes?: Array<{ value?: { statuses?: Status[]; messages?: Msg[] } }> }> };
    const items: GatewayWebhookItem[] = [];
    for (const e of body.entry ?? [])
      for (const c of e.changes ?? []) {
        for (const s of c.value?.statuses ?? []) {
          const map: Record<string, MessageStatus> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
          const status = map[s.status];
          if (!status) continue;
          const at = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
          const err = s.errors?.[0];
          items.push({
            type: 'receipt',
            providerMessageId: s.id,
            status,
            at,
            reason: err ? (ERROR_COPY[err.code] ?? err.title ?? `WhatsApp error ${err.code}`) : undefined,
            cost: s.pricing?.billable === false ? { local: 0, usd: 0, units: 0, unitLabel: 'free (service window)' } : undefined,
          });
        }
        for (const m of c.value?.messages ?? []) {
          const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title;
          if (!text) continue;
          items.push({ type: 'inbound', channel: 'whatsapp', from: '+' + m.from, text, at: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(), providerMessageId: m.id });
        }
      }
    return { items };
  }
}
