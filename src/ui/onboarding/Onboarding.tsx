/**
 * First launch: the onboarding wizard, with the three reviewer personas below the first question
 * so a reviewer can start at once as one of them.
 */
import { useState } from 'react';
import { HeartHand, Laptop02, Phone02, Zap } from '@untitledui/icons';
import { OnboardingWizard } from '../../setup';
import { useApp } from '../../store';
import { artifactRuntime } from '../../hosted/runtime';
import { PERSONAS, startPersona, type Persona } from '../setupFlow';
import { cx } from '../../utils/cx';
import type { IconType } from './kit';

const PERSONA_ICON: Record<Persona['id'], IconType> = { lagos: HeartHand, kano: Phone02, crossriver: Laptop02 };

export function PersonaCards({ onStarted, compact }: { onStarted?: (p: Persona) => void; compact?: boolean }) {
  const { state, dispatch } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className={cx('grid gap-3', !compact && 'sm:grid-cols-3')}>
      {PERSONAS.map((p) => {
        const Icon = PERSONA_ICON[p.id];
        return (
          <button
            key={p.id}
            type="button"
            data-persona={p.id}
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy(p.id);
              await startPersona(p, Boolean(artifactRuntime()), { workers: state.workers, mothers: state.mothers }, (id) => dispatch({ type: 'setWorker', workerId: id }));
              setBusy(null);
              onStarted?.(p);
            }}
            className="group flex min-h-11 w-full cursor-pointer flex-col gap-3 rounded-2xl bg-primary p-4 text-left ring-1 ring-secondary outline-focus-ring transition duration-150 ring-inset hover:bg-primary_hover hover:ring-primary focus-visible:outline-2 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-primary text-fg-brand-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-md font-semibold text-primary">{p.title}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {p.facts.map((f) => (
                <span key={f} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset">
                  {f}
                </span>
              ))}
            </span>
            <span className="text-sm font-semibold text-brand-secondary">{busy === p.id ? 'Setting up…' : 'Start as her'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingScreen({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  return (
    <OnboardingWizard
      onComplete={onDone}
      onSkipAll={onSkip}
      firstStepExtra={
        <section aria-labelledby="reviewer-h" className="mt-12 border-t border-secondary pt-8" data-testid="personas">
          <div className="flex items-center gap-2">
            <Zap aria-hidden="true" className="size-4 text-fg-brand-primary" />
            <h2 id="reviewer-h" className="text-sm font-semibold text-primary">
              For reviewers: start as one of three health workers
            </h2>
          </div>
          <p className="mt-1 text-sm text-tertiary">Each applies the setup Gaskin would choose for her, with synthetic mothers. Demo PIN: 2580.</p>
          <div className="mt-4">
            <PersonaCards onStarted={onDone} compact />
          </div>
        </section>
      }
    />
  );
}
