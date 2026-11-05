/**
 * Deterministic extraction of findings from doctors' free text (discharge
 * summaries, referral notes, clinic letters). Works offline. Every finding
 * is shown to a worker to confirm before it is saved.
 */
import type { ExtractedFinding } from '../types';
import { findMedicines } from './lexicon';

type Conf = ExtractedFinding['confidence'];

function push(out: ExtractedFinding[], field: string, value: string, confidence: Conf) {
  const v = value.trim();
  if (!v) return;
  if (out.some((f) => f.field === field && f.value.toLowerCase() === v.toLowerCase())) return;
  out.push({ field, value: v, confidence });
}

function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    out.push(m);
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

// ---------- Vitals and labs ----------

const BP_RE = /\b(?:B\s*\/?\s*P|blood\s+pressure)\b[^0-9\n]{0,25}?(\d{2,3})\s*\/\s*(\d{2,3})(?!\s*\/)/gi;
/** A bare reading with a unit: 150/100mmHg */
const BP_UNIT_RE = /(?<![\d/])(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s*hg/gi;

function extractBP(text: string, out: ExtractedFinding[]) {
  const ms = [...allMatches(BP_RE, text), ...allMatches(BP_UNIT_RE, text)]
    .map((m) => ({ s: +m[1], d: +m[2], i: m.index }))
    .filter((r) => r.s >= 60 && r.s <= 260 && r.d >= 30 && r.d <= 180 && r.s > r.d);
  if (!ms.length) return;
  // De-duplicate overlapping matches and take the latest reading in the text
  ms.sort((a, b) => a.i - b.i);
  const distinct = ms.filter((r, k) => k === 0 || !(r.s === ms[k - 1].s && r.d === ms[k - 1].d && Math.abs(r.i - ms[k - 1].i) < 40));
  const last = distinct[distinct.length - 1];
  const conf: Conf = distinct.length > 1 ? 'medium' : 'high';
  push(out, 'systolic', String(last.s), conf);
  push(out, 'diastolic', String(last.d), conf);
}

const HB_RE = /\b(?:hb|hgb|ha?emoglobin)\b\s*(?:level|conc(?:entration)?)?\s*(?:of|was|is|=|:|-)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(g\s*\/\s*dl|g\s*\/\s*l|g%|gm%|gm\s*\/\s*dl)?/gi;
const PCV_RE = /\b(?:pcv|packed\s+cell\s+volume|ha?ematocrit|hct)\b\s*(?:of|was|is|=|:|-)?\s*(\d{1,2}(?:\.\d)?)\s*(%|percent)?/gi;

function extractHaemoglobin(text: string, out: ExtractedFinding[]) {
  const hbs = allMatches(HB_RE, text)
    .map((m) => {
      let v = parseFloat(m[1]);
      const unit = (m[2] || '').replace(/\s/g, '').toLowerCase();
      if (unit === 'g/l' || (!unit && v > 25 && v <= 200)) v = v / 10;
      return { v, i: m.index, unit };
    })
    .filter((r) => r.v >= 2 && r.v <= 20);
  if (hbs.length) {
    const last = hbs[hbs.length - 1];
    push(out, 'haemoglobin', round1(last.v), hbs.length > 1 ? 'medium' : 'high');
    return;
  }
  const pcvs = allMatches(PCV_RE, text)
    .map((m) => ({ v: parseFloat(m[1]), i: m.index }))
    .filter((r) => r.v >= 8 && r.v <= 60);
  if (pcvs.length) {
    const last = pcvs[pcvs.length - 1];
    push(out, 'haemoglobin', `${round1(last.v / 3)} (estimated from PCV ${last.v}%: Hb ≈ PCV ÷ 3)`, 'medium');
  }
}

const TEMP_RE = /\b(?:temp(?:erature)?|T|pyrexia(?:\s+of)?|febrile(?:\s+at)?)\b\.?\s*(?:of|was|=|:|-)?\s*(\d{2}(?:\.\d)?)\s*(?:°\s*C|ºC|oC|deg(?:rees)?\s*C?|C\b)?/gi;

function extractTemperature(text: string, out: ExtractedFinding[]) {
  const ts = allMatches(TEMP_RE, text)
    .map((m) => parseFloat(m[1]))
    .filter((v) => v >= 34 && v <= 43);
  if (ts.length) push(out, 'temperature', round1(ts[ts.length - 1]), ts.length > 1 ? 'medium' : 'high');
}

const WEIGHT_RE = /(?<!birth\s|baby'?s?\s|infant'?s?\s|b\.)\b(?:weight|wt)\b\.?\s*(?:of|was|is|=|:|-)?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(kg|kgs|kilograms?)\b/gi;

function extractWeight(text: string, out: ExtractedFinding[]) {
  const ws = allMatches(WEIGHT_RE, text)
    .map((m) => parseFloat(m[1]))
    .filter((v) => v >= 30 && v <= 200);
  if (ws.length) push(out, 'weight', String(ws[ws.length - 1]), ws.length > 1 ? 'medium' : 'high');
}

const GA_RES: RegExp[] = [
  /\b(?:GA|EGA|gestational\s+age|gestation|POG)\b\s*(?:of|was|is|=|:|-|at)?\s*(\d{1,2})(?:\s*\+\s*\d)?\s*(?:\/40|\/52|weeks?|wks?|w\b)?/gi,
  /(?<![\d/])(\d{1,2})(?:\s*\+\s*\d)?\s*\/\s*40\b/g,
  /\b(\d{1,2})(?:\s*\+\s*\d)?\s*(?:weeks?|wks?)\s*(?:gestation|of\s+gestation|pregnant|GA|of\s+pregnancy)\b/gi,
];

function extractGA(text: string, out: ExtractedFinding[]) {
  const found: Array<{ v: number; i: number }> = [];
  for (const re of GA_RES) for (const m of allMatches(re, text)) found.push({ v: +m[1], i: m.index });
  const ok = found.filter((r) => r.v >= 4 && r.v <= 44).sort((a, b) => a.i - b.i);
  if (!ok.length) return;
  const values = new Set(ok.map((r) => r.v));
  push(out, 'gestational_weeks', String(ok[ok.length - 1].v), values.size > 1 ? 'medium' : 'high');
}

const PROTEIN_RES: RegExp[] = [
  /\b(?:urine|urinalysis|u\/a|dipstick)\b[^\n]{0,30}?\b(?:protein|albumin|prot)\b\s*(?:[:=-]\s*)?(\+{1,4}|trace|nil|negative|neg|-ve|1\+|2\+|3\+|4\+)/gi,
  /\b(?:proteinuria|albuminuria)\b\s*(?:[:=-]\s*)?\(?\s*(\+{1,4}|trace|1\+|2\+|3\+|4\+)/gi,
  /\b(?:protein|albumin)\b\s*(?:in\s+urine)?\s*(?:[:=-]\s*)?(\+{1,4}|1\+|2\+|3\+|4\+)/gi,
  /(\+{1,4}|1\+|2\+|3\+|4\+)\s*(?:of\s+)?(?:proteinuria|albuminuria|protein\s+in\s+(?:the\s+)?urine)/gi,
];

function normProtein(s: string): string {
  const t = s.toLowerCase();
  if (/^\d\+$/.test(t)) return '+'.repeat(+t[0]);
  if (t === 'neg' || t === '-ve' || t === 'negative') return 'nil';
  return t;
}

function extractUrineProtein(text: string, out: ExtractedFinding[]) {
  const found: Array<{ v: string; i: number }> = [];
  for (const re of PROTEIN_RES) for (const m of allMatches(re, text)) found.push({ v: normProtein(m[1]), i: m.index });
  if (!found.length) return;
  found.sort((a, b) => a.i - b.i);
  push(out, 'urine_protein', found[found.length - 1].v, 'high');
}

// ---------- Diagnoses ----------

const DIAGNOSES: Array<{ label: string; re: RegExp }> = [
  { label: 'eclampsia', re: /(?<!pre[-\s]?)\beclampsia\b/gi },
  { label: 'HELLP syndrome', re: /\bHELLP\b/g },
  { label: 'pre-eclampsia', re: /\b(?:pre[-\s]?eclampsia|preeclamptic|pre[-\s]?eclamptic|PET\b|PE\b(?=\s+(?:with|without|w\/))|toxa?emia\s+of\s+pregnancy)/gi },
  { label: 'gestational hypertension', re: /\b(?:gestational\s+hypertension|pregnancy[-\s]induced\s+hypertension|PIH\b)/gi },
  { label: 'chronic hypertension', re: /\b(?:chronic|pre-?existing|essential)\s+hypertension\b/gi },
  { label: 'anaemia', re: /\b(?:an(?:a)?emi[ac]|an(?:a)?emia\s+in\s+pregnancy)\b/gi },
  { label: 'malaria', re: /\b(?:malaria|malaria\s+in\s+pregnancy|MIP\b|plasmodium)/gi },
  { label: 'gestational diabetes', re: /\b(?:gestational\s+diabetes(?:\s+mellitus)?|GDM\b)/gi },
  { label: 'diabetes', re: /\b(?:type\s*[12]\s+diabetes|pre-?gestational\s+diabetes|diabetes\s+mellitus|DM\b)(?!\s*\(gestational)/gi },
  { label: 'urinary tract infection', re: /\b(?:urinary\s+tract\s+infection|UTI\b|cystitis|pyelonephritis)/gi },
  { label: 'postpartum haemorrhage', re: /\b(?:post[-\s]?partum\s+ha?emorrhage|PPH\b|primary\s+PPH|secondary\s+PPH)/gi },
  { label: 'antepartum haemorrhage', re: /\b(?:ante[-\s]?partum\s+ha?emorrhage|APH\b|placenta\s+pr(?:a|e)evia|abruptio\s+placentae?|placental\s+abruption)/gi },
  { label: 'puerperal sepsis', re: /\b(?:puerperal\s+sepsis|maternal\s+sepsis|endometritis)/gi },
  { label: 'sickle cell disease', re: /\b(?:sickle\s+cell\s+(?:disease|anaemia|anemia)|SCD\b|HbSS)\b/gi },
];

const NEG_BEFORE = /(?:\bno\b|\bnot\b|\bnegative\s+for\b|\bruled\s+out\b|\br\/o\b|\bexclud(?:e|ed)\b|\bwithout\b|\bfree\s+of\b|\bdenies\b)[^.;\n]{0,20}$/i;
const NEG_AFTER = /^[^.;\n]{0,25}?(?:\bnegative\b|-ve\b|\bneg\b|\bruled\s+out\b|\bexcluded\b|\bnot\s+(?:seen|detected|found)\b|\bnil\b)/i;
const HISTORY_BEFORE = /(?:\bhistory\s+of\b|\bh\/o\b|\bprevious\b|\bprior\b|\bpast\b|\bfamily\s+history\b|\bin\s+(?:her\s+)?last\s+pregnancy\b|\brisk\s+of\b|\bprophylaxis\b|\bto\s+prevent\b|\bprevention\s+of\b)[^.;\n]{0,25}$/i;

function extractDiagnoses(text: string, out: ExtractedFinding[]) {
  for (const d of DIAGNOSES) {
    for (const m of allMatches(d.re, text)) {
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) continue;
      if (HISTORY_BEFORE.test(before)) continue;
      // Severity qualifiers directly before
      const qual = before.match(/\b(severe|mild|moderate|superimposed|imminent)\s*$/i)?.[1]?.toLowerCase();
      const label = qual ? `${qual} ${d.label}` : d.label;
      const uncertain = /\?\s*$|\b(?:query|suspected|possible|probable|likely)\s*$/i.test(before) || /^\s*\?/.test(after);
      push(out, 'diagnosis', label, uncertain ? 'low' : 'high');
      break;
    }
  }
  // Keep only the most specific: drop "pre-eclampsia" when "severe pre-eclampsia" was found
  for (let i = out.length - 1; i >= 0; i--) {
    const f = out[i];
    if (f.field !== 'diagnosis') continue;
    if (out.some((g) => g !== f && g.field === 'diagnosis' && g.value.endsWith(` ${f.value}`))) out.splice(i, 1);
  }
}

// ---------- Medicines ----------

const DOSE_UNIT = String.raw`(?:mg|mcg|µg|ug|g|gm|ml|mL|iu|IU|units?|u\b|tabs?|tablets?|caps?|capsules?|amps?|vials?)`;
const DOSE_RE = new RegExp(String.raw`\d+(?:\.\d+)?\s*${DOSE_UNIT}`, 'i');
const FREQ_RE =
  /\b(?:od|bd|bid|tds|tid|qds|qid|nocte|mane|stat|prn|daily|once|twice|three\s+times|four\s+times|\d+\s*(?:hourly|hrly)|\d+\s*h\b|weekly|monthly|x\s*\d+\s*\/\s*\d+|for\s+\d+\s*(?:days?|weeks?|months?|\/7|\/52|\/12)|iv|im|po|sc|orally|by\s+mouth|loading|maintenance)\b/i;

function extractMedicines(text: string, out: ExtractedFinding[]) {
  const mentions = findMedicines(text);
  const seen = new Set<string>();
  for (let k = 0; k < mentions.length; k++) {
    const m = mentions[k];
    const start = m.index + m.matched.length;
    const next = mentions[k + 1]?.index ?? text.length;
    // The dose phrase runs to the next medicine, a semicolon, a newline, or a sentence end
    let tail = text.slice(start, Math.min(next, start + 90));
    const stop = tail.search(/[;\n]|\.(?!\d)|,\s*(?=[A-Za-z]{4,}\s)|\band\s+(?=[a-z]+\s+\d)/);
    if (stop >= 0) tail = tail.slice(0, stop);
    tail = tail.replace(/^[\s:,(-]+/, '').replace(/[\s,)]+$/, '');
    const hasDose = DOSE_RE.test(tail) || FREQ_RE.test(tail);
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const stopped = /\b(?:stop(?:ped)?|discontinu(?:e|ed)|withh(?:o|e)ld|withheld|off)\b[^.;\n]*$/i.test(before);
    const key = `${m.generic}|${hasDose ? tail.toLowerCase() : ''}`;
    if (seen.has(key)) continue;
    // Skip a bare mention when the same medicine already has a dosed entry
    if (!hasDose && [...seen].some((s) => s.startsWith(`${m.generic}|`))) continue;
    seen.add(key);
    const name = m.matched.toLowerCase() === m.generic.toLowerCase() || m.matched.length <= 4 ? m.generic : `${m.generic} (${m.matched})`;
    const value = `${name}${hasDose ? ` ${tail}` : ''}${stopped ? ' (stopped)' : ''}`;
    push(out, 'medication', value.replace(/\s+/g, ' '), hasDose ? 'high' : 'medium');
  }
  // Drop bare entries that a dosed entry for the same medicine supersedes
  for (let i = out.length - 1; i >= 0; i--) {
    const f = out[i];
    if (f.field !== 'medication' || f.confidence !== 'medium') continue;
    const gen = f.value.split(' (')[0];
    if (out.some((g) => g !== f && g.field === 'medication' && g.value.startsWith(gen) && g.confidence === 'high')) out.splice(i, 1);
  }
}

// ---------- Plan and follow-up ----------

const PLAN_RE = /\b(?:plan|management|treatment\s+plan|impression\s+and\s+plan|recommendations?)\s*[:\-–]\s*([^\n]{6,220})/gi;

function relSpan(n: string, unit: string): string {
  const count = +n;
  const u = unit === '7' ? 'day' : unit === '52' ? 'week' : unit === '12' ? 'month' : unit;
  return `${count} ${u}${count === 1 ? '' : 's'}`;
}

const FOLLOW_RES: Array<{ re: RegExp; fmt: (m: RegExpExecArray) => string }> = [
  {
    re: /\b(?:TCA|to\s+come\s+again|RV|review|r\/v|follow[-\s]?up|f\/u|see|seen|return|come\s+back|revisit|next\s+(?:visit|appointment|ANC))\b[^\n.;]{0,40}?\bin\s+(\d{1,2})\s*\/\s*(7|52|12)\b/gi,
    fmt: (m) => `in ${relSpan(m[1], m[2])}`,
  },
  {
    re: /\b(?:TCA|RV|r\/v)\s*(?:in\s*)?(\d{1,2})\s*\/\s*(7|52|12)\b/gi,
    fmt: (m) => `in ${relSpan(m[1], m[2])}`,
  },
  {
    re: /\b(?:review|follow[-\s]?up|f\/u|see|return|come\s+back|revisit|next\s+(?:visit|appointment|ANC)|reassess|repeat\s+[A-Za-z]+)\b([^\n.;]{0,40}?)\bin\s+(one|two|three|four|six|\d{1,2})\s*(days?|weeks?|wks?|months?)\b/gi,
    fmt: (m) => `${m[1].trim() ? `${m[1].trim()} ` : ''}in ${m[2]} ${m[3].replace(/^wks?$/, 'weeks')}`,
  },
];

function extractPlanAndFollowUp(text: string, out: ExtractedFinding[]) {
  for (const m of allMatches(PLAN_RE, text)) {
    push(out, 'plan', m[1].trim().replace(/\s+/g, ' '), 'medium');
    break;
  }
  for (const { re, fmt } of FOLLOW_RES) {
    const ms = allMatches(re, text);
    if (ms.length) {
      const m = ms[0];
      const where = m[0].match(/\b(ANC|PNC|antenatal|postnatal|clinic|GOPD|MOPD|O&G|SOPD)\b/i)?.[1];
      push(out, 'follow_up', `${where ? `${where} ` : ''}${fmt(m)}`.replace(/\s+/g, ' '), 'medium');
      break;
    }
  }
}

/** Extract structured findings from a free-text clinical report */
export function extractFindingsFromText(text: string): ExtractedFinding[] {
  const out: ExtractedFinding[] = [];
  if (!text || !text.trim()) return out;
  extractBP(text, out);
  extractHaemoglobin(text, out);
  extractTemperature(text, out);
  extractWeight(text, out);
  extractGA(text, out);
  extractUrineProtein(text, out);
  extractDiagnoses(text, out);
  extractMedicines(text, out);
  extractPlanAndFollowUp(text, out);
  return out;
}
