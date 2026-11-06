import { useState } from 'react';
import { cx } from '../../utils/cx';
import { AXIS, describeSeries, fmt, GRID, niceMax, SERIES, smoothPath, SURFACE, ticks, useReducedMotion, useSvgId, useWidth } from './shared';

export interface AreaSeries {
  name: string;
  values: number[];
}

export interface AreaChartProps {
  /** X labels, one per value. */
  labels: string[];
  series: AreaSeries[];
  /** Accessible name. */
  label: string;
  height?: number;
  unit?: string;
  /** Fixed y maximum (e.g. 100 for percentages). */
  max?: number;
  /** Show every nth x label (auto by default). */
  labelEvery?: number;
  className?: string;
}

/**
 * Area chart: faint grid, 2px lines, a 10% wash under the first series, the last point of each
 * series emphasised with a ringed dot and its value. Hover or focus shows a crosshair and values.
 */
export function AreaChart({ labels, series, label, height = 220, unit = '', max, labelEvery, className }: AreaChartProps) {
  const id = useSvgId('area');
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const yMax = max ?? niceMax(Math.max(...all, 0));
  const m = { t: 12, r: 44, b: 26, l: 36 };
  const w = Math.max(80, width - m.l - m.r);
  const h = height - m.t - m.b;
  const n = labels.length;
  const x = (i: number) => m.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => m.t + h - (v / yMax) * h;
  const every = labelEvery ?? Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));
  const desc = series.map((s) => describeSeries(s.name, s.values, unit)).join(' ');
  // Direct-label a series' last value only if it clears the labels already placed (no stacking:
  // converging lines fall back to the legend and the hover read-out).
  const placed: number[] = [];
  const showEnd = series.map((s) => {
    const v = s.values[s.values.length - 1];
    if (v == null) return false;
    const yy = y(v);
    if (placed.some((p) => Math.abs(p - yy) < 14)) return false;
    placed.push(yy);
    return true;
  });

  return (
    <div ref={ref} className={cx('relative w-full', className)}>
      <svg
        role="img"
        aria-label={`${label}. ${desc}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-pan-y"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - m.l) / w) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={SERIES[0]} stopOpacity="0.16" />
            <stop offset="1" stopColor={SERIES[0]} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks(yMax).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS} className="tnum">
              {fmt(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          (i % every === 0 && n - 1 - i >= every * 0.6) || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={AXIS}>
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const d = smoothPath(pts);
          const last = pts[pts.length - 1];
          const color = SERIES[si % SERIES.length];
          return (
            <g key={s.name}>
              {si === 0 && pts.length > 1 ? <path d={`${d}L${last[0]},${m.t + h}L${pts[0][0]},${m.t + h}Z`} fill={`url(#${id})`} /> : null}
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={reduced ? undefined : 1}
                className={reduced ? undefined : 'animate-[gaskin-draw_900ms_ease-out_both]'}
              />
              {last ? (
                <g>
                  <circle cx={last[0]} cy={last[1]} r={5} fill={color} stroke={SURFACE} strokeWidth={2} />
                  {showEnd[si] ? <text x={last[0] + 9} y={last[1]} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-text-primary)" className="tnum">
                    {fmt(s.values[s.values.length - 1])}
                    {unit}
                  </text> : null}
                </g>
              ) : null}
            </g>
          );
        })}
        {hover != null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + h} stroke={AXIS} strokeWidth={1} />
            {series.map((s, si) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={SERIES[si % SERIES.length]} stroke={SURFACE} strokeWidth={2} />
            ))}
          </g>
        ) : null}
      </svg>
      {hover != null ? (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 rounded-lg bg-primary px-3 py-2 text-xs shadow-lg ring-1 ring-secondary"
          style={{ left: Math.min(Math.max(0, x(hover) - 60), width - 140) }}
        >
          <p className="font-semibold text-primary">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-2 text-tertiary">
              <span className="size-2 rounded-full" style={{ background: SERIES[si % SERIES.length] }} />
              {s.name} <span className="ml-auto font-medium text-primary tnum">{fmt(s.values[hover])}{unit}</span>
            </p>
          ))}
        </div>
      ) : null}
      {series.length > 1 ? <Legend names={series.map((s) => s.name)} /> : null}
    </div>
  );
}

export function Legend({ names, className }: { names: string[]; className?: string }) {
  return (
    <ul className={cx('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary', className)}>
      {names.map((n, i) => (
        <li key={n} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
          {n}
        </li>
      ))}
    </ul>
  );
}
