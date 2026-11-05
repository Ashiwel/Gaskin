import { useMemo, useState } from 'react';
import type { RuleCondition, RuleProposal } from '../types';
import { stamp, useApp, usePlans, useWorker } from '../store';
import { deriveState, ruleMatches } from '../engine';
import { CONDITION_LABELS } from '../clinical';
import { COUNTRIES } from '../data';
import { useNav } from './nav';
import { Empty, useToast } from './components';
import { fmtDate, STAGE_LABELS } from './format';
import { ILock } from './icons';

const INCOME: Record<string, string> = { very_low: 'very low income', low: 'low income', middle: 'middle income', high: 'higher income' };

export function describeCondition(c: RuleCondition): string {
  const parts: string[] = [];
  if (c.stage) parts.push(STAGE_LABELS[c.stage].toLowerCase());
  if (c.conditionsAny?.length) parts.push(`with ${c.conditionsAny.map((x) => CONDITION_LABELS[x] ?? x).join(' or ')}`);
  if (c.riskCodesAny?.length) parts.push(`flagged for ${c.riskCodesAny.map((r) => r.replace(/_/g, ' ')).join(' or ')}`);
  if (c.incomeBands?.length) parts.push(`on ${c.incomeBands.map((b) => INCOME[b] ?? b).join(' or ')}`);
  if (c.countries?.length) parts.push(`in ${c.countries.map((k) => COUNTRIES[k]?.name ?? k).join(' or ')}`);
  if (c.minAge !== undefined || c.maxAge !== undefined) {
    if (c.minAge !== undefined && c.maxAge !== undefined) parts.push(`aged ${c.minAge} to ${c.maxAge}`);
    else if (c.minAge !== undefined) parts.push(`aged ${c.minAge} or over`);
    else parts.push(`aged ${c.maxAge} or under`);
  }
  return parts.length ? `Mothers ${parts.join(', ')}` : 'All mothers';
}

const EFFECT: Record<string, string> = { remove: 'Remove', modify: 'Change', add: 'Add' };

/** Item titles from every current plan, so removals show a name rather than an id. */
function useTitles() {
  const plans = usePlans();
  return useMemo(() => {
    const t = new Map<string, string>();
    for (const p of plans.values()) for (const i of p.items) if (!t.has(i.id)) t.set(i.id, i.title);
    return (id: string, fallback?: string) => fallback ?? t.get(id) ?? id.replace(/^[a-z]+\./, '').replace(/_/g, ' ');
  }, [plans]);
}

function useAffected() {
  const { state } = useApp();
  return useMemo(() => {
    const states = state.mothers.map((m) => {
      try {
        return { m, s: deriveState(m, state.clock) };
      } catch {
        return null;
      }
    });
    return (c: RuleCondition) =>
      states.filter((x) => {
        if (!x) return false;
        try {
          return ruleMatches(c, x.m, x.s);
        } catch {
          return false;
        }
      }).length;
  }, [state.mothers, state.clock]);
}

function ProposalCard({ p, canReview, affected }: { p: RuleProposal; canReview: boolean; affected: number }) {
  const { state, dispatch } = useApp();
  const title = useTitles();
  const toast = useToast();
  const { go } = useNav();
  const [note, setNote] = useState('');
  const supporting = state.overrides.filter((o) => p.supportingOverrideIds.includes(o.id));
  const workers = p.supportingWorkerIds.length;
  const decide = (decision: 'approved' | 'rejected' | 'needs_evidence') => {
    dispatch({ type: 'reviewProposal', id: p.id, decision, note: note.trim(), now: stamp(state.clock) });
    toast(decision === 'approved' ? 'Approved. It will go out in the next library release.' : decision === 'rejected' ? 'Rejected. The workers who raised it will see your note.' : 'Marked as needing more evidence.');
    setNote('');
  };
  const reviewer = p.reviewedBy ? state.workers.find((w) => w.id === p.reviewedBy)?.name : undefined;
  return (
    <article className="proposal" data-proposal={p.id}>
      <div className="proposal-head">
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="t-label">
            {EFFECT[p.effect] ?? p.effect}: {title(p.itemId, p.item?.title)}
          </span>
          <h3 className="t-h2">{p.title.replace(/["“']([a-z]+\.[a-z0-9_.]+)["”']/gi, (_m, id: string) => `“${title(id)}”`)}</h3>
        </div>
        <span className={`chip ${p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : p.status === 'needs_evidence' ? 'amber' : 'clay'}`}>
          {p.status === 'pending' ? 'Waiting for review' : p.status === 'needs_evidence' ? 'Needs evidence' : p.status[0].toUpperCase() + p.status.slice(1)}
        </span>
      </div>
      <dl className="kv">
        <dt>Applies to</dt>
        <dd>{describeCondition(p.appliesWhen)}</dd>
        <dt>Would affect</dt>
        <dd className="num">
          {affected} mother{affected === 1 ? '' : 's'} on the current caseload
        </dd>
        <dt>Raised by</dt>
        <dd>
          {workers} health worker{workers === 1 ? '' : 's'}
          {workers >= 3 ? ', enough agreement to review' : workers === 1 ? ', usually needs at least 3' : ''}
        </dd>
        <dt>Rationale</dt>
        <dd>{p.rationale}</dd>
      </dl>
      {supporting.length ? (
        <ul className="support">
          {supporting.map((o) => {
            const w = state.workers.find((x) => x.id === o.workerId);
            const m = state.mothers.find((x) => x.id === o.motherId);
            return (
              <li key={o.id}>
                <q>{o.reason}</q>
                <span className="muted">
                  {w?.name ?? o.workerId}, {w ? `${w.yearsExperience} years` : ''} · for{' '}
                  {m ? (
                    <button className="link-btn" onClick={() => go({ name: 'patient', id: m.id, tab: 'plan' })}>
                      {m.name}
                    </button>
                  ) : (
                    'a mother'
                  )}{' '}
                  · {fmtDate(o.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {p.status === 'pending' || p.status === 'needs_evidence' ? (
        canReview ? (
          <div className="inline-form">
            <label className="field">
              <span>Your note</span>
              <input className="input" id={`note-${p.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Agree for mothers already on daily iron-rich meals" />
            </label>
            <div className="btn-row">
              <button className="btn small primary" onClick={() => decide('approved')} data-testid="approve">
                Approve
              </button>
              <button className="btn small" onClick={() => decide('needs_evidence')} disabled={!note.trim()}>
                Needs evidence
              </button>
              <button className="btn small" onClick={() => decide('rejected')} disabled={!note.trim()}>
                Reject
              </button>
            </div>
            {!note.trim() ? <span className="tiny muted">Rejecting or asking for evidence needs a note.</span> : null}
          </div>
        ) : (
          <p className="note">
            <ILock /> Only a clinical reviewer can decide. {state.workers.filter((w) => w.isClinicalReviewer).map((w) => w.name).join(', ') || 'No reviewer is set up'} can approve this.
          </p>
        )
      ) : (
        <p className="small soft">
          {reviewer ? `${reviewer}, ${fmtDate(p.reviewedAt)}` : ''}
          {p.reviewNote ? `: “${p.reviewNote}”` : ''}
        </p>
      )}
    </article>
  );
}

export function Review() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const { go } = useNav();
  const affected = useAffected();
  const title = useTitles();
  const [show, setShow] = useState<'open' | 'decided'>('open');
  const canReview = Boolean(worker?.isClinicalReviewer);
  const open = state.proposals.filter((p) => p.status === 'pending' || p.status === 'needs_evidence');
  const decided = state.proposals.filter((p) => p.status === 'approved' || p.status === 'rejected');
  const list = show === 'open' ? open : decided;
  const overrides = [...state.overrides].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const nextVersion = (() => {
    const [a, b] = state.libraryVersion.split('.').map((n) => parseInt(n, 10) || 0);
    return `${a}.${b + 1}`;
  })();

  return (
    <div className="page narrow">
      <header className="today-head">
        <h1 className="t-display">Expert review</h1>
        <p className="lede">
          When health workers change plans the same way, Gaskin gathers their reasons into a proposal. Changes are reviewed by the clinical board and released on a schedule. Gaskin never retrains itself live.
        </p>
      </header>

      <section className="release" aria-label="Next library release">
        <div className="section-head">
          <strong className="serif" style={{ fontSize: 21, fontWeight: 500 }}>
            Library v{nextVersion}
          </strong>
          <span className="small muted">
            Now running v{state.libraryVersion} · {state.pendingRules.length ? `pending release, ${state.pendingRules.length} change${state.pendingRules.length === 1 ? '' : 's'}` : 'nothing waiting'}
          </span>
        </div>
        {state.pendingRules.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
            {state.pendingRules.map((r) => (
              <li key={r.id}>
                {EFFECT[r.effect]} “{title(r.itemId, r.item?.title)}” for {describeCondition(r.appliesWhen).toLowerCase()} (affects {affected(r.appliesWhen)})
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Approved changes wait here until the board publishes them together.</p>
        )}
        <div className="btn-row">
          <button
            className="btn small"
            disabled={!state.pendingRules.length || !canReview}
            onClick={() => {
              dispatch({ type: 'publishRelease', now: stamp(state.clock) });
              toast(`Library v${nextVersion} published. Plans have been updated.`);
            }}
            data-testid="publish-release"
          >
            Publish release
          </button>
          {!canReview ? <span className="small muted">Only a clinical reviewer can publish.</span> : null}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h2">Proposals</h2>
          <div className="seg" role="group" aria-label="Show">
            <button aria-pressed={show === 'open'} onClick={() => setShow('open')}>
              Open {open.length ? `(${open.length})` : ''}
            </button>
            <button aria-pressed={show === 'decided'} onClick={() => setShow('decided')}>
              Decided {decided.length ? `(${decided.length})` : ''}
            </button>
          </div>
        </div>
        {!canReview ? (
          <p className="note">
            <ILock /> You are signed in as {worker?.name}. Only clinical reviewers can approve. Switch worker in the demo panel to act as a reviewer.
          </p>
        ) : null}
        {list.length === 0 ? (
          <Empty art="talk_to_someone" title={show === 'open' ? 'No proposals waiting' : 'Nothing decided yet'}>
            {show === 'open' ? 'When a worker removes or adds an item and ticks “Propose for every mother like her”, it appears here.' : ''}
          </Empty>
        ) : (
          list.map((p) => <ProposalCard key={p.id} p={p} canReview={canReview} affected={affected(p.appliesWhen)} />)
        )}
      </section>

      <section className="section">
        <h2 className="t-h2">Learned rules in use</h2>
        {state.learnedRules.length === 0 ? (
          <p className="soft">No learned rules yet. Every plan comes from the guideline rules.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Applies to</th>
                  <th style={{ textAlign: 'right' }}>Mothers now</th>
                  <th>Approved</th>
                </tr>
              </thead>
              <tbody>
                {state.learnedRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {EFFECT[r.effect]} “{title(r.itemId, r.item?.title)}”
                    </td>
                    <td>{describeCondition(r.appliesWhen)}</td>
                    <td className="n">{affected(r.appliesWhen)}</td>
                    <td>
                      {state.workers.find((w) => w.id === r.approvedBy)?.name ?? r.approvedBy}, {fmtDate(r.approvedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="t-h2">Changes to individual plans</h2>
        {overrides.length === 0 ? (
          <p className="soft">No one has changed a plan yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mother</th>
                  <th>Change</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => {
                  const m = state.mothers.find((x) => x.id === o.motherId);
                  const w = state.workers.find((x) => x.id === o.workerId);
                  return (
                    <tr key={o.id} style={{ opacity: o.status === 'reverted' ? 0.55 : 1 }}>
                      <td>
                        {m ? (
                          <button className="link-btn" onClick={() => go({ name: 'patient', id: m.id, tab: 'plan' })}>
                            {m.name}
                          </button>
                        ) : (
                          o.motherId
                        )}
                      </td>
                      <td>
                        {EFFECT[o.action]} “{title(o.itemId, o.item?.title)}”{o.proposeGlobal ? <span className="chip clay" style={{ marginLeft: 6 }}>Proposed for all</span> : null}
                      </td>
                      <td>{o.reason}</td>
                      <td>
                        {w?.name ?? o.workerId}
                        <div className="tiny muted">{fmtDate(o.createdAt)}</div>
                      </td>
                      <td>
                        {o.status === 'active' ? (
                          <button className="link-btn" onClick={() => { dispatch({ type: 'revertOverride', id: o.id }); toast('Change reverted. Her plan is back as the rules made it.'); }}>
                            Revert
                          </button>
                        ) : (
                          <span className="tiny muted">Reverted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
