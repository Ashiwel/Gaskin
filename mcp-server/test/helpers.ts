import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSeedState } from '../../src/data';
import type { DemoState, Mother } from '../../src/types';
import { Gaskin } from '../src/gaskin';
import { DataStore } from '../src/store';
import { createServer } from '../src/tools';

/** Seed state when src/data has mothers, otherwise a small fixture. */
export function startingState(): DemoState {
  const seed = createSeedState();
  if (seed.mothers.length) return seed;
  return fixtureState();
}

export function fixtureState(): DemoState {
  const mother = (over: Partial<Mother>): Mother => ({
    id: 'm-fx-1',
    name: 'Chiamaka Obi',
    age: 24,
    country: 'NG',
    region: 'Enugu',
    community: 'Ogui Nike',
    language: 'en',
    literacy: 'good',
    phone: { access: 'smartphone', number: '+234 803 555 0101', hasWhatsApp: true },
    incomeBand: 'low',
    gravida: 2,
    parity: 1,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [],
    allergies: [],
    genotype: 'AA',
    medications: [],
    pregnancy: { lmp: '2026-04-10', fetuses: 1 },
    children: [],
    practicesMentioned: [],
    assignedWorkerId: 'w-fx',
    facilityId: 'f-fx',
    enrolledAt: '2026-05-20',
    consent: { dataProcessing: true, messaging: true, recordedAt: '2026-05-20', recordedBy: 'w-fx' },
    events: [{ id: 'e1', kind: 'vitals', at: '2026-10-20T10:00:00Z', recordedBy: 'w-fx', systolic: 112, diastolic: 72 }],
    ...over,
  });
  return {
    clock: '2026-11-09T09:00:00.000Z',
    country: 'ALL',
    currentWorkerId: 'w-fx',
    mothers: [mother({}), mother({ id: 'm-fx-2', name: 'Halima Danjuma', community: 'Tudun Wada', region: 'Kano', phone: { access: 'feature', number: '+234 806 555 0199', hasWhatsApp: false } })],
    workers: [{ id: 'w-fx', name: 'Ngozi Okonkwo', role: 'midwife', facilityId: 'f-fx', country: 'NG', yearsExperience: 9 }],
    facilities: [{ id: 'f-fx', name: 'Ogui Primary Health Centre', type: 'phc', country: 'NG', region: 'Enugu' }],
    overrides: [],
    proposals: [],
    learnedRules: [],
    outbound: [],
    inbound: [],
    planVersions: {},
  };
}

export function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gaskin-mcp-test-'));
}

export function writeData(dir: string, state: unknown): string {
  const file = path.join(dir, 'gaskin-data.json');
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}

export async function connect(dir: string, deidentifyEnv?: boolean) {
  const store = new DataStore(dir);
  const gaskin = new Gaskin(store, { deidentifyEnv });
  const server = createServer(store, gaskin);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: Array<{ type: string; text: string }>; isError?: boolean };
    const text = r.content.map((c) => c.text).join('\n');
    const nl = text.indexOf('\n');
    let json: unknown = null;
    try {
      json = JSON.parse(text.slice(nl + 1));
    } catch {
      /* error text */
    }
    return { text, firstLine: text.slice(0, nl < 0 ? undefined : nl), json: json as Record<string, any>, isError: !!r.isError };
  };
  return { client, call, store, close: async () => { await client.close(); store.close(); } };
}

const GENERIC = new Set(
  'ward village street road market north south east west central new old area zone estate layout town city phase host community settlement municipal north-east lga district'.split(' '),
);

/** Strings from the seed that must never appear in a de-identified response. */
export function forbiddenFor(state: DemoState): Array<{ what: string; re: RegExp }> {
  const out: Array<{ what: string; re: RegExp }> = [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const word = (s: string, what: string) => out.push({ what, re: new RegExp(`(?<![\\p{L}\\p{N}])${esc(s)}(?![\\p{L}\\p{N}])`, 'u') });
  for (const m of state.mothers) {
    word(m.name, `name ${m.name}`);
    for (const p of m.name.split(/\s+/)) if (p.length >= 3) word(p, `name part ${p}`);
    for (const c of m.children) for (const p of c.name.split(/\s+/)) if (p.length >= 3) word(p, `child name ${p}`);
    if (m.phone?.number) {
      word(m.phone.number, `phone ${m.phone.number}`);
      out.push({ what: `phone digits ${m.phone.number}`, re: new RegExp(m.phone.number.replace(/\D/g, '').slice(-7)) });
    }
    if (m.community) {
      word(m.community, `community ${m.community}`);
      for (const w of m.community.split(/[\s,()/]+/)) {
        const c = w.replace(/[^\p{L}'-]/gu, '');
        if (c.length >= 4 && /^\p{Lu}/u.test(c) && !GENERIC.has(c.toLowerCase())) word(c, `community word ${c} (${m.community})`);
      }
    }
  }
  return out;
}

export const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/,
];

export function leaks(text: string, forbidden: Array<{ what: string; re: RegExp }>): string[] {
  const hits = forbidden.filter((f) => f.re.test(text)).map((f) => f.what);
  for (const d of DATE_PATTERNS) {
    const m = text.match(d);
    if (m) hits.push(`date ${m[0]}`);
  }
  return hits;
}
