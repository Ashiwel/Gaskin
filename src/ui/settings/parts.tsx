/**
 * Settings building blocks: a page header, grouped rows (iOS-style lists on phones, plain groups
 * on desktop), a row with a control on the right, a segmented choice, and a confirm dialog.
 */
import type { ReactNode } from 'react';
import { ChevronRight } from '@untitledui/icons';
import { Toggle } from '../../components/base/toggle/toggle';
import { Dialog, Modal, ModalOverlay } from '../../components/application/modals/modal';
import { cx } from '../../utils/cx';
import type { IconType } from '../onboarding/kit';

export function SectionHeader({ title, lede, icon: Icon, action }: { title: string; lede?: ReactNode; icon?: IconType; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="hidden size-12 shrink-0 place-items-center rounded-xl bg-brand-primary text-fg-brand-primary ring-1 ring-border-brand ring-inset sm:grid">
            <Icon aria-hidden="true" className="size-6" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-primary">{title}</h2>
          {lede ? <p className="mt-1 max-w-2xl text-md text-tertiary">{lede}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

/** A group of rows with an optional heading and footnote. */
export function Group({ title, children, note, testId }: { title?: string; children: ReactNode; note?: ReactNode; testId?: string }) {
  return (
    <section className="min-w-0" data-testid={testId}>
      {title ? <h3 className="mb-2 px-1 text-sm font-semibold text-secondary">{title}</h3> : null}
      <div className="divide-y divide-border-secondary overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary ring-inset">{children}</div>
      {note ? <p className="mt-2 px-1 text-sm text-tertiary">{note}</p> : null}
    </section>
  );
}

export function Row({ label, hint, icon: Icon, children, onPress, tone, testId, stack }: { label: ReactNode; hint?: ReactNode; icon?: IconType; children?: ReactNode; onPress?: () => void; tone?: 'danger'; testId?: string; stack?: boolean }) {
  const inner = (
    <>
      {Icon ? (
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', tone === 'danger' ? 'bg-error-primary text-fg-error-primary' : 'bg-secondary text-fg-secondary')}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-md font-medium', tone === 'danger' ? 'text-error-primary' : 'text-primary')}>{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-tertiary">{hint}</span> : null}
      </span>
      {onPress && !children ? <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" /> : null}
    </>
  );
  if (onPress)
    return (
      <button type="button" onClick={onPress} data-testid={testId} className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2">
        {inner}
        {children}
      </button>
    );
  return (
    <div data-testid={testId} className={cx('flex min-h-14 gap-3 px-4 py-3', stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
      <span className="flex min-w-0 flex-1 items-center gap-3">{inner}</span>
      {children ? <span className={cx('min-w-0', stack ? 'w-full sm:w-auto' : 'shrink-0')}>{children}</span> : null}
    </div>
  );
}

export function SwitchRow({ label, hint, icon, value, onChange, testId, disabled }: { label: string; hint?: ReactNode; icon?: IconType; value: boolean; onChange: (v: boolean) => void; testId?: string; disabled?: boolean }) {
  return (
    <Row label={label} hint={hint} icon={icon} testId={testId}>
      <Toggle aria-label={label} isSelected={value} onChange={onChange} isDisabled={disabled} size="md" />
    </Row>
  );
}

/** A segmented control for 2 to 4 short options. */
export function Segmented<T extends string | number>({ value, options, onChange, label, testId, full, wrap }: { value: T; options: Array<{ id: T; label: string; icon?: IconType }>; onChange: (v: T) => void; label: string; testId?: string; full?: boolean; wrap?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} data-testid={testId} className={cx('max-w-full gap-1 rounded-xl bg-secondary p-1 ring-1 ring-secondary ring-inset', wrap ? cx('grid w-full grid-cols-2', full ? 'sm:flex' : 'sm:inline-flex sm:w-auto') : 'inline-flex', full && !wrap && 'flex w-full')}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            data-value={String(o.id)}
            onClick={() => onChange(o.id)}
            className={cx(
              'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-focus-ring transition duration-100 focus-visible:outline-2',
              // Wrapping controls never cut a label: it breaks onto a second line instead.
              wrap ? 'min-h-10 py-1.5 text-center leading-tight' : 'h-10 whitespace-nowrap',
              full && 'min-w-0 flex-1',
              on ? 'bg-primary text-primary shadow-xs ring-1 ring-secondary' : 'text-tertiary hover:text-secondary',
            )}
          >
            {o.icon ? <o.icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            <span className={full && !wrap ? 'truncate' : undefined}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SelectInline<T extends string | number>({ value, options, onChange, label, testId }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; label: string; testId?: string }) {
  return (
    <select
      aria-label={label}
      data-testid={testId}
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.id) === e.target.value);
        if (o) onChange(o.id);
      }}
      className="h-11 max-w-56 min-w-0 cursor-pointer rounded-lg bg-primary pr-8 pl-3 text-md font-medium text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand"
    >
      {options.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SmallButton({ children, onPress, icon: Icon, tone, testId, disabled }: { children: ReactNode; onPress: () => void; icon?: IconType; tone?: 'danger' | 'primary'; testId?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      data-testid={testId}
      className={cx(
        'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap shadow-xs outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger' ? 'bg-error-solid text-on-fill hover:bg-error-solid_hover' : tone === 'primary' ? 'bg-brand-solid text-on-fill hover:bg-brand-solid_hover' : 'bg-primary text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover',
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Callout({ tone = 'gray', children, icon: Icon, testId }: { tone?: 'gray' | 'warning' | 'error' | 'success' | 'brand'; children: ReactNode; icon?: IconType; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className={cx(
        'flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset',
        tone === 'warning' && 'bg-warning-primary text-warning-primary ring-border-warning_subtle',
        tone === 'error' && 'bg-error-primary text-error-primary ring-error_subtle',
        tone === 'success' && 'bg-success-primary text-success-primary ring-success_subtle',
        tone === 'brand' && 'bg-brand-primary text-brand-secondary ring-brand',
        tone === 'gray' && 'bg-secondary text-secondary ring-secondary',
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, tone = 'danger', confirmDisabled }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; tone?: 'danger' | 'primary'; confirmDisabled?: boolean }) {
  return (
    <ModalOverlay isOpen={open} onOpenChange={(o) => !o && onCancel()} isDismissable>
      <Modal className="max-w-md">
        <Dialog aria-label={title}>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            <div className="mt-2 grid gap-3 text-md text-tertiary">{children}</div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SmallButton onPress={onCancel}>Cancel</SmallButton>
              <SmallButton tone={tone} onPress={onConfirm} disabled={confirmDisabled} testId="confirm-action">
                {confirmLabel}
              </SmallButton>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
