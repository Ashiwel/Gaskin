/**
 * Checks for a backup file before it replaces the records on this device.
 *
 * A backup can come from anywhere: another worker's stick, a download, an email. The app
 * trusts the shape of its own state, so a malformed or hostile file could crash every screen,
 * smuggle markup or `javascript:` links into fields that become links, or pollute object
 * prototypes. This runs before import and returns either a cleaned copy or a plain-English
 * reason to refuse. It does not judge clinical content: the rules engine rebuilds every plan.
 */

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_MOTHERS = 20_000;
const MAX_EVENTS_PER_MOTHER = 5_000;
const MAX_STRING = 20_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ImportCheck<T> {
  ok: boolean;
  /** Plain English, for the worker */
  problems: string[];
  /** Cleaned copy (only when ok) */
  state?: T;
  /** Counts, for "Imported 37 mothers" */
  counts?: { mothers: number; events: number };
}

/** Deep copy that drops prototype-polluting keys, functions and over-long strings, and caps depth. */
function clean(v: unknown, depth = 0): unknown {
  if (depth > 40) return undefined;
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return typeof v === 'number' && !Number.isFinite(v) ? null : v;
  if (typeof v === 'string') return v.length > MAX_STRING ? v.slice(0, MAX_STRING) : v;
  if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      const c = clean(x, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

const isStr = (x: unknown, max = 300): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const isDate = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));

/** Remove any link that is not plain http(s) from citation-like objects anywhere in the tree */
function safeLinks(v: unknown): void {
  if (Array.isArray(v)) return v.forEach(safeLinks);
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  for (const k of ['url', 'href', 'downloadUrl', 'getKeyUrl']) {
    if (k in o && !(typeof o[k] === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(o[k] as string))) delete o[k];
  }
  for (const x of Object.values(o)) safeLinks(x);
}

/**
 * Validate an imported app state (the `state` of a Settings export, or the `data` of a storage
 * envelope). Requires a mothers list whose records have the fields the engine reads.
 */
export function validateImportedState<T extends { mothers: unknown[] }>(raw: unknown): ImportCheck<T> {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, problems: ['This file is not a Gaskin backup.'] };
  const st = clean(raw) as Record<string, unknown>;
  const mothers = st.mothers;
  if (!Array.isArray(mothers)) return { ok: false, problems: ['This file has no list of mothers, so it is not a Gaskin backup.'] };
  if (mothers.length > MAX_MOTHERS) return { ok: false, problems: [`This file lists ${mothers.length} mothers, more than one device should hold. Use the Gaskin server for a caseload this size.`] };

  const ids = new Set<string>();
  let events = 0;
  mothers.forEach((m0, i) => {
    const m = m0 as Record<string, unknown>;
    const where = `Mother ${i + 1}`;
    if (!m || typeof m !== 'object') return problems.push(`${where} is not a record.`);
    if (!isStr(m.id, 120)) problems.push(`${where} has no id.`);
    else if (ids.has(m.id)) problems.push(`${where} repeats the id ${m.id}.`);
    else ids.add(m.id);
    if (!isStr(m.name, 300)) problems.push(`${where} has no name, or a name longer than 300 characters.`);
    if (typeof m.age !== 'number' || m.age < 9 || m.age > 60) problems.push(`${where} has an age Gaskin cannot use.`);
    if (!['NG', 'KE', 'GH'].includes(m.country as string)) problems.push(`${where} has an unknown country.`);
    if (!Array.isArray(m.events)) problems.push(`${where} has no timeline.`);
    else {
      if (m.events.length > MAX_EVENTS_PER_MOTHER) problems.push(`${where} has more than ${MAX_EVENTS_PER_MOTHER} events.`);
      events += m.events.length;
      m.events.forEach((e0, j) => {
        const e = e0 as Record<string, unknown>;
        if (!e || typeof e !== 'object' || !isStr(e.id, 200) || !isStr(e.kind, 40) || !isDate(e.at)) problems.push(`${where}, event ${j + 1}: needs an id, a kind and a date.`);
      });
    }
    for (const k of ['children', 'conditions', 'medications', 'allergies', 'practicesMentioned'] as const) if (m[k] !== undefined && !Array.isArray(m[k])) problems.push(`${where}: ${k} should be a list.`);
    if (!m.phone || typeof m.phone !== 'object') problems.push(`${where} has no phone section.`);
    if (!m.consent || typeof m.consent !== 'object') problems.push(`${where} has no consent record.`);
  });
  for (const k of ['overrides', 'proposals', 'learnedRules', 'outbound', 'inbound', 'workers', 'facilities'] as const) {
    if (st[k] !== undefined && !Array.isArray(st[k])) problems.push(`The ${k} section should be a list.`);
  }
  if (problems.length) return { ok: false, problems: problems.slice(0, 12) };
  safeLinks(st);
  return { ok: true, problems: [], state: st as T, counts: { mothers: mothers.length, events } };
}
