import { cx } from '../../utils/cx';
import { AXIS, fmt, SURFACE, TONE, useWidth } from './shared';

export interface BPReading {
  /** ISO date or a short label. */
  label: string;
  systolic: number;
  diastolic: number;
}

export interface BPChartProps {
  readings: BPReading[];
  label?: string;
  /** Band thresholds (mmHg). Defaults follow WHO and NICE pregnancy cut-offs: 140/90 raised, 160/110 severe. */
  raised?: { systolic: number; diastolic: number };
  severe?: { systolic: number; diastolic: number };
  height?: number;
  className?: string;
}

type Zone = 'normal' | 'raised' | 'severe';
export function bpZone(r: BPReading, raised = { systolic: 140, diastolic: 90 }, severe = { systolic: 160, diastolic: 110 }): Zone {
  if (r.systolic >= severe.systolic || r.diastolic >= severe.diastolic) return 'severe';
  if (r.systolic >= raised.systolic || r.diastolic >= raised.diastolic) return 'raised';
  return 'normal';
}

/**
 * Blood pressure over visits: each reading is a vertical bar from diastolic to systolic over three
 * horizontal zones (normal, raised, severe) for systolic. Raised readings are amber, severe red,
 * and each zone is named on the chart so colour is never the only cue.
 */
export function BPChart({ readings, label = 'Blood pressure', raised = { systolic: 140, diastolic: 90 }, severe = { systolic: 160, diastolic: 110 }, height = 240, className }: BPChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const m = { t: 10, r: 64, b: 26, l: 36 };
  const w = Math.max(80, width - m.l - m.r);
  const h = height - m.t - m.b;
  const lo = 50;
  const hi = Math.max(180, ...readings.map((r) => r.systolic + 10));
  const y = (v: number) => m.t + h - ((v - lo) / (hi - lo)) * h;
  const n = readings.length;
  const band = w / Math.max(1, n);
  const x = (i: number) => m.l + band * i + band / 2;
  const zoneColor: Record<Zone, string> = { normal: 'var(--color-fg-secondary)', raised: TONE.warning, severe: TONE.danger };
  const last = readings[n - 1];
  const summary = `${label}. ${n} readings${last ? `, latest ${last.systolic}/${last.diastolic} (${bpZone(last, raised, severe)})` : ''}. ${readings.filter((r) => bpZone(r, raised, severe) === 'severe').length} severe, ${
    readings.filter((r) => bpZone(r, raised, severe) === 'raised').length
  } raised.`;
  const zones: Array<{ from: number; to: number; fill: string; name: string; text: string }> = [
    { from: lo, to: raised.systolic, fill: 'var(--color-bg-success-primary)', name: 'Normal', text: 'var(--color-text-success-primary)' },
    { from: raised.systolic, to: severe.systolic, fill: 'var(--color-bg-warning-primary)', name: 'Raised', text: 'var(--color-text-warning-primary)' },
    { from: severe.systolic, to: hi, fill: 'var(--color-bg-error-primary)', name: 'Severe', text: 'var(--color-text-error-primary)' },
  ];
  return (
    <div ref={ref} className={cx('w-full', className)}>
      <svg role="img" aria-label={summary} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {zones.map((z) => (
          <g key={z.name}>
            <rect x={m.l} y={y(z.to)} width={w} height={y(z.from) - y(z.to)} fill={z.fill} />
            <text x={m.l + w + 8} y={(y(z.to) + y(z.from)) / 2} dy="0.32em" fontSize={11} fontWeight={600} fill={z.text}>
              {z.name}
            </text>
          </g>
        ))}
        {[lo, 90, raised.systolic, severe.systolic].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
          <text key={v} x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS} className="tnum">
            {v}
          </text>
        ))}
        <line x1={m.l} x2={m.l + w} y1={y(raised.diastolic)} y2={y(raised.diastolic)} stroke={TONE.warning} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
        {readings.map((r, i) => {
          const z = bpZone(r, raised, severe);
          const c = zoneColor[z];
          const bw = Math.min(8, band * 0.35);
          return (
            <g key={`${r.label}-${i}`}>
              <rect x={x(i) - bw / 2} y={y(r.systolic)} width={bw} height={Math.max(2, y(r.diastolic) - y(r.systolic))} rx={bw / 2} fill={c} opacity={0.35} />
              <circle cx={x(i)} cy={y(r.systolic)} r={4.5} fill={c} stroke={SURFACE} strokeWidth={2} />
              <circle cx={x(i)} cy={y(r.diastolic)} r={4.5} fill={SURFACE} stroke={c} strokeWidth={2} />
              <title>{`${r.label}: ${r.systolic}/${r.diastolic} mmHg (${z})`}</title>
              {i === n - 1 || z === 'severe' ? (
                <text x={x(i)} y={y(r.systolic) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-text-primary)" className="tnum">
                  {fmt(r.systolic)}/{fmt(r.diastolic)}
                </text>
              ) : null}
              {band >= 40 || i % Math.ceil(40 / band) === 0 ? (
                <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS}>
                  {r.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-fg-secondary" /> Systolic
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full ring-2 ring-fg-secondary ring-inset" /> Diastolic
        </li>
        <li>Dashed line: diastolic {raised.diastolic}</li>
      </ul>
    </div>
  );
}
