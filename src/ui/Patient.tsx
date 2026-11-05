import { useEffect, useMemo } from 'react';
import type { CarePlan, Mother } from '../types';
import { stamp, useApp, usePlans } from '../store';
import { useNav, type PatientTab } from './nav';
import { IBack, IMessage, IPhone, IPrint, IRecord, IStethoscope } from './icons';
import { useT } from './i18n';
import type { LanguageCode } from '../types';
import { COUNTRIES } from '../data';
import { babyAge, daysBetween, fmtDate, gaskinId, PHONE_ACCESS_LABELS, place, stageLine } from './format';
import { LANGUAGE_NAMES } from '../data';
import { PlanView } from './PlanView';
import { Timeline } from './Timeline';
import { History } from './History';
import { BabyTab } from './BabyTab';
import { MessagesTab } from './MessagesTab';
import { RecordSheet } from './RecordSheet';
import { ComposeSheet } from './ComposeSheet';
import { HandoutSheet } from './HandoutSheet';
import { Empty } from './components';

/** Her language, used for everything she sees or hears. The worker can change it here. */
function MotherLanguage({ mother }: { mother: Mother }) {
  const { dispatch } = useApp();
  const options = Array.from(new Set<LanguageCode>([mother.language, ...(COUNTRIES[mother.country]?.languages ?? []), 'en', 'pcm']));
  return (
    <label className="inline-flex items-center gap-1.5">
      Her language
      <select
        className="rounded-[var(--r-s)] border border-line-2 bg-raised px-1.5 py-0.5 font-semibold text-ink"
        id="mother-lang"
        value={mother.language}
        onChange={(e) => dispatch({ type: 'updateMother', mother: { ...mother, language: e.target.value as LanguageCode }, cause: 'Her language changed' })}
        aria-label="Her language, for messages, handouts and Show to mother"
      >
        {options.map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_NAMES[l] ?? l}
          </option>
        ))}
      </select>
    </label>
  );
}

const TABS: Array<[PatientTab, string, string]> = [
  ['plan', 'Plan', 'plan.title'],
  ['timeline', 'Timeline', 'patient.timeline'],
  ['history', 'History', 'patient.history'],
  ['baby', 'Baby', 'patient.baby'],
  ['messages', 'Messages', 'nav.messages'],
];

/** Conception to day 1,000: where she is now. */
function Journey({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const s = plan.state;
  // Day 0 = conception (LMP + 14), pregnancy ~266 days, then 730 days to age 2.
  let day = 0;
  if (s.stage === 'pregnancy') day = Math.max(0, ((s.gestationalWeeks ?? 0) - 2) * 7);
  else if (s.stage === 'postpartum' || s.stage === 'infant') day = 266 + (s.infantAgeDays ?? s.daysPostpartum ?? 0);
  day = Math.min(1000, day);
  const W = 1000;
  const x = (d: number) => (d / 1000) * W;
  const ticks = [
    { d: 0, l: 'Conception' },
    { d: 266, l: 'Birth' },
    { d: 266 + 42, l: '6 weeks' },
    { d: 266 + 182, l: '6 months' },
    { d: 266 + 365, l: '1 year' },
    { d: 1000, l: 'Day 1,000' },
  ];
  return (
    <div className="journey" aria-label={`Day ${day} of the first 1,000 days`}>
      <div style={{ position: 'relative' }}>
      <svg viewBox={`0 -14 ${W} 44`} preserveAspectRatio="none" role="img">
        <title>{`${mother.name} is at day ${day} of 1,000`}</title>
        <line x1={0} x2={W} y1={12} y2={12} stroke="var(--line-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={x(day)} y1={12} y2={12} stroke="var(--clay)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        {ticks.map((t) => (
          <line key={t.d} x1={x(t.d)} x2={x(t.d)} y1={6} y2={18} stroke="var(--line-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
        <rect x={x(266) - 1} y={2} width={2} height={20} fill="var(--ink-3)" />
      </svg>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `calc(${(day / 1000) * 100}% - 7px)`,
            top: 19,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--clay)',
            boxShadow: '0 0 0 4px var(--paper), 0 0 0 5px var(--clay)',
          }}
        />
      </div>
      <div className="labels">
        <span style={{ left: 0 }}>Conception</span>
        <span style={{ left: '26.6%', transform: 'translateX(-50%)' }}>Birth</span>
        <span style={{ right: 0 }} className="num">
          Day {day.toLocaleString('en-GB')} of 1,000
        </span>
      </div>
    </div>
  );
}

export function Patient({ id, tab, sheet, itemIds }: { id: string; tab: PatientTab; sheet?: 'record' | 'compose' | 'handout' | null; itemIds?: string[] }) {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const { go, back } = useNav();
  const t = useT();
  const mother = state.mothers.find((m) => m.id === id);
  const plan = plans.get(id);

  useEffect(() => {
    if (tab === 'messages' && mother) dispatch({ type: 'markRead', motherId: mother.id, at: stamp(state.clock) });
  }, [tab, mother, dispatch, state.clock]);

  const unread = useMemo(() => {
    const readAt = state.readInbound[id];
    return state.inbound.filter((m) => m.motherId === id && (!readAt || m.receivedAt > readAt)).length;
  }, [state.inbound, state.readInbound, id]);

  if (!mother || !plan) {
    return (
      <div className="page">
        <Empty art="clinic_visit" title="We could not find this mother">
          <button className="link-btn" onClick={() => go({ name: 'today' })}>
            Back to Today
          </button>
        </Empty>
      </div>
    );
  }

  const s = plan.state;
  const facility = state.facilities.find((f) => f.id === mother.facilityId);
  const consentOk = mother.consent.dataProcessing && mother.consent.messaging;
  const setTab = (t: PatientTab) => go({ name: 'patient', id, tab: t }, { replace: true });
  const openSheet = (sh: 'record' | 'compose' | 'handout', ids?: string[]) => go({ name: 'patient', id, tab, sheet: sh, itemIds: ids });
  const closeSheet = () => back();

  return (
    <div className="page">
      <header className="patient-head">
        <button className="back" onClick={() => back()}>
          <IBack /> Today
        </button>
        <div className="ph-top">
          <div className="ph-name">
            <h1 className="t-display">{mother.name}</h1>
            <p className="ph-stage">
              {mother.age} years · {stageLine(mother, s)}
              {s.stage === 'pregnancy' && s.edd ? ` · due ${fmtDate(s.edd, { year: true })}` : ''}
              {s.infant && s.stage !== 'pregnancy' ? ` · ${s.infant.name}, ${babyAge(s.infantAgeDays)}` : ''}
            </p>
          </div>
          <div className="actions-bar">
            <button className="btn accent" onClick={() => go({ name: 'visit', id })} data-testid="start-visit">
              <IStethoscope /> Start visit
            </button>
            <button className="btn" onClick={() => openSheet('record')} data-testid="record">
              <IRecord /> {t('patient.record', 'Record')}
            </button>
            <button className="btn" onClick={() => openSheet('compose')}>
              <IMessage /> Message
            </button>
            <button className="btn icon" onClick={() => openSheet('handout')} aria-label="Print handout" title="Print handout">
              <IPrint />
            </button>
            <button className="btn icon" onClick={() => go({ name: 'phone', id })} aria-label="Her phone" title="See her phone">
              <IPhone />
            </button>
          </div>
        </div>
        <div className="ph-meta">
          <span>
            Gaskin ID <b className="gid" title="Stays the same if she changes SIM or phone number">{gaskinId(mother)}</b>
          </span>
          <span>
            <b>{place(mother)}</b>
          </span>
          <MotherLanguage mother={mother} />
          <span>
            <b>{PHONE_ACCESS_LABELS[mother.phone.access]}</b>
            {mother.phone.hasWhatsApp ? ', chat app' : ''}
          </span>
          <span>
            Consent{' '}
            <b style={{ color: consentOk ? 'var(--green)' : 'var(--amber)' }}>
              {consentOk ? 'given' : mother.consent.dataProcessing ? 'records only, no messages' : 'not recorded'}
            </b>
            {mother.consent.guardianInvolved ? ', guardian involved' : ''}
          </span>
          {facility ? <span>{facility.name}</span> : null}
        </div>
        <Journey mother={mother} plan={plan} />
        <p className="tiny muted">Gaskin ID stays the same if she changes SIM or phone number.</p>
      </header>

      <div className="tabs" role="tablist" aria-label="Record sections">
        {TABS.map(([tb, l, k]) => (
          <button key={tb} role="tab" data-tab={tb} aria-selected={tab === tb} onClick={() => setTab(tb)}>
            {tb === 'plan' ? l : t(k, l)}
            {tb === 'plan' && plan.alerts.length ? <span className="badge-count" style={{ background: 'var(--red)', color: 'var(--red-ink)' }}>{plan.alerts.length}</span> : null}
            {tb === 'messages' && unread ? <span className="badge-count">{unread}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'plan' ? <PlanView mother={mother} plan={plan} onSend={(ids) => openSheet('compose', ids)} onPrint={(ids) => openSheet('handout', ids)} /> : null}
        {tab === 'timeline' ? <Timeline mother={mother} /> : null}
        {tab === 'history' ? <History mother={mother} plan={plan} /> : null}
        {tab === 'baby' ? <BabyTab mother={mother} plan={plan} onRecord={() => openSheet('record')} /> : null}
        {tab === 'messages' ? <MessagesTab mother={mother} onCompose={() => openSheet('compose')} /> : null}
      </div>

      {sheet === 'record' ? (
        <RecordSheet
          mother={mother}
          plan={plan}
          onClose={closeSheet}
          onSaved={() => go({ name: 'patient', id, tab: 'plan' }, { replace: true })}
        />
      ) : null}
      {sheet === 'compose' ? <ComposeSheet mother={mother} plan={plan} itemIds={itemIds} onClose={closeSheet} /> : null}
      {sheet === 'handout' ? <HandoutSheet mother={mother} plan={plan} itemIds={itemIds} onClose={closeSheet} /> : null}
    </div>
  );
}

export function daysToDue(plan: CarePlan, clock: string): number | undefined {
  return plan.nextContact ? daysBetween(clock, plan.nextContact.date) : undefined;
}
