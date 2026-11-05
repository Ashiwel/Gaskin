import type { CountryCode } from '../types';

export type Nutrient = 'iron' | 'protein' | 'calcium' | 'vitamin_a' | 'folate' | 'energy' | 'iodine' | 'zinc' | 'vitamin_c';

export interface LocalFood {
  name: string;
  nutrients: Nutrient[];
  costTier: 'cheap' | 'moderate' | 'dear';
  notes?: string;
  /** Short everyday name for mother-facing text */
  short?: string;
  /** Daily amount in household measures, as a short phrase: 'a cup of cooked beans' */
  serving?: string;
}

/**
 * Affordable local sources of iron, protein, calcium and vitamin A.
 * Food lists draw on the research notes (Nigeria IYCF inference, Kalenjin study for
 * Kenya greens and millet porridge, Ghana millet-soya RCT) and common market foods.
 * Cost tiers are relative within each country and should be validated by a local nutritionist.
 */
export const LOCAL_FOODS: Record<CountryCode, LocalFood[]> = {
  NG: [
    { name: 'Beans / cowpea (ewa, akara, moi-moi)', nutrients: ['protein', 'iron', 'folate', 'energy'], short: 'beans', serving: 'a cup of cooked beans', costTier: 'cheap', notes: 'Cheapest protein. Eat with a fruit or tomato for vitamin C to help absorb iron.' },
    { name: 'Crayfish (ground)', nutrients: ['protein', 'calcium', 'iron', 'zinc'], short: 'crayfish', serving: 'a handful of crayfish in your soup', costTier: 'cheap', notes: 'A spoonful in soup or pap adds protein and calcium.' },
    { name: 'Ugu (fluted pumpkin leaves)', nutrients: ['iron', 'folate', 'vitamin_a', 'calcium'], short: 'ugu', serving: 'two handfuls of cooked ugu', costTier: 'cheap', notes: 'Wash well and cook. Also efo/tete (amaranth), ewedu.' },
    { name: 'Efo tete / amaranth (alefo)', nutrients: ['iron', 'calcium', 'folate', 'vitamin_a'], short: 'efo tete', serving: 'two handfuls of cooked efo', costTier: 'cheap' },
    { name: 'Eggs', nutrients: ['protein', 'vitamin_a', 'iron', 'zinc'], short: 'eggs', serving: 'one egg', costTier: 'cheap', notes: 'One egg a day for mother; mashed egg for baby from 6 months.' },
    { name: 'Ogi / akamu / koko with groundnut paste', nutrients: ['energy', 'protein'], short: 'pap with groundnut', serving: 'a bowl of pap with a spoon of groundnut paste', costTier: 'cheap', notes: 'Plain pap is mostly starch. Stir in groundnut paste, crayfish, egg or soybean flour. Use freshly made pap.' },
    { name: 'Groundnuts (peanuts)', nutrients: ['protein', 'energy', 'zinc'], short: 'groundnuts', serving: 'a handful of groundnuts', costTier: 'cheap' },
    { name: 'Red palm oil', nutrients: ['vitamin_a', 'energy'], short: 'palm oil', serving: 'a spoon of red palm oil in your soup', costTier: 'cheap', notes: 'A little in soups gives vitamin A.' },
    { name: 'Small dried fish (panla, sawa, kpanla)', nutrients: ['protein', 'calcium', 'iron'], short: 'small dried fish', serving: 'a handful of small dried fish', costTier: 'cheap', notes: 'Eat with the bones for calcium.' },
    { name: 'Orange-fleshed sweet potato, pawpaw, mango', nutrients: ['vitamin_a', 'vitamin_c', 'energy'], short: 'pawpaw or mango', serving: 'a slice of pawpaw or a mango', costTier: 'cheap' },
    { name: 'Soybeans (soy flour, soy milk, tofu "awara")', nutrients: ['protein', 'calcium', 'iron'], short: 'soybeans', serving: 'a cup of soy milk or a piece of awara', costTier: 'cheap' },
    { name: 'Moringa leaves (zogale)', nutrients: ['iron', 'calcium', 'vitamin_a', 'protein'], short: 'moringa', serving: 'a handful of moringa leaves in your soup', costTier: 'cheap', notes: 'Cook into soups or sprinkle dried powder on food.' },
    { name: 'Liver (beef or chicken)', nutrients: ['iron', 'vitamin_a', 'protein', 'folate'], short: 'liver', serving: 'a small piece of liver twice a week', costTier: 'moderate', notes: 'Rich in iron. Small portions only in pregnancy (very high vitamin A).' },
    { name: 'Fresh fish (mackerel "titus")', nutrients: ['protein', 'calcium'], short: 'fish', serving: 'a piece of fish', costTier: 'moderate' },
    { name: 'Wara / nono (local dairy)', nutrients: ['calcium', 'protein'], short: 'wara or nono', serving: 'a cup of nono or a piece of wara', costTier: 'moderate', notes: 'Choose freshly made or boiled.' },
    { name: 'Meat, chicken, snails', nutrients: ['protein', 'iron', 'zinc'], short: 'meat', serving: 'a piece of meat or chicken', costTier: 'dear' },
  ],
  KE: [
    { name: 'Sukuma wiki (kale/collards)', nutrients: ['iron', 'calcium', 'vitamin_a', 'folate'], short: 'sukuma wiki', serving: 'two handfuls of cooked sukuma wiki', costTier: 'cheap' },
    { name: 'Managu, terere, saga (nightshade, amaranth, spider plant)', nutrients: ['iron', 'calcium', 'folate', 'vitamin_a'], short: 'managu', serving: 'two handfuls of cooked managu or terere', costTier: 'cheap', notes: 'Traditional greens many families already use "to increase blood".' },
    { name: 'Omena / dagaa (small dried fish)', nutrients: ['protein', 'calcium', 'iron', 'zinc'], short: 'omena', serving: 'a handful of omena', costTier: 'cheap', notes: 'Eaten whole with bones: excellent calcium.' },
    { name: 'Beans and githeri (maize and beans)', nutrients: ['protein', 'iron', 'energy', 'folate'], short: 'beans', serving: 'a cup of cooked beans or githeri', costTier: 'cheap' },
    { name: 'Ndengu (green grams) and kunde', nutrients: ['protein', 'iron', 'folate'], short: 'ndengu', serving: 'a cup of cooked ndengu', costTier: 'cheap' },
    { name: 'Uji (millet or sorghum porridge) with groundnut or milk', nutrients: ['energy', 'iron', 'protein'], short: 'uji', serving: 'a cup of uji with groundnut or milk', costTier: 'cheap' },
    { name: 'Eggs', nutrients: ['protein', 'vitamin_a', 'iron', 'zinc'], short: 'eggs', serving: 'one egg', costTier: 'cheap' },
    { name: 'Groundnuts / peanut butter', nutrients: ['protein', 'energy', 'zinc'], short: 'groundnuts', serving: 'a handful of groundnuts', costTier: 'cheap' },
    { name: 'Orange sweet potato, pawpaw, mango', nutrients: ['vitamin_a', 'vitamin_c'], short: 'pawpaw or mango', serving: 'a slice of pawpaw or a mango', costTier: 'cheap' },
    { name: 'Milk and mala (fermented milk)', nutrients: ['calcium', 'protein'], short: 'milk', serving: 'a cup of milk or mala', costTier: 'moderate', notes: 'Boil fresh milk. Do not mix with raw blood.' },
    { name: 'Liver and matumbo', nutrients: ['iron', 'protein', 'vitamin_a'], short: 'liver', serving: 'a small piece of liver twice a week', costTier: 'moderate' },
    { name: 'Meat, chicken, tilapia', nutrients: ['protein', 'iron', 'zinc'], short: 'meat or fish', serving: 'a piece of meat or fish', costTier: 'dear' },
  ],
  GH: [
    { name: 'Kontomire (cocoyam leaves) in palava sauce', nutrients: ['iron', 'folate', 'vitamin_a', 'calcium'], short: 'kontomire', serving: 'two handfuls of kontomire', costTier: 'cheap' },
    { name: 'Beans (red-red, waakye, gari and beans)', nutrients: ['protein', 'iron', 'energy', 'folate'], short: 'beans', serving: 'a cup of cooked beans', costTier: 'cheap' },
    { name: 'Koko (millet porridge) with groundnut or soy', nutrients: ['energy', 'protein', 'iron'], short: 'koko with groundnut', serving: 'a bowl of koko with groundnut', costTier: 'cheap', notes: 'A millet-soya drink improved milk volume in a Tamale trial.' },
    { name: 'Momoni / keta school boys / anchovies (small dried fish)', nutrients: ['protein', 'calcium', 'iron'], short: 'small dried fish', serving: 'a handful of small dried fish', costTier: 'cheap', notes: 'Eat with bones.' },
    { name: 'Agushie (melon seeds) and groundnut soup', nutrients: ['protein', 'energy', 'zinc'], short: 'agushie', serving: 'a bowl of agushie or groundnut soup', costTier: 'cheap' },
    { name: 'Eggs', nutrients: ['protein', 'vitamin_a', 'iron', 'zinc'], short: 'eggs', serving: 'one egg', costTier: 'cheap' },
    { name: 'Ayoyo, alefi, bra (local greens)', nutrients: ['iron', 'calcium', 'folate', 'vitamin_a'], short: 'ayoyo', serving: 'two handfuls of cooked ayoyo or alefi', costTier: 'cheap' },
    { name: 'Red palm oil and palm-nut soup', nutrients: ['vitamin_a', 'energy'], short: 'palm-nut soup', serving: 'a bowl of palm-nut soup', costTier: 'cheap' },
    { name: 'Orange-fleshed sweet potato, pawpaw, mango', nutrients: ['vitamin_a', 'vitamin_c'], short: 'pawpaw or mango', serving: 'a slice of pawpaw or a mango', costTier: 'cheap' },
    { name: 'Moringa leaves', nutrients: ['iron', 'calcium', 'vitamin_a', 'protein'], short: 'moringa', serving: 'a handful of moringa leaves in your soup', costTier: 'cheap' },
    { name: 'Wagashi (local cheese) and milk', nutrients: ['calcium', 'protein'], short: 'wagashi or milk', serving: 'a cup of milk or a piece of wagashi', costTier: 'moderate' },
    { name: 'Liver, chicken, fresh fish', nutrients: ['iron', 'protein', 'zinc'], short: 'liver or fish', serving: 'a piece of liver, chicken or fish', costTier: 'dear' },
  ],
};

/** Free or subsidised programmes a worker can point a very poor family to, per country. */
export const FREE_PROGRAMMES: Record<CountryCode, string> = {
  NG: 'Iron-folate, IPTp and bed nets are free at public PHCs. BHCPF covers ANC, delivery and postnatal care at accredited PHCs, and MAMII LGAs offer free emergency obstetric care and transport.',
  KE: 'SHA Linda Jamii covers ANC, delivery and postnatal care; register before labour. Iron-folate and nets are free at public facilities.',
  GH: 'Free maternal care under NHIS covers ANC, delivery and care to 3 months after birth; registration is automatic for pregnant women at accredited facilities.',
};
