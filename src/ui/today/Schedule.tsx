/**
 * The fortnight: a 14-day calendar strip of contacts due (red where any is overdue or urgent),
 * and the list for the chosen day. Used on Today (compact) and as the whole Visits screen.
 */
import { CalendarCheck01, PlayCircle } from '@untitledui/icons';
import { Button } from '../../components/base/buttons/button';
import { CalendarStrip } from '../../components/viz';
import { cx } from '../../utils/cx';
import { useApp } from '../../store';
import { useNav } from '../nav';
import { firstName, fmtDate, isoDay, stageChip } from '../format';
import type { DayBucket, DueContact, CaseRow } from './model';
import { Chip, MotherAvatar, SEVERITY } from './parts';

const KIND_LABEL: Record<DueContact['kind'], string> = { anc: 'Pregnancy', pnc: 'After birth', child: 'Child', home: 'Home visit' };

export function dayTitle(date: string, clock: string): string {
  const today = isoDay(clock);
  if (date === today) return 'Today';
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  if (date === d.toISOString().slice(0, 10)) return 'Tomorrow';
  return fmtDate(date, { weekday: true });
}

export function FortnightStrip({ days, selected, onSelect, clock }: { days: DayBucket[]; selected: string; onSelect: (d: string) => void; clock: string }) {
  return (
    <CalendarStrip
      start={isoDay(clock)}
      days={days.map((d) => ({ date: d.date, due: d.contacts.length, urgent: d.urgent }))}
      selected={selected}
      onSelect={onSelect}
      label="Contacts due in the next 14 days"
    />
  );
}

/** Contacts on one day, as rows: who, what, how late, and Start visit. */
export function DayList({ bucket, canVisit = true, compact, emptyText }: { bucket?: DayBucket; canVisit?: boolean; compact?: boolean; emptyText?: string }) {
  const { state } = useApp();
  const { go } = useNav();
  const items = bucket?.contacts ?? [];
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CalendarCheck01 className="size-6 text-fg-quaternary" aria-hidden="true" />
        <p className="text-sm text-tertiary">{emptyText ?? 'No contacts due on this day.'}</p>
      </div>
    );
  }
  const shown = compact ? items.slice(0, 6) : items;
  return (
    <ul className="divide-y divide-border-secondary" aria-label={bucket ? `Due ${dayTitle(bucket.date, state.clock).toLowerCase()}` : 'Due'}>
      {shown.map((c, i) => (
        <ContactRow key={`${c.motherId}-${c.childId ?? 'm'}-${i}`} c={c} row={c.row} canVisit={canVisit} onOpen={() => go({ name: 'patient', id: c.motherId, tab: 'plan' })} onVisit={() => go({ name: 'visit', id: c.motherId, childId: c.childId })} />
      ))}
      {compact && items.length > shown.length ? (
        <li className="pt-3">
          <Button color="link-color" size="sm" onClick={() => go({ name: 'visits' })}>
            {`See all ${items.length} in Visits`}
          </Button>
        </li>
      ) : null}
    </ul>
  );
}

function ContactRow({ c, row, canVisit, onOpen, onVisit }: { c: DueContact; row: CaseRow; canVisit: boolean; onOpen: () => void; onVisit: () => void }) {
  const stage = stageChip(row.plan.state);
  const sev = SEVERITY[row.urgency];
  const danger = row.urgency === 'emergency' || row.urgency === 'urgent';
  return (
    <li className="flex min-h-16 items-center gap-3 py-3" data-mother={row.mother.name} data-testid="due-row">
      <MotherAvatar name={row.mother.name} urgency={danger ? row.urgency : undefined} size="sm" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-primary">{row.mother.name}</span>
          {c.childName ? (
            <Chip color="blue" title={`For ${c.childName}`}>
              {firstName(c.childName)}
            </Chip>
          ) : (
            <Chip color={stage.color}>{stage.label}</Chip>
          )}
        </span>
        <span className="mt-0.5 flex items-start gap-1.5 text-xs text-tertiary">
          {danger ? (
            <span className={cx('font-semibold', sev.text)}>{sev.word}:</span>
          ) : c.overdueDays > 0 ? (
            <span className="font-semibold text-warning-primary">{c.overdueDays} days late:</span>
          ) : (
            <span className="sr-only">{KIND_LABEL[c.kind]}:</span>
          )}
          <span className="min-w-0 break-words">{c.label}</span>
        </span>
      </button>
      {canVisit ? (
        <Button size="sm" color="tertiary" iconLeading={PlayCircle} onClick={onVisit} aria-label={`Start visit for ${row.mother.name}`}>
          <span className="hidden sm:inline">Start</span>
        </Button>
      ) : null}
    </li>
  );
}
