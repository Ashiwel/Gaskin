import type { LearnedRule, Mother, Override, PatientState, PlanItem, RuleCondition, RuleProposal } from '../types';

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
    const { id: _id, origin: _origin, locked: _locked, overriddenBy: _ob, ...fields } = e.item as Partial<PlanItem>;
    void _id;
    void _origin;
    void _locked;
    void _ob;
    const next = items.slice();
    next[idx] = {
      ...existing,
      ...stripUndefined(fields),
      // A learned rule that modifies a guideline item is expert-graded; a single worker's edit keeps the guideline grade.
      evidence: kind === 'learned' ? (fields.evidence ?? 'expert') : (fields.evidence ?? existing.evidence),
      status: fields.status ?? existing.status,
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
    sources: e.item.sources ?? [],
    because: e.item.because ?? [],
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
