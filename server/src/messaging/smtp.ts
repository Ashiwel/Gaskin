/**
 * Email over SMTP (any provider, or a local relay). Email has no reliable
 * delivery receipts, so a message accepted by the SMTP server is 'sent' and
 * stays there; bounces arrive later as mail to the From address and are
 * outside this adapter. Few rural mothers use email: this is mainly for
 * urban mothers, carers abroad and referral letters to facilities.
 */
import { createRequire } from 'node:module';
import type { Channel } from '../../../src/types';
import type { GatewaySendRequest, GatewaySendResult, MessageGateway } from './gateway';

type Transport = { sendMail(o: { from: string; to: string; subject: string; text: string }): Promise<{ messageId?: string; accepted?: unknown[]; rejected?: unknown[] }> };

export class SmtpGateway implements MessageGateway {
  readonly id = 'smtp_email';
  readonly label = 'Email (SMTP)';
  readonly channels: Channel[] = ['email'];
  readonly simulated = false;
  private transport: Transport;
  private o: { url: string; from: string };

  constructor(o: { url: string; from: string }, transport?: Transport) {
    this.o = o;
    if (transport) this.transport = transport;
    else {
      const require = createRequire(import.meta.url);
      const nodemailer = require('nodemailer') as { createTransport(url: string): Transport };
      this.transport = nodemailer.createTransport(o.url);
    }
  }

  async send(req: GatewaySendRequest): Promise<GatewaySendResult> {
    try {
      const info = await this.transport.sendMail({
        from: this.o.from,
        to: req.to,
        subject: req.subject ?? (req.facilityName ? `Your care plan from ${req.facilityName}` : 'Your care plan'),
        text: req.body,
      });
      if (info.rejected && info.rejected.length) return { status: 'failed', reason: 'The mail server refused this address.' };
      return { status: 'sent', providerMessageId: info.messageId, cost: { local: 0, usd: 0, units: 1, unitLabel: 'email' } };
    } catch (e) {
      return { status: 'failed', reason: `Email could not be sent: ${(e as Error).message.slice(0, 120)}` };
    }
  }
}
