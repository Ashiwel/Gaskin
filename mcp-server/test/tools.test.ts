import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DemoState } from '../../src/types';
import { AUDIT_FILE, BACKUP_DIR, DATA_FILE } from '../src/store';
import { DEID_OFF_LINE, DEID_ON_LINE, relativiseShortDates } from '../src/gaskin';
import { connect, forbiddenFor, leaks, startingState, tempDir, writeData } from './helpers';

const READ_TOOLS = ['gaskin_whoami', 'gaskin_list_caseload', 'gaskin_list_alerts'] as const;

let dir: string;
let seed: DemoState;
let conn: Awaited<ReturnType<typeof connect>>;

beforeEach(async () => {
  dir = tempDir();
  seed = startingState();
  writeData(dir, seed);
  conn = await connect(dir);
});

afterEach(async () => {
  await conn.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const auditLines = () => {
  const f = path.join(dir, AUDIT_FILE);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : [];
};

/** A pregnant mother with no blood-pressure alert yet, as the assistant sees her. */
async function pregnantWithoutBpAlert(): Promise<string> {
  const all = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 100 });
  for (const row of all.json.mothers as Array<{ token: string; stage: string }>) {
    if (!row.stage.startsWith('pregnant')) continue;
    const plan = await conn.call('gaskin_get_care_plan', { token: row.token });
    const ids = (plan.json.alerts as Array<{ id: string }>).map((a) => a.id);
    if (!ids.some((id) => /hypertension|eclampsia/.test(id))) return row.token;
  }
  throw new Error('no suitable pregnant mother in the data');
}

describe('tool list', () => {
  it('exposes exactly the seven Gaskin tools, none of them destructive', async () => {
    const { tools } = await conn.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['gaskin_draft_message', 'gaskin_explain_rule', 'gaskin_get_care_plan', 'gaskin_list_alerts', 'gaskin_list_caseload', 'gaskin_record_observation', 'gaskin_whoami'].sort(),
    );
    for (const t of tools) {
      expect(t.name).not.toMatch(/delete|remove|dismiss|suppress|send/);
      expect(t.annotations?.destructiveHint ?? false).toBe(false);
    }
  });
});

describe('de-identified by default', () => {
  it('uses the seed (or a fixture) with mothers in it', () => {
    expect(seed.mothers.length).toBeGreaterThan(1);
  });

  it('no seeded name, phone, community or exact date in any tool response', async () => {
    const forbidden = forbiddenFor(seed);
    const responses: Array<{ tool: string; text: string }> = [];
    for (const t of READ_TOOLS) responses.push({ tool: t, text: (await conn.call(t, { scope: 'all', limit: 100 })).text });
    const all = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 100 });
    const rows = all.json.mothers as Array<{ token: string }>;
    expect(rows.length).toBe(seed.mothers.length);
    for (const { token } of rows) {
      const plan = await conn.call('gaskin_get_care_plan', { token, includeMotherText: true });
      responses.push({ tool: `gaskin_get_care_plan ${token}`, text: plan.text });
      responses.push({ tool: `gaskin_draft_message ${token}`, text: (await conn.call('gaskin_draft_message', { token })).text });
      const items = plan.json.items as Array<{ id: string }>;
      for (const id of [items[0]?.id, ...(plan.json.alerts as Array<{ id: string }>).map((a) => a.id)].filter(Boolean)) {
        responses.push({ tool: `gaskin_explain_rule ${token} ${id}`, text: (await conn.call('gaskin_explain_rule', { token, itemId: id })).text });
      }
    }
    const problems: string[] = [];
    for (const r of responses) {
      expect(r.text.split('\n')[0]).toBe(DEID_ON_LINE);
      const hit = leaks(r.text, forbidden);
      if (hit.length) problems.push(`${r.tool}: ${hit.join(', ')}`);
      expect(r.text).not.toMatch(/"(phone|community|region|dob)":/);
      expect(r.text).not.toMatch(/"name": "(?!\[)/);
    }
    expect(problems).toEqual([]);
    // About 140 tool calls, each building a care plan: give it room on a slow or busy machine.
  }, 60_000);

  it('tokens look like M-7F3A and stay the same across restarts', async () => {
    const a = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 100 });
    const tokensA = (a.json.mothers as Array<{ token: string }>).map((m) => m.token).sort();
    for (const t of tokensA) expect(t).toMatch(/^M-[0-9A-F]{4,}$/);
    expect(new Set(tokensA).size).toBe(tokensA.length);
    await conn.close();
    conn = await connect(dir);
    const b = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 100 });
    expect((b.json.mothers as Array<{ token: string }>).map((m) => m.token).sort()).toEqual(tokensA);
    // The secret and the token map stay in the file's private section, never in a response.
    const raw = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8'));
    expect(raw.mcpPrivate.tokenSecret).toMatch(/^[0-9a-f]{32}$/);
    expect(b.text).not.toContain(raw.mcpPrivate.tokenSecret);
    expect(b.text).not.toMatch(/m-ng-|m-ke-|m-gh-|m-fx-/);
  });

  it('shows names when de-identification is switched off in settings, and says so first', async () => {
    writeData(dir, { ...seed, settings: { deidentify: false } });
    const r = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 100 });
    expect(r.firstLine).toBe(DEID_OFF_LINE);
    expect(r.text).toContain(seed.mothers[0].name);
    const who = await conn.call('gaskin_whoami');
    expect(who.firstLine).toBe(DEID_OFF_LINE);
    expect(who.json.deidentification.on).toBe(false);
  });

  it('shows names when GASKIN_DEIDENTIFY=false, and says so first', async () => {
    await conn.close();
    conn = await connect(dir, false);
    const r = await conn.call('gaskin_whoami');
    expect(r.firstLine).toBe(DEID_OFF_LINE);
    expect(r.json.deidentification.setting).toMatch(/GASKIN_DEIDENTIFY/);
  });
});

describe('record_observation', () => {
  it('previews only without confirmedByWorker', async () => {
    const token = await pregnantWithoutBpAlert();
    const before = fs.readFileSync(path.join(dir, DATA_FILE), 'utf8');
    const r = await conn.call('gaskin_record_observation', { token, kind: 'vitals', vitals: { systolic: 150, diastolic: 100 } });
    expect(r.isError).toBe(false);
    expect(r.json.saved).toBe(false);
    expect(r.json.status).toMatch(/PREVIEW ONLY/);
    expect(r.json.planChanges.newAlerts.map((a: { id: string }) => a.id)).toContain('alert.hypertension');
    const after = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8'));
    const was = JSON.parse(before);
    const count = (s: DemoState) => s.mothers.reduce((n, m) => n + m.events.length, 0);
    expect(count(after)).toBe(count(was));
    expect(fs.existsSync(path.join(dir, BACKUP_DIR)) ? fs.readdirSync(path.join(dir, BACKUP_DIR)).length : 0).toBeLessThanOrEqual(1);
  });

  it('with confirmation, writes the event and returns the alert for a raised BP', async () => {
    const token = await pregnantWithoutBpAlert();
    const r = await conn.call('gaskin_record_observation', { token, kind: 'vitals', vitals: { systolic: 150, diastolic: 100 }, confirmedByWorker: true });
    expect(r.json.saved).toBe(true);
    const alert = (r.json.planChanges.newAlerts as Array<{ id: string; level: string; title: string; doNow: string }>).find((a) => a.id === 'alert.hypertension');
    expect(alert).toBeTruthy();
    expect(alert!.level).toBe('urgent');
    expect(alert!.title).toMatch(/blood pressure/i);
    expect(r.json.status).toMatch(/new alert/);
    // On disk: the event is there and the plan version moved on.
    const disk = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8')) as DemoState;
    const found = disk.mothers.flatMap((m) => m.events.map((e) => ({ m, e }))).filter(({ e }) => e.kind === 'vitals' && e.systolic === 150 && e.diastolic === 100 && e.id.startsWith('ev_mcp_'));
    expect(found.length).toBe(1);
    expect(disk.planVersions[found[0].m.id].alertIds).toContain('alert.hypertension');
    // The plan now shows it, and list_alerts too.
    const plan = await conn.call('gaskin_get_care_plan', { token });
    expect((plan.json.alerts as Array<{ id: string }>).map((a) => a.id)).toContain('alert.hypertension');
    const alerts = await conn.call('gaskin_list_alerts', { scope: 'all' });
    expect((alerts.json.alerts as Array<{ token: string; id: string }>).some((a) => a.token === token && a.id === 'alert.hypertension')).toBe(true);
    // Still de-identified
    expect(leaks(r.text, forbiddenFor(seed))).toEqual([]);
  });

  it('rejects impossible readings instead of saving them', async () => {
    const token = await pregnantWithoutBpAlert();
    const r = await conn.call('gaskin_record_observation', { token, kind: 'vitals', vitals: { systolic: 90, diastolic: 120 }, confirmedByWorker: true });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/bottom number is higher/);
  });

  it('has no way to delete data, remove locked items or suppress alerts', async () => {
    const r = await conn.call('gaskin_record_observation', { token: 'M-0000', kind: 'vitals', vitals: { systolic: 120, diastolic: 80 }, confirmedByWorker: true });
    expect(r.isError).toBe(true);
    await expect(conn.client.callTool({ name: 'gaskin_delete_mother', arguments: {} })).resolves.toMatchObject({ isError: true });
  });
});

describe('audit log', () => {
  it('grows by one line per call, with tool and token but no content', async () => {
    expect(auditLines().length).toBe(0);
    await conn.call('gaskin_whoami');
    const list = await conn.call('gaskin_list_caseload', { scope: 'all', limit: 3 });
    const token = (list.json.mothers as Array<{ token: string }>)[0].token;
    await conn.call('gaskin_get_care_plan', { token });
    await conn.call('gaskin_get_care_plan', { token: 'not a token' });
    const lines = auditLines().map((l) => JSON.parse(l));
    expect(lines.length).toBe(4);
    expect(lines.map((l) => l.tool)).toEqual(['gaskin_whoami', 'gaskin_list_caseload', 'gaskin_get_care_plan', 'gaskin_get_care_plan']);
    expect(lines[2].mother).toBe(token);
    expect(lines[3].outcome).toBe('error');
    // prev: hash of the line before (tamper evidence, SEC-17), never content
    for (const l of lines) expect(Object.keys(l).sort()).toEqual(['at', 'deidentified', 'mother', 'outcome', 'prev', 'tool']);
    expect(leaks(fs.readFileSync(path.join(dir, AUDIT_FILE), 'utf8').replace(/"at":"[^"]+"/g, ''), forbiddenFor(seed))).toEqual([]);
  });
});

describe('atomic write', () => {
  it('keeps a timestamped backup of the previous file and leaves no temp files', async () => {
    const original = fs.readFileSync(path.join(dir, DATA_FILE), 'utf8');
    const token = await pregnantWithoutBpAlert();
    await conn.call('gaskin_record_observation', { token, kind: 'symptoms', symptoms: { codes: ['heartburn'] }, confirmedByWorker: true });
    const backups = fs.readdirSync(path.join(dir, BACKUP_DIR));
    expect(backups.length).toBeGreaterThanOrEqual(1);
    for (const b of backups) expect(b).toMatch(/^gaskin-data-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(-\d+)?\.json$/);
    // The newest backup is the file as it was just before the write.
    const newest = backups.sort().pop()!;
    const backedUp = JSON.parse(fs.readFileSync(path.join(dir, BACKUP_DIR, newest), 'utf8'));
    const orig = JSON.parse(original);
    expect(backedUp.mothers.reduce((n: number, m: { events: unknown[] }) => n + m.events.length, 0)).toBe(orig.mothers.reduce((n: number, m: { events: unknown[] }) => n + m.events.length, 0));
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    // The live file parses and has the new event.
    const live = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8'));
    expect(JSON.stringify(live)).toContain('heartburn');
  });

  it('picks up changes the app makes to the file', async () => {
    const a = await conn.call('gaskin_whoami');
    const n = a.json.caseload.allMothersInFile as number;
    writeData(dir, { ...seed, mothers: seed.mothers.slice(0, 1) });
    // Force a different mtime on fast file systems
    const later = new Date(Date.now() + 2000);
    fs.utimesSync(path.join(dir, DATA_FILE), later, later);
    const b = await conn.call('gaskin_whoami');
    expect(b.json.caseload.allMothersInFile).toBe(1);
    expect(n).toBe(seed.mothers.length);
  });

  it('reads and writes the app backup format ({ app, schema, state }) in place', async () => {
    writeData(dir, { app: 'gaskin', schema: 3, exportedAt: '2026-11-09T09:00:00Z', state: seed });
    const later = new Date(Date.now() + 3000);
    fs.utimesSync(path.join(dir, DATA_FILE), later, later);
    const token = await pregnantWithoutBpAlert();
    await conn.call('gaskin_record_observation', { token, kind: 'symptoms', symptoms: { codes: ['back_pain'] }, confirmedByWorker: true });
    const raw = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8'));
    expect(raw.app).toBe('gaskin');
    expect(raw.schema).toBe(3);
    expect(Array.isArray(raw.state.mothers)).toBe(true);
    expect(JSON.stringify(raw.state)).toContain('back_pain');
  });
});

describe('helpers', () => {
  it('turns engine short dates into relative ones', () => {
    expect(relativiseShortDates('Window day 3–7, from 12 Nov.', '2026-11-09T09:00:00Z', true)).toBe('Window day 3–7, from 3 days from now.');
    expect(relativiseShortDates('BP 150/100 on 2 Nov.', '2026-11-09T09:00:00Z', true)).toBe('BP 150/100 7 days ago.');
  });
});

describe('storage envelope', () => {
  it('reads and writes the folder-storage envelope ({ app, format, savedAt, data })', async () => {
    writeData(dir, { app: 'gaskin', format: 1, savedAt: '2026-11-09T09:00:00Z', data: seed });
    const later = new Date(Date.now() + 4000);
    fs.utimesSync(path.join(dir, DATA_FILE), later, later);
    const token = await pregnantWithoutBpAlert();
    await conn.call('gaskin_record_observation', { token, kind: 'symptoms', symptoms: { codes: ['leg_cramps'] }, confirmedByWorker: true });
    const raw = JSON.parse(fs.readFileSync(path.join(dir, DATA_FILE), 'utf8'));
    expect(raw.app).toBe('gaskin');
    expect(raw.format).toBe(1);
    expect(raw.savedAt).not.toBe('2026-11-09T09:00:00Z');
    expect(raw.state).toBeUndefined();
    expect(JSON.stringify(raw.data)).toContain('leg_cramps');
  });
});
