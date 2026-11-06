/**
 * A side panel for a focused task (compose, handout): full screen on a phone, a wide panel from the
 * right on a desktop. Focus moves in on open and back on close; Escape closes; the page behind does
 * not scroll. One footer holds the primary action.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { XClose } from '@untitledui/icons';
import { cx } from '../../utils/cx';

export function Panel({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'md',
  label,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  label?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-overlay/60 duration-200 animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        data-testid={testId}
        className={cx(
          'absolute inset-y-0 right-0 flex w-full flex-col bg-primary shadow-xl ring-1 ring-secondary outline-none duration-300 animate-in slide-in-from-right-8 motion-reduce:animate-none',
          width === 'md' ? 'sm:max-w-[640px]' : width === 'lg' ? 'sm:max-w-[860px]' : 'sm:max-w-[1040px]',
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-secondary px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-primary">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-tertiary">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-quaternary hover:bg-primary_hover">
            <XClose className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-secondary bg-primary px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-6">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** A numbered step heading inside a panel. */
export function StepHead({ n, title, aside }: { n?: number; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
        {n ? <span className="flex size-5.5 items-center justify-center rounded-full bg-tertiary text-xs text-secondary tnum">{n}</span> : null}
        {title}
      </h3>
      {aside}
    </div>
  );
}
