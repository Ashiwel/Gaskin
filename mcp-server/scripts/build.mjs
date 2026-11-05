// Bundles the server and the app's engine, clinical, data, messaging and
// privacy code (imported from ../src) into one file: dist/server.js.
// It runs with plain `node dist/server.js` and needs no node_modules.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = await build({
  entryPoints: [path.join(root, 'src/server.ts')],
  outfile: path.join(root, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  minify: true,
  keepNames: true,
  sourcemap: false,
  legalComments: 'none',
  banner: { js: '#!/usr/bin/env node\n// Gaskin MCP server (bundled). Source: mcp-server/src. Licence: Apache-2.0.' },
  define: { 'import.meta.env': '{}' },
  logLevel: 'warning',
  metafile: true,
});
const bytes = Object.values(r.metafile.outputs)[0].bytes;
console.log(`dist/server.js ${(bytes / 1024).toFixed(0)} KB`);
