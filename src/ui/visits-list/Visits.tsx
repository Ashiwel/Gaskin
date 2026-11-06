/**
 * Visits: the fortnight across her caseload. Counts first (overdue, today, this week, next week),
 * then the 14-day calendar strip, then the chosen day's contacts, each opening that mother's visit
 * checklist. Overdue contacts are listed apart so none is lost behind a date.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck01, Clock } from '@untitledui/icons';
import { useApp, useWorker } from '../../store';
import { KpiTile } from '../../components/viz';
import { isoDay, daysBetween } from '../format';
import { can } from '../today/access';
import { fortnight, useScopedRows, type DayBucket } from '../today/model';
import { cx } from '../../utils/cx';
import { DayList, FortnightStrip, dayTitle } from '../today/Schedule';
import { SectionHead } from '../today/parts';
import { ScopeSwitch } from '../today/ScopeSwitch';

export function Visits() {
  const { state } = useApp();
  const worker = useWorker();
  const { rows, scope, setScope } = useScopedRows();
  const sched = useMemo(() => fortnight(rows, state.clock), [rows, state.clock]);
  const today = isoDay(state.clock);
  const [day, setDay] = useState(today);
  const canVisit = can(worker, 'visits.start');
  const bucket = sched.days.find((d) => d.date === day);
  const week1 = sched.days.slice(0, 7).reduce((s, d) => s + d.contacts.length, 0);
  const week2 = sched.days.slice(7).reduce((s, d) => s + d.contacts.length, 0);
  const todayCount = sched.days[0]?.contacts.length ?? 0;
  const overdueBucket = { date: today, contacts: sched.overdue, urgent: sched.overdue.length };
  const dayOnly = bucket && day === today ? { ...bucket, contacts: bucket.contacts.filter((c) => !(c.overdueDays > 0 || c.date < today)) } : bucket;

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8" data-testid="visits">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">Visits</h1>
          <p className="mt-1 text-md text-tertiary">
            {week1 + week2} contacts in the next 14 days{sched.overdue.length ? `, ${sched.overdue.length} overdue` : ''}
          </p>
        </div>
        <ScopeSwitch worker={worker} scope={scope} onChange={setScope} />
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile label="Overdue" value={<span className={sched.overdue.length ? 'text-error-primary' : undefined}>{sched.overdue.length}</span>} icon={<AlertTriangle />} />
        <KpiTile label="Today" value={todayCount} icon={<Clock />} />
        <WeekTile label="This week" total={week1} days={sched.days.slice(0, 7)} selected={day} onSelect={setDay} />
        <WeekTile label="Next week" total={week2} days={sched.days.slice(7)} selected={day} onSelect={setDay} />
      </section>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <section aria-labelledby="day-h" className="grid content-start gap-4 lg:col-span-8">
          <div className="min-w-0 rounded-2xl bg-primary p-3 shadow-xs ring-1 ring-secondary ring-inset sm:p-4">
            <FortnightStrip days={sched.days} selected={day} onSelect={setDay} clock={state.clock} />
          </div>
          <SectionHead id="day-h" title={dayTitle(day, state.clock)}>
            {`${dayOnly?.contacts.length ?? 0} due${day !== today ? `, in ${daysBetween(today, day)} days` : ''}`}
          </SectionHead>
          <DayList bucket={dayOnly} canVisit={canVisit} emptyText={day === today && sched.overdue.length ? 'Nothing else is due today.' : undefined} />
        </section>

        <section aria-labelledby="overdue-h" className="grid content-start gap-3 lg:col-span-4">
          <SectionHead id="overdue-h" title="Overdue">
            {sched.overdue.length ? 'Missed contacts, oldest first' : 'Nobody has missed a contact'}
          </SectionHead>
          <div className="rounded-2xl bg-secondary px-3">
            <DayList bucket={{ ...overdueBucket, contacts: [...overdueBucket.contacts].sort((a, b) => b.overdueDays - a.overdueDays) }} canVisit={canVisit} emptyText="All caught up." />
          </div>
        </section>
      </div>
    </div>
  );
}

/** A week as seven small bars (red where any contact is urgent or overdue); a bar picks that day. */
function WeekTile({ label, total, days, selected, onSelect }: { label: string; total: number; days: DayBucket[]; selected: string; onSelect: (d: string) => void }) {
  const max = Math.max(1, ...days.map((d) => d.contacts.length));
  const wd = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' });
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
      <p className="flex items-center gap-2 text-sm font-medium text-tertiary">
        <CalendarCheck01 className="size-4 text-fg-quaternary" aria-hidden="true" />
        {label}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-display-sm font-semibold text-primary">{total}</p>
        <div className="flex h-10 items-end gap-1" role="group" aria-label={`${label}, contacts per day`}>
          {days.map((d) => {
            const n = d.contacts.length;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => onSelect(d.date)}
                aria-label={`${d.date}: ${n} due`}
                aria-pressed={selected === d.date}
                className="flex h-full w-3 cursor-pointer flex-col items-center justify-end gap-0.5 sm:w-4"
              >
                <span
                  className={cx('w-full rounded-sm', n === 0 ? 'bg-tertiary' : d.urgent ? 'bg-error-solid' : selected === d.date ? 'bg-brand-solid' : 'bg-utility-brand-300')}
                  style={{ height: n ? `${Math.max(20, (n / max) * 100)}%` : 3 }}
                />
                <span className={cx('text-[10px] leading-none', selected === d.date ? 'font-semibold text-primary' : 'text-quaternary')}>{wd.format(new Date(`${d.date}T12:00:00Z`))}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
