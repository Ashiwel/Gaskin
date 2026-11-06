/**
 * Calm, large building blocks shared by onboarding, accounts and Settings: one question per
 * screen with a progress bar, back and skip; big choice cards with icons; a searchable sheet for
 * long lists; and a quiet "Coming soon" badge. Semantic tokens only, 44 px+ targets.
 */
import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import { ArrowLeft, Check, SearchLg, XClose } from '@untitledui/icons';
import { Dialog, Modal, ModalOverlay } from '../../components/application/modals/modal';
import { cx } from '../../utils/cx';

export type IconType = FC<{ className?: string }>;

// ---------------------------------------------------------------------------
// Step frame
// ---------------------------------------------------------------------------

export interface StepFrameProps {
  /** 0..1 */
  progress?: number;
  stepLabel?: string;
  title: string;
  lede?: ReactNode;
  icon?: IconType;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  backLabel?: string;
  children: ReactNode;
  /** Sticky action row at the bottom */
  footer?: ReactNode;
  wide?: boolean;
  /** For tests and the walk-through */
  testId?: string;
}

/** One question per screen: progress bar, back and skip, a large calm title, then the choices. */
export function StepFrame({ progress, stepLabel, title, lede, icon: Icon, onBack, onSkip, skipLabel = 'Skip', backLabel = 'Back', children, footer, wide, testId }: StepFrameProps) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <section data-testid={testId} aria-labelledby="step-title" className={cx('mx-auto flex w-full flex-col px-4 pb-32 sm:px-6', wide ? 'max-w-3xl' : 'max-w-xl')}>
      <div className="sticky top-0 z-10 -mx-4 bg-primary px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 sm:-mx-6 sm:px-6">
        <div className="flex h-11 items-center justify-between gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="-ml-2 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-md font-semibold text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
              <ArrowLeft aria-hidden="true" className="size-5" />
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          {stepLabel ? <span className="text-sm text-tertiary tnum">{stepLabel}</span> : null}
          {onSkip ? (
            <button type="button" onClick={onSkip} className="-mr-2 inline-flex h-11 cursor-pointer items-center rounded-lg px-2 text-md font-semibold text-tertiary outline-focus-ring hover:bg-primary_hover hover:text-secondary focus-visible:outline-2" data-testid="step-skip">
              {skipLabel}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
        {progress !== undefined ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-tertiary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand-solid transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="mt-6 sm:mt-10">
        {Icon ? (
          <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-brand-primary text-fg-brand-primary ring-1 ring-border-brand ring-inset">
            <Icon aria-hidden="true" className="size-7" />
          </span>
        ) : null}
        <h1 id="step-title" ref={h} tabIndex={-1} className="text-display-xs font-semibold tracking-tight text-balance text-primary outline-hidden sm:text-display-sm">
          {title}
        </h1>
        {lede ? <div className="mt-2 text-lg text-tertiary text-pretty">{lede}</div> : null}
      </div>
      <div className="mt-8">{children}</div>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-secondary bg-primary/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className={cx('mx-auto flex items-center justify-end gap-3 sm:px-2', wide ? 'max-w-3xl' : 'max-w-xl')}>{footer}</div>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Choice cards
// ---------------------------------------------------------------------------

export interface ChoiceProps {
  label: ReactNode;
  hint?: ReactNode;
  icon?: IconType;
  /** An emoji flag or a short glyph instead of an icon */
  glyph?: string;
  selected?: boolean;
  multi?: boolean;
  onPress: () => void;
  badge?: ReactNode;
  disabled?: boolean;
  testId?: string;
  size?: 'lg' | 'md';
  lang?: string;
}

/** A large tappable option with an icon, label and one line of hint. */
export function Choice({ label, hint, icon: Icon, glyph, selected, multi, onPress, badge, disabled, testId, size = 'lg', lang }: ChoiceProps) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={Boolean(selected)}
      disabled={disabled}
      onClick={onPress}
      data-testid={testId}
      lang={lang}
      className={cx(
        'group relative flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-primary text-left outline-focus-ring transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'min-h-20 p-4' : 'min-h-14 px-4 py-3',
        selected ? 'bg-brand-primary ring-2 ring-brand ring-inset' : 'ring-1 ring-secondary ring-inset hover:bg-primary_hover hover:ring-primary',
      )}
    >
      {Icon || glyph ? (
        <span
          aria-hidden="true"
          className={cx(
            'grid shrink-0 place-items-center rounded-xl',
            size === 'lg' ? 'size-12' : 'size-9',
            selected ? 'bg-brand-solid text-on-fill' : 'bg-secondary text-fg-secondary',
            glyph && (/^[A-Za-z]{2,3}$/.test(glyph) ? 'text-sm font-semibold tracking-wide' : 'text-2xl leading-none'),
          )}
        >
          {Icon ? <Icon className={size === 'lg' ? 'size-6' : 'size-5'} /> : glyph}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        {/* The badge wraps under the label when the card is narrow, so a long name is never cut. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cx('font-semibold break-words text-primary', size === 'lg' ? 'text-lg' : 'text-md')}>{label}</span>
          {badge}
        </span>
        {hint ? <span className="mt-0.5 text-sm text-tertiary">{hint}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'grid size-6 shrink-0 place-items-center transition duration-150',
          multi ? 'rounded-md' : 'rounded-full',
          selected ? 'bg-brand-solid text-on-fill' : 'ring-1 ring-primary ring-inset',
        )}
      >
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  );
}

export function ChoiceList({ children, label, multi, columns = 1 }: { children: ReactNode; label: string; multi?: boolean; columns?: 1 | 2 }) {
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={label} className={cx('grid gap-3', columns === 2 && 'sm:grid-cols-2')}>
      {children}
    </div>
  );
}

export function ComingSoon() {
  return <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">Coming soon</span>;
}

export function DraftBadge() {
  return <span className="shrink-0 rounded-full bg-warning-primary px-2 py-0.5 text-xs font-medium text-warning-primary ring-1 ring-border-warning_subtle ring-inset">Draft</span>;
}

export function ReviewedBadge() {
  return <span className="shrink-0 rounded-full bg-success-primary px-2 py-0.5 text-xs font-medium text-success-primary ring-1 ring-border-success_subtle ring-inset">Checked</span>;
}

/** A primary call to action, full-width on phones. */
export function PrimaryButton({ children, onPress, disabled, testId, type = 'button', loading }: { children: ReactNode; onPress?: () => void; disabled?: boolean; testId?: string; type?: 'button' | 'submit'; loading?: boolean }) {
  return (
    <button
      type={type}
      onClick={onPress}
      disabled={disabled || loading}
      data-testid={testId}
      className="inline-flex h-12 min-w-40 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-solid px-6 text-md font-semibold text-on-fill shadow-xs outline-focus-ring transition duration-100 hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
    >
      {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onPress, disabled, testId, icon: Icon }: { children: ReactNode; onPress?: () => void; disabled?: boolean; testId?: string; icon?: IconType }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      data-testid={testId}
      className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-md font-semibold text-secondary shadow-xs ring-1 ring-primary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {Icon ? <Icon aria-hidden="true" className="size-5" /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Searchable sheet
// ---------------------------------------------------------------------------

export interface PickItem {
  id: string;
  label: string;
  /** Second line (native name, size) */
  detail?: string;
  /** Extra words to match when searching */
  keywords?: string;
  glyph?: string;
  badge?: ReactNode;
  group?: string;
  lang?: string;
  disabled?: boolean;
}

export interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: PickItem[];
  selected?: string[];
  multi?: boolean;
  onPick: (id: string) => void;
  placeholder?: string;
  /** Offer "Use <typed text>" when nothing matches */
  allowFree?: (text: string) => void;
  testId?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** A bottom sheet on phones, a centred dialog on desktop, with a search box and a long list. */
export function SearchSheet({ open, onClose, title, items, selected = [], multi, onPick, placeholder = 'Search', allowFree, testId }: SearchSheetProps) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const shown = useMemo(() => {
    const n = fold(q.trim());
    if (!n) return items;
    return items.filter((i) => fold(`${i.label} ${i.detail ?? ''} ${i.keywords ?? ''} ${i.id}`).includes(n));
  }, [q, items]);
  const groups = useMemo(() => {
    const out: Array<{ name?: string; items: PickItem[] }> = [];
    for (const i of shown) {
      const last = out[out.length - 1];
      if (last && last.name === i.group) last.items.push(i);
      else out.push({ name: i.group, items: [i] });
    }
    return out;
  }, [shown]);
  return (
    <ModalOverlay isOpen={open} onOpenChange={(o) => !o && onClose()} isDismissable>
      <Modal className="flex max-h-[min(720px,calc(100dvh-32px))] max-w-lg flex-col overflow-hidden">
        <Dialog aria-label={title} className="flex max-h-[inherit] flex-col overflow-hidden" data-testid={testId}>
          <div className="flex items-center justify-between gap-3 border-b border-secondary px-5 pt-5 pb-4">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 cursor-pointer place-items-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
              <XClose aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="px-5 pt-4">
            <label className="relative block">
              <span className="sr-only">{placeholder}</span>
              <SearchLg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-quaternary" />
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                data-testid="sheet-search"
                className="h-12 w-full rounded-xl bg-primary pr-4 pl-11 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
              />
            </label>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4" role={multi ? 'group' : 'listbox'} aria-label={title}>
            {groups.map((g, gi) => (
              <div key={`${g.name ?? ''}-${gi}`} className="py-1">
                {g.name ? <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">{g.name}</p> : null}
                <ul>
                  {g.items.map((i) => {
                    const on = selected.includes(i.id);
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          role={multi ? 'checkbox' : 'option'}
                          aria-checked={multi ? on : undefined}
                          aria-selected={multi ? undefined : on}
                          disabled={i.disabled}
                          onClick={() => onPick(i.id)}
                          data-pick={i.id}
                          className={cx(
                            'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60',
                            on ? 'bg-brand-primary' : 'hover:bg-primary_hover',
                          )}
                        >
                          {i.glyph ? (
                            <span aria-hidden="true" className="w-7 shrink-0 text-center text-xl leading-none">
                              {i.glyph}
                            </span>
                          ) : null}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-md font-medium text-primary" lang={i.lang}>
                              {i.label}
                            </span>
                            {i.detail ? <span className="truncate text-sm text-tertiary">{i.detail}</span> : null}
                          </span>
                          {i.badge}
                          {on ? <Check aria-hidden="true" className="size-5 shrink-0 text-fg-brand-primary" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!shown.length ? (
              <div className="px-3 py-8 text-center">
                <p className="text-md text-tertiary">Nothing matches “{q}”.</p>
                {allowFree && q.trim() ? (
                  <button type="button" onClick={() => allowFree(q.trim())} className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-lg px-4 text-md font-semibold text-brand-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover">
                    Use “{q.trim()}”
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {multi ? (
            <div className="border-t border-secondary px-5 py-3">
              <PrimaryButton onPress={onClose}>Done</PrimaryButton>
            </div>
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** A select-looking button that opens a SearchSheet. */
export function PickerField({ label, value, placeholder, onOpen, glyph, testId, disabled }: { label: string; value?: string; placeholder: string; onOpen: () => void; glyph?: string; testId?: string; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-secondary">{label}</p>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        data-testid={testId}
        aria-label={`${label}: ${value ?? placeholder}`}
        className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl bg-primary px-4 text-left shadow-xs ring-1 ring-primary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {glyph ? (
          <span aria-hidden="true" className="text-2xl leading-none">
            {glyph}
          </span>
        ) : null}
        <span className={cx('min-w-0 flex-1 truncate text-lg', value ? 'font-medium text-primary' : 'text-placeholder')}>{value || placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-fg-quaternary">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, type = 'text', autoFocus, testId, inputMode, autoComplete, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; type?: string; autoFocus?: boolean; testId?: string; inputMode?: 'numeric' | 'text' | 'tel'; autoComplete?: string; maxLength?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="h-14 w-full rounded-xl bg-primary px-4 text-lg text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
      />
      {hint ? <span className="mt-1.5 block text-sm text-tertiary">{hint}</span> : null}
    </label>
  );
}
