/**
 * A mother's record: the header (who she is, her 1,000-day journey with every child, risks and
 * actions), then Plan, Timeline, History, Children and Messages as tabs.
 */
import { useEffect, useMemo, useState } from 'react';
import type { CarePlan } from '../types';
import { stamp, useApp, usePlans, useWorker } from '../store';
import { useNav, type PatientTab } from './nav';
import { useT } from './i18n';
import { daysBetween } from './format';
import { PlanView } from './PlanView';
import { Timeline } from './Timeline';
import { History } from './History';
import { ChildrenTab } from './BabyTab';
import { MessagesTab } from './MessagesTab';
import { RecordSheet } from './RecordSheet';
import { ComposeSheet } from './ComposeSheet';
import { HandoutSheet } from './HandoutSheet';
import { Button } from '../components/base/buttons/button';
import { Illustration } from './components';
import { cx } from '../utils/cx';
import { PatientHeader } from './patient/Header';
import { ShowToMotherCard, useLangs } from './patient/MotherSide';
import { can, childrenOf, usePersonalMode } from './patient/adapters';
import { sortAlerts } from './patient/PlanAlerts';

export function Patient({ id, tab, sheet, itemIds }: { id: string; tab: PatientTab; sheet?: 'record' | 'compose' | 'handout' | null; itemIds?: string[] }) {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const worker = useWorker();
  const { go, back } = useNav();
  const t = useT();
  const personal = usePersonalMode();
  const mother = state.mothers.find((m) => m.id === id);
  const plan = plans.get(id);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (tab === 'messages' && mother) dispatch({ type: 'markRead', motherId: mother.id, at: stamp(state.clock) });
  }, [tab, mother, dispatch, state.clock]);

  const unread = useMemo(() => {
    const readAt = state.readInbound[id];
    return state.inbound.filter((m) => m.motherId === id && (!readAt || m.receivedAt > readAt)).length;
  }, [state.inbound, state.readInbound, id]);

  if (!mother || !plan) {
    return (
      <div className="mx-auto grid grid-cols-1 max-w-md place-items-center gap-3 py-16 text-center">
        <Illustration k="clinic_visit" size={96} />
        <p className="text-lg font-semibold text-primary">We could not find this mother</p>
        <Button size="md" color="secondary" onClick={() => go({ name: 'today' })}>
          Back to Today
        </Button>
      </div>
    );
  }

  const kids = childrenOf(mother, plan, state.clock);
  const setTab = (tb: PatientTab) => go({ name: 'patient', id, tab: tb }, { replace: true });
  const openSheet = (sh: 'record' | 'compose' | 'handout', ids?: string[]) => go({ name: 'patient', id, tab, sheet: sh, itemIds: ids });
  const closeSheet = () => back();
  const showSubject = topForMother(plan);

  const tabs: Array<{ id: PatientTab; label: string; badge?: number; tone?: 'error' | 'gray' }> = [
    { id: 'plan', label: personal ? 'My plan' : t('plan.title', 'Plan'), badge: plan.alerts.length || undefined, tone: 'error' },
    ...(personal ? [] : [{ id: 'timeline' as PatientTab, label: t('patient.timeline', 'Timeline') }, { id: 'history' as PatientTab, label: t('patient.history', 'History') }]),
    { id: 'baby', label: kids.length > 1 ? `Children (${kids.length})` : personal ? 'My baby' : 'Children' },
    { id: 'messages', label: t('nav.messages', 'Messages'), badge: unread || undefined, tone: 'gray' },
  ];

  return (
    <div className="mx-auto grid grid-cols-1 w-full max-w-[1280px] gap-8">
      <PatientHeader
        mother={mother}
        plan={plan}
        canVisit={!personal && can(worker, 'visit.record')}
        canMessage={!personal && can(worker, 'message.send')}
        canEdit={!personal && can(worker, 'mother.edit')}
        onStartVisit={() => go({ name: 'visit', id })}
        onMessage={() => openSheet('compose')}
        onShowToMother={showSubject ? () => setShowing(true) : undefined}
        onHandout={() => openSheet('handout')}
        onRecord={() => openSheet('record')}
        onPhone={() => go({ name: 'phone', id })}
      />

      <div>
        <div role="tablist" aria-label="Record sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-secondary px-4 sm:mx-0 sm:px-0">
          {tabs.map((tb) => {
            const on = tab === tb.id;
            return (
              <button
                key={tb.id}
                role="tab"
                data-tab={tb.id}
                aria-selected={on}
                onClick={() => setTab(tb.id)}
                className={cx(
                  '-mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap outline-focus-ring focus-visible:outline-2',
                  on ? 'border-fg-brand-primary text-brand-secondary' : 'border-transparent text-quaternary hover:border-border-primary hover:text-secondary',
                )}
              >
                {tb.label}
                {tb.badge ? <span className={cx('min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tnum', tb.tone === 'error' ? 'bg-error-solid text-on-fill' : 'bg-secondary text-secondary ring-1 ring-secondary ring-inset')}>{tb.badge}</span> : null}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="pt-6">
          {tab === 'plan' ? <PlanView mother={mother} plan={plan} onSend={(ids) => openSheet('compose', ids)} onPrint={(ids) => openSheet('handout', ids)} /> : null}
          {tab === 'timeline' ? <Timeline mother={mother} /> : null}
          {tab === 'history' ? <History mother={mother} plan={plan} /> : null}
          {tab === 'baby' ? <ChildrenTab mother={mother} plan={plan} onRecord={() => openSheet('record')} /> : null}
          {tab === 'messages' ? <MessagesTab mother={mother} onCompose={() => openSheet('compose')} /> : null}
        </div>
      </div>

      {sheet === 'record' ? <RecordSheet mother={mother} plan={plan} onClose={closeSheet} onSaved={() => go({ name: 'patient', id, tab: 'plan' }, { replace: true })} /> : null}
      {sheet === 'compose' ? <ComposeSheet mother={mother} plan={plan} itemIds={itemIds} onClose={closeSheet} /> : null}
      {sheet === 'handout' ? <HandoutSheet mother={mother} plan={plan} itemIds={itemIds} onClose={closeSheet} /> : null}
      {showing && showSubject ? <HeaderShow mother={mother} subject={showSubject} onClose={() => setShowing(false)} /> : null}
    </div>
  );
}

function HeaderShow({ mother, subject, onClose }: { mother: NonNullable<ReturnType<typeof useApp>['state']['mothers'][number]>; subject: ReturnType<typeof topForMother>; onClose: () => void }) {
  const { wl, ml } = useLangs(mother);
  if (!subject) return null;
  return <ShowToMotherCard alert={subject.alert} item={subject.item} workerLang={wl} motherLang={ml} motherName={mother.name.split(' ')[0]} onClose={onClose} />;
}

/** What Show to mother opens from the header: the top alert, else the first danger sign, else her first item. */
function topForMother(plan: CarePlan) {
  const a = sortAlerts(plan.alerts)[0];
  if (a) return { alert: a, item: undefined };
  const items = plan.items.filter((i) => i.status === 'active' && i.audience !== 'worker' && !i.workerOnly).sort((x, y) => x.priority - y.priority);
  const item = items.find((i) => i.category === 'danger_signs') ?? items[0];
  return item ? { alert: undefined, item } : undefined;
}

export function daysToDue(plan: CarePlan, clock: string): number | undefined {
  return plan.nextContact ? daysBetween(clock, plan.nextContact.date) : undefined;
}
