// Screenshots of the #design showcase and the app shell at 390 and 1440 px, light and dark.
// Usage: npm run build && node scripts/design-shots.mjs [url]   (default: vite preview on 4174)
// Writes docs/screens/design-system/*.png. Exits non-zero on console errors or horizontal scroll.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens/design-system');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

let server;
async function start() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => String(d).includes('4174') && (clearTimeout(t), res()));
  });
  return 'http://localhost:4174/';
}

const problems = [];
const url = await start();
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1440]) {
    for (const scheme of ['light', 'dark']) {
      const tag = `${width}-${scheme}`;
      if (ONLY && !tag.includes(ONLY)) continue;
      const phone = width < 600;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone });
      const page = await ctx.newPage();
      page.on('console', (m) => m.type() === 'error' && problems.push(`[${tag}] ${m.text()}`));
      page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('[data-persona="lagos"]');
      await page.locator('[data-persona="lagos"]').click();
      await page.waitForSelector('.queue', { timeout: 15000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${tag}-shell-today.png` });
      await page.evaluate(() => {
        window.location.hash = '#design';
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="design-showcase"]', { timeout: 15000 });
      await page.waitForTimeout(800);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o > 1) problems.push(`[${tag}] horizontal scroll of ${o}px on #design`);
      await page.screenshot({ path: `${OUT}/${tag}-design-top.png` });
      await page.screenshot({ path: `${OUT}/${tag}-design-full.png`, fullPage: true });
      for (const id of ['forms', 'viz', 'shell']) {
        await page.locator(`#ds-${id}`).scrollIntoViewIfNeeded();
        await page.evaluate((i) => document.getElementById(`ds-${i}`)?.scrollIntoView({ block: 'start' }), id);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${OUT}/${tag}-design-${id}.png` });
      }
      if (!phone) {
        await page.locator('[data-testid="worker-card"]').first().click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/${tag}-worker-menu.png` });
        await page.keyboard.press('Escape');
      } else {
        await page.locator('[data-testid="tabbar"] button', { hasText: 'More' }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${tag}-more-sheet.png` });
        await page.keyboard.press('Escape');
      }
      await ctx.close();
      console.log(`  ok  ${tag}`);
    }
  }
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
if (problems.length) {
  console.log('\nProblems:\n' + problems.join('\n'));
  process.exit(1);
}
