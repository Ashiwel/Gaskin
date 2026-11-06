/**
 * Messages on her record: a cost and channel summary first, then every message and reply in order,
 * as a conversation, with delivery state, cost and triage on each.
 */
import { useMemo } from 'react';
import { MessageChatCircle, Phone01 } from '@untitledui/icons';
import type { Mother } from '../types';
import { useApp } from '../store';
import { TRIAGE_LABELS, type TriageTier } from '../store/triage';
import { SYMPTOM_LABELS } from '../clinical';
import { COUNTRIES } from '../data';
import { Button } from '../components/base/buttons/button';
import { Badge, BadgeWithDot } from '../components/base/badges/badges';
import { StackedBar } from '../components/viz';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { CHANNEL_LABELS, fmtDateTime, money, usd } from './format';
import { Card } from './messages/kit';
import { CHANNEL_ICON } from './messages/ComposeParts';
import { Ticks } from './phone/Devices';
import { dirOfText } from './phone/thread';

const TRIAGE_TONE: Record<TriageTier, 'error' | 'warning' | 'gray'> = { emergency: 'error', same_day: 'warning', next_contact: 'gray' };
const STATUS_LABEL: Record<string, string> = { queued: 'Waiting for signal', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Not delivered', draft: 'Draft' };

export function MessagesTab({ mother, onCompose }: { mother: Mother; onCompose: () => void }) {
  const { state } = useApp();
  const { go } = useNav();
  const symbol = COUNTRIES[mother.country]?.currencySymbol ?? '';
  const outs = state.outbound.filter((x) => x.motherId === mother.id);
  const ins = state.inbound.filter((x) => x.motherId === mother.id);
  const noPhone = mother.phone.access === 'none';

  const byChannel = useMemo(() => {
    const m = new Map<string, { n: number; usd: number; local: number }>();
    for (const o of outs) {
      const c = m.get(o.channel) ?? { n: 0, usd: 0, local: 0 };
      c.n += 1;
      c.usd += o.estCostUSD;
      c.local += o.estCostLocal;
      m.set(o.channel, c);
    }
    return [...m.entries()];
  }, [outs]);
  const totalUsd = outs.reduce((s, o) => s + o.estCostUSD, 0);
  const totalLocal = outs.reduce((s, o) => s + o.estCostLocal, 0);

  type Row = { at: string; kind: 'out' | 'in'; id: string };
  const rows: Row[] = [...outs.map((o) => ({ at: o.createdAt, kind: 'out' as const, id: o.id })), ...ins.map((i) => ({ at: i.receivedAt, kind: 'in' as const, id: i.id }))].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <Button color="primary" iconLeading={MessageChatCircle} onClick={onCompose}>
          Write a message
        </Button>
        {!noPhone ? (
          <Button color="secondary" iconLeading={Phone01} onClick={() => go({ name: 'phone', id: mother.id })}>
            See her phone
          </Button>
        ) : null}
      </div>

      {outs.length || ins.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-tertiary">Messages sent</p>
            <p className="mt-1 text-display-xs font-semibold text-primary tnum">{outs.length}</p>
            <p className="text-sm text-tertiary">{ins.length} replies from her</p>
          </Card>
          <Card>
            <p className="text-sm text-tertiary">Cost so far</p>
            <p className="mt-1 text-display-xs font-semibold text-primary tnum">{money(totalLocal, symbol)}</p>
            <p className="text-sm text-tertiary tnum">{usd(totalUsd)}</p>
          </Card>
          <Card>
            <p className="mb-3 text-sm text-tertiary">By channel</p>
            <StackedBar label="Messages by channel" parts={byChannel.map(([ch, c]) => ({ label: CHANNEL_LABELS[ch] ?? ch, value: c.n }))} />
          </Card>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageChatCircle className="size-8 text-fg-quaternary" aria-hidden="true" />
            <p className="font-semibold text-primary">No messages yet</p>
            <p className="text-sm text-tertiary">Messages you send and her replies appear here.</p>
          </div>
        </Card>
      ) : (
        <ol className="grid gap-3" aria-label="Messages, newest first">
          {rows.map((r) => {
            if (r.kind === 'out') {
              const o = outs.find((x) => x.id === r.id)!;
              const meta = state.messageMeta[o.id];
              const Icon = CHANNEL_ICON[o.channel];
              return (
                <li key={o.id} className="flex justify-end">
                  <div className="w-full max-w-[560px] rounded-2xl rounded-br-md bg-brand-primary p-4 ring-1 ring-brand">
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
                      <Icon className="size-3.5" aria-hidden="true" />
                      <span className="font-semibold text-secondary">
                        {CHANNEL_LABELS[o.channel] ?? o.channel} to {meta?.recipient === 'carer' ? (meta.recipientName ?? 'family carer') : 'her'}
                      </span>
                      <span>{fmtDateTime(o.createdAt)}</span>
                      {o.aiAssisted ? <span>· written with AI, reviewed</span> : null}
                    </div>
                    {meta?.subject ? <strong className="block text-sm text-primary">{meta.subject}</strong> : null}
                    <p lang={o.language} dir={dirOfText(o.body)} className="text-sm whitespace-pre-wrap text-primary">
                      {o.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge size="sm" color={o.status === 'failed' ? 'error' : o.status === 'queued' ? 'warning' : o.status === 'read' || o.status === 'delivered' ? 'success' : 'gray'} type="pill-color">
                        <span className="inline-flex items-center gap-1">
                          <Ticks status={o.status} />
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </Badge>
                      {meta?.smsFallback ? (
                        <Badge size="sm" color="error">
                          Danger sign SMS, sent without data
                        </Badge>
                      ) : null}
                      <span className="ml-auto text-xs text-tertiary tnum">
                        {o.segments ? `${o.segments} SMS · ` : ''}
                        {money(o.estCostLocal, symbol)} ({usd(o.estCostUSD)})
                      </span>
                    </div>
                  </div>
                </li>
              );
            }
            const i = ins.find((x) => x.id === r.id)!;
            const tier = state.inboundTriage[i.id];
            return (
              <li key={i.id} className="flex justify-start">
                <div className={cx('w-full max-w-[560px] rounded-2xl rounded-bl-md bg-primary p-4 ring-1', tier === 'emergency' ? 'ring-error_subtle' : 'ring-secondary')}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-tertiary">
                    <span className="font-semibold text-secondary">From her by {CHANNEL_LABELS[i.channel] ?? i.channel}</span>
                    <span>{fmtDateTime(i.receivedAt)}</span>
                  </div>
                  <p lang={mother.language} dir={dirOfText(i.body)} className="text-md text-primary">
                    {i.body}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tier ? (
                      <BadgeWithDot size="sm" color={TRIAGE_TONE[tier]} type="pill-color">
                        {TRIAGE_LABELS[tier]}
                      </BadgeWithDot>
                    ) : null}
                    {(i.parsedSymptoms ?? []).map((s) => (
                      <Badge key={s} size="sm" color="gray">
                        {SYMPTOM_LABELS[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
