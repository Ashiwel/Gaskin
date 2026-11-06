import { cx } from '../../utils/cx';
import { fmt, SERIES, TONE, type Tone } from './shared';

export interface StackPart {
  label: string;
  value: number;
  tone?: Tone;
}

export interface StackedBarProps {
  parts: StackPart[];
  label: string;
  /** 'thin' is an 8px meter with no text; 'tall' is 28px with shares printed inside where they fit. */
  size?: 'thin' | 'tall';
  legend?: boolean;
  className?: string;
}

/** One whole split into parts (e.g. caseload by stage, or alerts by severity). */
export function StackedBar({ parts, label, size = 'thin', legend = true, className }: StackedBarProps) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const color = (p: StackPart, i: number) => (p.tone ? TONE[p.tone] : SERIES[i % SERIES.length]);
  const tall = size === 'tall';
  return (
    <div className={cx('w-full', className)}>
      <div
        role="img"
        aria-label={`${label}. ${parts.map((p) => `${p.label} ${fmt(p.value)} (${Math.round((p.value / total) * 100)}%)`).join(', ')}.`}
        className={cx('flex w-full gap-0.5 overflow-hidden', tall ? 'h-7 rounded-md' : 'h-2 rounded-full')}
      >
        {parts.map((p, i) => {
          const share = Math.max(0, p.value) / total;
          if (share <= 0) return null;
          const pct = Math.round(share * 100);
          return (
            <div key={p.label} title={`${p.label}: ${fmt(p.value)} (${pct}%)`} className={cx('flex min-w-0 items-center', tall && 'rounded-sm px-2')} style={{ flexGrow: share, flexBasis: 0, background: color(p, i) }}>
              {tall && share >= 0.12 ? <span className="truncate text-xs font-semibold text-on-fill tnum">{pct}%</span> : null}
            </div>
          );
        })}
      </div>
      {legend ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary">
          {parts.map((p, i) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color(p, i) }} />
              {p.label} <span className="font-medium text-secondary tnum">{fmt(p.value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
