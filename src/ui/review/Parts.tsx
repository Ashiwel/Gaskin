/**
 * Parts of a proposal's review: the before/after diff, who proposed it with the timeline of their
 * overrides, the impact picture, example mothers, and the safety panel.
 */
import { AlertTriangle, ArrowRight, BookOpen01, CheckCircle, Lock01, ShieldTick, XCircle } from '@untitledui/icons';
import type { EvidenceGrade, Mother, PlanItem, RuleProposal, Worker } from '../../types';
import type { ProposalImpact, TimelineEntry } from '../../engine';
import { CATEGORY_LABELS } from '../../clinical';
import { useApp } from '../../store';
import { Badge } from '../../components/base/badges/badges';
import { BarChart } from '../../components/viz';
import { cx } from '../../utils/cx';
import { Grade, gradeLabel } from '../components';
import { fmtDate, STAGE_LABELS } from '../format';
import { useNav } from '../nav';
import { Card, hashTone, Initials, SafeLink } from '../messages/kit';
import { anonymous, planPair, wordDiff, type DiffPart } from './model';

const CADRE: Record<string, string> = {
  midwife: 'Midwife',
  nurse: 'Nurse',
  chew: 'CHEW',
  jchew: 'JCHEW',
  chips_agent: 'CHIPS agent',
  chp: 'Community health promoter',
  cho: 'Community health officer',
  doctor: 'Doctor',
  obgyn: 'Obstetrician',
  paediatrician: 'Paediatrician',
};
export const cadreLabel = (w?: Worker) => (w ? (CADRE[w.role] ?? w.role) : 'Health worker');

// ---------- Diff ----------

function Diffed({ parts, side }: { parts: DiffPart[]; side: 'before' | 'after' }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'same') return <span key={i}>{p.text}</span>;
        if (side === 'before' && p.kind === 'del')
          return (
            <del key={i} className="rounded-sm bg-error-primary text-error-primary decoration-1">
              {p.text}
            </del>
          );
        if (side === 'after' && p.kind === 'add')
          return (
            <ins key={i} className="rounded-sm bg-success-primary text-success-primary no-underline">
              {p.text}
            </ins>
          );
        return null;
      })}
    </>
  );
}

type Field = { key: string; label: string; get: (i: Partial<PlanItem>) => string };
const FIELDS: Field[] = [
  { key: 'title', label: 'Title', get: (i) => i.title ?? '' },
  { key: 'motherText', label: 'What she is told', get: (i) => i.motherText ?? '' },
  { key: 'detail', label: 'Detail for the worker', get: (i) => i.detail ?? '' },
  { key: 'priority', label: 'Priority', get: (i) => (i.priority ? `${i.priority} of 5` : '') },
  { key: 'category', label: 'Category', get: (i) => (i.category ? (CATEGORY_LABELS[i.category] ?? i.category) : '') },
  { key: 'timing', label: 'When', get: (i) => i.timing ?? '' },
];

/** Before and after side by side, field by field, with removed words struck in red and new words in green. */
export function PlanItemDiff({ proposal, before }: { proposal: RuleProposal; before: PlanItem | null }) {
  const after: Partial<PlanItem> | null = proposal.effect === 'remove' ? null : { ...(before ?? {}), ...(proposal.item ?? {}) };
  const b: Partial<PlanItem> = before ?? {};
  const rows = FIELDS.filter((f) => f.get(b) || (after && f.get(after)));
  const Column = ({ side }: { side: 'before' | 'after' }) => {
    const empty = side === 'before' ? !before : !after;
    return (
      <div className={cx('min-w-0 rounded-xl p-4 ring-1', side === 'before' ? 'bg-secondary ring-secondary' : 'bg-primary ring-secondary')}>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-tertiary uppercase">
          {side === 'before' ? 'Today' : 'If approved'}
          {side === 'before' && before?.locked ? (
            <span className="inline-flex items-center gap-1 normal-case">
              <Lock01 className="size-3.5" aria-hidden="true" /> Locked
            </span>
          ) : null}
        </p>
        {empty ? (
          <p className="rounded-lg border border-dashed border-secondary px-3 py-6 text-center text-sm text-tertiary">{side === 'before' ? 'Not in her plan today' : 'Removed from the plan'}</p>
        ) : (
          <dl className="grid gap-3">
            {rows.map((f) => {
              const parts = wordDiff(f.get(b), after ? f.get(after) : '');
              const text = side === 'before' ? f.get(b) : f.get(after!);
              const changed = parts.some((p) => p.kind !== 'same');
              return (
                <div key={f.key} className="min-w-0">
                  <dt className="text-xs text-tertiary">
                    {f.label}
                    {changed && side === 'after' && before ? <span className="ml-1.5 font-semibold text-success-primary">changed</span> : null}
                  </dt>
                  <dd className={cx('mt-0.5 text-sm break-words text-primary', f.key === 'title' && 'font-semibold')}>
                    {!before || !after ? text || '–' : <Diffed parts={parts} side={side} />}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    );
  };
  return (
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]" data-testid="plan-diff">
      <Column side="before" />
      <div aria-hidden="true" className="flex items-center justify-center text-fg-quaternary">
        <ArrowRight className="size-5 rotate-90 md:rotate-0" />
      </div>
      <Column side="after" />
    </div>
  );
}

// ---------- Who proposed it ----------

export function Proposers({ proposal, timeline }: { proposal: RuleProposal; timeline: TimelineEntry[] }) {
  const { state } = useApp();
  const { go } = useNav();
  const workers = proposal.supportingWorkerIds.map((id) => state.workers.find((w) => w.id === id)).filter(Boolean) as Worker[];
  const years = workers.reduce((s, w) => s + (w.yearsExperience ?? 0), 0);
  const need = 3;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex -space-x-2" aria-hidden="true">
          {workers.map((w) => (
            <Initials key={w.id} name={w.name} tone={hashTone(w.id)} size="lg" />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-md font-semibold text-primary">
            {workers.length} distinct health worker{workers.length === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-tertiary">
            {years} years of experience between them · {workers.length >= need ? 'enough agreement to review' : `usually needs ${need}`}
          </p>
        </div>
        <div className="ml-auto flex gap-1" role="img" aria-label={`${workers.length} of ${need} workers needed`}>
          {Array.from({ length: Math.max(need, workers.length) }).map((_, i) => (
            <span key={i} className={cx('h-2 w-6 rounded-full', i < workers.length ? 'bg-brand-solid' : 'bg-tertiary')} />
          ))}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {workers.map((w) => {
          const fac = state.facilities.find((f) => f.id === w.facilityId);
          return (
            <li key={w.id} className="flex items-center gap-3 rounded-lg bg-secondary p-3 ring-1 ring-secondary">
              <Initials name={w.name} tone={hashTone(w.id)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">{w.name}</p>
                <p className="truncate text-xs text-tertiary">
                  {cadreLabel(w)} · {w.yearsExperience} years · {fac?.region ?? ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {timeline.length ? (
        <ol className="relative grid gap-4 border-s-2 border-secondary ps-5" aria-label="How this proposal came about" data-testid="proposal-timeline">
          {timeline.map((e, i) => {
            const w = state.workers.find((x) => x.id === e.actorId);
            const m = e.motherId ? state.mothers.find((x) => x.id === e.motherId) : undefined;
            const dot = e.kind === 'reviewed' ? (/^Approved/.test(e.text) ? 'bg-success-solid' : /^Rejected/.test(e.text) ? 'bg-error-solid' : 'bg-warning-solid') : e.kind === 'proposal_created' ? 'bg-brand-solid' : e.kind === 'reverted' ? 'bg-quaternary' : 'bg-fg-brand-secondary';
            return (
              <li key={`${e.kind}-${i}`} className="relative">
                <span aria-hidden="true" className={cx('absolute top-1 -start-[27px] size-3 rounded-full ring-4 ring-[var(--color-bg-primary)]', dot)} />
                <p className="text-xs text-tertiary">
                  {fmtDate(e.at, { year: true })} · {w?.name ?? (e.actorId === 'system' ? 'Gaskin' : e.actorId)}
                </p>
                {e.overrideId ? (
                  <>
                    <p className="text-sm text-secondary">
                      {e.kind === 'reverted' ? 'Reverted for one mother.' : (e.text.split(': ')[0] ?? e.text) + '.'}
                      {m ? (
                        <>
                          {' '}
                          <button type="button" className="cursor-pointer font-medium text-brand-secondary hover:underline" onClick={() => go({ name: 'patient', id: m.id, tab: 'plan' })}>
                            Open her plan
                          </button>
                        </>
                      ) : null}
                    </p>
                    {e.kind !== 'reverted' ? <blockquote className="mt-1 border-s-2 border-brand ps-3 text-sm whitespace-pre-line text-primary">{e.text.split(': ').slice(1).join(': ')}</blockquote> : null}
                  </>
                ) : (
                  <p className="text-sm text-primary">{e.text}</p>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

// ---------- Impact ----------

export function ImpactPicture({ impact }: { impact: ProposalImpact }) {
  const stages = (['pregnancy', 'postpartum', 'infant', 'preconception'] as const).map((s) => ({ label: STAGE_LABELS[s], value: impact.byStage[s] ?? 0 }));
  const regions = Object.entries(impact.byRegion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => ({ label: k, value: v }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center rounded-xl bg-brand-primary p-5 ring-1 ring-brand" data-testid="mothers-affected">
        <p className="text-sm font-medium text-brand-secondary">Mothers affected</p>
        <p className="text-display-lg leading-none font-semibold text-primary tnum">{impact.mothersAffected}</p>
        <p className="mt-2 text-sm text-tertiary">whose plan would change today if you approve</p>
      </div>
      <div className="min-w-0 rounded-xl bg-primary p-4 ring-1 ring-secondary">
        <p className="mb-2 text-sm font-semibold text-primary">By stage</p>
        <BarChart orientation="horizontal" data={stages} label="Mothers affected by stage" />
      </div>
      <div className="min-w-0 rounded-xl bg-primary p-4 ring-1 ring-secondary">
        <p className="mb-2 text-sm font-semibold text-primary">By area</p>
        {regions.length ? <BarChart orientation="horizontal" data={regions} label="Mothers affected by area" /> : <p className="py-6 text-center text-sm text-tertiary">No mothers on this device match yet.</p>}
      </div>
    </div>
  );
}

/** Two or three example mothers: her plan's item list before and after, with the change marked. */
export function ExampleMothers({ proposal, impact }: { proposal: RuleProposal; impact: ProposalImpact }) {
  const { state } = useApp();
  const examples = impact.examples.slice(0, 3);
  if (!examples.length) return <p className="text-sm text-tertiary">No mother on this device would see a change today.</p>;
  return (
    <div className="grid gap-3 lg:grid-cols-3" data-testid="example-mothers">
      {examples.map((ex, n) => {
        const m = state.mothers.find((x) => x.id === ex.motherId) as Mother | undefined;
        if (!m) return null;
        const pair = planPair(proposal, m, state.clock, { overrides: state.overrides.filter((o) => o.motherId === m.id), learnedRules: state.learnedRules });
        const beforeIds = new Set(pair?.before.items.filter((i) => i.status !== 'removed').map((i) => i.id) ?? []);
        const items = (pair?.after.items ?? []).filter((i) => i.status !== 'removed' || i.id === proposal.itemId);
        const merged = [
          ...items.filter((i) => i.status !== 'removed'),
          ...(pair?.before.items.filter((i) => i.id === proposal.itemId && i.status !== 'removed' && !items.some((x) => x.id === i.id && x.status !== 'removed')) ?? []),
        ]
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 7);
        if (!merged.some((i) => i.id === proposal.itemId)) {
          const t = [...(pair?.after.items ?? []), ...(pair?.before.items ?? [])].find((i) => i.id === proposal.itemId);
          if (t) merged.splice(Math.min(merged.length, 6), 1, t);
        }
        return (
          <div key={m.id} className="min-w-0 rounded-xl bg-primary p-4 ring-1 ring-secondary">
            <p className="text-sm font-semibold text-primary">Mother {String.fromCharCode(65 + n)}</p>
            <p className="mb-3 text-xs text-tertiary">{anonymous(m, pair?.before.state.stage ? STAGE_LABELS[pair.before.state.stage] : undefined)}</p>
            <ul className="grid gap-1">
              {merged.map((i) => {
                const target = i.id === proposal.itemId;
                const removed = target && (proposal.effect === 'remove' || !ex.after);
                const added = target && !beforeIds.has(i.id) && !removed;
                const changed = target && !added && !removed;
                return (
                  <li
                    key={i.id}
                    className={cx(
                      'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                      added && 'bg-success-primary text-success-primary',
                      removed && 'bg-error-primary text-error-primary line-through',
                      changed && 'bg-warning-primary text-warning-primary',
                      !target && 'text-secondary',
                    )}
                  >
                    <span aria-hidden="true" className="w-3 shrink-0 text-center font-semibold">
                      {added ? '+' : removed ? '−' : changed ? '~' : '·'}
                    </span>
                    <span className="min-w-0 truncate">{i.title}</span>
                    {target ? <span className="sr-only">{added ? '(added)' : removed ? '(removed)' : '(changed)'}</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Safety ----------

function SafetyRow({ ok, title, children }: { ok: boolean | 'warn'; title: string; children?: React.ReactNode }) {
  const Icon = ok === true ? CheckCircle : ok === 'warn' ? AlertTriangle : XCircle;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full', ok === true ? 'bg-success-primary text-fg-success-primary' : ok === 'warn' ? 'bg-warning-primary text-fg-warning-primary' : 'bg-error-primary text-fg-error-primary')}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">{title}</p>
        {children ? <div className="mt-0.5 text-sm text-tertiary">{children}</div> : null}
      </div>
    </li>
  );
}

export function SafetyPanel({ proposal, impact, before }: { proposal: RuleProposal; impact: ProposalImpact | null; before: PlanItem | null }) {
  const grade: EvidenceGrade = impact?.evidenceGrade ?? before?.evidence ?? 'expert';
  const sources = (before?.sources ?? []).slice(0, 4);
  const notes = (impact?.safetyNotes ?? []).filter((n) => !/^Danger-sign alerts/.test(n));
  return (
    <Card title={<span className="inline-flex items-center gap-2"><ShieldTick className="size-4.5 text-fg-brand-secondary" aria-hidden="true" /> Safety</span>}>
      <ul className="-my-3 divide-y divide-border-secondary" data-testid="safety-panel">
        <SafetyRow ok={!impact?.touchesLocked} title={impact?.touchesLocked ? 'Touches a locked safety item' : 'No locked safety item touched'}>
          {impact?.touchesLocked ? 'Locked items stay in every plan: only wording or timing can change.' : null}
        </SafetyRow>
        <SafetyRow ok={!impact?.conflictsWithGuideline} title={impact?.conflictsWithGuideline ? 'Conflicts with a guideline' : 'No conflict with a guideline'}>
          {impact?.conflictsWithGuideline}
        </SafetyRow>
        <SafetyRow ok={proposal.supportingWorkerIds.length >= 2 ? true : 'warn'} title={proposal.supportingWorkerIds.length >= 2 ? 'Independent workers agree' : 'Raised by one worker only'}>
          {proposal.supportingWorkerIds.length >= 2 ? null : 'Consider waiting for a second, independent worker.'}
        </SafetyRow>
        <SafetyRow ok title="Danger-sign alerts unaffected">
          Alerts are computed separately and no rule can change them.
        </SafetyRow>
      </ul>
      <div className="mt-4 rounded-lg bg-secondary p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
          <Grade g={grade} /> {gradeLabel(grade).label}
        </p>
        <p className="text-sm text-tertiary">{gradeLabel(grade).description}</p>
        {sources.length ? (
          <ul className="mt-2 grid gap-1 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex items-start gap-1.5">
                <BookOpen01 className="mt-0.5 size-3.5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                <SafeLink href={s.url}>{s.label}</SafeLink>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {notes.length ? (
        <ul className="mt-3 grid gap-1.5">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-secondary">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-fg-warning-secondary" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export const STATUS_BADGE: Record<RuleProposal['status'], { label: string; color: 'brand' | 'success' | 'error' | 'warning' }> = {
  pending: { label: 'Waiting for review', color: 'brand' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  needs_evidence: { label: 'Needs evidence', color: 'warning' },
};

export function StatusBadge({ status }: { status: RuleProposal['status'] }) {
  const s = STATUS_BADGE[status];
  return (
    <Badge color={s.color} type="pill-color" size="md">
      {s.label}
    </Badge>
  );
}
