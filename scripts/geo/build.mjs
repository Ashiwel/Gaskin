#!/usr/bin/env node
// Builds Gaskin's bundled geography and language data (src/geo/data/*.json) from open sources.
//
// Usage: node scripts/geo/build.mjs            (fetches pinned versions, writes src/geo/data)
//        node scripts/geo/build.mjs --check    (fetches and verifies counts only, writes nothing)
//
// Every input is pinned to an exact npm version or git commit, so the output is reproducible.
// Downloads are cached in node_modules/.cache/gaskin-geo. Licences and attribution: src/geo/SOURCES.md.
//
// Sources
//   npm  iso-3166@4.4.0                 MIT            ISO 3166-1 and first-level ISO 3166-2 subdivisions
//   npm  countries-list@3.4.1           MIT            English and native country names, calling codes, currencies
//   npm  cldr-core@48.2.0               Unicode-3.0    territoryInfo: languages and population share by country
//   npm  cldr-localenames-full@48.2.0   Unicode-3.0    language names in English and in each language
//   gh   wmgeolab/geoBoundaries@9469f09 NGA ADM1/ADM2     CC-BY-4.0 (GRID3)  37 states incl. FCT, 774 LGAs
//   gh   EricBidopa/ghana-geo-data@c4570a4                CC-BY-SA-4.0  261 districts by region (2021 structure)
//   gh   wmgeolab/geoBoundaries@9469f09 KEN ADM1/ADM2     public domain / CC-BY-3.0-IGO  47 counties, 290 sub-counties
//   gh   wmgeolab/geoBoundaries@9469f09 ZAF ADM1/ADM3     CC-BY-3.0-IGO  9 provinces, 213 local and metropolitan municipalities
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/geo/data');
const CACHE = join(ROOT, 'node_modules/.cache/gaskin-geo');
const CHECK_ONLY = process.argv.includes('--check');
mkdirSync(CACHE, { recursive: true });

const NPM = {
  iso3166: ['iso-3166', '4.4.0'],
  countries: ['countries-list', '3.4.1'],
  cldrCore: ['cldr-core', '48.2.0'],
  cldrNames: ['cldr-localenames-full', '48.2.0'],
};
const GH = {
  ngAdm1: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson',
  ngAdm2: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson',
  ghDistricts: 'https://raw.githubusercontent.com/EricBidopa/ghana-geo-data/c4570a4ea96445f9c58f0796dd7b8f0c9934bd84/data/ghana-locations.json',
  keAdm1: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1_simplified.geojson',
  keAdm2: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KEN/ADM2/geoBoundaries-KEN-ADM2_simplified.geojson',
  zaAdm1: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/ZAF/ADM1/geoBoundaries-ZAF-ADM1_simplified.geojson',
  zaAdm3: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/ZAF/ADM3/geoBoundaries-ZAF-ADM3_simplified.geojson',
};

const hashes = {};

async function download(url, file) {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  hashes[url] = createHash('sha256').update(readFileSync(path)).digest('hex');
  return path;
}

/** Fetch an npm tarball and unpack it (optionally only some paths). Returns the package directory. */
async function npmPackage([name, version], only) {
  const dir = join(CACHE, `${name}-${version}`);
  if (!existsSync(join(dir, 'package'))) {
    const tgz = await download(`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, `${name}-${version}.tgz`);
    mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['xzf', tgz, '-C', dir, ...(only ? ['--wildcards', ...only] : [])]);
  } else {
    await download(`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, `${name}-${version}.tgz`);
  }
  return join(dir, 'package');
}

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const round = (n) => Math.round(n * 100) / 100;
function assert(cond, msg) {
  if (!cond) throw new Error(`Check failed: ${msg}`);
}

// ---------------------------------------------------------------------------
// Polygons (geoBoundaries): assign each second-level shape to its first-level parent
// by majority vote of its vertices, and take the mean of its vertices as an approximate centre.
// ---------------------------------------------------------------------------

function outerRings(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates[0]];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((p) => p[0]);
  return [];
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bbox(rings) {
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) for (const [x, y] of r) [a, b, c, d] = [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)];
  return [a, b, c, d];
}
function assignParents(children, parents) {
  const P = parents.map((f) => ({ f, rings: outerRings(f.geometry), box: bbox(outerRings(f.geometry)) }));
  return children.map((f) => {
    const rings = outerRings(f.geometry);
    const pts = rings.flat();
    // Pull vertices slightly towards the shape's mean so shared borders do not tie
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const votes = new Map();
    for (const [x, y] of pts) {
      const q = [x + (mx - x) * 0.05, y + (my - y) * 0.05];
      for (const p of P) {
        if (q[0] < p.box[0] || q[0] > p.box[2] || q[1] < p.box[1] || q[1] > p.box[3]) continue;
        if (p.rings.some((r) => inRing(q, r))) votes.set(p.f, (votes.get(p.f) ?? 0) + 1);
      }
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) throw new Error(`No parent for ${f.properties.shapeName}`);
    // Approximate centre: mean of the largest ring's vertices
    const big = rings.sort((a, b) => b.length - a.length)[0];
    const cx = big.reduce((s, p) => s + p[0], 0) / big.length;
    const cy = big.reduce((s, p) => s + p[1], 0) / big.length;
    // Tidy capitalisation after apostrophes in the source ("Jema'A" -> "Jema'a")
    const name = f.properties.shapeName.trim().replace(/'([A-Z])(?=[a-z]|$)/g, (_m, c) => `'${c.toLowerCase()}`);
    return { name, parent: best[0], lat: round(cy), lon: round(cx) };
  });
}

// ---------------------------------------------------------------------------

/** Pack areas as { regionCodeSuffix: "Name@lat,lon|Name|..." } (coordinates optional) */
function packAreas(rows) {
  const out = {};
  for (const r of rows.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name))) {
    const s = r.lat !== undefined ? `${r.name}@${r.lat},${r.lon}` : r.name;
    assert(!/[|@;]/.test(r.name), `separator in ${r.name}`);
    out[r.region] = out[r.region] ? `${out[r.region]}|${s}` : s;
  }
  return out;
}

const slugName = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(region|state|county|province)\b/g, '')
    .replace(/[^a-z]/g, '');

async function main() {
  // ---------- Countries ----------
  const iso = await npmPackage(NPM.iso3166);
  const { iso31661 } = await import(join(iso, '1.js'));
  const { iso31662 } = await import(join(iso, '2.js'));
  const cl = json(join(await npmPackage(NPM.countries), 'countries.min.json'));
  const countries = iso31661
    .map((c) => {
      const x = cl[c.alpha2];
      assert(x, `countries-list lacks ${c.alpha2}`);
      const aliases = (x.alias ?? []).filter((a) => a !== x.name && !/[;|]/.test(a)).join(';');
      return [c.alpha2, x.name, x.native !== x.name ? x.native : '', x.phone?.[0] ? String(x.phone[0]) : '', x.currency?.[0] ?? '', aliases];
    })
    .sort((a, b) => a[1].localeCompare(b[1]));
  assert(countries.length === 249, `249 countries, got ${countries.length}`);

  // ---------- First-level subdivisions ----------
  // Corrections to iso-3166@4.4.0 (scraped from Wikipedia): GH-BA (Brong-Ahafo) was split in 2018
  // into Bono, Bono East and Ahafo and withdrawn from ISO 3166-2 (Newsletter 2019-11-22).
  const DROP = new Set(['GH-BA']);
  // Display names: plain spellings people use; the ISO code stays the key.
  const RENAME = {
    'NG-FC': 'Federal Capital Territory',
    'KE-05': 'Elgeyo-Marakwet',
    'KE-30': 'Nairobi',
    'KE-39': 'Taita-Taveta',
    'ZA-KZN': 'KwaZulu-Natal',
    'ZA-NW': 'North West',
  };
  const regions = {};
  for (const s of iso31662) {
    if (s.parent.length !== 2 || DROP.has(s.code)) continue;
    const name = RENAME[s.code] ?? s.name;
    assert(!/[|:]/.test(name), `separator in ${name}`);
    (regions[s.parent] ??= []).push([s.code.slice(3), name]);
  }
  const packedRegions = {};
  for (const [c, list] of Object.entries(regions)) packedRegions[c] = list.sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => `${k}:${n}`).join('|');
  const nRegions = (c) => regions[c]?.length ?? 0;
  assert(nRegions('NG') === 37, `NG 37 states incl. FCT, got ${nRegions('NG')}`);
  assert(nRegions('KE') === 47, `KE 47 counties, got ${nRegions('KE')}`);
  assert(nRegions('GH') === 16, `GH 16 regions, got ${nRegions('GH')}`);
  assert(nRegions('ZA') === 9, `ZA 9 provinces, got ${nRegions('ZA')}`);

  // ---------- Nigeria: 774 LGAs (GRID3 boundaries via geoBoundaries) ----------
  // Official LGA counts per state (1999 Constitution, First Schedule Part I), used to check the polygon assignment.
  const NG_LGA_COUNT = {
    AB: 17, AD: 21, AK: 31, AN: 21, BA: 20, BY: 8, BE: 23, BO: 27, CR: 18, DE: 25, EB: 13, ED: 18, EK: 16, EN: 17, FC: 6, GO: 11, IM: 27, JI: 27, KD: 23,
    KN: 44, KT: 34, KE: 21, KO: 21, KW: 16, LA: 20, NA: 13, NI: 25, OG: 20, ON: 18, OS: 30, OY: 33, PL: 17, RI: 23, SO: 23, TA: 16, YO: 17, ZA: 14,
  };
  const ng1 = json(await download(GH.ngAdm1, 'nga-adm1.geojson')).features;
  const ng2 = json(await download(GH.ngAdm2, 'nga-adm2.geojson')).features;
  assert(ng1.length === 37, `NG ADM1 37, got ${ng1.length}`);
  const ng = assignParents(ng2, ng1).map((a) => ({ name: a.name, lat: a.lat, lon: a.lon, region: a.parent.properties.shapeISO.slice(3) }));
  assert(ng.length === 774, `NG 774 LGAs, got ${ng.length}`);
  const ngStates = new Set(regions.NG.map(([k]) => k));
  for (const r of ng) assert(ngStates.has(r.region), `NG state ${r.region}`);
  const ngCount = {};
  for (const r of ng) ngCount[r.region] = (ngCount[r.region] ?? 0) + 1;
  for (const [st, n] of Object.entries(NG_LGA_COUNT)) assert(ngCount[st] === n, `NG ${st}: ${n} LGAs expected, got ${ngCount[st]}`);
  assert(Object.values(NG_LGA_COUNT).reduce((a, b) => a + b, 0) === 774, 'official counts sum to 774');

  // ---------- Ghana: 261 districts in 16 regions ----------
  const gh = json(await download(GH.ghDistricts, 'gh-districts.json'));
  const ghByName = new Map(regions.GH.map(([k, n]) => [slugName(n), k]));
  const ghRows = [];
  for (const reg of gh) {
    const code = ghByName.get(slugName(reg.name));
    assert(code, `GH region ${reg.name}`);
    for (const d of reg.districts) ghRows.push({ region: code, name: d.name.trim() });
  }
  assert(gh.length === 16, `GH 16 regions, got ${gh.length}`);
  assert(ghRows.length === 261, `GH 261 districts, got ${ghRows.length}`);

  // ---------- Kenya: 290 sub-counties (IEBC constituencies) in 47 counties ----------
  const ke1 = json(await download(GH.keAdm1, 'ken-adm1.geojson')).features;
  const ke2 = json(await download(GH.keAdm2, 'ken-adm2.geojson')).features;
  assert(ke1.length === 47, `KE ADM1 47, got ${ke1.length}`);
  const keRows = assignParents(ke2, ke1).map((a) => ({ ...a, region: a.parent.properties.shapeISO.slice(3) }));
  const keCodes = new Set(regions.KE.map(([k]) => k));
  for (const r of keRows) assert(keCodes.has(r.region), `KE county ${r.region}`);
  assert(keRows.length === 290, `KE 290 sub-counties, got ${keRows.length}`);
  assert(new Set(keRows.map((r) => r.region)).size === 47, 'KE sub-counties cover 47 counties');

  // ---------- South Africa: 213 municipalities in 9 provinces ----------
  const ZA_ISO = { EC: 'EC', FS: 'FS', GT: 'GP', KZ: 'KZN', LI: 'LP', MP: 'MP', NW: 'NW', NC: 'NC', WC: 'WC' };
  const za1 = json(await download(GH.zaAdm1, 'zaf-adm1.geojson')).features;
  const za3 = json(await download(GH.zaAdm3, 'zaf-adm3.geojson')).features;
  const zaRows = assignParents(za3, za1).map((a) => ({ ...a, region: ZA_ISO[a.parent.properties.shapeISO] }));
  for (const r of zaRows) assert(r.region, `ZA province for ${r.name}`);
  assert(zaRows.length === 213, `ZA 213 municipalities, got ${zaRows.length}`);
  // Spot checks of the vertex vote
  const zaOf = (n) => zaRows.find((r) => r.name === n)?.region;
  assert(zaOf('City of Johannesburg') === 'GP' && zaOf('eThekwini') === 'KZN' && zaOf('City of Cape Town') === 'WC' && zaOf('Polokwane') === 'LP', 'ZA spot checks');
  const keOf = (n) => keRows.find((r) => r.name === n)?.region;
  assert(keOf('Kisumu Central') === '17' && keOf('Westlands') === '30' && keOf('Malindi') === '14', 'KE spot checks');

  // ---------- Languages (CLDR) ----------
  const core = await npmPackage(NPM.cldrCore);
  const ti = json(join(core, 'supplemental/territoryInfo.json')).supplemental.territoryInfo;
  const countrySet = new Set(countries.map((c) => c[0]));
  const territories = {};
  const tags = new Set(['en', 'fr', 'pt', 'ar', 'pcm', 'ha', 'yo', 'ig', 'sw', 'tw', 'ak', 'bin', 'urh', 'dag', 'luo', 'ee', 'ff', 'fuv']);
  for (const [cc, info] of Object.entries(ti)) {
    if (!countrySet.has(cc) || !info.languagePopulation) continue;
    const entries = Object.entries(info.languagePopulation);
    const bases = new Set(entries.map(([k]) => k).filter((k) => !k.includes('_')));
    const list = [];
    for (const [raw, v] of entries) {
      let tag = raw;
      const m = /^([a-z]{2,3})_([A-Z][a-z]{3})$/.exec(raw);
      if (m) {
        if (bases.has(m[1])) continue; // script variant of a language already listed
        tag = `${m[1]}-${m[2]}`;
      } else if (raw.includes('_')) tag = raw.replace('_', '-');
      const pct = Number(v._populationPercent ?? 0);
      const st = v._officialStatus;
      if (pct <= 0 && !st) continue;
      const flag = st === 'official' || st === 'de_facto_official' ? 'o' : st === 'official_regional' ? 'r' : '';
      list.push([tag, pct, flag]);
      tags.add(tag);
    }
    list.sort((a, b) => b[1] - a[1]);
    territories[cc] = list.map(([t, p, f]) => `${t}:${+p.toPrecision(3)}${f ? `:${f}` : ''}`).join('|');
  }
  assert(Object.keys(territories).length > 240, 'CLDR covers nearly every country');

  // Names: English from CLDR en; native from each language's own CLDR locale when there is one.
  const namesPkg = await npmPackage(NPM.cldrNames, ['package/main/*/languages.json']);
  const main = join(namesPkg, 'main');
  const enNames = json(join(main, 'en/languages.json')).main.en.localeDisplayNames.languages;
  const locales = new Set(readdirSync(main));
  const names = {};
  for (const tag of [...tags].sort()) {
    const en = enNames[tag] ?? enNames[tag.replace(/-.*/, '')];
    if (!en) continue; // no CLDR name: src/geo/languages.ts names curated tags itself
    let native = '';
    for (const loc of [tag, tag.replace(/-.*/, '')]) {
      if (!locales.has(loc)) continue;
      const own = json(join(main, loc, 'languages.json')).main[loc].localeDisplayNames.languages;
      native = own[tag] ?? own[tag.replace(/-.*/, '')] ?? '';
      if (native) break;
    }
    names[tag] = native && native !== en ? [en, native] : [en];
  }

  // ---------- Write ----------
  const manifest = {
    generatedBy: 'scripts/geo/build.mjs',
    inputs: { npm: Object.fromEntries(Object.values(NPM).map(([n, v]) => [n, v])), github: GH, sha256: hashes },
    counts: {
      countries: countries.length,
      subdivisionsFirstLevel: Object.values(regions).reduce((s, l) => s + l.length, 0),
      countriesWithSubdivisions: Object.keys(regions).length,
      NG: { states: nRegions('NG'), lgas: ng.length },
      KE: { counties: nRegions('KE'), subCounties: keRows.length },
      GH: { regions: nRegions('GH'), districts: ghRows.length },
      ZA: { provinces: nRegions('ZA'), municipalities: zaRows.length },
      languageTerritories: Object.keys(territories).length,
      languageNames: Object.keys(names).length,
    },
  };
  console.log(JSON.stringify(manifest.counts, null, 1));
  if (CHECK_ONLY) return;

  mkdirSync(join(OUT, 'areas'), { recursive: true });
  const write = (f, d) => {
    const s = JSON.stringify(d);
    writeFileSync(join(OUT, f), `${s}\n`);
    console.log(`${f}: ${(s.length / 1024).toFixed(1)} KB`);
  };
  // [code, English name, native name ('' when the same), calling code, currency, aliases ';'-joined]
  write('countries.json', countries);
  write('regions.json', packedRegions);
  write('languages.json', { territories, names });
  write('areas/NG.json', packAreas(ng));
  write('areas/KE.json', packAreas(keRows.map(({ region, name, lat, lon }) => ({ region, name, lat, lon }))));
  write('areas/GH.json', packAreas(ghRows));
  write('areas/ZA.json', packAreas(zaRows.map(({ region, name, lat, lon }) => ({ region, name, lat, lon }))));
  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
