import { useMemo, useState } from 'react';
import { stamp, useApp } from '../store';
import { SCENARIOS } from '../demo';
import { deriveState } from '../engine';
import { COUNTRIES } from '../data';
import { useNav } from './nav';
import { Sheet, useToast } from './components';
import { AIBadge } from './ai';
import { fmtDate } from './format';
import { PERSONAS, applyPersona } from './setupFlow';
import { resetSetup } from '../setup';
import { artifactRuntime } from '../hosted/runtime';
import { hardReset } from '../store/backend';

const ROLE: Record<string, string> = {
  midwife: 'Midwife',
  nurse: 'Nurse',
  chew: 'CHEW',
  jchew: 'Junior CHEW',
  chips_agent: 'CHIPS agent',
  chp: 'Community health promoter',
  cho: 'Community health officer',
  doctor: 'Doctor',
  obgyn: 'Obstetrician',
  paediatrician: 'Paediatrician',
};

export function DemoPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const { route, go } = useNav();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const openId = route.name === 'patient' ? route.id : route.name === 'phone' ? route.id : undefined;
  const mother = state.mothers.find((m) => m.id === openId);
  const scenarios = useMemo(() => {
    if (!mother) return [];
    try {
      const s = deriveState(mother, state.clock);
      return SCENARIOS.filter((sc) => {
        try {
          return sc.appliesTo(mother, s);
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }, [mother, state.clock]);

  // Show a sensible set of workers: one per role, reviewers marked.
  const workers = state.workers;

  return (
    <Sheet title="Demo controls" onClose={onClose} label="Demo controls">
      <section className="demo-block" aria-label="Setup">
        <span className="t-label">Setup</span>
        <div className="grid gap-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              className="scenario"
              data-persona={p.id}
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy(p.id);
                await applyPersona(p, Boolean(artifactRuntime())).catch(() => undefined);
                dispatch({ type: 'setWorker', workerId: p.workerId });
                setBusy(null);
                toast(`Set up as: ${p.title}.`);
              }}
            >
              <strong>{busy === p.id ? 'Setting up…' : p.title}</strong>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button
            className="btn small"
            data-testid="demo-run-setup"
            onClick={() => {
              resetSetup();
              onClose();
            }}
          >
            Run setup again
          </button>
        </div>
      </section>

      <section className="demo-block">
        <span className="t-label">Simulated date</span>
        <span className="clock">{fmtDate(state.clock, { weekday: true, year: true })}</span>
        <div className="btn-row">
          {(
            [
              [1, '+1 day'],
              [7, '+1 week'],
              [28, '+4 weeks'],
            ] as Array<[number, string]>
          ).map(([d, l]) => (
            <button
              key={d}
              className="btn small"
              onClick={() => {
                dispatch({ type: 'advanceClock', days: d });
                toast(`Moved forward ${l.slice(1)}. Plans recalculated.`);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="demo-block">
        <span className="t-label">Scenarios {mother ? `for ${mother.name}` : ''}</span>
        {!mother ? (
          <p className="small muted">Open a mother’s record to see scenarios that fit her.</p>
        ) : scenarios.length === 0 ? (
          <p className="small muted">No scenarios fit her stage right now.</p>
        ) : (
          scenarios.map((sc) => (
            <button
              key={sc.id}
              className="scenario"
              data-scenario={sc.id}
              onClick={() => {
                dispatch({ type: 'applyScenario', scenarioId: sc.id, motherId: mother.id });
                toast(`${sc.title}. Her plan has been updated.`);
                if (route.name === 'patient') go({ name: 'patient', id: mother.id, tab: 'plan' }, { replace: true });
                onClose();
              }}
            >
              <strong>{sc.title}</strong>
              <span>{sc.description}</span>
            </button>
          ))
        )}
      </section>

      <section className="demo-block">
        <label className="field">
          <span>Acting as</span>
          <select className="select" id="demo-worker" value={state.currentWorkerId} onChange={(e) => dispatch({ type: 'setWorker', workerId: e.target.value })}>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}, {ROLE[w.role] ?? w.role}
                {w.isClinicalReviewer ? ' (reviewer)' : ''} · {COUNTRIES[w.country]?.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Country</span>
          <select className="select" id="demo-country" value={state.country} onChange={(e) => dispatch({ type: 'setCountry', country: e.target.value as typeof state.country })}>
            <option value="ALL">All three countries</option>
            <option value="NG">Nigeria</option>
            <option value="KE">Kenya</option>
            <option value="GH">Ghana</option>
          </select>
        </label>
      </section>

      <section className="demo-block">
        <label className="switch">
          <input type="checkbox" checked={state.offline} onChange={(e) => dispatch({ type: 'setOffline', offline: e.target.checked, now: stamp(state.clock) })} data-testid="offline" />
          Offline (no data signal)
        </label>
        <p className="small muted">Messages wait in a queue and send on reconnect. Danger-sign alerts still go out by plain SMS.</p>
      </section>

      <section className="demo-block">
        <span className="t-label">AI</span>
        <div className="btn-row">
          <AIBadge />
          <button className="link-btn" onClick={() => { go({ name: 'settings' }); onClose(); }}>
            Change AI settings
          </button>
        </div>
      </section>

      <section className="demo-block">
        {confirmReset ? (
          <div className="inline-form">
            <p className="small">Start the demo again from the beginning? Everything you changed will be lost.</p>
            <div className="btn-row">
              <button
                className="btn small danger"
                onClick={async () => {
                  await hardReset();
                  dispatch({ type: 'reset' });
                  go({ name: 'today' });
                  toast('Demo reset.');
                  onClose();
                }}
              >
                Reset demo
              </button>
              <button className="btn small ghost" onClick={() => setConfirmReset(false)}>
                Keep my changes
              </button>
            </div>
          </div>
        ) : (
          <button className="btn small" onClick={() => setConfirmReset(true)}>
            Reset demo
          </button>
        )}
        <p className="tiny muted">Press D to open or close this panel.</p>
      </section>
    </Sheet>
  );
}
