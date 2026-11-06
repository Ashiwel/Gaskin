import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from 'react-aria-components';
import { Bell01, Stars02 } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import type { AIStatusPill, ShellNotification } from './types';

const AI_DOT: Record<AIStatusPill['state'], string> = {
  live: 'bg-fg-success-secondary',
  templates: 'bg-fg-quaternary',
  off: 'bg-fg-quaternary',
  error: 'bg-fg-warning-secondary',
};

/** Which AI is answering now: live, templates only, or off. Opens AI settings when pressed. */
export function AIPill({ status, compact, className }: { status: AIStatusPill; compact?: boolean; className?: string }) {
  return (
    <AriaButton
      onPress={status.onClick}
      aria-label={`AI: ${status.label}${status.detail ? `. ${status.detail}` : ''}`}
      data-testid="ai-pill"
      className={cx(
        'inline-flex h-8 max-w-56 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-secondary ring-1 ring-secondary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <Stars02 aria-hidden="true" className="size-3.5 shrink-0 text-fg-brand-primary" />
      {!compact ? <span className="truncate">{status.label}</span> : null}
      <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', AI_DOT[status.state])} />
    </AriaButton>
  );
}

const TONE_DOT = { error: 'bg-fg-error-secondary', warning: 'bg-fg-warning-secondary', brand: 'bg-fg-brand-secondary', gray: 'bg-fg-quaternary' } as const;

/** Bell with an unread count and a popover list. */
export function NotificationsButton({ items, onSeeAll }: { items: ShellNotification[]; onSeeAll?: () => void }) {
  const unread = items.filter((n) => n.unread).length;
  return (
    <AriaDialogTrigger>
      <AriaButton
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative grid size-10 cursor-pointer place-items-center rounded-lg text-fg-quaternary outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2"
      >
        <Bell01 aria-hidden="true" className="size-5" />
        {unread ? <span className="absolute top-2 right-2 size-2 rounded-full bg-error-solid ring-2 ring-bg-primary" /> : null}
      </AriaButton>
      <AriaPopover placement="bottom end" offset={6} className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl bg-primary shadow-lg ring-1 ring-secondary_alt entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out">
        <AriaDialog aria-label="Notifications" className="outline-hidden">
          <div className="flex items-center justify-between border-b border-secondary px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">Notifications</h2>
            {unread ? <span className="text-xs text-tertiary">{unread} new</span> : null}
          </div>
          {items.length ? (
            <ul className="max-h-96 divide-y divide-border-secondary overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={n.onOpen} className="flex w-full cursor-pointer gap-3 px-4 py-3 text-left hover:bg-primary_hover focus-visible:bg-primary_hover focus-visible:outline-hidden">
                    <span aria-hidden="true" className={cx('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[n.tone ?? 'gray'], !n.unread && 'opacity-40')} />
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-sm', n.unread ? 'font-semibold text-primary' : 'text-secondary')}>{n.title}</span>
                      {n.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-tertiary">{n.body}</span> : null}
                    </span>
                    {n.time ? <span className="shrink-0 text-xs text-quaternary">{n.time}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-tertiary">Nothing new.</p>
          )}
          {onSeeAll ? (
            <div className="border-t border-secondary p-2">
              <button type="button" onClick={onSeeAll} className="w-full cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-brand-secondary hover:bg-primary_hover">
                See all
              </button>
            </div>
          ) : null}
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
}
