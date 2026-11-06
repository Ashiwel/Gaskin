/**
 * Pieces of the compose panel: channel cards with a cost bar each, the SMS segment meter, and the
 * animated delivery track.
 */
import { CheckCircle, Clock, Mail01, MessageChatCircle, MessageTextSquare01, PhoneCall01, Printer } from '@untitledui/icons';
import type { FC } from 'react';
import type { Channel } from '../../types';
import type { DeliveryStep } from '../../store';
import { cx } from '../../utils/cx';
import { CHANNEL_LABELS } from '../format';

export const CHANNEL_ICON: Record<Channel, FC<{ className?: string }>> = {
  sms: MessageTextSquare01,
  whatsapp: MessageChatCircle,
  email: Mail01,
  voice: PhoneCall01,
  print: Printer,
};

export interface ChannelOption {
  channel: Channel;
  costLabel: string;
  usdLabel: string;
  usd: number;
  units: string;
  recommended: boolean;
  note?: string;
}

export function ChannelCards({ options, value, onChange }: { options: ChannelOption[]; value: Channel; onChange: (c: Channel) => void }) {
  const max = Math.max(0.0001, ...options.map((o) => o.usd));
  return (
    <div role="radiogroup" aria-label="Channel" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const Icon = CHANNEL_ICON[o.channel];
        const on = value === o.channel;
        return (
          <button
            key={o.channel}
            type="button"
            role="radio"
            aria-checked={on}
            data-channel={o.channel}
            onClick={() => onChange(o.channel)}
            className={cx(
              'relative flex min-h-[112px] min-w-0 cursor-pointer flex-col gap-2 rounded-xl p-3 text-start transition',
              on ? 'bg-brand-primary ring-2 ring-brand' : 'bg-primary ring-1 ring-secondary hover:bg-primary_hover',
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-solid text-on-fill' : 'bg-secondary text-fg-quaternary')}>
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-primary">{CHANNEL_LABELS[o.channel] ?? o.channel}</strong>
                {o.recommended ? <span className="block text-xs font-medium text-brand-secondary">Recommended</span> : <span className="block text-xs text-tertiary">{o.note ?? ' '}</span>}
              </span>
            </span>
            <span className="mt-auto">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-md font-semibold text-primary tnum">{o.costLabel}</span>
                <span className="text-xs text-tertiary tnum">{o.usdLabel}</span>
              </span>
              <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-tertiary">
                <span className={cx('block h-full rounded-full', on ? 'bg-brand-solid' : 'bg-fg-quaternary')} style={{ width: `${Math.max(4, (o.usd / max) * 100)}%` }} />
              </span>
              <span className="mt-1 block text-xs break-words text-tertiary">{o.units}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One block per SMS part; the part being filled shows how full it is. */
export function SegmentMeter({ chars, segments, unicode }: { chars: number; segments: number; unicode: boolean }) {
  const per = unicode ? (segments > 1 ? 67 : 70) : segments > 1 ? 153 : 160;
  const blocks = Math.max(1, Math.min(6, segments));
  const lastFill = chars === 0 ? 0 : ((chars - 1) % per) + 1;
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="segment-meter">
      <div className="flex gap-1" role="img" aria-label={`${segments} SMS ${segments === 1 ? 'part' : 'parts'}, ${chars} characters`}>
        {Array.from({ length: blocks }).map((_, i) => {
          const full = i < blocks - 1;
          return (
            <span key={i} className="relative h-2 w-10 overflow-hidden rounded-full bg-tertiary">
              <span className={cx('absolute inset-y-0 left-0 rounded-full', segments > 2 ? 'bg-warning-solid' : 'bg-brand-solid')} style={{ width: `${full ? 100 : (lastFill / per) * 100}%` }} />
            </span>
          );
        })}
      </div>
      <span className="text-xs text-tertiary tnum">
        {chars} characters · {segments} {segments === 1 ? 'part' : 'parts'}
        {unicode ? ' · special letters use 70 a part' : ''}
      </span>
    </div>
  );
}

const STEP_LABEL: Record<DeliveryStep, string> = { queued: 'Queued', sent: 'Sent', delivered: 'Delivered', read: 'Read' };

/** Queued, sent, delivered, read: a line that fills as receipts arrive. */
export function DeliveryTrack({ times, sms, failed }: { times: Partial<Record<DeliveryStep, string>>; sms: boolean; failed?: boolean }) {
  const steps: DeliveryStep[] = sms ? ['queued', 'sent', 'delivered'] : ['queued', 'sent', 'delivered', 'read'];
  const done = steps.filter((s) => times[s]).length;
  const pct = steps.length > 1 ? (Math.max(0, done - 1) / (steps.length - 1)) * 100 : 0;
  return (
    <div className="relative" data-testid="delivery-track">
      <div aria-hidden="true" className="absolute top-4 right-4 left-4 h-0.5 rounded-full bg-tertiary">
        <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', failed ? 'bg-error-solid' : 'bg-brand-solid')} style={{ width: `${pct}%` }} />
      </div>
      <ol className="status-steps relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Delivery">
        {steps.map((s, i) => {
          const on = Boolean(times[s]);
          const current = on && i === done - 1;
          return (
            <li key={s} className={cx('flex flex-col items-center gap-1.5 text-center', on && 'on')}>
              <span
                className={cx(
                  'flex size-8 items-center justify-center rounded-full ring-4 ring-[var(--color-bg-primary)] transition-colors duration-500',
                  on ? 'bg-brand-solid text-on-fill' : 'bg-tertiary text-fg-quaternary',
                  current && 'motion-safe:animate-in motion-safe:zoom-in-75',
                )}
              >
                {on ? <CheckCircle className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
              </span>
              <span className={cx('text-xs font-semibold', on ? 'text-primary' : 'text-quaternary')}>{STEP_LABEL[s]}</span>
              <time className="text-xs text-tertiary tnum">{times[s] ? new Date(times[s]!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ' '}</time>
            </li>
          );
        })}
      </ol>
      {sms ? <p className="mt-2 text-center text-xs text-tertiary">SMS has no read receipts.</p> : null}
    </div>
  );
}
