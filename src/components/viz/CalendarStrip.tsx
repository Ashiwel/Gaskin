import { cx } from '../../utils/cx';

export interface CalendarDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Contacts due that day. */
  due: number;
  /** Of which overdue or danger (shown red). */
  urgent?: number;
}

export interface CalendarStripProps {
  /** ISO date of today; the strip starts here. */
  start: string;
  days: CalendarDay[];
  /** Number of days shown (default 14). */
  span?: number;
  selected?: string;
  onSelect?: (date: string) => void;
  /** BCP 47 locale for weekday names. */
  locale?: string;
  label?: string;
  className?: string;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The next 14 days as a scrollable row of day chips. Each chip shows the weekday, the date and a
 * small bar for the contacts due, red when any is overdue or urgent. Keyboard: Tab to the strip,
 * arrow keys move between days.
 */
export function CalendarStrip({ start, days, span = 14, selected, onSelect, locale = 'en-GB', label = 'Contacts due in the next 14 days', className }: CalendarStripProps) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const max = Math.max(1, ...days.map((d) => d.due));
  const wd = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const list = Array.from({ length: span }, (_, i) => addDays(start, i));
  return (
    <div
      role="listbox"
      aria-label={label}
      aria-orientation="horizontal"
      className={cx('scrollbar-hide -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 py-1', className)}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const btns = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role=option]'));
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
        next?.focus();
        e.preventDefault();
      }}
    >
      {list.map((iso, i) => {
        const d = byDate.get(iso);
        const due = d?.due ?? 0;
        const urgent = d?.urgent ?? 0;
        const isSel = selected === iso;
        const isToday = i === 0;
        const date = new Date(`${iso}T12:00:00Z`);
        return (
          <button
            key={iso}
            type="button"
            role="option"
            aria-selected={isSel}
            tabIndex={isSel || (!selected && isToday) ? 0 : -1}
            aria-label={`${new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)}: ${due} due${urgent ? `, ${urgent} urgent` : ''}`}
            onClick={() => onSelect?.(iso)}
            className={cx(
              'flex w-12 shrink-0 snap-start flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-2 outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2',
              isSel ? 'bg-brand-solid text-primary_on-brand' : 'bg-primary text-secondary ring-1 ring-secondary ring-inset hover:bg-primary_hover',
            )}
          >
            <span className={cx('text-xs font-medium', isSel ? 'text-secondary_on-brand' : 'text-tertiary')}>{isToday ? 'Today' : wd.format(date)}</span>
            <span className={cx('text-md font-semibold tnum', isSel ? 'text-primary_on-brand' : 'text-primary')}>{date.getUTCDate()}</span>
            <span aria-hidden="true" className={cx('flex h-6 w-1.5 items-end overflow-hidden rounded-full', isSel ? 'bg-brand-section_subtle' : 'bg-tertiary')}>
              <span
                className={cx('w-full rounded-full', urgent ? 'bg-error-solid' : isSel ? 'bg-primary' : 'bg-brand-solid')}
                style={{ height: due ? `${Math.max(18, (due / max) * 100)}%` : 0 }}
              />
            </span>
            <span className={cx('text-xs font-medium tnum', isSel ? 'text-primary_on-brand' : due ? 'text-secondary' : 'text-quaternary')}>{due || '·'}</span>
          </button>
        );
      })}
    </div>
  );
}
