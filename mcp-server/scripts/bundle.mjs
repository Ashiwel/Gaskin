// Packs dist/gaskin.mcpb for one-click install in Claude Desktop.
// Stages manifest.json, icon.png and the single-file server (no node_modules
// needed: everything is bundled), validates with the official mcpb CLI, packs,
// then writes a base64 copy the Gaskin app can embed for its download button.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stage = path.join(root, 'dist', 'mcpb-stage');
const out = path.join(root, 'dist', 'gaskin.mcpb');
const cli = path.join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
manifest.version = pkg.version;

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'dist'), { recursive: true });
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.copyFileSync(path.join(root, 'dist', 'server.js'), path.join(stage, 'dist', 'server.js'));
fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(stage, 'icon.png'));
const licence = path.join(root, '..', 'LICENSE');
if (fs.existsSync(licence)) fs.copyFileSync(licence, path.join(stage, 'LICENSE'));
fs.writeFileSync(
  path.join(stage, 'README.md'),
  'Gaskin extension for Claude Desktop. Choose the folder that holds gaskin-data.json when you install it.\nSee docs/connect-your-assistant.md in the Gaskin repository.\n',
);

const run = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
run(['validate', path.join(stage, 'manifest.json')]);
fs.rmSync(out, { force: true });
run(['pack', stage, out]);
fs.rmSync(stage, { recursive: true, force: true });

const bytes = fs.readFileSync(out);
fs.writeFileSync(path.join(root, 'dist', 'gaskin.mcpb.base64.txt'), bytes.toString('base64'));
console.log(`dist/gaskin.mcpb ${(bytes.length / 1024).toFixed(0)} KB`);
