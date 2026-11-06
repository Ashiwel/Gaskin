/**
 * Her caseload in one line: the total, then one bar split by what each mother needs
 * (emergency, urgent, due today, coming up in the fortnight, well), with the counts beneath.
 */
import { cx } from '../../utils/cx';
import { daysBetween, isoDay } from '../format';
import type { CaseRow } from './model';

export interface CaseloadCounts {
  emergency: number;
  urgent: number;
  due: number;
  upcoming: number;
  well: number;
  total: number;
}

export function countCaseload(rows: CaseRow[], clock: string): CaseloadCounts {
  const today = isoDay(clock);
  const c: CaseloadCounts = { emergency: 0, urgent: 0, due: 0, upcoming: 0, well: 0, total: rows.length };
  for (const r of rows) {
    if (r.urgency === 'emergency') c.emergency++;
    else if (r.urgency === 'urgent') c.urgent++;
    else if (r.urgency === 'overdue' || r.urgency === 'today') c.due++;
    else if (r.contacts.some((x) => daysBetween(today, x.date) <= 14)) c.upcoming++;
    else c.well++;
  }
  return c;
}

const PARTS: Array<{ key: keyof Omit<CaseloadCounts, 'total'>; label: string; fill: string; dot: string }> = [
  { key: 'emergency', label: 'Emergency', fill: 'bg-error-solid', dot: 'bg-error-solid' },
  { key: 'urgent', label: 'Urgent', fill: 'bg-warning-solid', dot: 'bg-warning-solid' },
  { key: 'due', label: 'Due today', fill: 'bg-brand-solid', dot: 'bg-brand-solid' },
  { key: 'upcoming', label: 'Next 2 weeks', fill: 'bg-utility-brand-300', dot: 'bg-utility-brand-300' },
  { key: 'well', label: 'Well', fill: 'bg-quaternary', dot: 'bg-quaternary' },
];

export function CaseloadSummary({ counts, scopeLabel, onPick }: { counts: CaseloadCounts; scopeLabel: string; onPick?: (k: keyof Omit<CaseloadCounts, 'total'>) => void }) {
  const total = counts.total || 1;
  const described = PARTS.map((p) => `${counts[p.key]} ${p.label.toLowerCase()}`).join(', ');
  return (
    <section aria-label="Caseload" className="rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex items-baseline gap-2 lg:w-40 lg:shrink-0 lg:flex-col lg:items-start lg:gap-0">
          <span className="text-display-md font-semibold text-primary tnum">{counts.total}</span>
          <span className="text-sm text-tertiary">{scopeLabel}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div role="img" aria-label={`Caseload of ${counts.total}: ${described}.`} className="flex h-3 w-full gap-1 overflow-hidden rounded-full">
            {PARTS.map((p) =>
              counts[p.key] > 0 ? <span key={p.key} className={cx('h-full min-w-1.5 rounded-full', p.fill)} style={{ flexGrow: counts[p.key] / total, flexBasis: 0 }} /> : null,
            )}
          </div>
          <ul className="mt-3 grid grid-cols-5 gap-1 sm:gap-3">
            {PARTS.map((p) => {
              const n = counts[p.key];
              const body = (
                <>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', p.dot)} />
                    <span className={cx('text-lg font-semibold tnum sm:text-xl', n === 0 ? 'text-quaternary' : p.key === 'emergency' ? 'text-error-primary' : 'text-primary')}>{n}</span>
                  </span>
                  <span className="text-[11px] leading-tight text-tertiary sm:text-xs">{p.label}</span>
                </>
              );
              return (
                <li key={p.key} className="min-w-0">
                  {onPick && n > 0 ? (
                    <button type="button" onClick={() => onPick(p.key)} className="flex w-full min-w-0 cursor-pointer flex-col items-start rounded-lg px-1 py-1 text-left hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-focus-ring">
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-col items-start px-1 py-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
