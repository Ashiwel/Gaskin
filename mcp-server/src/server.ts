/**
 * Gaskin MCP server entry point.
 *
 *   node dist/server.js                    stdio (Claude Desktop, Claude Code, any local MCP client)
 *   node dist/server.js /path/to/folder    same, with the data folder given
 *   node dist/server.js --http             Streamable HTTP on 127.0.0.1:8765 with an access key
 *
 * Logs go to stderr only: stdout belongs to the MCP protocol in stdio mode.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createSeedState } from '../../src/data';
import { readConfig, type Config } from './config';
import { Gaskin } from './gaskin';
import { DataStore } from './store';
import { createServer } from './tools';

const log = (...a: unknown[]) => console.error('[gaskin]', ...a);

export function setup(cfg: Config): { store: DataStore; gaskin: Gaskin } {
  try {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
  } catch {
    /* read-only or missing drive: tools explain what to do */
  }
  const store = new DataStore(cfg.dataDir, cfg.dataFile);
  if (cfg.demo && store.createIfMissing(() => ({ ...createSeedState(), _sample: true }) as never)) {
    log(`No data file found, so sample mothers were written to ${store.file}`);
  }
  store.watch();
  store.onReload = () => log('Data file changed on disk; reloaded.');
  const gaskin = new Gaskin(store, { deidentifyEnv: cfg.deidentifyEnv });
  return { store, gaskin };
}

async function runStdio(cfg: Config): Promise<void> {
  const { store, gaskin } = setup(cfg);
  const server = createServer(store, gaskin);
  await server.connect(new StdioServerTransport());
  log(`Ready (stdio). Data: ${store.file}${store.exists() ? '' : ' (not found yet)'}. De-identification: ${gaskin.headline().startsWith('De-identified') ? 'on' : 'OFF'}.`);
}

/** Short key: 10 characters from an alphabet with no look-alikes (0/O, 1/l). */
export function shortKey(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/** A bind address other than the loopback interface exposes the connector to the network */
export function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}

/** Problems that stop --http from starting; empty when safe. */
export function httpStartProblems(cfg: Config): string[] {
  const p: string[] = [];
  if (!isLoopback(cfg.host)) {
    if (!cfg.httpToken || cfg.httpToken.length < 24) p.push(`--host ${cfg.host} opens the connector to the network. Set GASKIN_HTTP_TOKEN to a random value of at least 24 characters first.`);
    if (!cfg.allowedHosts.length) p.push(`--host ${cfg.host} needs GASKIN_ALLOWED_HOSTS set to the names clients will use.`);
  }
  if (cfg.allowedHosts.includes('*')) p.push('GASKIN_ALLOWED_HOSTS=* switches off the DNS-rebinding guard. List the host names instead.');
  if (cfg.httpToken && cfg.httpToken.length < 10) p.push('GASKIN_HTTP_TOKEN is shorter than 10 characters.');
  return p;
}

async function runHttp(cfg: Config): Promise<void> {
  const problems = httpStartProblems(cfg);
  if (problems.length) throw new Error(problems.join(' '));
  const { store, gaskin } = setup(cfg);
  const key = cfg.httpToken ?? shortKey();
  const allowedHosts = new Set(cfg.allowedHosts.map((h) => h.toLowerCase()));
  const addLocal = (port: number) => ['127.0.0.1', 'localhost', '[::1]'].forEach((h) => allowedHosts.add(`${h}:${port}`));
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const deny = (res: http.ServerResponse, code: number, msg: string) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: msg }, id: null }));
  };

  const srv = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Gaskin connector is running. Point your AI assistant at /mcp with the access key.\n');
        return;
      }
      if (url.pathname !== '/mcp') return deny(res, 404, 'Not found. The connector address ends in /mcp.');
      // DNS-rebinding guard: only our own host names (plus any tunnel or hub host the facility allowed).
      const host = (req.headers.host ?? '').toLowerCase();
      if (!allowedHosts.has(host)) return deny(res, 403, `Host ${host} is not allowed. Add it to GASKIN_ALLOWED_HOSTS.`);
      // A browser page on another site must not drive the connector (CSRF / DNS rebinding with a guessed key)
      const origin = req.headers.origin;
      if (origin && !/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(origin) && !cfg.allowedHosts.some((h) => origin.toLowerCase().endsWith(`//${h.toLowerCase()}`)))
        return deny(res, 403, 'Requests from web pages on other sites are not allowed.');
      const auth = req.headers.authorization ?? '';
      const given = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (url.searchParams.get('key') ?? '');
      if (!safeEqual(given, key)) return deny(res, 401, 'Missing or wrong access key.');

      const sid = req.headers['mcp-session-id'];
      const sidStr = Array.isArray(sid) ? sid[0] : sid;
      if (req.method === 'POST') {
        const body = await readJson(req);
        let transport = sidStr ? sessions.get(sidStr) : undefined;
        if (!transport) {
          if (sidStr || !isInitializeRequest(body)) return deny(res, 400, 'No valid session. Start with an initialize request.');
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, transport!);
            },
          });
          transport.onclose = () => {
            if (transport!.sessionId) sessions.delete(transport!.sessionId);
          };
          await createServer(store, gaskin).connect(transport);
        }
        await transport.handleRequest(req, res, body);
        return;
      }
      if (req.method === 'GET' || req.method === 'DELETE') {
        const transport = sidStr ? sessions.get(sidStr) : undefined;
        if (!transport) return deny(res, 400, 'No valid session.');
        await transport.handleRequest(req, res);
        return;
      }
      deny(res, 405, 'Method not allowed.');
    } catch (e) {
      log('HTTP error', e);
      if (!res.headersSent) deny(res, 500, 'Internal error');
    }
  });

  await new Promise<void>((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(cfg.port, cfg.host, resolve);
  });
  const port = (srv.address() as { port: number }).port;
  addLocal(port);
  if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') allowedHosts.add(`${cfg.host}:${port}`.toLowerCase());
  const shown = cfg.host === '0.0.0.0' || cfg.host === '::' ? 'localhost' : cfg.host;
  const base = `http://${shown}:${port}/mcp`;
  log('Gaskin connector (HTTP) is running.');
  log(`  Data:     ${store.file}${store.exists() ? '' : ' (not found yet)'}`);
  log(`  Address:  ${base}?key=${key}`);
  log(`  Or send the header  Authorization: Bearer ${key}  to ${base}`);
  log('  The key in the address is a password: do not paste it into chats, screenshots or shared notes.');
  log('  This address only works on this computer. Cloud assistants (ChatGPT, claude.ai) cannot reach it without a tunnel or a facility hub.');
  // Also on stdout, so a launcher or the app can read it.
  console.log(JSON.stringify({ gaskin: 'http', url: `${base}?key=${key}`, endpoint: base, key }));
}

function safeEqual(a: string, b: string): boolean {
  // Compare digests so the comparison takes the same time whatever the lengths
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y) && a.length === b.length;
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error('Request too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.error(`Gaskin MCP server
Usage: node server.js [dataFolder] [--http] [--port 8765] [--host 127.0.0.1] [--demo]
Env:   GASKIN_DATA_DIR, GASKIN_DEIDENTIFY=false, GASKIN_DEMO=true, GASKIN_HTTP_TOKEN, GASKIN_ALLOWED_HOSTS`);
    return;
  }
  const cfg = readConfig(argv);
  if (cfg.http) await runHttp(cfg);
  else await runStdio(cfg);
}

// Run when executed directly (the bundle), not when imported by tests.
const entry = process.argv[1] ?? '';
if (/server\.(c?js|ts)$/.test(entry)) {
  main().catch((e) => {
    log('Fatal:', e);
    process.exit(1);
  });
}
