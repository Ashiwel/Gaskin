/**
 * Africa's Talking: SMS (Nigeria, Kenya, Ghana) and outbound voice calls.
 *
 * SMS: POST /version1/messaging (form-encoded, `apiKey` header). The reply
 * carries a per-recipient status code and cost ("NGN 2.2000"). Delivery
 * reports arrive on the SMS delivery-report callback URL set in the AT
 * dashboard: point it at  {PUBLIC_URL}/webhooks/africastalking/sms
 * Inbound SMS (short code or two-way number):  {PUBLIC_URL}/webhooks/africastalking/inbound
 *
 * Do-not-disturb. In Nigeria, numbers on the NCC DND register only receive
 * messages from a registered alphanumeric sender ID on the transactional
 * route. Register "Gaskin" (or the programme's name) as a transactional
 * sender ID with AT and the networks before going live, and send care
 * messages only to mothers who gave messaging consent. AT reports DND
 * rejections as status 409 / failureReason DoNotDisturbRejection.
 *
 * Voice: POST https://voice.africastalking.com/call starts a call from
 * AT_VOICE_NUMBER. When she answers, AT asks the voice callback URL
 * ({PUBLIC_URL}/webhooks/africastalking/voice) what to do; we reply with
 * <Say> for English or <Play> of a pre-recorded clip for Hausa, Yoruba and
 * other languages that text-to-speech does not cover. The end-of-call
 * callback carries duration and cost.
 */
import { timingSafeEqual } from 'node:crypto';
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
  formParse,
  parseMoney,
} from './gateway';

export interface AfricasTalkingOptions {
  username: string;
  apiKey: string;
  senderId?: string;
  voiceNumber?: string;
  sandbox: boolean;
  fetch?: FetchFn;
  /**
   * Africa's Talking does not sign its callbacks. Set AT_WEBHOOK_TOKEN and add ?token=<it> to every
   * callback URL in the AT dashboard; requests without it are refused. In live mode it is required.
   */
  webhookToken?: string;
  /** Refuse unauthenticated callbacks even when no token is configured (live mode) */
  requireAuth?: boolean;
  /** Look up what to say when AT asks the voice callback (by call session id) */
  voiceScript?: (sessionId: string) => Promise<{ text: string; language: string; audioUrl?: string } | undefined>;
}

const SMS_CODES: Record<number, { status: GatewaySendResult['status']; reason?: string }> = {
  100: { status: 'queued' },
  101: { status: 'sent' },
  102: { status: 'queued' },
  401: { status: 'failed', reason: 'Held for risk review by Africa\'s Talking.' },
  402: { status: 'failed', reason: 'The sender ID is not registered or not approved for this network.' },
  403: { status: 'failed', reason: 'The phone number is not valid.' },
  404: { status: 'failed', reason: 'This kind of number cannot receive SMS.' },
  405: { status: 'failed', reason: 'The SMS account is out of credit.' },
  406: { status: 'failed', reason: 'The mother has opted out (blacklisted this sender).' },
  407: { status: 'failed', reason: 'The network could not be reached.' },
  409: { status: 'failed', reason: 'The number is on the do-not-disturb list. Use a registered transactional sender ID.' },
  500: { status: 'failed', reason: 'Africa\'s Talking had an internal error.' },
  501: { status: 'failed', reason: 'The SMS gateway had an error.' },
  502: { status: 'failed', reason: 'The network rejected the message.' },
};

const DLR_STATUS: Record<string, MessageStatus> = {
  Sent: 'sent',
  Submitted: 'sent',
  Buffered: 'sent',
  Success: 'delivered',
  Rejected: 'failed',
  Failed: 'failed',
  AbsentSubscriber: 'failed',
  Expired: 'failed',
};

const FAILURE_COPY: Record<string, string> = {
  InsufficientCredit: 'The SMS account is out of credit.',
  UserInBlackList: 'The mother has opted out of messages from this sender.',
  DoNotDisturbRejection: 'The number is on the do-not-disturb list. Use a registered transactional sender ID.',
  UserIsInactive: 'The SIM is inactive.',
  UserDoesNotExist: 'The number does not exist.',
  AbsentSubscriber: 'The phone is switched off or out of coverage.',
  DeliveryFailure: 'The network could not deliver the message.',
  NotNetworkSubcriber: 'The number is not on a supported network.',
};

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export class AfricasTalkingGateway implements MessageGateway {
  readonly id: string;
  readonly label: string;
  readonly channels: Channel[];
  readonly simulated = false;
  private fetch: FetchFn;
  private o: AfricasTalkingOptions;
  private kind: 'sms' | 'voice';

  constructor(o: AfricasTalkingOptions, kind: 'sms' | 'voice') {
    this.o = o;
    this.kind = kind;
    this.id = `africastalking_${kind}`;
    this.label = kind === 'sms' ? "Africa's Talking SMS" : "Africa's Talking voice";
    this.channels = [kind];
    this.fetch = o.fetch ?? fetch;
  }

  private get base(): string {
    return this.o.sandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  }

  private get voiceBase(): string {
    return this.o.sandbox ? 'https://voice.sandbox.africastalking.com' : 'https://voice.africastalking.com';
  }

  async send(req: GatewaySendRequest): Promise<GatewaySendResult> {
    return this.kind === 'sms' ? this.sendSms(req) : this.call(req);
  }

  private async sendSms(req: GatewaySendRequest): Promise<GatewaySendResult> {
    const form = new URLSearchParams({ username: this.o.username, to: req.to, message: req.body, enqueue: '1' });
    if (this.o.senderId) form.set('from', this.o.senderId);
    const res = await this.fetch(`${this.base}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: this.o.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) return { status: 'failed', reason: `Africa's Talking returned HTTP ${res.status}.` };
    const j = (await res.json()) as { SMSMessageData?: { Recipients?: Array<{ statusCode: number; status: string; cost?: string; messageId?: string }> } };
    const r = j.SMSMessageData?.Recipients?.[0];
    if (!r) return { status: 'failed', reason: "Africa's Talking accepted no recipients. Check the number format (+234...)." };
    const code = SMS_CODES[r.statusCode] ?? { status: 'failed' as const, reason: r.status };
    const money = parseMoney(r.cost);
    return {
      status: code.status,
      reason: code.reason,
      providerMessageId: r.messageId && r.messageId !== 'None' ? r.messageId : undefined,
      cost: money.amount != null ? { local: money.amount, currency: money.currency, units: 1, unitLabel: 'SMS' } : undefined,
    };
  }

  private async call(req: GatewaySendRequest): Promise<GatewaySendResult> {
    if (!this.o.voiceNumber) return { status: 'failed', reason: 'No Africa\'s Talking voice number is configured (AT_VOICE_NUMBER).' };
    const form = new URLSearchParams({ username: this.o.username, from: this.o.voiceNumber, to: req.to, clientRequestId: req.messageId });
    const res = await this.fetch(`${this.voiceBase}/call`, {
      method: 'POST',
      headers: { apiKey: this.o.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) return { status: 'failed', reason: `Africa's Talking voice returned HTTP ${res.status}.` };
    const j = (await res.json()) as { entries?: Array<{ status: string; sessionId?: string; phoneNumber?: string }>; errorMessage?: string };
    const e = j.entries?.[0];
    if (!e || e.status !== 'Queued') return { status: 'failed', reason: e?.status ?? j.errorMessage ?? 'The call was not queued.' };
    return { status: 'queued', providerMessageId: e.sessionId };
  }

  async handleWebhook(req: WebhookRequest): Promise<WebhookResult> {
    const want = this.o.webhookToken;
    if (want) {
      const got = req.query.token ?? '';
      if (got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) throw new WebhookAuthError("Bad Africa's Talking callback token");
    } else if (this.o.requireAuth) throw new WebhookAuthError("AT_WEBHOOK_TOKEN is not set, so Africa's Talking callbacks are refused in live mode");
    const f = req.contentType.includes('json') ? (JSON.parse(req.rawBody || '{}') as Record<string, string>) : formParse(req.rawBody);
    const at = new Date().toISOString();
    if (this.kind === 'voice') {
      // Call in progress: tell AT what to say
      if (f.isActive === '1') {
        const script = this.o.voiceScript ? await this.o.voiceScript(f.sessionId) : undefined;
        const inner = !script
          ? '<Say>Hello. This is your health worker calling from Gaskin. Please call the clinic back.</Say>'
          : script.audioUrl
            ? `<Play url="${xmlEscape(script.audioUrl)}"/>`
            : `<Say>${xmlEscape(script.text)}</Say>`;
        return {
          items: [{ type: 'receipt', providerMessageId: f.sessionId, status: 'delivered', at }],
          response: { status: 200, contentType: 'application/xml', body: `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>` },
        };
      }
      // Call ended
      const ok = f.status === 'Success' || Number(f.durationInSeconds ?? 0) > 0;
      return {
        items: [
          {
            type: 'receipt',
            providerMessageId: f.sessionId,
            status: ok ? 'read' : 'failed',
            at,
            reason: ok ? undefined : `The call was not answered (${f.hangupCause ?? f.status ?? 'no answer'}).`,
            cost: f.amount ? { local: Number(f.amount), currency: f.currencyCode, units: Math.max(1, Math.ceil(Number(f.durationInSeconds ?? 0) / 60)), unitLabel: 'minute' } : undefined,
          },
        ],
      };
    }
    // Inbound SMS has `text` and `from`; delivery reports have `status`
    if (f.text != null && f.from) {
      return { items: [{ type: 'inbound', channel: 'sms', from: f.from, text: f.text, at: f.date ? new Date(f.date).toISOString() : at, providerMessageId: f.id }] };
    }
    if (f.id && f.status) {
      const status = DLR_STATUS[f.status] ?? 'sent';
      const item: GatewayWebhookItem = {
        type: 'receipt',
        providerMessageId: f.id,
        status,
        at,
        reason: status === 'failed' ? (FAILURE_COPY[f.failureReason ?? f.status] ?? f.failureReason ?? f.status) : undefined,
      };
      return { items: [item] };
    }
    return { items: [] };
  }
}
