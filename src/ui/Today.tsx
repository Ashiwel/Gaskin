import { useMemo, useState } from 'react';
import type { CarePlan, CountryCode, Mother, JourneyStage } from '../types';
import { useApp, usePlans, useWorker } from '../store';
import { useNav } from './nav';
import { IPlus, ISearch } from './icons';
import { Empty } from './components';
import {
  place,
  daysBetween,
  fmtDate,
  relDay,
  stageLine,
  STAGE_LABELS,
  topAlert,
  urgencyOf,
  URGENCY_LABELS,
  URGENCY_RANK,
  type Urgency,
} from './format';
import { COUNTRIES } from '../data';
import { TRIAGE_LABELS, type TriageTier } from '../store/triage';
import { cn } from './animata/cn';

const DOT: Partial<Record<Urgency, string>> = { emergency: 'bg-red', urgent: 'bg-amber', overdue: 'bg-clay', today: 'bg-green' };

export interface CaseRow {
  mother: Mother;
  plan: CarePlan;
  urgency: Urgency;
  score: number;
  reason: string;
  unread: number;
  triage?: TriageTier;
}

export function unreadFor(motherId: string, inbound: { motherId: string; receivedAt: string }[], readAt?: string): number {
  return inbound.filter((m) => m.motherId === motherId && (!readAt || m.receivedAt > readAt)).length;
}

export function useCaseload(): CaseRow[] {
  const { state } = useApp();
  const plans = usePlans();
  return useMemo(() => {
    const rows: CaseRow[] = [];
    for (const m of state.mothers) {
      const plan = plans.get(m.id);
      if (!plan) continue;
      const urgency = urgencyOf(plan, state.clock);
      const cp = plan.state.contactPriority;
      const a = topAlert(plan.alerts);
      let reason = cp?.reasons?.[0] ?? '';
      if (!reason) {
        if (a) reason = a.title;
        else if (plan.nextContact) {
          const d = daysBetween(state.clock, plan.nextContact.date);
          reason = d < 0 ? `${plan.nextContact.label} was due ${relDay(plan.nextContact.date, state.clock)}` : `${plan.nextContact.label}, ${relDay(plan.nextContact.date, state.clock)}`;
        } else reason = plan.summary;
      }
      // Alerts always lead, whatever the score says.
      if (a && (a.level === 'emergency' || a.level === 'urgent') && cp?.reasons?.[0] && !cp.reasons[0].toLowerCase().includes(a.title.toLowerCase().slice(0, 12))) {
        reason = a.title;
      }
      const readAt = state.readInbound[m.id];
      const unreadMsgs = state.inbound.filter((x) => x.motherId === m.id && (!readAt || x.receivedAt > readAt));
      const tiers = unreadMsgs.map((x) => state.inboundTriage[x.id]).filter(Boolean) as TriageTier[];
      const triage = tiers.includes('emergency') ? 'emergency' : tiers.includes('same_day') ? 'same_day' : tiers.length ? 'next_contact' : undefined;
      // An unread message with danger signs lifts her up, even before anyone has opened it.
      let u = urgency;
      if (triage === 'emergency' && URGENCY_RANK[u] > URGENCY_RANK.urgent) {
        u = 'urgent';
        reason = 'She reported danger signs by message';
      }
      rows.push({ mother: m, plan, urgency: u, score: cp?.score ?? 0, reason, unread: unreadMsgs.length, triage });
    }
    rows.sort((a, b) => {
      const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (u) return u;
      if (b.score !== a.score) return b.score - a.score;
      const da = a.plan.nextContact?.date ?? '9999';
      const db = b.plan.nextContact?.date ?? '9999';
      return da < db ? -1 : da > db ? 1 : a.mother.name.localeCompare(b.mother.name);
    });
    return rows;
  }, [state.mothers, state.clock, state.inbound, state.readInbound, state.inboundTriage, plans]);
}

type RiskFilter = 'all' | 'alerts' | 'high' | 'messages';

export function Today() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const all = useCaseload();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<JourneyStage | 'all'>('all');
  const [risk, setRisk] = useState<RiskFilter>('all');

  const rows = all.filter((r) => {
    if (state.country !== 'ALL' && r.mother.country !== state.country) return false;
    if (stage !== 'all' && r.plan.state.stage !== stage) return false;
    if (risk === 'alerts' && r.plan.alerts.length === 0) return false;
    if (risk === 'high' && !r.plan.state.risks.some((k) => k.severity === 'high' || k.severity === 'urgent')) return false;
    if (risk === 'messages' && r.unread === 0) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const hay = `${r.mother.name} ${r.mother.community} ${r.mother.region}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const inCountry = all.filter((r) => state.country === 'ALL' || r.mother.country === state.country);
  const counts = {
    emergency: inCountry.filter((r) => r.urgency === 'emergency').length,
    urgent: inCountry.filter((r) => r.urgency === 'urgent').length,
    overdue: inCountry.filter((r) => r.urgency === 'overdue').length,
    today: inCountry.filter((r) => r.urgency === 'today').length,
  };
  const needNow = counts.emergency + counts.urgent;

  let headline: string;
  if (needNow > 0) headline = `${needNow === 1 ? 'One mother needs' : `${needNow} mothers need`} you now.`;
  else if (counts.overdue + counts.today > 0) headline = `${counts.overdue + counts.today} to see today.`;
  else headline = 'Everyone is on track.';

  let lastGroup: Urgency | null = null;

  return (
    <div className="page">
      <header className="today-head">
        <p className="date">
          {fmtDate(state.clock, { weekday: true, year: true })} · {worker ? `${worker.name}` : ''}
        </p>
        <h1 className="t-display">{headline}</h1>
        <p className="lede">
          Who to see next, ranked by danger signs first, then missed and due contacts.
          {counts.overdue ? ` ${counts.overdue} overdue.` : ''}
        </p>
      </header>

      <div className="toolbar">
        <div className="btn-row">
          <label className="search" style={{ flex: '1 1 260px' }}>
            <ISearch />
            <span className="sr">Search mothers</span>
            <input id="search" className="input" placeholder="Search by name or community" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="btn" onClick={() => go({ name: 'register' })}>
            <IPlus /> Register a mother
          </button>
        </div>
        <div className="filters" role="group" aria-label="Filters">
          <div className="group">
            <span className="group-label">Stage</span>
            {(['all', 'pregnancy', 'postpartum', 'infant', 'preconception'] as const).map((s) => (
              <button key={s} className="filter-chip" aria-pressed={stage === s} onClick={() => setStage(s)}>
                {s === 'all' ? 'All' : STAGE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="group">
            <span className="group-label">Show</span>
            {(
              [
                ['all', 'Everyone'],
                ['alerts', 'Alerts'],
                ['high', 'High risk'],
                ['messages', 'New messages'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className="filter-chip" aria-pressed={risk === k} onClick={() => setRisk(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="group">
            <span className="group-label">Country</span>
            {(['ALL', 'NG', 'KE', 'GH'] as const).map((c) => (
              <button key={c} className="filter-chip" aria-pressed={state.country === c} onClick={() => dispatch({ type: 'setCountry', country: c })}>
                {c === 'ALL' ? 'All' : (COUNTRIES[c as CountryCode]?.name ?? c)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty art="calendar" title="No one matches these filters">
          <button className="link-btn" onClick={() => { setQ(''); setStage('all'); setRisk('all'); }}>
            Clear filters
          </button>
        </Empty>
      ) : (
        <ol className="queue m-0 list-none border-t border-line p-0" aria-label="Who to see next">
          {rows.map((r, i) => {
            const showGroup = r.urgency !== lastGroup;
            lastGroup = r.urgency;
            const risks = r.plan.state.risks.filter((k) => k.severity !== 'low').slice(0, 3);
            const nc = r.plan.nextContact;
            return (
              <li key={r.mother.id}>
                {showGroup ? (
                  <div className="flex items-center gap-2 pt-[22px] pb-1.5 text-[13px] font-semibold text-ink-3">
                    <span aria-hidden="true" className={cn('h-3.5 w-[3px] rounded-[2px]', DOT[r.urgency] ?? 'bg-line-2')} />
                    {URGENCY_LABELS[r.urgency]}
                  </div>
                ) : null}
                <div
                  className={`row lv-${r.urgency} grid w-full cursor-pointer grid-cols-[20px_minmax(0,1fr)] items-start gap-2.5 border-b border-line py-4 pr-2 pl-1.5 text-left transition-colors duration-150 hover:bg-card motion-reduce:transition-none sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:gap-3.5`}
                  data-mother={r.mother.name}
                  onClick={() => go({ name: 'patient', id: r.mother.id, tab: 'plan' })}
                >
                  <span className="text-right font-serif text-[15px] leading-[1.4] text-ink-3 tabular-nums sm:text-[18px]">{i + 1}</span>
                  <span className="grid min-w-0 gap-1">
                    <span className="flex flex-wrap items-baseline gap-2 font-serif text-[19px] leading-tight font-medium">
                      <button className="row-link cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [font:inherit]" onClick={(e) => { e.stopPropagation(); go({ name: 'patient', id: r.mother.id, tab: 'plan' }); }}>
                        {r.mother.name}
                      </button>
                      {r.unread > 0 ? (
                        <span className="badge-count" title={`${r.unread} new message${r.unread === 1 ? '' : 's'}`} aria-label={`${r.unread} new messages`}>
                          {r.unread}
                        </span>
                      ) : null}
                      {r.triage ? <span className={`triage ${r.triage}`}>{TRIAGE_LABELS[r.triage]}</span> : null}
                    </span>
                    <span className="text-[13.5px] text-ink-2">
                      {stageLine(r.mother, r.plan.state)} · {place(r.mother)}
                    </span>
                    <span className="flex items-baseline gap-1.5 text-[14px] text-ink">
                      <span aria-hidden="true" className={cn('size-1.5 flex-none -translate-y-0.5 rounded-full', DOT[r.urgency] ?? 'bg-ink-3')} />
                      {r.reason}
                    </span>
                    {risks.length ? (
                      <span className="chips">
                        {risks.map((k) => (
                          <span key={k.code} className={`chip ${k.severity === 'urgent' || k.severity === 'high' ? 'red' : 'amber'}`}>
                            {k.label}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span className="col-start-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-left text-[13px] text-ink-3 sm:col-start-auto sm:grid sm:justify-items-end sm:text-right">
                    {r.urgency !== 'rest' ? (
                      <button
                        className="btn small accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          go({ name: 'visit', id: r.mother.id });
                        }}
                      >
                        Start visit
                      </button>
                    ) : null}
                    {nc ? (
                      <>
                        <span className="font-medium text-ink-2">{relDay(nc.date, state.clock).replace(/^./, (c) => c.toUpperCase())}</span>
                        <span>{nc.label}</span>
                      </>
                    ) : (
                      <span>No contact booked</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
