/**
 * "How" on every recommendation (steps, examples and what to avoid, with the pictogram), and the
 * guide sheet for anything that names a programme or technique. In personal mode the guide says
 * where to get help, with the country's numbers, and nudges her to see a health worker.
 */
import { useState } from 'react';
import { BookOpen01, PhoneCall01 } from '@untitledui/icons';
import type { CountryCode, HowTo } from '../../types';
import { Illustration } from '../components';
import { COUNTRIES } from '../../data';
import { cx } from '../../utils/cx';
import { Disclosure, SideSheet } from './ui';
import { emergencyShort, getGuide, type Guide } from './adapters';
import { lineFor } from './lang';

/** The steps of a how-to, in the given language (template keys translate; free text stays English). */
export function HowToBody({ howTo, lang = 'en', onOpenGuide, compact }: { howTo: HowTo; lang?: string; onOpenGuide?: (id: string) => void; compact?: boolean }) {
  const steps = howTo.steps.map((s, i) => lineFor(lang, howTo.stepKeys?.[i], s));
  const examples = (howTo.examples ?? []).map((s, i) => lineFor(lang, howTo.exampleKeys?.[i], s));
  const avoid = (howTo.avoid ?? []).map((s, i) => lineFor(lang, howTo.avoidKeys?.[i], s));
  return (
    <div className={cx('flex gap-4', compact ? 'flex-col' : 'flex-col sm:flex-row')}>
      {howTo.illustration ? (
        <div className="shrink-0 self-start rounded-xl bg-secondary p-2">
          <Illustration k={howTo.illustration} size={compact ? 64 : 88} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-3">
        {steps.length ? (
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-secondary" lang={s.lang} dir={s.dir}>
                <span aria-hidden="true" className="grid grid-cols-1 size-6 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-brand-secondary tnum">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-snug">{s.text}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {examples.length ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">For example</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {examples.map((s, i) => (
                <li key={i} className="rounded-lg bg-success-primary px-2.5 py-1 text-sm text-success-primary ring-1 ring-success_subtle ring-inset" lang={s.lang} dir={s.dir}>
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {avoid.length ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">Avoid</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {avoid.map((s, i) => (
                <li key={i} className="rounded-lg bg-warning-primary px-2.5 py-1 text-sm text-warning-primary ring-1 ring-warning_subtle ring-inset" lang={s.lang} dir={s.dir}>
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {howTo.guideId && onOpenGuide && getGuide(howTo.guideId) ? (
          <button type="button" onClick={() => onOpenGuide(howTo.guideId!)} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-secondary ring-1 ring-utility-brand-200 ring-inset hover:bg-brand-primary">
            <BookOpen01 className="size-4" aria-hidden="true" /> Open guide: {getGuide(howTo.guideId)!.title}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HowToDisclosure({ howTo, lang, onOpenGuide, label = 'How' }: { howTo?: HowTo; lang?: string; onOpenGuide?: (id: string) => void; label?: string }) {
  if (!howTo || (!howTo.steps?.length && !howTo.examples?.length)) return null;
  return (
    <Disclosure summary={label}>
      <div className="pt-1">
        <HowToBody howTo={howTo} lang={lang} onOpenGuide={onOpenGuide} />
      </div>
    </Disclosure>
  );
}

/** A guide, readable: how to run it (health worker) or where to get help (personal mode). */
export function GuideSheet({ id, country, personal, onClose }: { id: string; country: CountryCode; personal?: boolean; onClose: () => void }) {
  const g = getGuide(id);
  return (
    <SideSheet title={g?.title ?? 'Guide'} subtitle={g?.summary} onClose={onClose} width="lg" testId="guide-sheet">
      {g ? <GuideBody g={g} country={country} personal={personal} /> : <p className="text-md text-tertiary">This guide is not on this device yet. Update the library in Settings.</p>}
    </SideSheet>
  );
}

function GuideBody({ g, country, personal }: { g: Guide; country: CountryCode; personal?: boolean }) {
  const numbers = g.numbers?.[country] ?? (g.numbers as Record<string, Array<{ label: string; number: string }>> | undefined)?.default ?? [];
  const where = g.whereByCountry?.[country] ?? g.whereByCountry?.default ?? [];
  const emergency = emergencyShort(country);
  if (personal) {
    return (
      <div className="space-y-6">
        {g.forMother?.text ? <p className="text-md leading-relaxed text-secondary">{g.forMother.text}</p> : null}
        {g.forMother?.where?.length ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-md text-secondary">
            {g.forMother.where.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
        ) : null}
        {where.length ? (
          <section>
            <h3 className="text-sm font-semibold text-primary">Where to get help</h3>
            <ul className="mt-2 space-y-2">
              {where.map((w, i) => (
                <li key={i} className="rounded-xl bg-secondary px-3 py-2.5 text-sm text-secondary">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Numbers numbers={numbers} />
        <div className="rounded-xl bg-brand-primary p-4 text-sm text-brand-secondary ring-1 ring-utility-brand-200 ring-inset">
          A health worker can help you with this. Tell the nurse, midwife or community health worker at your next visit, or go to your clinic sooner if you are worried.
        </div>
        <a href={`tel:${emergency}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error-solid px-4 text-md font-semibold text-on-fill">
          <PhoneCall01 className="size-5" aria-hidden="true" /> Emergency {emergency}
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {g.forWorker?.steps.length ? (
        <section>
          <h3 className="text-sm font-semibold text-primary">How to run it</h3>
          <ol className="mt-3 space-y-3">
            {g.forWorker.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-snug text-secondary">
                <span aria-hidden="true" className="grid grid-cols-1 size-6 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-brand-secondary tnum">
                  {i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {g.forWorker?.notes?.length ? (
        <section>
          <h3 className="text-sm font-semibold text-primary">Good to know</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
            {g.forWorker.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {g.forMother?.text ? (
        <section className="rounded-xl bg-secondary p-4">
          <h3 className="text-sm font-semibold text-primary">What to tell her</h3>
          <p className="mt-1 text-sm text-secondary">{g.forMother.text}</p>
        </section>
      ) : null}
      <Numbers numbers={numbers} />
      {g.sources?.length ? (
        <p className="text-xs text-tertiary">
          Sources:{' '}
          {g.sources.map((s, i) => (
            <span key={s.id}>
              {i ? '; ' : ''}
              {s.url ? (
                <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function Numbers({ numbers }: { numbers: Array<{ label: string; number: string }> }) {
  if (!numbers.length) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-primary">Phone numbers</h3>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {numbers.map((n) => (
          <li key={n.number}>
            <a href={`tel:${n.number.replace(/[^\d+]/g, '')}`} className="flex min-h-12 items-center gap-3 rounded-xl px-3 ring-1 ring-secondary ring-inset hover:bg-primary_hover">
              <PhoneCall01 className="size-5 shrink-0 text-fg-brand-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-primary">{n.label}</span>
                <span className="block text-sm text-tertiary tnum">{n.number}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Keep the open guide id in one place per screen. */
export function useGuide(): [string | null, (id: string | null) => void] {
  return useState<string | null>(null);
}

export const COUNTRY_NAME = (c: CountryCode) => COUNTRIES[c]?.name ?? c;
