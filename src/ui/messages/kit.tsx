/**
 * Small pieces shared by the messaging, review, Insights and library screens: a card, a section
 * heading, a segmented control, a status list row, safe links (http and https only), and the
 * acting worker's permissions from src/auth.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from '@untitledui/icons';
import type { Worker } from '../../types';
import { can as authCan, getAuthStore, profileFromWorker, type Action, type WorkerProfile } from '../../auth';
import { cx } from '../../utils/cx';

// ---------- Permissions ----------

/** The acting worker's profile: the one saved on this device, else built from the demo record. */
export function profileFor(worker: Worker | undefined): WorkerProfile | undefined {
  if (!worker) return undefined;
  try {
    const saved = getAuthStore().getWorker(worker.id);
    if (saved) return saved;
  } catch {
    /* no auth store on this device */
  }
  return profileFromWorker(worker);
}

/** May the acting worker do this? Uses can() from src/auth; no profile means no permission. */
export function allowed(worker: Worker | undefined, action: Action): boolean {
  const p = profileFor(worker);
  if (!p) return false;
  try {
    return authCan(p, action);
  } catch {
    return false;
  }
}

// ---------- Links ----------

/** Only http(s) links are rendered as links; anything else (javascript:, data:) is plain text. */
export function safeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function SafeLink({ href, children, className }: { href?: string | null; children: ReactNode; className?: string }) {
  const url = safeUrl(href);
  if (!url) return <span className={className}>{children}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cx('text-brand-secondary underline-offset-2 hover:underline', className)}>
      {children}
    </a>
  );
}

// ---------- Layout ----------

export function Card({ title, action, children, className, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('min-w-0 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset', className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h3 className="text-sm font-semibold text-primary">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, lede, action, eyebrow }: { title: ReactNode; lede?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-sm font-medium text-brand-secondary">{eyebrow}</p> : null}
        <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">{title}</h1>
        {lede ? <p className="mt-1 max-w-[68ch] text-md text-tertiary">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

/** A segmented control: a row of pressable options, one selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: Array<{ id: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-secondary p-0.5 ring-1 ring-secondary ring-inset', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md font-semibold whitespace-nowrap text-quaternary transition',
            size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-10 px-3 text-sm',
            value === o.id ? 'bg-primary text-secondary shadow-xs ring-1 ring-secondary' : 'hover:text-secondary',
          )}
        >
          {o.label}
          {o.count ? <span className="rounded-full bg-tertiary px-1.5 text-xs text-tertiary tnum">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** One check in a checklist: pass, warn or fail, with a word and an icon (never colour alone). */
export function CheckRow({ status, children }: { status: 'ok' | 'warn' | 'fail'; children: ReactNode }) {
  const Icon = status === 'ok' ? CheckCircle : status === 'warn' ? AlertTriangle : XCircle;
  return (
    <li className="flex items-start gap-2.5 py-2 text-sm">
      <Icon
        aria-hidden="true"
        className={cx('mt-0.5 size-4.5 shrink-0', status === 'ok' ? 'text-fg-success-secondary' : status === 'warn' ? 'text-fg-warning-secondary' : 'text-fg-error-secondary')}
      />
      <span className="sr-only">{status === 'ok' ? 'Passed: ' : status === 'warn' ? 'Check: ' : 'Problem: '}</span>
      <span className={cx('min-w-0', status === 'fail' ? 'text-error-primary' : 'text-secondary')}>{children}</span>
    </li>
  );
}

/** Initials in a coloured circle (token colours only). */
export function Initials({ name, size = 'md', tone = 0, className }: { name: string; size?: 'sm' | 'md' | 'lg'; tone?: number; className?: string }) {
  const letters = name
    .replace(/^(dr|mrs|mr|ms|nurse)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const tones = ['bg-utility-brand-100 text-utility-brand-700', 'bg-utility-orange-100 text-utility-orange-700', 'bg-utility-blue-100 text-utility-blue-700', 'bg-utility-pink-100 text-utility-pink-700', 'bg-utility-indigo-100 text-utility-indigo-700'];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-[var(--color-bg-primary)]',
        size === 'sm' ? 'size-7 text-xs' : size === 'lg' ? 'size-11 text-md' : 'size-9 text-sm',
        tones[Math.abs(tone) % tones.length],
        className,
      )}
    >
      {letters}
    </span>
  );
}

/** Stable small number from a string, for picking an avatar tone. */
export function hashTone(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
