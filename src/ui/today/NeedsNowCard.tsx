/**
 * One mother who needs the worker now: a severity stripe, her initials, stage, where she is in the
 * 1,000 days, the single top reason, a BP or Hb trend when it explains the reason, her children, and
 * one action (Start visit, or Call when she reported danger signs by message).
 */
import { AlertTriangle, CheckCircle, MessageChatCircle, Phone01, PlayCircle } from '@untitledui/icons';
import { Button } from '../../components/base/buttons/button';
import { Sparkline } from '../../components/viz';
import { cx } from '../../utils/cx';
import { useApp } from '../../store';
import { useNav } from '../nav';
import { firstName, relDay, shortReason, stageChip } from '../format';
import { place } from '../format';
import { TRIAGE_LABELS } from '../../store/triage';
import type { CaseRow } from './model';
import { ChildrenChips, Chip, MiniJourney, MotherAvatar, SEVERITY } from './parts';

export function primaryActionFor(r: CaseRow): 'call' | 'visit' {
  const hasPhone = r.mother.phone.access !== 'none' && Boolean(r.mother.phone.number);
  if (!hasPhone) return 'visit';
  return r.triage === 'emergency' || (r.urgency === 'emergency' && r.unread > 0) ? 'call' : 'visit';
}

export function NeedsNowCard({ row: r, lead, canVisit = true }: { row: CaseRow; lead?: boolean; canVisit?: boolean }) {
  const { state } = useApp();
  const { go } = useNav();
  const sev = SEVERITY[r.urgency];
  const stage = stageChip(r.plan.state);
  const action = primaryActionFor(r);
  const child = r.alertChild?.id ?? r.contacts[0]?.childId;
  const acked = r.alert ? state.alertAcks.find((a) => a.motherId === r.mother.id && a.alertId === r.alert!.id) : undefined;
  const ackBy = acked ? state.workers.find((w) => w.id === acked.by)?.name : undefined;
  const danger = r.urgency === 'emergency' || r.triage === 'emergency';
  const nc = r.contacts[0];
  const open = () => go({ name: 'patient', id: r.mother.id, tab: 'plan' });
  const color = lead ? (danger ? 'primary-destructive' : 'primary') : danger ? 'secondary-destructive' : 'secondary';
  const word = r.triage === 'emergency' && r.urgency !== 'emergency' ? TRIAGE_LABELS.emergency : sev.word;

  return (
    <article
      className="row group relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary ring-inset transition duration-150 ease-out hover:shadow-md motion-reduce:transition-none"
      data-mother={r.mother.name}
      data-urgency={r.urgency}
      aria-label={`${r.mother.name}: ${word}. ${r.reason}`}
    >
      <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', sev.stripe)} />
      <div className="flex flex-1 flex-col gap-3 py-4 pr-4 pl-5">
        <header className="flex items-start gap-3">
          <MotherAvatar name={r.mother.name} urgency={r.urgency} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="row-link min-w-0 cursor-pointer truncate text-left text-md font-semibold text-primary outline-focus-ring after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={open}
              >
                {r.mother.name}
                <span className="sr-only">, {place(r.mother)}</span>
              </button>
              {r.unread > 0 ? (
                <span className="relative inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-brand-solid px-1.5 text-xs font-semibold text-on-fill tnum" aria-label={`${r.unread} new message${r.unread === 1 ? '' : 's'}`}>
                  <MessageChatCircle className="size-3" aria-hidden="true" />
                  {r.unread}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip color={stage.color} title={stage.long}>
                {stage.label}
              </Chip>
              <ChildrenChips items={r.children} clock={state.clock} max={3} />
            </div>
          </div>
          <span className={cx('relative inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', sev.soft, sev.text, sev.ring)}>
            {danger ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : null}
            {word}
          </span>
        </header>

        <p className={cx('text-md leading-snug font-medium', danger ? 'text-error-primary' : 'text-primary')}>
          {r.alertChild && r.alert && r.reason === r.alert.title ? <span className="text-tertiary">{firstName(r.alertChild.name)}: </span> : null}
          {shortReason(r.reason)}
        </p>

        <div className="flex items-center gap-3">
          <MiniJourney row={r} className="min-w-0 flex-1" />
          {r.reading ? (
            <div className="flex shrink-0 items-center gap-2" title={r.reading.kind === 'bp' ? 'Blood pressure' : 'Haemoglobin'}>
              <div className="w-16">
                <Sparkline values={r.reading.values} label={r.reading.kind === 'bp' ? 'Systolic blood pressure' : 'Haemoglobin'} tone={r.reading.tone} height={24} area={false} />
              </div>
              <span className="text-right leading-none">
                <span className={cx('block text-sm font-semibold tnum', r.reading.tone === 'danger' ? 'text-error-primary' : r.reading.tone === 'warning' ? 'text-warning-primary' : 'text-primary')}>{r.reading.latest}</span>
                <span className="text-[11px] text-quaternary">{r.reading.kind === 'bp' ? 'BP' : 'Hb'}</span>
              </span>
            </div>
          ) : null}
        </div>

        <footer className="relative mt-auto flex items-center gap-2 pt-1">
          <span className="min-w-0 flex-1 truncate text-xs text-tertiary">
            {acked ? (
              <span className="inline-flex items-center gap-1 text-success-primary">
                <CheckCircle className="size-3.5" aria-hidden="true" /> Seen by {ackBy ? firstName(ackBy) : 'a colleague'}
              </span>
            ) : nc ? (
              <>
                {nc.childName ? `${firstName(nc.childName)}: ` : ''}
                {nc.overdueDays > 0 ? <span className="font-medium text-warning-primary">{nc.overdueDays} days late</span> : relDay(nc.date, state.clock).replace(/^./, (c) => c.toUpperCase())}
              </>
            ) : null}
          </span>
          {action === 'call' ? (
            <Button size="sm" color={color} iconLeading={Phone01} href={`tel:${r.mother.phone.number}`} aria-label={`Call ${firstName(r.mother.name)}`}>
              Call {firstName(r.mother.name)}
            </Button>
          ) : canVisit ? (
            <Button size="sm" color={color} iconLeading={PlayCircle} onClick={() => go({ name: 'visit', id: r.mother.id, childId: child })} data-testid="card-start-visit">
              Start visit
            </Button>
          ) : (
            <Button size="sm" color="secondary" onClick={open}>
              Open record
            </Button>
          )}
        </footer>
      </div>
    </article>
  );
}
