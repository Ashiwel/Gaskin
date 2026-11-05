/**
 * One interface for every way Gaskin reaches a mother: SMS, voice, WhatsApp
 * and email. Each provider adapter turns a send into the provider's HTTP
 * call, and turns the provider's delivery-report webhook back into status
 * updates. The messaging service routes, logs cost and stores receipts.
 */
import type { Channel, CountryCode, LanguageCode } from '../../../src/types';
import type { MessageStatus } from '../../../src/hosted/syncTypes';

export type FetchFn = typeof fetch;

export interface GatewaySendRequest {
  messageId: string;
  channel: Channel;
  /** E.164 number (+234...) or email address */
  to: string;
  body: string;
  subject?: string;
  language: LanguageCode;
  country: CountryCode;
  /** Danger-sign alerts: skip quiet hours, use the fastest route */
  urgent: boolean;
  /** For WhatsApp template parameters and email greetings (first name only) */
  firstName?: string;
  facilityName?: string;
  /** Last time she messaged us on this channel: WhatsApp free-form replies are allowed within 24 hours */
  lastInboundAt?: string;
}

export interface GatewayCost {
  local?: number;
  usd?: number;
  currency?: string;
  units?: number;
  unitLabel?: string;
}

export interface GatewaySendResult {
  status: Extract<MessageStatus, 'queued' | 'sent' | 'delivered' | 'failed'>;
  providerMessageId?: string;
  /** Plain-English reason when failed */
  reason?: string;
  cost?: GatewayCost;
}

/** A delivery report or inbound message parsed from a provider webhook */
export type GatewayWebhookItem =
  | {
      type: 'receipt';
      providerMessageId: string;
      status: MessageStatus;
      at: string;
      reason?: string;
      cost?: GatewayCost;
    }
  | {
      type: 'inbound';
      channel: Channel;
      from: string;
      text: string;
      at: string;
      providerMessageId?: string;
    };

export interface WebhookRequest {
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  rawBody: string;
  contentType: string;
}

export interface WebhookResult {
  items: GatewayWebhookItem[];
  /** Respond with this body instead of 'ok' (WhatsApp verification challenge, voice XML) */
  response?: { status: number; body: string; contentType: string };
}

export interface MessageGateway {
  /** e.g. 'africastalking_sms' */
  readonly id: string;
  readonly label: string;
  readonly channels: Channel[];
  /** True when nothing real leaves the server */
  readonly simulated: boolean;
  send(req: GatewaySendRequest): Promise<GatewaySendResult>;
  /** Parse a webhook. Throw a WebhookAuthError when the signature is wrong. */
  handleWebhook?(req: WebhookRequest): Promise<WebhookResult>;
}

export class WebhookAuthError extends Error {}

/** Delivery report from the sandbox gateway, pushed back through the service */
export type ReceiptSink = (item: Extract<GatewayWebhookItem, { type: 'receipt' }>, gatewayId: string) => void;

export function formParse(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

/** "NGN 2.2000" -> { currency: 'NGN', local: 2.2 } */
export function parseMoney(s: string | undefined): { currency?: string; amount?: number } {
  if (!s) return {};
  const m = /^\s*([A-Z]{3})\s*([\d.]+)/.exec(s);
  if (!m) return {};
  return { currency: m[1], amount: Number(m[2]) };
}

export function digitsOnly(e164: string): string {
  return e164.replace(/\D/g, '');
}
