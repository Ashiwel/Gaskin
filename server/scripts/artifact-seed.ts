/**
 * Write the synthetic demo cohort as artifact `db` documents, ready for
 * ArtifactData batch writes after the hosted demo is published:
 *
 *   npx tsx scripts/artifact-seed.ts [outDir]
 *
 * Produces <outDir>/<collection>/<doc_id>.json for every document and
 * <outDir>/batches.json: groups of at most 40 writes and well under 1 MiB,
 * each entry { op: 'set', collection, doc_id, file_path }.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSeedState } from '../../src/data';
import { toArtifactDocs } from '../../src/hosted/artifactBackend';

const outDir = resolve(process.argv[2] ?? 'artifact-seed');
const seed = createSeedState();
const docs = toArtifactDocs({
  mothers: seed.mothers,
  overrides: seed.overrides,
  proposals: seed.proposals,
  learnedRules: seed.learnedRules,
  outbound: seed.outbound,
  inbound: seed.inbound,
  meta: { clock: seed.clock, country: seed.country, currentWorkerId: seed.currentWorkerId, libraryVersion: '1.3', seededAt: new Date().toISOString() },
});
const batches: Array<Array<{ op: 'set'; collection: string; doc_id: string; file_path: string }>> = [];
let cur: (typeof batches)[number] = [];
let bytes = 0;
for (const d of docs) {
  const dir = join(outDir, d.collection);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${d.doc_id}.json`);
  const text = JSON.stringify(d.data);
  writeFileSync(file, text);
  if (cur.length >= 40 || bytes + text.length > 800_000) {
    batches.push(cur);
    cur = [];
    bytes = 0;
  }
  cur.push({ op: 'set', collection: d.collection, doc_id: d.doc_id, file_path: file });
  bytes += text.length;
}
if (cur.length) batches.push(cur);
writeFileSync(join(outDir, 'batches.json'), JSON.stringify(batches, null, 2));
console.log(`${docs.length} documents in ${batches.length} batches written to ${outDir}`);
