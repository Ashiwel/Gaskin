import type { Citation, CountryCode } from '../types';
import { cite } from './citations';

/**
 * Guides the worker can open from a plan item, a tell line or the visit summary, each with a
 * plain-words version for the mother. Written for Gaskin in our own words from the cited sources;
 * nothing is copied from the manuals. Helplines are listed only where verified (Nov 2026); the
 * national emergency numbers live in src/legal.
 */
export interface Guide {
  id: string;
  title: string;
  forWorker: { summary: string; steps?: string[]; sessions?: Array<{ title: string; when: string; aims: string[] }> };
  forMother: { summary: string; steps: string[] };
  whereToGetHelp: Partial<Record<CountryCode | 'default', Array<{ name: string; contact?: string; note: string }>>>;
  sources: Citation[];
}

const g = (x: Omit<Guide, 'sources'> & { sources: string[] }): Guide => ({ ...x, sources: cite(...x.sources) });

export const GUIDES: Record<string, Guide> = {
  thinking_healthy: g({
    id: 'thinking_healthy',
    title: 'Thinking Healthy: support for low mood in pregnancy and after birth',
    forWorker: {
      summary:
        'Thinking Healthy is a WHO programme of short, structured conversations for mothers with depression or low mood, based on cognitive behavioural therapy. It was built for community health workers with no mental health background, after two to three days of training and with regular supervision. It works through the things a mother already cares about (her health, her baby, her relationships) rather than talking about illness. The WHO manual is free to download.',
      steps: [
        'Who: a mother with a positive mood screen (EPDS at or above the local cut-off) and no self-harm thoughts. Self-harm thoughts, psychosis or a score that keeps rising mean referral first; the sessions can continue alongside specialist care.',
        'How often: about one session a week in late pregnancy, then weekly for the first weeks after birth, then monthly to around 10 months, in her home if possible. Each session takes 30–45 minutes.',
        'Each session follows the same three steps. First, notice an unhelpful thought ("I am a bad mother", "nothing will get better") and talk about how it affects her and the baby. Second, look for a more helpful way of seeing the same thing, in her words. Third, agree one small, doable action before the next visit (play with the baby for ten minutes, eat one proper meal, visit a friend), and write or draw it on her health calendar.',
        'Start each session by asking how the last action went, without judging; praise any step taken. End by agreeing the next action and the date of the next visit.',
        'Involve a family member she chooses (mother, mother-in-law, husband) so they understand low mood is common and treatable, and can help with rest, food and the baby.',
        'Rescreen every 2–4 weeks. Refer the same day for any thought of self-harm or of harming the baby, and refer for assessment (mhGAP) if the score rises or does not fall after about four sessions.',
      ],
      sessions: [
        { title: 'Getting to know her and her baby', when: 'Late pregnancy', aims: ['Build trust', 'Talk about her health and the coming baby', 'One small action for her own health'] },
        { title: 'Preparing for the baby', when: 'Late pregnancy', aims: ['Unhelpful thoughts about the birth', 'Plan support at home'] },
        { title: 'Early weeks with the baby', when: 'First weeks after birth', aims: ['Bonding and play', 'Rest and food', 'Thoughts about being a mother'] },
        { title: 'Middle and late infancy', when: 'Months 2–10', aims: ['Relationships and support', 'Keeping up small pleasant activities', 'Planning for the future'] },
      ],
    },
    forMother: {
      summary: 'Many mothers feel sad, tired or worried. It is common, and it gets better with support. A health worker will visit and talk with you about how you feel.',
      steps: ['Tell us how you are feeling. There is no wrong answer.', 'Each week, choose one small thing to do for you and the baby.', 'Ask one person at home to help you rest.', 'If you think of harming yourself or the baby, tell someone today.'],
    },
    whereToGetHelp: {
      KE: [{ name: 'Kenya Red Cross', contact: '1199', note: 'Free national line, listed by HapaKenya (Mar 2026) as also serving as a mental health helpline. Check it is still running before you rely on it.' }],
      default: [{ name: 'Your health facility', note: 'Ask for the mental health (mhGAP) nurse or doctor. In an emergency use the national emergency number.' }],
    },
    sources: ['who-thinking-healthy-who', 'who-thinking-healthy-2015', 'who-pnc-2022-rec18'],
  }),
  back_pain_exercises: g({
    id: 'back_pain_exercises',
    title: 'Back and pelvic pain in pregnancy: exercises',
    forWorker: {
      summary: 'Low back and pelvic pain is common from mid-pregnancy. WHO ANC 2016 recommends regular exercise through pregnancy to prevent it, with physiotherapy, support belts or acupuncture as options. Rule out danger first: back pain with bleeding, fever, burning urine, or regular tightenings before 37 weeks needs same-day review.',
      steps: [
        'Pelvic tilt on hands and knees: knees under hips, hands under shoulders, back flat. Breathe in; breathing out, tuck the bottom under and round the lower back gently; hold 3 seconds; return to flat. 10 times, twice a day.',
        'Side-lying stretch: lie on the left side with a cloth between the knees; slide the top leg slightly back and hold 20 seconds; change sides.',
        'Wall tilt: stand with back against a wall, feet a step forward, knees soft; press the lower back into the wall, hold 5 seconds, release. 10 times.',
        'Walking 20–30 minutes most days, in the cool part of the day.',
        'Posture: carry loads close to the body and share them; bend the knees to lift; sit with the back supported; sleep on the side with a cloth between the knees.',
        'Avoid: heavy lifting, lying flat on the back for long after 20 weeks, any exercise that causes pain, bleeding, dizziness or leaking fluid.',
      ],
    },
    forMother: {
      summary: 'Back pain is common in pregnancy. Gentle exercise every day helps.',
      steps: ['On hands and knees, gently round and flatten your back 10 times.', 'Lie on your side and stretch your top leg back.', 'Stand against a wall and press your lower back to it.', 'Walk for 20 to 30 minutes most days.', 'Stop if you feel pain, bleed or feel dizzy.'],
    },
    whereToGetHelp: { default: [{ name: 'Your clinic', note: 'Ask for a physiotherapy referral if pain stops you working or sleeping.' }] },
    sources: ['who-anc-2016-d', 'who-anc-2016-a1'],
  }),
  breastfeeding_positions: g({
    id: 'breastfeeding_positions',
    title: 'Breastfeeding: positions and a good latch',
    forWorker: {
      summary: 'Most sore nipples and low supply come from poor attachment. Watch a full feed before giving advice (WHO PNC 2022 rec. 42).',
      steps: [
        'Position: the baby’s head and body in a straight line, facing the breast, held close, with the whole body supported (not just the neck).',
        'Bring the baby to the breast, nose opposite the nipple; wait for a wide-open mouth, then bring the baby on quickly, chin first.',
        'Signs of good attachment: chin touching the breast, mouth wide open, lower lip turned out, more of the dark area visible above the mouth than below; slow deep sucks with pauses; no pain after the first few sucks.',
        'Positions to teach: cradle hold; cross-cradle (good for small babies); under-arm (after caesarean, for twins); lying on the side (night feeds, after caesarean).',
        'Twins: under-arm hold for both at once, or one at a time; each twin can start on a different breast at each feed.',
        'Feeds: 8–12 in 24 hours, on demand, both breasts; enough milk if 6 or more wet nappies a day after day 5 and weight gain.',
      ],
    },
    forMother: {
      summary: 'A good latch means more milk and no sore nipples.',
      steps: ['Hold the baby close, tummy to tummy.', 'Bring the baby to you, nose to nipple.', 'Wait for a wide-open mouth.', 'The chin touches your breast and the lips turn out.', 'Feed 8 to 12 times in a day and night.'],
    },
    whereToGetHelp: { default: [{ name: 'Your midwife or clinic', note: 'Ask for help with a feed if it hurts or the baby is not gaining weight.' }] },
    sources: ['who-pnc-2022-rec42'],
  }),
  kangaroo_care: g({
    id: 'kangaroo_care',
    title: 'Kangaroo mother care for small and early babies',
    forWorker: {
      summary: 'WHO 2022: start skin-to-skin kangaroo care immediately after birth for babies under 2.0 kg or born early, for as many hours a day as possible, with exclusive breastfeeding.',
      steps: [
        'Baby in a nappy and hat, upright on the mother’s bare chest between the breasts, head turned to one side, chin slightly up.',
        'Tie a cloth or wrap around both so the baby is held firmly; the mother can walk, sit and sleep reclined.',
        'Aim for 8–24 hours a day; father, grandmother or another adult can take turns.',
        'Breastfeed at least every 2–3 hours; express milk into a cup if the baby is too weak to suck.',
        'Weigh every few days at first; refer if not gaining, cold, not feeding, breathing fast or very sleepy.',
      ],
    },
    forMother: {
      summary: 'Holding your small baby skin to skin keeps the baby warm and helps the baby grow.',
      steps: ['Put the baby on your bare chest, in a hat and nappy.', 'Tie a cloth around you both.', 'Keep the baby there day and night.', 'Feed every 2 to 3 hours.', 'Others in the family can take turns.'],
    },
    whereToGetHelp: { default: [{ name: 'Your clinic or hospital', note: 'Many hospitals have a kangaroo care unit for very small babies.' }] },
    sources: ['who-kmc-2022'],
  }),
  birth_preparedness: g({
    id: 'birth_preparedness',
    title: 'Birth preparedness and complication readiness',
    forWorker: {
      summary: 'Agree a written plan in the third trimester (WHO ANC 2016; Nigeria and Ghana national guidance). For women with risk factors the place of birth must be a facility that can do a caesarean and give blood.',
      steps: [
        'Place of birth, and the nearest facility for emergencies at night.',
        'Transport: who, how, and the phone number; money saved weekly.',
        'A companion to go with her; someone to care for her other children.',
        'A blood donor identified in advance.',
        'Birth bag: clean cloths, pads, baby clothes and hat, her card, any medicines, health insurance card.',
        'Danger signs that mean going at once, known by her and a family member.',
      ],
    },
    forMother: {
      summary: 'Plan now for the birth and for any emergency.',
      steps: ['Choose where you will give birth.', 'Save money for transport each week.', 'Choose a person to go with you.', 'Pack a bag with cloths, baby clothes and your card.', 'Learn the danger signs with your family.'],
    },
    whereToGetHelp: { default: [{ name: 'Your clinic', note: 'Ask about free maternity care and emergency transport schemes in your area.' }] },
    sources: ['who-anc-2016', 'who-smart-anc-danger'],
  }),
  family_planning_after_birth: g({
    id: 'family_planning_after_birth',
    title: 'Family planning after birth',
    forWorker: {
      summary: 'Counsel before discharge and by 6 weeks (WHO PNC 2022 rec. 24). Aim for at least 24 months from this birth to the next pregnancy.',
      steps: [
        'Breastfeeding alone (LAM) protects only if the baby is under 6 months, fed only breast milk day and night, and her periods have not returned.',
        'Safe while breastfeeding at any time: implant, copper IUD (within 48 hours or from 4 weeks), progestogen-only pill, injectable.',
        'Combined pill: not in the first 6 weeks while breastfeeding; follow national eligibility criteria.',
        'Condoms protect against infection as well as pregnancy.',
        'Respect her choice and her partner’s involvement only with her consent.',
      ],
    },
    forMother: {
      summary: 'Waiting 2 years before the next baby keeps you and your children healthier.',
      steps: ['Ask us about the implant, coil, injection or pills.', 'These are safe while you breastfeed.', 'Choose before 6 weeks after the birth.'],
    },
    whereToGetHelp: { default: [{ name: 'Your clinic', note: 'Family planning is free at most public clinics.' }] },
    sources: ['who-pnc-2022-rec24', 'who-birth-spacing-2005'],
  }),
  iron_rich_foods: g({
    id: 'iron_rich_foods',
    title: 'Iron-rich local foods',
    forWorker: {
      summary: 'Food helps, but in pregnancy it does not replace daily iron and folic acid (WHO ANC A.2.1). Use the plan’s local food list; pair iron foods with vitamin C at the same meal.',
      steps: [
        'Every day: one animal-source food (egg, small fish, crayfish, liver if affordable).',
        'Every day: two handfuls of cooked dark green leaves and a cup of cooked beans.',
        'Same meal: a fruit or tomato for vitamin C.',
        'Away from meals: tea and coffee.',
        'Low income: cheapest options first (beans, crayfish, eggs from her own hens, local greens).',
      ],
    },
    forMother: {
      summary: 'Some foods build your blood. Eat them every day, with your blood tablet.',
      steps: ['One egg a day.', 'Two handfuls of cooked green leaves.', 'A cup of cooked beans.', 'An orange or tomato at the same meal.', 'No tea or coffee with meals.'],
    },
    whereToGetHelp: { default: [{ name: 'Your clinic', note: 'Ask where blood tablets are free.' }] },
    sources: ['who-anc-2016-a21', 'who-anc-nutrition-2018'],
  }),
  breastfeeding_while_pregnant: g({
    id: 'breastfeeding_while_pregnant',
    title: 'Breastfeeding while pregnant',
    forWorker: {
      summary: 'Generally safe in a healthy pregnancy: a systematic review found no effect on how pregnancies end or on birth weight (López-Fernández 2017). Nutrition for three is the main task.',
      steps: [
        'Extra food: one more meal and a snack a day; daily iron and folic acid; water to thirst.',
        'Expect milk to lessen and change taste from mid-pregnancy; some children wean themselves.',
        'Seek advice (midwife review) if: previous preterm labour or miscarriage, bleeding, belly pain or regular tightenings during feeds, twins, poor weight gain.',
        'Child under 6 months: keep breastfeeding fully and weigh monthly.',
        'Older child: make sure family foods cover the gap (see complementary feeding).',
      ],
    },
    forMother: {
      summary: 'You can usually keep breastfeeding while pregnant. Eat more.',
      steps: ['Eat one extra meal and a snack each day.', 'Take your blood tablet every day.', 'Come to us if you bleed or feel belly pains during feeds.'],
    },
    whereToGetHelp: { default: [{ name: 'Your midwife', note: 'Ask at your next pregnancy check.' }] },
    sources: ['lopez-fernandez-2017', 'who-anc-2016-a1'],
  }),
  birth_spacing: g({
    id: 'birth_spacing',
    title: 'Birth spacing',
    forWorker: {
      summary: 'WHO advises waiting at least 24 months after a birth before the next pregnancy. Conception under 18 months after a birth is linked with more preterm birth, low birth weight and small-for-age babies (Conde-Agudelo 2006).',
      steps: ['Counsel without blame.', 'In this pregnancy: Hb at every contact, daily iron and folic acid, an extra meal, watch fetal growth.', 'After this birth: agree a method before discharge.'],
    },
    forMother: { summary: 'Babies spaced 2 years apart are healthier, and so are mothers.', steps: ['Take your blood tablet every day.', 'Choose a family planning method before you leave after the birth.'] },
    whereToGetHelp: { default: [{ name: 'Your clinic', note: 'Family planning is free at most public clinics.' }] },
    sources: ['who-birth-spacing-2005', 'conde-agudelo-2006'],
  }),
};
