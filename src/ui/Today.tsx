/**
 * Today: a health worker's morning. Who needs her now, what is due this fortnight, what changed
 * overnight, the replies mothers sent, and everyone else. Pictures before lists: the caseload as
 * one split bar, each urgent mother as a card with her journey and readings, the fortnight as a
 * calendar strip. In personal mode the same route is "My day" for one mother.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, MessageChatCircle, RefreshCw01, UserPlus01 } from '@untitledui/icons';
import type { JourneyStage } from '../types';
import { useApp, useWorker } from '../store';
import { Button } from '../components/base/buttons/button';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { firstName, fmtDate, greeting, isoDay, STAGE_LABELS } from './format';
import { can, personalMotherId, usePersonalMode, type Scope } from './today/access';
import { fortnight, isNeedsNow, useAllRows, useOvernight, useReplies, useScopedRows, type CaseRow } from './today/model';
import { CaseloadSummary, countCaseload } from './today/CaseloadSummary';
import { NeedsNowCard } from './today/NeedsNowCard';
import { Replies } from './today/Replies';
import { CaseList } from './today/CaseList';
import { DayList, FortnightStrip, dayTitle } from './today/Schedule';
import { MyDay } from './today/MyDay';
import { FilterChip, MotherAvatar, SectionHead } from './today/parts';

export type { CaseRow } from './today/model';
export { unreadFor } from './today/model';

/** Every mother on this device, most urgent first (the shell uses it for badges and notifications). */
export function useCaseload(): CaseRow[] {
  return useAllRows();
}

type RiskFilter = 'all' | 'alerts' | 'high' | 'messages';

export const SCOPE_LABEL: Record<Scope, string> = { mine: 'mothers in your care', facility: 'mothers at your facility', all: 'mothers on this device' };

export function Today() {
  const personal = usePersonalMode();
  const { state } = useApp();
  const all = useAllRows();
  if (personal) {
    const id = personalMotherId(state.mothers);
    const row = all.find((r) => r.mother.id === id);
    if (row) return <MyDay row={row} />;
  }
  return <WorkerToday />;
}

function WorkerToday() {
  const { state } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const { rows, scope } = useScopedRows();
  const replies = useReplies(rows);
  const overnight = useOvernight(rows);
  const counts = useMemo(() => countCaseload(rows, state.clock), [rows, state.clock]);
  const sched = useMemo(() => fortnight(rows, state.clock), [rows, state.clock]);
  const today = isoDay(state.clock);
  const [day, setDay] = useState(today);
  const [stage, setStage] = useState<JourneyStage | 'all'>('all');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [showAllNow, setShowAllNow] = useState(false);
  const canVisit = can(worker, 'visits.start');
  const canRegister = can(worker, 'mothers.register');
  const facility = state.facilities.find((f) => f.id === worker?.facilityId);

  const now = rows.filter(isNeedsNow);
  const nowShown = showAllNow ? now : now.slice(0, 6);
  const rest = rows.filter((r) => !isNeedsNow(r));
  const filtered = rest.filter((r) => {
    if (stage !== 'all' && r.plan.state.stage !== stage) return false;
    if (risk === 'alerts' && r.plan.alerts.length === 0) return false;
    if (risk === 'high' && r.riskLevel !== 'high' && r.riskLevel !== 'danger') return false;
    if (risk === 'messages' && r.unread === 0) return false;
    return true;
  });
  const dangerNow = now.filter((r) => r.urgency === 'emergency' || r.triage === 'emergency').length;
  const bucket = sched.days.find((d) => d.date === day);

  let headline: string;
  if (dangerNow > 0) headline = `${dangerNow === 1 ? 'One mother needs' : `${dangerNow} mothers need`} you now`;
  else if (now.length > 0) headline = now.length === 1 ? 'One mother to see today' : `${now.length} mothers to see today`;
  else headline = 'Everyone is on track';

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8" data-testid="today">
      {/* 1. Greeting, the date, who is acting, and what changed overnight */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-tertiary">
            <span>{fmtDate(state.clock, { weekday: true, year: true })}</span>
            {worker ? (
              <>
                <span aria-hidden="true">·</span>
                <MotherAvatar name={worker.name} size="sm" className="size-5 text-[10px]" />
                <span className="truncate">
                  {firstName(worker.name)}
                  {facility ? <span className="hidden sm:inline">, {facility.name}</span> : null}
                </span>
              </>
            ) : null}
          </p>
          <h1 className="mt-1 text-display-xs font-semibold text-primary lg:text-display-sm">
            <span className="sr-only">{greeting(state.clock)}, {worker ? firstName(worker.name) : ''}. </span>
            {headline}
          </h1>
          <Overnight o={overnight} replies={replies.length} />
        </div>
        {canRegister ? (
          <Button color="secondary" size="md" iconLeading={UserPlus01} onClick={() => go({ name: 'register' })} className="hidden sm:inline-flex">
            Register a mother
          </Button>
        ) : null}
      </header>

      {/* 2. The caseload as one picture */}
      <CaseloadSummary
        counts={counts}
        scopeLabel={SCOPE_LABEL[scope]}
        onPick={(k) => {
          if (k === 'upcoming' || k === 'due') document.getElementById('fortnight-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else if (k === 'well') document.getElementById('everyone-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else document.getElementById('now-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        {/* 3. Needs you now */}
        <section aria-labelledby="now-h" className="grid content-start gap-4 lg:col-span-8">
          <SectionHead id="now-h" title="Needs you now">
            {now.length ? 'Danger signs first, then missed and due contacts' : 'Nobody has an alert or a contact due today'}
          </SectionHead>
          {now.length ? (
            <div className={cx('queue grid gap-3', now.length > 1 && 'sm:grid-cols-2')} data-testid="needs-now">
              {nowShown.map((r, i) => (
                <NeedsNowCard key={r.mother.id} row={r} lead={i === 0} canVisit={canVisit} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-success-primary p-5 text-md text-success-primary">Everyone in your care is on track today.</div>
          )}
          {now.length > nowShown.length ? (
            <div>
              <Button color="link-color" size="md" onClick={() => setShowAllNow(true)}>
                {`Show ${now.length - nowShown.length} more`}
              </Button>
            </div>
          ) : null}
        </section>

        {/* 4. The fortnight */}
        <section aria-labelledby="fortnight-h" className="grid content-start gap-4 lg:col-span-4">
          <SectionHead id="fortnight-h" title="Next 14 days">
            {sched.overdue.length ? <span className="text-warning-primary">{sched.overdue.length} overdue, gathered on today</span> : `${sched.days.reduce((s, d) => s + d.contacts.length, 0)} contacts due`}
          </SectionHead>
          <div className="min-w-0 rounded-2xl bg-primary p-3 shadow-xs ring-1 ring-secondary ring-inset">
            <FortnightStrip days={sched.days} selected={day} onSelect={setDay} clock={state.clock} />
            <h3 className="mt-3 px-1 text-sm font-semibold text-primary">{dayTitle(day, state.clock)}</h3>
            <div className="px-1">
              <DayList bucket={bucket} canVisit={canVisit} compact />
            </div>
          </div>
        </section>
      </div>

      {/* 5. Replies, triaged */}
      <Replies replies={replies} />

      {/* 6. Everyone else */}
      <section aria-labelledby="everyone-h" className="grid gap-3">
        <SectionHead id="everyone-h" title="Everyone else">
          {`${rest.length} on track or with a contact later`}
        </SectionHead>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filters">
          {(['all', 'pregnancy', 'postpartum', 'infant', 'preconception'] as const).map((s) => (
            <FilterChip key={s} pressed={stage === s} onClick={() => setStage(s)} count={s === 'all' ? rest.length : rest.filter((r) => r.plan.state.stage === s).length}>
              {s === 'all' ? 'All' : STAGE_LABELS[s]}
            </FilterChip>
          ))}
          <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border-secondary" />
          <FilterChip pressed={risk === 'alerts'} onClick={() => setRisk(risk === 'alerts' ? 'all' : 'alerts')} tone="warning">
            Alerts
          </FilterChip>
          <FilterChip pressed={risk === 'high'} onClick={() => setRisk(risk === 'high' ? 'all' : 'high')} tone="error">
            High risk
          </FilterChip>
          <FilterChip pressed={risk === 'messages'} onClick={() => setRisk(risk === 'messages' ? 'all' : 'messages')}>
            New messages
          </FilterChip>
        </div>
        {filtered.length ? (
          <CaseList rows={filtered} label="Everyone else" />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary py-10 text-center">
            <p className="text-sm text-tertiary">No one matches these filters.</p>
            <Button
              color="link-color"
              size="sm"
              onClick={() => {
                setStage('all');
                setRisk('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      {canRegister ? (
        <div className="sm:hidden">
          <Button color="secondary" size="lg" iconLeading={UserPlus01} onClick={() => go({ name: 'register' })} className="w-full">
            Register a mother
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** What changed since yesterday, as three small pills. */
function Overnight({ o, replies }: { o: ReturnType<typeof useOvernight>; replies: number }) {
  const items = [
    o.newAlerts ? { icon: AlertTriangle, n: o.newAlerts, word: o.newAlerts === 1 ? 'new alert' : 'new alerts', tone: 'text-error-primary' } : null,
    replies ? { icon: MessageChatCircle, n: replies, word: replies === 1 ? 'unread reply' : 'unread replies', tone: 'text-brand-secondary' } : null,
    o.plansChanged ? { icon: RefreshCw01, n: o.plansChanged, word: o.plansChanged === 1 ? 'plan updated' : 'plans updated', tone: 'text-secondary' } : null,
  ].filter(Boolean) as Array<{ icon: typeof AlertTriangle; n: number; word: string; tone: string }>;
  if (!items.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Since yesterday">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li key={it.word} className={cx('inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-medium', it.tone)}>
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="tnum">{it.n}</span>
            <span className="text-tertiary">{it.word}</span>
          </li>
        );
      })}
    </ul>
  );
}
