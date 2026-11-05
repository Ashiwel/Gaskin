/**
 * Monthly aggregate counts for DHIS2 (Nigeria's NHMIS, Kenya's KHIS and
 * Ghana's DHIMS2 all run DHIS2), and the public de-identified metrics.
 *
 * Output is a DHIS2 dataValueSet (POST /api/dataValueSets). Data elements
 * and org units are referred to by CODE by default (`GASKIN_ANC1` and the
 * facility id), so a deployment maps them once in a JSON file
 * (DHIS2_MAPPING_FILE) to the national UIDs, for example the NHMIS monthly
 * summary form's "ANC 1st visit" element, instead of hard-coding UIDs that
 * differ by instance.
 *
 * Small-count suppression. Any count from 1 to SUPPRESS_BELOW - 1 (default
 * 1–9) is withheld and listed in `suppressed`, because a count of 2 HIV-
 * positive tests at a village health post can identify the women. Zeros are
 * reported: a zero discloses nothing about a person. Where a total and all
 * but one of its parts would be published, the smallest remaining part is
 * also withheld (secondary suppression), so a suppressed cell cannot be
 * recovered by subtraction.
 */
import { readFileSync } from 'node:fs';
import type { ClinicalEvent, Mother } from '../../src/types';

export interface IndicatorDef {
  code: string;
  label: string;
  /** Data element UID or code in DHIS2 (from the mapping file; defaults to code) */
  dataElement?: string;
  categoryOptionCombo?: string;
  /** Children of a total, for secondary suppression */
  partOf?: string;
}

export const INDICATORS: IndicatorDef[] = [
  { code: 'GASKIN_ANC_TOTAL', label: 'ANC contacts attended' },
  { code: 'GASKIN_ANC1', label: 'ANC 1st contact', partOf: 'GASKIN_ANC_TOTAL' },
  { code: 'GASKIN_ANC1_BEFORE_12W', label: 'ANC 1st contact before 12 weeks' },
  { code: 'GASKIN_ANC4', label: 'ANC 4th contact' },
  { code: 'GASKIN_ANC8', label: 'ANC 8th contact' },
  { code: 'GASKIN_BIRTHS', label: 'Births recorded' },
  { code: 'GASKIN_BIRTHS_FACILITY', label: 'Births in a health facility', partOf: 'GASKIN_BIRTHS' },
  { code: 'GASKIN_BIRTHS_HOME', label: 'Births at home or with a TBA', partOf: 'GASKIN_BIRTHS' },
  { code: 'GASKIN_BIRTHS_TRANSIT', label: 'Births in transit', partOf: 'GASKIN_BIRTHS' },
  { code: 'GASKIN_PNC_TOTAL', label: 'PNC contacts attended' },
  { code: 'GASKIN_PNC_48H', label: 'Mothers with a PNC contact within 48 hours of birth' },
  { code: 'GASKIN_PNC_7D', label: 'Mothers with a PNC contact within 7 days of birth' },
  { code: 'GASKIN_REFERRALS', label: 'Referrals made' },
  { code: 'GASKIN_REFERRALS_EMERGENCY', label: 'Emergency referrals made', partOf: 'GASKIN_REFERRALS' },
  { code: 'GASKIN_EPDS_SCREENED', label: 'Mothers screened for depression (EPDS/PHQ)' },
  { code: 'GASKIN_IMM_BCG', label: 'BCG given' },
  { code: 'GASKIN_IMM_HEPB0', label: 'Hepatitis B birth dose given' },
  { code: 'GASKIN_IMM_OPV0', label: 'OPV 0 given' },
  { code: 'GASKIN_IMM_PENTA1', label: 'Pentavalent 1 given' },
  { code: 'GASKIN_IMM_PENTA3', label: 'Pentavalent 3 given' },
  { code: 'GASKIN_IMM_PCV3', label: 'PCV 3 given' },
  { code: 'GASKIN_IMM_MCV1', label: 'Measles(-rubella) 1 given' },
  { code: 'GASKIN_IMM_MCV2', label: 'Measles(-rubella) 2 given' },
  { code: 'GASKIN_IMM_YF', label: 'Yellow fever given' },
  { code: 'GASKIN_IMM_MALARIA1', label: 'Malaria vaccine 1 given' },
];

const VACCINE_TO_CODE: Array<[RegExp, string]> = [
  [/^BCG$/i, 'GASKIN_IMM_BCG'],
  [/^HepB0$/i, 'GASKIN_IMM_HEPB0'],
  [/^OPV0$/i, 'GASKIN_IMM_OPV0'],
  [/^Penta1$/i, 'GASKIN_IMM_PENTA1'],
  [/^Penta3$/i, 'GASKIN_IMM_PENTA3'],
  [/^PCV3$/i, 'GASKIN_IMM_PCV3'],
  [/^(MCV1|MR1)$/i, 'GASKIN_IMM_MCV1'],
  [/^(MCV2|MR2)$/i, 'GASKIN_IMM_MCV2'],
  [/^YF\b/i, 'GASKIN_IMM_YF'],
  [/^Malaria1\b/i, 'GASKIN_IMM_MALARIA1'],
];

export type Counts = Record<string, number>;

/** 'YYYYMM' (DHIS2 monthly period) of an ISO date */
export function periodOf(iso: string): string {
  return iso.slice(0, 4) + iso.slice(5, 7);
}

function inPeriod(iso: string | undefined, period: string): boolean {
  return !!iso && periodOf(iso) === period;
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

/** Count one facility's events for one month */
export function countMonth(mothers: Mother[], period: string): Counts {
  const c: Counts = Object.fromEntries(INDICATORS.map((i) => [i.code, 0]));
  const inc = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  for (const m of mothers) {
    const events: ClinicalEvent[] = m.events ?? [];
    const births = events.filter((e) => e.kind === 'birth');
    const birthDate = births.length ? births[births.length - 1].birth.date : m.birth?.date;
    let pnc48 = false;
    let pnc7 = false;
    let screened = false;
    for (const e of events) {
      if (!inPeriod(e.at, period)) continue;
      switch (e.kind) {
        case 'visit':
          if (!e.attended) break;
          if (e.visitType === 'anc') {
            inc('GASKIN_ANC_TOTAL');
            if (e.contactNumber === 1) {
              inc('GASKIN_ANC1');
              if (m.pregnancy?.lmp && daysBetween(m.pregnancy.lmp, e.at) < 12 * 7) inc('GASKIN_ANC1_BEFORE_12W');
            }
            if (e.contactNumber === 4) inc('GASKIN_ANC4');
            if (e.contactNumber === 8) inc('GASKIN_ANC8');
          }
          if (e.visitType === 'pnc') {
            inc('GASKIN_PNC_TOTAL');
            if (birthDate) {
              const d = daysBetween(birthDate, e.at);
              if (d >= 0 && d <= 2) pnc48 = true;
              if (d >= 0 && d <= 7) pnc7 = true;
            }
          }
          break;
        case 'birth':
          inc('GASKIN_BIRTHS');
          inc(e.birth.place === 'facility' ? 'GASKIN_BIRTHS_FACILITY' : e.birth.place === 'in_transit' ? 'GASKIN_BIRTHS_TRANSIT' : 'GASKIN_BIRTHS_HOME');
          break;
        case 'referral':
          inc('GASKIN_REFERRALS');
          if (e.urgency === 'emergency') inc('GASKIN_REFERRALS_EMERGENCY');
          break;
        case 'screening':
          screened = true;
          break;
        case 'immunisation':
          for (const v of e.vaccines) {
            const hit = VACCINE_TO_CODE.find(([re]) => re.test(v.trim()));
            if (hit) inc(hit[1]);
          }
          break;
      }
    }
    if (pnc48) inc('GASKIN_PNC_48H');
    if (pnc7) inc('GASKIN_PNC_7D');
    if (screened) inc('GASKIN_EPDS_SCREENED');
  }
  return c;
}

export interface SuppressionResult {
  values: Record<string, number>;
  suppressed: string[];
}

/** Withhold 1..(min-1); then secondary suppression inside each total/part group */
export function suppress(counts: Counts, min: number, defs: IndicatorDef[] = INDICATORS): SuppressionResult {
  const values: Record<string, number> = {};
  const suppressed = new Set<string>();
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0 && v < min) suppressed.add(k);
    else values[k] = v;
  }
  // Secondary: a total with exactly one hidden part would reveal it
  const groups = new Map<string, string[]>();
  for (const d of defs) if (d.partOf) groups.set(d.partOf, [...(groups.get(d.partOf) ?? []), d.code]);
  for (const [total, parts] of groups) {
    if (suppressed.has(total)) continue;
    const hidden = parts.filter((p) => suppressed.has(p));
    if (hidden.length !== 1) continue;
    const visible = parts.filter((p) => !suppressed.has(p) && (values[p] ?? 0) > 0).sort((a, b) => values[a] - values[b]);
    if (visible.length) {
      suppressed.add(visible[0]);
      delete values[visible[0]];
    } else {
      suppressed.add(total);
      delete values[total];
    }
  }
  return { values, suppressed: [...suppressed] };
}

export interface Dhis2Mapping {
  dataSet?: string;
  /** Gaskin code -> { dataElement, categoryOptionCombo } */
  dataElements?: Record<string, { dataElement: string; categoryOptionCombo?: string }>;
  /** Gaskin facility id -> DHIS2 org unit UID or code */
  orgUnits?: Record<string, string>;
  idScheme?: 'UID' | 'CODE';
}

export function loadMapping(file?: string): Dhis2Mapping {
  if (!file) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Dhis2Mapping;
  } catch (e) {
    console.error(`[dhis2] could not read mapping file ${file}: ${(e as Error).message}`);
    return {};
  }
}

export interface DataValueSet {
  dataSet?: string;
  period: string;
  orgUnit: string;
  completeDate: string;
  dataValues: Array<{ dataElement: string; categoryOptionCombo?: string; period: string; orgUnit: string; value: string; comment?: string }>;
}

export interface Dhis2Export {
  /** Pass this to POST /api/dataValueSets?dataElementIdScheme=...&orgUnitIdScheme=... */
  idScheme: 'UID' | 'CODE';
  dataValueSets: DataValueSet[];
  suppressed: Array<{ orgUnit: string; dataElement: string }>;
  suppressBelow: number;
  generatedAt: string;
  note: string;
}

export function buildDataValueSets(
  byFacility: Array<{ facilityId: string; dhis2OrgUnit?: string | null; mothers: Mother[] }>,
  period: string,
  opts: { suppressBelow: number; mapping?: Dhis2Mapping; dataSet?: string; now?: string },
): Dhis2Export {
  const mapping = opts.mapping ?? {};
  const out: Dhis2Export = {
    idScheme: mapping.idScheme ?? (mapping.dataElements ? 'UID' : 'CODE'),
    dataValueSets: [],
    suppressed: [],
    suppressBelow: opts.suppressBelow,
    generatedAt: opts.now ?? new Date().toISOString(),
    note: `Counts from 1 to ${opts.suppressBelow - 1} are withheld to protect privacy, with secondary suppression inside totals. Zeros are reported.`,
  };
  for (const f of byFacility) {
    const orgUnit = mapping.orgUnits?.[f.facilityId] ?? f.dhis2OrgUnit ?? f.facilityId;
    const { values, suppressed } = suppress(countMonth(f.mothers, period), opts.suppressBelow);
    const de = (code: string) => mapping.dataElements?.[code] ?? { dataElement: code };
    out.dataValueSets.push({
      dataSet: mapping.dataSet ?? opts.dataSet,
      period,
      orgUnit,
      completeDate: out.generatedAt.slice(0, 10),
      dataValues: Object.entries(values).map(([code, v]) => {
        const d = de(code);
        return { dataElement: d.dataElement, ...(d.categoryOptionCombo ? { categoryOptionCombo: d.categoryOptionCombo } : {}), period, orgUnit, value: String(v) };
      }),
    });
    for (const s of suppressed) out.suppressed.push({ orgUnit, dataElement: de(s).dataElement });
  }
  return out;
}

/** Push to a DHIS2 instance. Returns DHIS2's import summary. */
export async function pushToDhis2(
  exp: Dhis2Export,
  cfg: { url: string; username: string; password: string },
  fetchFn: typeof fetch = fetch,
): Promise<Array<{ orgUnit: string; status: number; summary: unknown }>> {
  const results = [];
  for (const set of exp.dataValueSets) {
    const res = await fetchFn(`${cfg.url}/api/dataValueSets?dataElementIdScheme=${exp.idScheme}&orgUnitIdScheme=${exp.idScheme}&importStrategy=CREATE_AND_UPDATE`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')}` },
      body: JSON.stringify(set),
    });
    let summary: unknown = null;
    try {
      summary = await res.json();
    } catch {
      /* ignore */
    }
    results.push({ orgUnit: set.orgUnit, status: res.status, summary });
  }
  return results;
}
