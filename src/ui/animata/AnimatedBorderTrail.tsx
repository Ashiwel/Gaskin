/**
 * Animated border trail, adapted from Animata (https://github.com/codse/animata,
 * animata/container/animated-border-trail.tsx).
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
 * Changes for Gaskin: TypeScript props kept; colours from theme tokens (the trail is the alert's
 * own colour on its soft background); width is full, not fit; the trail stops and a solid border
 * shows under prefers-reduced-motion; the keyframes live in src/theme.css.
 */
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

interface AnimatedTrailProps extends HTMLAttributes<HTMLDivElement> {
  /** One full turn. @default "6s" */
  duration?: string;
  contentClassName?: string;
  /** Any CSS colour, e.g. var(--red) */
  trailColor?: string;
  trailSize?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 5, md: 10, lg: 20 };

export default function AnimatedBorderTrail({ children, className, duration = '6s', trailColor = 'var(--red)', trailSize = 'md', contentClassName, ...props }: AnimatedTrailProps) {
  return (
    <div {...props} className={cn('relative w-full overflow-hidden rounded-[var(--r-l)] p-[2px]', className)} style={{ background: `color-mix(in srgb, ${trailColor} 28%, transparent)`, ...props.style }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 h-full w-full motion-reduce:hidden"
        style={{
          animation: `border-trail ${duration} linear infinite`,
          background: `conic-gradient(from var(--border-trail-angle) at 50% 50%, transparent ${100 - sizes[trailSize]}%, ${trailColor})`,
        }}
      />
      <div className={cn('relative h-full w-full overflow-hidden rounded-[calc(var(--r-l)-2px)]', contentClassName)}>{children}</div>
    </div>
  );
}
