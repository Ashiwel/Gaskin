import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EvidenceGrade, IllustrationKey } from '../types';
import { renderIllustration } from '../illustrations';
import { EVIDENCE_LABELS } from '../clinical';
import { IClose } from './icons';

// ---------- Toasts ----------

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const show = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts(() => [{ id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---------- Sheet ----------

export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide,
  label,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn icon ghost" onClick={onClose} aria-label="Close">
            <IClose />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </>
  );
}

// ---------- Illustration ----------

const illoCache = new Map<string, string>();

export function Illustration({ k, size = 56, title, className }: { k?: IllustrationKey; size?: number; title?: string; className?: string }) {
  const html = useMemo(() => {
    if (!k) return '';
    const key = `${k}:${size}:${title ?? ''}`;
    const hit = illoCache.get(key);
    if (hit !== undefined) return hit;
    let out = '';
    try {
      out = renderIllustration(k, { size, title });
    } catch {
      out = '';
    }
    illoCache.set(key, out);
    return out;
  }, [k, size, title]);
  if (!html) return <span className={className} aria-hidden="true" />;
  return <span className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- Evidence grade ----------

export const GRADE_SHORT: Record<EvidenceGrade, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  trad_supported: 'T+',
  trad_plausible: 'T?',
  trad_neutral: 'T',
  trad_harmful: 'T!',
  expert: 'E',
};

export function gradeLabel(g: EvidenceGrade): { label: string; description: string } {
  try {
    return EVIDENCE_LABELS[g] ?? { label: g, description: '' };
  } catch {
    return { label: g, description: '' };
  }
}

export function Grade({ g }: { g: EvidenceGrade }) {
  const { label, description } = gradeLabel(g);
  return (
    <span className={`grade g-${g}`} title={`${label}. ${description}`} aria-label={`Evidence: ${label}`}>
      {GRADE_SHORT[g]}
    </span>
  );
}

// ---------- Empty state ----------

export function Empty({ art, title, children }: { art?: IllustrationKey; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {art ? <Illustration k={art} size={96} className="art" /> : null}
      <strong>{title}</strong>
      {children ? <div className="small">{children}</div> : null}
    </div>
  );
}

// ---------- Sparkline ----------

export interface SparkPoint {
  x: number;
  y: number;
  label?: string;
}

export function Sparkline({
  points,
  points2,
  band,
  height = 48,
  color = 'var(--clay)',
  color2 = 'var(--ink-3)',
  title,
}: {
  points: SparkPoint[];
  points2?: SparkPoint[];
  band?: { from: number; to: number; tone: 'red' | 'amber' | 'green' };
  height?: number;
  color?: string;
  color2?: string;
  title: string;
}) {
  const w = 220;
  const h = height;
  const all = [...points, ...(points2 ?? [])];
  if (all.length === 0) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  if (band) ys.push(band.from, band.to);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 5;
  const sx = (x: number) => (maxX === minX ? w / 2 : pad + ((x - minX) / (maxX - minX)) * (w - pad * 2));
  const sy = (y: number) => (maxY === minY ? h / 2 : h - pad - ((y - minY) / (maxY - minY)) * (h - pad * 2));
  const path = (ps: SparkPoint[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const last2 = points2?.[points2.length - 1];
  const bandFill = band ? (band.tone === 'red' ? 'var(--red-soft)' : band.tone === 'amber' ? 'var(--amber-soft)' : 'var(--green-soft)') : undefined;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={title}>
      <title>{title}</title>
      {band ? <rect x={0} width={w} y={sy(band.to)} height={Math.max(0, sy(band.from) - sy(band.to))} fill={bandFill} /> : null}
      {points2 && points2.length > 1 ? <path d={path(points2)} fill="none" stroke={color2} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
      {points.length > 1 ? <path d={path(points)} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
      {/* Zero-length round-capped strokes stay circular even when the chart stretches. */}
      {last2 ? <path d={`M${sx(last2.x)},${sy(last2.y)}h0`} stroke={color2} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" /> : null}
      {last ? <path d={`M${sx(last.x)},${sy(last.y)}h0`} stroke={color} strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" /> : null}
    </svg>
  );
}

// ---------- Small helpers ----------

export function Thinking({ label = 'Thinking…', onStop }: { label?: string; onStop?: () => void }) {
  return (
    <div className="btn-row">
      <span className="thinking">
        <i /> {label}
      </span>
      {onStop ? (
        <button className="btn small ghost" onClick={onStop}>
          Stop
        </button>
      ) : null}
    </div>
  );
}

export function useAbort() {
  const ref = useRef<AbortController | null>(null);
  useEffect(() => () => ref.current?.abort(), []);
  const start = useCallback(() => {
    ref.current?.abort();
    ref.current = new AbortController();
    return ref.current.signal;
  }, []);
  const stop = useCallback(() => {
    ref.current?.abort();
    ref.current = null;
  }, []);
  return { start, stop };
}
