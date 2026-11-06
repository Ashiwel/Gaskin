/**
 * Alerts and toasts in the Untitled UI style (Untitled's own toasts use the `sonner` package; Gaskin
 * keeps no extra runtime dependency, so these are written here on the same tokens).
 *
 * - <Alert>: an inline message in the page. Danger uses the error scale, never the brand colour.
 * - <ToastProvider> + useToast(): short confirmations at the bottom of the screen (top on desktop),
 *   announced politely to screen readers; errors announce assertively.
 */
import { createContext, useCallback, useContext, useState, type FC, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, InfoCircle, XClose } from '@untitledui/icons';
import { cx } from '../../../utils/cx';

export type AlertTone = 'gray' | 'brand' | 'success' | 'warning' | 'error';

const TONES: Record<AlertTone, { root: string; icon: FC<{ className?: string }>; iconCls: string; title: string }> = {
  gray: { root: 'bg-secondary_subtle ring-primary', icon: InfoCircle, iconCls: 'text-fg-tertiary', title: 'text-primary' },
  brand: { root: 'bg-brand-primary ring-utility-brand-200', icon: InfoCircle, iconCls: 'text-fg-brand-primary', title: 'text-brand-secondary' },
  success: { root: 'bg-success-primary ring-success_subtle', icon: CheckCircle, iconCls: 'text-fg-success-primary', title: 'text-success-primary' },
  warning: { root: 'bg-warning-primary ring-warning_subtle', icon: AlertTriangle, iconCls: 'text-fg-warning-primary', title: 'text-warning-primary' },
  error: { root: 'bg-error-primary ring-error_subtle', icon: AlertCircle, iconCls: 'text-fg-error-primary', title: 'text-error-primary' },
};

export interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons under the text. */
  actions?: ReactNode;
  onDismiss?: () => void;
  icon?: FC<{ className?: string }>;
  className?: string;
}

export function Alert({ tone = 'gray', title, children, actions, onDismiss, icon, className }: AlertProps) {
  const t = TONES[tone];
  const Icon = icon ?? t.icon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('relative flex gap-3 rounded-xl p-4 ring-1 ring-inset', t.root, className)}>
      <Icon aria-hidden="true" className={cx('mt-0.5 size-5 shrink-0', t.iconCls)} />
      <div className="min-w-0 flex-1 pr-6">
        <p className={cx('text-sm font-semibold', t.title)}>{title}</p>
        {children ? <div className="mt-1 text-sm text-secondary">{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center rounded-md text-fg-quaternary hover:bg-primary_hover">
          <XClose aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: AlertTone;
}
type ShowToast = (title: string, opts?: { body?: string; tone?: AlertTone; durationMs?: number }) => void;
const ToastCtx = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback<ShowToast>((title, opts) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, title, body: opts?.body, tone: opts?.tone ?? 'gray' }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), opts?.durationMs ?? 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <ToastViewport items={items} onDismiss={(id) => setItems((xs) => xs.filter((x) => x.id !== id))} />
    </ToastCtx.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastCtx);
}

export function ToastViewport({ items, onDismiss, className }: { items: ToastItem[]; onDismiss?: (id: number) => void; className?: string }) {
  return (
    <div
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4',
        'bottom-[calc(80px+env(safe-area-inset-bottom))] lg:top-4 lg:right-4 lg:bottom-auto lg:left-auto lg:items-end',
        className,
      )}
    >
      {items.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss ? () => onDismiss(t.id) : undefined} />
      ))}
    </div>
  );
}

export function Toast({ title, body, tone = 'gray', onDismiss, className }: Omit<ToastItem, 'id'> & { onDismiss?: () => void; className?: string }) {
  const T = TONES[tone];
  const Icon = T.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-primary p-4 shadow-lg ring-1 ring-secondary_alt motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cx('mt-0.5 size-5 shrink-0', T.iconCls)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{title}</p>
        {body ? <p className="mt-0.5 text-sm text-tertiary">{body}</p> : null}
      </div>
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-mt-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-quaternary hover:bg-primary_hover">
          <XClose aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
