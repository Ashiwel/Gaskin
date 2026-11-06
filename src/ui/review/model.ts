/**
 * Data for the expert review screen: impact simulation, timeline and release notes from src/engine,
 * memoised per proposal; plain-English conditions; a word diff for before and after.
 */
import { useMemo } from 'react';
import type { CarePlan, LearnedRule, Mother, Override, PlanItem, RuleCondition, RuleProposal } from '../../types';
import { buildPlan, proposalTimeline, releaseNotes, simulateProposalImpact, type ProposalImpact, type ReleaseNotes, type TimelineEntry } from '../../engine';
import { CONDITION_LABELS } from '../../clinical';
import { COUNTRIES } from '../../data';
import { useApp, usePlans } from '../../store';
import { STAGE_LABELS } from '../format';

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

export const EFFECT_LABEL: Record<string, string> = { remove: 'Remove', modify: 'Change', add: 'Add' };

/** Item titles from every current plan, so removals show a name rather than an id. */
export function useTitles() {
  const plans = usePlans();
  return useMemo(() => {
    const t = new Map<string, string>();
    for (const p of plans.values()) for (const i of p.items) if (!t.has(i.id)) t.set(i.id, i.title);
    return (id: string, fallback?: string) => fallback ?? t.get(id) ?? id.replace(/^[a-z]+\./, '').replace(/_/g, ' ');
  }, [plans]);
}

/** The item as it stands in today's plans (first mother who has it), for a before view with no affected mothers. */
export function useCurrentItem(itemId: string): PlanItem | null {
  const plans = usePlans();
  return useMemo(() => {
    for (const p of plans.values()) {
      const it = p.items.find((i) => i.id === itemId && i.status !== 'removed');
      if (it) return it;
    }
    return null;
  }, [plans, itemId]);
}

export interface ReviewData {
  impact: ProposalImpact | null;
  timeline: TimelineEntry[];
}

/** What approving this proposal would do today, across every mother on this device. */
export function useProposalData(p: RuleProposal): ReviewData {
  const { state } = useApp();
  const { mothers, clock, overrides, learnedRules } = state;
  const impact = useMemo(() => {
    try {
      return simulateProposalImpact(p, mothers, clock, { overrides, learnedRules });
    } catch {
      return null;
    }
  }, [p, mothers, clock, overrides, learnedRules]);
  const timeline = useMemo(() => {
    try {
      return proposalTimeline(p, overrides);
    } catch {
      return [];
    }
  }, [p, overrides]);
  return { impact, timeline };
}

/** A mother's plan before and after the candidate rule (for the example mothers). */
export function planPair(p: RuleProposal, m: Mother, clock: string, ctx: { overrides: Override[]; learnedRules: LearnedRule[] }): { before: CarePlan; after: CarePlan } | null {
  try {
    const candidate: LearnedRule = { id: `sim.${p.id}`, proposalId: p.id, appliesWhen: p.appliesWhen, effect: p.effect, itemId: p.itemId, item: p.item, approvedBy: 'simulation', approvedAt: '9999-12-31T00:00:00.000Z' };
    const before = buildPlan(m, clock, { overrides: ctx.overrides, learnedRules: ctx.learnedRules });
    const after = buildPlan(m, clock, { overrides: ctx.overrides, learnedRules: [...ctx.learnedRules, candidate] });
    return { before, after };
  } catch {
    return null;
  }
}

export function safeReleaseNotes(rules: LearnedRule[]): ReleaseNotes {
  try {
    return releaseNotes(rules);
  } catch {
    return { title: `${rules.length} changes`, entries: [], markdown: '' };
  }
}

export function nextVersion(v: string): string {
  const [a, b] = v.split('.').map((n) => parseInt(n, 10) || 0);
  return `${a}.${b + 1}`;
}

// ---------- Word diff ----------

export type DiffPart = { text: string; kind: 'same' | 'add' | 'del' };

/** Word-level diff (longest common subsequence), good enough for a sentence or two. */
export function wordDiff(a: string, b: string): DiffPart[] {
  const A = a.split(/(\s+)/).filter((x) => x !== '');
  const B = b.split(/(\s+)/).filter((x) => x !== '');
  if (A.length * B.length > 160_000) return [...(a ? [{ text: a, kind: 'del' as const }] : []), ...(b ? [{ text: b, kind: 'add' as const }] : [])];
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, kind: DiffPart['kind']) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      push(A[i], 'same');
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(A[i++], 'del');
    else push(B[j++], 'add');
  }
  while (i < A.length) push(A[i++], 'del');
  while (j < B.length) push(B[j++], 'add');
  return out;
}

/** "28, pregnant, Oyo": who an example mother is, without her name. */
export function anonymous(m: Mother, stage?: string): string {
  const band = `${Math.floor(m.age / 5) * 5} to ${Math.floor(m.age / 5) * 5 + 4}`;
  return `Aged ${band}${stage ? `, ${stage.toLowerCase()}` : ''}, ${m.region}`;
}
