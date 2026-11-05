/**
 * Animated bar chart, adapted from Animata (https://github.com/codse/animata, animata/graphs/bar-chart.tsx).
 *
 * MIT License. Copyright (c) Animata. Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
 * ANY KIND. See THIRD_PARTY_NOTICES.md.
 *
 * Changes for Gaskin: labelled bars with values under each (a chart a reader can check, not only
 * a sparkline); bars grow once on mount and are drawn at full height at once under
 * prefers-reduced-motion; colours from theme tokens; the whole chart has a text alternative.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from './cn';

export interface BarChartItem {
  /** 0..100 */
  progress: number;
  label: string;
  /** Text under the bar, e.g. "12" or "64%" */
  value?: string;
  className?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  height?: number;
  className?: string;
  /** Read by screen readers instead of the bars */
  summary: string;
}

export default function BarChart({ items, className, height: providedHeight, summary }: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | undefined>();
  const height = providedHeight ?? measured ?? 120;

  useLayoutEffect(() => {
    if (providedHeight !== undefined || !ref.current) return;
    const node = ref.current;
    const update = () => setMeasured(node.offsetHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [providedHeight]);

  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <figure className={cn('m-0 grid gap-2', className)}>
      <div ref={ref} role="img" aria-label={summary} className="relative flex w-full items-end gap-2 border-b border-line-2" style={{ height }}>
        {items.map((item, i) => {
          const p = Math.min(100, Math.max(0, item.progress));
          return (
            <div key={i} className="flex h-full flex-1 flex-col-reverse" title={`${item.label}: ${item.value ?? `${Math.round(p)}%`}`}>
              <div
                className={cn('rounded-t-[4px] bg-clay transition-[height] duration-700 ease-out motion-reduce:transition-none', item.className)}
                style={{ height: `${grown ? p : 0}%`, minHeight: p > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <figcaption aria-hidden="true" className="flex w-full gap-2">
        {items.map((item, i) => (
          <span key={i} className="flex-1 text-center leading-tight">
            <span className="block font-serif text-[1.05rem] text-ink tabular-nums">{item.value ?? `${Math.round(item.progress)}%`}</span>
            <span className="block text-[0.72rem] text-ink-3">{item.label}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
