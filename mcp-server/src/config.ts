/**
 * Runtime configuration from the command line and environment.
 *
 *   node dist/server.js [dataFolder] [--data <folder>] [--http] [--port 8765] [--host 127.0.0.1] [--demo]
 *
 * Environment: GASKIN_DATA_DIR, GASKIN_DEIDENTIFY (true|false), GASKIN_DEMO (true|false),
 * GASKIN_HTTP_TOKEN (fixed key for --http), GASKIN_ALLOWED_HOSTS (comma list, for a tunnel or hub).
 */
import os from 'node:os';
import path from 'node:path';

export interface Config {
  dataDir: string;
  /** File name inside dataDir; gaskin-data.json unless a .json file path was given */
  dataFile: string;
  /** undefined: no preference from env/CLI (settings in the data file decide, default on) */
  deidentifyEnv: boolean | undefined;
  demo: boolean;
  http: boolean;
  port: number;
  host: string;
  httpToken?: string;
  allowedHosts: string[];
}

function flag(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  // Claude Desktop passes an unfilled ${user_config.x} through literally; treat that as "not set".
  if (!s || s.startsWith('${')) return undefined;
  if (['false', '0', 'off', 'no'].includes(s)) return false;
  if (['true', '1', 'on', 'yes'].includes(s)) return true;
  return undefined;
}

function folder(v: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!v) return undefined;
  let s = v.trim();
  // Expand the MCPB folder variables ourselves in case a host passes them through unexpanded.
  const home = env.HOME || env.USERPROFILE || os.homedir();
  s = s
    .replace(/\$\{HOME\}/g, home)
    .replace(/\$\{DOCUMENTS\}/g, path.join(home, 'Documents'))
    .replace(/\$\{DESKTOP\}/g, path.join(home, 'Desktop'))
    .replace(/\$\{DOWNLOADS\}/g, path.join(home, 'Downloads'))
    .replace(/\$\{(?:pathSeparator|\/)\}/g, path.sep);
  // An unfilled ${user_config.x} means "not set".
  if (!s || s.includes('${')) return undefined;
  if (s === '~' || s.startsWith('~/')) s = path.join(home, s.slice(1));
  return s;
}

export function readConfig(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env, runDir = defaultRunDir()): Config {
  let dataArg: string | undefined;
  let http = false;
  let demo: boolean | undefined;
  let port = 8765;
  let host = '127.0.0.1';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--http') http = true;
    else if (a === '--demo') demo = true;
    else if (a === '--data' || a === '--data-dir') dataArg = argv[++i];
    else if (a === '--port') {
      const n = Number(argv[++i]);
      if (Number.isInteger(n) && n >= 0 && n < 65536) port = n;
    }
    else if (a === '--host') host = argv[++i] || host;
    else if (!a.startsWith('--') && !dataArg) dataArg = a;
  }
  let dataDir = path.resolve(folder(dataArg, env) ?? folder(env.GASKIN_DATA_DIR, env) ?? runDir);
  let dataFile = 'gaskin-data.json';
  // A path to a .json file (e.g. an app backup) is accepted too: its folder is the data folder.
  if (/\.json$/i.test(dataDir)) {
    dataFile = path.basename(dataDir);
    dataDir = path.dirname(dataDir);
  }
  return {
    dataDir,
    dataFile,
    deidentifyEnv: flag(env.GASKIN_DEIDENTIFY),
    demo: demo ?? flag(env.GASKIN_DEMO) ?? false,
    http,
    port,
    host,
    httpToken: env.GASKIN_HTTP_TOKEN?.trim() || undefined,
    allowedHosts: (env.GASKIN_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * The folder the server runs from, so a copy on a USB stick next to the app
 * finds gaskin-data.json beside it. When bundled, the script sits in dist/, so
 * use its parent if dist/ itself holds no data file.
 */
function defaultRunDir(): string {
  const script = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : process.cwd();
  return path.basename(script) === 'dist' ? path.dirname(script) : script;
}
