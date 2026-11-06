import type { HowTo, IllustrationKey, PlanCategory } from '../types';

/**
 * Mother-facing lines added in Nov 2026: several children, alternatives when she cannot follow a
 * recommendation, side effects, declined care, untested results, personal use, and how-to steps
 * and examples for every recommendation. Same rules as MOTHER_TEXT: plain everyday words, one idea
 * a sentence, fewer than 15 words a sentence, no clinical terms.
 *
 * Language packs translate these keys like MOTHER_TEXT: the app calls
 * registerTemplates('plan', PLAN_TEXT) at start-up, next to VISIT_TEXT (the engine cannot import src/i18n).
 */
const TEXT: Record<string, string> = {
  // ---------- Several children ----------
  'kids.short_interval': 'Your babies are coming close together. Take your blood tablet every day. Eat one extra meal each day. After this birth, we will help you wait 2 years.',
  'kids.bf_pregnant': 'You can keep breastfeeding while pregnant. Eat more and take your blood tablet daily. Come at once if you bleed or feel belly pains during feeds.',
  'kids.sibling_food': 'Give {name} 3 or 4 meals a day and a snack. Add an egg or fish, beans and green leaves every day.',
  'kids.back_to_back': 'Two babies close together use up your blood. Take your blood tablet every day. Add one extra meal and green leaves.',
  'kids.space_next': 'Your two babies came close together. Rest your body 2 years before the next one. Ask us about family planning today.',
  'kids.help_home': 'You are caring for {n} small children. Bring every child and every card to each visit. Ask your family to help with chores.',

  // ---------- Alternatives when she cannot follow a recommendation ----------
  'alt.iron.free': 'Blood tablets for pregnancy are free at public clinics. Ask at your nearest health centre today.',
  'alt.iron.food': 'Each day eat {food1} and {food2}, with {fruit}. Food helps, but it cannot replace the tablet.',
  'alt.hb_recheck': 'Come back in 4 weeks so we can check your blood again.',
  'alt.iron.not_available': 'The clinic has run out of blood tablets. Ask at the place we name. Do not go without for long.',
  'alt.forgets': 'Link it to something you do every day. Keep it where you will see it. Ask someone at home to remind you.',
  'alt.cannot_afford': 'Ask us about free care. We will help you find a place where it is free.',
  'alt.not_available': 'It is not here today. We will send you to a place that has it.',
  'alt.no_transport': 'Plan your ride before the day. Ask family or a community driver. Save a little money each week.',
  'alt.test.not_available': 'This test is not here today. Go to the place we name to have it.',
  'alt.vaccine.not_available': 'The vaccine is not here today. Come back on the date we give. Earlier doses still count.',
  'alt.declined': 'You chose not to have this. That is your right. We will ask again at your next visit.',

  // ---------- Declined: answer the concern, offer again ----------
  'declined.fear_of_side_effects': 'You can choose. Most side effects are mild and pass. We can help with them. Tell us if you change your mind.',
  'declined.cost': 'You can choose. Ask us about free care. We will tell you where it is free.',
  'declined.religious_or_cultural': 'We respect your beliefs. Tell us what matters to you. We will look for a way that fits.',
  'declined.partner_or_family_objects': 'You can choose. We can talk with your family together if you wish.',
  'declined.does_not_see_need': 'You can choose. This protects you and your baby. We will ask again at your next visit.',
  'declined.distance_or_time': 'You can choose. We can find a nearer place or a better time.',
  'declined.prefers_traditional_remedy': 'You can choose. Some home remedies are fine to use together with this. Tell us what you take.',
  'declined.other': 'You can choose. Tell us your worry. We will ask again at your next visit.',
  'declined.danger': 'Even without it, learn the danger signs. If one starts, go to the hospital at once.',

  // ---------- Side effects ----------
  'se.iron.mild': 'Take the tablet at night with food. Drink more water and eat fruit and beans. Black stool is normal and safe.',
  'se.iron.moderate': 'Keep taking it at bedtime with a small meal. We will check on you at the next visit.',
  'se.severe': 'Stop this medicine now. Go to the clinic today.',
  'se.iptp.mild': 'Take these malaria tablets after food. Mild sickness passes in a day.',
  'se.iptp.moderate': 'Do not take the next malaria dose until the nurse sees you.',
  'se.iptp.severe': 'Never take these malaria tablets again. Go to the clinic today. Sleep under the net every night.',
  'se.vaccine.mild': 'Keep breastfeeding. Use light clothes and a cool cloth on the sore place. Do not skip the next vaccine.',
  'se.vaccine.moderate': 'Bring the child to the clinic today.',
  'se.vaccine.severe': 'Go to the hospital now. Do not wait.',
  'se.art.mild': 'Keep taking your HIV medicine every day at the same time. Take it with food if it upsets you.',
  'se.art.moderate': 'Go to your HIV clinic this week. Keep taking your medicine until they see you.',
  'se.calcium.mild': 'Take calcium with meals. Keep it 2 hours apart from the blood tablet.',
  'se.aspirin.mild': 'Take the small tablet at night with food.',
  'se.generic.mild': 'Keep taking it. Tell us at the next visit how you feel.',
  'se.generic.moderate': 'We will check this medicine with the doctor this week. Do not stop on your own.',

  // ---------- Tests with no result ----------
  'untested.refer': 'We could not do a test you need today. Go to {place} today for the test.',
  'untested.next': 'A test was not done today. We will do it at your next visit.',

  // ---------- Personal use (no health worker) ----------
  'personal.go_now': 'Go to {place} now. If you cannot get there, call {number}.',
  'personal.go_today': 'Go to {place} today. If it gets worse, call {number}.',
  'personal.register': 'Register with a clinic or health worker. They can check you and your baby.',
  'personal.book': 'Book your next check-up at the clinic. Write the date on your card.',
  'personal.emergency_line': 'In an emergency, call {number} or go to the nearest hospital.',
};

// ---------- How-to: steps, examples and what to avoid ----------

interface HowToSource {
  steps: string[];
  examples?: string[];
  avoid?: string[];
  illustration?: IllustrationKey;
  guideId?: string;
}

/** By item id or id prefix (longest prefix wins). Strings are mother-facing. */
const HOW: Record<string, HowToSource> = {
  'med.iron': {
    steps: ['Take one tablet each night with food.', 'Eat an orange or tomato at the same meal.', 'Keep the tablets dry and away from children.'],
    examples: ['Swallow it with water after your evening meal.'],
    avoid: ['Do not take it with tea, coffee, pap or milk.'],
    illustration: 'iron_tablet',
    guideId: 'iron_rich_foods',
  },
  'med.folic': { steps: ['Take one tablet at the same time each day.', 'Keep the tablets where you see them every morning.'], illustration: 'iron_tablet' },
  'med.iptp': { steps: ['Take the malaria tablets at the clinic while the nurse watches.', 'Take them with clean water after food.'], avoid: ['Tell the nurse if you take Septrin.'], illustration: 'medicine' },
  'med.calcium': { steps: ['Take calcium with meals, in two parts.', 'Keep it 2 hours apart from your blood tablet.'], illustration: 'medicine' },
  'med.aspirin': { steps: ['Take one small tablet each night.', 'Keep taking it until the nurse says to stop.'], avoid: ['Do not stop on your own.'], illustration: 'medicine' },
  'med.art': { steps: ['Take your medicine at the same time every day.', 'Set a phone alarm or link it to a daily habit.', 'Carry a few days of tablets when you travel.'], illustration: 'medicine' },
  'med.vitamin_a': { steps: ['Bring the child health card to the clinic.', 'The drops are given at the clinic every 6 months.'], illustration: 'medicine' },
  'med.deworming': { steps: ['Take the single tablet at the clinic.'], illustration: 'medicine' },
  'med.diabetes': {
    steps: ['Eat small meals at regular times.', 'Walk for 30 minutes after meals.', 'Take your medicine as the doctor says.'],
    examples: ['Swap white bread for beans, vegetables and whole maize.'],
    avoid: ['No sugary drinks or sweets.'],
    illustration: 'balanced_plate',
  },
  'imm.': {
    steps: ['Bring the child health card to every visit.', 'Go on the date written on the card.', 'Breastfeed more after the injection.'],
    examples: ['A mild fever or sore leg for a day is common.'],
    illustration: 'vaccination',
  },
  'test.': { steps: ['Go to the clinic on the day we agree.', 'Ask for your result and write it on your card.', 'If the test is not there, ask where else to go.'], illustration: 'test_tube' },
  'visit.': { steps: ['Write the date on your card and in your phone.', 'Plan transport money before the day.', 'Bring your card, your medicines and every child’s card.'], illustration: 'calendar' },
  'danger.': { steps: ['Learn the danger signs with your family.', 'Keep transport money and a phone number ready.', 'Go at once, day or night. Do not wait.'], illustration: 'clinic_visit', guideId: 'birth_preparedness' },
  'refer.': { steps: ['Go today. Take your card and your medicines.', 'Take someone with you.', 'Tell us when you get there.'], illustration: 'clinic_visit' },
  'bf.': {
    steps: ['Hold the baby close, tummy to tummy.', 'Bring the baby to the breast, nose to nipple.', 'Wait for a wide-open mouth, then bring the baby on.', 'Feed 8 to 12 times in a day and night.'],
    examples: ['Good latch: chin touches the breast and lips turn out.', 'Positions: cradle hold, lying on your side, or under-arm hold.'],
    avoid: ['No water, pap or herbs before 6 months.'],
    illustration: 'breastfeeding_latch',
    guideId: 'breastfeeding_positions',
  },
  'bf.while_pregnant': { steps: ['Eat one extra meal and one snack a day.', 'Drink water each time you feed.', 'Come to us if you feel belly pains during feeds.'], illustration: 'breastfeeding', guideId: 'breastfeeding_while_pregnant' },
  'bf.continue': { steps: ['Breastfeed after meals and at night.', 'Give family foods first, then the breast, from 1 year.'], illustration: 'breastfeeding' },
  'baby.cord': { steps: ['Wash your hands before touching the cord.', 'Keep the cord clean, dry and open to the air.'], avoid: ['Put nothing on the cord except what the nurse gives.'], illustration: 'cord_care' },
  'baby.thermal': {
    steps: ['Hold the baby skin to skin on your chest.', 'Dress the baby in one more layer than you.', 'Put a hat on the baby and keep the room warm.'],
    examples: ['Father or grandmother can take turns holding the baby skin to skin.'],
    illustration: 'skin_to_skin',
    guideId: 'kangaroo_care',
  },
  'baby.safe_sleep': { steps: ['Lay the baby on the back to sleep.', 'Use a firm, flat place under a treated net.'], avoid: ['No pillows or heavy cloths near the face.'], illustration: 'mosquito_net' },
  'baby.growth': { steps: ['Bring the child to be weighed each month.', 'Ask to see the growth line on the card.', 'The line should go up.'], illustration: 'growth_chart' },
  'nutr.complementary': {
    steps: ['Start with thick porridge, 2 or 3 spoons.', 'Add a food from animals every day.', 'Feed slowly and patiently. Never force.'],
    examples: ['Thick pap with groundnut paste and crayfish or milk.', 'Mashed egg or fish with soft yam or potato.', 'Mashed beans with green leaves.'],
    avoid: ['No sugary drinks or sweets.'],
    illustration: 'complementary_food',
  },
  'nutr.sibling': {
    steps: ['Give 3 or 4 meals and 1 or 2 snacks a day.', 'Add an animal food every day.'],
    examples: ['Egg or small fish with rice and stew.', 'Beans with green leaves.', 'Pap with groundnut paste.'],
    illustration: 'complementary_food',
  },
  'nutr.iron': {
    steps: ['Eat a food from this list at every meal.', 'Add a fruit or tomato to the same meal.'],
    examples: ['One egg a day.', 'Two handfuls of cooked green leaves.', 'A cup of cooked beans with tomato.'],
    avoid: ['No tea or coffee with meals.'],
    illustration: 'iron_foods',
    guideId: 'iron_rich_foods',
  },
  'nutr.back_to_back': {
    steps: ['Take your blood tablet every night.', 'Eat one extra meal each day.', 'Add green leaves and beans to two meals.'],
    examples: ['Beans and plantain with ugu or spinach.', 'Fish stew with greens and an orange.'],
    illustration: 'iron_foods',
    guideId: 'iron_rich_foods',
  },
  'nutr.protein': {
    steps: ['Eat 3 meals and 1 or 2 snacks a day.', 'Add beans, fish, egg or groundnut to each meal.'],
    examples: ['Beans and fish stew with greens.', 'Pap with groundnut paste and milk.', 'A handful of groundnuts as a snack.'],
    illustration: 'protein_foods',
  },
  'nutr.water': { steps: ['Keep a cup of water where you feed or work.', 'Boil or treat your drinking water.'], illustration: 'water' },
  'rest.sleep_left_side': { steps: ['Lie on your left side to sleep.', 'Put a pillow or cloth between your knees.'], illustration: 'sleep_left_side' },
  'rest.itn': { steps: ['Sleep under the treated net every night.', 'Tuck the net under the mat.', 'Hang it again if it falls.'], illustration: 'mosquito_net' },
  'rest.': { steps: ['Lie down when the baby sleeps.', 'Ask family to cook, wash and fetch water.', 'Go to bed early when you can.'], illustration: 'rest' },
  'activity.': {
    steps: ['Walk for 20 to 30 minutes most days.', 'On hands and knees, gently arch and flatten your back 10 times.', 'Lie on your side and gently stretch your top leg back.', 'Stand against a wall and press your lower back to it.'],
    avoid: ['Do not lift heavy loads.', 'Stop if you feel pain, bleed or feel dizzy.'],
    illustration: 'walking',
    guideId: 'back_pain_exercises',
  },
  'mh.': {
    steps: ['Talk with someone you trust each day.', 'Do one small thing you enjoy each day.', 'Rest when the baby sleeps and let family help.'],
    examples: ['Sing or talk to the baby.', 'Take a short walk with a friend.'],
    illustration: 'talk_to_someone',
    guideId: 'thinking_healthy',
  },
  'fp.': {
    steps: ['Ask us about the implant, coil, injection or pills.', 'These are safe while you breastfeed.', 'Choose a method before 6 weeks after birth.'],
    illustration: 'family_planning',
    guideId: 'family_planning_after_birth',
  },
  'risk.short_birth_interval': {
    steps: ['Take your blood tablet every night.', 'Eat one extra meal each day.', 'Choose a family planning method before you leave after the birth.'],
    illustration: 'family_planning',
    guideId: 'birth_spacing',
  },
  'family.': { steps: ['Choose one person to learn the danger signs.', 'Agree who will take you to the clinic at night.', 'Share chores so you can rest.'], illustration: 'family_support' },
  'birth.': {
    steps: ['Choose where you will give birth.', 'Save money for transport each week.', 'Pack a bag with cloths, baby clothes and your card.', 'Choose a person to go with you and a blood donor.'],
    illustration: 'birth_bag',
    guideId: 'birth_preparedness',
  },
  'educ.caesarean': { steps: ['Keep the wound clean and dry.', 'Wash your hands before touching it.'], avoid: ['Do not lift heavy things for 6 weeks.'], illustration: 'handwashing' },
  'educ.': { steps: ['Ask us to explain anything that is not clear.', 'Tell us how you feel at each visit.'], illustration: 'talk_to_someone' },
  'trad.': { steps: ['Tell us about the practices your family follows.', 'Keep the helpful ones. We will help adapt the others.'], illustration: 'family_support' },
  'personal.register': { steps: ['Find the nearest clinic or health worker.', 'Tell them you are pregnant or have a small baby.', 'Ask for a card and your next date.'], illustration: 'clinic_visit' },
  'personal.book': { steps: ['Ask the clinic for your next date.', 'Write it on your card and in your phone.'], illustration: 'calendar' },
  'alt.': { steps: ['Tell us if this plan does not work for you.', 'We will find another way together.'], illustration: 'talk_to_someone' },
  'untested.': { steps: ['Go to the place we name for the test.', 'Bring your card and ask for the result.'], illustration: 'test_tube' },
};

/** Fallback by category, so every recommendation has steps. */
const BY_CATEGORY: Record<PlanCategory, string> = {
  danger_signs: 'danger.',
  visits: 'visit.',
  tests: 'test.',
  medication: 'med.folic',
  nutrition: 'nutr.protein',
  rest_and_sleep: 'rest.',
  activity: 'activity.',
  breastfeeding: 'bf.',
  baby_care: 'baby.growth',
  immunisation: 'imm.',
  mental_health: 'mh.',
  family_support: 'family.',
  birth_preparedness: 'birth.',
  family_planning: 'fp.',
  traditional_practice: 'trad.',
  education: 'educ.',
};

// Flatten how-to strings into translatable keys.
const keyed: Record<string, HowTo> = {};
for (const [id, h] of Object.entries(HOW)) {
  const slug = id.replace(/\.$/, '');
  const put = (kind: 's' | 'e' | 'a', arr: string[] | undefined) =>
    arr?.map((t, i) => {
      const k = `how.${slug}.${kind}${i + 1}`;
      TEXT[k] = t;
      return k;
    });
  keyed[id] = {
    steps: h.steps,
    examples: h.examples,
    avoid: h.avoid,
    stepKeys: put('s', h.steps),
    exampleKeys: put('e', h.examples),
    avoidKeys: put('a', h.avoid),
    illustration: h.illustration,
    guideId: h.guideId,
  };
}

export const PLAN_TEXT: Record<string, string> = TEXT;

/** Every how-to entry by id or prefix, with template keys. */
export const HOW_TO: Record<string, HowTo> = keyed;

/**
 * Steps and examples for a plan item or tell line: exact id, then the longest matching prefix,
 * then the category default. Ids for a second child ('...@childId') use the same entry.
 */
export function howToFor(itemId: string, category?: PlanCategory): HowTo | undefined {
  const id = itemId.replace(/@.*$/, '');
  if (keyed[id]) return keyed[id];
  const prefixes = Object.keys(keyed)
    .filter((p) => id.startsWith(p))
    .sort((a, b) => b.length - a.length);
  if (prefixes.length) return keyed[prefixes[0]];
  return category ? keyed[BY_CATEGORY[category]] : undefined;
}

/** Fill {placeholders}; throws on an unknown key. */
export function renderPlanText(key: string, params: Record<string, string | number> = {}): string {
  const t = PLAN_TEXT[key];
  if (t === undefined) throw new Error(`Missing PLAN_TEXT template: ${key}`);
  return t.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}
