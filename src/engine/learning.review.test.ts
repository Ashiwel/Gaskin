import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data';
import { proposalTimeline, releaseNotes, simulateProposalImpact } from './index';
import type { RuleProposal } from '../types';

const seed = createSeedState();
const ctx = { overrides: [], learnedRules: seed.learnedRules };

describe('expert review data', () => {
  it('simulates the pending ogi proposal: who is affected, where, before and after', () => {
    const p = seed.proposals.find((x) => x.id === 'prop.ov-001')!;
    const imp = simulateProposalImpact(p, seed.mothers, seed.clock, ctx);
    expect(imp.mothersAffected).toBeGreaterThan(0);
    expect(imp.byStage.postpartum).toBe(imp.mothersAffected);
    expect(imp.byStage.pregnancy).toBe(0);
    expect(Object.values(imp.byRegion).reduce((a, b) => a + b, 0)).toBe(imp.mothersAffected);
    expect(imp.examples[0].before).toBeNull();
    expect(imp.examples[0].after?.origin).toBe('learned_rule');
    expect(imp.touchesLocked).toBe(false);
    expect(imp.conflictsWithGuideline).toBeNull();
    expect(imp.evidenceGrade).toBe('expert');
    expect(imp.safetyNotes.join(' ')).toMatch(/Danger-sign alerts/);
    expect(imp.safetyNotes.join(' ')).toMatch(/translation key/);
  });

  it('flags a proposal that would remove a locked, grade-A item', () => {
    const p: RuleProposal = { id: 'prop.x', title: 'Remove danger signs', appliesWhen: { stage: 'pregnancy' }, effect: 'remove', itemId: 'danger.pregnancy', rationale: '', supportingOverrideIds: [], supportingWorkerIds: ['w1'], status: 'pending', createdAt: seed.clock };
    const imp = simulateProposalImpact(p, seed.mothers, seed.clock, ctx);
    expect(imp.touchesLocked).toBe(true);
    expect(imp.mothersAffected).toBe(0); // locked items cannot be removed
    expect(imp.evidenceGrade).toBe('A');
    const iron: RuleProposal = { ...p, id: 'prop.y', itemId: 'med.iron_folate', title: 'Remove iron' };
    const imp2 = simulateProposalImpact(iron, seed.mothers, seed.clock, ctx);
    expect(imp2.mothersAffected).toBeGreaterThan(0);
    expect(imp2.conflictsWithGuideline).toMatch(/grade A/);
    expect(imp2.safetyNotes.join(' ')).toMatch(/one worker/);
  });

  it('builds a timeline from the supporting overrides and the review', () => {
    const t = proposalTimeline(seed.proposals.find((x) => x.id === 'prop.ov-001')!, seed.overrides);
    expect(t.map((e) => e.kind)).toEqual(['override', 'proposal_created', 'support']);
    expect(t.filter((e) => e.kind === 'override' || e.kind === 'support').map((e) => e.actorId).sort()).toEqual(['w-ng-folasade', 'w-ng-zainab']);
    for (let i = 1; i < t.length; i++) expect(t[i].at >= t[i - 1].at).toBe(true);
    const approved = proposalTimeline(seed.proposals.find((x) => x.id === 'prop.ov-003')!, seed.overrides);
    expect(approved[approved.length - 1]).toMatchObject({ kind: 'reviewed', actorId: 'w-ng-bankole' });
  });

  it('writes release notes', () => {
    const n = releaseNotes(seed.learnedRules);
    expect(n.entries).toHaveLength(1);
    expect(n.entries[0].change).toMatch(/Added "Extra fluids/);
    expect(n.markdown).toMatch(/^# Gaskin clinical library update/);
    expect(releaseNotes([]).title).toBe('No approved changes');
  });
});
