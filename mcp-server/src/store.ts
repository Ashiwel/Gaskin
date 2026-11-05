/**
 * The Gaskin data file on disk: gaskin-data.json in the data folder.
 *
 * Accepts either a bare DemoState or the app's backup wrapper
 * ({ app: 'gaskin', schema, exportedAt, state }) and writes back in the same
 * shape. Writes are atomic (temp file + rename) and the previous file is kept
 * as a timestamped backup in backups/. The file is re-read whenever it
 * changes on disk, so the app and the assistant can share it.
 *
 * The private section (top-level key `mcpPrivate`) holds the secret that makes
 * mother tokens stable. It never leaves this process: no tool returns it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoState, Mother } from '../../src/types';

export const DATA_FILE = 'gaskin-data.json';
export const AUDIT_FILE = 'gaskin-assistant-audit.log';
export const BACKUP_DIR = 'backups';
export const PRIVATE_SIDECAR = '.gaskin-assistant-private.json';
const MAX_BACKUPS = 200;

export interface PrivateSection {
  tokenSecret: string;
  /** motherId -> token, kept so a token never changes once given out */
  tokens: Record<string, string>;
}

/** Fields the app may add beside DemoState (AppState extends it); read and written untouched. */
export type GaskinState = DemoState & {
  settings?: Record<string, unknown>;
  lastChanges?: Record<string, { diff: unknown; at: string; version: number; cause: string }>;
  readInbound?: Record<string, string>;
  [k: string]: unknown;
};

/**
 * The three shapes Gaskin writes: the storage module's envelope
 * { app, format, savedAt, data }, the Settings export { app, schema, exportedAt, state },
 * and a bare state. The server writes back in whichever shape it found.
 */
type FileShape = { wrapped: true; key: 'data' | 'state'; outer: Record<string, unknown> } | { wrapped: false };

export class DataStore {
  readonly dir: string;
  readonly file: string;
  private state: GaskinState | null = null;
  private shape: FileShape = { wrapped: false };
  private priv: PrivateSection | null = null;
  private loadedMtime = 0;
  private loadedSize = -1;
  private watcher: fs.FSWatcher | null = null;
  private lastError: string | null = null;
  /** Called after the file changed on disk and was reloaded */
  onReload?: () => void;

  constructor(dir: string, fileName: string = DATA_FILE) {
    this.dir = dir;
    this.file = path.join(dir, fileName);
  }

  exists(): boolean {
    return fs.existsSync(this.file);
  }

  error(): string | null {
    return this.lastError;
  }

  /** Create the data file from a starting state if there is none (used for demo data). Never overwrites. */
  createIfMissing(make: () => DemoState): boolean {
    if (this.exists()) return false;
    fs.mkdirSync(this.dir, { recursive: true });
    this.shape = { wrapped: false };
    this.state = make() as GaskinState;
    this.priv = null;
    this.writeAtomic();
    return true;
  }

  /** Current state, re-read from disk if the file changed since the last read. */
  get(): GaskinState | null {
    this.refresh();
    return this.state;
  }

  private refresh(): void {
    let st: fs.Stats;
    try {
      st = fs.statSync(this.file);
    } catch {
      this.state = null;
      this.lastError = null;
      return;
    }
    if (this.state && st.mtimeMs === this.loadedMtime && st.size === this.loadedSize) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, unknown>;
      const { state, shape, priv } = parseFile(raw);
      this.state = state;
      this.shape = shape;
      this.priv = priv ?? this.priv ?? readSidecar(this.dir);
      this.loadedMtime = st.mtimeMs;
      this.loadedSize = st.size;
      this.lastError = null;
    } catch (e) {
      // A half-written file from another program: keep the last good copy and try again next call.
      this.lastError = `Could not read ${path.basename(this.file)}: ${(e as Error).message}`;
    }
  }

  /** Watch the folder (renames from atomic writes break a watch on the file itself). */
  watch(): void {
    if (this.watcher) return;
    try {
      let t: NodeJS.Timeout | undefined;
      this.watcher = fs.watch(this.dir, { persistent: false }, (_ev, name) => {
        if (name && String(name) !== path.basename(this.file)) return;
        clearTimeout(t);
        t = setTimeout(() => {
          const before = this.loadedMtime;
          this.refresh();
          if (this.loadedMtime !== before) this.onReload?.();
        }, 150);
      });
    } catch {
      /* folder not watchable (some USB file systems): every call still re-checks the file */
    }
  }

  close(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  // ---------- Tokens ----------

  private privateSection(): PrivateSection {
    if (!this.priv) this.priv = { tokenSecret: crypto.randomBytes(16).toString('hex'), tokens: {} };
    return this.priv;
  }

  /**
   * Stable, short, non-reversible token per mother (M-7F3A). Derived from a
   * secret kept in the private section, and remembered once issued.
   * Returns true in `created` when a new token had to be saved.
   */
  tokensFor(mothers: Mother[]): { byId: Map<string, string>; byToken: Map<string, string>; created: boolean } {
    const p = this.privateSection();
    let created = false;
    const used = new Set(Object.values(p.tokens));
    for (const m of mothers) {
      if (p.tokens[m.id]) continue;
      const h = crypto.createHmac('sha256', p.tokenSecret).update(m.id).digest('hex').toUpperCase();
      let len = 4;
      let tok = `M-${h.slice(0, len)}`;
      while (used.has(tok) && len < h.length) tok = `M-${h.slice(0, ++len)}`;
      p.tokens[m.id] = tok;
      used.add(tok);
      created = true;
    }
    const byId = new Map<string, string>();
    const byToken = new Map<string, string>();
    for (const m of mothers) {
      byId.set(m.id, p.tokens[m.id]);
      byToken.set(p.tokens[m.id].toUpperCase(), m.id);
    }
    return { byId, byToken, created };
  }

  /** Save the private section only (first run, new mothers), without touching anything else. */
  persistPrivate(): void {
    if (!this.state) return;
    this.writeAtomic();
  }

  // ---------- Writing ----------

  /**
   * Apply a change to the latest state on disk and write it back atomically.
   * Re-reads first, so a change the app saved a moment ago is not lost.
   */
  update(fn: (s: GaskinState) => GaskinState): GaskinState {
    this.refresh();
    if (!this.state) throw new Error(`No ${path.basename(this.file)} in ${this.dir}`);
    this.state = fn(this.state);
    this.writeAtomic();
    return this.state;
  }

  private writeAtomic(): void {
    if (!this.state) return;
    fs.mkdirSync(this.dir, { recursive: true });
    const priv = this.privateSection();
    const body =
      this.shape.wrapped
        ? { ...this.shape.outer, ...('savedAt' in this.shape.outer ? { savedAt: new Date().toISOString() } : {}), [this.shape.key]: this.state, mcpPrivate: priv }
        : { ...this.state, mcpPrivate: priv };
    const text = JSON.stringify(body, null, 2);
    if (fs.existsSync(this.file)) this.backup();
    const tmp = path.join(this.dir, `.${path.basename(this.file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, text);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.file);
    writeSidecar(this.dir, priv);
    const st = fs.statSync(this.file);
    this.loadedMtime = st.mtimeMs;
    this.loadedSize = st.size;
  }

  private backup(): void {
    const dir = path.join(this.dir, BACKUP_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let name = `gaskin-data-${stamp}.json`;
    for (let i = 1; fs.existsSync(path.join(dir, name)); i++) name = `gaskin-data-${stamp}-${i}.json`;
    fs.copyFileSync(this.file, path.join(dir, name));
    // Keep the newest backups so a USB stick does not fill up; never touches gaskin-data.json itself.
    const all = fs
      .readdirSync(dir)
      .filter((f) => /^gaskin-data-.*\.json$/.test(f))
      .sort();
    for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) fs.rmSync(path.join(dir, old), { force: true });
  }

  /** Append one line to the audit log: when, which tool, which mother token, outcome. Never content. */
  audit(entry: { tool: string; mother?: string; outcome: string; deidentified: boolean }): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const line = JSON.stringify({ at: new Date().toISOString(), tool: entry.tool, mother: entry.mother ?? null, outcome: entry.outcome, deidentified: entry.deidentified });
      fs.appendFileSync(path.join(this.dir, AUDIT_FILE), line + '\n');
    } catch {
      /* read-only folder: the tool still answers */
    }
  }
}

function parseFile(raw: Record<string, unknown>): { state: GaskinState; shape: FileShape; priv: PrivateSection | null } {
  const priv = isPrivate(raw.mcpPrivate) ? (raw.mcpPrivate as PrivateSection) : null;
  for (const key of ['data', 'state'] as const) {
    const inner = raw?.[key] as DemoState | undefined;
    if (inner && typeof inner === 'object' && Array.isArray(inner.mothers)) {
      const { [key]: _s, mcpPrivate: _p, ...outer } = raw;
      void _s;
      void _p;
      return { state: inner as GaskinState, shape: { wrapped: true, key, outer }, priv };
    }
  }
  if (Array.isArray((raw as unknown as DemoState).mothers)) {
    const { mcpPrivate: _p, ...state } = raw;
    void _p;
    return { state: state as unknown as GaskinState, shape: { wrapped: false }, priv };
  }
  throw new Error('this is not a Gaskin data file (no mothers list)');
}

function isPrivate(x: unknown): boolean {
  return !!x && typeof x === 'object' && typeof (x as PrivateSection).tokenSecret === 'string' && typeof (x as PrivateSection).tokens === 'object';
}

function readSidecar(dir: string): PrivateSection | null {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(dir, PRIVATE_SIDECAR), 'utf8'));
    return isPrivate(p) ? p : null;
  } catch {
    return null;
  }
}

/** A copy of the private section beside the data file, so tokens survive if the app re-saves the file without it. */
function writeSidecar(dir: string, priv: PrivateSection): void {
  try {
    const file = path.join(dir, PRIVATE_SIDECAR);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(priv));
    fs.renameSync(tmp, file);
  } catch {
    /* best effort */
  }
}
