/**
 * Several children within the first 1,000 days, and pregnancy alongside a young child.
 *
 * Plan items for the youngest child keep their original ids (for overrides, learned rules and
 * stored plan versions). Items for every other child under 1,000 days run through the same
 * child rules and are re-labelled `<id>@<childId>`, with `childId` set, so the worker sees one
 * plan with a part for each child.
 *
 * Clinical content:
 * - Short birth interval: WHO technical consultation on birth spacing (2005/2007): wait at least
 *   24 months after a live birth before trying for the next pregnancy. Conde-Agudelo et al. (JAMA 2006):
 *   intervals under 18 months raise the risk of preterm birth, low birth weight and small-for-age.
 * - Breastfeeding while pregnant: López-Fernández et al. (Women Birth 2017) found no effect on how
 *   pregnancies end or on birth weight; seek advice with a history of preterm labour or miscarriage,
 *   bleeding or contractions, twins, or poor weight gain. Extra food is needed for both.
 * - Iron and nutrition with back-to-back pregnancies: WHO ANC 2016 rec. A.2.1 (daily iron and folic acid),
 *   WHO ANC nutrition brief; WHO 2023 complementary feeding for the older child.
 */
import type { Child, PlanItem } from '../types';
import { cite } from '../clinical';
import { babyAge, daysBetween } from './dates';
import { forChild, isYoungest, type Facts } from './facts';
import { addItem, type RuleCtx } from './items';
import { pickFoods } from './rulesNutrition';
import { CDC_MILESTONE_MONTHS } from './milestoneMonths';

/** The next CDC milestone set to check at a (corrected) age in days. */
export function milestoneMonthsDue(ageDays: number): number | undefined {
  const months = ageDays / 30.4;
  return CDC_MILESTONE_MONTHS.find((m) => m >= months - 0.25);
}

/**
 * Run child rules once per child under 1,000 days. The youngest runs as before; each sibling runs
 * on a copy of the facts and items, and whatever it adds is re-labelled for that child.
 */
export function perChild(c: RuleCtx, rules: Array<(c: RuleCtx) => void>): void {
  const kids = c.f.under1000;
  const youngest = kids.find((k) => isYoungest(c.f, k));
  if (youngest) for (const r of rules) r(c);
  for (const child of kids) {
    if (child === youngest) continue;
    const sub: RuleCtx = { ...c, f: forChild(c.f, child), items: [] };
    for (const r of rules) r(sub);
    for (const it of sub.items) {
      // Mother-only items (her nutrition, her mood) belong to the mother's part, not the child's.
      if (MOTHER_LEVEL.test(it.id)) {
        if (!c.items.some((x) => x.id === it.id)) c.items.push(it);
        continue;
      }
      const id = `${it.id}@${child.id}`;
      if (c.items.some((x) => x.id === id)) continue;
      c.items.push(relabel(it, child, id));
    }
  }
  // Tag the youngest child's items too, when there is more than one child, so the UI can group.
  if (youngest && kids.length > 1) {
    for (const it of c.items) if (!it.childId && CHILD_LEVEL.test(it.id) && !MOTHER_LEVEL.test(it.id)) it.childId = youngest.id;
  }
}

const CHILD_LEVEL = /^(danger\.(newborn|child)|baby\.|imm\.child|nutr\.complementary|med\.vitamin_a_child|bf\.(exclusive|latch|low_milk|continue)|test\.infant_hiv)/;
const MOTHER_LEVEL = /^(nutr\.(iron_foods|protein_calcium|water)|mh\.|fp\.|family\.|rest\.)/;

function relabel(it: PlanItem, child: Child, id: string): PlanItem {
  const first = child.name.split(' ')[0];
  return { ...it, id, childId: child.id, title: it.title.includes(first) ? it.title : `${first}: ${it.title}` };
}

/** Concurrent care: pregnant now with a child under 1,000 days. */
export function concurrentCareRules(c: RuleCtx): void {
  const { f } = c;
  if (!f.pregnant || !f.under1000.length) return;
  const kids = f.under1000;
  const names = kids.map((k) => k.name.split(' ')[0]);
  const youngest = kids[kids.length - 1];
  const yAge = daysBetween(youngest.dob, f.asOf);
  const breastfeeding = kids.some((k) => /breast|exclusive|mixed/.test(k.feeding) && k.feeding !== 'complementary_no_breastmilk');

  // ---- Short birth interval: counselling now and a plan for next time ----
  const months = f.interpregnancyDays !== undefined ? Math.floor(f.interpregnancyDays / 30.4) : undefined;
  if (months !== undefined && months < 24) {
    const short = months < 18;
    addItem(c, {
      id: 'risk.short_birth_interval',
      category: 'family_planning',
      title: short ? `Short birth interval: conceived ${months} months after the last birth` : `Birth interval ${months} months (under 2 years)`,
      detail: `WHO advises waiting at least 24 months from a birth before the next pregnancy; conception under 18 months after a birth raises the risk of preterm birth, low birth weight and small-for-age babies (Conde-Agudelo 2006 meta-analysis), and her iron stores have had little time to recover. Now: check Hb at every contact, make sure she takes iron and folic acid daily, add an extra meal, and watch fetal growth (fundal height). Counsel without blame. After this birth: agree a method before discharge (implant, IUD or progestogen-only methods are safe while breastfeeding) so the next pregnancy is at least 2 years away.`,
      text: { key: 'kids.short_interval' },
      priority: short ? 2 : 3,
      evidence: 'A',
      sources: cite('who-birth-spacing-2005', 'conde-agudelo-2006', 'who-pnc-2022-rec24'),
      because: [`Last birth ${months} months before this pregnancy began`, `${names.join(' and ')} under 1,000 days`],
      illustration: 'family_planning',
    });
  }

  // ---- Breastfeeding while pregnant ----
  if (breastfeeding && yAge <= 730) {
    addItem(c, {
      id: 'bf.while_pregnant',
      category: 'breastfeeding',
      title: `Breastfeeding ${names[names.length - 1]} while pregnant`,
      detail: `Breastfeeding during a healthy pregnancy is generally safe: a systematic review found no effect on how pregnancies end or on birth weight (López-Fernández 2017). She needs more food for three: an extra meal and a snack a day, iron and folic acid every day, and water to thirst. Milk may lessen and taste different from mid-pregnancy, so ${names[names.length - 1]} may wean on her own; ${yAge < 183 ? `${names[names.length - 1]} is under 6 months: keep breastfeeding fully and weigh monthly.` : 'make sure family foods cover what breast milk no longer gives.'} Seek advice (refer to the midwife) if she has had preterm labour or a miscarriage before, bleeding, belly pain or regular tightenings during feeds, twins, or poor weight gain.`,
      text: { key: 'kids.bf_pregnant' },
      priority: 3,
      evidence: 'B',
      sources: cite('lopez-fernandez-2017', 'who-anc-2016-a1', 'who-cf-2023'),
      because: [`Pregnant at ${f.ga} weeks`, `Breastfeeding ${names[names.length - 1]} (${babyAge(yAge)})`],
      illustration: 'breastfeeding',
    });
  }

  // ---- Weaning or sibling feeding ----
  if (yAge >= 183 && yAge <= 1000) {
    const animal = pickFoods(c, 'protein', 6).filter((x) => /egg|fish|crayfish|omena|dagaa|momoni|liver|meat|milk/i.test(x.name))[0];
    const legume = pickFoods(c, 'protein', 6).filter((x) => /bean|groundnut|soy|ndengu|agushie/i.test(x.name))[0];
    const green = pickFoods(c, 'iron', 6).filter((x) => /leaves|ugu|efo|sukuma|managu|kontomire|ayoyo|moringa|greens/i.test(x.name))[0];
    addItem(c, {
      id: 'nutr.sibling_feeding',
      category: 'nutrition',
      title: `${names[names.length - 1]}'s food while she is pregnant`,
      detail: `If ${names[names.length - 1]} breastfeeds less or weans during the pregnancy, family foods must fill the gap (WHO 2023): 3–4 meals and 1–2 snacks a day, an animal-source food every day (${animal?.serving ?? 'one egg or a handful of small fish'}), ${legume?.serving ?? 'a cup of cooked beans'}, ${green?.serving ?? 'two handfuls of cooked green leaves'}, and milk if she has stopped breastfeeding (WHO: animal milk from 12 months). Gradual weaning is kinder than sudden. Weigh ${names[names.length - 1]} monthly.`,
      text: { key: 'kids.sibling_food', params: { name: names[names.length - 1] } },
      priority: 3,
      evidence: 'A',
      sources: cite('who-cf-2023', 'who-cf-2023-summary'),
      because: [`${names[names.length - 1]} is ${babyAge(yAge)} old`, 'Mother is pregnant again'],
      illustration: 'complementary_food',
    });
  }

  // ---- Iron and nutrition for back-to-back pregnancies ----
  addItem(c, {
    id: 'nutr.back_to_back',
    category: 'nutrition',
    title: 'Rebuild iron: two pregnancies close together',
    detail: `Pregnancy soon after a birth${breastfeeding ? ' while still breastfeeding' : ''} draws on iron, folate, calcium and energy stores that have not recovered. Daily iron 60 mg and folic acid 400 µg (WHO ANC A.2.1) is essential, not optional; food alone cannot replace it. Add one extra meal a day${breastfeeding ? ' and one more snack while breastfeeding' : ''}, iron-rich foods with a vitamin C fruit, and check Hb at every contact. Ask who helps at home with ${names.join(' and ')}.`,
    text: { key: 'kids.back_to_back' },
    priority: 2,
    evidence: 'A',
    sources: cite('who-anc-2016-a21', 'who-anc-nutrition-2018', 'who-birth-spacing-2005'),
    because: [`Pregnant at ${f.ga} weeks`, `${names.join(' and ')} under 1,000 days`],
    illustration: 'iron_foods',
  });
}

/** Two or more children under 1,000 days and not pregnant (close births or twins with an older sibling). */
export function severalChildrenRules(c: RuleCtx): void {
  const { f } = c;
  const kids = f.under1000;
  if (kids.length < 2 || f.pregnant) return;
  const births = new Set(kids.map((k) => k.dob.slice(0, 10)));
  const names = kids.map((k) => k.name.split(' ')[0]);
  if (births.size >= 2) {
    const sorted = [...kids].sort((a, b) => a.dob.localeCompare(b.dob));
    const gapM = Math.floor(daysBetween(sorted[sorted.length - 2].dob, sorted[sorted.length - 1].dob) / 30.4);
    addItem(c, {
      id: 'fp.after_close_births',
      category: 'family_planning',
      title: `Two births ${gapM} months apart: plan the next one`,
      detail: `${names.join(' and ')} were born ${gapM} months apart. WHO advises at least 24 months from a birth to the next pregnancy. Offer long-acting methods (implant, IUD) or injectables now; all are safe while breastfeeding. Check her Hb: back-to-back pregnancies deplete iron.`,
      text: { key: 'kids.space_next' },
      priority: 2,
      evidence: 'A',
      sources: cite('who-birth-spacing-2005', 'conde-agudelo-2006', 'who-pnc-2022-rec24'),
      because: [`${gapM} months between births`],
      illustration: 'family_planning',
    });
  }
  addItem(c, {
    id: 'family.several_children',
    category: 'family_support',
    title: `Help at home with ${kids.length} young children`,
    detail: `${names.join(', ')}: ${kids.length} children under 1,000 days means ${kids.length} vaccine cards, feeding plans and growth checks. Bring every child to each visit and every card. Agree with the family who takes over chores, who watches the older child during feeds, and who comes at night if a child is ill.`,
    text: { key: 'kids.help_home', params: { n: kids.length } },
    priority: 3,
    evidence: 'C',
    sources: cite('who-pnc-2022-rec52'),
    because: [`${kids.length} children under 1,000 days`],
    illustration: 'family_support',
  });
}

/** For engine consumers: is this item about a sibling (not the youngest)? */
export function siblingItemChild(it: PlanItem): string | undefined {
  const m = it.id.match(/@(.+)$/);
  return m ? m[1] : undefined;
}

export type { Facts };
