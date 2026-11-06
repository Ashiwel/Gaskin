import { cx } from '../../utils/cx';
import { describeSeries, extent, SERIES, smoothPath, SURFACE, TONE, useSvgId, useWidth, type Tone } from './shared';

export interface SparklineProps {
  values: number[];
  /** Accessible name, e.g. "Postnatal checks within 48 hours, last 12 weeks". */
  label: string;
  tone?: Tone | 'series';
  height?: number;
  /** Faint area under the line. */
  area?: boolean;
  /** Dot on the last value. */
  endpoint?: boolean;
  className?: string;
}

/** A word-sized trend line that fills its container's width. */
export function Sparkline({ values, label, tone = 'brand', height = 32, area = true, endpoint = true, className }: SparklineProps) {
  const id = useSvgId('spark');
  const [ref, width] = useWidth<HTMLDivElement>(120);
  const color = tone === 'series' ? SERIES[0] : TONE[tone];
  const [lo, hi] = extent(values);
  const pad = 4;
  const pts: Array<[number, number]> = values.map((v, i) => [
    values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2),
  ]);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className={cx('w-full min-w-12', className)}>
      <svg role="img" aria-label={describeSeries(label, values)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && pts.length > 1 ? <path d={`${line}L${last[0]},${height}L${pts[0][0]},${height}Z`} fill={`url(#${id})`} /> : null}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {endpoint && last ? <circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke={SURFACE} strokeWidth={2} /> : null}
      </svg>
    </div>
  );
}
