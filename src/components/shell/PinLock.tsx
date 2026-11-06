import { useEffect, useRef, useState } from 'react';
import { Delete, Lock01 } from '@untitledui/icons';
import { Avatar } from '../base/avatar/avatar';
import { Button } from '../base/buttons/button';
import { cx } from '../../utils/cx';
import type { ShellWorker } from './types';
import { initials } from './WorkerMenu';

export interface PinLockProps {
  worker: ShellWorker;
  /** PIN length (4 to 6). */
  length?: number;
  /**
   * Check the PIN (src/auth). Return true to unlock, or a message to show (e.g. "Wrong PIN. 2 tries
   * left."). May be async.
   */
  onSubmit: (pin: string) => boolean | string | Promise<boolean | string>;
  /** Shown as a quiet link: switch to another worker on this device. */
  onSwitchWorker?: () => void;
  /** e.g. "Forgot your PIN? Ask your supervisor to reset it." */
  forgotHint?: string;
  /** Seconds before another try is allowed, after too many wrong PINs. */
  lockedForSeconds?: number;
  /** Render inline (for the showcase) instead of covering the screen. */
  inline?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * Full-screen PIN lock for shared devices. Large 64px keys for gloved or tired hands, works with a
 * hardware keyboard, says how many digits are entered for screen readers, never shows the digits.
 */
export function PinLock({ worker, length = 4, onSubmit, onSwitchWorker, forgotHint, lockedForSeconds = 0, inline }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(lockedForSeconds);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setWait(lockedForSeconds), [lockedForSeconds]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(t);
  }, [wait]);
  useEffect(() => {
    if (!inline) root.current?.focus();
  }, [inline]);

  const press = (k: string) => {
    if (busy || wait > 0) return;
    setError(null);
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (!/^\d$/.test(k)) return;
    setPin((p) => {
      const next = (p + k).slice(0, length);
      if (next.length === length) void submit(next);
      return next;
    });
  };

  const submit = async (value: string) => {
    setBusy(true);
    try {
      const r = await onSubmit(value);
      if (r !== true) {
        setError(typeof r === 'string' ? r : 'That PIN is not right. Try again.');
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={`Locked. Enter the PIN for ${worker.name}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') press('del');
      }}
      className={cx(
        'flex flex-col items-center justify-center bg-primary px-4 outline-hidden',
        inline ? 'rounded-2xl py-10 ring-1 ring-secondary' : 'fixed inset-0 z-[100] pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]',
      )}
    >
      <div className="flex w-full max-w-xs flex-col items-center">
        <div className="relative">
          <Avatar size="xl" initials={initials(worker.name)} src={worker.avatarUrl} alt="" />
          <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-primary ring-1 ring-secondary">
            <Lock01 aria-hidden="true" className="size-3.5 text-fg-quaternary" />
          </span>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-primary">{worker.name}</h2>
        <p className="text-sm text-tertiary">{wait > 0 ? `Too many tries. Wait ${wait} seconds.` : 'Enter your PIN'}</p>

        <div className="mt-6 flex gap-3" aria-live="polite" aria-label={`${pin.length} of ${length} digits entered`} role="status">
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cx('size-3.5 rounded-full transition duration-100', i < pin.length ? 'bg-fg-primary' : 'ring-1 ring-primary ring-inset', error && 'bg-fg-error-secondary ring-0 motion-safe:animate-pulse')}
            />
          ))}
        </div>
        <p className="mt-3 min-h-5 text-center text-sm text-error-primary" role="alert">
          {error}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {KEYS.map((k, i) =>
            k === '' ? (
              <span key={i} />
            ) : (
              <button
                key={k}
                type="button"
                disabled={busy || wait > 0}
                onClick={() => press(k)}
                aria-label={k === 'del' ? 'Delete last digit' : k}
                className={cx(
                  'grid size-16 cursor-pointer place-items-center rounded-full text-display-xs font-medium text-primary outline-focus-ring transition duration-100 ease-linear select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
                  k === 'del' ? 'text-fg-tertiary hover:bg-primary_hover' : 'bg-secondary hover:bg-secondary_hover active:bg-tertiary',
                )}
              >
                {k === 'del' ? <Delete aria-hidden="true" className="size-6" /> : k}
              </button>
            ),
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          {onSwitchWorker ? (
            <Button color="link-gray" size="sm" onClick={onSwitchWorker}>
              Switch worker
            </Button>
          ) : null}
          {forgotHint ? <p className="max-w-60 text-center text-xs text-tertiary">{forgotHint}</p> : null}
        </div>
      </div>
    </div>
  );
}
