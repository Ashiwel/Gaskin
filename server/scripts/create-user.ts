/**
 * Create an account from the command line (first admin, or when the API is not reachable).
 *   npm run create-user -- --phone 08031234567 --name "Amina Bello" --role worker --facility f-ng-kaduna-phc --pin 482916
 * The PIN can be given through GASKIN_PIN instead, so it stays out of shell history.
 */
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createUser, ROLES } from '../src/auth';
import { seedFacilities } from '../src/seed';
import type { HostedRole } from '../../src/hosted/syncTypes';
import type { CountryCode } from '../../src/types';

const { values } = parseArgs({
  options: {
    phone: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'worker' },
    facility: { type: 'string', multiple: true, default: [] },
    worker: { type: 'string' },
    country: { type: 'string', default: 'NG' },
    pin: { type: 'string' },
  },
});
const pin = values.pin ?? process.env.GASKIN_PIN;
if (!values.phone || !values.name || !pin || !ROLES.includes(values.role as HostedRole)) {
  console.error(`Usage: create-user --phone <number> --name <name> --role <${ROLES.join('|')}> --facility <id> [--facility <id>] [--country NG|KE|GH] [--pin <pin> | GASKIN_PIN=...]`);
  process.exit(1);
}
const cfg = loadConfig();
const db = await openDb(cfg.dbUrl);
await seedFacilities(db);
const id = await createUser(db, {
  phone: values.phone,
  name: values.name,
  role: values.role as HostedRole,
  facilityIds: values.facility as string[],
  workerId: values.worker,
  country: values.country as CountryCode,
  pin,
});
console.log(`Created ${values.role} ${values.name} (${id}).`);
await db.close();
