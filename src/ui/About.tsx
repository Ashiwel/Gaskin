/**
 * About Gaskin: what it is, how it builds a plan (a small diagram), privacy, clinical status,
 * disclaimers, licence and founders. Short and visual.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, BookOpen01, CheckCircle, Code02, FileHeart02, HeartHand, Lock01, Scale01, ShieldTick, Stars02, Users01 } from '@untitledui/icons';
import { useSetup } from '../setup';
import { useAccounts } from './accounts/auth';
import { personalDisclaimers } from './onboarding/geo';
import { placeCountry } from './settings/legalInfo';
import { VERSION } from './settings/SectionsB';
import type { IconType } from './onboarding/kit';
import { cx } from '../utils/cx';

function Step({ n, title, body, icon: Icon, tone = 'brand' }: { n: number; title: string; body: string; icon: IconType; tone?: 'brand' | 'gray' | 'success' }) {
  return (
    <li className="relative flex min-w-0 flex-1 flex-col items-center text-center">
      <span className={cx('relative z-10 grid size-14 place-items-center rounded-2xl ring-1 ring-inset', tone === 'success' ? 'bg-success-primary text-fg-success-primary ring-success_subtle' : tone === 'gray' ? 'bg-secondary text-fg-secondary ring-secondary' : 'bg-brand-primary text-fg-brand-primary ring-brand')}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="mt-3 text-xs font-semibold text-quaternary tnum">Step {n}</span>
      <span className="mt-0.5 text-md font-semibold text-primary">{title}</span>
      <span className="mt-1 max-w-48 text-sm text-tertiary">{body}</span>
    </li>
  );
}

function Card({ icon: Icon, title, children, tone }: { icon: IconType; title: string; children: ReactNode; tone?: 'warning' }) {
  return (
    <section className={cx('rounded-2xl p-5 ring-1 ring-inset', tone === 'warning' ? 'bg-warning-primary ring-border-warning_subtle' : 'bg-primary ring-secondary')}>
      <div className="flex items-center gap-3">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tone === 'warning' ? 'bg-primary text-fg-warning-primary' : 'bg-secondary text-fg-secondary')}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className={cx('text-md font-semibold', tone === 'warning' ? 'text-warning-primary' : 'text-primary')}>{title}</h2>
      </div>
      <div className={cx('mt-3 grid gap-2 text-sm', tone === 'warning' ? 'text-warning-primary' : 'text-tertiary')}>{children}</div>
    </section>
  );
}

export function About() {
  const { current } = useAccounts();
  const saved = useSetup();
  const personal = Boolean(current?.personal) || (saved?.answers as { audience?: string } | undefined)?.audience === 'personal';
  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-10 pb-16" data-testid="about">
      <header className="grid gap-3">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-solid text-on-fill">
          <HeartHand aria-hidden="true" className="size-7" />
        </span>
        <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">About Gaskin</h1>
        <p className="max-w-2xl text-lg text-tertiary">
          {personal
            ? 'Gaskin helps you plan care for yourself and your baby, from pregnancy to your child’s second birthday. It works on your phone, without internet.'
            : 'An open-source care planner for midwives and community health workers, from conception to a child’s first 1,000 days. It works offline, on a phone or from a USB stick, in the languages mothers speak.'}
        </p>
        <p className="text-sm text-quaternary">Named for Ina May Gaskin, the midwife who taught the world to trust women’s bodies.</p>
      </header>

      <section aria-labelledby="how-h" className="rounded-3xl bg-secondary p-6 ring-1 ring-secondary ring-inset sm:p-8">
        <h2 id="how-h" className="text-lg font-semibold text-primary">
          How a plan is made
        </h2>
        <ol className="relative mt-8 flex flex-col gap-8 sm:flex-row sm:gap-4" data-testid="plan-diagram">
          <span aria-hidden="true" className="absolute top-7 right-[12%] left-[12%] hidden h-0.5 bg-tertiary sm:block" />
          <Step n={1} icon={FileHeart02} title="Her record" body="Visits, readings, symptoms, her children and where she lives." tone="gray" />
          <Step n={2} icon={BookOpen01} title="Guideline rules" body="WHO and national rules, readable by anyone, decide every alert." />
          <Step n={3} icon={CheckCircle} title="Her plan" body="Care, food, checks and danger signs, in her language." tone="success" />
          <Step n={4} icon={Stars02} title="Optional AI" body="Only helps word and translate messages. A person approves each one." tone="gray" />
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={Lock01} title="Privacy">
          <p>Records stay on this device or the programme’s own server. Nothing leaves unless someone sends, backs up or shares it.</p>
          <p>Before any text reaches an AI service, names, numbers, places and dates are removed. Every request is logged without its content.</p>
          <p>Designed for the Nigeria Data Protection Act 2023, Kenya’s Data Protection Act 2019 and Ghana’s Data Protection Act 2012.</p>
        </Card>
        <Card icon={ShieldTick} title="Clinical status" tone="warning">
          <p className="font-semibold">A prototype. Not for patient care yet.</p>
          <p>Every mother, worker and facility in the demo is invented. The care rules come from published guidelines and are waiting for review by the clinical lead and an independent clinical board.</p>
        </Card>
        <Card icon={AlertTriangle} title="Disclaimers">
          {personalDisclaimers(placeCountry()).slice(0, personal ? 5 : 3).map((d) => (
            <p key={d.id}>{d.text}</p>
          ))}
        </Card>
        <Card icon={Scale01} title="Licence">
          <p>
            Code: <span className="font-semibold text-secondary">GNU AGPL-3.0</span>. Anyone may run, change and share it; a changed version offered as a service must publish its changes.
          </p>
          <p>
            Clinical content, pictures and language packs: <span className="font-semibold text-secondary">CC BY 4.0</span>.
          </p>
          <p>Third-party parts keep their own licences, listed in Settings, About and legal.</p>
        </Card>
      </div>

      <section aria-labelledby="founders-h" className="grid gap-4">
        <h2 id="founders-h" className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Users01 aria-hidden="true" className="size-5 text-fg-quaternary" />
          Founders
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['EO', 'Elizabeth Okang', 'Clinical lead. Midwife and midwife trainer with more than 30 years of rural practice.'],
            ['AO', 'Ash Okang Ochui', 'Leads product and engineering.'],
          ].map(([i, n, d]) => (
            <div key={n} className="flex gap-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary ring-inset">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-primary text-md font-semibold text-brand-secondary">
                {i}
              </span>
              <div>
                <p className="text-md font-semibold text-primary">{n}</p>
                <p className="mt-1 text-sm text-tertiary">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-secondary pt-6 text-sm text-quaternary">
        <span className="inline-flex items-center gap-1.5">
          <Code02 aria-hidden="true" className="size-4" />
          Gaskin {VERSION}
        </span>
        <span>Built for the UNICEF Venture Fund FemTech call, November 2026.</span>
      </footer>
    </div>
  );
}
