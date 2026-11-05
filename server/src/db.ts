/**
 * Storage for the hosted service. SQLite (better-sqlite3) by default: one
 * file, easy to back up and encrypt at the volume level. Postgres is
 * optional for larger deployments (DATABASE_URL=postgres://...).
 *
 * Both sit behind one small async interface so the rest of the server is
 * the same either way. SQL is written in the common subset; `?` placeholders
 * are rewritten to $1, $2 for Postgres.
 *
 * Model. The change log (`changes`) is the sync spine: every accepted write
 * appends one row with a monotonically increasing `seq`. Clients pull rows
 * after their cursor, filtered to the facilities they may see. Clinical
 * events are append-only and keyed by their own id; mothers, overrides,
 * proposals, rules and messages are last-writer-wins documents.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

export type Row = Record<string, unknown>;

export interface DB {
  readonly dialect: 'sqlite' | 'postgres';
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastId?: number }>;
  /** Run fn inside one transaction. SQLite serialises writers, so sync merges are atomic. */
  tx<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    worker_id TEXT,
    country TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_facilities (
    user_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    PRIMARY KEY (user_id, facility_id)
  )`,
  `CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    dhis2_org_unit TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mothers (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL,
    country TEXT NOT NULL,
    body TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT,
    deleted INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    mother_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    at TEXT NOT NULL,
    body TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS events_mother ON events (mother_id, at)`,
  `CREATE INDEX IF NOT EXISTS events_kind_at ON events (kind, at)`,
  `CREATE TABLE IF NOT EXISTS docs (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    mother_id TEXT,
    facility_id TEXT,
    body TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT,
    PRIMARY KEY (kind, id)
  )`,
  `CREATE TABLE IF NOT EXISTS changes (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    mother_id TEXT,
    facility_id TEXT,
    at TEXT NOT NULL,
    by_user TEXT,
    device_id TEXT,
    body TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS changes_facility ON changes (facility_id, seq)`,
  `CREATE TABLE IF NOT EXISTS applied_ops (
    op_id TEXT PRIMARY KEY,
    user_id TEXT,
    applied_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    mother_id TEXT NOT NULL,
    facility_id TEXT,
    channel TEXT NOT NULL,
    provider TEXT,
    provider_message_id TEXT,
    recipient_hash TEXT,
    status TEXT NOT NULL,
    reason TEXT,
    body TEXT,
    segments INTEGER,
    cost_local REAL,
    cost_usd REAL,
    currency TEXT,
    simulated INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_provider ON messages (provider, provider_message_id)`,
  `CREATE TABLE IF NOT EXISTS message_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    channel TEXT NOT NULL,
    country TEXT,
    units REAL,
    unit_label TEXT,
    cost_local REAL,
    cost_usd REAL,
    currency TEXT,
    source TEXT NOT NULL,
    at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    user_id TEXT,
    role TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    facility_id TEXT,
    ip_hash TEXT,
    outcome TEXT NOT NULL,
    detail TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS audit_at ON audit (at)`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

function pgSchema(sql: string): string {
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION');
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ---------- SQLite ----------

type SqliteDatabase = {
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    get(...p: unknown[]): unknown;
    run(...p: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    reader: boolean;
  };
  exec(sql: string): void;
  pragma(s: string): unknown;
  close(): void;
};

function openSqlite(file: string): DB {
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3') as new (f: string) => SqliteDatabase;
  if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true });
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');
  raw.pragma('secure_delete = ON');
  for (const s of SCHEMA) raw.exec(s);
  const stmts = new Map<string, ReturnType<SqliteDatabase['prepare']>>();
  const prep = (sql: string) => {
    let s = stmts.get(sql);
    if (!s) {
      s = raw.prepare(sql);
      stmts.set(sql, s);
    }
    return s;
  };
  // better-sqlite3 is synchronous; an async tx is safe because Node runs one
  // tx body at a time here (we queue them) and SQLite holds the write lock.
  let chain: Promise<unknown> = Promise.resolve();
  let depth = 0;
  const db: DB = {
    dialect: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return prep(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return prep(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      const r = prep(sql).run(...params);
      return { changes: r.changes, lastId: Number(r.lastInsertRowid) };
    },
    tx<T>(fn: (d: DB) => Promise<T>): Promise<T> {
      if (depth > 0) return fn(db);
      const next = chain.then(async () => {
        depth++;
        raw.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn(db);
          raw.exec('COMMIT');
          return out;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        } finally {
          depth--;
        }
      });
      chain = next.catch(() => undefined);
      return next;
    },
    async close() {
      raw.close();
    },
  };
  return db;
}

// ---------- Postgres (optional) ----------

type PgClient = { query(sql: string, params?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>; release(): void };
type PgPool = { query: PgClient['query']; connect(): Promise<PgClient>; end(): Promise<void> };

async function openPostgres(url: string): Promise<DB> {
  const require = createRequire(import.meta.url);
  let pg: { Pool: new (o: { connectionString: string }) => PgPool };
  try {
    pg = require('pg');
  } catch {
    throw new Error('DATABASE_URL is a Postgres URL but the "pg" package is not installed. Run npm install pg.');
  }
  const pool = new pg.Pool({ connectionString: url });
  for (const s of SCHEMA) await pool.query(pgSchema(s));
  const wrap = (q: PgClient['query'], inTx: boolean): DB => {
    const d: DB = {
      dialect: 'postgres',
      async all<T>(sql: string, params: unknown[] = []) {
        return (await q(toPg(sql), params)).rows as T[];
      },
      async get<T>(sql: string, params: unknown[] = []) {
        return (await q(toPg(sql), params)).rows[0] as T | undefined;
      },
      async run(sql: string, params: unknown[] = []) {
        let s = toPg(sql);
        const isInsert = /^\s*insert/i.test(s) && /\bchanges\b|\bmessage_costs\b|\baudit\b/.test(s) && !/returning/i.test(s);
        if (isInsert) s += ' RETURNING *';
        const r = await q(s, params);
        const first = r.rows[0] as { seq?: number; id?: number } | undefined;
        return { changes: r.rowCount ?? 0, lastId: first ? Number(first.seq ?? first.id) : undefined };
      },
      async tx<T>(fn: (db: DB) => Promise<T>): Promise<T> {
        if (inTx) return fn(d);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn(wrap(client.query.bind(client), true));
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },
      async close() {
        if (!inTx) await pool.end();
      },
    };
    return d;
  };
  return wrap(pool.query.bind(pool), false);
}

/**
 * Open the database. `sqlite:./data/gaskin.db`, `sqlite::memory:`, or a
 * `postgres://` URL.
 */
export async function openDb(url: string): Promise<DB> {
  if (/^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  const file = url.replace(/^sqlite:/, '') || ':memory:';
  return openSqlite(file);
}

/** INSERT that ignores a primary-key clash, in either dialect */
export function insertIgnore(db: DB, table: string, cols: string[]): string {
  const ph = cols.map(() => '?').join(', ');
  return db.dialect === 'postgres'
    ? `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT DO NOTHING`
    : `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${ph})`;
}

/** INSERT that replaces the row on a primary-key clash */
export function upsert(_db: DB, table: string, cols: string[], key: string[]): string {
  const ph = cols.map(() => '?').join(', ');
  const set = cols.filter((c) => !key.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT (${key.join(', ')}) DO UPDATE SET ${set}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
