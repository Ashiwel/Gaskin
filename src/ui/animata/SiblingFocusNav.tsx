/**
 * Sibling focus navigation, adapted from Animata (https://github.com/codse/animata,
 * animata/container/sibling-focus-nav.tsx).
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
 * Changes for Gaskin: works on buttons (the app routes in memory, not with links); vertical
 * spacing for the nav rail; siblings fade to 45% rather than 30% so labels stay legible; the
 * current page never fades; no transition under prefers-reduced-motion.
 */
import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Dim siblings while one item is hovered or has keyboard focus. */
export const siblingFocusGroup = cn(
  '[&:has(>button:hover)>button:not(:hover):not([aria-current=page])]:opacity-45',
  '[&:has(>button:focus-visible)>button:not(:focus-visible):not([aria-current=page])]:opacity-45',
);

export const siblingFocusItem = 'transition-opacity duration-200 ease-out motion-reduce:transition-none';

export default function SiblingFocusNav({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col', siblingFocusGroup, className)} {...props} />;
}
