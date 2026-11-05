import { useMemo } from 'react';
import { useApp, useWorker } from '../store';
import { VisitChecklistView } from '../visits';
import { useNav } from './nav';
import { useToast, Empty } from './components';
import { useWorkerLang } from './i18n';
import { motherLanguageOf } from './patientLang';

/** Guided visit: the checklist for her stage; saving appends the events and opens the Plan. */
export function VisitScreen({ id, childId }: { id: string; childId?: string }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { go, back } = useNav();
  const toast = useToast();
  const workerLang = useWorkerLang();
  const mother = state.mothers.find((m) => m.id === id);
  const options = useMemo(() => (childId ? { childId } : undefined), [childId]);
  // The checklist is built for the simulated day. Its events are stamped at the clock itself, so
  // the plan (built as of the clock) includes them at once.
  const asOf = state.clock.slice(0, 10);
  const at = state.clock;
  if (!mother) {
    return (
      <div className="page">
        <Empty art="clinic_visit" title="We could not find this mother" />
      </div>
    );
  }
  return (
    <div className="visit-screen" data-testid="visit-screen">
      <VisitChecklistView
        mother={mother}
        asOf={asOf}
        workerLang={workerLang}
        motherLang={motherLanguageOf(mother)}
        workerId={worker.id}
        options={options}
        onCancel={() => back()}
        onComplete={(events, _checklist, _results) => {
          const stamped = events.map((e) => ({ ...e, at }));
          dispatch({ type: 'addEvents', motherId: mother.id, events: stamped, cause: 'Visit recorded' });
          const refs = events.filter((e) => e.kind === 'referral').length;
          toast(refs ? `Visit saved. ${refs === 1 ? 'A referral is' : `${refs} referrals are`} open on her plan.` : 'Visit saved. Her plan is up to date.');
          go({ name: 'patient', id: mother.id, tab: 'plan' }, { replace: true });
        }}
      />
    </div>
  );
}
