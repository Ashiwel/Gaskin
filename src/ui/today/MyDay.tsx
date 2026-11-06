/**
 * Personal mode: "My day" for a mother using Gaskin for herself. Her next check-up, today's
 * guidance in plain words (her language), her children's next vaccines, and the emergency number.
 * Danger alerts lead in the error colour and say what to do.
 */
import { AlertTriangle, Building07, Calendar, CheckCircle, Phone01, ShieldTick } from '@untitledui/icons';
import { Button } from '../../components/base/buttons/button';
import { ProgressRing } from '../../components/viz';
import { cx } from '../../utils/cx';
import { useApp } from '../../store';
import { useSetup } from '../../setup';
import { footerDisclaimer } from '../onboarding/geo';
import { renderForBoth } from '../../i18n';
import { plainVaccines } from '../../visits';
import { collectFacts } from '../../engine/facts';
import { immunisationStatus } from '../../engine/schedule';
import { useWorkerLang } from '../i18n';
import { motherLanguageOf } from '../patientLang';
import { Illustration } from '../components';
import { daysBetween, firstName, fmtDate, greeting, isoDay, relDay, shortAge } from '../format';
import type { CaseRow } from './model';
import { emergencyNumberFor } from './access';
import { MiniJourney } from './parts';

function plainNext(label: string): string {
  return label
    .replace(/^ANC booking \(contact 1\).*$/, 'Your first pregnancy check-up')
    .replace(/^ANC contact \d+ \((\d+) weeks\)$/, 'Pregnancy check-up at $1 weeks')
    .replace(/^ANC contact \d+ \(missed.*\)$/, 'A pregnancy check-up you missed')
    .replace(/^Postnatal check.*$/, 'Check-up for you and your baby')
    .replace(/^Preconception.*$/, 'Check-up before your next pregnancy');
}

export function MyDay({ row }: { row: CaseRow }) {
  const { state } = useApp();
  const wl = useWorkerLang();
  const m = row.mother;
  const ml = motherLanguageOf(m);
  const emergency = emergencyNumberFor(m.country);
  const s = row.plan.state;
  const today = isoDay(state.clock);
  const own = row.contacts.find((c) => !c.childId);
  const guidance = row.plan.items
    .filter((i) => i.status === 'active' && i.audience !== 'worker' && i.category !== 'visits')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  const dangers = row.plan.alerts.filter((a) => a.level === 'emergency' || a.level === 'urgent');
  let kids: Array<{ id: string; name: string; age: number; next?: { label: string; due: string; overdue: number; vaccines: string } }> = [];
  try {
    const f = collectFacts(m, state.clock);
    kids = f.under1000.map((c) => {
      const imm = immunisationStatus(f, c);
      return {
        id: c.id,
        name: c.name,
        age: daysBetween(c.dob, today),
        next: imm.next ? { label: imm.next.label, due: imm.next.due, overdue: imm.next.overdueDays, vaccines: plainVaccines(imm.next.missing) } : undefined,
      };
    });
  } catch {
    kids = [];
  }
  // From onboarding (src/setup recommendSetup, personal branch): nudges to see a health worker,
  // the nearest hospitals Gaskin knows, and her first steps.
  const personal = useSetup()?.plan;
  const nudges = (personal?.personal?.nudges ?? []).filter((n) => !/^Gaskin is not a doctor|^Nearest hospitals Gaskin knows|^Ask at your nearest health centre which hospital/.test(n));
  const facilities = personal?.personal?.nearestFacilities ?? [];
  const firstSteps = personal?.firstTenMinutes ?? [];
  const isNew = row.mother.events.length === 0;
  const pct = row.journeyDay !== undefined ? (row.journeyDay / 1000) * 100 : 0;
  const text = (subject: Parameters<typeof renderForBoth>[0]) => {
    try {
      const r = renderForBoth(subject, wl as never, ml);
      return r.mother?.text ?? r.english;
    } catch {
      return 'motherText' in subject ? (subject.motherText ?? '') : '';
    }
  };

  return (
    <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-6" data-testid="my-day">
      <header className="flex items-center gap-4">
        <ProgressRing value={pct} label="Your first 1,000 days" size={64} thickness={6}>
          <span className="text-xs">{row.journeyDay !== undefined ? `Day ${Math.round(row.journeyDay)}` : '–'}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-sm text-tertiary">{fmtDate(state.clock, { weekday: true })}</p>
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">
            {greeting(state.clock)}, {firstName(m.name)}
          </h1>
        </div>
      </header>

      {dangers.map((a) => (
        <section key={a.id} role="alert" className="flex gap-3 rounded-2xl bg-error-primary p-4 ring-1 ring-error_subtle ring-inset">
          <AlertTriangle className="mt-0.5 size-6 shrink-0 text-fg-error-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-md font-semibold text-error-primary">{text(a)}</p>
            <div className="mt-3">
              <Button size="md" color="primary-destructive" iconLeading={Phone01} href={`tel:${emergency.number}`}>
                Call {emergency.number}
              </Button>
            </div>
          </div>
        </section>
      ))}

      <section aria-labelledby="next-h" className="rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
        <h2 id="next-h" className="flex items-center gap-2 text-sm font-medium text-tertiary">
          <Calendar className="size-4" aria-hidden="true" /> Your next check-up
        </h2>
        {own ? (
          <>
            <p className="mt-2 text-display-xs font-semibold text-primary">{relDay(own.date, state.clock).replace(/^./, (c) => c.toUpperCase())}</p>
            <p className="text-md text-secondary">
              {plainNext(own.label)}, {fmtDate(own.date, { weekday: true })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-md text-secondary">Ask your health worker when to come next.</p>
        )}
        <MiniJourney row={row} className="mt-4" />
        <p className="mt-1 flex justify-between text-xs text-quaternary">
          <span>{s.stage === 'pregnancy' ? `${s.gestationalWeeks} weeks pregnant` : s.stage === 'preconception' ? 'Planning' : 'After birth'}</span>
          <span>Day 1,000</span>
        </p>
      </section>

      {guidance.length ? (
        <section aria-labelledby="guide-h" className="grid gap-3">
          <h2 id="guide-h" className="text-lg font-semibold text-primary">
            For today
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {guidance.map((g) => (
              <li key={g.id} className="flex gap-3 rounded-2xl bg-secondary p-4 sm:flex-col">
                {g.illustration ? <Illustration k={g.illustration} size={56} className="shrink-0" /> : null}
                <p className="text-md text-primary" lang={ml}>
                  {text(g)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {kids.length ? (
        <section aria-labelledby="kids-h" className="grid gap-3">
          <h2 id="kids-h" className="text-lg font-semibold text-primary">
            {kids.length === 1 ? 'Your baby' : 'Your children'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {kids.map((k) => (
              <li key={k.id} className="flex items-center gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                <ShieldTick className={cx('size-8 shrink-0', k.next && k.next.overdue > 0 ? 'text-fg-warning-secondary' : 'text-fg-brand-secondary')} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-md font-semibold text-primary">
                    {k.name} <span className="font-normal text-tertiary">{shortAge(k.age)}</span>
                  </p>
                  {k.next ? (
                    <p className="text-sm text-secondary">
                      {k.next.overdue > 0 ? <span className="font-medium text-warning-primary">Vaccines are late: go this week. </span> : `Next vaccines ${relDay(k.next.due, state.clock)}. `}
                      {k.next.vaccines}
                    </p>
                  ) : (
                    <p className="text-sm text-secondary">Vaccines up to date.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nudges.length || facilities.length ? (
        <section aria-labelledby="clinic-h" className="grid gap-3 rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset" data-testid="my-day-clinic">
          <h2 id="clinic-h" className="flex items-center gap-2 text-lg font-semibold text-primary">
            <Building07 className="size-5 text-fg-brand-secondary" aria-hidden="true" /> See a health worker
          </h2>
          {nudges.map((n) => (
            <p key={n} className="text-md text-secondary">
              {n}
            </p>
          ))}
          {facilities.length ? (
            <ul className="grid gap-2 sm:grid-cols-3">
              {facilities.map((f) => (
                <li key={f.name} className="min-w-0 rounded-xl bg-secondary p-3">
                  <p className="text-sm font-semibold break-words text-primary">{f.name}</p>
                  <p className="text-xs text-tertiary">
                    {f.town}
                    {f.distanceKm !== null ? `, about ${Math.round(f.distanceKm)} km` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-tertiary">Ask at your nearest health centre which hospital to go to in an emergency, and save its number.</p>
          )}
        </section>
      ) : null}

      {isNew && firstSteps.length ? (
        <section aria-labelledby="first-h" className="grid gap-3" data-testid="my-day-first-steps">
          <h2 id="first-h" className="text-lg font-semibold text-primary">
            Getting started
          </h2>
          <ol className="grid gap-2">
            {firstSteps.map((f) => (
              <li key={f} className="flex items-start gap-3 rounded-xl bg-secondary p-3 text-md text-secondary">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
        <p className="text-sm text-secondary">
          Bleeding, a bad headache, fits, fever or a baby who will not feed: go to the clinic now.
        </p>
        <Button size="md" color="secondary-destructive" iconLeading={Phone01} href={`tel:${emergency.number}`}>
          Emergency {emergency.number}
        </Button>
      </section>
      <p className="text-center text-xs text-tertiary" data-testid="personal-disclaimer">
        {footerDisclaimer()}
      </p>
    </div>
  );
}
