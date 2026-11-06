/**
 * Small shared pieces for Today, Mothers and Visits: the mother's initials avatar with a severity
 * ring, the stage chip, children chips, the mini journey bar, the severity stripe, filter chips
 * and section headings. Colours come from theme tokens only.
 */
import type { ReactNode } from 'react';
import type { Child } from '../../types';
import { cx } from '../../utils/cx';
import { initials, shortAge, daysBetween, type ChipColor } from '../format';
import type { CaseRow } from './model';
import type { Urgency } from '../format';

// ---------- Severity ----------

export const SEVERITY: Record<Urgency, { word: string; stripe: string; text: string; soft: string; ring: string; dot: string }> = {
  emergency: { word: 'Emergency', stripe: 'bg-error-solid', text: 'text-error-primary', soft: 'bg-error-primary', ring: 'ring-error-primary', dot: 'bg-error-solid' },
  urgent: { word: 'Urgent', stripe: 'bg-warning-solid', text: 'text-warning-primary', soft: 'bg-warning-primary', ring: 'ring-warning-primary', dot: 'bg-warning-solid' },
  overdue: { word: 'Overdue', stripe: 'bg-utility-orange-500', text: 'text-utility-orange-700', soft: 'bg-utility-orange-50', ring: 'ring-utility-orange-200', dot: 'bg-utility-orange-500' },
  today: { word: 'Due today', stripe: 'bg-brand-solid', text: 'text-brand-secondary', soft: 'bg-brand-primary', ring: 'ring-brand', dot: 'bg-brand-solid' },
  rest: { word: 'On track', stripe: 'bg-success-solid', text: 'text-success-primary', soft: 'bg-success-primary', ring: 'ring-secondary', dot: 'bg-success-solid' },
};

// ---------- Avatar ----------

const AVATAR_TINTS = [
  'bg-utility-brand-50 text-utility-brand-700',
  'bg-utility-pink-50 text-utility-pink-700',
  'bg-utility-blue-50 text-utility-blue-700',
  'bg-utility-indigo-50 text-utility-indigo-700',
  'bg-utility-orange-50 text-utility-orange-700',
];

function tintFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/** Her initials in a soft tint; a coloured ring says the urgency (with the word elsewhere). */
export function MotherAvatar({ name, urgency, size = 'md', className }: { name: string; urgency?: Urgency; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'lg' ? 'size-12 text-md' : size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm';
  const ring = urgency === 'emergency' ? 'ring-2 ring-offset-2 ring-offset-bg-primary ring-fg-error-secondary' : urgency === 'urgent' ? 'ring-2 ring-offset-2 ring-offset-bg-primary ring-fg-warning-secondary' : '';
  return (
    <span aria-hidden="true" className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dims, tintFor(name), ring, className)}>
      {initials(name)}
    </span>
  );
}

// ---------- Chips ----------

const CHIP: Record<ChipColor, string> = {
  brand: 'bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200',
  pink: 'bg-utility-pink-50 text-utility-pink-700 ring-utility-pink-200',
  blue: 'bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200',
  gray: 'bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200',
};

export function Chip({ color = 'gray', children, title, className }: { color?: ChipColor; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset tnum', CHIP[color], className)}>
      {children}
    </span>
  );
}

/** One chip per child: initial and age. Babies under 6 weeks get the pink "newborn" tint. */
export function ChildrenChips({ items, clock, max = 3 }: { items: Child[]; clock: string; max?: number }) {
  // Children within the first 1,000 days of life (about 2 years 9 months).
  const kids = items.filter((c) => {
    const d = daysBetween(c.dob, clock);
    return d >= 0 && d <= 1000;
  });
  if (!kids.length) return null;
  const shown = kids.slice(-max);
  const more = kids.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label={`Children: ${kids.map((c) => `${c.name}, ${shortAge(daysBetween(c.dob, clock))}`).join('; ')}`}>
      {shown.map((c) => {
        const age = daysBetween(c.dob, clock);
        return (
          <Chip key={c.id} color={age <= 42 ? 'pink' : 'blue'} title={`${c.name}, ${shortAge(age)}`}>
            <span aria-hidden="true" className="max-w-20 truncate font-semibold">
              {c.name.split(' ')[0]}
            </span>
            <span aria-hidden="true" className="opacity-80">
              {shortAge(age)}
            </span>
          </Chip>
        );
      })}
      {more > 0 ? <Chip>+{more}</Chip> : null}
    </span>
  );
}

// ---------- Mini journey ----------

/** A thin line from conception to day 1,000: pregnancy segment, first two years, her dot, and contacts. */
export function MiniJourney({ row, className }: { row: CaseRow; className?: string }) {
  const day = row.journeyDay;
  if (day === undefined) {
    return (
      <div className={cx('flex h-4 items-center gap-2', className)} aria-label="Planning a pregnancy">
        <span className="h-1 flex-1 rounded-full bg-tertiary" />
      </div>
    );
  }
  const pct = (d: number) => `${(Math.max(0, Math.min(1000, d)) / 1000) * 100}%`;
  const birth = 266;
  const next = row.journey.find((c) => c.state === 'due' || c.state === 'overdue');
  return (
    <div className={cx('relative h-4', className)} role="img" aria-label={`Day ${Math.round(day)} of 1,000${next ? `, ${next.label} ${next.state}` : ''}`}>
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-tertiary" />
      <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-utility-brand-200" style={{ width: pct(birth) }} />
      <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-brand-solid" style={{ width: pct(day) }} />
      <span className="absolute top-0 h-4 w-px bg-fg-quaternary" style={{ left: pct(birth) }} aria-hidden="true" />
      {row.journey
        .filter((c) => c.state === 'due' || c.state === 'overdue')
        .map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx('absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg-primary', c.state === 'overdue' ? 'bg-error-solid' : 'bg-brand-solid')}
            style={{ left: pct(c.day) }}
          />
        ))}
      <span aria-hidden="true" className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-primary ring-2 ring-bg-primary" style={{ left: pct(day) }} />
    </div>
  );
}

// ---------- Filter chips ----------

export function FilterChip({ pressed, onClick, children, count, tone }: { pressed: boolean; onClick: () => void; children: ReactNode; count?: number; tone?: 'error' | 'warning' }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ring-1 transition duration-100 ease-linear ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        pressed ? 'bg-brand-solid text-on-fill ring-transparent' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover',
      )}
    >
      {tone ? <span aria-hidden="true" className={cx('size-1.5 rounded-full', tone === 'error' ? 'bg-error-solid' : 'bg-warning-solid')} /> : null}
      {children}
      {count !== undefined ? <span className={cx('tnum', pressed ? 'opacity-80' : 'text-quaternary')}>{count}</span> : null}
    </button>
  );
}

export function SectionHead({ id, title, children, action }: { id: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold text-primary">
          {title}
        </h2>
        {children ? <p className="mt-0.5 text-sm text-tertiary">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
