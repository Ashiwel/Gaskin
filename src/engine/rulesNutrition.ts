import { cite, FREE_PROGRAMMES, LOCAL_FOODS, type LocalFood, type Nutrient } from '../clinical';
import { hasCondition, labNumber, latestLab } from './facts';
import { addItem, type RuleCtx } from './items';

/** A food option for advice: national list entries and location-profile foods share this shape. */
interface FoodOption {
  name: string;
  short: string;
  serving: string;
  nutrients: string[];
  costTier: LocalFood['costTier'];
  local: boolean;
  season?: string;
}

const TIER_RANK = { cheap: 0, moderate: 1, dear: 2 } as const;

function asTier(t?: string): LocalFood['costTier'] {
  return t === 'moderate' || t === 'dear' ? t : 'cheap';
}

/** Household measure for a food that came without one (location profiles). */
function guessServing(name: string): string {
  const n = name.toLowerCase();
  if (/egg/.test(n)) return 'one egg';
  if (/leaf|leaves|green|ugu|efo|sukuma|managu|kontomire|ayoyo|spinach|amaranth|moringa/.test(n)) return `two handfuls of cooked ${n}`;
  if (/fish|crayfish|omena|dagaa|momoni|anchov/.test(n)) return `a handful of ${n}`;
  if (/bean|pea|lentil|gram|ndengu|cowpea|githeri/.test(n)) return `a cup of cooked ${n}`;
  if (/milk|nono|yoghurt|mala/.test(n)) return `a cup of ${n}`;
  if (/nut|seed|agushie/.test(n)) return `a handful of ${n}`;
  if (/orange|mango|banana|guava|pawpaw|papaya|fruit|tomato/.test(n)) return `2 pieces of ${n}`;
  if (/pap|ogi|akamu|koko|uji|porridge/.test(n)) return `a bowl of ${n}`;
  return `a portion of ${n}`;
}

function options(c: RuleCtx): FoodOption[] {
  const national: FoodOption[] = LOCAL_FOODS[c.f.mother.country].map((x) => ({
    name: x.name,
    short: x.short ?? x.name.split(' (')[0].toLowerCase(),
    serving: x.serving ?? guessServing(x.name.split(' (')[0]),
    nutrients: x.nutrients,
    costTier: x.costTier,
    local: false,
  }));
  const loc = c.location?.localFoods ?? [];
  const local: FoodOption[] = loc.map((x) => ({
    name: x.name,
    short: x.name.split(' (')[0].toLowerCase(),
    serving: guessServing(x.name.split(' (')[0]),
    nutrients: x.nutrients,
    costTier: asTier(x.costTier),
    local: true,
    season: x.season,
  }));
  // Location foods first; drop national entries with the same short name.
  return [...local, ...national.filter((n) => !local.some((l) => l.short === n.short))];
}

/**
 * Pick foods for a nutrient, honouring income: very low income sees only cheap foods.
 * Location-profile foods come first, then cheapest tier (low incomes) or richest source (better-off).
 */
export function pickFoods(c: RuleCtx, nutrient: Nutrient, n: number): FoodOption[] {
  const band = c.f.mother.incomeBand;
  const allowed: LocalFood['costTier'][] = band === 'very_low' ? ['cheap'] : band === 'low' ? ['cheap', 'moderate'] : ['cheap', 'moderate', 'dear'];
  const all = options(c);
  const foods = all.filter((x) => x.nutrients.includes(nutrient) && allowed.includes(x.costTier));
  const idx = (x: FoodOption) => x.nutrients.indexOf(nutrient);
  const pos = (x: FoodOption) => all.indexOf(x);
  const sorted = [...foods].sort(
    (a, b) =>
      Number(b.local) - Number(a.local) ||
      (band === 'middle' || band === 'high'
        ? idx(a) - idx(b) || TIER_RANK[b.costTier] - TIER_RANK[a.costTier] || pos(a) - pos(b)
        : TIER_RANK[a.costTier] - TIER_RANK[b.costTier] || pos(a) - pos(b)),
  );
  return sorted.slice(0, n);
}

/** Worker-facing description of a food list, with costs and seasons. */
function describe(foods: FoodOption[]): string {
  return foods.map((x) => `${x.name} (${x.serving}${x.season ? `; ${x.season}` : ''}${x.local ? '; local' : ''})`).join('; ');
}

const SUPPLEMENT_NOTE = 'Food complements, and never replaces, the supplements in her plan (iron-folic acid, calcium where intake is low, IPTp in malaria areas).';

/** Maternal food advice for pregnancy or breastfeeding. */
export function foodAdvice(c: RuleCtx, phase: 'pregnancy' | 'lactation'): void {
  const { f, s } = c;
  const m = f.mother;
  const band = m.incomeBand;
  const iron = pickFoods(c, 'iron', 3);
  const protein = pickFoods(c, 'protein', 3);
  const calcium = pickFoods(c, 'calcium', 2);
  const vitA = pickFoods(c, 'vitamin_a', 2);
  const vitC = pickFoods(c, 'vitamin_c', 1);
  const hb = labNumber(latestLab(f, 'haemoglobin'));
  const anaemic = (hb !== undefined && hb < 11) || hasCondition(f, 'anaemia') || s.risks.some((r) => r.code.includes('anaemia'));
  const under = s.risks.some((r) => r.code === 'underweight' || r.code === 'low_muac');
  const bandText = band === 'very_low' ? 'very low income: cheapest foods only' : band === 'low' ? 'low income: cheap and moderate-cost foods' : 'can afford a wider range';
  const free = band === 'very_low' || band === 'low' ? ` ${FREE_PROGRAMMES[m.country]}` : '';
  const localNote = c.location?.localFoods?.length ? ` Foods from her area (${c.location.region}) are listed first.` : '';
  const fruit = vitC[0]?.serving ?? 'a fruit';

  addItem(c, {
    id: 'nutr.iron_foods',
    category: 'nutrition',
    title: anaemic ? 'Iron-rich foods every day (Hb low)' : 'Iron-rich foods every day',
    detail: `Daily iron sources (${bandText}): ${describe(iron)}. With ${fruit} for vitamin C to help absorb iron; tea or coffee away from meals.${anaemic && hb !== undefined ? ` Hb ${hb} g/dL.` : ''} ${SUPPLEMENT_NOTE}${localNote}${free}`,
    text: { key: 'nutr.iron_foods', params: { food1: iron[0]?.serving ?? 'a cup of cooked beans', food2: iron[1]?.serving ?? 'two handfuls of cooked green leaves', fruit } },
    priority: anaemic ? 2 : 3,
    evidence: 'A',
    sources: cite('who-anc-2016-a1', 'who-anc-nutrition-2018'),
    because: [`Income: ${band.replace('_', ' ')}`, anaemic ? (hb !== undefined ? `Hb ${hb} g/dL` : 'Anaemia') : '', phase === 'pregnancy' ? 'Iron needs rise in pregnancy' : 'Rebuilding iron after birth', c.location?.localFoods?.length ? `Local foods for ${c.location.region}` : ''],
    illustration: 'iron_foods',
  });

  const extra = phase === 'pregnancy' ? (under ? 'two extra small meals' : 'one extra small meal') : 'one extra meal';
  addItem(c, {
    id: 'nutr.protein_calcium',
    category: 'nutrition',
    title: under ? 'More energy and protein: she is underweight' : 'Protein and calcium foods, and an extra meal',
    detail: `${under ? 'WHO A.1.2–A.1.3 (undernourished women): energy and protein education; balanced energy-protein supplement where available. ' : ''}Protein: ${describe(protein)}. Calcium: ${describe(calcium)}. Vitamin A: ${describe(vitA)}. Add ${extra} a day${phase === 'lactation' ? ' while breastfeeding' : ''}.${band === 'very_low' ? ' A spoon of groundnut paste or crayfish in pap is the cheapest boost.' : ''} ${SUPPLEMENT_NOTE}`,
    text: { key: phase === 'lactation' ? 'nutr.protein_calcium.feeding' : under ? 'nutr.protein_calcium.two' : 'nutr.protein_calcium.one', params: { food1: protein[0]?.serving ?? 'a cup of cooked beans', food2: calcium.find((x) => x.short !== protein[0]?.short)?.serving ?? calcium[0]?.serving ?? 'a handful of small dried fish' } },
    priority: under ? 2 : 3,
    evidence: under ? 'B' : 'A',
    sources: cite('who-anc-2016-a1', ...(under ? ['who-anc-2016-a13'] : []), 'who-anc-nutrition-2018'),
    because: [`Income: ${band.replace('_', ' ')}`, under ? (s.risks.find((r) => r.code === 'underweight' || r.code === 'low_muac')?.reason ?? 'Underweight') : ''],
    illustration: 'protein_foods',
  });

  addItem(c, {
    id: 'nutr.water',
    category: 'nutrition',
    title: phase === 'lactation' ? 'Drink to thirst: a cup at every feed' : 'Drink clean water through the day',
    detail: phase === 'lactation' ? 'Drink to thirst; a cup of water or pap at each breastfeed. Extra fluid beyond thirst does not raise milk supply.' : 'Safe drinking water (boiled or treated), about 8 cups a day; more in hot weather.',
    text: { key: phase === 'lactation' ? 'nutr.water.feeding' : 'nutr.water' },
    priority: 5,
    evidence: 'C',
    sources: cite('who-anc-2016-a1'),
    because: [phase === 'lactation' ? 'Breastfeeding' : 'Pregnancy'],
    illustration: 'water',
    audience: 'mother',
  });
}
