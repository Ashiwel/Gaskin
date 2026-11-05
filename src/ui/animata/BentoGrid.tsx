/**
 * Bento grid, adapted from Animata (https://github.com/codse/animata, animata/bento-grid/four.tsx
 * and three.tsx: the BentoCard and the spanning grid).
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
 * Changes for Gaskin: a reusable grid and card with a label and a large serif figure; tokens for
 * colour; one column on phones, four on wide screens; cards rise gently on hover only where
 * motion is allowed.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(150px,auto)]', className)}>{children}</div>;
}

export function BentoCard({ children, className, label, figure, note, tone = 'card' }: { children?: ReactNode; className?: string; label: ReactNode; figure?: ReactNode; note?: ReactNode; tone?: 'card' | 'clay' | 'green' | 'ink' }) {
  const tones = {
    card: 'bg-card border border-line',
    clay: 'bg-clay-soft border border-transparent',
    green: 'bg-green-soft border border-transparent',
    ink: 'bg-ink text-paper border border-transparent',
  } as const;
  return (
    <section className={cn('relative flex h-full w-full min-w-0 flex-col gap-2 overflow-hidden rounded-[var(--r-l)] p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0', tones[tone], className)}>
      <span className={cn('text-[0.72rem] font-semibold uppercase tracking-[0.08em]', tone === 'ink' ? 'text-paper/70' : 'text-ink-3')}>{label}</span>
      {figure !== undefined ? <span className="font-serif text-[2.4rem] leading-none tabular-nums">{figure}</span> : null}
      {note ? <span className={cn('text-[0.85rem] leading-snug', tone === 'ink' ? 'text-paper/80' : 'text-ink-2')}>{note}</span> : null}
      {children}
    </section>
  );
}
