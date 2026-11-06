/**
 * Replies from mothers, triaged into three lanes: Emergency now, Same day, Next contact.
 * Each reply shows who, when, and the message itself in a quote; tapping opens her messages.
 */
import { AlertTriangle, Clock, MessageChatCircle } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import { useApp } from '../../store';
import type { TriageTier } from '../../store/triage';
import { useNav } from '../nav';
import { fmtTime, relDay, firstName } from '../format';
import type { Reply } from './model';
import { MotherAvatar, SectionHead } from './parts';

const LANES: Array<{ tier: TriageTier; title: string; icon: typeof AlertTriangle; head: string; dot: string; empty: string }> = [
  { tier: 'emergency', title: 'Emergency now', icon: AlertTriangle, head: 'text-error-primary', dot: 'bg-error-solid', empty: 'No danger signs reported.' },
  { tier: 'same_day', title: 'Same day', icon: Clock, head: 'text-warning-primary', dot: 'bg-warning-solid', empty: 'Nothing for today.' },
  { tier: 'next_contact', title: 'Next contact', icon: MessageChatCircle, head: 'text-secondary', dot: 'bg-quaternary', empty: 'Nothing waiting.' },
];

export function Replies({ replies }: { replies: Reply[] }) {
  const { state } = useApp();
  const { go } = useNav();
  if (!replies.length) return null;
  return (
    <section aria-labelledby="replies-h" className="grid gap-4">
      <SectionHead id="replies-h" title="Replies from mothers">
        {replies.length} unread, sorted by what she reported
      </SectionHead>
      <div className="grid gap-3 md:grid-cols-3">
        {LANES.map((lane) => {
          const items = replies.filter((r) => r.tier === lane.tier);
          const Icon = lane.icon;
          return (
            <div key={lane.tier} className={cx('flex min-w-0 flex-col rounded-2xl bg-secondary p-3', !items.length && 'hidden md:flex')} data-lane={lane.tier}>
              <h3 className={cx('flex items-center gap-2 px-1 pb-2 text-sm font-semibold', lane.head)}>
                <Icon className="size-4" aria-hidden="true" />
                {lane.title}
                <span className="ml-auto text-xs font-medium text-tertiary tnum">{items.length}</span>
              </h3>
              {items.length ? (
                <ul className="grid gap-2">
                  {items.map((r) => (
                    <li key={r.message.id}>
                      <button
                        type="button"
                        onClick={() => go({ name: 'patient', id: r.message.motherId, tab: 'messages' })}
                        data-triage={r.tier}
                        className={cx(
                          'w-full cursor-pointer rounded-xl bg-primary p-3 text-left shadow-xs ring-1 ring-secondary ring-inset transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-focus-ring',
                          lane.tier === 'emergency' && 'ring-error_subtle',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <MotherAvatar name={r.row?.mother.name ?? '?'} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-primary">{r.row ? firstName(r.row.mother.name) : 'Mother'}</span>
                            <span className="block text-xs text-tertiary">
                              {relDay(r.message.receivedAt, state.clock).replace(/^./, (c) => c.toUpperCase())}, {fmtTime(r.message.receivedAt)}
                            </span>
                          </span>
                          <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', lane.dot)} />
                        </span>
                        <span className="mt-2 line-clamp-2 block text-sm text-secondary">“{r.message.body}”</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 pb-1 text-sm text-quaternary">{lane.empty}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
