/**
 * Sandbox gateway: the default. Nothing leaves the server. Every send is
 * accepted and then walks through sent -> delivered (and read, on WhatsApp)
 * on timers, so the hosted app shows real receipts end to end.
 *
 * Test numbers make failures repeatable:
 *   ending 0000  -> failed, number on the do-not-disturb list (promotional route)
 *   ending 0001  -> failed, phone switched off / absent subscriber
 *   ending 0002  -> stays 'sent' (no delivery report, as often happens on 2G)
 */
import type { Channel } from '../../../src/types';
import type { GatewaySendRequest, GatewaySendResult, MessageGateway, ReceiptSink } from './gateway';

export class SandboxGateway implements MessageGateway {
  readonly id = 'sandbox';
  readonly label = 'Sandbox (no real messages)';
  readonly channels: Channel[] = ['sms', 'whatsapp', 'voice', 'email'];
  readonly simulated = true;
  private n = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  private sink: ReceiptSink;
  private delays: [number, number];

  constructor(sink: ReceiptSink, delays: [number, number] = [1500, 4000]) {
    this.sink = sink;
    this.delays = delays;
  }

  async send(req: GatewaySendRequest): Promise<GatewaySendResult> {
    const providerMessageId = `sbx-${Date.now().toString(36)}-${++this.n}`;
    const tail = req.to.replace(/\D/g, '').slice(-4);
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        fn();
      }, ms);
      this.timers.add(t);
    };
    const [sentMs, deliveredMs] = this.delays;
    const at = () => new Date().toISOString();
    if (req.channel !== 'email' && tail === '0000') {
      later(sentMs, () =>
        this.sink({ type: 'receipt', providerMessageId, status: 'failed', at: at(), reason: 'The number is on the do-not-disturb list. Send on the transactional (DND) route with a registered sender ID.' }, this.id),
      );
    } else if (req.channel !== 'email' && tail === '0001') {
      later(deliveredMs, () => this.sink({ type: 'receipt', providerMessageId, status: 'failed', at: at(), reason: 'The phone is switched off or out of coverage.' }, this.id));
    } else {
      later(sentMs, () => this.sink({ type: 'receipt', providerMessageId, status: 'sent', at: at() }, this.id));
      if (tail !== '0002') {
        later(deliveredMs, () => this.sink({ type: 'receipt', providerMessageId, status: 'delivered', at: at() }, this.id));
        if (req.channel === 'whatsapp') later(deliveredMs * 2, () => this.sink({ type: 'receipt', providerMessageId, status: 'read', at: at() }, this.id));
      }
    }
    return { status: 'queued', providerMessageId };
  }

  close(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
