/**
 * Small shared pieces for the patient record, plan, record sheet and visit screens: a calm card,
 * section headings, chips, a segmented control, a number stepper, icon toggles, a disclosure,
 * a side sheet (bottom sheet on phones) and the category and event icons. All colour comes from
 * semantic tokens, so dark mode is right without a `dark:` variant.
 */
import { useEffect, useId, useRef, useState, type FC, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Announcement02,
  Beaker02,
  Calendar,
  CalendarCheck01,
  ChevronDown,
  Droplets01,
  FaceSmile,
  HeartHand,
  Home03,
  Lightbulb02,
  MedicalCross,
  Minus,
  Moon01,
  Plus,
  ShieldTick,
  Stars02,
  Users01,
  Wallet02,
  XClose,
} from '@untitledui/icons';
import type { PlanCategory } from '../../types';
import { cx } from '../../utils/cx';

export type IconType = FC<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

// ---------- Category icons ----------

export const CATEGORY_ICON: Record<PlanCategory, IconType> = {
  danger_signs: AlertTriangle,
  visits: CalendarCheck01,
  tests: Beaker02,
  medication: MedicalCross,
  nutrition: Wallet02,
  rest_and_sleep: Moon01,
  activity: Activity,
  breastfeeding: Droplets01,
  baby_care: HeartHand,
  immunisation: ShieldTick,
  mental_health: FaceSmile,
  family_support: Users01,
  birth_preparedness: Home03,
  family_planning: Calendar,
  traditional_practice: Stars02,
  education: Lightbulb02,
};

export const CATEGORY_TONE: Partial<Record<PlanCategory, 'error' | 'brand' | 'warning' | 'success' | 'gray'>> = {
  danger_signs: 'error',
  medication: 'brand',
  tests: 'brand',
  immunisation: 'success',
  mental_health: 'warning',
};

export { Announcement02 };

// ---------- Layout ----------

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <As className={cx('min-w-0 rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset sm:p-5', className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ id, title, lede, action, className }: { id?: string; title: ReactNode; lede?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold text-primary">
          {title}
        </h2>
        {lede ? <p className="mt-0.5 text-sm text-tertiary">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ---------- Chips ----------

export type ChipTone = 'gray' | 'brand' | 'error' | 'warning' | 'success';

const CHIP: Record<ChipTone, string> = {
  gray: 'bg-secondary text-secondary ring-secondary',
  brand: 'bg-brand-primary text-brand-secondary ring-utility-brand-200',
  error: 'bg-error-primary text-error-primary ring-error_subtle',
  warning: 'bg-warning-primary text-warning-primary ring-warning_subtle',
  success: 'bg-success-primary text-success-primary ring-success_subtle',
};

export function Chip({ tone = 'gray', icon: Icon, children, className, title, dot }: { tone?: ChipTone; icon?: IconType; children: ReactNode; className?: string; title?: string; dot?: boolean }) {
  return (
    <span title={title} className={cx('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', CHIP[tone], className)}>
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {/* Short chips stay on one line; a long one (a timing such as "Each scheduled contact from 13 weeks") wraps. */}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export function IconTile({ icon: Icon, tone = 'gray', size = 'md', className }: { icon: IconType; tone?: ChipTone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = size === 'sm' ? 'size-8 rounded-lg [&>svg]:size-4' : size === 'lg' ? 'size-12 rounded-xl [&>svg]:size-6' : 'size-10 rounded-lg [&>svg]:size-5';
  return (
    <span aria-hidden="true" className={cx('inline-grid shrink-0 place-items-center ring-1 ring-inset', sz, CHIP[tone], className)}>
      <Icon />
    </span>
  );
}

// ---------- Segmented control ----------

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconType;
  tone?: 'ok' | 'bad' | 'neutral';
  disabled?: boolean;
}

/** One choice from a few, as a row of joined pills. Tapping the chosen one again clears it when `clearable`. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  clearable,
  wrap,
  className,
}: {
  options: SegOption<T>[];
  value?: T | null;
  onChange: (v: T | null) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  clearable?: boolean;
  wrap?: boolean;
  className?: string;
}) {
  const h = size === 'sm' ? 'min-h-9 px-3 text-sm' : size === 'lg' ? 'min-h-14 px-4 text-md' : 'min-h-11 px-3.5 text-sm';
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex gap-1 rounded-xl bg-secondary p-1 ring-1 ring-secondary ring-inset', wrap ? 'flex-wrap' : 'overflow-x-auto', className)}>
      {options.map((o) => {
        const on = value === o.value;
        const toneOn = o.tone === 'bad' ? 'bg-error-solid text-on-fill' : o.tone === 'ok' ? 'bg-success-solid text-on-fill' : 'bg-primary text-primary shadow-xs ring-1 ring-secondary';
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(on && clearable ? null : o.value)}
            className={cx(
              'inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap outline-focus-ring transition duration-100 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50',
              h,
              on ? toneOn : 'text-tertiary hover:text-secondary',
            )}
          >
            {o.icon ? <o.icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Stepper ----------

/** A number with − and + buttons and a typed value; empty means not recorded. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  start,
  decimals = 0,
  id,
  status,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** First value when − or + is pressed on an empty field */
  start?: number;
  decimals?: number;
  id?: string;
  status?: { tone: ChipTone; word: string };
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    const parsed = parseFloat(text);
    if (value === undefined && text !== '' && !Number.isFinite(parsed)) return;
    if (value === undefined && text !== '') setText('');
    else if (value !== undefined && parsed !== value) setText(value.toFixed(decimals).replace(/\.0+$/, ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, +v.toFixed(decimals)));
  const bump = (d: number) => onChange(clamp((value ?? start ?? min) + (value === undefined ? 0 : d)));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={fid} className="flex items-center justify-between gap-2 text-sm font-medium text-secondary">
        <span className="truncate">{label}</span>
        {status ? <Chip tone={status.tone}>{status.word}</Chip> : null}
      </label>
      <div className="flex items-stretch rounded-xl bg-primary ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => bump(-step)} className="grid w-11 shrink-0 cursor-pointer place-items-center rounded-l-xl text-fg-quaternary hover:bg-primary_hover hover:text-fg-secondary">
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <input
          id={fid}
          inputMode={decimals ? 'decimal' : 'numeric'}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-center text-lg font-semibold text-primary tnum outline-none placeholder:font-normal placeholder:text-placeholder"
          value={text}
          placeholder="–"
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) && v >= min && v <= max ? v : undefined);
          }}
        />
        {unit ? <span className="self-center pr-1 text-xs text-tertiary">{unit}</span> : null}
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => bump(step)} className="grid w-11 shrink-0 cursor-pointer place-items-center rounded-r-xl text-fg-quaternary hover:bg-primary_hover hover:text-fg-secondary">
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ---------- Icon toggle ----------

/** A square tile that toggles: icon, label, and a red edge for danger signs. */
export function IconToggle({ on, onChange, icon: Icon, label, danger, className }: { on: boolean; onChange: (v: boolean) => void; icon: IconType; label: string; danger?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        'flex min-h-16 cursor-pointer items-center gap-2.5 rounded-xl p-3 text-left text-sm font-medium outline-focus-ring ring-1 ring-inset transition duration-100 focus-visible:outline-2',
        on ? (danger ? 'bg-error-primary text-error-primary ring-2 ring-border-error' : 'bg-brand-primary text-brand-secondary ring-2 ring-border-brand') : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover',
        className,
      )}
    >
      <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', on ? (danger ? 'bg-error-solid text-on-fill' : 'bg-brand-solid text-on-fill') : danger ? 'bg-error-primary text-fg-error-primary' : 'bg-secondary text-fg-quaternary')}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 leading-snug">
        {label}
        {danger ? <span className="sr-only"> (danger sign)</span> : null}
      </span>
    </button>
  );
}

// ---------- Disclosure ----------

export function Disclosure({ summary, children, defaultOpen, className, tone = 'plain' }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; tone?: 'plain' | 'well' }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const id = useId();
  return (
    <div className={cx(tone === 'well' && 'rounded-xl bg-secondary px-3', className)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md text-sm font-semibold text-brand-secondary outline-focus-ring hover:text-brand-secondary_hover focus-visible:outline-2">
        <ChevronDown aria-hidden="true" className={cx('size-4 transition-transform duration-150', open && 'rotate-180')} />
        {summary}
      </button>
      {open ? (
        <div id={id} className="pb-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Side sheet ----------

/**
 * A panel that slides in from the right on desktop and rises from the bottom on phones. Escape and
 * the scrim close it; focus moves in and returns to where it was.
 */
export function SideSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'md',
  label,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  label?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  const w = width === 'xl' ? 'sm:max-w-[880px]' : width === 'lg' ? 'sm:max-w-[640px]' : 'sm:max-w-[520px]';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch" data-testid={testId}>
      <div className="absolute inset-0 bg-overlay/70 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        className={cx(
          'relative flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-primary shadow-xl ring-1 ring-secondary outline-none sm:max-h-none sm:rounded-none sm:rounded-l-2xl',
          'animate-in slide-in-from-bottom-4 duration-200 sm:slide-in-from-right-4',
          w,
        )}
      >
        <header className="flex items-start gap-3 border-b border-secondary px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-tertiary">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-secondary focus-visible:outline-2">
            <XClose className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-secondary px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** A short state word with a coloured dot (never colour alone). */
export function StateDot({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const dot = tone === 'error' ? 'bg-fg-error-secondary' : tone === 'warning' ? 'bg-fg-warning-secondary' : tone === 'success' ? 'bg-fg-success-secondary' : tone === 'brand' ? 'bg-fg-brand-secondary' : 'bg-fg-quaternary';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary">
      <span aria-hidden="true" className={cx('size-2 rounded-full', dot)} />
      {children}
    </span>
  );
}
