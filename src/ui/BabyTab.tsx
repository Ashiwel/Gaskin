/**
 * Children: one section per child under 1,000 days. Each has a summary row (age, feeding, latest
 * weight), the WHO growth chart with the −2 to +2 SD band, the immunisation schedule as a timeline
 * (given, due, overdue, later), the milestones for the child's (corrected) age, and feeding.
 * Siblings switch with a segmented control; twins also show side by side on wide screens.
 */
import { useState } from 'react';
import { CheckCircle, Circle, Droplets01, Plus, Ruler, ShieldTick, Star01 } from '@untitledui/icons';
import type { CarePlan, ChildState, Mother } from '../types';
import { useApp } from '../store';
import { IMMUNISATION_SCHEDULES } from '../clinical';
import { GrowthChart } from '../components/viz';
import { Button } from '../components/base/buttons/button';
import { milestoneSetFor } from '../visits';
import { addDays, babyAge, daysBetween, fmtDate } from './format';
import { cx } from '../utils/cx';
import { Illustration } from './components';
import { Card, Chip, IconTile, Segmented, type ChipTone } from './patient/ui';
import { childrenOf } from './patient/adapters';
import { referenceFor } from './patient/growthRef';

const FEEDING: Record<string, { label: string; tone: ChipTone }> = {
  exclusive_breastfeeding: { label: 'Breast milk only', tone: 'success' },
  mixed: { label: 'Breast milk and formula', tone: 'warning' },
  formula: { label: 'Formula', tone: 'warning' },
  complementary_with_breastmilk: { label: 'Family foods and breast milk', tone: 'success' },
  complementary_no_breastmilk: { label: 'Family foods, no breast milk', tone: 'gray' },
};

export function BabyTab({ mother, plan, onRecord }: { mother: Mother; plan: CarePlan; onRecord: () => void }) {
  return <ChildrenTab mother={mother} plan={plan} onRecord={onRecord} />;
}

export function ChildrenTab({ mother, plan, onRecord }: { mother: Mother; plan: CarePlan; onRecord: () => void }) {
  const { state } = useApp();
  const kids = childrenOf(mother, plan, state.clock);
  const [sel, setSel] = useState<string>(kids[kids.length - 1]?.childId ?? '');
  if (!kids.length) {
    return (
      <Card className="grid grid-cols-1 place-items-center gap-3 py-12 text-center">
        <Illustration k="skin_to_skin" size={96} />
        <p className="text-md font-semibold text-primary">{plan.state.stage === 'pregnancy' ? 'Her baby is not born yet' : 'No child under 2 recorded'}</p>
        <p className="max-w-sm text-sm text-tertiary">After the birth, record the birth details and each child’s page fills in.</p>
        <Button size="md" color="secondary" iconLeading={Plus} onClick={onRecord}>
          Record birth details
        </Button>
      </Card>
    );
  }
  const current = kids.find((k) => k.childId === sel) ?? kids[kids.length - 1];
  const twins = kids.filter((k) => k.dob.slice(0, 10) === current.dob.slice(0, 10));
  return (
    <div className="grid grid-cols-1 gap-6">
      {kids.length > 1 ? (
        <Segmented
          label="Choose a child"
          wrap
          value={current.childId}
          onChange={(v) => v && setSel(v)}
          options={kids.map((k) => ({ value: k.childId, label: `${k.name.split(' ')[0]} · ${shortAge(k.ageDays)}${k.twin ? ' · twin' : ''}` }))}
          className="max-w-full sm:w-fit"
        />
      ) : null}
      {twins.length > 1 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {twins.map((k) => (
            <ChildSection key={k.childId} mother={mother} child={k} compact />
          ))}
        </div>
      ) : (
        <ChildSection mother={mother} child={current} />
      )}
    </div>
  );
}

function shortAge(days: number): string {
  if (days < 61) return `${Math.floor(days / 7)} wk`;
  return `${Math.floor(days / 30.44)} mo`;
}

function ChildSection({ mother, child, compact }: { mother: Mother; child: ChildState; compact?: boolean }) {
  const { state } = useApp();
  const record = mother.children.find((c) => c.id === child.childId);
  const only = mother.children.length === 1;
  const mine = (e: { childId?: string }) => e.childId === child.childId || (!e.childId && only);
  const ageMonths = (child.correctedAgeDays ?? child.ageDays) / 30.44;
  const growth = mother.events
    .filter((e) => e.kind === 'growth' && mine(e) && e.weightKg)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((e) => ({ month: Math.max(0, daysBetween(child.dob, e.at) / 30.44), value: (e as { weightKg: number }).weightKg }));
  const points = [...(record ? [{ month: 0, value: record.birthWeightKg }] : []), ...growth.filter((g) => g.month > 0.05)];
  const feed = FEEDING[child.feeding] ?? { label: child.feeding, tone: 'gray' as ChipTone };
  const lastFeedEvent = [...mother.events].reverse().find((e) => e.kind === 'feeding' && mine(e));
  const preterm = record && record.gestationAtBirthWeeks < 37;
  const lbw = record && record.birthWeightKg < 2.5;

  return (
    <section aria-label={child.name} className="grid grid-cols-1 gap-4" data-child={child.childId}>
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid grid-cols-1 size-14 shrink-0 place-items-center rounded-full bg-brand-primary text-lg font-semibold text-brand-secondary ring-1 ring-utility-brand-200 ring-inset">{child.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-primary">{child.name}</h2>
          <p className="text-sm text-tertiary">
            {child.sex === 'F' ? 'Girl' : 'Boy'}, {babyAge(child.ageDays)}
            {child.correctedAgeDays !== undefined ? ` (corrected ${babyAge(Math.max(0, child.correctedAgeDays))})` : ''} · born {fmtDate(child.dob, { year: true })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {child.twin ? <Chip tone="brand">Twin</Chip> : null}
            {preterm ? <Chip tone="warning">Born at {record!.gestationAtBirthWeeks} weeks</Chip> : null}
            {lbw ? <Chip tone="warning">Low birth weight, {record!.birthWeightKg} kg</Chip> : null}
            {child.risks.map((r) => (
              <Chip key={r.code} tone={r.severity === 'urgent' || r.severity === 'high' ? 'error' : 'warning'} title={r.reason}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>
        <dl className={cx('grid w-full grid-cols-3 gap-3 sm:w-auto', compact && 'sm:w-full')}>
          <Stat label="Weight" value={child.latestWeightKg ? `${child.latestWeightKg} kg` : '–'} sub={child.latestWeightAt ? fmtDate(child.latestWeightAt) : undefined} />
          <Stat label="Vaccines" value={child.immunisation.overdue.length ? `${child.immunisation.overdue.length} late` : 'Up to date'} tone={child.immunisation.overdue.length ? 'error' : 'success'} />
          <Stat label="Feeding" value={feed.label.split(' ')[0] === 'Breast' ? 'Breast milk' : feed.label.split(',')[0]} tone={feed.tone === 'success' ? 'success' : undefined} />
        </dl>
      </Card>

      <div className={cx('grid grid-cols-1 gap-4', !compact && 'lg:grid-cols-12')}>
        <Card className={cx(!compact && 'lg:col-span-7')}>
          <div className="mb-3 flex items-center gap-2">
            <IconTile icon={Ruler} size="sm" />
            <h3 className="text-sm font-semibold text-primary">Weight for age</h3>
            {points.length < 2 ? <span className="ml-auto text-xs text-tertiary">Record a weight to see the curve</span> : null}
          </div>
          <GrowthChart reference={referenceFor(child.sex, ageMonths)} points={points} label={`${child.name}: weight for age, ${child.sex === 'F' ? 'girls' : 'boys'}`} height={compact ? 220 : 260} />
        </Card>
        <Card className={cx('grid grid-cols-1 content-start gap-4', !compact && 'lg:col-span-5')}>
          <div className="flex items-center gap-2">
            <IconTile icon={Droplets01} size="sm" tone={feed.tone} />
            <h3 className="text-sm font-semibold text-primary">Feeding</h3>
          </div>
          <FeedingBar ageDays={child.ageDays} status={child.feeding} />
          {lastFeedEvent && lastFeedEvent.kind === 'feeding' ? (
            <p className="text-sm text-tertiary">
              Last asked {fmtDate(lastFeedEvent.at)}
              {lastFeedEvent.milkSupply ? `: milk supply ${lastFeedEvent.milkSupply.replace('_', ' ')}` : ''}
              {lastFeedEvent.feedsPerDay ? `, ${lastFeedEvent.feedsPerDay} feeds a day` : ''}
              {lastFeedEvent.latchProblem ? ', latch problem' : ''}.
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconTile icon={ShieldTick} size="sm" tone="success" />
          <h3 className="text-sm font-semibold text-primary">Immunisations</h3>
          {child.immunisation.next ? (
            <span className="ml-auto text-xs text-tertiary">
              Next: {child.immunisation.next.label}, {fmtDate(child.immunisation.next.due)}
            </span>
          ) : null}
        </div>
        <VaccineTimeline mother={mother} child={child} clock={state.clock} mine={mine} />
      </Card>

      <Milestones mother={mother} child={child} ageMonths={ageMonths} mine={mine} />
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' | 'error' }) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary px-3 py-2">
      <dt className="text-xs text-tertiary">{label}</dt>
      <dd className={cx('truncate text-sm font-semibold', tone === 'error' ? 'text-error-primary' : tone === 'success' ? 'text-success-primary' : 'text-primary')}>{value}</dd>
      {sub ? <dd className="text-xs text-quaternary">{sub}</dd> : null}
    </div>
  );
}

/** Where feeding should be at this age: breast milk only to 6 months, then family foods with breast milk. */
function FeedingBar({ ageDays, status }: { ageDays: number; status: string }) {
  const months = Math.min(24, ageDays / 30.44);
  const pct = (m: number) => `${(m / 24) * 100}%`;
  const expected = months < 6 ? 'Breast milk only' : 'Family foods with breast milk';
  const onTrack = months < 6 ? status === 'exclusive_breastfeeding' : status === 'complementary_with_breastmilk';
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg text-[11px] font-medium" role="img" aria-label={`Expected at ${Math.floor(months)} months: ${expected}. Now: ${FEEDING[status]?.label ?? status}.`}>
        <div className="absolute inset-y-0 left-0 flex items-center bg-success-primary pl-2 text-success-primary" style={{ width: pct(6) }}>
          Breast milk only
        </div>
        <div className="absolute inset-y-0 flex items-center bg-brand-primary pl-2 text-brand-secondary" style={{ left: pct(6), right: 0 }}>
          Family foods + breast milk
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-fg-primary" style={{ left: pct(months) }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-quaternary tnum">
        <span>Birth</span>
        <span>6 mo</span>
        <span>2 yr</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <Chip tone={onTrack ? 'success' : 'warning'}>{onTrack ? 'On track' : 'Check'}</Chip>
        <span className="text-secondary">Now: {FEEDING[status]?.label ?? status}</span>
      </p>
    </div>
  );
}

/** The schedule as a horizontal timeline: one stop per visit, coloured by state, with a word. */
function VaccineTimeline({ mother, child, clock, mine }: { mother: Mother; child: ChildState; clock: string; mine: (e: { childId?: string }) => boolean }) {
  const given = new Set(mother.events.filter((e) => e.kind === 'immunisation' && mine(e)).flatMap((e) => (e.kind === 'immunisation' ? e.vaccines : [])));
  const schedule = (IMMUNISATION_SCHEDULES?.[mother.country] ?? []).filter((s) => s.ageDays <= 730);
  if (!schedule.length) return <p className="text-sm text-tertiary">No schedule for this country yet.</p>;
  const rows = schedule.map((s) => {
    const due = addDays(child.dob, s.ageDays);
    const done = s.vaccines.every((v) => given.has(v));
    const some = s.vaccines.some((v) => given.has(v));
    const late = !done && daysBetween(due, clock) > 14;
    const now = !done && !late && daysBetween(due, clock) >= -7;
    const state: 'given' | 'overdue' | 'due' | 'later' = done ? 'given' : late ? 'overdue' : now ? 'due' : 'later';
    return { ...s, due, state, some };
  });
  const tone = { given: 'success', overdue: 'error', due: 'brand', later: 'gray' } as const;
  const word = { given: 'Given', overdue: 'Overdue', due: 'Due now', later: 'Later' } as const;
  return (
    <ol className="-mx-1 flex snap-x gap-0 overflow-x-auto px-1 pb-1">
      {rows.map((r, i) => (
        <li key={r.label} className="relative flex min-w-28 shrink-0 snap-start flex-col items-start pr-3">
          <div className="flex w-full items-center">
            <span
              aria-hidden="true"
              className={cx(
                'grid size-7 shrink-0 place-items-center rounded-full ring-2 ring-inset',
                r.state === 'given' ? 'bg-success-solid text-on-fill ring-transparent' : r.state === 'overdue' ? 'bg-error-solid text-on-fill ring-transparent' : r.state === 'due' ? 'bg-brand-primary text-brand-secondary ring-border-brand' : 'bg-primary text-fg-quaternary ring-secondary',
              )}
            >
              {r.state === 'given' ? <CheckCircle className="size-4" /> : <Circle className="size-3" />}
            </span>
            {i < rows.length - 1 ? <span aria-hidden="true" className={cx('h-0.5 flex-1', r.state === 'given' ? 'bg-fg-success-secondary' : 'bg-border-secondary')} /> : null}
          </div>
          <p className="mt-2 text-sm font-semibold text-primary">{r.label}</p>
          <p className="text-xs text-tertiary">{fmtDate(r.due)}</p>
          <p className="mt-1 text-xs text-secondary">{r.vaccines.join(', ')}</p>
          <Chip tone={tone[r.state]} className="mt-1.5">
            {r.state === 'overdue' && r.some ? 'Partly given' : word[r.state]}
          </Chip>
        </li>
      ))}
    </ol>
  );
}

function Milestones({ mother, child, ageMonths, mine }: { mother: Mother; child: ChildState; ageMonths: number; mine: (e: { childId?: string }) => boolean }) {
  const set = milestoneSetFor(ageMonths);
  if (!set) {
    return (
      <Card className="flex items-center gap-3">
        <IconTile icon={Star01} size="sm" />
        <p className="text-sm text-tertiary">Milestones start at 2 months. Until then, watch that {child.name.split(' ')[0]} feeds well, sleeps and is easy to wake.</p>
      </Card>
    );
  }
  // Visit notes carry `done:` ids for milestones already achieved.
  const doneIds = new Set(
    mother.events
      .filter((e) => e.kind === 'visit' && mine(e) && e.note?.includes('done:'))
      .flatMap((e) => (e.kind === 'visit' ? (e.note?.match(/done:([^|]*)/)?.[1] ?? '').split(',') : []))
      .map((id) => id.split('@')[0]),
  );
  const achieved = set.milestones.filter((m) => doneIds.has(m.id)).length;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <IconTile icon={Star01} size="sm" tone="brand" />
        <h3 className="text-sm font-semibold text-primary">Milestones at {set.months} months</h3>
        <span className="ml-auto text-xs text-tertiary tnum">
          {achieved} of {set.milestones.length} seen
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-quaternary" aria-hidden="true">
        <div className="h-full rounded-full bg-fg-brand-secondary" style={{ width: `${(achieved / set.milestones.length) * 100}%` }} />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {set.milestones.map((m) => {
          const on = doneIds.has(m.id);
          return (
            <li key={m.id} className="flex items-start gap-2.5 rounded-xl px-2 py-1.5">
              {on ? <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-primary" aria-label="Seen" /> : <Circle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" aria-label="Not yet checked" />}
              <span className="min-w-0">
                <span className={cx('block text-sm', on ? 'text-secondary' : 'text-primary')}>{m.label}</span>
                <span className="block text-xs text-tertiary capitalize">{m.domain}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-tertiary">Checked at child visits. Missing several, or losing a skill, is a reason to refer.</p>
    </Card>
  );
}
