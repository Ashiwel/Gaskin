import { beforeAll, describe, expect, it } from 'vitest';
import type { CarePlan, Mother } from '../../types';
import { deidentify, reidentify, scrubText, setPrivacyDirectory, previewForAI } from '..';
import { buildPrompt, type AITask } from '../../ai/pipeline';
import { DIRECTORY, fixtureMothers, plan as fixturePlan, ASOF } from '../../ai/__tests__/fixtures';
import '../../ai'; // registers the preview builder

// Use the seeded mothers and the real engine when those modules exist; otherwise the hand-built fixture
const seedMods = import.meta.glob('../../data/seed.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const dataMods = import.meta.glob('../../data/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const engineMods = import.meta.glob('../../engine/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;

interface SeedLike {
  mothers: Mother[];
  workers: Array<{ id: string; name: string }>;
  facilities: Array<{ id: string; name: string; region: string }>;
  clock?: string;
}

function loadSeed(): { source: string; seed: SeedLike } {
  const mods = [...Object.values(dataMods), ...Object.values(seedMods)];
  for (const mod of mods) {
    const create = mod.createSeedState as (() => SeedLike) | undefined;
    try {
      if (typeof create === 'function') return { source: 'seed', seed: create() };
    } catch {
      /* fall through */
    }
  }
  return { source: 'fixture', seed: { mothers: fixtureMothers(), workers: DIRECTORY.workers, facilities: DIRECTORY.facilities, clock: ASOF } };
}

const { source, seed } = loadSeed();
const buildPlan = Object.values(engineMods)[0]?.buildPlan as ((m: Mother, asOf: string, ctx: unknown) => CarePlan) | undefined;

function planFor(m: Mother): CarePlan {
  const asOf = seed.clock ?? ASOF;
  if (buildPlan) {
    try {
      return buildPlan(m, asOf, { overrides: [], learnedRules: [] });
    } catch {
      /* fall back */
    }
  }
  return fixturePlan(m);
}

/** Every value that must never appear in an outbound prompt */
function forbidden(m: Mother): string[] {
  const out: string[] = [];
  const name = (s?: string) => {
    if (!s) return;
    for (const p of s.split(/\s+/)) if (p.replace(/\W/g, '').length >= 3 && !/^(Dr|Mrs|Mr|Nurse|Mama|Baby)\.?$/i.test(p)) out.push(p.replace(/[^\p{L}'-]/gu, ''));
  };
  name(m.name);
  m.children.forEach((c) => name(c.name));
  if (m.phone.number) {
    const digits = m.phone.number.replace(/\D/g, '');
    out.push(digits.slice(-7));
  }
  if (m.email) out.push(m.email);
  if (m.community && m.community.length >= 3) out.push(m.community);
  out.push(m.id);
  const w = seed.workers.find((x) => x.id === m.assignedWorkerId);
  name(w?.name);
  const f = seed.facilities.find((x) => x.id === m.facilityId);
  if (f) out.push(f.name);
  return [...new Set(out.filter(Boolean))];
}

const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/;
const DMY_DATE = /\b\d{1,2}\/\d{1,2}\/(?:20)?\d{2}\b/;

describe(`privacy sweep over every ${source} mother`, () => {
  beforeAll(() => setPrivacyDirectory({ workers: seed.workers, facilities: seed.facilities, mothers: seed.mothers }));

  const tasks: AITask[] = ['personalise', 'translate', 'extract', 'explain', 'suggest'];
  for (const m of seed.mothers) {
    it(`${m.id}: no name, phone, community, facility or absolute date in any prompt`, () => {
      const p = planFor(m);
      const reports = m.events.filter((e) => e.kind === 'report').map((e) => (e as { text: string }).text);
      const reportText = [...reports, m.householdNotes ?? '', `Patient ${m.name}, phone ${m.phone.number ?? ''}, seen 12/03/2026.`].join('\n');
      for (const compact of [false, true]) {
        for (const task of tasks) {
          const built = buildPrompt(
            task,
            {
              plan: p,
              mother: m,
              channel: 'sms',
              language: m.language,
              texts: Object.fromEntries(p.items.slice(0, 5).map((i) => [i.id, i.motherText])),
              text: reportText,
            },
            { compact, deidentify: true },
          );
          for (const bad of forbidden(m)) {
            // Whole-word match: 'Lami' must not flag 'blaming'
            const esc = bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(built.prompt, `${task} prompt leaks "${bad}"`).not.toMatch(new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu'));
          }
          expect(built.prompt, `${task} prompt has an ISO date`).not.toMatch(ISO_DATE);
          expect(built.prompt, `${task} prompt has a d/m/y date`).not.toMatch(DMY_DATE);
          expect(built.prompt).not.toContain(`${m.age} year`);
        }
      }
    });
  }
});

describe('deidentify and reidentify', () => {
  beforeAll(() => setPrivacyDirectory({ workers: DIRECTORY.workers, facilities: DIRECTORY.facilities }));

  it('scrubs a free-text report', () => {
    const r = deidentify({
      text: 'Mrs Halima Yusuf (Hosp No: AKTH/22/0456), 17 years old, phone 0803 123 4567, email h.yusuf@mail.com, seen by Dr Sani Abdullahi at Aminu Kano Teaching Hospital on 3rd October 2026. Husband: Ibrahim Yusuf. Lives at 12 Zoo Road, Kano. BP 150/100.',
      asOf: '2026-11-05',
    });
    const t = r.text!;
    for (const bad of ['Halima', 'Yusuf', 'AKTH/22/0456', '0803', 'mail.com', 'Sani', 'Abdullahi', 'Aminu Kano', 'Ibrahim', 'Zoo Road', 'October']) expect(t).not.toContain(bad);
    expect(t).toContain('aged 15-19 years (adolescent, under 18)');
    expect(t).toContain('BP 150/100');
    expect(t).toMatch(/\[DATE\] \(\d+ weeks ago\)/);
    expect(r.removed).toEqual(expect.arrayContaining(['phone number', 'email', 'ID number', 'doctor name', 'date']));
  });

  it('leaves clinical numbers alone', () => {
    const r = scrubText('G2P1 at 34/40, BP 160/110, PCV 27%, MgSO4 4g IV, TCA 1/52, GA 34 weeks, age 24', []);
    expect(r.text).toContain('34/40');
    expect(r.text).toContain('160/110');
    expect(r.text).toContain('1/52');
    expect(r.text).toContain('GA 34 weeks');
    expect(r.text).toContain('age 20-24 years');
  });

  it('restores names locally', () => {
    const [m] = fixtureMothers();
    const d = deidentify({ plan: fixturePlan(m), mother: m });
    expect(JSON.stringify(d.payload)).not.toMatch(/Adaeze|Okafor|Nsukka/);
    expect(d.payload!.mother.ageBand).toBe('20-24');
    expect(reidentify('Hello [MOTHER], from [WORKER] at [FACILITY]', d.map)).toBe('Hello Adaeze, from Fatima at Nsukka Primary Health Centre');
  });

  it('previewForAI shows exactly what would be sent, and says when nothing is sent', () => {
    const [m] = fixtureMothers();
    const pv = previewForAI('personalise', { plan: fixturePlan(m), mother: m, channel: 'sms', language: 'en' });
    expect(pv.text).toContain('[MOTHER]');
    expect(pv.text).not.toContain('Adaeze');
  });
});

// ---------- Security review additions (docs/security-review.md) ----------

describe('re-identification never swaps one person or place for another (SEC-03)', () => {
  beforeAll(() => setPrivacyDirectory({ workers: seed.workers, facilities: seed.facilities, mothers: seed.mothers }));

  it('a named referral hospital comes back as itself, not as her own clinic', () => {
    const m = seed.mothers[0];
    const own = seed.facilities.find((f) => f.id === m.facilityId)!.name;
    const other = seed.facilities.find((f) => f.id !== m.facilityId && /Teaching Hospital/.test(f.name))!.name;
    const p = planFor(m);
    p.items.push({ ...p.items[0], id: 'refer.x', status: 'active', title: 'Referral', motherText: `Go to ${other} today.`, detail: `Refer to ${other}.` });
    const b = buildPrompt('personalise', { plan: p, mother: m, channel: 'sms', itemIds: ['refer.x'] }, { compact: true, deidentify: true });
    expect(b.prompt).not.toContain(other);
    expect(b.prompt).toContain('[OTHER_FACILITY]');
    const back = reidentify('Go to [OTHER_FACILITY] today. Love, [WORKER] at [FACILITY].', b.map);
    expect(back).toContain(`Go to ${other} today`);
    expect(back).toContain(own);
  });

  it('another mother or another worker named in her record is removed and never restored as her', () => {
    const [m, other] = [seed.mothers[0], seed.mothers[5]];
    const otherWorker = seed.workers.find((w) => w.id !== m.assignedWorkerId)!;
    const r = deidentify({ text: `Came with ${other.name} from ${other.community}; seen by ${otherWorker.name}.`, mother: m, asOf: seed.clock });
    for (const part of [...other.name.split(' '), otherWorker.name.split(' ').pop()!]) expect(r.text).not.toContain(part);
    const back = reidentify(r.text!, r.map);
    expect(back).not.toContain(m.name.split(' ')[0]);
    expect(back).not.toContain(m.community);
  });
});

describe('extended privacy sweep: free text the earlier sweep did not cover (SEC-06)', () => {
  beforeAll(() => setPrivacyDirectory({ workers: seed.workers, facilities: seed.facilities, mothers: seed.mothers }));

  for (const m of seed.mothers) {
    it(`${m.id}: household notes, carers, worker-added items and other mothers' details stay out of every prompt`, () => {
      const other = seed.mothers.find((x) => x.id !== m.id && x.facilityId === m.facilityId) ?? seed.mothers.find((x) => x.id !== m.id)!;
      const p = planFor(m);
      // A worker-added item and a modified one, written the way a busy worker writes
      const added = {
        ...p.items[0],
        id: 'custom.sweep',
        status: 'active' as const,
        origin: 'worker_added' as const,
        title: `Lift to clinic with ${other.name.split(' ')[0]}`,
        motherText: `Ask ${other.name} (${other.phone.number ?? '0803 555 0100'}) from ${other.community} to bring you on 14/12/2026.`,
        detail: `${m.householdNotes ?? ''} Household: ${m.name}, ${m.community}.`,
        because: [`Told by ${m.name.split(' ')[0]} on 2026-11-01`],
      };
      p.items.push(added);
      const texts = { a: added.motherText, b: added.detail };
      for (const task of ['personalise', 'translate', 'extract', 'explain', 'suggest'] as AITask[]) {
        for (const compact of [false, true]) {
          const built = buildPrompt(task, { plan: p, mother: m, channel: 'whatsapp', language: m.language, itemIds: ['custom.sweep'], texts, text: `${added.motherText}\n${added.detail}` }, { compact, deidentify: true });
          const bad = [...forbidden(m), ...forbidden(other)];
          for (const b of bad) {
            const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            expect(built.prompt, `${task}${compact ? ' (compact)' : ''} leaks "${b}"`).not.toMatch(new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu'));
          }
          expect(built.prompt).not.toMatch(ISO_DATE);
          expect(built.prompt).not.toMatch(DMY_DATE);
        }
      }
    });
  }
});
