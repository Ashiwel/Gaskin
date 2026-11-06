import type { ClinicalEvent, InboundMessage, OutboundMessage, Override, RuleProposal } from '../types';

/**
 * Every event, override, message and approval records the acting worker. These helpers stamp the
 * id consistently; `missingActors` finds records that lack one (for an audit or a migration).
 * Events from the mother herself use 'mother', and automatic ones 'system'.
 */
export function stampEvent<E extends ClinicalEvent>(e: E, workerId: string): E {
  return e.recordedBy ? e : { ...e, recordedBy: workerId };
}

export function stampOverride(o: Override, workerId: string): Override {
  return o.workerId ? o : { ...o, workerId };
}

export function revertOverride(o: Override, workerId: string, at: string): Override {
  return { ...o, status: 'reverted', revertedBy: workerId, revertedAt: at };
}

export function stampOutbound(m: OutboundMessage, workerId: string, action: 'create' | 'send' | 'review'): OutboundMessage {
  if (action === 'create') return { ...m, createdBy: m.createdBy ?? workerId };
  if (action === 'send') return { ...m, sentBy: workerId };
  return { ...m, reviewedBy: workerId };
}

export function stampInbound(m: InboundMessage, workerId: string): InboundMessage {
  return { ...m, handledBy: workerId };
}

export function stampProposal(p: RuleProposal, workerId: string): RuleProposal {
  return p.createdBy ? p : { ...p, createdBy: workerId };
}

export function missingActors(state: { mothers: Array<{ id: string; events: ClinicalEvent[] }>; overrides: Override[]; outbound: OutboundMessage[]; proposals: RuleProposal[] }): string[] {
  const out: string[] = [];
  for (const m of state.mothers) for (const e of m.events) if (!e.recordedBy) out.push(`event ${e.id}`);
  for (const o of state.overrides) if (!o.workerId) out.push(`override ${o.id}`);
  for (const o of state.outbound) if (o.status !== 'draft' && !o.reviewedBy && !o.createdBy) out.push(`message ${o.id}`);
  for (const p of state.proposals) if ((p.status === 'approved' || p.status === 'rejected') && !p.reviewedBy) out.push(`proposal ${p.id}`);
  return out;
}
