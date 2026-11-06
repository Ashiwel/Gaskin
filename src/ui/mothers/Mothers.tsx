/**
 * Mothers: everyone in her caseload (or her facility, when her role allows), searchable, sortable
 * and filterable, as a list or a grid. A summary of stages and risk comes first; "Register a
 * mother" is the one primary action.
 */
import { useMemo, useState } from 'react';
import { Grid01, List, SearchLg, UserPlus01 } from '@untitledui/icons';
import type { JourneyStage } from '../../types';
import { useApp, useWorker } from '../../store';
import { LANGUAGE_NAMES } from '../../data';
import { Button } from '../../components/base/buttons/button';
import { StackedBar } from '../../components/viz';
import { cx } from '../../utils/cx';
import { useNav } from '../nav';
import { firstName, relDay, stageChip, STAGE_LABELS, URGENCY_RANK } from '../format';
import { can } from '../today/access';
import { useScopedRows, type CaseRow } from '../today/model';
import { CaseList } from '../today/CaseList';
import { ChildrenChips, Chip, FilterChip, MiniJourney, MotherAvatar, SEVERITY } from '../today/parts';
import { ScopeSwitch } from '../today/ScopeSwitch';

type SortKey = 'urgency' | 'next' | 'name' | 'stage';
type RiskFilter = 'all' | 'alerts' | 'high' | 'messages';
const STAGES: JourneyStage[] = ['pregnancy', 'postpartum', 'infant', 'preconception'];
const STAGE_ORDER: Record<JourneyStage, number> = { preconception: 0, pregnancy: 1, postpartum: 2, infant: 3 };

const langOf = (r: CaseRow) => LANGUAGE_NAMES[r.mother.language] ?? r.mother.language;

export function Mothers() {
  const { state } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const { rows, scope, setScope } = useScopedRows();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<JourneyStage | 'all'>('all');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [sort, setSort] = useState<SortKey>('urgency');
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try {
      return globalThis.localStorage?.getItem('gaskin.mothers.view.v1') === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const pickView = (v: 'list' | 'grid') => {
    setView(v);
    try {
      globalThis.localStorage?.setItem('gaskin.mothers.view.v1', v);
    } catch {
      /* ignore */
    }
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (stage !== 'all' && r.plan.state.stage !== stage) return false;
      if (risk === 'alerts' && !r.plan.alerts.length) return false;
      if (risk === 'high' && r.riskLevel !== 'high' && r.riskLevel !== 'danger') return false;
      if (risk === 'messages' && !r.unread) return false;
      if (needle) {
        const hay = `${r.mother.name} ${r.mother.community} ${r.mother.region} ${langOf(r)} ${r.children.map((c) => c.name).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by: Record<SortKey, (a: CaseRow, b: CaseRow) => number> = {
      urgency: (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.score - a.score,
      next: (a, b) => (a.contacts[0]?.date ?? '9999').localeCompare(b.contacts[0]?.date ?? '9999'),
      name: (a, b) => a.mother.name.localeCompare(b.mother.name),
      stage: (a, b) => STAGE_ORDER[a.plan.state.stage] - STAGE_ORDER[b.plan.state.stage] || (a.journeyDay ?? 0) - (b.journeyDay ?? 0),
    };
    return [...out].sort(by[sort]);
  }, [rows, q, stage, risk, sort]);

  const byStage = STAGES.map((s) => ({ s, n: rows.filter((r) => r.plan.state.stage === s).length }));
  const riskCounts = {
    danger: rows.filter((r) => r.riskLevel === 'danger').length,
    high: rows.filter((r) => r.riskLevel === 'high').length,
    moderate: rows.filter((r) => r.riskLevel === 'moderate').length,
    low: rows.filter((r) => r.riskLevel === 'low').length,
  };
  const kids = rows.reduce((s, r) => s + r.children.length, 0);
  const canRegister = can(worker, 'mothers.register');

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8" data-testid="mothers">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">Mothers</h1>
          <p className="mt-1 text-md text-tertiary">
            {rows.length} {rows.length === 1 ? 'mother' : 'mothers'} and {kids} {kids === 1 ? 'child' : 'children'}
            {scope === 'facility' ? ' at your facility' : scope === 'mine' ? ' in your care' : ' on this device'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScopeSwitch worker={worker} scope={scope} onChange={setScope} />
          {canRegister ? (
            <Button color="primary" size="md" iconLeading={UserPlus01} onClick={() => go({ name: 'register' })} data-testid="register-mother">
              Register a mother
            </Button>
          ) : null}
        </div>
      </header>

      {/* Summary: stages and risk as two bars */}
      <section aria-label="Summary" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
          <h2 className="mb-3 text-sm font-medium text-tertiary">By stage</h2>
          <StackedBar
            label="Mothers by stage"
            parts={[
              { label: 'Pregnant', value: byStage[0].n },
              { label: 'After birth', value: byStage[1].n },
              { label: 'Baby under 2', value: byStage[2].n },
              { label: 'Planning', value: byStage[3].n },
            ]}
          />
        </div>
        <div className="rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
          <h2 className="mb-3 text-sm font-medium text-tertiary">By risk</h2>
          <StackedBar
            label="Mothers by risk"
            parts={[
              { label: 'Danger', value: riskCounts.danger, tone: 'danger' },
              { label: 'High', value: riskCounts.high, tone: 'warning' },
              { label: 'Moderate', value: riskCounts.moderate, tone: 'brand' },
              { label: 'Low', value: riskCounts.low, tone: 'success' },
            ]}
          />
        </div>
      </section>

      <section aria-label="All mothers" className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Search mothers</span>
            <SearchLg className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-quaternary" aria-hidden="true" />
            <input
              id="mothers-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, child, place or language"
              className="h-11 w-full rounded-lg bg-primary pr-3 pl-11 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-tertiary">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 cursor-pointer rounded-lg bg-primary px-3 text-sm font-medium text-secondary shadow-xs ring-1 ring-primary ring-inset"
              data-testid="mothers-sort"
            >
              <option value="urgency">Most urgent</option>
              <option value="next">Next contact</option>
              <option value="stage">Stage</option>
              <option value="name">Name</option>
            </select>
          </label>
          <div role="radiogroup" aria-label="View" className="inline-flex h-11 rounded-lg bg-secondary p-1 ring-1 ring-secondary ring-inset">
            {(
              [
                ['list', List, 'List'],
                ['grid', Grid01, 'Grid'],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={label}
                data-testid={`view-${v}`}
                onClick={() => pickView(v)}
                className={cx('flex w-10 cursor-pointer items-center justify-center rounded-md', view === v ? 'bg-primary text-fg-secondary shadow-xs ring-1 ring-secondary' : 'text-fg-quaternary hover:text-fg-secondary')}
              >
                <Icon className="size-5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filters">
          <FilterChip pressed={stage === 'all'} onClick={() => setStage('all')} count={rows.length}>
            All
          </FilterChip>
          {byStage.map(({ s, n }) => (
            <FilterChip key={s} pressed={stage === s} onClick={() => setStage(stage === s ? 'all' : s)} count={n}>
              {STAGE_LABELS[s]}
            </FilterChip>
          ))}
          <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border-secondary" />
          <FilterChip pressed={risk === 'alerts'} onClick={() => setRisk(risk === 'alerts' ? 'all' : 'alerts')} tone="warning">
            Alerts
          </FilterChip>
          <FilterChip pressed={risk === 'high'} onClick={() => setRisk(risk === 'high' ? 'all' : 'high')} tone="error">
            High risk
          </FilterChip>
          <FilterChip pressed={risk === 'messages'} onClick={() => setRisk(risk === 'messages' ? 'all' : 'messages')}>
            New messages
          </FilterChip>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary py-12 text-center">
            <p className="text-md text-secondary">No one matches.</p>
            <Button
              color="link-color"
              size="sm"
              onClick={() => {
                setQ('');
                setStage('all');
                setRisk('all');
              }}
            >
              Clear search and filters
            </Button>
          </div>
        ) : view === 'list' ? (
          <CaseList rows={shown} label="Mothers" showLanguage={langOf} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Mothers">
            {shown.map((r) => (
              <MotherTile key={r.mother.id} r={r} clock={state.clock} onOpen={() => go({ name: 'patient', id: r.mother.id, tab: 'plan' })} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MotherTile({ r, clock, onOpen }: { r: CaseRow; clock: string; onOpen: () => void }) {
  const stage = stageChip(r.plan.state);
  const sev = SEVERITY[r.urgency];
  const nc = r.contacts[0];
  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset hover:shadow-md" data-mother={r.mother.name}>
      {r.urgency !== 'rest' ? <span aria-hidden="true" className={cx('absolute inset-x-0 top-0 h-1', sev.stripe)} /> : null}
      <div className="flex items-center gap-3">
        <MotherAvatar name={r.mother.name} urgency={r.urgency === 'emergency' || r.urgency === 'urgent' ? r.urgency : undefined} />
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="row-link block max-w-full cursor-pointer truncate text-left text-sm font-semibold text-primary after:absolute after:inset-0 after:content-['']">
            {r.mother.name}
          </button>
          <span className="block truncate text-xs text-tertiary">
            {r.mother.community} · {langOf(r)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip color={stage.color} title={stage.long}>
          {stage.label}
        </Chip>
        {r.urgency !== 'rest' ? <span className={cx('text-xs font-medium', sev.text)}>{sev.word}</span> : null}
        <ChildrenChips items={r.children} clock={clock} max={2} />
      </div>
      <MiniJourney row={r} />
      <p className="text-xs text-tertiary">
        {nc ? (
          <>
            <span className={cx('font-medium', nc.overdueDays > 0 ? 'text-warning-primary' : 'text-secondary')}>{nc.overdueDays > 0 ? `${nc.overdueDays} days late` : relDay(nc.date, clock).replace(/^./, (c) => c.toUpperCase())}</span>
            {': '}
            {nc.childName ? `${firstName(nc.childName)}, ` : ''}
            {nc.label}
          </>
        ) : (
          'No contact booked'
        )}
      </p>
    </li>
  );
}
