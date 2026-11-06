// Tests release/Gaskin-desktop.zip: unzips it, starts "Open Gaskin (Linux).sh" (Python path) and
// serve.js (Node path), opens the served URL in headless Chrome, completes onboarding with a
// persona, reloads, and checks that setup and records persisted and that the app registered its
// service worker (secure origin). Also checks the server binds 127.0.0.1 only and refuses paths
// outside its list.
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const zip = resolve('release/Gaskin-desktop.zip');
const dir = mkdtempSync(join(tmpdir(), 'gaskin-desktop-'));
execFileSync('unzip', ['-q', zip, '-d', dir]);
const folder = join(dir, 'Gaskin');
const problems = [];
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));

for (const f of ['Gaskin.html', 'gaskin.mcpb', 'START-HERE.txt', 'Open Gaskin (Windows).bat', 'Open Gaskin (Mac).command', 'Open Gaskin (Linux).sh']) if (!existsSync(join(folder, f))) problems.push(`missing ${f}`);
for (const f of ['Open Gaskin (Mac).command', 'Open Gaskin (Linux).sh']) if (!(statSync(join(folder, f)).mode & 0o111)) problems.push(`${f} is not executable`);

async function run(label, cmd, args) {
  const p = spawn(cmd, args, { cwd: folder, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const url = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('launcher printed no URL')), 15000);
    p.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (m) (clearTimeout(t), res(m[0]));
    });
    p.stderr.on('data', (d) => process.stderr.write(d));
  });
  console.log(`${label}: ${url}`);
  try {
    const port = new URL(url).port;
    const ss = execFileSync('sh', ['-c', `ss -ltn 2>/dev/null | grep ':${port} ' || true`], { encoding: 'utf8' });
    if (ss && !/127\.0\.0\.1:/.test(ss)) problems.push(`${label}: not bound to 127.0.0.1 only: ${ss.trim()}`);
    // Raw requests, so the paths reach the server unnormalised.
    const net = await import('node:net');
    const raw = (path) =>
      new Promise((res) => {
        const sock = net.connect(Number(port), '127.0.0.1', () => sock.write(`GET ${path} HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n`));
        let buf = '';
        sock.on('data', (d) => (buf += d));
        sock.on('end', () => res(buf.split('\r\n')[0]));
        sock.on('error', () => res('error'));
      });
    for (const bad of ['/../Gaskin.html', '/../../etc/passwd', '/app/serve.py', '/START-HERE.txt', '/%2e%2e/etc/passwd']) {
      const line = await raw(bad);
      if (/ 200 /.test(line)) problems.push(`${label}: served ${bad}`);
    }
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`${label} console: ${m.text().slice(0, 160)}`));
    await page.goto(url);
    await page.locator('[data-persona="lagos"]').click({ timeout: 30000 });
    await page.waitForSelector('[data-testid="today"]', { timeout: 30000 });
    await page.locator('[data-mother="Adaeze Okafor"] .row-link:visible').first().click().catch(() => page.evaluate(() => (location.hash = '#mother-m-ng-adaeze')));
    await page.waitForSelector('[data-testid="patient-head"]');
    await page.keyboard.press('d');
    await page.locator('[data-scenario="bp_rise"]').click();
    await page.waitForSelector('[data-alert]');
    const sw = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return 'no API';
      const r = await Promise.race([navigator.serviceWorker.ready.then(() => 'ready'), new Promise((r) => setTimeout(() => r('timeout'), 8000))]);
      return `${window.isSecureContext ? 'secure' : 'insecure'} ${r} ${'showDirectoryPicker' in window ? 'folder-api' : 'no-folder-api'}`;
    });
    console.log(`${label}: ${sw}`);
    if (!/secure ready folder-api/.test(sw) || /insecure/.test(sw)) problems.push(`${label}: service worker / secure origin: ${sw}`);
    await page.reload({ waitUntil: 'load' });
    if (await page.locator('[data-testid="lock-screen"]').isVisible({ timeout: 5000 }).catch(() => false)) for (const d of '2580') await page.locator('[data-testid="lock-screen"]').getByRole('button', { name: d, exact: true }).click();
    await page.waitForSelector('main#main', { timeout: 20000 });
    if (await page.locator('[data-persona]').count()) problems.push(`${label}: setup lost on reload`);
    await page.waitForSelector('[data-alert]', { timeout: 10000 }).catch(() => problems.push(`${label}: records lost on reload`));
    await page.screenshot({ path: resolve(`docs/screens/release-2/desktop-zip-${label}.png`) });
    console.log(`${label}: persisted after reload`);
    await browser.close();
  } finally {
    try {
      process.kill(-p.pid);
    } catch {
      p.kill();
    }
  }
}

try {
  await run('linux-launcher-python', 'sh', [join(folder, 'Open Gaskin (Linux).sh'), '--no-open']);
  await run('node-server', 'node', [join(folder, 'app', 'serve.js'), folder, '--no-open']);
} catch (e) {
  problems.push(e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (problems.length) {
  console.log('\nProblems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nDesktop zip: both servers pass (onboarding, reload, persistence, service worker, 127.0.0.1 only).');
