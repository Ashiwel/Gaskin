/**
 * Developmental milestones for child visits.
 *
 * CDC "Learn the Signs. Act Early." (2022 revision, Zubler et al. Pediatrics 2022): milestones that
 * most children (75% or more) reach by each age. Missing one is a reason to watch, play and recheck,
 * not a diagnosis. Wording below follows the CDC checklists (cdc.gov/act-early/milestones, read Nov 2026),
 * lightly shortened for the worker screen.
 *
 * WHO Motor Development Study (Acta Paediatr 2006): windows of achievement (1st to 99th percentile, months)
 * for six gross motor milestones in healthy children from five countries, including Ghana. A child past
 * the end of a window without the skill is outside what 99% of healthy children do: refer for assessment.
 */

export type MilestoneDomain = 'social' | 'language' | 'cognitive' | 'movement';

export interface Milestone {
  /** Stable id, e.g. 'ms.9m.sits' */
  id: string;
  domain: MilestoneDomain;
  /** Worker-facing wording (CDC) */
  label: string;
  /** Mother-facing plain words, key in VISIT_TEXT */
  textKey: string;
  /** English plain text for the mother (also the VISIT_TEXT value) */
  plain: string;
}

export interface MilestoneSet {
  months: number;
  milestones: Milestone[];
}

const m = (months: number, slug: string, domain: MilestoneDomain, label: string, plain: string): Milestone => ({
  id: `ms.${months}m.${slug}`,
  domain,
  label,
  textKey: `ms.${months}m.${slug}`,
  plain,
});

export const CDC_MILESTONES: MilestoneSet[] = [
  {
    months: 2,
    milestones: [
      m(2, 'calms', 'social', 'Calms down when spoken to or picked up', 'Calms down when you talk to or hold the baby.'),
      m(2, 'looks_face', 'social', 'Looks at your face', 'Looks at your face.'),
      m(2, 'smiles', 'social', 'Smiles when you talk to or smile at the baby', 'Smiles when you smile and talk.'),
      m(2, 'sounds', 'language', 'Makes sounds other than crying', 'Makes small sounds, not only crying.'),
      m(2, 'reacts_loud', 'language', 'Reacts to loud sounds', 'Jumps or blinks at a loud sound.'),
      m(2, 'watches', 'cognitive', 'Watches you as you move', 'Follows you with the eyes.'),
      m(2, 'head_tummy', 'movement', 'Holds head up when on tummy', 'Lifts the head when lying on the tummy.'),
      m(2, 'moves_limbs', 'movement', 'Moves both arms and both legs', 'Moves both arms and both legs.'),
    ],
  },
  {
    months: 4,
    milestones: [
      m(4, 'smiles_own', 'social', 'Smiles on own to get your attention', 'Smiles at you to get your attention.'),
      m(4, 'chuckles', 'social', 'Chuckles when you try to make the baby laugh', 'Gives a little laugh when you play.'),
      m(4, 'coos', 'language', 'Makes sounds like "oooo", "aahh" (cooing)', 'Makes "oooo" and "aahh" sounds.'),
      m(4, 'turns_voice', 'language', 'Turns head towards the sound of your voice', 'Turns to your voice.'),
      m(4, 'mouth_breast', 'cognitive', 'If hungry, opens mouth on seeing breast or bottle', 'Opens the mouth for the breast when hungry.'),
      m(4, 'head_steady', 'movement', 'Holds head steady without support when held', 'Holds the head steady when you carry the baby.'),
      m(4, 'holds_toy', 'movement', 'Holds a toy put in the hand', 'Holds a small toy you put in the hand.'),
      m(4, 'hands_mouth', 'movement', 'Brings hands to mouth', 'Brings the hands to the mouth.'),
      m(4, 'elbows', 'movement', 'Pushes up onto elbows or forearms when on tummy', 'Pushes up on the elbows when on the tummy.'),
    ],
  },
  {
    months: 6,
    milestones: [
      m(6, 'knows_people', 'social', 'Knows familiar people', 'Knows the family faces.'),
      m(6, 'laughs', 'social', 'Laughs', 'Laughs out loud.'),
      m(6, 'turn_sounds', 'language', 'Takes turns making sounds with you', 'Makes sounds back when you talk.'),
      m(6, 'squeals', 'language', 'Blows "raspberries" or makes squealing noises', 'Squeals or blows bubbles with the lips.'),
      m(6, 'reaches', 'cognitive', 'Reaches to grab a toy', 'Reaches out to grab a toy.'),
      m(6, 'mouths', 'cognitive', 'Puts things in the mouth to explore them', 'Puts things in the mouth to learn about them.'),
      m(6, 'rolls', 'movement', 'Rolls from tummy to back', 'Rolls from tummy to back.'),
      m(6, 'straight_arms', 'movement', 'Pushes up with straight arms when on tummy', 'Pushes up on straight arms when on the tummy.'),
      m(6, 'leans_sitting', 'movement', 'Leans on hands to support self when sitting', 'Sits leaning on the hands.'),
    ],
  },
  {
    months: 9,
    milestones: [
      m(9, 'strangers', 'social', 'Is shy, clingy or fearful around strangers', 'Is shy with strangers.'),
      m(9, 'name', 'social', 'Looks when you call the baby’s name', 'Looks up when you call the name.'),
      m(9, 'peekaboo', 'social', 'Smiles or laughs when you play peek-a-boo', 'Laughs at peek-a-boo.'),
      m(9, 'babbles', 'language', 'Makes sounds like "mamamama" and "babababa"', 'Says "mamama" or "bababa".'),
      m(9, 'arms_up', 'language', 'Lifts arms up to be picked up', 'Lifts the arms to be picked up.'),
      m(9, 'looks_dropped', 'cognitive', 'Looks for objects dropped out of sight', 'Looks for a toy that falls.'),
      m(9, 'bangs', 'cognitive', 'Bangs two things together', 'Bangs two things together.'),
      m(9, 'gets_sitting', 'movement', 'Gets to a sitting position alone', 'Gets up to sitting without help.'),
      m(9, 'sits', 'movement', 'Sits without support', 'Sits without support.'),
      m(9, 'hand_to_hand', 'movement', 'Moves things from one hand to the other', 'Passes a toy from one hand to the other.'),
      m(9, 'rakes', 'movement', 'Uses fingers to "rake" food towards self', 'Pulls food closer with the fingers.'),
    ],
  },
  {
    months: 12,
    milestones: [
      m(12, 'patacake', 'social', 'Plays games like pat-a-cake', 'Plays clapping games with you.'),
      m(12, 'waves', 'language', 'Waves "bye-bye"', 'Waves bye-bye.'),
      m(12, 'mama', 'language', 'Calls a parent "mama", "dada" or another special name', 'Calls you "mama" or another name for you.'),
      m(12, 'understands_no', 'language', 'Understands "no" (pauses or stops)', 'Stops for a moment when you say "no".'),
      m(12, 'container', 'cognitive', 'Puts something in a container', 'Puts a small thing into a cup or tin.'),
      m(12, 'finds_hidden', 'cognitive', 'Looks for things seen hidden', 'Finds a toy you hide under a cloth.'),
      m(12, 'pulls_stand', 'movement', 'Pulls up to stand', 'Pulls up to stand.'),
      m(12, 'cruises', 'movement', 'Walks holding on to furniture', 'Walks holding on to things.'),
      m(12, 'pincer', 'movement', 'Picks things up between thumb and pointer finger', 'Picks up small food with thumb and finger.'),
    ],
  },
  {
    months: 15,
    milestones: [
      m(15, 'shows_object', 'social', 'Shows you an object they like', 'Shows you things.'),
      m(15, 'affection', 'social', 'Shows affection (hugs, cuddles, kisses)', 'Hugs you and shows love.'),
      m(15, 'words', 'language', 'Tries to say one or two words besides "mama" or "dada"', 'Says one or two words.'),
      m(15, 'points_ask', 'language', 'Points to ask for something or to get help', 'Points to ask for things.'),
      m(15, 'follows_gesture', 'language', 'Follows directions given with both a gesture and words', 'Gives you a toy when you hold out your hand and ask.'),
      m(15, 'stacks', 'cognitive', 'Stacks at least two small objects', 'Puts one small thing on top of another.'),
      m(15, 'steps', 'movement', 'Takes a few steps alone', 'Takes a few steps alone.'),
      m(15, 'self_feeds', 'movement', 'Uses fingers to feed self some food', 'Feeds self with the fingers.'),
    ],
  },
  {
    months: 18,
    milestones: [
      m(18, 'points_show', 'social', 'Points to show you something interesting', 'Points to show you things.'),
      m(18, 'helps_dress', 'social', 'Helps you dress (pushes arm through sleeve)', 'Helps when you dress them.'),
      m(18, 'three_words', 'language', 'Tries to say three or more words besides "mama" or "dada"', 'Says three or more words.'),
      m(18, 'one_step', 'language', 'Follows one-step directions without gestures', 'Does a simple thing you ask, like "give it to me".'),
      m(18, 'copies_chores', 'cognitive', 'Copies you doing chores, like sweeping', 'Copies you, like sweeping.'),
      m(18, 'walks', 'movement', 'Walks without holding on', 'Walks alone without holding on.'),
      m(18, 'scribbles', 'movement', 'Scribbles', 'Scribbles with a stick or pencil.'),
      m(18, 'cup', 'movement', 'Drinks from a cup without a lid, may spill', 'Drinks from an open cup.'),
      m(18, 'climbs', 'movement', 'Climbs on and off a chair without help', 'Climbs on and off a chair.'),
    ],
  },
  {
    months: 24,
    milestones: [
      m(24, 'notices_upset', 'social', 'Notices when others are hurt or upset', 'Notices when someone is sad or hurt.'),
      m(24, 'two_words', 'language', 'Says at least two words together, like "more milk"', 'Puts two words together, like "more food".'),
      m(24, 'body_parts', 'language', 'Points to at least two body parts when asked', 'Points to two body parts when you ask.'),
      m(24, 'points_book', 'language', 'Points to things in a book when asked', 'Points to pictures when you ask.'),
      m(24, 'plays_toys', 'cognitive', 'Plays with more than one toy at the same time', 'Plays with two toys together.'),
      m(24, 'kicks', 'movement', 'Kicks a ball', 'Kicks a ball.'),
      m(24, 'runs', 'movement', 'Runs', 'Runs.'),
      m(24, 'spoon', 'movement', 'Eats with a spoon', 'Eats with a spoon.'),
    ],
  },
];

export interface MotorWindow {
  id: string;
  label: string;
  /** 1st and 99th percentile ages of achievement, months */
  from: number;
  to: number;
  textKey: string;
  plain: string;
  /** Some healthy children skip it (about 4% never crawl on hands and knees) */
  maySkip?: boolean;
}

/** WHO Motor Development Study 2006, Table: windows of achievement (months). */
export const WHO_MOTOR_WINDOWS: MotorWindow[] = [
  { id: 'who.sit', label: 'Sitting without support', from: 3.8, to: 9.2, textKey: 'ms.who.sit', plain: 'Sits without support.' },
  { id: 'who.stand_assist', label: 'Standing with assistance', from: 4.8, to: 11.4, textKey: 'ms.who.stand_assist', plain: 'Stands when holding on.' },
  { id: 'who.crawl', label: 'Hands-and-knees crawling', from: 5.2, to: 13.5, textKey: 'ms.who.crawl', plain: 'Crawls on hands and knees.', maySkip: true },
  { id: 'who.walk_assist', label: 'Walking with assistance', from: 5.9, to: 13.7, textKey: 'ms.who.walk_assist', plain: 'Walks when you hold the hands.' },
  { id: 'who.stand_alone', label: 'Standing alone', from: 6.9, to: 16.9, textKey: 'ms.who.stand_alone', plain: 'Stands alone.' },
  { id: 'who.walk_alone', label: 'Walking alone', from: 8.2, to: 17.6, textKey: 'ms.who.walk_alone', plain: 'Walks alone.' },
];

/** The CDC set for a (corrected) age in months: the latest set at or below that age. */
export function milestoneSetFor(ageMonths: number): MilestoneSet | undefined {
  return [...CDC_MILESTONES].reverse().find((s) => s.months <= ageMonths + 0.25);
}

/** The next CDC set after an age, for "what to expect before the next visit". */
export function nextMilestoneSet(ageMonths: number): MilestoneSet | undefined {
  return CDC_MILESTONES.find((s) => s.months > ageMonths + 0.25);
}

/** Plain-text table entries for VISIT_TEXT. */
export function milestoneTexts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of CDC_MILESTONES) for (const x of s.milestones) out[x.textKey] = x.plain;
  for (const w of WHO_MOTOR_WINDOWS) out[w.textKey] = w.plain;
  return out;
}
