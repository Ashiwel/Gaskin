import type { EvidenceGrade, JourneyStage, LearnedRule, Mother, Override, PatientState, PlanItem, RuleCondition, RuleProposal } from '../types';
import { buildPlan, type PlanContext } from './plan';

/** All present fields must match. Empty condition matches everyone. */
export function ruleMatches(cond: RuleCondition, mother: Mother, state: PatientState): boolean {
  if (cond.stage && cond.stage !== state.stage) return false;
  if (cond.conditionsAny?.length && !cond.conditionsAny.some((c) => mother.conditions.includes(c))) return false;
  if (cond.riskCodesAny?.length && !cond.riskCodesAny.some((r) => state.risks.some((x) => x.code === r))) return false;
  if (cond.incomeBands?.length && !cond.incomeBands.includes(mother.incomeBand)) return false;
  if (cond.countries?.length && !cond.countries.includes(mother.country)) return false;
  if (cond.minAge !== undefined && mother.age < cond.minAge) return false;
  if (cond.maxAge !== undefined && mother.age > cond.maxAge) return false;
  return true;
}

type Effect = { action: Override['action']; itemId: string; item?: Override['item']; sourceId: string };

/**
 * Apply one change to the item list.
 * - remove: locked items are kept unchanged (safety-critical items need a clinical rule change, not an override)
 * - modify: replace fields; id, origin and locked stay; overriddenBy is set
 * - add: new item, or replace an earlier added item with the same id
 */
export function applyEffect(items: PlanItem[], e: Effect, kind: 'override' | 'learned'): PlanItem[] {
  const idx = items.findIndex((i) => i.id === e.itemId);
  const existing = idx >= 0 ? items[idx] : undefined;
  if (e.action === 'remove') {
    if (!existing || existing.locked) return items;
    const next = items.slice();
    next[idx] = { ...existing, status: 'removed', overriddenBy: e.sourceId };
    return next;
  }
  if (e.action === 'modify') {
    if (!existing || !e.item) return items;
    // A locked (safety-critical) item can be changed only by an approved clinical rule, never by one
    // worker's override: otherwise "modify" could rewrite a danger-sign line or set it to 'removed'.
    if (existing.locked && kind === 'override') return items;
    const { id: _id, origin: _origin, locked: _locked, overriddenBy: _ob, status: statusIn, ...fields } = e.item as Partial<PlanItem>;
    void _id;
    void _origin;
    void _locked;
    void _ob;
    // "modify" changes wording and timing; it never removes. Removal is its own action, with its own lock check.
    const status = statusIn === 'active' || statusIn === 'done' ? statusIn : undefined;
    const next = items.slice();
    next[idx] = {
      ...existing,
      ...stripUndefined(fields),
      ...(fields.sources !== undefined ? { sources: safeSources(fields.sources) } : {}),
      // A learned rule that modifies a guideline item is expert-graded; a single worker's edit keeps the guideline grade.
      evidence: kind === 'learned' ? (fields.evidence ?? 'expert') : (fields.evidence ?? existing.evidence),
      status: existing.status === 'removed' ? existing.status : (status ?? existing.status),
      // Free-text replacement is no longer the template; drop the key so translators are not misled.
      ...(fields.motherText !== undefined && fields.motherTextKey === undefined ? { motherTextKey: undefined, motherTextParams: undefined } : {}),
      overriddenBy: e.sourceId,
    };
    return next;
  }
  // add
  if (!e.item) return items;
  const base: PlanItem = {
    id: e.itemId,
    category: e.item.category ?? 'education',
    title: e.item.title,
    detail: e.item.detail ?? e.item.title,
    motherText: e.item.motherText ?? e.item.title,
    motherTextKey: e.item.motherTextKey,
    motherTextParams: e.item.motherTextParams,
    priority: e.item.priority ?? 3,
    audience: e.item.audience ?? 'both',
    timing: e.item.timing,
    dueDate: e.item.dueDate,
    evidence: kind === 'learned' ? 'expert' : 'C',
    sources: safeSources(e.item.sources),
    because: Array.isArray(e.item.because) ? e.item.because.filter((b) => typeof b === 'string') : [],
    origin: kind === 'learned' ? 'learned_rule' : 'worker_added',
    illustration: e.item.illustration,
    status: 'active',
    overriddenBy: e.sourceId,
  };
  if (existing) {
    if (existing.locked) return items; // never replace a safety-critical guideline item through "add"
    const next = items.slice();
    next[idx] = base;
    return next;
  }
  return [...items, base];
}

export function applyLearnedRules(items: PlanItem[], rules: LearnedRule[], mother: Mother, state: PatientState): PlanItem[] {
  let out = items;
  for (const r of [...rules].sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.id.localeCompare(b.id))) {
    if (!ruleMatches(r.appliesWhen, mother, state)) continue;
    out = applyEffect(out, { action: r.effect, itemId: r.itemId, item: r.item, sourceId: r.id }, 'learned');
  }
  return out;
}

export function applyOverrides(items: PlanItem[], overrides: Override[], motherId: string): PlanItem[] {
  let out = items;
  const mine = overrides
    .filter((o) => o.motherId === motherId && o.status === 'active')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const o of mine) out = applyEffect(out, { action: o.action, itemId: o.itemId, item: o.item, sourceId: o.id }, 'override');
  return out;
}

/**
 * Sources on items that came from a worker, an import or a sync are rendered as links. Only http(s)
 * links survive, so a "javascript:" or "data:" URL typed or synced into a record can never run on click.
 */
export function safeSources(sources: unknown): PlanItem['sources'] {
  if (!Array.isArray(sources)) return [];
  const out: PlanItem['sources'] = [];
  for (const s of sources.slice(0, 20)) {
    if (!s || typeof s !== 'object') continue;
    const c = s as { id?: unknown; label?: unknown; url?: unknown };
    const label = typeof c.label === 'string' ? c.label.slice(0, 200) : '';
    if (!label) continue;
    const url = typeof c.url === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(c.url.trim()) ? c.url.trim() : undefined;
    out.push({ id: typeof c.id === 'string' ? c.id.slice(0, 80) : label.slice(0, 80), label, ...(url ? { url } : {}) });
  }
  return out;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---------- Proposals ----------

/** Situation in which a worker's change should apply to others: same stage, her conditions and risk codes. */
export function situationOf(mother: Mother, state: PatientState): RuleCondition {
  const cond: RuleCondition = { stage: state.stage };
  if (mother.conditions.length) cond.conditionsAny = [...mother.conditions].sort();
  const riskCodes = state.risks.filter((r) => r.severity !== 'low').map((r) => r.code).sort();
  if (riskCodes.length) cond.riskCodesAny = riskCodes;
  return cond;
}

/** Similar = same stage, and they share at least one condition or risk code (or both have none). */
function similar(a: RuleCondition, b: RuleCondition): boolean {
  if ((a.stage ?? null) !== (b.stage ?? null)) return false;
  const ac = new Set([...(a.conditionsAny ?? []), ...(a.riskCodesAny ?? [])]);
  const bc = [...(b.conditionsAny ?? []), ...(b.riskCodesAny ?? [])];
  if (ac.size === 0 && bc.length === 0) return true;
  return bc.some((x) => ac.has(x));
}

/** Narrow the shared condition to what both situations have in common. */
function intersect(a: RuleCondition, b: RuleCondition): RuleCondition {
  const out: RuleCondition = { stage: a.stage };
  const cond = (a.conditionsAny ?? []).filter((x) => (b.conditionsAny ?? []).includes(x));
  const risk = (a.riskCodesAny ?? []).filter((x) => (b.riskCodesAny ?? []).includes(x));
  if (cond.length) out.conditionsAny = cond;
  if (risk.length) out.riskCodesAny = risk;
  if (!cond.length && !risk.length) {
    // Shared via condition-vs-risk overlap only: keep whichever side is non-empty in a.
    if (a.conditionsAny?.length) out.conditionsAny = a.conditionsAny;
    if (a.riskCodesAny?.length) out.riskCodesAny = a.riskCodesAny;
  }
  return out;
}

export function upsertProposal(override: Override, mother: Mother, state: PatientState, proposals: RuleProposal[], now: string): RuleProposal[] {
  if (!override.proposeGlobal) return proposals;
  const situation = situationOf(mother, state);
  const idx = proposals.findIndex(
    (p) => (p.status === 'pending' || p.status === 'needs_evidence') && p.itemId === override.itemId && p.effect === override.action && similar(p.appliesWhen, situation),
  );
  if (idx >= 0) {
    const p = proposals[idx];
    const updated: RuleProposal = {
      ...p,
      appliesWhen: intersect(p.appliesWhen, situation),
      supportingOverrideIds: p.supportingOverrideIds.includes(override.id) ? p.supportingOverrideIds : [...p.supportingOverrideIds, override.id],
      supportingWorkerIds: p.supportingWorkerIds.includes(override.workerId) ? p.supportingWorkerIds : [...p.supportingWorkerIds, override.workerId],
      item: override.item ?? p.item,
      rationale: p.rationale.includes(override.reason) ? p.rationale : `${p.rationale}\n• ${override.reason}`,
      status: 'pending',
    };
    const next = proposals.slice();
    next[idx] = updated;
    return next;
  }
  const verb = override.action === 'remove' ? 'Remove' : override.action === 'modify' ? 'Change' : 'Add';
  const created: RuleProposal = {
    id: `prop.${override.id}`,
    title: `${verb} "${override.item?.title ?? override.itemId}" for ${describe(situation)}`,
    appliesWhen: situation,
    effect: override.action,
    itemId: override.itemId,
    item: override.item,
    rationale: `• ${override.reason}`,
    supportingOverrideIds: [override.id],
    supportingWorkerIds: [override.workerId],
    status: 'pending',
    createdAt: now,
    createdBy: override.workerId,
  };
  return [...proposals, created];
}

export function approveProposal(p: RuleProposal, reviewerId: string, note: string, now: string): { proposal: RuleProposal; rule: LearnedRule } {
  const proposal: RuleProposal = { ...p, status: 'approved', reviewedBy: reviewerId, reviewNote: note, reviewedAt: now };
  const rule: LearnedRule = {
    id: `rule.${p.id.replace(/^prop\./, '')}`,
    proposalId: p.id,
    appliesWhen: p.appliesWhen,
    effect: p.effect,
    itemId: p.itemId,
    item: p.item,
    approvedBy: reviewerId,
    approvedAt: now,
  };
  return { proposal, rule };
}

function describe(c: RuleCondition): string {
  const parts = [c.stage ? `${c.stage} stage` : 'all stages'];
  if (c.conditionsAny?.length) parts.push(`with ${c.conditionsAny.map((x) => x.replace(/_/g, ' ')).join(' or ')}`);
  else if (c.riskCodesAny?.length) parts.push(`with ${c.riskCodesAny.slice(0, 3).map((x) => x.replace(/_/g, ' ')).join(' or ')}`);
  return `women in ${parts.join(' ')}`;
}

// ---------- Expert review: impact, timeline and release notes ----------

export interface ProposalImpact {
  mothersAffected: number;
  byStage: Record<JourneyStage, number>;
  byRegion: Record<string, number>;
  /** Up to 6 affected mothers: the item before and after the change (null = absent or removed) */
  examples: Array<{ motherId: string; before: PlanItem | null; after: PlanItem | null }>;
  /** The change targets a locked (safety-critical) item for at least one mother */
  touchesLocked: boolean;
  /** Plain reason when the change would contradict a guideline item (removing or weakening a locked or grade-A item) */
  conflictsWithGuideline: string | null;
  /** Grade of the evidence behind the item being changed (worst case across affected mothers), or 'expert' for a new item */
  evidenceGrade: EvidenceGrade;
  safetyNotes: string[];
}

const STAGES: JourneyStage[] = ['preconception', 'pregnancy', 'postpartum', 'infant'];

/**
 * What would happen if this proposal were approved today: rebuild each mother's plan with and
 * without the candidate rule and compare the target item. Danger-sign alerts are never affected
 * (they sit outside the rule layer), and the notes say so.
 */
export function simulateProposalImpact(proposal: RuleProposal, mothers: Mother[], asOf: string, ctx: PlanContext): ProposalImpact {
  const candidate: LearnedRule = {
    id: `sim.${proposal.id}`,
    proposalId: proposal.id,
    appliesWhen: proposal.appliesWhen,
    effect: proposal.effect,
    itemId: proposal.itemId,
    item: proposal.item,
    approvedBy: 'simulation',
    approvedAt: '9999-12-31T00:00:00.000Z',
  };
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<JourneyStage, number>;
  const byRegion: Record<string, number> = {};
  const examples: ProposalImpact['examples'] = [];
  const notes = new Set<string>();
  let affected = 0;
  let touchesLocked = false;
  let conflict: string | null = null;
  let grade: EvidenceGrade | undefined;
  const rank: Record<EvidenceGrade, number> = { A: 0, B: 1, C: 2, trad_harmful: 3, trad_supported: 4, trad_plausible: 5, trad_neutral: 6, expert: 7 };
  for (const m of mothers) {
    const before = buildPlan(m, asOf, { ...ctx, previous: undefined });
    if (!ruleMatches(proposal.appliesWhen, m, before.state)) continue;
    const after = buildPlan(m, asOf, { ...ctx, previous: undefined, learnedRules: [...(ctx.learnedRules ?? []), candidate] });
    const b = before.items.find((i) => i.id === proposal.itemId) ?? null;
    const a = after.items.find((i) => i.id === proposal.itemId) ?? null;
    const visibleBefore = b && b.status !== 'removed' ? b : null;
    const visibleAfter = a && a.status !== 'removed' ? a : null;
    const changed = JSON.stringify(visibleBefore) !== JSON.stringify(visibleAfter);
    if (b?.locked) {
      touchesLocked = true;
      notes.add(`"${b.title}" is locked (safety-critical) for some mothers: ${proposal.effect === 'remove' ? 'it stays in their plans; a remove cannot take it out' : 'only non-safety fields can change'}.`);
    }
    if (b && (!grade || rank[b.evidence] < rank[grade])) grade = b.evidence;
    if (!changed) continue;
    affected++;
    byStage[before.state.stage]++;
    byRegion[m.region] = (byRegion[m.region] ?? 0) + 1;
    if (examples.length < 6) examples.push({ motherId: m.id, before: visibleBefore, after: visibleAfter });
    if (b && b.evidence === 'A' && (proposal.effect === 'remove' || (proposal.effect === 'modify' && proposal.item?.priority !== undefined && proposal.item.priority > b.priority))) {
      conflict = conflict ?? `${proposal.effect === 'remove' ? 'Removes' : 'Lowers the priority of'} "${b.title}", a strong guideline recommendation (grade A: ${b.sources[0]?.label ?? 'guideline'}).`;
    }
    if (b && b.category === 'danger_signs') notes.add('Changes danger-sign education: check the change keeps every danger sign and the action to take.');
    if (b && b.category === 'medication' && proposal.effect !== 'add') notes.add('Changes a medicine item: check dose, timing and contraindications against the national guideline.');
  }
  if (proposal.effect === 'add' && proposal.item?.category === 'medication') notes.add('Adds a medicine: confirm it is on the national essential medicines list and within the worker’s scope (standing orders).');
  if (proposal.item?.motherText && !proposal.item.motherTextKey) notes.add('New mother text has no translation key yet: it will show in English until a language pack adds it.');
  if (proposal.supportingWorkerIds.length < 2) notes.add('Supported by one worker only: consider waiting for a second, independent worker.');
  notes.add('Danger-sign alerts are computed separately and cannot be changed by any rule.');
  return {
    mothersAffected: affected,
    byStage,
    byRegion,
    examples,
    touchesLocked,
    conflictsWithGuideline: conflict,
    evidenceGrade: proposal.effect === 'add' && !grade ? 'expert' : (grade ?? 'expert'),
    safetyNotes: [...notes],
  };
}

export interface TimelineEntry {
  at: string;
  kind: 'override' | 'support' | 'proposal_created' | 'reviewed' | 'reverted';
  actorId: string;
  text: string;
  overrideId?: string;
  motherId?: string;
}

/** The story of a proposal, oldest first: each supporting override, creation, review. */
export function proposalTimeline(proposal: RuleProposal, overrides: Override[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const support = overrides.filter((o) => proposal.supportingOverrideIds.includes(o.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const seenWorkers = new Set<string>();
  for (const [i, o] of support.entries()) {
    const verb = o.action === 'remove' ? 'removed' : o.action === 'modify' ? 'changed' : 'added';
    out.push({ at: o.createdAt, kind: i === 0 ? 'override' : 'support', actorId: o.workerId, overrideId: o.id, motherId: o.motherId, text: `${seenWorkers.has(o.workerId) ? 'Same worker' : i === 0 ? 'First worker' : 'Another worker'} ${verb} "${o.item?.title ?? o.itemId}" for one mother: ${o.reason}` });
    seenWorkers.add(o.workerId);
    if (o.status === 'reverted') out.push({ at: o.revertedAt ?? o.createdAt, kind: 'reverted', actorId: o.revertedBy ?? o.workerId, overrideId: o.id, motherId: o.motherId, text: 'This override was reverted for the mother.' });
  }
  out.push({ at: proposal.createdAt, kind: 'proposal_created', actorId: proposal.createdBy ?? support[0]?.workerId ?? 'system', text: `Proposal raised: ${proposal.title}` });
  if (proposal.reviewedAt && proposal.reviewedBy) out.push({ at: proposal.reviewedAt, kind: 'reviewed', actorId: proposal.reviewedBy, text: `${proposal.status === 'approved' ? 'Approved' : proposal.status === 'rejected' ? 'Rejected' : 'Sent back for evidence'}${proposal.reviewNote ? `: ${proposal.reviewNote}` : ''}` });
  return out.sort((a, b) => a.at.localeCompare(b.at) || (a.kind === 'proposal_created' ? 1 : 0) - (b.kind === 'proposal_created' ? 1 : 0));
}

export interface ReleaseNotes {
  title: string;
  /** One entry per rule, newest first */
  entries: Array<{ ruleId: string; approvedAt: string; approvedBy: string; change: string; appliesTo: string; itemId: string }>;
  /** Markdown, ready to paste or show */
  markdown: string;
}

/** Plain-English release notes for a set of approved learned rules. */
export function releaseNotes(rules: LearnedRule[]): ReleaseNotes {
  const entries = [...rules]
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || a.id.localeCompare(b.id))
    .map((r) => {
      const what = r.item?.title ?? r.itemId;
      const change = r.effect === 'remove' ? `Removed "${what}"` : r.effect === 'modify' ? `Changed "${what}"` : `Added "${what}"`;
      return { ruleId: r.id, approvedAt: r.approvedAt, approvedBy: r.approvedBy, change, appliesTo: describe(r.appliesWhen), itemId: r.itemId };
    });
  const latest = entries[0]?.approvedAt.slice(0, 10);
  const title = entries.length ? `Gaskin clinical library update (${latest}): ${entries.length} change${entries.length > 1 ? 's' : ''}` : 'No approved changes';
  const markdown = [`# ${title}`, '', ...entries.map((e) => `- ${e.change} for ${e.appliesTo}. Approved ${e.approvedAt.slice(0, 10)} by ${e.approvedBy}. (${e.ruleId})`), '', 'Danger-sign alerts are not affected by library changes.'].join('\n');
  return { title, entries, markdown };
}
