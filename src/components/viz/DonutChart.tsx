import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { arc, fmt, SERIES, TONE, TRACK, useReducedMotion, type Tone } from './shared';

export interface DonutSlice {
  label: string;
  value: number;
  tone?: Tone;
}

export interface DonutChartProps {
  data: DonutSlice[];
  label: string;
  size?: number;
  thickness?: number;
  /** Big figure in the middle (defaults to the total). */
  center?: ReactNode;
  centerLabel?: ReactNode;
  legend?: boolean;
  className?: string;
}

/** Parts of a whole. Keep it to five slices or fewer; fold the rest into "Other". */
export function DonutChart({ data, label, size = 160, thickness = 16, center, centerLabel, legend = true, className }: DonutChartProps) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const gap = data.length > 1 ? 2.5 : 0; // degrees of surface between slices
  let a = 0;
  const color = (d: DonutSlice, i: number) => (d.tone ? TONE[d.tone] : SERIES[i % SERIES.length]);
  return (
    <div className={cx('flex flex-wrap items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg role="img" aria-label={`${label}. ${data.map((d) => `${d.label} ${fmt(d.value)} (${Math.round((d.value / total) * 100)}%)`).join(', ')}.`} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke={TRACK} strokeWidth={thickness} />
          {data.map((d, i) => {
            const sweep = (Math.max(0, d.value) / total) * 360;
            const a0 = a + gap / 2;
            const a1 = a + sweep - gap / 2;
            a += sweep;
            if (a1 <= a0) return null;
            return <path key={d.label} d={arc(c, c, r, a0, a1)} fill="none" stroke={color(d, i)} strokeWidth={thickness} strokeLinecap="butt" />;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-display-xs font-semibold text-primary">{center ?? fmt(total)}</span>
          {centerLabel ? <span className="text-xs text-tertiary">{centerLabel}</span> : null}
        </div>
      </div>
      {legend ? (
        <ul className="grid min-w-36 flex-1 gap-2 text-sm">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color(d, i) }} />
              <span className="text-tertiary">{d.label}</span>
              <span className="ml-auto font-semibold text-primary tnum">{fmt(d.value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface ProgressRingProps {
  /** 0 to 100. */
  value: number;
  label: string;
  size?: number;
  thickness?: number;
  tone?: Tone;
  /** Text in the middle (defaults to the percentage). */
  children?: ReactNode;
  className?: string;
}

/** One share of a target, as a ring. */
export function ProgressRing({ value, label, size = 72, thickness = 8, tone = 'brand', children, className }: ProgressRingProps) {
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className={cx('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg role="img" aria-label={`${label}: ${Math.round(v)}%`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * circ} ${circ}`}
          style={reduced ? undefined : { transition: 'stroke-dasharray 600ms ease-out' }}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-primary tnum" aria-hidden="true">
        {children ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
}
