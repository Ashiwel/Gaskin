/**
 * Shared helpers for Gaskin's SVG chart primitives. No chart library: every chart is a few
 * dozen lines of SVG, coloured only through theme tokens, so it is correct in both themes and
 * adds almost nothing to the single-file build.
 */
import { useEffect, useId, useState } from 'react';

/** Categorical series colours, in fixed order (validated for colour-blind separation in both themes). */
export const SERIES = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)'] as const;

/** Clinical state colours. Danger is always the error scale. */
export const TONE = {
  brand: 'var(--color-fg-brand-primary)',
  neutral: 'var(--color-fg-quaternary)',
  success: 'var(--color-fg-success-secondary)',
  warning: 'var(--color-fg-warning-secondary)',
  danger: 'var(--color-fg-error-secondary)',
} as const;
export type Tone = keyof typeof TONE;

export const GRID = 'var(--color-chart-grid)';
export const AXIS = 'var(--color-chart-axis)';
export const TRACK = 'var(--color-chart-track)';
export const SURFACE = 'var(--color-chart-surface)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      const on = () => setReduced(mq.matches);
      mq.addEventListener?.('change', on);
      return () => mq.removeEventListener?.('change', on);
    } catch {
      return undefined;
    }
  }, []);
  return reduced;
}

/** A stable id for gradients and clip paths (React's useId contains colons, which url(#) accepts). */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

/** Round an axis maximum up to a clean number (1, 2, 2.5, 5, 10 times a power of ten). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Evenly spaced clean ticks from 0 to max (max should come from niceMax). */
export function ticks(max: number, count = 4): number[] {
  // Prefer a step that divides max into whole, round numbers (25s, 5s, 2s...).
  const candidates = [count, 5, 4, 3, 2];
  const whole = (c: number) => Number.isInteger(+(max / c).toFixed(6));
  const n = max < 1 ? count : (candidates.find(whole) ?? count);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(+((max / n) * i).toFixed(6));
  return out;
}

const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
export function fmt(v: number): string {
  return Math.abs(v) >= 10000 ? compact.format(v) : nf.format(v);
}

/** Path for a bar with a 4px rounded data end and a square baseline. */
export function barPath(x: number, y: number, w: number, h: number, orient: 'up' | 'right', r = 4): string {
  if (w <= 0 || h <= 0) return '';
  if (orient === 'up') {
    const rr = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  }
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

/** Smooth monotone-ish line through points (Catmull-Rom to Bezier, tension 0.5, clamped in y). */
export function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.max(lo, Math.min(hi, p1[1] + (p2[1] - p0[1]) / 6));
    const c2y = Math.max(lo, Math.min(hi, p2[1] - (p3[1] - p1[1]) / 6));
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Arc path on a circle, angles in degrees with 0 at 12 o'clock, clockwise. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const sweep = Math.max(0, Math.min(359.999, a1 - a0));
  const end = a0 + sweep;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(end));
  const y1 = cy + r * Math.sin(rad(end));
  return `M${x0},${y0}A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1},${y1}`;
}

/** A sentence describing a series, for screen readers. */
export function describeSeries(label: string, values: number[], unit = ''): string {
  if (!values.length) return `${label}: no data.`;
  const [lo, hi] = extent(values);
  const last = values[values.length - 1];
  return `${label}: ${values.length} points, latest ${fmt(last)}${unit}, lowest ${fmt(lo)}${unit}, highest ${fmt(hi)}${unit}.`;
}

/**
 * Measure an element's width so charts redraw at their real size (no distorted dots or text).
 * Falls back to `initial` before mount and in server renders.
 */
export function useWidth<T extends Element>(initial: number): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!el) return undefined;
    const read = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };
    read();
    let ro: ResizeObserver | undefined;
    try {
      ro = new ResizeObserver(read);
      ro.observe(el);
    } catch {
      window.addEventListener('resize', read);
    }
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [el]);
  return [setEl, w];
}
