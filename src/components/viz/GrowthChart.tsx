import { cx } from '../../utils/cx';
import { AXIS, fmt, GRID, SURFACE, TONE, useWidth } from './shared';

export interface GrowthReferenceRow {
  /** Age in months. */
  month: number;
  /** WHO median. */
  median: number;
  minus2: number;
  plus2: number;
  /** Optional outer lines (-3 and +3 SD). */
  minus3?: number;
  plus3?: number;
}

export interface GrowthPoint {
  month: number;
  value: number;
}

export interface GrowthChartProps {
  /** WHO reference rows for this sex and measure (pass the data; the chart holds none). */
  reference: GrowthReferenceRow[];
  points: GrowthPoint[];
  /** e.g. "Weight-for-age, girls". */
  label: string;
  unit?: string;
  height?: number;
  className?: string;
}

/**
 * Growth chart scaffold: the WHO median and the band between -2 and +2 SD, with the child's
 * measurements on top. Points below -2 SD (or above +2) are drawn in the error colour and named in
 * the accessible description. The reference data is passed in, so the chart serves weight, length
 * and head circumference for both sexes.
 */
export function GrowthChart({ reference, points, label, unit = 'kg', height = 260, className }: GrowthChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const m = { t: 12, r: 12, b: 28, l: 36 };
  const w = Math.max(80, width - m.l - m.r);
  const h = height - m.t - m.b;
  const maxMonth = Math.max(...reference.map((r) => r.month), ...points.map((p) => p.month), 1);
  const lo = Math.min(...reference.map((r) => r.minus3 ?? r.minus2), ...points.map((p) => p.value));
  const hi = Math.max(...reference.map((r) => r.plus3 ?? r.plus2), ...points.map((p) => p.value));
  const yLo = Math.floor(lo);
  const yHi = Math.ceil(hi);
  const x = (mo: number) => m.l + (mo / maxMonth) * w;
  const y = (v: number) => m.t + h - ((v - yLo) / (yHi - yLo)) * h;
  const line = (k: keyof GrowthReferenceRow) => reference.filter((r) => r[k] != null).map((r, i) => `${i ? 'L' : 'M'}${x(r.month)},${y(r[k] as number)}`).join('');
  const band = `${line('plus2')}${[...reference].reverse().map((r) => `L${x(r.month)},${y(r.minus2)}`).join('')}Z`;
  const refAt = (mo: number) => {
    const after = reference.find((r) => r.month >= mo) ?? reference[reference.length - 1];
    const before = [...reference].reverse().find((r) => r.month <= mo) ?? reference[0];
    if (after.month === before.month) return before;
    const t = (mo - before.month) / (after.month - before.month);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    return { month: mo, median: lerp(before.median, after.median), minus2: lerp(before.minus2, after.minus2), plus2: lerp(before.plus2, after.plus2) };
  };
  const flagged = points.filter((p) => {
    const r = refAt(p.month);
    return p.value < r.minus2 || p.value > r.plus2;
  });
  const step = maxMonth > 12 ? 6 : maxMonth > 6 ? 2 : 1;
  const yStep = yHi - yLo > 10 ? 2 : 1;
  const last = points[points.length - 1];
  return (
    <div ref={ref} className={cx('w-full', className)}>
      <svg
        role="img"
        aria-label={`${label}. ${points.length} measurements${last ? `, latest ${fmt(last.value)} ${unit} at ${fmt(last.month)} months` : ''}. ${
          flagged.length ? `${flagged.length} outside the WHO −2 to +2 SD band.` : 'All inside the WHO −2 to +2 SD band.'
        }`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {Array.from({ length: Math.floor((yHi - yLo) / yStep) + 1 }, (_, i) => yLo + i * yStep).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS} className="tnum">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(maxMonth / step) + 1 }, (_, i) => i * step).map((mo) => (
          <text key={mo} x={x(mo)} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS}>
            {mo}
          </text>
        ))}
        <path d={band} fill="var(--color-chart-band)" />
        {reference.some((r) => r.minus3 != null) ? <path d={line('minus3')} fill="none" stroke="var(--color-fg-error-secondary)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} /> : null}
        {reference.some((r) => r.plus3 != null) ? <path d={line('plus3')} fill="none" stroke="var(--color-fg-quaternary)" strokeWidth={1} strokeDasharray="3 3" /> : null}
        <path d={line('plus2')} fill="none" stroke="var(--color-chart-band-strong)" strokeWidth={1} />
        <path d={line('minus2')} fill="none" stroke="var(--color-chart-band-strong)" strokeWidth={1} />
        <path d={line('median')} fill="none" stroke={TONE.brand} strokeWidth={1.5} opacity={0.6} />
        {points.length > 1 ? <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month)},${y(p.value)}`).join('')} fill="none" stroke="var(--color-fg-secondary)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {points.map((p) => {
          const off = flagged.includes(p);
          return (
            <circle key={`${p.month}-${p.value}`} cx={x(p.month)} cy={y(p.value)} r={off ? 5.5 : 4.5} fill={off ? TONE.danger : 'var(--color-fg-secondary)'} stroke={SURFACE} strokeWidth={2}>
              <title>{`${fmt(p.month)} months: ${fmt(p.value)} ${unit}${off ? ' (outside −2 to +2 SD)' : ''}`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-fg-brand-primary" /> WHO median
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-brand-secondary" /> −2 to +2 SD
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-fg-error-secondary" /> Outside the band
        </li>
        <li className="ml-auto">Age in months</li>
      </ul>
    </div>
  );
}
