/**
 * Charts specific to Insights: the care cascade as connected bars, a referral meter and the hero
 * figure's ring.
 */
import { cx } from '../../utils/cx';
import { useReducedMotion } from '../../components/viz/shared';

export interface CascadeStep {
  label: string;
  value: number;
  /** Short detail under the label */
  hint?: string;
}

/**
 * Each bar is a share of the first step; a band between bars shows who was lost. Percentages
 * between steps say how many carried on.
 */
export function CareCascade({ steps, label }: { steps: CascadeStep[]; label: string }) {
  const reduced = useReducedMotion();
  const base = Math.max(1, steps[0]?.value ?? 1);
  return (
    <figure className="m-0" data-testid="care-cascade">
      <div
        role="img"
        aria-label={`${label}. ${steps.map((s, i) => `${s.label} ${s.value}${i ? ` (${steps[i - 1].value ? Math.round((s.value / steps[i - 1].value) * 100) : 0}% of the step before)` : ''}`).join(', ')}.`}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => {
          const h = (s.value / base) * 100;
          const prev = i ? steps[i - 1].value : null;
          const carry = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label} className="flex min-w-0 flex-col">
              <div className="relative h-40 rounded-lg bg-secondary">
                {i > 0 && prev !== null ? (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 rounded-lg bg-[var(--color-chart-band)]" style={{ height: `${(prev / base) * 100}%` }} />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cx('absolute inset-x-0 bottom-0 rounded-lg', i === 2 ? 'bg-brand-solid' : 'bg-[var(--color-chart-1)]', !reduced && 'transition-[height] duration-700 ease-out')}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                <span className="absolute inset-x-0 top-2 text-center text-lg font-semibold text-primary tnum">{s.value}</span>
              </div>
              <p className="mt-2 truncate text-sm font-medium text-primary" title={s.label}>
                {s.label}
              </p>
              <p className="text-xs text-tertiary">{carry !== null ? `${carry}% carried on` : (s.hint ?? 'Births')}</p>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-4 text-xs text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--color-chart-1)]" /> Reached this step
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--color-chart-band)] ring-1 ring-secondary" /> Lost since the step before
        </span>
      </figcaption>
    </figure>
  );
}

/** Open against closed referrals as one bar, with words. */
export function ReferralMeter({ open, done, notDone }: { open: number; done: number; notDone: number }) {
  const total = Math.max(1, open + done + notDone);
  const parts = [
    { label: 'Completed', value: done, cls: 'bg-success-solid' },
    { label: 'Still open', value: open, cls: 'bg-warning-solid' },
    { label: 'Did not reach care', value: notDone, cls: 'bg-error-solid' },
  ];
  return (
    <div>
      <div role="img" aria-label={`Referrals: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-tertiary">
        {parts.map((p) => (p.value ? <span key={p.label} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={cx('size-2.5 rounded-full', p.cls)} />
            <span className="text-tertiary">{p.label}</span>
            <span className="ml-auto font-semibold text-primary tnum">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
