/**
 * The template provider: Gaskin with no AI at all. This is a first-class
 * mode, not just a fallback: many rural midwives and CHWs cannot reach or
 * pay for AI, so everything here is deterministic, offline and free, and
 * nothing leaves the device.
 *
 * - personaliseMessage: built from the plan items' motherText, in English or
 *   properly written Nigerian Pidgin; other languages get the English text
 *   plus a "[needs translation]" note for the worker.
 * - translate: English is returned as is, Pidgin is converted with a
 *   conservative phrase list, other languages are marked "[needs translation]".
 * - extractFindings: regex extraction (see ../extract.ts).
 * - explainPlan: a templated summary from the plan's own reasons.
 * - suggestItems: none (suggestions need a model).
 */
import type { Alert, CarePlan, Channel, LanguageCode, Mother, PlanItem } from '../../types';
import { getPrivacyDirectory } from '../../privacy';
import { AI_LANGUAGE_NAMES, DEFAULT_MAX_CHARS, firstName, selectItems, seriousAlerts, stageDescription } from '../context';
import { extractFindingsFromText } from '../extract';
import type { AIProvider, ExplainArgs, PersonaliseArgs, SuggestArgs, TranslateArgs, ExtractArgs } from '../types';

// ---------- Pidgin ----------

/** Conservative English -> Nigerian Pidgin phrase rules. Numbers, medicine names and doses are never touched. */
const PIDGIN_RULES: Array<[RegExp, string]> = [
  [/\bPlease\b/g, 'Abeg'],
  [/\bplease\b/g, 'abeg'],
  [/\bDo not\b|\bDon't\b/g, 'No'],
  [/\bdo not\b|\bdon't\b/g, 'no'],
  [/\bdoes not\b|\bdoesn't\b/g, 'no dey'],
  [/\bcannot\b|\bcan't\b/g, 'no fit'],
  [/\bimmediately\b|\bat once\b|\bright away\b/gi, 'sharp sharp'],
  [/\b(go|come|Go|Come) to the (clinic|hospital|health cent(?:re|er))\b/g, '$1 $2'],
  [/\b(go|Go) to the nearest hospital\b/g, '$1 the hospital wey near you'],
  [/\byour baby\b/g, 'your pikin'],
  [/\bYour baby\b/g, 'Your pikin'],
  [/\bthe baby\b/g, 'the pikin'],
  [/\bThe baby\b/g, 'The pikin'],
  [/\byou are\b/g, 'you dey'],
  [/\bYou are\b/g, 'You dey'],
  [/\bif you have\b/g, 'if you get'],
  [/\bIf you have\b/g, 'If you get'],
  [/\bif you feel\b/g, 'if you dey feel'],
  [/\bIf you feel\b/g, 'If you dey feel'],
  [/\byou have\b/g, 'you get'],
  [/\bYou have\b/g, 'You get'],
  [/\bsleep on your\b/g, 'sleep for your'],
  [/\bSleep on your\b/g, 'Sleep for your'],
  [/\ba lot of\b|\bplenty of\b/g, 'plenty'],
  [/\bvery\b/g, 'well well'],
  [/\bchild\b/g, 'pikin'],
  [/\bchildren\b/g, 'pikin dem'],
  [/\bhusband\b/g, 'oga (your husband)'],
];

export function toPidgin(text: string): string {
  let t = text;
  for (const [re, rep] of PIDGIN_RULES) t = t.replace(re, rep);
  return t;
}

// ---------- Message frames ----------

type Frame = {
  greet: (name: string) => string;
  intro: (stage: CarePlan['state']['stage']) => string;
  emergency: (titles: string, who: 'mother' | 'child') => string;
  urgent: (titles: string, who: 'mother' | 'child') => string;
  danger: Record<'pregnancy' | 'postpartum' | 'infant', string>;
  emergencyLine: (line: string) => string;
  signOff: (worker?: string, facility?: string) => string;
};

const EN: Frame = {
  greet: (n) => `Hello ${n},`,
  intro: (s) => (s === 'pregnancy' ? 'Here is your care plan for this stage of your pregnancy:' : s === 'preconception' ? 'Here is your care plan:' : 'Here is your care plan for you and your baby:'),
  emergency: (t, who) => `IMPORTANT: ${t}. ${who === 'child' ? 'Take your baby' : 'Go'} to the nearest hospital NOW. Do not wait.`,
  urgent: (t, who) => `IMPORTANT: ${t}. Please ${who === 'child' ? 'bring your baby' : 'come'} to the clinic TODAY.`,
  danger: {
    pregnancy: 'Go to the hospital at once if you have bleeding, a bad headache, blurred vision, fits, fever, swelling of face or hands, or the baby moves less.',
    postpartum: 'Go to the hospital at once if you have heavy bleeding, fever, a bad-smelling discharge, a bad headache, fits, or trouble breathing.',
    infant: 'Take your baby to the hospital at once if the baby cannot feed, has fever or feels cold, has fits, breathes fast or with difficulty, has yellow skin, or is very sleepy.',
  },
  emergencyLine: (l) => `Emergency: ${l}.`,
  signOff: (w, f) => (w && f ? `From ${w}, ${f}` : f ? `From your health worker, ${f}` : w ? `From ${w}, your health worker` : 'From your health worker'),
};

const PCM: Frame = {
  greet: (n) => `${n}, how you dey?`,
  intro: (s) => (s === 'pregnancy' ? 'See wetin you go do for this time of your belle:' : s === 'preconception' ? 'See your care plan:' : 'See wetin you go do for you and your pikin:'),
  emergency: (t, who) => `E DEY URGENT (${t}). ${who === 'child' ? 'Carry your pikin go' : 'Go'} the hospital wey near you NOW NOW. No wait at all.`,
  urgent: (t, who) => `E IMPORTANT (${t}). Abeg ${who === 'child' ? 'carry your pikin come' : 'come'} clinic TODAY.`,
  danger: {
    pregnancy: 'If you see blood, strong headache, your eye no clear, body dey shake (fits), hot body, face or hand swell, or pikin for belle no dey move well, go hospital sharp sharp.',
    postpartum: 'If blood dey commot plenty, hot body, discharge wey dey smell, strong headache, fits, or breathing wahala, go hospital sharp sharp.',
    infant: 'If your pikin no fit suck breast, get hot body or body cold, dey shake (fits), dey breathe fast or hard, skin turn yellow, or dey sleep too much, carry am go hospital sharp sharp.',
  },
  emergencyLine: (l) => `Emergency number: ${l}.`,
  signOff: (w, f) => (w && f ? `Na ${w} for ${f}` : f ? `Na your health worker for ${f}` : w ? `Na ${w}, your health worker` : 'Na your health worker'),
};

function dangerKey(plan: CarePlan): 'pregnancy' | 'postpartum' | 'infant' {
  const s = plan.state.stage;
  if (s === 'postpartum') return plan.alerts.some((a) => a.subject === 'child') ? 'infant' : 'postpartum';
  if (s === 'infant') return 'infant';
  return 'pregnancy';
}

function resolveNames(a: PersonaliseArgs): { worker?: string; facility?: string } {
  const dir = getPrivacyDirectory();
  const worker = a.workerName ?? dir.workers?.find((w) => w.id === a.mother.assignedWorkerId)?.name;
  const facility = a.facilityName ?? dir.facilities?.find((f) => f.id === a.mother.facilityId)?.name;
  return { worker, facility };
}

function itemLine(i: PlanItem, lang: 'en' | 'pcm'): string {
  const t = i.motherText.trim().replace(/\s+/g, ' ');
  const s = /[.!?]$/.test(t) ? t : `${t}.`;
  return lang === 'pcm' ? toPidgin(s) : s;
}

function joinFor(channel: Channel, parts: string[]): string {
  return channel === 'sms' || channel === 'voice' ? parts.join(' ') : parts.join('\n');
}

export interface TemplateMessageInput {
  plan: CarePlan;
  mother: Mother;
  channel: Channel;
  language: LanguageCode;
  itemIds?: string[];
  maxChars?: number;
  workerName?: string;
  facilityName?: string;
  emergencyLine?: string;
}

/** Build a deterministic message from the plan. English or Pidgin; other languages get English plus a note. */
export function composeTemplateMessage(a: TemplateMessageInput): string {
  const lang: 'en' | 'pcm' = a.language === 'pcm' ? 'pcm' : 'en';
  const f = lang === 'pcm' ? PCM : EN;
  const { worker, facility } = resolveNames(a as PersonaliseArgs);
  const items = selectItems(a.plan, a.itemIds);
  const max = a.maxChars ?? DEFAULT_MAX_CHARS[a.channel];

  const head: string[] = [];
  if (a.language !== 'en' && a.language !== 'pcm') head.push(`[needs translation: ${AI_LANGUAGE_NAMES[a.language]}]`);
  head.push(f.greet(firstName(a.mother)));

  const serious = seriousAlerts(a.plan);
  const alertParts: string[] = [];
  if (serious.length) {
    const emergency = serious.filter((x: Alert) => x.level === 'emergency');
    const list = emergency.length ? emergency : serious;
    const titles = list.map((x) => x.title).join('; ');
    const who: 'mother' | 'child' = list.every((x) => x.subject === 'child') ? 'child' : 'mother';
    alertParts.push(emergency.length ? f.emergency(titles, who) : f.urgent(titles, who));
    alertParts.push(f.danger[dangerKey(a.plan)]);
    if (a.emergencyLine) alertParts.push(f.emergencyLine(a.emergencyLine));
  }

  const tail = [f.signOff(worker ? worker.split(/\s+/)[0] : undefined, facility)];
  const lines = items.map((i) => itemLine(i, lang));
  const build = (ls: string[]) => joinFor(a.channel, [...head, ...alertParts, ...(ls.length ? [f.intro(a.plan.state.stage), ...ls] : []), ...tail]);

  // Keep the alert and danger signs; drop lowest-priority items until it fits
  let kept = lines.slice();
  let msg = build(kept);
  while (msg.length > max && kept.length > 1) {
    kept = kept.slice(0, -1);
    msg = build(kept);
  }
  if (msg.length > max && kept.length === 1 && alertParts.length) {
    msg = build([]);
  }
  return msg;
}

// ---------- Translate ----------

export function templateTranslate(texts: Record<string, string>, language: LanguageCode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(texts)) {
    if (language === 'en') out[k] = v;
    else if (language === 'pcm') out[k] = toPidgin(v);
    else out[k] = `[needs translation] ${v}`;
  }
  return out;
}

// ---------- Explain ----------

function list(xs: string[], max = 3): string {
  const u = [...new Set(xs.filter(Boolean))].slice(0, max);
  if (u.length <= 1) return u[0] ?? '';
  return `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`;
}

function lc(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function templateExplain(plan: CarePlan, mother: Mother): string {
  const name = firstName(mother);
  const s: string[] = [];
  s.push(`${name} is ${stageDescription(plan)}, so her plan follows the ${plan.state.stage === 'pregnancy' ? 'antenatal' : plan.state.stage === 'preconception' ? 'preconception' : 'postnatal and child health'} schedule.`);
  if (plan.alerts.length) {
    s.push(`It is led by ${plan.alerts.length === 1 ? 'an alert' : `${plan.alerts.length} alerts`}: ${list(plan.alerts.map((a) => `${a.title} (${lc(a.reason)})`), 2)}.`);
  }
  const risks = plan.state.risks ?? [];
  if (risks.length) s.push(`Gaskin flagged ${list(risks.map((r) => `${lc(r.label)} because ${lc(r.reason)}`), 2)}.`);
  const active = plan.items.filter((i) => i.status === 'active').sort((a, b) => a.priority - b.priority);
  const top = active.slice(0, 3);
  if (top.length) {
    s.push(`The highest-priority items are ${list(top.map((i) => lc(i.title)))}.`);
    const reasons = list(top.flatMap((i) => i.because.slice(0, 1)).map(lc), 3);
    if (reasons) s.push(`They were added because ${reasons}.`);
  }
  const locked = active.filter((i) => i.locked).length;
  if (locked) s.push(`${locked} item${locked === 1 ? ' is' : 's are'} safety-locked and cannot be removed by one worker alone.`);
  if (plan.nextContact && s.length < 6) s.push(`Her next contact is ${plan.nextContact.label}.`);
  if (s.length < 4) s.push(`${active.length} active items in total; each one shows its source and the facts that triggered it.`);
  return s.slice(0, 6).join(' ');
}

// ---------- Provider ----------

export const templateProvider: AIProvider = {
  id: 'template',
  label: 'Offline templates (no AI)',
  live: false,
  async personaliseMessage(a: PersonaliseArgs) {
    const msg = composeTemplateMessage(a);
    a.onText?.(msg);
    return msg;
  },
  async translate(a: TranslateArgs) {
    return templateTranslate(a.texts, a.language);
  },
  async extractFindings(a: ExtractArgs) {
    return extractFindingsFromText(a.text);
  },
  async explainPlan(a: ExplainArgs) {
    const t = templateExplain(a.plan, a.mother);
    a.onText?.(t);
    return t;
  },
  async suggestItems(_a: SuggestArgs) {
    void _a;
    return [];
  },
};
