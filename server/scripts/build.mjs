// Bundle the server (and the shared engine, privacy and data modules it
// imports from ../src) into one ESM file. Native and optional packages stay
// external and are installed in the Docker image.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['better-sqlite3', 'pg', 'nodemailer', 'pg-native'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
