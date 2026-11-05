/**
 * Guardrails run on every AI output, from every provider, before a worker
 * sees it. They catch the failure modes that matter most for safety:
 *  - a medicine or dose that is not in her active plan
 *  - "stop taking", "no need to go to hospital" and similar reassurance
 *    when the plan has alerts
 *  - an urgent or emergency plan whose message does not tell her to act
 * They do not judge tone or length (length is the messaging module's job).
 * Issues are written in plain English for the worker.
 */
import type { CarePlan, Mother, PlanItem } from '../types';
import { findMedicines } from './lexicon';
import type { SuggestedItem } from './types';

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

export interface ValidateOptions {
  /** 'mother' (default): a message she will receive. 'worker': an explanation for the worker (no danger-sign check). */
  audience?: 'mother' | 'worker';
  /** Extra source text whose medicines and doses are allowed (e.g. the English source of a translation) */
  allowedSource?: string;
}

// ---------- Doses ----------

const DOSE_RE =
  /(\d+(?:[.,]\d+)?)\s*(mg|milligrams?|µg|μg|ug|mcg|micrograms?|ml|mls|millilit(?:re|er)s?|g\b|grams?|iu\b|units?\b|tabs?\b|tablets?|caps?\b|capsules?|sachets?|drops?|puffs?|teaspoons?|tsp\b|spoons?)/gi;
/** Number words used for tablets: "two tablets", "one tablet" */
const WORD_DOSE_RE = /\b(one|two|three|four|five|six|half|a)\s+(tablets?|tabs?|capsules?|caps?|sachets?|teaspoons?|spoons?)\b/gi;

const NUM_WORDS: Record<string, string> = { a: '1', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', half: '0.5' };

function unitKey(u: string): string {
  const x = u.toLowerCase();
  if (/^(mg|milligram)/.test(x)) return 'mg';
  if (/^(µg|μg|ug|mcg|microgram)/.test(x)) return 'mcg';
  if (/^(ml|millilit)/.test(x)) return 'ml';
  if (/^(g|gram)/.test(x)) return 'g';
  if (/^(iu|unit)/.test(x)) return 'iu';
  if (/^(tab|cap)/.test(x)) return 'tab';
  if (/^sachet/.test(x)) return 'sachet';
  if (/^drop/.test(x)) return 'drop';
  if (/^puff/.test(x)) return 'puff';
  if (/^(teaspoon|tsp|spoon)/.test(x)) return 'tsp';
  return x;
}

export interface DoseMention {
  key: string;
  text: string;
}

export function findDoses(text: string): DoseMention[] {
  const out: DoseMention[] = [];
  for (const m of text.matchAll(DOSE_RE)) {
    const n = m[1].replace(',', '.');
    out.push({ key: `${parseFloat(n)}${unitKey(m[2])}`, text: m[0].trim() });
  }
  for (const m of text.matchAll(WORD_DOSE_RE)) {
    out.push({ key: `${NUM_WORDS[m[1].toLowerCase()]}${unitKey(m[2])}`, text: m[0].trim() });
  }
  return out;
}

// ---------- Plan text ----------

function itemText(i: PlanItem): string {
  return [i.title, i.detail, i.motherText, i.timing ?? ''].join('\n');
}

export function activePlanText(plan: CarePlan): string {
  return plan.items
    .filter((i) => i.status === 'active')
    .map(itemText)
    .join('\n');
}

// ---------- Phrases ----------

/** Always unsafe: telling her to stop or skip medicine, unless the plan itself says so */
const STOP_MEDICINE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bstop\s+(?:taking|using|the\s+(?:medicine|tablets?|drugs?))\b/i, label: 'stop taking' },
  { re: /\b(?:no\s+need\s+to|don'?t\s+need\s+to|do\s+not\s+need\s+to)\s+take\b/i, label: 'no need to take' },
  { re: /\b(?:you\s+can|you\s+may)\s+stop\b/i, label: 'you can stop' },
  { re: /\b(?:skip|miss)\s+(?:a\s+|your\s+)?(?:dose|tablets?|medicine)\b/i, label: 'skip a dose' },
  { re: /\bno\s+(?:need|wahala)\s+(?:make\s+you\s+)?take\b/i, label: 'no need take (Pidgin)' },
  { re: /\b(?:stop\s+to\s+take|you\s+fit\s+stop)\b/i, label: 'stop to take (Pidgin)' },
  { re: /\bacha\s+kutumia\b|\bacha\s+kumeza\b/i, label: 'acha kutumia (Swahili: stop using)' },
];

/** Unsafe when the plan has any alert: reassurance that could delay care */
const REASSURANCE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bno\s+need\s+to\s+(?:go|come|visit|rush|worry)\b/i, label: 'no need to go' },
  { re: /\b(?:don'?t|do\s+not|doesn'?t\s+need\s+to|need\s+not)\s+(?:go|come|rush)\s+(?:to\s+)?(?:the\s+)?(?:hospital|clinic|health\s+cent(?:re|er)|facility)\b/i, label: "don't go to the hospital" },
  { re: /\b(?:it\s+is|it'?s|this\s+is|that\s+is|is\s+quite|is\s+completely|is\s+perfectly)\s+(?:quite\s+|completely\s+|perfectly\s+|very\s+)?normal\b/i, label: 'it is normal' },
  { re: /\bnothing\s+to\s+worry\s+about\b/i, label: 'nothing to worry about' },
  { re: /\b(?:will|should)\s+go\s+away\s+(?:on\s+its\s+own|by\s+itself)\b/i, label: 'will go away on its own' },
  { re: /\b(?:wait\s+and\s+see|wait\s+until\s+(?:your\s+)?next\s+(?:visit|appointment))\b/i, label: 'wait and see' },
  { re: /\bno\s+need\s+(?:make\s+you\s+)?go\b/i, label: 'no need go (Pidgin)' },
  { re: /\be\s+(?:dey\s+)?normal\b/i, label: 'e normal (Pidgin)' },
  { re: /\bno\s+(?:worry|fear)\b(?![^.]*\b(?:go|come)\b)/i, label: 'no worry (Pidgin)' },
  { re: /\bni\s+kawaida\b/i, label: 'ni kawaida (Swahili: it is normal)' },
  { re: /\bhakuna\s+haja\s+ya\s+kwenda\b/i, label: 'hakuna haja ya kwenda (Swahili: no need to go)' },
];

/** Words that show the message tells her to act on danger, across languages */
const ACT_NOW_RE = new RegExp(
  [
    // English
    String.raw`\bhospital\b`, String.raw`\bclinic\b`, String.raw`\bhealth\s+cent(?:re|er)\b`, String.raw`\bdanger\b`, String.raw`\burgent`, String.raw`\bemergency\b`, String.raw`\bimmediately\b`, String.raw`\bright\s+away\b`, String.raw`\bnow\b`, String.raw`\btoday\b`,
    // Pidgin
    String.raw`\bsharp\s+sharp\b`, String.raw`\bnow\s+now\b`, String.raw`\bquick\s+quick\b`,
    // Swahili
    'hospitali', 'kliniki', String.raw`dalili\s+za\s+hatari`, String.raw`mara\s+moja`, 'haraka', 'hatari', 'leo',
    // Hausa
    'asibiti', 'gaggawa', 'yanzu', 'haɗari', 'hadari', 'cibiyar\\s+lafiya',
    // Yoruba (with and without tone marks)
    'ilé[-\\s]?ìwòsàn', 'ile[-\\s]?iwosan', 'ilé[-\\s]?ìwòsan', 'kíákíá', 'kiakia', 'lẹ́sẹ̀kẹsẹ̀', 'lesekese', 'ewu',
    // Igbo
    'ụlọ\\s+ọgwụ', 'ulo\\s+ogwu', 'ọsịịsọ', 'osiiso', 'ugbu\\s+a', 'ihe\\s+ize\\s+ndụ', 'ize\\s+ndu',
    // Twi
    'ayaresabea', 'ayaresa', 'ntɛm', 'ntem', 'seesei', 'asiane',
  ].join('|'),
  'iu',
);

function medicineIssues(text: string, allowedText: string): string[] {
  const issues: string[] = [];
  const allowedMeds = new Set(findMedicines(allowedText).map((m) => m.generic));
  const seen = new Set<string>();
  for (const m of findMedicines(text)) {
    if (allowedMeds.has(m.generic) || seen.has(m.generic)) continue;
    seen.add(m.generic);
    issues.push(
      `Mentions the medicine "${m.matched}"${m.matched.toLowerCase() !== m.generic.toLowerCase() ? ` (${m.generic})` : ''}, which is not in her active plan. Remove it, or add it to the plan through the usual clinical route first.`,
    );
  }
  const allowedDoses = new Set(findDoses(allowedText).map((d) => d.key));
  const seenDose = new Set<string>();
  for (const d of findDoses(text)) {
    if (allowedDoses.has(d.key) || seenDose.has(d.key)) continue;
    seenDose.add(d.key);
    issues.push(`Gives the dose or amount "${d.text}", which does not appear in her active plan. Check it against the plan and remove it if it is not there.`);
  }
  return issues;
}

/**
 * Check AI text before a worker approves it.
 * Contract: validateAIText(text, plan, mother) -> { ok, issues }.
 * The optional 4th argument is an extension (audience, allowed source text).
 */
export function validateAIText(text: string, plan: CarePlan, mother: Mother, opts: ValidateOptions = {}): ValidationResult {
  void mother;
  const issues: string[] = [];
  const t = text ?? '';
  if (!t.trim()) return { ok: false, issues: ['The AI returned an empty text.'] };

  const planText = activePlanText(plan) + '\n' + (opts.allowedSource ?? '');
  issues.push(...medicineIssues(t, planText));

  for (const p of STOP_MEDICINE_PATTERNS) {
    if (p.re.test(t) && !p.re.test(planText)) {
      issues.push(`Says "${p.label}". Gaskin never tells a mother to stop or skip medicine; only a clinician can change her medicines.`);
    }
  }

  const hasAlerts = plan.alerts.length > 0;
  if (hasAlerts) {
    for (const p of REASSURANCE_PATTERNS) {
      if (p.re.test(t) && !p.re.test(planText)) {
        issues.push(`Says "${p.label}" while her plan has an alert. Reassurance like this could delay care; remove it.`);
      }
    }
  }

  const serious = plan.alerts.filter((a) => a.level === 'emergency' || a.level === 'urgent');
  if (serious.length && (opts.audience ?? 'mother') === 'mother' && !ACT_NOW_RE.test(t)) {
    const level = serious.some((a) => a.level === 'emergency') ? 'an emergency' : 'an urgent';
    issues.push(
      `Her plan has ${level} alert (${serious.map((a) => a.title).join('; ')}), but the message does not tell her to go to the hospital or clinic now or name the danger signs. Add the danger-sign line.`,
    );
  }

  const leftover = t.match(/\[(?:MOTHER|BABY|CARER|WORKER|DOCTOR|PERSON|PHONE|EMAIL|ID|ADDRESS|COMMUNITY|FACILITY|REGION|DATE|EMERGENCY_LINE)\]/g);
  if (leftover) issues.push(`Contains placeholder text (${[...new Set(leftover)].join(', ')}) that must be replaced before sending.`);

  if (/\[needs translation/i.test(t)) issues.push('Part of this text still needs translating before it is sent.');

  return { ok: issues.length === 0, issues };
}

// ---------- Suggestions ----------

const SUGGESTION_ALLOWED: PlanItem['category'][] = ['family_support', 'education', 'birth_preparedness', 'rest_and_sleep', 'mental_health', 'activity', 'baby_care', 'breastfeeding', 'nutrition'];

const CLINICAL_WORDS =
  /\b(?:tests?|testing|screen(?:ing)?|scan|ultrasound|x-?ray|lab(?:oratory)?|blood\s+(?:test|sugar|pressure\s+check)|diagnos\w*|prescri\w*|dose|dosage|supplements?|vitamins?|herbs?|herbal|agbo|concoction|injection|inject|medicines?|medication|drugs?|tablets?|pills?|capsules?|antibiotic\w*|referr?\w*|admit\w*|induc\w*|caesarean|c-section)\b/i;

/** Validate AI-suggested items: non-clinical only, no medicines, doses, tests or diagnoses. Returns the safe ones and the reasons others were dropped. */
export function filterSuggestions(raw: unknown, plan: CarePlan): { items: SuggestedItem[]; rejected: string[] } {
  const items: SuggestedItem[] = [];
  const rejected: string[] = [];
  if (!Array.isArray(raw)) return { items, rejected: ['The AI did not return a list.'] };
  const existing = new Set(plan.items.map((i) => i.title.trim().toLowerCase()));
  for (const r of raw.slice(0, 6)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const title = String(o.title ?? '').trim();
    const detail = String(o.detail ?? '').trim();
    const motherText = String(o.motherText ?? o.mother_text ?? '').trim();
    let category = String(o.category ?? 'family_support').trim() as PlanItem['category'];
    if (!title || !motherText) continue;
    const all = `${title}\n${detail}\n${motherText}`;
    if (findMedicines(all).length || findDoses(all).length || CLINICAL_WORDS.test(all)) {
      rejected.push(`"${title}" was dropped because it mentions medicines, doses, tests or diagnoses.`);
      continue;
    }
    if (existing.has(title.toLowerCase())) continue;
    if (!SUGGESTION_ALLOWED.includes(category)) category = 'family_support';
    items.push({ title: title.slice(0, 80), detail: detail.slice(0, 300), motherText: motherText.slice(0, 240), category });
    if (items.length >= 3) break;
  }
  return { items, rejected };
}
