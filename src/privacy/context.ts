/**
 * Builds the de-identified view of a mother and her plan that AI prompts are
 * written from. Prompts never see the Mother record itself: only this
 * SafeContext, whose free-text fields have been scrubbed.
 *
 * Honest limits. Pseudonymised data (an age band, a stage, a zone, the plan)
 * can still be personal data under Nigeria's NDPA 2023, Kenya's Data
 * Protection Act 2019 and Ghana's Data Protection Act 2012 when it could be
 * re-identified, for example by someone who also knows the facility's
 * register. So consent for AI processing and a processor agreement with any
 * cloud AI provider are still required. Only the no-AI (templates) and
 * on-device modes avoid a transfer altogether.
 */
import type { CarePlan, CountryCode, Facility, LanguageCode, Mother, Worker } from '../types';
import { ageBand, relativeDate, scrubText, type PrivacyCategory, type ScrubTerm } from './scrub';
import { COUNTRY_NAMES, zoneFor } from './zones';

// ---------- Directory (worker and facility names to remove) ----------

export interface PrivacyDirectory {
  /** Every mother on the device: her names, children, community and phone are scrubbed from ALL text, even text not tied to her */
  mothers?: Mother[];
  workers?: Pick<Worker, 'id' | 'name'>[];
  facilities?: Pick<Facility, 'id' | 'name' | 'region'>[];
  /** Any other names to always remove, e.g. local doctors */
  extraNames?: Array<{ name: string; placeholder?: ScrubTerm['placeholder'] }>;
}

let directory: PrivacyDirectory = {};

/** Register worker and facility names so they are always scrubbed. The store calls this once with the seed data. */
export function setPrivacyDirectory(dir: PrivacyDirectory): void {
  directory = { ...directory, ...dir };
  dirTermsCache = null;
}

const remembered = new Map<string, Mother>();
/** The AI layer calls this for every mother it handles, so later calls without a mother (translate, extract) still scrub her name */
export function rememberMother(m: Mother | undefined): void {
  if (!m?.id) return;
  if (remembered.get(m.id) === m) return;
  remembered.set(m.id, m);
  dirTermsCache = null;
}

let dirTermsCache: ScrubTerm[] | null = null;
export function getPrivacyDirectory(): PrivacyDirectory {
  return directory;
}

// ---------- Terms ----------

/** Given names that are also ordinary English words: matched case-sensitively */
const WORD_NAMES = new Set(
  'joy patience blessing mercy grace faith hope peace gift comfort precious favour favor charity love goodness sunday monday friday victory success wisdom rose may june april lucky happiness promise glory praise marvel beauty purity prudence chastity esther'.split(
    ' ',
  ),
);

/** Ordinary words that must never become scrub terms, even if part of a name */
const NEVER_TERMS = new Set(['mama', 'baby', 'the', 'and', 'of', 'mrs', 'mr', 'dr', 'miss']);

function nameTerms(full: string | undefined, placeholder: ScrubTerm['placeholder'], category: PrivacyCategory): ScrubTerm[] {
  if (!full || !full.trim()) return [];
  const out: ScrubTerm[] = [{ original: full.trim(), placeholder, category, caseSensitive: false }];
  const parts = full.trim().split(/\s+/);
  if (parts.length > 1) {
    for (const p of parts) {
      const clean = p.replace(/[^\p{L}'’-]/gu, '');
      // Skip titles, roles and generic place words ("Dr", "Registrar", "Hospital") that come with a
      // signature such as "Dr A. Name, Registrar (O&G), Lagos Island Maternity Hospital".
      if (clean.length < 2 || NEVER_TERMS.has(clean.toLowerCase()) || GENERIC_PLACE_WORDS.has(clean.toLowerCase()) || NAME_NOISE.has(clean.toLowerCase())) continue;
      out.push({ original: clean, placeholder, category, caseSensitive: WORD_NAMES.has(clean.toLowerCase()) });
    }
  } else if (WORD_NAMES.has(full.trim().toLowerCase())) {
    out[0].caseSensitive = true;
  }
  return out;
}

/** Titles and roles that appear in signatures and identify nobody on their own */
const NAME_NOISE = new Set('dr doctor prof professor consultant registrar resident nurse midwife matron sister officer chew jchew cho chp paediatrics paediatrician obstetrics gynaecology o&g og scbu nicu unit department dept ward mrs mr miss ms'.split(' '));

/** Generic words in place and facility names that identify nothing on their own */
const GENERIC_PLACE_WORDS = new Set(
  'ward village street road market north south east west central new old area zone estate layout town city primary health centre center hospital general teaching clinic dispensary compound chps comprehensive maternity medical federal state county region level post care specialist district referral mission community phase extension quarters junction upper lower sub the of and'.split(
    ' ',
  ),
);

/** The full place name plus each distinctive word ("Nsukka" from "Nsukka Ward 4"), matched case-sensitively */
function placeTerms(original: string | undefined, placeholder: ScrubTerm['placeholder'], category: PrivacyCategory): ScrubTerm[] {
  if (!original || original.trim().length < 2) return [];
  const out: ScrubTerm[] = [{ original: original.trim(), placeholder, category, caseSensitive: false }];
  for (const w of original.trim().split(/[\s,/-]+/)) {
    const clean = w.replace(/[^\p{L}'’]/gu, '');
    if (clean.length >= 4 && !GENERIC_PLACE_WORDS.has(clean.toLowerCase()) && /^\p{Lu}/u.test(clean)) {
      out.push({ original: clean, placeholder, category, caseSensitive: true });
    }
  }
  return out;
}

function plain(original: string | undefined, placeholder: ScrubTerm['placeholder'], category: PrivacyCategory): ScrubTerm[] {
  if (!original || original.trim().length < 2) return [];
  return [{ original: original.trim(), placeholder, category, caseSensitive: false }];
}

export interface TermOptions {
  workerName?: string;
  facilityName?: string;
  extraNames?: string[];
}

/** Everything we know identifies this mother, to be removed from any text sent out */
function motherTerms(mother: Mother): ScrubTerm[] {
  const terms: ScrubTerm[] = [];
  {
    terms.push(...nameTerms(mother.name, '[MOTHER]', 'name'));
    terms.push(...plain(mother.id, '[ID]', 'ID number'));
    terms.push(...plain(mother.phone?.number, '[PHONE]', 'phone number'));
    if (mother.phone?.number) {
      const digits = mother.phone.number.replace(/\D/g, '');
      if (digits.length >= 7) terms.push(...plain(digits, '[PHONE]', 'phone number'));
    }
    terms.push(...plain(mother.email, '[EMAIL]', 'email'));
    terms.push(...placeTerms(mother.community, '[COMMUNITY]', 'community'));
    // Region names can be ordinary words (Ghana's "Central", "Western"): matched case-sensitively
    if (mother.region && mother.region.trim().length >= 3) terms.push({ original: mother.region.trim(), placeholder: '[REGION]', category: 'region', caseSensitive: true });
    terms.push(...plain(mother.facilityId, '[ID]', 'ID number'));
    terms.push(...plain(mother.assignedWorkerId, '[ID]', 'ID number'));
    terms.push(...plain(mother.consent?.recordedBy, '[ID]', 'ID number'));
    for (const c of mother.children ?? []) {
      terms.push(...nameTerms(c.name, '[BABY]', 'baby name'));
      terms.push(...plain(c.id, '[ID]', 'ID number'));
    }
    for (const med of mother.medications ?? []) terms.push(...nameTerms(med.prescribedBy, '[DOCTOR]', 'doctor name'));
    for (const e of mother.events ?? []) {
      if (e.kind === 'birth') {
        terms.push(...nameTerms(e.child?.name, '[BABY]', 'baby name'));
        terms.push(...plain(e.child?.id, '[ID]', 'ID number'));
      }
      if (e.kind === 'report') terms.push(...nameTerms(e.author, '[DOCTOR]', 'doctor name'));
      if (e.kind === 'medication') terms.push(...nameTerms(e.medication?.prescribedBy, '[DOCTOR]', 'doctor name'));
      if (e.kind === 'referral') terms.push(...plain(e.toFacilityId, '[ID]', 'ID number'));
      if (e.kind === 'visit') terms.push(...plain(e.facilityId, '[ID]', 'ID number'));
    }
  }
  return terms;
}

/** Terms from the whole directory: all known mothers, workers and facilities (cached) */
function directoryTerms(): ScrubTerm[] {
  if (dirTermsCache) return dirTermsCache;
  const dir = directory;
  const terms: ScrubTerm[] = [];
  const mothers = new Map<string, Mother>();
  for (const m of dir.mothers ?? []) mothers.set(m.id, m);
  for (const [id, m] of remembered) if (!mothers.has(id)) mothers.set(id, m);
  for (const m of mothers.values()) terms.push(...motherTerms(m));
  for (const w of dir.workers ?? []) {
    terms.push(...nameTerms(w.name, '[WORKER]', 'health worker name'));
    terms.push(...plain(w.id, '[ID]', 'ID number'));
  }
  for (const f of dir.facilities ?? []) {
    terms.push(...placeTerms(f.name, '[FACILITY]', 'facility'));
    terms.push(...plain(f.id, '[ID]', 'ID number'));
  }
  for (const x of dir.extraNames ?? []) terms.push(...nameTerms(x.name, x.placeholder ?? '[PERSON]', 'other person name'));
  dirTermsCache = terms;
  return terms;
}

/** Everything we know identifies this mother (and everyone else on the device), to be removed from any text sent out */
export function collectTerms(mother: Mother | undefined, opts: TermOptions = {}): ScrubTerm[] {
  const terms: ScrubTerm[] = [];
  const dir = directory;
  if (mother) {
    terms.push(...motherTerms(mother));
    const worker = dir.workers?.find((w) => w.id === mother.assignedWorkerId);
    terms.push(...nameTerms(worker?.name, '[WORKER]', 'health worker name'));
    const fac = dir.facilities?.find((f) => f.id === mother.facilityId);
    terms.push(...placeTerms(fac?.name, '[FACILITY]', 'facility'));
  }
  terms.push(...nameTerms(opts.workerName, '[WORKER]', 'health worker name'));
  terms.push(...placeTerms(opts.facilityName, '[FACILITY]', 'facility'));
  for (const n of opts.extraNames ?? []) terms.push(...nameTerms(n, '[PERSON]', 'other person name'));
  // Directory-wide: every mother, worker and facility known on this device
  terms.push(...directoryTerms());
  // De-duplicate (first wins, so this mother's own placeholders take precedence)
  const seen = new Set<string>();
  return terms.filter((t) => {
    const k = `${t.original.toLowerCase()}|${t.placeholder}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- Safe context ----------

export interface SafeItem {
  /** Short alias (i1, i2...) used in prompts; real ids never leave the device */
  key: string;
  category: string;
  title: string;
  motherText: string;
  detail: string;
  because: string[];
  timing?: string;
  due?: string;
  priority: number;
  locked: boolean;
  origin: string;
}

export interface SafeAlert {
  level: 'emergency' | 'urgent' | 'warning';
  title: string;
  action: string;
  reason: string;
  subject: 'mother' | 'child';
}

export interface SafeContext {
  mother: {
    ref: '[MOTHER]';
    ageBand: string;
    adolescent: boolean;
    country: string;
    countryCode: CountryCode;
    zone?: string;
    language: LanguageCode;
    literacy: string;
    gravida: number;
    parity: number;
    history: string[];
    conditions: string[];
  };
  stage: string;
  stageCode: string;
  baby?: { ref: '[BABY]'; age: string; sex?: string; feeding?: string };
  summary: string;
  risks: Array<{ label: string; severity: string; reason: string }>;
  alerts: SafeAlert[];
  items: SafeItem[];
  nextContact?: { when: string; label: string };
  /** Alias -> real item id, kept on the device */
  keyToId: Record<string, string>;
  /** Categories of data in this context, for the audit log and preview */
  categories: string[];
  /** Categories of identifiers removed while scrubbing free text */
  removed: PrivacyCategory[];
}

export interface SafeContextOptions {
  itemIds?: string[];
  workerName?: string;
  facilityName?: string;
  /** Include worker-only detail and because fields (explain, suggest) */
  includeDetail?: boolean;
}

function humanise(code: string): string {
  return code.replace(/_/g, ' ');
}

function ageText(days: number): string {
  if (days < 14) return `${days} days old`;
  if (days < 91) return `${Math.round(days / 7)} weeks old`;
  return `${Math.round(days / 30.44)} months old`;
}

export function stageText(plan: CarePlan): string {
  const s = plan.state;
  switch (s.stage) {
    case 'pregnancy':
      return s.gestationalWeeks != null ? `pregnant, ${s.gestationalWeeks} weeks${s.trimester ? ` (trimester ${s.trimester})` : ''}` : 'pregnant';
    case 'postpartum':
      return s.daysPostpartum != null ? `${s.daysPostpartum} days after giving birth` : 'recently gave birth';
    case 'infant':
      return s.infantAgeDays != null ? `mother of a baby ${ageText(s.infantAgeDays)}` : 'mother of a young baby';
    default:
      return 'planning a pregnancy';
  }
}

export function asOfFor(plan: CarePlan | undefined): string | undefined {
  return plan?.state?.asOf || plan?.generatedAt;
}

export function buildSafeContext(plan: CarePlan, mother: Mother, opts: SafeContextOptions = {}): SafeContext {
  const terms = collectTerms(mother, { workerName: opts.workerName, facilityName: opts.facilityName });
  const asOf = asOfFor(plan);
  const removed = new Set<PrivacyCategory>();
  const s = (t: string | undefined): string => {
    if (!t) return '';
    const r = scrubText(t, terms, { asOf });
    r.removed.forEach((c) => removed.add(c));
    return r.text;
  };
  const asOfDate = asOf ? new Date(asOf) : null;
  const rel = (iso: string | undefined) => {
    if (!iso || !asOfDate) return undefined;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : relativeDate(d, asOfDate);
  };

  const active = plan.items.filter((i) => i.status === 'active');
  let chosen = active;
  if (opts.itemIds && opts.itemIds.length) {
    const want = new Set(opts.itemIds);
    chosen = active.filter((i) => want.has(i.id));
  }
  chosen = [...chosen].sort((a, b) => a.priority - b.priority);
  const keyToId: Record<string, string> = {};
  const items: SafeItem[] = chosen.map((i, n) => {
    const key = `i${n + 1}`;
    keyToId[key] = i.id;
    return {
      key,
      category: i.category,
      title: s(i.title),
      motherText: s(i.motherText),
      detail: opts.includeDetail ? s(i.detail) : '',
      because: opts.includeDetail ? i.because.map(s) : [],
      timing: i.timing ? s(i.timing) : undefined,
      due: rel(i.dueDate),
      priority: i.priority,
      locked: Boolean(i.locked),
      origin: i.origin,
    };
  });

  const st = plan.state;
  const history: string[] = [];
  if (mother.previousCaesarean) history.push('previous caesarean');
  if (mother.previousStillbirth) history.push('previous stillbirth');
  if (mother.previousPPH) history.push('previous postpartum haemorrhage');
  const infant = st.infant ?? mother.children?.[mother.children.length - 1];

  const ctx: SafeContext = {
    mother: {
      ref: '[MOTHER]',
      ageBand: ageBand(mother.age),
      adolescent: mother.age < 18,
      country: COUNTRY_NAMES[mother.country] ?? mother.country,
      countryCode: mother.country,
      zone: zoneFor(mother.country, mother.region),
      language: mother.language,
      literacy: mother.literacy,
      gravida: mother.gravida,
      parity: mother.parity,
      history,
      conditions: (mother.conditions ?? []).map(humanise),
    },
    stage: stageText(plan),
    stageCode: st.stage,
    baby:
      (st.stage === 'postpartum' || st.stage === 'infant') && st.infantAgeDays != null
        ? { ref: '[BABY]', age: ageText(st.infantAgeDays), sex: infant?.sex === 'F' ? 'girl' : infant?.sex === 'M' ? 'boy' : undefined, feeding: infant ? humanise(infant.feeding) : undefined }
        : undefined,
    summary: s(plan.summary),
    risks: (st.risks ?? []).map((r) => ({ label: s(r.label), severity: r.severity, reason: s(r.reason) })),
    alerts: plan.alerts.map((a) => ({ level: a.level, title: s(a.title), action: s(a.action), reason: s(a.reason), subject: a.subject })),
    items,
    nextContact: plan.nextContact ? { when: rel(plan.nextContact.date) ?? 'soon', label: s(plan.nextContact.label) } : undefined,
    keyToId,
    categories: [],
    removed: [],
  };
  ctx.categories = [
    'age band',
    'journey stage (relative weeks or days)',
    'country and zone',
    'language and literacy',
    'plan item text',
    ...(ctx.alerts.length ? ['alerts'] : []),
    ...(opts.includeDetail ? ['plan reasons and risks', 'conditions and obstetric history'] : []),
  ];
  ctx.removed = [...removed];
  return ctx;
}
