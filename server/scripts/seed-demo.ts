/**
 * Load the synthetic demo cohort and one account per demo worker.
 *   DEMO_PIN=482916 npm run seed-demo
 * Refuses to run against a database that holds non-demo records.
 */
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { seedDemo } from '../src/seed';

const pin = process.env.DEMO_PIN;
if (!pin) {
  console.error('Set DEMO_PIN (4 to 8 digits, not 1234 or 0000).');
  process.exit(1);
}
const cfg = loadConfig();
const db = await openDb(cfg.dbUrl);
const r = await seedDemo(db, pin);
console.log(`Loaded ${r.mothers} synthetic mothers. Demo accounts (PIN from DEMO_PIN):`);
for (const u of r.users) console.log(`  ${u.phone}  ${u.role.padEnd(18)} ${u.name}`);
await db.close();
