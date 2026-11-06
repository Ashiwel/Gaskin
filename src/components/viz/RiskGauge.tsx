import { cx } from '../../utils/cx';
import { arc, SURFACE, TONE, TRACK } from './shared';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'danger';

export interface RiskGaugeProps {
  /** 0 to 100 on the gauge. */
  value: number;
  level: RiskLevel;
  /** Accessible name, e.g. "Pre-eclampsia risk". */
  label: string;
  size?: number;
  className?: string;
}

const LEVEL = {
  low: { tone: TONE.success, word: 'Low', text: 'text-success-primary' },
  moderate: { tone: TONE.warning, word: 'Moderate', text: 'text-warning-primary' },
  high: { tone: 'var(--color-utility-orange-500)', word: 'High', text: 'text-utility-orange-700' },
  danger: { tone: TONE.danger, word: 'Danger', text: 'text-error-primary' },
} as const;

/**
 * A half-circle gauge with four zones (low, moderate, high, danger) and a needle. The level word is
 * always printed, so the state never depends on colour alone. The level comes from the rules
 * engine; the gauge only shows it.
 */
export function RiskGauge({ value, level, label, size = 160, className }: RiskGaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const th = size * 0.09;
  const r = size / 2 - th / 2 - 2;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const h = size / 2 + th;
  const zones: Array<[number, number, string]> = [
    [0, 40, TONE.success],
    [40, 65, TONE.warning],
    [65, 85, 'var(--color-utility-orange-500)'],
    [85, 100, TONE.danger],
  ];
  const ang = (p: number) => -90 + (p / 100) * 180;
  const needle = ((ang(v) - 90) * Math.PI) / 180;
  const L = LEVEL[level];
  return (
    <div className={cx('inline-flex flex-col items-center', className)}>
      <svg role="img" aria-label={`${label}: ${L.word}`} width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <path d={arc(cx0, cy0, r, -90, 90)} fill="none" stroke={TRACK} strokeWidth={th} />
        {zones.map(([a, b, c]) => (
          <path key={a} d={arc(cx0, cy0, r, ang(a) + 1, ang(b) - 1)} fill="none" stroke={c} strokeWidth={th} opacity={0.9} />
        ))}
        <line x1={cx0} y1={cy0} x2={cx0 + Math.cos(needle) * (r - th)} y2={cy0 + Math.sin(needle) * (r - th)} stroke="var(--color-fg-primary)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx0} cy={cy0} r={6} fill="var(--color-fg-primary)" stroke={SURFACE} strokeWidth={2} />
      </svg>
      <span className={cx('-mt-1 text-lg font-semibold', L.text)}>{L.word}</span>
      <span className="text-xs text-tertiary">{label}</span>
    </div>
  );
}
