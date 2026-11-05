/**
 * Flip card, adapted from Animata (https://github.com/codse/animata, animata/card/flip-card.tsx).
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
 * Changes for Gaskin: the card flips when `flipped` is set (a button press, not hover, so it
 * works on touch screens and with the keyboard); the face that is turned away is inert and
 * hidden from screen readers; under prefers-reduced-motion the faces swap with no rotation.
 */
import { createContext, use, useMemo, type ComponentProps } from 'react';
import { cn } from './cn';

export type FlipCardRotate = 'x' | 'y';

const FlipCardContext = createContext<{ rotate: FlipCardRotate; flipped: boolean } | null>(null);

function useFlipCard() {
  const c = use(FlipCardContext);
  if (!c) throw new Error('FlipCard.Front and FlipCard.Back must be used within <FlipCard>.');
  return c;
}

type RootProps = ComponentProps<'div'> & { rotate?: FlipCardRotate; flipped: boolean };

function FlipCardRoot({ rotate = 'y', flipped, className, children, ...props }: RootProps) {
  const value = useMemo(() => ({ rotate, flipped }), [rotate, flipped]);
  return (
    <FlipCardContext.Provider value={value}>
      <div className={cn('perspective-[1400px]', className)} {...props}>
        <div
          className="relative grid h-full transition-transform duration-500 ease-out transform-3d motion-reduce:transition-none motion-reduce:transform-none"
          style={{ transform: flipped ? (rotate === 'y' ? 'rotateY(180deg)' : 'rotateX(180deg)') : undefined }}
        >
          {children}
        </div>
      </div>
    </FlipCardContext.Provider>
  );
}

function FlipCardFront({ className, ...props }: ComponentProps<'div'>) {
  const { flipped } = useFlipCard();
  return <div className={cn('[grid-area:1/1] backface-hidden', flipped && 'motion-reduce:invisible', className)} aria-hidden={flipped || undefined} inert={flipped || undefined} {...props} />;
}

function FlipCardBack({ className, ...props }: ComponentProps<'div'>) {
  const { rotate, flipped } = useFlipCard();
  return (
    <div
      className={cn('[grid-area:1/1] backface-hidden', rotate === 'y' ? 'rotate-y-180' : 'rotate-x-180', 'motion-reduce:transform-none', !flipped && 'motion-reduce:invisible', className)}
      aria-hidden={!flipped || undefined}
      inert={!flipped || undefined}
      {...props}
    />
  );
}

const FlipCard = Object.assign(FlipCardRoot, { Front: FlipCardFront, Back: FlipCardBack });
export default FlipCard;
