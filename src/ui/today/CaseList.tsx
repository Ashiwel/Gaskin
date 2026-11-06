/**
 * A compact list of mothers: initials, name, stage, a mini journey, next contact and children.
 * Rows sit on the page with dividers (no cards in cards); each opens her record.
 */
import { ChevronRight, MessageChatCircle } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import { useApp } from '../../store';
import { useNav } from '../nav';
import { firstName, relDay, stageChip } from '../format';
import { place } from '../format';
import type { CaseRow } from './model';
import { ChildrenChips, Chip, MiniJourney, MotherAvatar, SEVERITY } from './parts';

export function CaseList({ rows, label, showLanguage, numbered }: { rows: CaseRow[]; label: string; showLanguage?: (r: CaseRow) => string; numbered?: boolean }) {
  const { state } = useApp();
  const { go } = useNav();
  return (
    <ol className="queue divide-y divide-border-secondary" aria-label={label}>
      {rows.map((r, i) => {
        const stage = stageChip(r.plan.state);
        const nc = r.contacts[0];
        const sev = SEVERITY[r.urgency];
        const late = nc && nc.overdueDays > 0;
        return (
          <li key={r.mother.id}>
            <div
              className="row group relative grid min-h-16 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-1 hover:bg-primary_hover sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] sm:gap-4 sm:px-2"
              data-mother={r.mother.name}
              data-urgency={r.urgency}
              onClick={() => go({ name: 'patient', id: r.mother.id, tab: 'plan' })}
            >
              <span className="flex items-center gap-2">
                {numbered ? <span className="hidden w-5 text-right text-xs text-quaternary tnum sm:inline">{i + 1}</span> : null}
                <MotherAvatar name={r.mother.name} urgency={r.urgency === 'emergency' || r.urgency === 'urgent' ? r.urgency : undefined} size="md" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className="row-link min-w-0 cursor-pointer truncate text-left text-sm font-semibold text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      go({ name: 'patient', id: r.mother.id, tab: 'plan' });
                    }}
                  >
                    {r.mother.name}
                    <span className="sr-only">, {place(r.mother)}</span>
                  </button>
                  {r.unread ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-secondary tnum" aria-label={`${r.unread} new messages`}>
                      <MessageChatCircle className="size-3.5" aria-hidden="true" />
                      {r.unread}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Chip color={stage.color} title={stage.long}>
                    {stage.label}
                  </Chip>
                  {r.urgency !== 'rest' ? (
                    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', sev.text)}>
                      <span aria-hidden="true" className={cx('size-1.5 rounded-full', sev.dot)} />
                      {sev.word}
                    </span>
                  ) : r.riskLevel === 'high' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-primary">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-solid" />
                      High risk
                    </span>
                  ) : null}
                  {showLanguage ? <span className="text-xs text-tertiary sm:hidden">{showLanguage(r)}</span> : null}
                  <span className="sm:hidden">
                    <ChildrenChips items={r.children} clock={state.clock} max={2} />
                  </span>
                </span>
              </span>
              <span className="hidden min-w-0 flex-col gap-1.5 sm:flex">
                <MiniJourney row={r} />
                <span className="flex flex-wrap items-center gap-1.5">
                  <ChildrenChips items={r.children} clock={state.clock} max={3} />
                  {showLanguage ? <span className="text-xs text-tertiary">{showLanguage(r)}</span> : null}
                </span>
              </span>
              <span className="hidden min-w-0 text-sm sm:block">
                {nc ? (
                  <>
                    <span className={cx('block font-medium', late ? 'text-warning-primary' : 'text-secondary')}>{late ? `${nc.overdueDays} days late` : relDay(nc.date, state.clock).replace(/^./, (c) => c.toUpperCase())}</span>
                    <span className="block truncate text-xs text-tertiary">
                      {nc.childName ? `${firstName(nc.childName)}: ` : ''}
                      {nc.label}
                    </span>
                  </>
                ) : (
                  <span className="text-tertiary">No contact booked</span>
                )}
              </span>
              <span className="flex items-center gap-2 text-right">
                <span className="text-xs font-medium text-tertiary sm:hidden">{nc ? (late ? <span className="text-warning-primary">Late</span> : relDay(nc.date, state.clock).replace(/^in /, '')) : ''}</span>
                <ChevronRight className="size-4 text-fg-quaternary" aria-hidden="true" />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
