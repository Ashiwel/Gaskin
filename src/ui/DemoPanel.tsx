/**
 * Demo controls for reviewers: start as a persona, scenarios for the open mother, the simulated
 * clock, act as another worker (through src/auth, demo PIN 2580), the offline switch, AI status
 * and reset. No country selector: the place comes from setup and Settings.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Calendar, ClockFastForward, PlayCircle, RefreshCw01, Stars02, Users01, WifiOff, XClose, Zap } from '@untitledui/icons';
import { Toggle } from '../components/base/toggle/toggle';
import { stamp, useApp } from '../store';
import { SCENARIOS } from '../demo';
import { deriveState } from '../engine';
import { useNav } from './nav';
import { useToast } from './components';
import { useAIStatus } from './ai';
import { fmtDate } from './format';
import { resetSetup } from '../setup';
import { hardReset } from '../store/backend';
import { PersonaCards } from './onboarding/Onboarding';
import { openSettingsAt } from './Settings';
import { DEMO_PIN, demoSwitch, isDemoProfile, roleLabel, useAccounts } from './accounts/auth';
import { cx } from '../utils/cx';
import type { IconType } from './onboarding/kit';

function Block({ title, icon: Icon, children, aside }: { title: string; icon: IconType; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-secondary px-5 py-5 last:border-b-0" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Icon aria-hidden="true" className="size-4 text-fg-quaternary" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const btn = 'inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50';

export function DemoPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const { route, go } = useNav();
  const toast = useToast();
  const ai = useAIStatus();
  const { profiles, current } = useAccounts();
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openId = route.name === 'patient' || route.name === 'phone' || route.name === 'visit' ? route.id : undefined;
  const mother = state.mothers.find((m) => m.id === openId);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

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

  const demoProfiles = profiles.filter((p) => isDemoProfile(p.id));
  const switchTo = async (id: string) => {
    if (await demoSwitch(id)) {
      dispatch({ type: 'setWorker', workerId: id });
      const p = profiles.find((x) => x.id === id);
      toast(`Now acting as ${p?.name ?? 'another worker'}.`);
    } else toast('Only demo profiles switch without a PIN. Use the worker menu.');
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-overlay/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Demo controls"
        data-testid="demo-panel"
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[420px] flex-col bg-primary shadow-xl ring-1 ring-secondary outline-hidden max-sm:top-auto max-sm:max-h-[92dvh] max-sm:rounded-t-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-secondary px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Zap aria-hidden="true" className="size-5 text-fg-brand-primary" />
              Demo controls
            </h2>
            <p className="text-xs text-tertiary">Synthetic data. Press D to open or close.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 cursor-pointer place-items-center rounded-lg text-fg-quaternary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
            <XClose aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <Block title={mother ? `Scenarios for ${mother.name}` : 'Scenarios'} icon={PlayCircle}>
            {!mother ? (
              <p className="rounded-xl bg-secondary p-3 text-sm text-tertiary">Open a mother’s record to see what can happen to her.</p>
            ) : scenarios.length === 0 ? (
              <p className="rounded-xl bg-secondary p-3 text-sm text-tertiary">No scenarios fit her stage right now.</p>
            ) : (
              <ul className="grid gap-2">
                {scenarios.map((sc) => (
                  <li key={sc.id}>
                    <button
                      type="button"
                      data-scenario={sc.id}
                      onClick={() => {
                        dispatch({ type: 'applyScenario', scenarioId: sc.id, motherId: mother.id });
                        toast(`${sc.title}. Her plan has been updated.`);
                        if (route.name === 'patient') go({ name: 'patient', id: mother.id, tab: 'plan' }, { replace: true });
                        onClose();
                      }}
                      className="flex w-full cursor-pointer flex-col gap-0.5 rounded-xl bg-primary p-3 text-left ring-1 ring-secondary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2"
                    >
                      <span className="text-sm font-semibold text-primary">{sc.title}</span>
                      <span className="text-xs text-tertiary">{sc.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="Simulated date" icon={Calendar}>
            <p className="text-lg font-semibold text-primary" data-testid="demo-clock">
              {fmtDate(state.clock, { weekday: true, year: true })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [1, '+1 day'],
                  [7, '+1 week'],
                  [28, '+4 wk'],
                ] as Array<[number, string]>
              ).map(([d, l]) => (
                <button
                  key={d}
                  type="button"
                  className={cx(btn, 'bg-primary text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover')}
                  onClick={() => {
                    dispatch({ type: 'advanceClock', days: d });
                    toast(`Moved forward ${d === 1 ? '1 day' : d === 7 ? '1 week' : '4 weeks'}. Plans recalculated.`);
                  }}
                >
                  <ClockFastForward aria-hidden="true" className="hidden size-4 sm:block" />
                  <span aria-label={d === 28 ? 'Plus 4 weeks' : undefined}>{l}</span>
                </button>
              ))}
            </div>
          </Block>

          <Block title="Acting as" icon={Users01} aside={<span className="text-xs text-tertiary">Demo PIN {DEMO_PIN}</span>}>
            {demoProfiles.length ? (
              <label className="grid gap-1.5">
                <span className="sr-only">Acting as</span>
                <select
                  id="demo-worker"
                  value={current?.id ?? ''}
                  onChange={(e) => void switchTo(e.target.value)}
                  className="h-11 w-full cursor-pointer rounded-lg bg-primary px-3 text-md font-medium text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand"
                >
                  {current && !isDemoProfile(current.id) ? <option value={current.id}>{current.name}</option> : null}
                  {demoProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {roleLabel(p)}
                      {p.isClinicalReviewer ? ' (reviewer)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-tertiary">Start as a persona below to add demo workers. Real profiles switch from the worker menu, with a PIN.</p>
            )}
          </Block>

          <Block title="Connection" icon={WifiOff}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Offline (no data signal)</p>
                <p className="mt-0.5 text-xs text-tertiary">Messages wait in a queue and send on reconnect. Danger-sign alerts still go out by plain SMS.</p>
              </div>
              <Toggle size="md" aria-label="Offline" isSelected={state.offline} onChange={(v) => dispatch({ type: 'setOffline', offline: v, now: stamp(state.clock) })} data-testid="offline" />
            </div>
          </Block>

          <Block title="AI" icon={Stars02}>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-secondary">
                <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', ai.live ? 'bg-success-solid' : ai.lastError ? 'bg-warning-solid' : 'bg-fg-quaternary')} />
                <span className="truncate">{ai.label || 'Templates'}</span>
              </span>
              <button
                type="button"
                className="h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2"
                onClick={() => {
                  openSettingsAt('ai');
                  go({ name: 'settings' });
                  onClose();
                }}
              >
                Change
              </button>
            </div>
            {ai.lastError ? <p className="text-xs text-tertiary">Last live attempt: {ai.lastError}</p> : null}
          </Block>

          <Block title="Start as a persona" icon={Zap}>
            <PersonaCards compact onStarted={(p) => toast(`Set up as: ${p.title}.`)} />
            <button
              type="button"
              data-testid="demo-run-setup"
              className={cx(btn, 'w-max bg-primary text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover')}
              onClick={() => {
                resetSetup();
                onClose();
              }}
            >
              <RefreshCw01 aria-hidden="true" className="size-4" />
              Run setup again
            </button>
          </Block>

          <Block title="Reset" icon={AlertTriangle}>
            {confirmReset ? (
              <div className="grid gap-3 rounded-xl bg-error-primary p-3 ring-1 ring-error_subtle ring-inset">
                <p className="text-sm text-error-primary">Start the demo again from the beginning? Everything you changed will be lost.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cx(btn, 'bg-error-solid text-on-fill hover:bg-error-solid_hover')}
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
                  <button type="button" className={cx(btn, 'bg-primary text-secondary ring-1 ring-primary ring-inset')} onClick={() => setConfirmReset(false)}>
                    Keep my changes
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={cx(btn, 'w-max bg-primary text-error-primary ring-1 ring-primary ring-inset hover:bg-primary_hover')} onClick={() => setConfirmReset(true)}>
                Reset demo
              </button>
            )}
          </Block>
        </div>
      </div>
    </>
  );
}
