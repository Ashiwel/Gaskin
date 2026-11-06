import { cx } from '../../utils/cx';
import { AXIS, barPath, fmt, GRID, niceMax, SERIES, ticks, TONE, useWidth, type Tone } from './shared';

export interface Bar {
  label: string;
  value: number;
  /** Clinical tone for this bar (danger uses the error scale). Defaults to series 1. */
  tone?: Tone;
  /** Shown faint, e.g. a target or last period. */
  muted?: boolean;
}

export interface BarChartProps {
  data: Bar[];
  /** Accessible name. */
  label: string;
  orientation?: 'vertical' | 'horizontal';
  unit?: string;
  max?: number;
  /** Height for vertical charts; horizontal charts size to their rows. */
  height?: number;
  /** Print the value at each bar's end (default on for horizontal). */
  showValues?: boolean;
  className?: string;
}

const colorOf = (b: Bar) => (b.muted ? 'var(--color-chart-track)' : b.tone ? TONE[b.tone] : SERIES[0]);

/** Bars grow from one baseline, at most 24px thick, with a 4px rounded data end. */
export function BarChart({ data, label, orientation = 'vertical', unit = '', max, height = 200, showValues, className }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const yMax = max ?? niceMax(Math.max(...data.map((d) => d.value), 0));
  const summary = `${label}. ${data.map((d) => `${d.label} ${fmt(d.value)}${unit}`).join(', ')}.`;

  if (orientation === 'horizontal') {
    const values = showValues ?? true;
    const labelW = Math.min(200, Math.max(96, width * 0.42));
    const valueW = values ? 52 : 8;
    const barW = Math.max(40, width - labelW - valueW);
    const row = 32;
    const thick = 16;
    const h = data.length * row;
    return (
      <div ref={ref} className={cx('w-full', className)}>
        <svg role="img" aria-label={summary} width={width} height={h} viewBox={`0 0 ${width} ${h}`} className="block">
          {data.map((d, i) => {
            const y = i * row + (row - thick) / 2;
            const w = (Math.max(0, d.value) / yMax) * barW;
            return (
              <g key={d.label}>
                <text x={0} y={i * row + row / 2} dy="0.32em" fontSize={13} fill="var(--color-text-secondary)">
                  {d.label.length > Math.floor(labelW / 7.4) ? `${d.label.slice(0, Math.floor(labelW / 7.4) - 1)}…` : d.label}
                </text>
                <rect x={labelW} y={y} width={barW} height={thick} rx={4} fill="var(--color-chart-track)" />
                <path d={barPath(labelW, y, w, thick, 'right')} fill={colorOf(d)}>
                  <title>{`${d.label}: ${fmt(d.value)}${unit}`}</title>
                </path>
                {values ? (
                  <text x={labelW + barW + 8} y={i * row + row / 2} dy="0.32em" fontSize={13} fontWeight={600} fill="var(--color-text-primary)" className="tnum">
                    {fmt(d.value)}
                    {unit}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const m = { t: 18, r: 4, b: 26, l: 32 };
  const w = Math.max(40, width - m.l - m.r);
  const h = height - m.t - m.b;
  const band = w / Math.max(1, data.length);
  const thick = Math.min(24, band * 0.6);
  const y = (v: number) => m.t + h - (v / yMax) * h;
  const showLabels = band >= 28;
  return (
    <div ref={ref} className={cx('w-full', className)}>
      <svg role="img" aria-label={summary} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {ticks(yMax).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS} className="tnum">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const bx = m.l + i * band + (band - thick) / 2;
          const bh = (Math.max(0, d.value) / yMax) * h;
          return (
            <g key={d.label}>
              <path d={barPath(bx, m.t + h - bh, thick, bh, 'up')} fill={colorOf(d)}>
                <title>{`${d.label}: ${fmt(d.value)}${unit}`}</title>
              </path>
              {showValues ? (
                <text x={bx + thick / 2} y={m.t + h - bh - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-text-secondary)" className="tnum">
                  {fmt(d.value)}
                </text>
              ) : null}
              {showLabels || i % 2 === 0 ? (
                <text x={bx + thick / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={AXIS}>
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
