/**
 * Public, de-identified programme metrics (GET /api/public/metrics), the
 * open reporting UNICEF's Venture Fund asks portfolio companies for: reach,
 * continuity of care, channel use and cost, and AI use. No login needed.
 *
 * Protection:
 *  - Country level only (and month). No facility, ward or worker breakdown.
 *  - Counts from 1 to SUPPRESS_BELOW - 1 are withheld (null with a flag).
 *  - A rate is published only when its denominator is at least
 *    SUPPRESS_BELOW, and is rounded to whole percentages.
 *  - Costs are totals and per-mother averages, rounded.
 *  - Cached for an hour, so the endpoint cannot be polled to watch one
 *    mother's record change.
 */
import type { Mother } from '../../src/types';
import { deriveState } from '../../src/engine';
import type { DB } from './db';
import type { Store } from './store';
import { countMonth, periodOf } from './dhis2';

export interface PublicCount {
  value: number | null;
  suppressed?: true;
}

export interface PublicRate {
  /** Whole percentage, or null when the denominator is too small */
  percent: number | null;
  denominator: PublicCount;
}

export interface PublicMetrics {
  generatedAt: string;
  period: { from: string; to: string };
  suppressBelow: number;
  licence: string;
  sourceCode: string;
  countries: Record<
    string,
    {
      mothersEnrolled: PublicCount;
      mothersActive90d: PublicCount;
      facilities: PublicCount;
      healthWorkers: PublicCount;
      stage: Record<'pregnancy' | 'postpartum' | 'infant' | 'preconception', PublicCount>;
      anc4PlusAmongDelivered: PublicRate;
      facilityBirths: PublicRate;
      pncWithin48h: PublicRate;
      messagesSent: Record<string, PublicCount>;
      messageDeliveryRate: PublicRate;
      messagingCostUSD: { total: number | null; perMotherEnrolled: number | null };
      monthly: Array<{ period: string; ancContacts: PublicCount; births: PublicCount; pncContacts: PublicCount; referrals: PublicCount }>;
    }
  >;
  ai: { requests: PublicCount; blockedForIdentifiers: PublicCount; allDeidentified: true };
}

function count(v: number, min: number): PublicCount {
  return v > 0 && v < min ? { value: null, suppressed: true } : { value: v };
}

/**
 * A rate with its denominator published reveals its numerator (percent x denominator), so it is
 * withheld when the numerator, or the number who did not, is between 1 and min - 1. "3 of 40 women"
 * is a small count whether it is printed as 3 or as 8%.
 */
function rate(num: number, den: number, min: number): PublicRate {
  const small = (n: number) => n > 0 && n < min;
  const ok = den >= min && !small(num) && !small(den - num);
  return { percent: ok ? Math.round((num / den) * 100) : null, denominator: count(den, min) };
}

/**
 * Secondary suppression for parts that add up to a published total: with exactly one part
 * withheld, the total minus the others gives it away, so the next smallest part is withheld
 * too (or the total, when no other part can be).
 */
function suppressParts<K extends string>(total: PublicCount, parts: Record<K, PublicCount>): void {
  if (total.suppressed) return;
  const keys = Object.keys(parts) as K[];
  const hidden = keys.filter((k) => parts[k].suppressed);
  if (hidden.length !== 1) return;
  const visible = keys.filter((k) => !parts[k].suppressed && (parts[k].value ?? 0) > 0).sort((a, b) => (parts[a].value ?? 0) - (parts[b].value ?? 0));
  if (visible.length) parts[visible[0]] = { value: null, suppressed: true };
  else {
    total.value = null;
    total.suppressed = true;
  }
}

function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.unshift(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

export async function computePublicMetrics(db: DB, store: Store, opts: { suppressBelow: number; now?: Date; months?: number }): Promise<PublicMetrics> {
  const min = opts.suppressBelow;
  const now = opts.now ?? new Date();
  const asOf = now.toISOString();
  const months = lastMonths(opts.months ?? 12, now);
  const mothers = await store.mothersAt('all');
  const byCountry = new Map<string, Mother[]>();
  for (const m of mothers) byCountry.set(m.country, [...(byCountry.get(m.country) ?? []), m]);

  const facRows = await db.all<{ country: string; n: number }>('SELECT country, COUNT(*) AS n FROM facilities GROUP BY country');
  const workerRows = await db.all<{ country: string; n: number }>("SELECT country, COUNT(*) AS n FROM users WHERE active = 1 AND role IN ('worker','supervisor','clinical_reviewer') GROUP BY country");
  const msgRows = await db.all<{ country: string; channel: string; status: string; n: number }>(
    `SELECT mo.country AS country, me.channel AS channel, me.status AS status, COUNT(*) AS n
     FROM messages me JOIN mothers mo ON mo.id = me.mother_id WHERE me.simulated = 0 GROUP BY mo.country, me.channel, me.status`,
  );
  // Prefer the provider's actual cost; fall back to our estimate when the provider reported none
  const costRows = await db.all<{ country: string; usd: number | null }>(
    `SELECT country, SUM(cost_usd) AS usd FROM (
       SELECT c.country AS country, c.message_id,
              COALESCE(MAX(CASE WHEN c.source = 'provider' THEN c.cost_usd END), MAX(CASE WHEN c.source = 'estimate' THEN c.cost_usd END)) AS cost_usd
       FROM message_costs c JOIN messages m ON m.id = c.message_id WHERE m.simulated = 0 GROUP BY c.country, c.message_id
     ) t GROUP BY country`,
  );
  const aiRows = await db.all<{ outcome: string; n: number }>("SELECT outcome, COUNT(*) AS n FROM audit WHERE action LIKE 'ai.%' GROUP BY outcome");

  const out: PublicMetrics = {
    generatedAt: asOf,
    period: { from: months[0], to: months[months.length - 1] },
    suppressBelow: min,
    licence: 'AGPL-3.0-only',
    sourceCode: process.env.SOURCE_CODE_URL ?? 'https://github.com/gaskin-health/gaskin',
    countries: {},
    ai: {
      requests: count(aiRows.reduce((a, r) => a + Number(r.n), 0), min),
      blockedForIdentifiers: count(Number(aiRows.find((r) => r.outcome === 'blocked')?.n ?? 0), min),
      allDeidentified: true,
    },
  };

  const countries = new Set([...byCountry.keys(), ...facRows.map((r) => r.country)]);
  for (const cc of countries) {
    const ms = byCountry.get(cc) ?? [];
    const stage = { pregnancy: 0, postpartum: 0, infant: 0, preconception: 0 };
    let active = 0;
    let delivered = 0;
    let anc4 = 0;
    let births = 0;
    let facilityBirths = 0;
    let pnc48 = 0;
    for (const m of ms) {
      try {
        stage[deriveState(m, asOf).stage]++;
      } catch {
        /* incomplete record: not counted by stage */
      }
      const last = m.events?.[m.events.length - 1]?.at;
      if (last && Date.parse(asOf) - Date.parse(last) < 90 * 86_400_000) active++;
      const birth = m.events?.find((e) => e.kind === 'birth');
      if (birth && birth.kind === 'birth') {
        births++;
        if (birth.birth.place === 'facility') facilityBirths++;
        delivered++;
        const ancs = m.events.filter((e) => e.kind === 'visit' && e.visitType === 'anc' && e.attended && e.at <= birth.at).length;
        if (ancs >= 4) anc4++;
        if (m.events.some((e) => e.kind === 'visit' && e.visitType === 'pnc' && e.attended && Date.parse(e.at) - Date.parse(birth.birth.date) <= 2 * 86_400_000 && e.at >= birth.birth.date)) pnc48++;
      }
    }
    const msgs = msgRows.filter((r) => r.country === cc);
    const sentBy: Record<string, number> = {};
    let attempted = 0;
    let deliveredMsgs = 0;
    for (const r of msgs) {
      const n = Number(r.n);
      if (r.status === 'draft') continue;
      sentBy[r.channel] = (sentBy[r.channel] ?? 0) + n;
      if (r.channel === 'email') continue; // email has no delivery receipts
      attempted += n;
      if (r.status === 'delivered' || r.status === 'read') deliveredMsgs += n;
    }
    const usd = Number(costRows.find((r) => r.country === cc)?.usd ?? 0);
    const enrolled = count(ms.length, min);
    const stages = {
      pregnancy: count(stage.pregnancy, min),
      postpartum: count(stage.postpartum, min),
      infant: count(stage.infant, min),
      preconception: count(stage.preconception, min),
    };
    // Stages add up to the enrolled total (records the engine cannot read are the only gap)
    if (stage.pregnancy + stage.postpartum + stage.infant + stage.preconception === ms.length) suppressParts(enrolled, stages);
    out.countries[cc] = {
      mothersEnrolled: enrolled,
      mothersActive90d: count(active, min),
      facilities: count(Number(facRows.find((r) => r.country === cc)?.n ?? 0), min),
      healthWorkers: count(Number(workerRows.find((r) => r.country === cc)?.n ?? 0), min),
      stage: stages,
      anc4PlusAmongDelivered: rate(anc4, delivered, min),
      facilityBirths: rate(facilityBirths, births, min),
      pncWithin48h: rate(pnc48, births, min),
      messagesSent: Object.fromEntries(Object.entries(sentBy).map(([k, v]) => [k, count(v, min)])),
      messageDeliveryRate: rate(deliveredMsgs, attempted, min),
      messagingCostUSD: {
        total: ms.length >= min ? Math.round(usd * 100) / 100 : null,
        perMotherEnrolled: ms.length >= min ? Math.round((usd / ms.length) * 1000) / 1000 : null,
      },
      monthly: months.map((p) => {
        const c = countMonth(ms, p);
        return { period: p, ancContacts: count(c.GASKIN_ANC_TOTAL, min), births: count(c.GASKIN_BIRTHS, min), pncContacts: count(c.GASKIN_PNC_TOTAL, min), referrals: count(c.GASKIN_REFERRALS, min) };
      }),
    };
  }
  return out;
}

export { periodOf };
