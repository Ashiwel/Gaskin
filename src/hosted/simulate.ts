/**
 * Simulated delivery for the demo backends (artifact and local), with the
 * same steps and the same refusals as the server's sandbox gateway, so the
 * app behaves alike wherever it runs. Nothing is sent anywhere.
 */
import type { Mother, OutboundMessage } from '../types';
import type { MessageStatusUpdate, SendMessageRequest } from './syncTypes';

export const SIM_DELAYS = { sent: 1200, delivered: 3500, read: 8000 };

/** The server refuses these; the demo does too, with the same words */
export function refusalFor(req: SendMessageRequest, mother: Mother | undefined): string | undefined {
  const m = req.message;
  if (!mother) return 'Unknown mother.';
  if (!mother.consent?.messaging) return 'She has not consented to messages. Record her consent first.';
  if (m.channel === 'print') return 'Printed handouts are not sent.';
  if (m.channel === 'email' && !(req.to ?? mother.email)) return 'No email address on her record.';
  if (m.channel !== 'email' && !(req.to ?? mother.phone?.number)) return 'No phone number on her record.';
  if (m.channel === 'whatsapp' && !mother.phone?.hasWhatsApp && req.recipient !== 'carer') return 'Her record says she does not use WhatsApp. Send by SMS.';
  return undefined;
}

/**
 * Walk a message through sent -> delivered (-> read on WhatsApp and voice).
 * Numbers ending 0000 fail as do-not-disturb, 0001 as switched off, as on the server sandbox.
 * Returns a cancel function.
 */
export function simulateDelivery(msg: OutboundMessage, to: string | undefined, onUpdate: (u: MessageStatusUpdate) => void): () => void {
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const tail = (to ?? '').replace(/\D/g, '').slice(-4);
  const step = (ms: number, status: MessageStatusUpdate['status'], reason?: string) =>
    timers.push(
      setTimeout(
        () => onUpdate({ messageId: msg.id, motherId: msg.motherId, status, at: new Date().toISOString(), provider: 'simulated', reason, simulated: true }),
        ms,
      ),
    );
  if (msg.channel !== 'email' && tail === '0000') step(SIM_DELAYS.sent, 'failed', 'The number is on the do-not-disturb list. Send on the transactional (DND) route with a registered sender ID.');
  else if (msg.channel !== 'email' && tail === '0001') step(SIM_DELAYS.delivered, 'failed', 'The phone is switched off or out of coverage.');
  else {
    step(SIM_DELAYS.sent, 'sent');
    if (msg.channel !== 'email') step(SIM_DELAYS.delivered, 'delivered');
    if (msg.channel === 'whatsapp' || msg.channel === 'voice') step(SIM_DELAYS.read, 'read');
  }
  return () => timers.forEach(clearTimeout);
}
