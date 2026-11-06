/**
 * Security tests for the MCP connector. IDs (SEC-nn) refer to docs/security-review.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DemoState } from '../../src/types';
import { AUDIT_FILE, BACKUP_DIR, DATA_FILE, DataStore, verifyAuditChain } from '../src/store';
import { httpStartProblems } from '../src/server';
import { readConfig } from '../src/config';
import { connect, forbiddenFor, leaks, startingState, tempDir, writeData } from './helpers';

let dir: string;
let seed: DemoState;

beforeEach(() => {
  dir = tempDir();
  seed = startingState();
  writeData(dir, seed);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const canLink = (() => {
  try {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-link-'));
    fs.symlinkSync(d, path.join(d, 'l'));
    fs.rmSync(d, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
})();

describe('data folder: links, size and atomic writes (SEC-15)', () => {
  it.skipIf(!canLink)('refuses a gaskin-data.json that is a link to a file elsewhere', async () => {
    const outside = tempDir();
    writeData(outside, seed);
    fs.rmSync(path.join(dir, DATA_FILE));
    fs.symlinkSync(path.join(outside, DATA_FILE), path.join(dir, DATA_FILE));
    const conn = await connect(dir);
    const r = await conn.call('gaskin_whoami');
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/not a plain file/);
    await conn.close();
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it.skipIf(!canLink)('never writes through a backups link to another folder', async () => {
    const outside = tempDir();
    fs.symlinkSync(outside, path.join(dir, BACKUP_DIR));
    const conn = await connect(dir);
    const rows = (await conn.call('gaskin_list_caseload', { scope: 'all', limit: 1 })).json.mothers as Array<{ token: string }>;
    const r = await conn.call('gaskin_record_observation', { token: rows[0].token, kind: 'symptoms', symptoms: { codes: ['heartburn'] }, confirmedByWorker: true });
    expect(r.isError).toBe(true);
    expect(fs.readdirSync(outside)).toEqual([]);
    await conn.close();
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('writes the token secret readable by its owner only (POSIX)', async () => {
    const conn = await connect(dir);
    await conn.call('gaskin_list_caseload', { scope: 'all', limit: 1 });
    await conn.close();
    const side = path.join(dir, '.gaskin-assistant-private.json');
    if (process.platform !== 'win32' && fs.existsSync(side)) expect(fs.statSync(side).mode & 0o077).toBe(0);
  });

  it('says plainly when the data file is encrypted, instead of failing obscurely', async () => {
    fs.writeFileSync(path.join(dir, DATA_FILE), JSON.stringify({ app: 'gaskin', format: 'gaskin-encrypted', v: 1, kdf: {}, cipher: {}, data: 'xx' }));
    const conn = await connect(dir);
    const r = await conn.call('gaskin_whoami');
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/encrypted with a passphrase/);
    await conn.close();
  });
});

describe('input validation on every tool (SEC-16)', () => {
  let conn: Awaited<ReturnType<typeof connect>>;
  beforeEach(async () => (conn = await connect(dir)));
  afterEach(async () => conn.close());

  it.each([
    ['a token with path characters', 'gaskin_get_care_plan', { token: '../../etc/passwd' }],
    ['a 200-character token', 'gaskin_get_care_plan', { token: 'M-'.padEnd(200, 'A') }],
    ['an infinite blood pressure', 'gaskin_record_observation', { token: 'M-0000', kind: 'vitals', vitals: { systolic: 1e309, diastolic: 80 } }],
    ['a screening score out of range', 'gaskin_record_observation', { token: 'M-0000', kind: 'screening', screening: { instrument: 'epds', score: 999 } }],
    ['an unknown symptom code', 'gaskin_record_observation', { token: 'M-0000', kind: 'symptoms', symptoms: { codes: ['rm -rf'] } }],
    ['a 600-character note', 'gaskin_record_observation', { token: 'M-0000', kind: 'symptoms', symptoms: { codes: ['heartburn'] }, note: 'x'.repeat(600) }],
    ['an unknown tool argument type', 'gaskin_list_caseload', { limit: 'all' }],
    ['a huge itemIds list', 'gaskin_draft_message', { token: 'M-0000', itemIds: Array.from({ length: 100 }, (_, i) => `i${i}`) }],
  ])('refuses %s', async (_label, tool, args) => {
    const r = await conn.call(tool, args as Record<string, unknown>);
    expect(r.isError).toBe(true);
  });

  it('confirmedByWorker false is a preview: nothing is written', async () => {
    const before = fs.readFileSync(path.join(dir, DATA_FILE), 'utf8');
    const rows = (await conn.call('gaskin_list_caseload', { scope: 'all', limit: 1 })).json.mothers as Array<{ token: string }>;
    const r = await conn.call('gaskin_record_observation', { token: rows[0].token, kind: 'symptoms', symptoms: { codes: ['heartburn'] }, confirmedByWorker: false });
    expect(r.json.saved).toBe(false);
    const after = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8')) as DemoState;
    const was = JSON.parse(before) as DemoState;
    expect(after.mothers.reduce((n, m) => n + m.events.length, 0)).toBe(was.mothers.reduce((n, m) => n + m.events.length, 0));
  });

  it('a note naming another mother is scrubbed before it is stored, and nothing leaks back', async () => {
    const rows = (await conn.call('gaskin_list_caseload', { scope: 'all', limit: 2 })).json.mothers as Array<{ token: string }>;
    const other = seed.mothers[3];
    const r = await conn.call('gaskin_record_observation', { token: rows[0].token, kind: 'symptoms', symptoms: { codes: ['heartburn'] }, note: `Came with ${other.name} from ${other.community}, phone 0803 555 0199.`, confirmedByWorker: true });
    expect(r.json.saved).toBe(true);
    expect(leaks(r.text, forbiddenFor(seed))).toEqual([]);
    const disk = fs.readFileSync(path.join(dir, DATA_FILE), 'utf8');
    const stored = (JSON.parse(disk) as DemoState).mothers.flatMap((m) => m.events).find((e) => e.id.startsWith('ev_mcp_'))!;
    expect(stored.note).not.toContain(other.name.split(' ')[0]);
    expect(stored.note).not.toContain('0803 555 0199');
  });
});

describe('audit log integrity (SEC-17)', () => {
  it('chains each line to the one before, so a deleted or edited line is detected', async () => {
    const conn = await connect(dir);
    for (let i = 0; i < 4; i++) await conn.call('gaskin_whoami');
    await conn.close();
    const file = path.join(dir, AUDIT_FILE);
    expect(verifyAuditChain(file)).toEqual([]);
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(JSON.parse(lines[0]).prev).toBe('genesis');
    fs.writeFileSync(file, [lines[0], lines[2], lines[3]].join('\n') + '\n');
    expect(verifyAuditChain(file)).toEqual([2]);
    // Still no content in any line
    for (const l of lines) expect(Object.keys(JSON.parse(l)).sort()).toEqual(['at', 'deidentified', 'mother', 'outcome', 'prev', 'tool']);
  });
});

describe('HTTP mode (SEC-18)', () => {
  it('starts on 127.0.0.1 with a generated key by default', () => {
    expect(httpStartProblems(readConfig(['--http'], {}))).toEqual([]);
  });

  it('refuses to open to the network without a long fixed token and named hosts, and refuses Host *', () => {
    expect(httpStartProblems(readConfig(['--http', '--host', '0.0.0.0'], {})).join(' ')).toMatch(/GASKIN_HTTP_TOKEN.*GASKIN_ALLOWED_HOSTS/);
    expect(httpStartProblems(readConfig(['--http', '--host', '0.0.0.0'], { GASKIN_HTTP_TOKEN: 'x'.repeat(32), GASKIN_ALLOWED_HOSTS: 'hub.example.org' }))).toEqual([]);
    expect(httpStartProblems(readConfig(['--http'], { GASKIN_ALLOWED_HOSTS: '*' })).join(' ')).toMatch(/DNS-rebinding/);
  });

  it('a DataStore on a missing folder reports nothing rather than throwing', () => {
    const s = new DataStore(path.join(dir, 'nope'));
    expect(s.get()).toBeNull();
  });
});
