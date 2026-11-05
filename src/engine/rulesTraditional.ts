import { findPractice } from '../clinical';
import type { IllustrationKey, PlanCategory } from '../types';
import { addItem, type RuleCtx } from './items';

const ILLUSTRATION: Record<string, IllustrationKey> = {
  omugwo: 'family_support',
  hot_water_compress: 'rest',
  wankan_jego: 'danger_breathing',
  pap_ogi: 'balanced_plate',
  pepper_soup: 'balanced_plate',
  moringa: 'iron_foods',
  galactagogue_leaves: 'breastfeeding',
  agbo: 'medicine',
  labour_herbs: 'medicine',
  nzu_clay: 'iron_foods',
  food_taboo_protein: 'protein_foods',
  eating_less: 'balanced_plate',
  food_taboo_minor: 'protein_foods',
  colostrum_discard: 'breastfeeding',
  prelacteal_feeds: 'breastfeeding',
  early_complementary: 'breastfeeding',
  cord_substances: 'cord_care',
  uvulectomy: 'baby_danger',
  baby_massage_shea: 'warm_baby',
  postpartum_confinement: 'rest',
  abdominal_binder: 'rest',
  back_carrying: 'warm_baby',
  ginger_nausea: 'balanced_plate',
  tba_birth: 'birth_bag',
};

/**
 * One traditional_practice item per practice she mentioned.
 * Supported: affirm (priority 4). Plausible/neutral: adapt (priority 3-4). Harmful: reframe (priority 2, not locked).
 */
export function traditionalRules(c: RuleCtx): void {
  const { f } = c;
  const seen = new Set<string>();
  for (const raw of f.mother.practicesMentioned) {
    const p = findPractice(raw);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    const harmful = p.grade === 'trad_harmful';
    const verb = harmful ? 'Reframe' : p.grade === 'trad_supported' ? 'Affirm' : 'Adapt';
    addItem(c, {
      id: `trad.${p.id}`,
      category: 'traditional_practice',
      title: `${verb}: ${p.name}`,
      detail: `${p.evidenceSummary} What to do: ${p.guidance}`,
      text: { key: `trad.${p.id}` },
      priority: harmful ? 2 : p.grade === 'trad_supported' ? 4 : 3,
      evidence: p.grade,
      sources: p.sources,
      because: [`She or her family mentioned ${p.name.split(' (')[0].toLowerCase()}`],
      origin: 'traditional',
      illustration: ILLUSTRATION[p.id],
    });
  }

  // Location hook: practices common where she lives that she has not mentioned yet.
  // Worker-facing prompt to ask, respectfully, with harmful ones first.
  const gradeRank = { trad_harmful: 0, trad_neutral: 1, trad_plausible: 2, trad_supported: 3 } as const;
  const local = (c.location?.practices ?? [])
    .map((id) => findPractice(id))
    .filter((p): p is NonNullable<typeof p> => !!p && !seen.has(p.id) && p.stage.includes(c.s.stage === 'infant' ? 'infant' : c.s.stage))
    .sort((a, b) => gradeRank[a.grade] - gradeRank[b.grade] || a.id.localeCompare(b.id));
  if (local.length) {
    addItem(c, {
      id: 'trad.ask_local',
      category: 'traditional_practice',
      title: `Ask about common local practices (${c.location!.region})`,
      detail: `Common in her area and relevant now: ${local.map((p) => `${p.name} [${p.grade.replace('trad_', '')}]`).join('; ')}. Ask without judgement whether she or her family plans any of these, and record them so the plan can respond. Lead with ${local[0].name.split(' (')[0].toLowerCase()}: ${local[0].guidance}`,
      text: { key: 'trad.ask_local' },
      priority: local[0].grade === 'trad_harmful' ? 3 : 4,
      audience: 'worker',
      evidence: local[0].grade,
      sources: local.flatMap((p) => p.sources).filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i).slice(0, 6),
      because: [`Practices common in ${c.location!.region}`],
      origin: 'traditional',
      illustration: 'talk_to_someone',
    });
  }

  // Omugwo: bring the carer (usually her mother or mother-in-law) into the care team.
  if (seen.has('omugwo') && !f.pregnant) {
    addCarerItem(c, 'family_support');
  }
}

function addCarerItem(c: RuleCtx, category: PlanCategory): void {
  const name = c.f.youngest?.name ?? 'the baby';
  addItem(c, {
    id: 'family.omugwo_carer',
    category,
    title: 'Include the omugwo carer in the care team',
    detail: `The grandmother doing omugwo makes many daily decisions. At the next visit, spend time with her: danger signs for mother and ${name}; colostrum and breast milk only (no water, pap or herbs); cord care (chlorhexidine gel or clean and dry, nothing else); warm, not hot, water for massage; little kanwa or salt if BP was high; and when to call you. Thank her for her work: grandmothers carry omugwo with little support.`,
    text: { key: 'family.omugwo_carer', params: { name } },
    priority: 2,
    audience: 'worker',
    evidence: 'trad_plausible',
    sources: findPractice('omugwo')!.sources,
    because: ['Omugwo carer at home'],
    origin: 'traditional',
    illustration: 'family_support',
  });
}
