/**
 * Regex scrubbing of free text before it leaves the device: doctors'
 * reports, household notes, plan text. Two layers:
 *  1. Known identifiers (her name, baby's name, worker and facility names,
 *     community, IDs) supplied by the caller, replaced literally.
 *  2. Pattern rules for what we cannot know in advance: titles followed by
 *     names (Dr, Mrs, Nurse), labelled fields (Name:, Husband:, Hosp No:),
 *     Nigerian, Kenyan and Ghanaian phone formats, emails, addresses,
 *     facility-shaped names, exact ages and explicit dates.
 *
 * Regexes miss things. This is defence in depth, not a guarantee: the
 * worker sees exactly what will be sent ("What the AI sees") before any
 * cloud call, and a final leak check blocks a prompt that still contains
 * a known identifier.
 */

export type PrivacyCategory =
  | 'name'
  | 'baby name'
  | 'carer name'
  | 'health worker name'
  | 'doctor name'
  | 'other person name'
  | 'phone number'
  | 'email'
  | 'ID number'
  | 'address'
  | 'community'
  | 'facility'
  | 'region'
  | 'exact age'
  | 'date';

export type Placeholder =
  | '[MOTHER]'
  | '[BABY]'
  | '[CARER]'
  | '[WORKER]'
  | '[DOCTOR]'
  | '[PERSON]'
  | '[PHONE]'
  | '[EMAIL]'
  | '[ID]'
  | '[ADDRESS]'
  | '[COMMUNITY]'
  | '[FACILITY]'
  | '[REGION]'
  | '[DATE]'
  | '[EMERGENCY_LINE]'
  /** Another facility (a referral hospital, a neighbouring clinic): never restored as her own clinic */
  | '[OTHER_FACILITY]'
  /** Another mother's community or another place: never restored as her own community */
  | '[PLACE]';

export interface ScrubTerm {
  original: string;
  placeholder: Placeholder;
  category: PrivacyCategory;
  /** Single given names that are also English words (Joy, Patience) are matched case-sensitively */
  caseSensitive: boolean;
}

export interface ScrubOptions {
  /** ISO date; explicit dates become relative to it ("3 weeks ago"). Without it they become [DATE]. */
  asOf?: string;
}

export interface ScrubResult {
  text: string;
  removed: PrivacyCategory[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- Patterns ----------

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Nigeria +234 / 0[789][01]x, Kenya +254 / 07xx 01xx, Ghana +233 / 0[235]x, plus generic international */
export const PHONE_RES: RegExp[] = [
  /(?<![\w/])(?:\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}(?![\w/])/g,
  /(?<![\w/])(?:\+?254[\s-]?|0)(?:7\d|1[01])\d[\s-]?\d{3}[\s-]?\d{3}(?![\w/])/g,
  /(?<![\w/])(?:\+?233[\s-]?|0)[235]\d[\s-]?\d{3}[\s-]?\d{4}(?![\w/])/g,
  /(?<![\w/])\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}(?![\w/])/g,
];

const ID_LABEL_RE =
  /\b(hosp(?:ital)?\.?\s*(?:no|number|#)|MRN|reg(?:istration)?\.?\s*(?:no|number)|file\s*(?:no|number)|folder\s*(?:no|number)|card\s*(?:no|number)|NHIS\s*(?:no|number)?|NIN|patient\s*(?:id|no|number)|client\s*(?:id|no|number)|ANC\s*(?:no|number)|unit\s*(?:no|number))\.?\s*[:#.-]?\s*([A-Za-z]{0,4}[\s/-]?\d[A-Za-z0-9/-]{2,})/gi;

/** A capitalised name token (Okafor, O'Neil, Adébáyọ̀), or an initial "A." */
const NAME_TOKEN = String.raw`(?:[A-Z]\.|[A-Z][a-zà-ÿ̀-ͯḀ-ỿɛɔŋ'’-]+|[A-Z]{3,}(?![a-z]))`;
/** Up to three name tokens separated by a single space (or none after an initial: "C.Eze") */
const NAME_SEQ = String.raw`${NAME_TOKEN}(?:(?:[ \t]|(?<=\.))${NAME_TOKEN}){0,2}`;

/** Clinical abbreviations that look like upper-case names but are not */
const NOT_NAMES = new Set([
  'BP', 'PCV', 'HB', 'HGB', 'GA', 'EGA', 'LMP', 'EDD', 'ANC', 'PNC', 'PPH', 'GDM', 'UTI', 'CS', 'SVD', 'IV', 'IM', 'PO', 'BD', 'TDS',
  'OD', 'STAT', 'MGSO', 'MP', 'RDT', 'HIV', 'FBC', 'USS', 'CTG', 'FHR', 'FHT', 'PET', 'PIH', 'NAD', 'NOK', 'TCA', 'ICU', 'OPD',
  'RVS', 'VDRL', 'HBSAG', 'HCV', 'GTT', 'FBS', 'RBS', 'OGTT', 'MUAC', 'CTX', 'ART', 'TLD', 'IPT', 'SP', 'LLIN', 'ITN', 'ORS',
  'THE', 'AND', 'FOR', 'WITH', 'WAS', 'HAS', 'ADMITTED', 'DISCHARGED', 'DIAGNOSIS', 'PLAN', 'REVIEW', 'MANAGEMENT', 'SEEN',
  'HOSP', 'HOSPITAL', 'NO', 'AGE', 'SEX', 'DOB', 'DATE', 'TEL', 'PHONE', 'ADDRESS', 'BED', 'GIRL', 'BOY', 'TWIN', 'ONE', 'TWO',
  'MALE', 'FEMALE', 'ALIVE', 'HEALTHY', 'STABLE', 'NORMAL', 'NIL', 'NONE', 'GOOD', 'WELL', 'FINE',
  'OBSTETRICS', 'GYNAECOLOGY', 'DEPARTMENT', 'WARD', 'SUMMARY', 'DISCHARGE', 'REPORT', 'IMPRESSION',
]);

/**
 * The leading part of a matched name sequence that is really a name: stops
 * at clinical abbreviations or common words, so "Mrs Bello BP" keeps "BP".
 * Returns a prefix of `seq` exactly as written (so slicing stays aligned).
 */
function stripNonNames(seq: string): string {
  const re = /[A-Z][^ \t.]*\.?|\S+/g;
  let end = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seq))) {
    if (NOT_NAMES.has(m[0].replace(/[^A-Za-z]/g, '').toUpperCase())) break;
    end = m.index + m[0].length;
  }
  return seq.slice(0, end);
}

const TITLE_RULES: Array<{ titles: string; placeholder: Placeholder; category: PrivacyCategory }> = [
  { titles: String.raw`Dr|Doctor|Prof|Professor|Consultant|Registrar`, placeholder: '[DOCTOR]', category: 'doctor name' },
  { titles: String.raw`Nurse|Matron|Midwife|Sister|CHEW|CHO|CHP|RN|RM|RNM`, placeholder: '[WORKER]', category: 'health worker name' },
  { titles: String.raw`Mrs|Ms|Miss|Madam|Mme`, placeholder: '[MOTHER]', category: 'name' },
  { titles: String.raw`Baby|Infant|Master`, placeholder: '[BABY]', category: 'baby name' },
  // Honorifics used for relatives and elders ("Mama Ngozi" often means Ngozi's mother): a neutral placeholder, never restored
  { titles: String.raw`Hajia|Hajiya|Alhaja|Mama|Maame|Auntie|Aunty|Mr|Alhaji|Mallam|Malam|Chief|Pastor|Baba|Papa|Oga|Bwana|Mzee|Nana|Opanyin`, placeholder: '[PERSON]', category: 'other person name' },
];

const LABEL_RULES: Array<{ labels: string; placeholder: Placeholder; category: PrivacyCategory }> = [
  { labels: String.raw`Name|Patient(?:'s)? name|Patient|Pt|Client|Mother(?:'s)? name|Mother`, placeholder: '[MOTHER]', category: 'name' },
  { labels: String.raw`Husband|Spouse|Partner|NOK|Next of kin|Carer|Caregiver|Guardian|Escort|Accompanied by`, placeholder: '[CARER]', category: 'carer name' },
  { labels: String.raw`Baby(?:'s)? name|Baby|Infant|Child(?:'s)? name|Child|Neonate`, placeholder: '[BABY]', category: 'baby name' },
  { labels: String.raw`Seen by|Reviewed by|Signed|Sign|Attending|Consultant|Doctor|Dr in charge|Clerked by|Author`, placeholder: '[DOCTOR]', category: 'doctor name' },
  { labels: String.raw`Midwife|Nurse|CHEW|CHP|CHO|Health worker|Referred by`, placeholder: '[WORKER]', category: 'health worker name' },
];

const RELATION_RE = new RegExp(
  String.raw`\b([Hh]usband|[Ww]ife|[Pp]artner|[Mm]other-in-law|[Mm]other in law|[Ff]ather-in-law|[Ss]ister|[Bb]rother|[Mm]other|[Ff]ather|[Gg]randmother|[Gg]randma|[Aa]unt|[Uu]ncle|[Dd]aughter|[Ss]on|[Cc]o-wife|[Nn]eighbour|[Nn]eighbor|[Ff]riend)(,?\s+(?:named|called|is|-)?\s*(?:(?:Mama|Baba|Mr|Mrs|Alhaji|Hajia|Mallam|Chief|Pastor|Auntie|Aunty|Maame|Nana)\.?\s+)?)(${NAME_SEQ})`,
  'g',
);

const FACILITY_KEYWORDS = String.raw`General Hospital|Teaching Hospital|Specialist Hospital|District Hospital|County Hospital|Referral Hospital|Regional Hospital|Municipal Hospital|Mission Hospital|Federal Medical Cent(?:re|er)|Medical Cent(?:re|er)|Primary Health Care Cent(?:re|er)|Primary Health Cent(?:re|er)|Comprehensive Health Cent(?:re|er)|Health Cent(?:re|er)|Health Post|Maternity Home|Maternity Cent(?:re|er)|Maternity|Hospital|Clinic|Dispensary|CHPS Compound|CHPS`;
const FACILITY_RE = new RegExp(
  String.raw`(?:(?:\b[A-Z][\w'’.-]*|\b\d{1,3}\b|\bof|\bthe|&|\[[A-Z_]+\])[ \t]+){0,5}(?:${FACILITY_KEYWORDS})\b(?:[ \t]*,?[ \t]*(?!Ward|Department|Unit|Clinic)[A-Z][a-z]+)?`,
  'g',
);
const BARE_FACILITY_RE = new RegExp(String.raw`^(?:the\s+)?(?:${FACILITY_KEYWORDS})$`, 'i');
/** Unlabelled hospital numbers such as LUTH/2026/0451 or KNH-12345 */
const HOSP_NUMBER_RE = /\b[A-Z]{2,6}[/-]\d{2,}(?:[/-][A-Z0-9]+)*\b/g;
const FACILITY_ABBR_RE = /(?:(?:\b[A-Z][a-z'’-]+|\[[A-Z_]+\])[ \t]+){0,3}\b(?:PHC|PHCC|FMC|CHC|UCH|LUTH|UNTH|ABUTH|UBTH|OAUTHC|LASUTH|JUTH|AKTH|KNH|MTRH|KBTH|KATH|TTH)\b(?:[ \t]+[A-Z][a-z]+)?/g;

const ADDRESS_LABEL_RE = /\b(address|addr|residence|resides at|lives at|house address|home address)\s*[:\-]?\s*(?:[^\n.;]|\.(?=\S)){3,80}/gi;
const STREET_RE =
  /\b(?:No\.?\s*)?\d{1,4}[A-Za-z]?,?\s+(?:[A-Z][\w'’-]+\s+){1,4}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Close|Crescent|Lane|Way|Estate|Drive|Layout|Junction)\b/g;

const AGE_RES: RegExp[] = [
  /(?<![-\d])\b(\d{2})[\s-]?(?:year|yr)s?[\s-]?old\b/gi,
  /(?<![-\d])\b(\d{2})\s*(?:yrs|years|y\/o|yo|y\.o\.)(?![\w-]*\s*(?:ago|history))/gi,
  /(?<!gestational\s|gest\.?\s|gest\s)\b(age[d]?\s*[:\-]?\s*)(\d{2})\b(?![-\d])(?!\s*(?:\+\d|weeks?|wks?|w\b|\/40|\/52|days?|months?|mo\b))/gi,
];

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const MONTH_FULL = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const MONTH_CAP = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;
const DATE_RES: Array<{ re: RegExp; parse: (m: RegExpExecArray) => Date | null }> = [
  {
    re: /\b(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,
    parse: (m) => mk(+m[1], +m[2], +m[3]),
  },
  {
    // Day-first, as used in Nigeria, Kenya and Ghana: 12/03/2026, 12-03-26, 12.03.2026
    re: /(?<![\d/])(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?![\d/])/g,
    parse: (m) => mk(year(m[3]), +m[2], +m[1]),
  },
  {
    re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?[\s-]+(${MONTH_FULL})\.?,?[\s-]+(\d{2,4})\b`, 'gi'),
    parse: (m) => mk(year(m[3]), monthIdx(m[2]), +m[1]),
  },
  {
    re: new RegExp(String.raw`\b(${MONTH_FULL})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, 'gi'),
    parse: (m) => mk(+m[3], monthIdx(m[1]), +m[2]),
  },
  {
    // "3rd March" with no year: capitalised month only, so "2 may be" is left alone
    re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(${MONTH_CAP})\b(?!\s*\d)`, 'g'),
    parse: () => null,
  },
];

function year(y: string): number {
  const n = +y;
  return n < 100 ? 2000 + n : n;
}
function monthIdx(s: string): number {
  return MONTHS.split('|').indexOf(s.slice(0, 3).toLowerCase()) + 1;
}
function mk(y: number, mo: number, d: number): Date | null {
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

/** "3 weeks ago", "in 5 days", "today" */
export function relativeDate(date: Date, asOf: Date): string {
  const days = Math.round((date.getTime() - asOf.getTime()) / 86_400_000);
  const abs = Math.abs(days);
  if (abs === 0) return 'today';
  let s: string;
  if (abs < 14) s = `${abs} day${abs === 1 ? '' : 's'}`;
  else if (abs < 70) s = `${Math.round(abs / 7)} weeks`;
  else if (abs < 730) s = `${Math.round(abs / 30.44)} months`;
  else s = `${Math.round(abs / 365.25)} years`;
  return days < 0 ? `${s} ago` : `in ${s}`;
}

export function ageBand(age: number): string {
  const lo = Math.floor(age / 5) * 5;
  return `${lo}-${lo + 4}`;
}

function toDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- Scrubber ----------

export function termRegex(t: Pick<ScrubTerm, 'original' | 'caseSensitive'>): RegExp {
  const src = t.original
    .trim()
    .split(/\s+/)
    .map(escapeRe)
    .join(String.raw`[\s,]+`);
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${src}(?![\p{L}\p{N}])`, t.caseSensitive ? 'gu' : 'giu');
}

export function scrubText(input: string, terms: ScrubTerm[], opts: ScrubOptions = {}): ScrubResult {
  if (!input) return { text: input, removed: [] };
  const removed = new Set<PrivacyCategory>();
  let text = input;
  const sub = (re: RegExp, fn: (m: string, ...g: string[]) => string, cat: PrivacyCategory) => {
    text = text.replace(re, (...args: unknown[]) => {
      const out = fn(...(args.slice(0, -2) as [string, ...string[]]));
      if (out !== args[0]) removed.add(cat);
      return out;
    });
  };

  // 1. Contact details and identifiers
  sub(EMAIL_RE, () => '[EMAIL]', 'email');
  for (const re of PHONE_RES) sub(re, () => '[PHONE]', 'phone number');
  sub(ID_LABEL_RE, (_m, label) => `${label}: [ID]`, 'ID number');
  sub(ADDRESS_LABEL_RE, (_m, label) => `${label}: [ADDRESS]`, 'address');
  sub(STREET_RE, () => '[ADDRESS]', 'address');

  // 2. Known identifiers, longest first so "Adaeze Okafor" goes before "Adaeze"
  const sorted = [...terms].filter((t) => t.original && t.original.trim().length >= 2).sort((a, b) => b.original.length - a.original.length);
  for (const t of sorted) sub(termRegex(t), () => t.placeholder, t.category);

  // 3. Labelled fields: "Name: ...", "Husband: ...", "Seen by: ..."
  for (const r of LABEL_RULES) {
    const re = new RegExp(String.raw`\b(${r.labels})(\s*[:\-–]\s*)(?:(?:Mrs|Mr|Ms|Miss|Dr|Nurse)\.?\s+)?(${NAME_SEQ})`, 'g');
    sub(re, (m, label, sep, name) => {
      const n = stripNonNames(name);
      if (!n) return m;
      return `${label}${sep}${r.placeholder}${name.slice(n.length)}`;
    }, r.category);
  }

  // 4a. Relations followed by names: "husband Musa", "mother-in-law, Ngozi"
  sub(RELATION_RE, (m, rel, sep, name) => {
    const n = stripNonNames(name);
    if (!n) return m;
    return `${rel}${sep}[CARER]${name.slice(n.length)}`;
  }, 'carer name');

  // 4. Titles followed by names: "Dr A. Okafor", "Mrs Bello", "Nurse Wanjiru"
  for (const r of TITLE_RULES) {
    const re = new RegExp(String.raw`\b(${r.titles})(\.?[ \t]+)(${NAME_SEQ})`, 'g');
    sub(re, (m, title, sep, name) => {
      const n = stripNonNames(name);
      if (!n) return m;
      return `${title}${sep}${r.placeholder}${name.slice(n.length)}`;
    }, r.category);
  }

  // 6. Facility-shaped names
  // A bare keyword ("Clinic", "the General Hospital") is not identifying; a named one is
  // A facility found only by its shape is not known to be hers, so it must never be restored as her clinic
  // ("go to [FACILITY]" coming back as her health post instead of the referral hospital). Only a match that
  // grew out of her own facility's known name ("[FACILITY] PHC") keeps [FACILITY].
  const facilityPh = (m: string) => (/\[FACILITY\]/.test(m) ? '[FACILITY]' : '[OTHER_FACILITY]');
  sub(FACILITY_RE, (m) => (BARE_FACILITY_RE.test(m.trim()) ? m : facilityPh(m)), 'facility');
  sub(HOSP_NUMBER_RE, () => '[ID]', 'ID number');
  sub(FACILITY_ABBR_RE, (m) => facilityPh(m), 'facility');
  text = text.replace(/\[FACILITY\](?:[ \t]*\[FACILITY\])+/g, '[FACILITY]');
  text = text.replace(/\[OTHER_FACILITY\](?:[ \t]*\[OTHER_FACILITY\])+/g, '[OTHER_FACILITY]');

  // 7. Exact ages -> five-year bands (keep the adolescent flag)
  const band = (n: number) => `${ageBand(n)} years${n < 18 ? ' (adolescent, under 18)' : ''}`;
  sub(AGE_RES[0], (m, a) => (+a >= 10 && +a <= 60 ? `aged ${band(+a)}` : m), 'exact age');
  sub(AGE_RES[1], (m, a) => (+a >= 10 && +a <= 60 ? band(+a) : m), 'exact age');
  sub(AGE_RES[2], (m, label, a) => (+a >= 10 && +a <= 60 ? `${label}${band(+a)}` : m), 'exact age');

  // 8. Explicit dates -> relative terms
  const asOf = toDate(opts.asOf);
  for (const { re, parse } of DATE_RES) {
    sub(re, (...g) => {
      const m = g as unknown as RegExpExecArray;
      const d = parse(m);
      return d && asOf ? `[DATE] (${relativeDate(d, asOf)})` : '[DATE]';
    }, 'date');
  }

  return { text, removed: [...removed] };
}

/**
 * Facility names written in this text (named hospitals and clinics, not bare words such as
 * "the clinic"), minus the ones to ignore. Used to restore a referral hospital locally when the
 * source named exactly one, so [OTHER_FACILITY] never turns into her own health post.
 */
export function facilityNamesIn(text: string, ignore: string[] = []): string[] {
  const skip = ignore.filter(Boolean).map((x) => x.trim().toLowerCase());
  const out: string[] = [];
  for (const re of [FACILITY_RE, FACILITY_ABBR_RE]) {
    for (const m of (text ?? '').matchAll(new RegExp(re.source, re.flags))) {
      const name = m[0].trim().replace(/^(?:the|of|at|to)\s+/i, '');
      if (!name || BARE_FACILITY_RE.test(name) || /\[[A-Z_]+\]/.test(name)) continue;
      const low = name.toLowerCase();
      if (skip.some((x) => x.includes(low) || low.includes(x))) continue;
      if (!out.some((o) => o.toLowerCase().includes(low) || low.includes(o.toLowerCase()))) out.push(name);
    }
  }
  return out;
}

/**
 * Final gate: does this text still contain a known identifier, a phone
 * number, an email or an explicit date? Returns the categories found.
 */
export function findLeaks(text: string, terms: ScrubTerm[]): PrivacyCategory[] {
  const found = new Set<PrivacyCategory>();
  for (const t of terms) {
    if (!t.original || t.original.trim().length < 2) continue;
    if (termRegex(t).test(text)) found.add(t.category);
  }
  if (new RegExp(EMAIL_RE.source).test(text)) found.add('email');
  for (const re of PHONE_RES) if (new RegExp(re.source).test(text)) found.add('phone number');
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(text) || new RegExp(DATE_RES[1].re.source).test(text)) found.add('date');
  return [...found];
}
