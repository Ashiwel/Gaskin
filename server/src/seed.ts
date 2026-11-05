/**
 * Facilities from the shared directory, so a fresh server knows the demo
 * facilities. A real deployment adds its own through POST /api/admin/facilities
 * (with DHIS2 org unit ids) and can ignore these.
 *
 * `seedDemo` loads the synthetic cohort and one account per demo worker
 * (PIN from DEMO_PIN), for reviewers and the pitch video. Never on a server
 * holding real data: it refuses when any non-demo mother exists.
 */
import { FACILITIES, WORKERS } from '../../src/data/directory';
import { createSeedState } from '../../src/data';
import { splitMother } from '../../src/hosted/syncTypes';
import { type DB, insertIgnore, nowIso } from './db';
import { createUser, normalisePhone } from './auth';
import type { HostedRole } from '../../src/hosted/syncTypes';
import { Store } from './store';

export async function seedFacilities(db: DB): Promise<void> {
  for (const f of FACILITIES) await db.run(insertIgnore(db, 'facilities', ['id', 'name', 'country', 'region', 'dhis2_org_unit']), [f.id, f.name, f.country, f.region, null]);
}

/** Demo phone numbers: +234 800 000 01xx etc., one per worker in seed order */
export function demoPhone(i: number, country: string): string {
  const cc = { NG: '+234800000', KE: '+254700000', GH: '+233200000' }[country] ?? '+234800000';
  return `${cc}${String(100 + i).padStart(3, '0')}`;
}

export async function seedDemo(db: DB, pin: string): Promise<{ users: Array<{ phone: string; name: string; role: HostedRole }>; mothers: number }> {
  const real = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM mothers WHERE id NOT LIKE 'm-%'");
  if (Number(real?.n)) throw new Error('This database holds records that are not demo data. Refusing to load the demo cohort.');
  await seedFacilities(db);
  const seed = createSeedState();
  const store = new Store(db);
  const users: Array<{ phone: string; name: string; role: HostedRole }> = [];
  for (const [i, w] of WORKERS.entries()) {
    const role: HostedRole = w.isClinicalReviewer ? 'clinical_reviewer' : w.role === 'doctor' || w.role === 'obgyn' || w.role === 'paediatrician' ? 'supervisor' : 'worker';
    // Supervisors see every facility in their country, workers their own
    const facilityIds = role === 'worker' ? [w.facilityId] : FACILITIES.filter((f) => f.country === w.country).map((f) => f.id);
    const phone = normalisePhone(demoPhone(i, w.country), w.country);
    const exists = await db.get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (!exists) await createUser(db, { phone, pin, name: w.name, role, facilityIds, workerId: w.id, country: w.country });
    users.push({ phone, name: w.name, role });
  }
  const po = '+234800000999';
  if (!(await db.get('SELECT id FROM users WHERE phone = ?', [po]))) await createUser(db, { phone: po, pin, name: 'Programme officer (demo)', role: 'programme_officer', facilityIds: FACILITIES.map((f) => f.id) });
  users.push({ phone: po, name: 'Programme officer (demo)', role: 'programme_officer' });

  const now = nowIso();
  await db.tx(async (t) => {
    for (const m of seed.mothers) {
      const { profile, events } = splitMother(m);
      await t.run(insertIgnore(t, 'mothers', ['id', 'facility_id', 'country', 'body', 'updated_at', 'updated_by', 'deleted']), [m.id, m.facilityId, m.country, JSON.stringify(profile), now, 'seed', 0]);
      for (const e of events)
        await t.run(insertIgnore(t, 'events', ['id', 'mother_id', 'facility_id', 'kind', 'at', 'body', 'created_by', 'created_at']), [e.id, m.id, m.facilityId, e.kind, e.at, JSON.stringify(e), 'seed', now]);
    }
    for (const o of seed.overrides) {
      const fac = seed.mothers.find((m) => m.id === o.motherId)?.facilityId ?? null;
      await store.saveDoc(t, undefined, undefined, 'override', o.id, o, fac, o.motherId);
    }
    for (const p of seed.proposals) await store.saveDoc(t, undefined, undefined, 'proposal', p.id, p, null);
    for (const r of seed.learnedRules) await store.saveDoc(t, undefined, undefined, 'rule', r.id, r, null);
  });
  return { users, mothers: seed.mothers.length };
}
