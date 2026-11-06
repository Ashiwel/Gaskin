/**
 * Expert review. Proposals come from health workers who changed plans the same way; each shows its
 * status and evidence, a before/after diff, who proposed it and why, the impact on mothers today,
 * example mothers, and a safety panel. Clinical reviewers approve, reject or ask for evidence.
 * Releases gather approved changes into the next library version, with readable notes.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Clock, FileCheck02, GitCommit, Lock01, Rocket01, Users01 } from '@untitledui/icons';
import type { RuleProposal } from '../types';
import { stamp, useApp, useWorker } from '../store';
import { Button } from '../components/base/buttons/button';
import { Badge } from '../components/base/badges/badges';
import { KpiTile } from '../components/viz';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { Grade, gradeLabel, useToast } from './components';
import { fmtDate } from './format';
import { allowed, Card, hashTone, Initials, PageHeader, Segmented } from './messages/kit';
import { describeCondition, EFFECT_LABEL, nextVersion, safeReleaseNotes, useCurrentItem, useProposalData, useTitles } from './review/model';
import { ExampleMothers, ImpactPicture, PlanItemDiff, Proposers, SafetyPanel, StatusBadge } from './review/Parts';

export { describeCondition } from './review/model';

type View = 'proposals' | 'releases' | 'changes';

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ProposalCard({ p, open, onToggle, canReview }: { p: RuleProposal; open: boolean; onToggle: () => void; canReview: boolean }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const title = useTitles();
  const worker = useWorker();
  const { impact, timeline } = useProposalData(p);
  const current = useCurrentItem(p.itemId);
  const before = impact?.examples.find((e) => e.before)?.before ?? current;
  const [note, setNote] = useState('');
  const grade = impact?.evidenceGrade ?? before?.evidence ?? 'expert';
  const decided = p.status === 'approved' || p.status === 'rejected';
  const reviewer = p.reviewedBy ? state.workers.find((w) => w.id === p.reviewedBy) : undefined;
  const reviewers = state.workers.filter((w) => w.isClinicalReviewer);
  const workers = p.supportingWorkerIds.map((id) => state.workers.find((w) => w.id === id)).filter(Boolean);
  const name = title(p.itemId, p.item?.title);
  const decide = (decision: 'approved' | 'rejected' | 'needs_evidence') => {
    dispatch({ type: 'reviewProposal', id: p.id, decision, note: note.trim(), now: stamp(state.clock) });
    toast(decision === 'approved' ? 'Approved. It goes out in the next library release.' : decision === 'rejected' ? 'Rejected. The workers who raised it will see your note.' : 'Marked as needing more evidence.');
    setNote('');
  };

  return (
    <article className="proposal overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary" data-proposal={p.id}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer flex-wrap items-start gap-4 p-5 text-start hover:bg-primary_hover sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
              <Grade g={grade} /> {gradeLabel(grade).label}
            </span>
            <Badge size="sm" color="gray">
              {EFFECT_LABEL[p.effect] ?? p.effect}
            </Badge>
          </div>
          <h3 className="text-lg font-semibold text-primary">{name}</h3>
          <p className="mt-0.5 text-sm text-tertiary">{describeCondition(p.appliesWhen)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <div className="text-end">
            <p className="text-display-xs leading-none font-semibold text-primary tnum">{impact?.mothersAffected ?? '–'}</p>
            <p className="text-xs text-tertiary">mothers</p>
          </div>
          <div className="hidden -space-x-2 sm:flex" aria-label={`${workers.length} workers`}>
            {workers.slice(0, 4).map((w) => (
              <Initials key={w!.id} name={w!.name} tone={hashTone(w!.id)} size="sm" />
            ))}
          </div>
          <ChevronDown aria-hidden="true" className={cx('size-5 text-fg-quaternary transition', open && 'rotate-180')} />
        </div>
      </button>

      {open ? (
        <div className="grid gap-8 border-t border-secondary p-5">
          <Section title="The change">
            <PlanItemDiff proposal={p} before={before} />
            {p.rationale ? <p className="text-sm whitespace-pre-line text-secondary">{p.rationale}</p> : null}
          </Section>

          <Section title="Impact today">
            {impact ? (
              <>
                <ImpactPicture impact={impact} />
                <ExampleMothers proposal={p} impact={impact} />
              </>
            ) : (
              <p className="text-sm text-tertiary">The impact could not be worked out on this device.</p>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Section title="Who proposed it, and why">
              <Proposers proposal={p} timeline={timeline} />
            </Section>
            <SafetyPanel proposal={p} impact={impact} before={before} />
          </div>

          {decided ? (
            <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 ring-1 ring-secondary">
              {reviewer ? <Initials name={reviewer.name} tone={hashTone(reviewer.id)} /> : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {p.status === 'approved' ? 'Approved' : 'Rejected'} by {reviewer?.name ?? p.reviewedBy}, {fmtDate(p.reviewedAt, { year: true })}
                </p>
                {p.reviewNote ? <p className="mt-0.5 text-sm text-secondary">{p.reviewNote}</p> : null}
              </div>
            </div>
          ) : canReview ? (
            <section className="grid gap-3 rounded-xl bg-secondary p-4 ring-1 ring-secondary" aria-label="Your decision">
              <div className="flex items-center gap-2 text-sm text-tertiary">
                <Initials name={worker.name} tone={hashTone(worker.id)} size="sm" /> Deciding as <strong className="font-semibold text-primary">{worker.name}</strong>, clinical reviewer
              </div>
              {p.status === 'needs_evidence' && p.reviewNote ? <p className="text-sm text-warning-primary">Earlier request: {p.reviewNote}</p> : null}
              <label htmlFor={`note-${p.id}`} className="text-sm font-medium text-secondary">
                Your note to the workers
              </label>
              <textarea
                id={`note-${p.id}`}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example, agree for mothers already on daily iron-rich meals"
                className="w-full rounded-lg bg-primary p-3 text-md text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus-visible:ring-2 focus-visible:ring-brand"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button color="primary" onClick={() => decide('approved')} data-testid="approve">
                  Approve
                </Button>
                <Button color="secondary" isDisabled={!note.trim()} onClick={() => decide('needs_evidence')} data-testid="needs-evidence">
                  Needs evidence
                </Button>
                <Button color="secondary-destructive" isDisabled={!note.trim()} onClick={() => decide('rejected')} data-testid="reject">
                  Reject
                </Button>
                {!note.trim() ? <span className="text-xs text-tertiary">Rejecting or asking for evidence needs a note.</span> : null}
              </div>
            </section>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-secondary p-4 text-sm text-secondary ring-1 ring-secondary">
              <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
              Only a clinical reviewer can decide. {reviewers.length ? `${reviewers.map((w) => w.name).join(', ')} can approve this.` : 'No reviewer is set up yet.'}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function Releases({ canPublish }: { canPublish: boolean }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const title = useTitles();
  const next = nextVersion(state.libraryVersion);
  const pending = useMemo(() => safeReleaseNotes(state.pendingRules), [state.pendingRules]);
  const ver = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const history = [...state.releases].sort((a, b) => {
    const [a1, a2] = ver(a.version);
    const [b1, b2] = ver(b.version);
    return b1 - a1 || b2 - a2;
  });
  const who = (id: string) => state.workers.find((w) => w.id === id)?.name ?? id;
  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-secondary">Next release</p>
            <h3 className="text-display-xs font-semibold text-primary">Library v{next}</h3>
            <p className="text-sm text-tertiary">
              Now running v{state.libraryVersion}. {state.pendingRules.length ? `${state.pendingRules.length} approved change${state.pendingRules.length === 1 ? '' : 's'} waiting.` : 'Nothing waiting.'}
            </p>
          </div>
          {canPublish ? (
            <Button
              color="primary"
              iconLeading={Rocket01}
              isDisabled={!state.pendingRules.length}
              onClick={() => {
                dispatch({ type: 'publishRelease', now: stamp(state.clock) });
                toast(`Library v${next} published. Plans have been updated.`);
              }}
              data-testid="publish-release"
            >
              Publish v{next}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-tertiary">
              <Lock01 className="size-4" aria-hidden="true" /> Only a senior clinical reviewer can publish.
            </span>
          )}
        </div>
        {pending.entries.length ? (
          <ol className="mt-5 grid gap-2" data-testid="release-notes">
            {pending.entries.map((e) => (
              <li key={e.ruleId} className="flex items-start gap-3 rounded-lg bg-secondary p-3 ring-1 ring-secondary">
                <FileCheck02 className="mt-0.5 size-4.5 shrink-0 text-fg-success-secondary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">{e.change.replace(/"([a-z]+\.[a-z0-9_.]+)"/gi, (_m, id: string) => `"${title(id)}"`)}</p>
                  <p className="text-sm text-tertiary">
                    For {e.appliesTo.charAt(0).toLowerCase() + e.appliesTo.slice(1)}. Approved {fmtDate(e.approvedAt)} by {who(e.approvedBy)}.
                  </p>
                </div>
              </li>
            ))}
            <li className="text-xs text-tertiary">Danger-sign alerts are not affected by library changes.</li>
          </ol>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-secondary p-6 text-center text-sm text-tertiary">Approved changes wait here until a reviewer publishes them together.</p>
        )}
      </Card>

      <section aria-labelledby="hist-h">
        <h3 id="hist-h" className="mb-3 text-lg font-semibold text-primary">
          Past releases
        </h3>
        <ol className="relative grid gap-5 border-s-2 border-secondary ps-6">
          {history.map((r) => {
            const rules = state.learnedRules.filter((x) => r.ruleIds.includes(x.id));
            const notes = safeReleaseNotes(rules);
            return (
              <li key={r.version} className="relative">
                <span aria-hidden="true" className="absolute top-1 -start-[33px] flex size-4 items-center justify-center rounded-full bg-brand-solid ring-4 ring-[var(--color-bg-primary)]">
                  <GitCommit className="size-3 text-on-fill" />
                </span>
                <p className="text-md font-semibold text-primary">Library v{r.version}</p>
                <p className="text-sm text-tertiary">
                  {fmtDate(r.publishedAt, { year: true })} · {who(r.publishedBy)} · {r.ruleIds.length} change{r.ruleIds.length === 1 ? '' : 's'}
                </p>
                {notes.entries.length ? (
                  <ul className="mt-2 grid gap-1 text-sm text-secondary">
                    {notes.entries.map((e) => (
                      <li key={e.ruleId}>
                        {e.change.replace(/"([a-z]+\.[a-z0-9_.]+)"/gi, (_m, id: string) => `"${title(id)}"`)} for {e.appliesTo.charAt(0).toLowerCase() + e.appliesTo.slice(1)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PlanChanges() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const title = useTitles();
  const { go } = useNav();
  const worker = useWorker();
  const canEdit = allowed(worker, 'edit_plan');
  const overrides = [...state.overrides].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return (
    <div className="grid gap-6">
      <Card title="Learned rules in use">
        {state.learnedRules.length === 0 ? (
          <p className="text-sm text-tertiary">No learned rules yet. Every plan comes from the guideline rules.</p>
        ) : (
          <ul className="divide-y divide-border-secondary">
            {state.learnedRules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">
                    {EFFECT_LABEL[r.effect]} “{title(r.itemId, r.item?.title)}”
                  </p>
                  <p className="text-sm text-tertiary">{describeCondition(r.appliesWhen)}</p>
                </div>
                <span className="text-xs text-tertiary">
                  {state.workers.find((w) => w.id === r.approvedBy)?.name ?? r.approvedBy}, {fmtDate(r.approvedAt, { year: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Changes to individual plans">
        {overrides.length === 0 ? (
          <p className="text-sm text-tertiary">No one has changed a plan yet.</p>
        ) : (
          <ul className="divide-y divide-border-secondary">
            {overrides.map((o) => {
              const m = state.mothers.find((x) => x.id === o.motherId);
              const w = state.workers.find((x) => x.id === o.workerId);
              return (
                <li key={o.id} className={cx('grid gap-1 py-3', o.status === 'reverted' && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" color={o.action === 'remove' ? 'error' : o.action === 'add' ? 'success' : 'warning'}>
                      {EFFECT_LABEL[o.action]}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">{title(o.itemId, o.item?.title)}</span>
                    {o.proposeGlobal ? (
                      <Badge size="sm" color="brand">
                        Proposed for all
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-secondary">{o.reason}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-tertiary">
                    {w?.name ?? o.workerId} · {fmtDate(o.createdAt)} · for{' '}
                    {m ? (
                      <button type="button" className="cursor-pointer font-medium text-brand-secondary hover:underline" onClick={() => go({ name: 'patient', id: m.id, tab: 'plan' })}>
                        {m.name}
                      </button>
                    ) : (
                      'a mother'
                    )}
                    {o.status === 'active' && canEdit ? (
                      <button
                        type="button"
                        className="ml-auto cursor-pointer font-semibold text-brand-secondary hover:underline"
                        onClick={() => {
                          dispatch({ type: 'revertOverride', id: o.id });
                          toast('Change reverted. Her plan is back as the rules made it.');
                        }}
                      >
                        Revert
                      </button>
                    ) : o.status === 'reverted' ? (
                      <span className="ml-auto">Reverted</span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function Review() {
  const { state } = useApp();
  const worker = useWorker();
  const canReview = allowed(worker, 'approve_proposals');
  const canPublish = allowed(worker, 'publish_releases');
  const [view, setView] = useState<View>('proposals');
  const [show, setShow] = useState<'open' | 'decided'>('open');
  const open = state.proposals.filter((p) => p.status === 'pending' || p.status === 'needs_evidence');
  const decided = state.proposals.filter((p) => p.status === 'approved' || p.status === 'rejected');
  const list = show === 'open' ? open : decided;
  const [expanded, setExpanded] = useState<string | null>(() => open[0]?.id ?? null);
  const workersInvolved = new Set(open.flatMap((p) => p.supportingWorkerIds)).size;

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8">
      <PageHeader
        title="Expert review"
        lede="When health workers change plans the same way, Gaskin gathers their reasons into a proposal. A clinical reviewer decides, and approved changes go out together in a numbered library release. Gaskin never retrains itself live."
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary ring-1 ring-secondary">
            <Initials name={worker.name} tone={hashTone(worker.id)} size="sm" />
            {worker.name} · {canReview ? 'Clinical reviewer' : 'Can view only'}
          </span>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Waiting for review" value={String(open.filter((p) => p.status === 'pending').length)} icon={<Clock />} />
        <KpiTile label="Need more evidence" value={String(open.filter((p) => p.status === 'needs_evidence').length)} icon={<FileCheck02 />} />
        <KpiTile label="Approved, not yet released" value={String(state.pendingRules.length)} icon={<Rocket01 />} />
        <KpiTile label="Workers behind open proposals" value={String(workersInvolved)} icon={<Users01 />} />
      </section>

      <Segmented
        label="Review sections"
        value={view}
        onChange={setView}
        options={[
          { id: 'proposals', label: 'Proposals', count: open.length },
          { id: 'releases', label: 'Releases', count: state.pendingRules.length },
          { id: 'changes', label: 'Plan changes' },
        ]}
      />

      {view === 'proposals' ? (
        <section className="grid gap-4" aria-label="Proposals">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary">{show === 'open' ? 'Open proposals' : 'Decided'}</h2>
            <Segmented
              size="sm"
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { id: 'open', label: 'Open', count: open.length },
                { id: 'decided', label: 'Decided', count: decided.length },
              ]}
            />
          </div>
          {!canReview ? (
            <p className="flex items-start gap-2 text-sm text-tertiary">
              <Lock01 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> You are signed in as {worker.name}. You can read every proposal; only clinical reviewers can decide.
            </p>
          ) : null}
          {list.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm text-tertiary">
                {show === 'open' ? 'No proposals waiting. When a worker changes an item and ticks “Propose for every mother like her”, it appears here.' : 'Nothing decided yet.'}
              </p>
            </Card>
          ) : (
            list.map((p) => <ProposalCard key={p.id} p={p} canReview={canReview} open={expanded === p.id} onToggle={() => setExpanded(expanded === p.id ? null : p.id)} />)
          )}
        </section>
      ) : view === 'releases' ? (
        <Releases canPublish={canPublish} />
      ) : (
        <PlanChanges />
      )}
    </div>
  );
}
