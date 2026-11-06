import { useMemo, useState } from 'react';
import { useApp, usePlans, useWorker } from '../store';
import { VisitChecklistView } from '../visits';
import { useNav } from './nav';
import { useToast } from './components';
import { useWorkerLang } from './i18n';
import { motherLanguageOf } from './patientLang';
import { Button } from '../components/base/buttons/button';
import { Illustration } from './components';
import { GuideSheet } from './patient/HowTo';
import { NextStepsSheet } from './patient/NextSteps';
import { can, usePersonalMode } from './patient/adapters';

/**
 * Guided visit: the checklist for her stage. Saving appends the events, then offers the "Next
 * steps" page for her (print, download or send) before returning to her plan.
 */
export function VisitScreen({ id, childId }: { id: string; childId?: string }) {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const worker = useWorker();
  const { go, back } = useNav();
  const toast = useToast();
  const workerLang = useWorkerLang();
  const personal = usePersonalMode();
  const [guide, setGuide] = useState<string | null>(null);
  const [after, setAfter] = useState<{ nextDate?: string; children: string[] } | null>(null);
  const mother = state.mothers.find((m) => m.id === id);
  const options = useMemo(() => (childId ? { childId } : undefined), [childId]);
  // The checklist is built for the simulated day. Its events are stamped at the clock itself, so
  // the plan (built as of the clock) includes them at once.
  const asOf = state.clock.slice(0, 10);
  const at = state.clock;
  if (!mother) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-3 py-16 text-center">
        <Illustration k="clinic_visit" size={96} />
        <p className="text-lg font-semibold text-primary">We could not find this mother</p>
        <Button size="md" color="secondary" onClick={() => back()}>
          Back
        </Button>
      </div>
    );
  }
  const plan = plans.get(mother.id);
  const done = () => go({ name: 'patient', id: mother.id, tab: 'plan' }, { replace: true });
  return (
    <div className="visit-screen" data-testid="visit-screen">
      <VisitChecklistView
        mother={mother}
        asOf={asOf}
        workerLang={workerLang}
        motherLang={motherLanguageOf(mother)}
        workerId={worker.id}
        workerName={worker.name}
        facilityId={worker.facilityId}
        options={options}
        onOpenGuide={setGuide}
        canAddQuestions={!personal && can(worker, 'visit.record')}
        onCancel={() => back()}
        onComplete={(events, checklist) => {
          const stamped = events.map((e) => ({ ...e, at }));
          dispatch({ type: 'addEvents', motherId: mother.id, events: stamped, cause: 'Visit recorded' });
          const refs = events.filter((e) => e.kind === 'referral').length;
          toast(refs ? `Visit saved. ${refs === 1 ? 'A referral is' : `${refs} referrals are`} open on her plan.` : 'Visit saved. Her plan is up to date.');
          const nextNote = events.find((e) => e.kind === 'visit')?.note?.match(/next:(\d{4}-\d{2}-\d{2})/)?.[1];
          setAfter({ nextDate: nextNote ?? checklist.nextVisit?.date, children: checklist.children.map((c) => c.name.split(' ')[0]) });
        }}
      />
      {guide ? <GuideSheet id={guide} country={mother.country} personal={personal} onClose={() => setGuide(null)} /> : null}
      {after && plan ? <NextStepsSheet mother={mother} plan={plan} nextDate={after.nextDate} childNames={after.children} onClose={done} /> : null}
    </div>
  );
}
