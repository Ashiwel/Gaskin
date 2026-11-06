import { cx } from '../../utils/cx';
import { SURFACE, TONE, useWidth } from './shared';

export type ContactState = 'done' | 'due' | 'overdue' | 'upcoming' | 'missed';

export interface JourneyContact {
  /** Days from conception (estimated from LMP minus 14) on the 0..1,280 axis. */
  day: number;
  label: string;
  state: ContactState;
}

export interface JourneyTimelineProps {
  /** Today's position in days from conception. */
  today: number;
  /** Birth, in days from conception (default 266, i.e. 40 weeks from LMP). */
  birthDay?: number;
  contacts: JourneyContact[];
  /** Accessible name, e.g. "Adaeze Okafor's care journey". */
  label: string;
  /** Hide the stage names under the line (for compact headers). */
  compact?: boolean;
  className?: string;
}

/** The first 1,000 days: 280 of pregnancy (from conception, roughly 266) plus the first two years. */
export const JOURNEY_END = 1000;

const STATE_COLOR: Record<ContactState, string> = {
  done: TONE.success,
  due: TONE.brand,
  overdue: TONE.danger,
  missed: TONE.warning,
  upcoming: 'var(--color-fg-quaternary)',
};
const STATE_WORD: Record<ContactState, string> = { done: 'done', due: 'due', overdue: 'overdue', missed: 'missed', upcoming: 'upcoming' };

/**
 * Conception to day 1,000 on one line: pregnancy and the first two years as two segments, every
 * contact as a marker coloured by state, and today as a ringed dot. Due contacts are filled brand,
 * overdue ones filled red with a halo, done ones green, upcoming ones hollow.
 */
export function JourneyTimeline({ today, birthDay = 266, contacts, label, compact, className }: JourneyTimelineProps) {
  const [ref, width] = useWidth<HTMLDivElement>(600);
  const padX = 10;
  const w = Math.max(100, width - padX * 2);
  const x = (d: number) => padX + (Math.max(0, Math.min(JOURNEY_END, d)) / JOURNEY_END) * w;
  const lineY = 18;
  const height = compact ? 36 : 58;
  const t = Math.max(0, Math.min(JOURNEY_END, today));
  const counts = contacts.reduce<Record<string, number>>((acc, c) => ((acc[c.state] = (acc[c.state] ?? 0) + 1), acc), {});
  const summary = `${label}. Day ${Math.round(t)} of 1,000, ${t < birthDay ? `${Math.floor((t + 14) / 7)} weeks pregnant` : `${Math.round(t - birthDay)} days after birth`}. ${Object.entries(counts)
    .map(([k, n]) => `${n} ${STATE_WORD[k as ContactState]}`)
    .join(', ')}.`;
  return (
    <div ref={ref} className={cx('w-full', className)}>
      <svg role="img" aria-label={summary} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
        {/* track: pregnancy then first two years */}
        <line x1={x(0)} x2={x(birthDay) - 3} y1={lineY} y2={lineY} stroke="var(--color-chart-band-strong)" strokeWidth={6} strokeLinecap="round" />
        <line x1={x(birthDay) + 3} x2={x(JOURNEY_END)} y1={lineY} y2={lineY} stroke="var(--color-chart-track)" strokeWidth={6} strokeLinecap="round" />
        {/* progress so far */}
        <line x1={x(0)} x2={x(t)} y1={lineY} y2={lineY} stroke={TONE.brand} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
        {/* birth marker */}
        <line x1={x(birthDay)} x2={x(birthDay)} y1={lineY - 10} y2={lineY + 10} stroke="var(--color-fg-tertiary)" strokeWidth={1.5} />
        {contacts.map((c, i) => {
          const cx0 = x(c.day);
          const color = STATE_COLOR[c.state];
          const hollow = c.state === 'upcoming';
          return (
            <g key={`${c.day}-${i}`}>
              {c.state === 'overdue' ? <circle cx={cx0} cy={lineY} r={9} fill={color} opacity={0.22} /> : null}
              <circle cx={cx0} cy={lineY} r={c.state === 'due' || c.state === 'overdue' ? 5.5 : 4.5} fill={hollow ? SURFACE : color} stroke={hollow ? color : SURFACE} strokeWidth={2}>
                <title>{`${c.label}: ${STATE_WORD[c.state]}`}</title>
              </circle>
            </g>
          );
        })}
        {/* today */}
        <g>
          <line x1={x(t)} x2={x(t)} y1={lineY - 14} y2={lineY - 8} stroke="var(--color-fg-primary)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={x(t)} cy={lineY} r={7} fill="var(--color-fg-primary)" stroke={SURFACE} strokeWidth={3} />
        </g>
        {!compact ? (
          <g fontSize={11} fill="var(--color-chart-axis)">
            <text x={x(0)} y={height - 4}>
              Conception
            </text>
            <text x={x(birthDay)} y={height - 4} textAnchor="middle" fontWeight={600} fill="var(--color-text-secondary)">
              Birth
            </text>
            {width > 420 ? (
              <text x={x(birthDay + 365)} y={height - 4} textAnchor="middle">
                1 year
              </text>
            ) : null}
            <text x={x(JOURNEY_END)} y={height - 4} textAnchor="end">
              Day 1,000
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
