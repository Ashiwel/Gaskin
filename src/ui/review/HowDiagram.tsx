/**
 * How Gaskin builds a plan, as a diagram drawn in HTML so it reflows: one column on a phone, a row
 * on a desktop. The main line runs from her records to the mother; AI sits to one side and only
 * touches words; a learning loop runs back from workers' changes through expert review.
 */
import type { FC } from 'react';
import { ArrowDown, ArrowRight, BookOpen01, ClipboardCheck, File06, HeartHand, Repeat04, Rocket01, Scales02, ShieldTick, Stars02, UserCheck01 } from '@untitledui/icons';
import { cx } from '../../utils/cx';

interface Node {
  icon: FC<{ className?: string }>;
  title: string;
  body: string;
  tone?: 'brand' | 'solid' | 'muted' | 'error';
}

const MAIN: Node[] = [
  { icon: File06, title: 'Her records', body: 'Visits, readings, tests, replies and her children.' },
  { icon: ShieldTick, title: 'Rules engine', body: 'WHO and national guidelines decide every safety item. Same facts, same plan.', tone: 'solid' },
  { icon: ClipboardCheck, title: 'Her plan and alerts', body: 'Each item says why it is there and where the advice comes from.', tone: 'brand' },
  { icon: UserCheck01, title: 'Health worker', body: 'Reads, adjusts with a reason, and approves before anything is sent.' },
  { icon: HeartHand, title: 'The mother', body: 'A message, a printed sheet or Show to mother, in her language.' },
];

const LOOP: Node[] = [
  { icon: Repeat04, title: 'Changes with reasons', body: 'A worker removes, adds or changes an item for one mother.' },
  { icon: Scales02, title: 'Proposal and review', body: 'When several workers agree, a clinical reviewer decides.' },
  { icon: Rocket01, title: 'Library release', body: 'Approved changes go out together in a numbered version.' },
];

function Box({ n, i }: { n: Node; i?: number }) {
  const Icon = n.icon;
  return (
    <div
      className={cx(
        'relative flex min-w-0 flex-1 items-start gap-3 rounded-xl p-4 ring-1',
        n.tone === 'solid' ? 'bg-brand-solid text-on-fill ring-brand' : n.tone === 'brand' ? 'bg-brand-primary ring-brand' : 'bg-primary ring-secondary',
      )}
    >
      <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-lg', n.tone === 'solid' ? 'bg-brand-section_subtle' : 'bg-secondary')}>
        <Icon className={cx('size-5', n.tone === 'solid' ? 'text-on-fill' : 'text-fg-brand-secondary')} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cx('block text-sm font-semibold', n.tone === 'solid' ? 'text-on-fill' : 'text-primary')}>
          {i !== undefined ? <span className="sr-only">Step {i + 1}: </span> : null}
          {n.title}
        </span>
        <span className={cx('mt-0.5 block text-xs leading-snug', n.tone === 'solid' ? 'text-on-fill opacity-90' : 'text-tertiary')}>{n.body}</span>
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center self-center text-fg-quaternary">
      <ArrowDown className="size-5 xl:hidden" />
      <ArrowRight className="hidden size-5 xl:block" />
    </span>
  );
}

export function HowGaskinBuildsAPlan() {
  return (
    <figure className="m-0 grid gap-6" data-testid="how-diagram" aria-label="How Gaskin builds a plan">
      <ol className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
        {MAIN.map((n, i) => (
          <li key={n.title} className="contents">
            {i ? <Arrow /> : null}
            <Box n={n} i={i} />
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl border border-dashed border-secondary p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Stars02 className="size-4.5 text-fg-brand-secondary" aria-hidden="true" /> AI, to one side
          </p>
          <p className="text-sm text-tertiary">Optional. Turns plan items into warm words in her language, with names and places removed first. Guardrails check every line for doses, missing danger signs and false reassurance. It cannot add or remove a safety item.</p>
        </div>
        <div className="rounded-xl bg-secondary p-4 ring-1 ring-secondary">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <BookOpen01 className="size-4.5 text-fg-brand-secondary" aria-hidden="true" /> Learning loop, back into the rules
          </p>
          <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
            {LOOP.map((n, i) => (
              <li key={n.title} className="contents">
                {i ? (
                  <span aria-hidden="true" className="flex shrink-0 items-center justify-center self-center text-fg-quaternary">
                    <ArrowDown className="size-5 md:hidden" />
                    <ArrowRight className="hidden size-5 md:block" />
                  </span>
                ) : null}
                <Box n={n} />
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-tertiary">Danger-sign alerts sit outside this loop: no release can change them.</p>
        </div>
      </div>
      <figcaption className="sr-only">
        Her records go to the rules engine, which builds her plan and alerts. The health worker reviews them and passes them to the mother. AI only words things and is checked. Workers’ changes with reasons become proposals, which a clinical reviewer approves into a library release that updates the rules.
      </figcaption>
    </figure>
  );
}
