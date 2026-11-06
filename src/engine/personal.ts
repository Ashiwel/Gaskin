/**
 * Personal mode: a woman using Gaskin for herself, with no health worker on the device.
 * - Only mother-facing text: worker-only items (screens, standing orders, clinical detail) are hidden,
 *   and every item's detail becomes her own plain line.
 * - Every alert becomes "Go to [nearest facility] now" (or today) with the emergency number.
 * - "Register with a clinic or health worker" and "Book your next check-up" stay at the top until she
 *   records that she has done them (Mother.selfCare).
 */
import type { Alert, Mother, PlanItem } from '../types';
import { COUNTRY_RULES, howToFor } from '../clinical';
import { emergencyNumberFor } from '../legal/emergency';
import { daysBetween } from './dates';
import { motherTextFor } from './items';
import type { PlanContext } from './plan';

/** Items that only make sense for a health worker. */
const WORKER_ONLY = /^(mh\.epds_screen|test\.genotype|med\.iptp|med\.deworming|imm\.td|test\.hiv_syphilis_hbv|trad\.ask_local|visit\.anc_schedule)/;

function place(mother: Mother, ctx: PlanContext): string {
  return ctx.nearestFacility ?? mother.selfCare?.clinicName ?? COUNTRY_RULES[mother.country].referralHospital;
}

function number(mother: Mother, ctx: PlanContext): string {
  return ctx.emergencyNumber ?? emergencyNumberFor(mother.country) ?? 'the emergency number';
}

export function personalItems(items: PlanItem[], mother: Mother, asOf: string, _ctx: PlanContext): PlanItem[] {
  const out: PlanItem[] = [];
  for (const it of items) {
    if (it.audience === 'worker' || it.workerOnly || WORKER_ONLY.test(it.id)) continue;
    // Her own words only: the detail becomes the plain line, sources and evidence stay for "Why?".
    out.push({ ...it, detail: it.motherText, audience: 'mother' });
  }
  const sc = mother.selfCare;
  const registered = !!sc?.registeredWithClinicAt;
  const booked = !!sc?.nextCheckupAt && daysBetween(asOf, sc.nextCheckupAt) >= 0;
  const self = (id: string, key: string, title: string, priority: PlanItem['priority']): PlanItem => ({
    id,
    category: 'visits',
    title,
    detail: '',
    ...motherTextFor(false, key),
    priority,
    audience: 'mother',
    evidence: 'A',
    sources: [],
    because: ['Using Gaskin on your own'],
    locked: true,
    origin: 'guideline',
    illustration: 'clinic_visit',
    status: 'active',
    howTo: howToFor(key),
  });
  if (!registered) {
    const r = self('personal.register', 'personal.register', 'Register with a clinic or health worker', 1);
    r.detail = r.motherText;
    out.unshift(r);
  }
  if (!booked) {
    const b = self('personal.book', 'personal.book', 'Book your next check-up', registered ? 1 : 2);
    b.detail = b.motherText;
    out.unshift(b);
  }
  return out;
}

export function personalAlerts(alerts: Alert[], mother: Mother, ctx: PlanContext): Alert[] {
  const where = place(mother, ctx);
  const num = number(mother, ctx);
  return alerts.map((a) => {
    const now = a.level === 'emergency';
    const key = now ? 'personal.go_now' : 'personal.go_today';
    const params = { place: where, number: num };
    const text = motherTextFor(false, key, params);
    return {
      ...a,
      // What she does: one action, in her words, with the emergency number.
      action: text.motherText,
      reason: a.motherText ?? a.reason,
      motherText: `${a.motherText ? `${a.motherText} ` : ''}${text.motherText}`,
      motherTextKey: key,
      motherTextParams: params,
    };
  });
}
