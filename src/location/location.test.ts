import { describe, expect, it } from 'vitest';
import { TRADITIONAL_PRACTICES } from '../clinical';
import { buildPlan } from '../engine';
import {
  LOCATION_PROFILES,
  LOCATION_SOURCES,
  buildLocationProfile,
  getLocationProfile,
  hasCuratedProfile,
  listRegions,
  nearestRegion,
  toPlanLocation,
  withDistances,
} from '.';

const DEMO: Record<string, string[]> = {
  NG: ['Lagos', 'Kano', 'Kaduna', 'Enugu', 'Oyo', 'Edo', 'Delta', 'Benue', 'Cross River', 'Borno'],
  KE: ['Kisumu', 'Kilifi', 'Turkana', 'Nairobi'],
  GH: ['Northern', 'Upper East', 'Ashanti', 'Greater Accra'],
};

describe('curated profiles', () => {
  it('covers every demo region', () => {
    for (const [c, regions] of Object.entries(DEMO)) {
      expect(listRegions(c as 'NG')).toEqual(expect.arrayContaining(regions));
      for (const r of regions) expect(hasCuratedProfile(c as 'NG', r), `${c} ${r}`).toBe(true);
    }
  });

  it('every profile is sourced: foods and facilities cite known sources, practices exist in the library', () => {
    const practiceIds = new Set(TRADITIONAL_PRACTICES.map((p) => p.id));
    for (const p of LOCATION_PROFILES) {
      expect(p.localFoods.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.sources.length, p.id).toBeGreaterThan(0);
      for (const f of p.localFoods) {
        expect(f.sourceIds.length, `${p.id} ${f.name}`).toBeGreaterThan(0);
        for (const s of f.sourceIds) expect(LOCATION_SOURCES[s], `${p.id} ${f.name} ${s}`).toBeTruthy();
        expect(f.householdMeasure).not.toMatch(/\bmg\b/);
      }
      for (const fac of p.referralFacilities) {
        expect(fac.distanceKm).toBeNull();
        for (const s of fac.sourceIds) expect(LOCATION_SOURCES[s], `${p.id} ${fac.name}`).toBeTruthy();
      }
      for (const id of p.prevalentPractices) expect(practiceIds.has(id), `${p.id} ${id}`).toBe(true);
    }
  });

  it('Benue suggests oranges by the piece, not milligrams', () => {
    const b = getLocationProfile('NG', 'Benue');
    const orange = b.localFoods.find((f) => /orange/i.test(f.name))!;
    expect(orange.householdMeasure).toMatch(/2 oranges/);
    expect(orange.nutrients).toContain('vitamin_c');
    expect(orange.season).toMatch(/October/);
  });

  it('Cross River lists afang, Kano groundnuts and millet, Kisumu omena', () => {
    expect(getLocationProfile('NG', 'Cross River').localFoods.some((f) => /afang/i.test(f.name))).toBe(true);
    const kano = getLocationProfile('NG', 'Kano').localFoods.map((f) => f.name).join(' ');
    expect(kano).toMatch(/Groundnuts/);
    expect(kano).toMatch(/Millet/);
    expect(getLocationProfile('KE', 'Kisumu').localFoods[0].name).toMatch(/Omena/);
  });

  it('malaria follows national policy: all NG and GH endemic; Kenya only lake and coast', () => {
    for (const p of LOCATION_PROFILES.filter((x) => x.country !== 'KE')) expect(p.malariaEndemic, p.id).toBe(true);
    expect(getLocationProfile('KE', 'Kisumu').malariaEndemic).toBe(true);
    expect(getLocationProfile('KE', 'Kilifi').malariaEndemic).toBe(true);
    expect(getLocationProfile('KE', 'Turkana').malariaEndemic).toBe(false);
    expect(getLocationProfile('KE', 'Nairobi').malariaEndemic).toBe(false);
  });
});

describe('lookups', () => {
  it('matches names loosely and through aliases', () => {
    expect(getLocationProfile('NG', 'cross river state').id).toBe('NG-cross-river');
    expect(getLocationProfile('NG', 'Calabar').id).toBe('NG-cross-river');
    expect(getLocationProfile('GH', 'Bolga').id).toBe('GH-upper-east');
    expect(getLocationProfile('KE', 'Kisumu County').id).toBe('KE-kisumu');
  });

  it('unknown regions get a country default with national foods and no invented facilities', () => {
    const p = getLocationProfile('NG', 'Sokoto');
    expect(p.origin).toBe('country_default');
    expect(p.referralFacilities).toEqual([]);
    expect(p.localFoods.length).toBeGreaterThan(0);
    expect(p.malariaEndemic).toBe(true);
    const k = getLocationProfile('KE', 'Siaya');
    expect(k.malariaEndemic).toBe(true); // Siaya is a lake-endemic IPTp county
    expect(getLocationProfile('KE', 'Nyeri').malariaEndemic).toBe(false);
  });

  it('nearestRegion guesses from GPS and gives up far away', () => {
    expect(nearestRegion(7.7, 8.5)?.region).toBe('Benue'); // Makurdi
    expect(nearestRegion(-0.1, 34.75)?.region).toBe('Kisumu');
    expect(nearestRegion(10.78, -0.86)?.region).toBe('Upper East');
    expect(nearestRegion(25.04, 102.7)).toBeNull(); // Kunming
  });

  it('withDistances fills straight-line km and sorts nearest first', () => {
    const p = withDistances(getLocationProfile('NG', 'Kaduna'), 11.08, 7.7); // Zaria
    expect(p.referralFacilities[0].name).toMatch(/Ahmadu Bello/);
    expect(p.referralFacilities[0].distanceKm).toBeLessThan(5);
    expect(p.referralFacilities[1].distanceKm).toBeGreaterThan(50);
  });
});

describe('engine hook', () => {
  it('toPlanLocation gives the PlanContext.location shape and the engine uses it', () => {
    const loc = toPlanLocation(getLocationProfile('NG', 'Benue'));
    expect(loc).toMatchObject({ country: 'NG', region: 'Benue', malariaEndemic: true });
    expect(loc.localFoods?.[0]).toHaveProperty('nutrients');
    expect(loc.practices?.length).toBeGreaterThan(0);
    const mother = {
      id: 'm1', name: 'Test', age: 26, country: 'NG', region: 'Benue', community: 'X', language: 'en', literacy: 'basic',
      phone: { access: 'feature', hasWhatsApp: false }, incomeBand: 'very_low', gravida: 2, parity: 1, previousCaesarean: false, previousStillbirth: false, previousPPH: false,
      conditions: [], allergies: [], genotype: 'AA', medications: [], pregnancy: { lmp: '2026-06-01', fetuses: 1 }, children: [], practicesMentioned: [],
      assignedWorkerId: 'w1', facilityId: 'f1', enrolledAt: '2026-07-01', consent: { dataProcessing: true, messaging: true, recordedAt: '2026-07-01', recordedBy: 'w1' }, events: [],
    } as unknown as Parameters<typeof buildPlan>[0];
    const plan = buildPlan(mother, '2026-11-05', { overrides: [], learnedRules: [], location: loc } as Parameters<typeof buildPlan>[2]);
    const text = plan.items.map((i) => `${i.detail} ${i.motherText}`).join(' ');
    expect(text).toMatch(/Benue|soy|orange|beniseed|sesame/i);
  });
});

describe('buildLocationProfile', () => {
  it('offline: returns the curated profile instantly with distances and district', async () => {
    const p = await buildLocationProfile({ country: 'GH', region: 'Upper East', district: 'Bongo', lat: 10.9, lon: -0.8 });
    expect(p.id).toBe('GH-upper-east');
    expect(p.district).toBe('Bongo');
    expect(p.referralFacilities[0].distanceKm).not.toBeNull();
  });

  it('online: adds named OSM hospitals, keeps curated ones, and survives failures', async () => {
    const fakeFetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          elements: [
            { lat: 5.0, lon: 8.3, tags: { amenity: 'hospital', name: 'General Hospital Calabar' } },
            { lat: 4.96, lon: 8.33, tags: { amenity: 'hospital', name: 'University of Calabar Teaching Hospital (UCTH)' } },
            { lat: 5.1, lon: 8.4, tags: { amenity: 'clinic', name: 'Small clinic' } },
            { lat: 5.1, lon: 8.4, tags: { amenity: 'hospital' } },
          ],
        }),
      }) as unknown as Response) as typeof fetch;
    const p = await buildLocationProfile({ country: 'NG', region: 'Cross River', lat: 4.97, lon: 8.34 }, { online: true, fetchImpl: fakeFetch });
    const names = p.referralFacilities.map((f) => f.name);
    expect(names).toContain('General Hospital Calabar');
    expect(names.filter((n) => /Teaching/.test(n)).length).toBe(1);
    expect(names).not.toContain('Small clinic');
    expect(p.sources.some((s) => s.id === 'osm-overpass')).toBe(true);

    const failing = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const q = await buildLocationProfile({ country: 'KE', region: 'Turkana', lat: 3.1, lon: 35.6 }, { online: true, fetchImpl: failing });
    expect(q.id).toBe('KE-turkana');
  });
});
