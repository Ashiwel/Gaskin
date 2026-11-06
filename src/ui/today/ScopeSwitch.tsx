/**
 * Whose mothers a screen shows: hers, her facility's (when her role allows), or every record on a
 * shared demo device. Hidden when only one choice exists.
 */
import { cx } from '../../utils/cx';
import type { Worker } from '../../types';
import { allowedScopes, type Scope } from './access';

const LABEL: Record<Scope, string> = { mine: 'Mine', facility: 'Facility', all: 'Everyone' };

export function ScopeSwitch({ worker, scope, onChange, className }: { worker: Worker | undefined; scope: Scope; onChange: (s: Scope) => void; className?: string }) {
  const options = allowedScopes(worker);
  if (options.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Whose mothers to show" className={cx('inline-flex h-10 shrink-0 rounded-lg bg-secondary p-1 ring-1 ring-secondary ring-inset', className)} data-testid="scope-switch">
      {options.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={scope === s}
          onClick={() => onChange(s)}
          className={cx(
            'min-w-16 cursor-pointer rounded-md px-3 text-sm font-semibold transition duration-100 focus-visible:outline-2 focus-visible:outline-focus-ring',
            scope === s ? 'bg-primary text-primary shadow-xs ring-1 ring-secondary' : 'text-tertiary hover:text-secondary',
          )}
        >
          {LABEL[s]}
        </button>
      ))}
    </div>
  );
}
