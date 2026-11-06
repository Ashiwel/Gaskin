/**
 * Mother-facing lines for visit checklists, as templates with {placeholders}.
 * Same rules as MOTHER_TEXT (src/clinical/motherText.ts): plain everyday words, no clinical terms,
 * one idea a sentence, fewer than 15 words a sentence. Language packs translate these keys.
 *
 * Placeholders: {name} the baby's name; {date} a short date; {vaccines} plain vaccine names;
 * {food} an enriching food; {label} a visit name.
 */
import { MOTHER_TEXT, PLAN_TEXT } from '../clinical';
import { milestoneTexts } from './milestones';

export const VISIT_TEXT: Record<string, string> = {
  // ---------- Findings explained to the mother ----------
  'vt.finding.low_temp': '{name} is a little cold. Hold {name} on your bare chest, with a cap and cloth.',
  'vt.finding.growth': '{name} is not gaining enough weight. Feed {name} more often. We will weigh {name} again soon.',
  'vt.finding.eyes': 'We found a problem with {name}’s eyes. An eye nurse needs to see {name}. Put nothing in the eyes.',
  'vt.finding.cleft': '{name} has a gap in the lip or mouth. Doctors can close it with an operation. It is nobody’s fault. We will help you feed {name}.',
  'vt.finding.spine': 'There is a problem on {name}’s back. Cover it with a clean cloth. Go to the hospital today.',
  'vt.finding.hips': '{name}’s hips need a check by a doctor. Early treatment helps {name} walk well.',
  'vt.finding.clubfoot': '{name}’s foot is turned in. This can be fixed. A clinic will put the foot in small casts. Start soon, while {name} is young.',
  'vt.finding.limb': 'We want a doctor to look at {name}’s arm or leg. Please go to the clinic we name.',
  'vt.finding.genitalia': 'A doctor needs to check {name}’s private parts. This is common and can be treated.',
  'vt.finding.anus': '{name} needs to see a doctor today about the bottom and stool.',
  'vt.finding.refer': 'We found something that needs a doctor. Please go to the clinic we name.',

  // ---------- Pregnancy ----------
  'vt.fetal_movement': 'Feel your baby move every day. If the baby moves less, come to the clinic that day.',
  'vt.anc_eat': 'Eat three meals and one snack each day. Add beans, eggs, fish or green leaves.',
  'vt.birth_plan': 'Plan where you will give birth. Save money for transport. Choose someone to go with you.',
  'vt.labour_signs': 'Labour has started when pains come often and get stronger. Go to your birth place then. Go at once if water breaks or you bleed.',
  'vt.twins': 'You have two babies. You need more clinic visits. Your babies should be born in hospital.',
  'vt.twins_pp': 'Two babies need extra care. Feed each one often. Ask your family to help you.',
  'vt.scar': 'You had an operation before. Give birth in a hospital that can operate. Come at once for pain on the old scar.',
  'vt.scd_hydrate': 'Drink a cup of water with each meal and each feed. Carry water with you.',
  'vt.period_late': 'Your period is late. We will do a pregnancy test today.',
  'vt.precon_genotype': 'Know your blood type for sickle cell, and your partner’s too. The test is at the clinic.',
  'vt.precon_weight': 'Eat well and stay active before your next pregnancy. A healthy weight helps you and the baby.',

  // ---------- Birth and after ----------
  'vt.first_hour': 'Hold {name} on your bare chest now. Put {name} to the breast in the first hour.',
  'vt.bath_wait': 'Wait one full day before the first bath. Keep {name} warm and dry.',
  'vt.small_baby_feed': '{name} is small. Feed {name} every 2 to 3 hours, day and night. Wake {name} for feeds.',
  'vt.jaundice_watch': 'Look at {name}’s skin in daylight each day. If it turns yellow, feed more and call us. Yellow palms or soles: go to hospital now.',
  'vt.pp_food': 'Eat one extra meal each day while you breastfeed. Drink a cup of water each feed.',
  'vt.mood_ok': 'Many mothers feel tired or tearful after birth. Tell us if it lasts more than two weeks.',
  'vt.fp_choose': 'Choose a family planning method today. It is free at the clinic.',

  // ---------- Child ----------
  'vt.handwash': 'Wash your hands and {name}’s hands with soap before food.',
  'vt.play_talk': 'Talk and sing to {name} every day. Smile and copy the sounds {name} makes.',
  'vt.play_tummy': 'Lay {name} on the tummy to play each day. Give safe things to hold.',
  'vt.play_toys': 'Play hiding games with {name}. Give pots, cups and spoons to play with.',
  'vt.play_words': 'Name things for {name} and read or tell stories each day. Praise new words.',
  'vt.safety': '{name} moves a lot now. Keep fire, hot water, medicine and sharp things out of reach.',

  // ---------- Vaccines ----------
  'vt.vaccines_today': '{name} gets these vaccines today: {vaccines}. They are free.',
  'vt.vaccines_today.side': 'A small fever or sore leg after vaccines is common. Keep breastfeeding. Fever over two days: come back.',
  'vt.vaccines_next': '{name}’s next vaccines are due on {date}: {vaccines}. Bring the vaccine card.',
  'vt.vaccines_done': '{name} has had all the vaccines for the first two years. Keep the card safe.',
  'vt.td_today': 'You get your tetanus injection today. It protects you and your baby.',

  // ---------- Milestones ----------
  'vt.milestones_next': 'Before the next visit, most babies of {name}’s age start to do these things:',
  'vt.milestones_watch': 'Every baby grows at their own pace. Play with {name} each day. Tell us if {name} cannot do these things by the next visit.',
  'vt.milestones_concern': 'We will check {name}’s growth and play again soon. A health worker may look at {name} more closely.',

  // ---------- Visits ----------
  'vt.next_visit': 'Your next visit is on {date}: {label}. Please come even if all is well.',
  'vt.next_visit.simple': 'Next visit: {date}.',
  'vt.refer_today': 'Please go to {place} today. We will tell them you are coming.',
  'vt.refer_now': 'Please go to {place} now. Do not wait.',
  'vt.refer_within': 'Please go to {place} {when}. It is not an emergency, but do not miss it.',

  // ---------- Follow-ups ----------
  'vt.fu.iron_food': 'Take the blood tablet with food at night. Black stool is normal.',
  'vt.fu.reminder': 'Keep the tablets where you see them every day. Ask someone to remind you.',
  'vt.fu.free': 'This is free at public clinics. Ask at your nearest clinic.',
  'vt.fu.why_needed': 'This protects you and your baby, even when you feel well.',
  'vt.fu.net_hang': 'Hang the net over your sleeping place. Tuck it under the mat every night.',
  'vt.fu.transport': 'Plan your ride now. Save a little money each week for transport.',
  'vt.fu.anc_come': 'Please come to every clinic visit, even when you feel well.',

  // Milestone lines (one per milestone)
  ...milestoneTexts(),
};

/** "within 2 weeks", "this week", "this month" from a worker's referral instruction. */
export function referralWhen(todo: string | undefined): string | undefined {
  if (!todo) return undefined;
  const m = todo.match(/within (\d+) (days?|weeks?|months?)/i);
  if (m) return `within ${m[1]} ${m[2].toLowerCase()}`;
  const t = todo.match(/this (week|month)/i);
  return t ? `this ${t[1].toLowerCase()}` : undefined;
}

/** Look up a template in VISIT_TEXT, then MOTHER_TEXT. */
export function visitTemplate(key: string): string | undefined {
  return VISIT_TEXT[key] ?? MOTHER_TEXT[key] ?? PLAN_TEXT[key];
}

/** Fill {placeholders} in English. Throws on an unknown key so typos fail tests, not users. */
export function renderVisitText(key: string, params: Record<string, string | number> = {}): string {
  const t = visitTemplate(key);
  if (t === undefined) throw new Error(`Missing visit text template: ${key}`);
  return t.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}
