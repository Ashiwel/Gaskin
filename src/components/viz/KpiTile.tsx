import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import { Sparkline } from './Sparkline';

export interface KpiTileProps {
  /** Sentence case, no trailing colon. */
  label: string;
  /** The figure, already formatted (e.g. "68%", "1,284"). */
  value: ReactNode;
  /** Change versus the named period, as a signed number (e.g. +6 or -2.5). */
  delta?: number;
  deltaUnit?: string;
  /** e.g. "vs last month". */
  period?: string;
  /** Whether a rise is good (postnatal checks) or bad (missed contacts). */
  higherIsBetter?: boolean;
  /** Recent values for the sparkline (about 12). */
  trend?: number[];
  icon?: ReactNode;
  /** Draws the tile as a bordered card. Leave off inside an existing card or grid. */
  card?: boolean;
  className?: string;
}

/** A figure with its change and a sparkline. Colour of the delta = direction x whether up is good. */
export function KpiTile({ label, value, delta, deltaUnit = '', period, higherIsBetter = true, trend, icon, card = true, className }: KpiTileProps) {
  const good = delta == null || delta === 0 ? null : delta > 0 === higherIsBetter;
  const Arrow = delta != null && delta < 0 ? ArrowDown : ArrowUp;
  return (
    <div className={cx('flex min-w-0 flex-col gap-3', card && 'rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset', className)}>
      <div className="flex items-start gap-2">
        {icon ? <span className="mt-0.5 shrink-0 text-fg-quaternary [&>svg]:size-4">{icon}</span> : null}
        {/* Labels wrap rather than cut off: "Waiting for review" must read in full on a phone. */}
        <p className="min-w-0 text-sm font-medium break-words text-tertiary">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 text-display-sm font-semibold text-primary">{value}</p>
        {trend && trend.length > 1 ? (
          <div className="mb-1 w-20 shrink-0 sm:w-24">
            <Sparkline values={trend} label={`${label}, trend`} tone={good === false ? 'danger' : 'brand'} height={36} />
          </div>
        ) : null}
      </div>
      {delta != null ? (
        <p className="-mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
          <span
            className={cx(
              'inline-flex items-center gap-0.5 font-medium whitespace-nowrap tnum',
              good === true && 'text-success-primary',
              good === false && 'text-error-primary',
              good === null && 'text-tertiary',
            )}
          >
            {delta !== 0 ? <Arrow className="size-4" aria-hidden="true" /> : null}
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}
            {Math.abs(delta)}
            {deltaUnit}
          </span>
          {period ? <span className="text-tertiary">{period}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
