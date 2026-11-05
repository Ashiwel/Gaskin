/**
 * End-to-end: spawn the built dist/server.js with plain node, talk to it with
 * the official SDK client over stdio, and over Streamable HTTP in --http mode.
 * Run `npm run build` first (npm test does not rebuild).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEID_ON_LINE } from '../src/gaskin';
import { forbiddenFor, leaks, startingState, tempDir, writeData } from './helpers';

const SERVER = path.resolve(__dirname, '..', 'dist', 'server.js');
const TOOLS = ['gaskin_draft_message', 'gaskin_explain_rule', 'gaskin_get_care_plan', 'gaskin_list_alerts', 'gaskin_list_caseload', 'gaskin_record_observation', 'gaskin_whoami'];

describe.skipIf(!fs.existsSync(SERVER))('dist/server.js over stdio', () => {
  let dir: string;
  let client: Client;
  beforeAll(async () => {
    dir = tempDir();
    writeData(dir, startingState());
    client = new Client({ name: 'smoke', version: '1' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER, dir], stderr: 'ignore', env: { PATH: process.env.PATH ?? '' } }));
  });
  afterAll(async () => {
    await client?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lists the tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    for (const t of tools) expect((t.description ?? '').length).toBeGreaterThan(40);
  });

  it('answers a caseload call de-identified', async () => {
    const r = (await client.callTool({ name: 'gaskin_list_caseload', arguments: { scope: 'all', limit: 5 } })) as { content: Array<{ text: string }> };
    const text = r.content[0].text;
    expect(text.split('\n')[0]).toBe(DEID_ON_LINE);
    expect(leaks(text, forbiddenFor(startingState()))).toEqual([]);
  });
});

describe.skipIf(!fs.existsSync(SERVER))('dist/server.js --http', () => {
  let dir: string;
  let proc: ChildProcess;
  let info: { url: string; endpoint: string; key: string };
  beforeAll(async () => {
    dir = tempDir();
    writeData(dir, startingState());
    proc = spawn(process.execPath, [SERVER, dir, '--http', '--port', '0'], { stdio: ['ignore', 'pipe', 'ignore'] });
    info = await new Promise((resolve, reject) => {
      let buf = '';
      proc.stdout!.on('data', (c: Buffer) => {
        buf += c.toString();
        const line = buf.split('\n').find((l) => l.startsWith('{'));
        if (line) resolve(JSON.parse(line));
      });
      proc.on('exit', (code) => reject(new Error(`server exited ${code}`)));
    });
  });
  afterAll(() => {
    proc?.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prints a localhost URL with a short key', () => {
    expect(info.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\?key=[a-z2-9]{10}$/);
  });

  it('refuses a request without the key', async () => {
    const res = await fetch(info.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(res.status).toBe(401);
  });

  it('serves the tools with the key', async () => {
    const client = new Client({ name: 'http-smoke', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(info.url)));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    const r = (await client.callTool({ name: 'gaskin_whoami', arguments: {} })) as { content: Array<{ text: string }> };
    expect(r.content[0].text.split('\n')[0]).toBe(DEID_ON_LINE);
    await client.close();
  });
});
