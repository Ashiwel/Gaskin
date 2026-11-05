import type { Alert, CarePlan, Channel, CountryProfile, LanguageCode, Mother, PlanItem, SymptomCode } from '../types';
import { FACILITIES, WORKERS } from '../data/directory';
import { LANGUAGE_NAMES } from '../data/countries';

// ---------------------------------------------------------------------------
// Channel choice
// ---------------------------------------------------------------------------

/**
 * Cheapest channel that reliably reaches her.
 * smartphone + WhatsApp → whatsapp; feature or shared phone → sms
 * (voice and print offered when she cannot read); no phone → print via worker.
 * A recorded consent.preferredChannel wins when it is usable.
 */
export function chooseChannel(mother: Mother, country: CountryProfile): { channel: Channel; reason: string; alternatives: Channel[] } {
  const { access, hasWhatsApp } = mother.phone;
  const cannotRead = mother.literacy === 'none';
  const sms = unitCost(country, 'sms');
  const wa = unitCost(country, 'whatsapp');
  const money = (n: number) => `${country.currencySymbol}${n < 1 ? n.toFixed(2) : n.toFixed(n < 10 ? 2 : 0)}`;

  // Default recommendation
  let channel: Channel;
  let reason: string;
  let alternatives: Channel[];

  if (access === 'none') {
    channel = 'print';
    reason = 'She has no phone, so the health worker hands her a printed picture sheet at each visit and talks it through with her family.';
    alternatives = ['voice'];
  } else if (access === 'smartphone' && hasWhatsApp) {
    channel = 'whatsapp';
    reason = `She has her own smartphone with WhatsApp. A WhatsApp utility message costs about ${money(wa)} and can carry pictures and voice notes; replies are easy for her.`;
    alternatives = cannotRead ? ['voice', 'sms', 'print'] : ['sms', 'print'];
    if (cannotRead) reason += ' She cannot read, so send pictures and a voice note rather than long text.';
  } else if (cannotRead) {
    channel = 'sms';
    reason = `SMS (${money(sms)} per part) reaches any phone, but she cannot read, so a short SMS should only prompt someone at home to read it out. A voice call in ${LANGUAGE_NAMES[mother.language]} or a printed picture sheet will reach her better.`;
    alternatives = ['voice', 'print'];
  } else {
    channel = 'sms';
    reason =
      access === 'shared'
        ? `She shares a phone, so SMS is the only thing that reliably arrives (${money(sms)} per part). Keep it short and avoid private details, because others may read it.`
        : `She has a basic phone without WhatsApp. SMS is the cheapest channel that reaches her (${money(sms)} per part).`;
    alternatives = ['voice', 'print'];
  }

  const pref = mother.consent.preferredChannel;
  if (pref && pref !== channel && channelUsable(pref, mother)) {
    const why = `She asked for ${channelName(pref)} when she gave consent, so we use that.`;
    return { channel: pref, reason: `${why} (Otherwise: ${channelName(channel)}. ${reason})`, alternatives: uniq([channel, ...alternatives.filter((a) => a !== pref)]) };
  }
  if (pref && pref !== channel && !channelUsable(pref, mother)) {
    reason += ` She asked for ${channelName(pref)}, but that does not work with her current phone, so it is not used.`;
  }
  return { channel, reason, alternatives };
}

function channelUsable(ch: Channel, m: Mother): boolean {
  switch (ch) {
    case 'whatsapp':
      return m.phone.access !== 'none' && m.phone.hasWhatsApp;
    case 'sms':
    case 'voice':
      return m.phone.access !== 'none';
    case 'email':
      return !!m.email;
    case 'print':
      return true;
  }
}

function channelName(ch: Channel): string {
  return { sms: 'SMS', whatsapp: 'WhatsApp', email: 'email', voice: 'a voice call', print: 'a printed sheet' }[ch];
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function unitCost(country: CountryProfile, ch: Channel): number {
  return country.channelCosts.find((c) => c.channel === ch)?.unitCostLocal ?? 0;
}

// ---------------------------------------------------------------------------
// SMS segments and cost
// ---------------------------------------------------------------------------

// GSM 03.38 basic character set, plus the extension table (each extension char counts as 2).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
const GSM_BASIC_SET = new Set([...GSM_BASIC]);
const GSM_EXT_SET = new Set([...GSM_EXT]);

/** True when every character fits GSM-7 (so 160 chars per single SMS). */
export function isGsm7(text: string): boolean {
  for (const ch of text) if (!GSM_BASIC_SET.has(ch) && !GSM_EXT_SET.has(ch)) return false;
  return true;
}

/**
 * Number of SMS segments. GSM-7: 160 single, 153 per part when concatenated
 * (extension characters count double). UCS-2 (any other character, e.g.
 * Hausa ƙ ɗ ɓ, Yoruba ẹ ọ ṣ with tone marks, Twi ɛ ɔ): 70 single, 67 per part,
 * counted in UTF-16 code units. Empty text is 0 segments.
 */
export function smsSegments(text: string): number {
  if (!text) return 0;
  if (isGsm7(text)) {
    let len = 0;
    for (const ch of text) len += GSM_EXT_SET.has(ch) ? 2 : 1;
    return len <= 160 ? 1 : Math.ceil(len / 153);
  }
  const len = text.length; // UTF-16 code units
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

/** Rough spoken length: about 130 words a minute for a slow, clear health message. */
function voiceMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 130));
}

/** Printed A4 pages: about 1,800 characters of large-print text with pictures per page. */
function printPages(text: string): number {
  return Math.max(1, Math.ceil(text.length / 1800));
}

export function estimateCost(channel: Channel, text: string, country: CountryProfile): { local: number; usd: number; units: number; unitLabel: string } {
  const entry = country.channelCosts.find((c) => c.channel === channel);
  let units: number;
  let unitLabel: string;
  switch (channel) {
    case 'sms':
      units = smsSegments(text);
      unitLabel = units === 1 ? 'SMS part' : 'SMS parts';
      break;
    case 'whatsapp':
      units = text ? 1 : 0;
      unitLabel = 'WhatsApp utility message';
      break;
    case 'voice':
      units = text ? voiceMinutes(text) : 0;
      unitLabel = units === 1 ? 'minute of voice' : 'minutes of voice';
      break;
    case 'print':
      units = text ? printPages(text) : 0;
      unitLabel = units === 1 ? 'printed page' : 'printed pages';
      break;
    case 'email':
      units = text ? 1 : 0;
      unitLabel = 'email';
      break;
  }
  const local = round((entry?.unitCostLocal ?? 0) * units, 4);
  const usd = round((entry?.unitCostUSD ?? 0) * units, 5);
  return { local, usd, units, unitLabel };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Fallback (template) messages and language packs
// ---------------------------------------------------------------------------

const SMS_MAX_SEGMENTS = 3;

/**
 * A language pack turns plan items into mother-facing text in one language
 * without AI. Nigerian Pidgin ships here; other packs are registered at
 * runtime by the language-pack module via registerLanguagePack().
 */
export interface LanguagePack {
  language: LanguageCode;
  greeting: (firstName: string) => string;
  signOff: (facilityName: string) => string;
  replyHint: string;
  alert: Record<Alert['level'], string>;
  /** Text for one plan item; return undefined to fall back to plain English for that line */
  item: (item: PlanItem) => string | undefined;
}

const ENGLISH: LanguagePack = {
  language: 'en',
  greeting: (n) => `Hello ${n},`,
  signOff: (f) => `- ${f}`,
  replyHint: 'Reply to tell us how you feel.',
  alert: {
    emergency: 'URGENT: please go to the hospital now, or call us. Do not wait.',
    urgent: 'Please come to the clinic today so we can check you.',
    warning: 'Please come to the clinic soon so we can check you.',
  },
  item: (i) => plainEnglish(i.motherText),
};

/** Hand-written Pidgin for the most common plan lines, by item id pattern. */
const PIDGIN_BY_ID: Array<[RegExp, string]> = [
  [/^danger\.pregnancy/, 'If blood dey comot for your private part, head dey bang you well well, eye dey blur, belle dey pain you or pikin no dey move for belle, run go hospital sharp sharp.'],
  [/^danger\.postpartum/, 'If you dey bleed plenty, get fever or your breast dey pain you well well, or baby no dey suck, dey breathe fast or body hot, carry am go hospital now.'],
  [/^med\.iron/, 'Take your blood tablet (iron and folic acid) every day. E dey give you and baby blood.'],
  [/^med\.iptp/, 'Take the malaria medicine (SP) wey clinic go give you for your next visit.'],
  [/^rest\.itn/, 'Sleep inside treated mosquito net every night.'],
  [/^visit\.anc/, 'No miss your next clinic visit. Carry your card come.'],
  [/^visit\.pnc/, 'Make you and baby come clinic for check-up after birth. No miss am.'],
  [/^bf\.exclusive/, 'Give baby only breast milk, day and night. No water, no pap, no glucose until 6 months.'],
  [/^bf\.(low_milk_plan|latch)/, 'Put baby for breast often, 8 to 12 times every day. The more baby suck, the more milk go come. Drink water and chop well.'],
  [/^nutr\.iron_foods/, 'Chop beans, egg, fish, liver and ugu or other green leaf. E go give you blood.'],
  [/^nutr\./, 'Chop well: beans, egg, fish, vegetable and fruit every day.'],
  [/^rest\.sleep_left_side/, 'When you wan sleep, lie for your left side.'],
  [/^rest\./, 'Rest well. Make family help you with house work.'],
  [/^imm\./, 'Carry baby come clinic for im injection. E dey protect am from sickness.'],
  [/^mh\./, 'If your mind dey heavy or you no fit sleep, talk to us. You no dey alone.'],
  [/^baby\.cord_care/, 'Keep baby navel clean and dry. No put anything for am.'],
];

const PIDGIN: LanguagePack = {
  language: 'pcm',
  greeting: (n) => `${n}, how you dey?`,
  signOff: (f) => `- ${f}`,
  replyHint: 'Reply tell us how you dey.',
  alert: {
    emergency: 'URGENT: abeg go hospital now now, or call us. No wait at all.',
    urgent: 'Abeg come clinic today make we check you.',
    warning: 'Abeg come clinic soon make we check you.',
  },
  item: (i) => {
    for (const [re, line] of PIDGIN_BY_ID) if (re.test(i.id)) return line;
    return undefined; // plain English for anything not hand-written
  },
};

const PACKS: Partial<Record<LanguageCode, LanguagePack>> = { en: ENGLISH, pcm: PIDGIN };

/** Install (or replace) a language pack. Used by the language-pack module. */
export function registerLanguagePack(pack: LanguagePack): void {
  PACKS[pack.language] = pack;
}

export function hasLanguagePack(lang: LanguageCode): boolean {
  return !!PACKS[lang];
}

/**
 * Note for the worker (not sent to the mother) when the message falls back to
 * plain English because no pack is installed for her language.
 */
export function fallbackLanguageNote(lang: LanguageCode): string | undefined {
  if (PACKS[lang]) return undefined;
  return `No ${LANGUAGE_NAMES[lang]} pack installed: this message is in plain English. Use AI translation and check it before sending, or read it to her in ${LANGUAGE_NAMES[lang]}.`;
}

/** Medical words a mother may not know, in everyday English. */
const PLAIN: Array<[RegExp, string]> = [
  [/\bantenatal (care|clinic|contact|visit)s?\b/gi, 'pregnancy check-up'],
  [/\bpostnatal (care|check|contact|visit)s?\b/gi, 'check-up after birth'],
  [/\bANC\b/g, 'pregnancy check-up'],
  [/\bPNC\b/g, 'check-up after birth'],
  [/\bhaemoglobin\b|\bhemoglobin\b|\bHb\b/g, 'blood level'],
  [/\banaemi(a|c)\b|\banemi(a|c)\b/gi, 'low blood'],
  [/\bpre-?eclampsia\b/gi, 'high blood pressure in pregnancy'],
  [/\bhypertension\b/gi, 'high blood pressure'],
  [/\bIPTp(-SP)?\b/g, 'malaria prevention medicine'],
  [/\bITN\b|\bLLIN\b/g, 'treated mosquito net'],
  [/\bfolic acid\b/gi, 'folic acid (pregnancy vitamin)'],
  [/\bimmuni[sz]ation(s)?\b/gi, 'baby injections'],
  [/\bvaccination(s)?\b/gi, 'injections'],
  [/\bexclusive(ly)? breastfe(e)?d(ing)?\b/gi, 'breast milk only'],
  [/\bcolostrum\b/gi, 'first yellow milk'],
  [/\bumbilical cord\b/gi, 'navel cord'],
  [/\bgestational diabetes\b/gi, 'high sugar in pregnancy'],
  [/\bfetal movements?\b|\bfoetal movements?\b/gi, "baby's movements"],
  [/\bcontraception\b|\bcontraceptive(s)?\b/gi, 'family planning'],
  [/\bmedication(s)?\b/gi, 'medicine'],
  [/\bhaemorrhage\b|\bhemorrhage\b/gi, 'heavy bleeding'],
  [/\bdehydrat(ed|ion)\b/gi, 'short of water in the body'],
  [/\bnutrition(al)?\b/gi, 'food'],
];

/** Swap medical words for everyday ones (the mother-facing text is already short). */
export function plainEnglish(s: string): string {
  let out = s.trim();
  for (const [re, w] of PLAIN) out = out.replace(re, w);
  return out;
}

/**
 * Deterministic message built from the plan without AI.
 * Top alert first, then items by priority (1 highest), signed with her facility.
 * Uses the installed pack for her language (English and Pidgin ship here);
 * anything without a pack is written in plain everyday English.
 * SMS is kept to at most 3 segments by dropping the lowest-priority lines.
 */
export function composeFallbackMessage(plan: CarePlan, mother: Mother, opts: { channel: Channel; language: LanguageCode; itemIds?: string[] }): string {
  const pack = PACKS[opts.language] ?? ENGLISH;
  const first = mother.name.split(' ')[0];
  const facility = signature(mother);

  const items = plan.items
    .filter((i) => i.status === 'active' && i.audience !== 'worker' && i.motherText)
    .filter((i) => !opts.itemIds || opts.itemIds.includes(i.id))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const lines: string[] = [];
  const topAlert = [...plan.alerts].sort((a, b) => rank(a.level) - rank(b.level))[0];
  if (topAlert) lines.push(pack.alert[topAlert.level] ?? ENGLISH.alert[topAlert.level]);
  for (const it of items) {
    const t = pack.item(it) ?? ENGLISH.item(it)!;
    if (t && !lines.includes(t)) lines.push(t);
  }

  const head = pack.greeting(first);
  const tail = pack.signOff(facility);

  if (opts.channel !== 'sms') {
    // Without an explicit selection, keep chat and voice short: highest-priority lines only.
    const cap = opts.itemIds ? Infinity : opts.channel === 'whatsapp' ? 6 : opts.channel === 'voice' ? 5 : Infinity;
    const kept = lines.slice(0, cap);
    const body = opts.channel === 'voice' ? kept : kept.map((l, i) => (i === 0 && topAlert ? l : `• ${l}`));
    return [head, ...body, ...(opts.channel === 'whatsapp' && pack.replyHint ? [pack.replyHint] : []), tail].join('\n');
  }

  const smsBody = (body: string[], hint: boolean) => [head, ...body, ...(hint && pack.replyHint ? [pack.replyHint] : []), tail].join(' ');
  let body = [...lines];
  let hint = true;
  while (smsSegments(smsBody(body, hint)) > SMS_MAX_SEGMENTS && (body.length > 1 || hint)) {
    if (hint) hint = false;
    else body = body.slice(0, -1);
  }
  if (smsSegments(smsBody(body, hint)) > SMS_MAX_SEGMENTS && body.length) {
    // One very long line: cut at a word boundary.
    const gsm = isGsm7(smsBody(body, false));
    const room = (gsm ? 153 : 67) * SMS_MAX_SEGMENTS - smsBody([], false).length - 5;
    body = [body[0].slice(0, Math.max(0, room)).replace(/\s+\S*$/, '') + '...'];
  }
  return smsBody(body, hint);
}

function rank(l: Alert['level']): number {
  return l === 'emergency' ? 0 : l === 'urgent' ? 1 : 2;
}

function signature(mother: Mother): string {
  const worker = WORKERS.find((w) => w.id === mother.assignedWorkerId);
  const facility = FACILITIES.find((f) => f.id === (mother.facilityId || worker?.facilityId));
  return facility?.name ?? 'your clinic';
}

// ---------------------------------------------------------------------------
// Symptom parsing from free text (SMS / WhatsApp / voice transcripts)
// ---------------------------------------------------------------------------

/**
 * Phrase lexicon. Patterns are matched against lower-cased text with
 * accents stripped (so Yoruba/Hausa diacritics do not break matching).
 * Order does not matter; all matches are returned in lexicon order.
 */
const SYMPTOM_PATTERNS: Array<[SymptomCode, RegExp[]]> = [
  ['convulsions', [/\bconvuls/, /\b(having|had|get|got|dey get|catch) (a )?fits?\b/, /\bfitting\b/, /\bseizure/, /\bjerk(ing)?\b/, /\b(dey|de) shake (and|come|con) fall\b/, /\bgiddiness\b.*\bfall\b/]],
  ['vaginal_bleeding', [/\bbleed(ing)?\b(?!.*(gum|nose))/, /\bblood (dey|is|de) (comot|come|commot|come out|pour)/, /\bblood\b.*\b(down there|private|pant)/, /\bspotting\b/, /\bjini\b/, /\bdamu\b/, /\bmogya\b/]],
  ['heavy_postpartum_bleeding', [/\b(heavy|plenty|too much|soak(ing|ed)?)\b.*\b(bleed|blood|pad)/, /\bblood\b.*\b(plenty|too much|well well)\b/]],
  ['severe_headache', [/\b(severe|bad|strong|serious|terrible|bad bad)\b.*\bhead ?ache\b/, /\bhead ?ache\b.*\b(severe|bad|strong|no gree|won'?t go|serious|well well)\b/, /\bhead\b.*\b(dey|de) (bang|pain|split|hammer|knack)\b/, /\bhead (dey|de) (turn|do me)\b/, /\bheadache\b/, /\bciwon kai\b/, /\borififo\b/, /\bisi (na )?(ewu|awa) m\b/, /\bmaumivu ya kichwa\b/, /\bkichwa\b.*\b(uma|inauma)\b/, /\bme ti (pae|yɛ me ya)\b/, /\bti pae\b/]],
  ['blurred_vision', [/\bblur/, /\b(no fit|can'?t|cannot) see (well|clear)/, /\b(eye|eyes|vision)\b.*\b(dey|de)?\s?(dark|blur|turn|spark|see star)/, /\bsee(ing)? (stars|spots|double)\b/, /\bmacho\b.*\b(giza|kufifia)\b/]],
  ['swelling_face_hands', [/\b(swell|swollen|swelling|don swell|dey swell|puff)/, /\bkumburi\b/, /\bewiwu\b/, /\buvimbe\b/, /\bkuvimba\b/, /\bahoninam\b/]],
  ['severe_abdominal_pain', [/\b(belle|belly|stomach|tummy|abdomen|abdominal)\b.*\b(pain|dey pain|dey turn|hurt)/, /\b(pain|hurt)\b.*\b(belle|belly|stomach|tummy|abdomen)\b/, /\bciwon ciki\b/, /\binu (n )?run\b/, /\bafo (na )?(ewu|awa)\b/, /\btumbo\b.*\b(uma|maumivu)\b/, /\bmaumivu ya tumbo\b/, /\byafunu\b.*\bya\b/]],
  ['reduced_fetal_movement', [/\b(baby|pikin|pickin|child|belle)\b.*\b(no|not|never|stop(ped)?|less|reduce|no dey|never)\b.*\b(move|kick|moving|kicking)/, /\b(no|not|less|reduced?) (feel(ing)? )?(the )?(baby )?(move|kick)/, /\bmtoto\b.*\b(hachezi|hacheza)\b/]],
  ['leaking_fluid', [/\b(water|fluid)\b.*\b(leak|break|broke|pour|dey comot|dey run)/, /\bleak(ing)?\b/, /\bwater don break\b/]],
  ['fever', [/\bfever\b(?!.*\b(baby|pikin|pickin)\b)/, /\bbody (dey|de) hot\b(?!.*\b(baby|pikin)\b)/, /\bhot body\b/, /\bmalaria\b/, /\bzazzabi\b/, /\bibà\b|\biba\b/, /\bahu oku\b/, /\bhoma\b/, /\bhoma\b/, /\bati(ridi)?\b/]],
  ['breathlessness', [/\b(breath|breathe|breathing)\b.*\b(hard|difficult|short|no dey|wahala|problem|catch)/, /\bshort(ness)? of breath\b/, /\bcan'?t breathe\b/, /\bno fit breathe\b/, /\bbreathless/]],
  ['painful_urination', [/\b(pee|urine|urinat|wee)\w*\b.*\b(pain|burn|hurt|dey pepper)/, /\b(pain|burn)\w*\b.*\b(pee|urine|urinat|wee)/]],
  ['nausea_vomiting', [/\bvomit/, /\bnause/, /\bthrow up\b/, /\bdey purge and vomit\b/, /\bamai\b/, /\btapika\b/]],
  ['heartburn', [/\bheart ?burn\b/, /\bchest (dey|de) burn\b/, /\bacid\b/]],
  ['back_pain', [/\bback ?(pain|ache)\b/, /\bback (dey|de) pain\b/, /\bmy waist (dey|de) pain\b/, /\bwaist pain\b/]],
  ['leg_cramps', [/\bcramp/]],
  ['constipation', [/\bconstipat/, /\bno fit (toilet|poo|shit)\b/]],
  ['fatigue', [/\b(tired|weak|fatigue|no (get|have) power|body (dey|de) weak|gajiya|choka)\b/]],
  ['low_mood', [/\b(sad|depress|cry(ing)? (all|every)|no (get|feel) joy|mind (dey|de) heavy|hopeless|low mood|unhappy)/, /\bhuzuni\b/]],
  ['anxiety', [/\b(anxious|worried|worry|fear|scared|panic|my heart (dey|de) beat fast)\b/]],
  ['thoughts_of_self_harm', [/\b(kill (my ?self|myself)|end (my|am) life|harm (my ?self|myself)|want (to )?die|wan die|suicide|take my (own )?life|no want live again)\b/]],
  ['foul_discharge', [/\b(smell|smelling|odou?r|dey smell)\b.*\b(discharge|down|private|blood)/, /\bfoul\b/]],
  ['breast_pain_redness', [/\bbreast\b.*\b(pain|red|hard|hot|swell)/, /\b(pain|red)\b.*\bbreast\b/, /\bmastitis\b/, /\bbreast (dey|de) pain\b/]],
  ['cracked_nipples', [/\bnipple\w*\b.*\b(crack|sore|bleed|pain|tear)/, /\bcracked nipple/]],
  ['low_milk_supply', [/\b(milk|breast ?milk)\b.*\b(no (dey|de) (come|flow|plenty)|not (enough|coming|flowing)|small|dry|low|reduce)/, /\b(no|not enough|little|low) (breast ?)?milk\b/, /\bmilk no (dey|de) come\b/, /\bwara\b.*\b(babu|kadan)\b/, /\bmaziwa\b.*\b(kidogo|hayatoki)\b/]],
  ['insomnia', [/\b(can'?t|cannot|no fit|unable to) sleep\b/, /\binsomnia\b/, /\bno (dey|de) sleep\b/]],
  ['calf_pain_swelling', [/\b(calf|leg)\b.*\b(pain|swell|red|hot)\b.*\b(one|only one|one side)\b/, /\bcalf (pain|swell)/]],
  // ---- baby ----
  ['baby_not_feeding', [/\b(baby|pikin|pickin|child|newborn|mtoto|jariri|ɔba|oba)\b.*\b(no (dey|de|gree|wan)? ?(suck|feed|chop|take breast)|not (sucking|feeding|eating|taking)|refus\w* (to )?(feed|breast|suck)|can'?t suck|won'?t (feed|suck))/, /\bpikin no (dey|de) suck\b/, /\bhanyonyi\b/]],
  ['baby_fever', [/\b(baby|pikin|pickin|child|newborn|mtoto)\b.*\b(fever|hot|body (dey|de) hot|temperature)\b/, /\b(fever|hot)\b.*\b(baby|pikin|pickin|newborn)\b/]],
  ['baby_cold', [/\b(baby|pikin|pickin|newborn)\b.*\b(cold|body (dey|de) cold)\b/]],
  ['baby_convulsions', [/\b(baby|pikin|pickin|child|newborn)\b.*\b(convuls|fitting|fits\b|jerk|dey shake|seiz)/]],
  ['baby_fast_breathing', [/\b(baby|pikin|pickin|child|newborn)\b.*\b(breath\w* (fast|quick|hard|well well)|fast breath|dey breathe fast|pant)/]],
  ['baby_chest_indrawing', [/\b(chest)\b.*\b(pull(ing)? in|sink|indraw|dey go inside)\b/]],
  ['baby_yellow_skin', [/\b(yellow|jaundice)\b/]],
  ['baby_cord_redness', [/\b(cord|navel|belly button)\b.*\b(red|pus|smell|swell|bleed|wet)/]],
  ['baby_lethargic', [/\b(baby|pikin|pickin|newborn)\b.*\b(weak|floppy|no (dey|de) move|sleep(ing)? too much|lethargic|no wake|won'?t wake)/]],
  ['baby_diarrhoea', [/\b(baby|pikin|pickin|child)\b.*\b(diarrh|watery (stool|poo)|dey purge|running stomach)/, /\bdiarrh/]],
  ['baby_vomiting_everything', [/\b(baby|pikin|pickin|child)\b.*\b(vomit\w* (everything|all)|dey vomit everything)/]],
];

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining tone marks and dots
    .replace(/[ƙ]/g, 'k')
    .replace(/[ɗ]/g, 'd')
    .replace(/[ɓ]/g, 'b')
    .replace(/[ɛ]/g, 'e')
    .replace(/[ɔ]/g, 'o')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Recognise danger signs and common symptoms in a mother's message.
 * English, Nigerian Pidgin and a few Hausa, Yoruba, Igbo, Swahili and Twi terms.
 * Baby-subject phrases ("pikin no dey suck") map to baby_* codes and do not
 * also raise the maternal code.
 */
export function parseSymptomsFromText(text: string): SymptomCode[] {
  if (!text) return [];
  const t = normalise(text);
  const found = new Set<SymptomCode>();
  // Split into clauses so "baby" in one sentence doesn't leak into the next.
  const clauses = t.split(/[.!?;\n]+|\b(?:and also|also|plus)\b/).map((s) => s.trim()).filter(Boolean);
  for (const clause of clauses) {
    for (const [code, pats] of SYMPTOM_PATTERNS) if (pats.some((p) => p.test(clause))) found.add(code);
  }
  // A clause can match both mother and baby versions; prefer the baby one when the clause names the baby.
  const babyWord = /\b(baby|pikin|pickin|newborn|mtoto|jariri)\b/;
  const babyClauses = clauses.filter((c) => babyWord.test(c));
  const motherClauses = clauses.filter((c) => !babyWord.test(c));
  const onlyIn = (code: SymptomCode, cs: string[]) => cs.some((c) => SYMPTOM_PATTERNS.find(([k]) => k === code)![1].some((p) => p.test(c)));
  for (const [mum, baby] of [
    ['fever', 'baby_fever'],
    ['convulsions', 'baby_convulsions'],
    ['severe_abdominal_pain', 'reduced_fetal_movement'],
  ] as Array<[SymptomCode, SymptomCode]>) {
    if (found.has(mum) && found.has(baby) && !onlyIn(mum, motherClauses)) found.delete(mum);
  }
  if (found.has('reduced_fetal_movement') && found.has('baby_lethargic') && !babyClauses.some((c) => /\bborn|newborn\b/.test(c))) found.delete('baby_lethargic');
  // A plain mild "headache" alone is still reported as severe_headache: in pregnancy any headache the mother
  // bothers to report should trigger a BP check (WHO SMART ANC danger signs).
  // Heavy postpartum bleeding implies bleeding; keep both so either rule fires.
  if (found.has('vaginal_bleeding') && /\b(gum|nose)\b/.test(t) && !/\b(down|private|pant|pad)\b/.test(t)) found.delete('vaginal_bleeding');
  // Yellow alone (e.g. "yellow pap") is not jaundice unless a baby/eyes/skin is mentioned.
  if (found.has('baby_yellow_skin') && !/\b(baby|pikin|pickin|eye|eyes|skin|body)\b/.test(t)) found.delete('baby_yellow_skin');
  // Diarrhoea without a baby word is about the mother; we have no maternal code, so drop it.
  if (found.has('baby_diarrhoea') && !babyClauses.length) found.delete('baby_diarrhoea');
  const order = SYMPTOM_PATTERNS.map(([k]) => k);
  return [...found].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
