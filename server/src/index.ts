/**
 * Gaskin server entry point. `node dist/server.mjs` or `npm run dev`.
 */
import { serve } from '@hono/node-server';
import { configProblems, loadConfig } from './config';
import { openDb } from './db';
import { createApp } from './app';
import { createUser } from './auth';
import { runRetention } from './retention';
import { seedFacilities } from './seed';

export async function start(env: Record<string, string | undefined> = process.env) {
  const cfg = loadConfig(env);
  const problems = configProblems(cfg, env);
  for (const p of problems) console.warn(`[gaskin] config: ${p}`);
  if (problems.length && env.NODE_ENV === 'production' && env.GASKIN_ALLOW_UNSAFE_CONFIG !== 'yes')
    throw new Error(`refusing to start in production with unsafe settings (${problems.length}). Fix them, or set GASKIN_ALLOW_UNSAFE_CONFIG=yes for a demo.`);
  const db = await openDb(cfg.dbUrl);
  await seedFacilities(db);

  if (cfg.bootstrapAdmin) {
    const n = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
    if (!Number(n?.n)) {
      await createUser(db, { ...cfg.bootstrapAdmin, role: 'admin', facilityIds: [] });
      console.log('[gaskin] created the first admin account from ADMIN_PHONE. Change its PIN after first sign-in and unset ADMIN_PIN.');
    }
  }

  const g = createApp({ cfg, db });
  const server = serve({ fetch: g.app.fetch, port: cfg.port, hostname: cfg.host });

  const timers = [
    setInterval(() => void g.messaging.releaseHeld().catch(() => undefined), 5 * 60_000),
    setInterval(() => void runRetention(db, cfg.retention).catch((e) => console.error('[retention] failed', (e as Error).name)), 24 * 3600_000),
  ];
  void runRetention(db, cfg.retention).catch(() => undefined);

  console.log(
    `[gaskin] listening on http://${cfg.host}:${cfg.port}  db=${db.dialect}  messaging=${cfg.messaging.mode}  ai=${cfg.ai.baseUrl ? `${cfg.ai.model} (${cfg.ai.residency})` : 'off'}`,
  );
  if (cfg.messaging.mode === 'sandbox') console.log('[gaskin] sandbox messaging: no real SMS, WhatsApp, calls or email will be sent.');

  const stop = async () => {
    for (const t of timers) clearInterval(t);
    g.close();
    await new Promise<void>((r) => server.close(() => r()));
    await db.close();
  };
  return { cfg, db, server, stop, ...g };
}

const isMain = (() => {
  try {
    const arg = process.argv[1] ?? '';
    return /(?:index\.ts|server\.mjs)$/.test(arg);
  } catch {
    return false;
  }
})();

if (isMain) {
  start().then(
    (s) => {
      const shutdown = () => void s.stop().then(() => process.exit(0));
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    },
    (e) => {
      console.error('[gaskin] failed to start:', (e as Error).message);
      process.exit(1);
    },
  );
}
