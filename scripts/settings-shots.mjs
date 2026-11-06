// Onboarding, accounts (first worker, recovery code, lock, forgot PIN), Settings, About and the
// demo panel at 390x844 and 1440x900, light and dark. Fails on console errors or sideways scroll.
// Usage: npx vite build && node scripts/settings-shots.mjs [url]   (default: vite preview on 4183)
// Screenshots: docs/screens/v2/settings/
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens/v2/settings');
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.png')) unlinkSync(`${OUT}/${f}`);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

let server;
async function start() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', 'preview', '--port', '4183', '--strictPort'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => String(d).includes('4183') && (clearTimeout(t), res()));
  });
  return 'http://localhost:4183/';
}

const problems = [];
let passed = 0;
let currentPage = null;
async function step(tag, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${tag} ${name}`);
  } catch (e) {
    problems.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`);
    await currentPage?.screenshot({ path: `${OUT}/${tag}-FAIL-${name.slice(0, 20).replace(/\W+/g, '-')}.png` }).catch(() => undefined);
    console.log(`  FAIL ${tag} ${name}: ${e.message.split('\n')[0]}`);
  }
}

const url = await start();
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1440]) {
    for (const scheme of ['light', 'dark']) {
      const tag = `${width}-${scheme}`;
      if (ONLY && !tag.includes(ONLY)) continue;
      const phone = width < 600;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone, acceptDownloads: true });
      const page = await ctx.newPage();
      currentPage = page;
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/net::ERR|Failed to load resource|fonts\.g/.test(t)) return;
        problems.push(`[${tag}] console: ${t}`);
      });
      page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
      const overflow = async (where) => {
        const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (o > 1) problems.push(`[${tag}] horizontal scroll of ${o}px on ${where}`);
      };
      const wait = (ms) => page.waitForTimeout(ms);
      await page.goto(url, { waitUntil: 'load' });

      // ---------- Health-worker onboarding: South Africa ----------
      await step(tag, 'who will use Gaskin', async () => {
        await page.waitForSelector('[data-testid="step-who"]');
        await wait(200);
        await shot('01-who');
        await overflow('who');
      });
      await step(tag, 'country: search South Africa', async () => {
        await page.locator('[data-testid="who-health_worker"]').click();
        await page.waitForSelector('[data-testid="step-country"]');
        await wait(200);
        await shot('02-country');
        await page.locator('[data-testid="country-picker"]').click();
        await page.waitForSelector('[data-testid="country-sheet"]');
        await page.locator('[data-testid="sheet-search"]').fill('south af');
        await wait(150);
        await shot('03-country-search');
        await page.locator('[data-pick="ZA"]').click();
        await page.getByRole('button', { name: 'Continue' }).click();
      });
      await step(tag, 'place: province and municipality', async () => {
        await page.waitForSelector('[data-testid="step-place"]');
        await page.locator('[data-testid="region-picker"]').click();
        await page.locator('[data-testid="sheet-search"]').fill('gaut');
        await wait(150);
        await page.locator('[data-pick]').first().click();
        await wait(300);
        await shot('04-place');
        await overflow('place');
        await page.locator('[data-testid="place-continue"]').click();
      });
      await step(tag, 'language: no Nigerian languages for South Africa', async () => {
        await page.waitForSelector('[data-testid="step-language"]');
        await wait(200);
        const text = await page.locator('[data-testid="step-language"]').innerText();
        for (const w of ['Hausa', 'Yorùbá', 'Igbo', 'Naijá']) if (text.includes(w)) throw new Error(`shows ${w}`);
        await shot('05-language');
        await page.locator('[data-testid="more-languages"]').click();
        await page.waitForSelector('[data-testid="language-sheet"]');
        await wait(200);
        const sheet = await page.locator('[data-testid="language-sheet"]').innerText();
        for (const w of ['Hausa', 'Yorùbá', 'Igbo']) if (sheet.includes(w)) throw new Error(`sheet shows ${w}`);
        await shot('06-more-languages');
        await page.keyboard.press('Escape');
        await page.locator('[data-testid="lang-en"]').click();
      });
      await step(tag, 'mothers languages, then device questions to the summary', async () => {
        await page.waitForSelector('[data-testid="step-mothers"]');
        await shot('07-mothers');
        await page.locator('[data-testid="step-skip"]').click();
        for (let i = 0; i < 16; i++) {
          if (await page.locator('[data-testid="setup-summary"]').count()) break;
          const st = await page.locator('section[data-testid^="step-"]').first().getAttribute('data-testid');
          if (i === 1) await shot('08-question');
          if (await page.locator('[data-testid="step-skip"]').count()) await page.locator('[data-testid="step-skip"]').first().click();
          else {
            await page.locator('section[data-testid^="step-"] [role="checkbox"], section[data-testid^="step-"] [role="radio"]').first().click();
            const cont = page.getByRole('button', { name: 'Continue' });
            await page.waitForTimeout(350);
            if (await cont.count()) await cont.first().click().catch(() => undefined);
          }
          await page.waitForFunction((s) => document.querySelector('section[data-testid^="step-"], [data-testid="setup-summary"]')?.getAttribute('data-testid') !== s, st, { timeout: 3000 });
        }
        await page.waitForSelector('[data-testid="setup-summary"]');
        await wait(300);
        await shot('09-summary');
        await shot('09-summary-full', true);
        await overflow('summary');
      });
      await step(tag, 'apply setup, first worker with PIN and recovery code', async () => {
        await page.locator('[data-testid="apply-setup"]').click();
        await page.waitForSelector('[data-testid="new-worker-name"]', { timeout: 20000 });
        await page.locator('[data-testid="worker-name"]').fill('Thandi Nkosi');
        await shot('10-first-worker');
        await page.locator('[data-testid="worker-name-next"]').click();
        await page.locator('[data-testid="role-supervisor"]').click();
        await page.waitForSelector('[data-testid="choose-pin"]');
        for (const k of '2580') await page.locator(`[data-key="${k}"]`).click();
        await shot('11-choose-pin');
        await page.locator('[data-testid="pin-next"]').click();
        for (const k of '2580') await page.locator(`[data-key="${k}"]`).click();
        await page.locator('[data-testid="pin-next"]').click();
        await page.waitForSelector('[data-testid="recovery-code"]', { timeout: 15000 });
        await wait(200);
        await shot('12-recovery-code');
        await overflow('recovery code');
        await page.locator('[data-testid="recovery-confirm"]').click();
        await page.locator('[data-testid="recovery-done"]').click();
      });
      await step(tag, 'settings: list and sections', async () => {
        await page.waitForSelector('[data-testid="recovery-code"]', { state: 'detached', timeout: 10000 });
        await page.evaluate(() => (window.location.hash = '#ai-and-data'));
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="lock-screen"]', { timeout: 15000 });
        for (const k of '2580') {
          await page.locator('[data-testid="lock-screen"]').getByRole('button', { name: k, exact: true }).click();
          await page.waitForTimeout(120);
        }
        await page.waitForSelector('[data-testid="lock-screen"]', { state: 'detached', timeout: 15000 });
        await page.waitForSelector('[data-testid="settings"]', { timeout: 15000 });
        await wait(400);
        await shot('13-settings');
        await overflow('settings');
        const open = async (id) => {
          if (phone) {
            if (await page.locator('[data-testid="settings-back"]').count()) await page.locator('[data-testid="settings-back"]').click();
            await page.locator(`[data-section="${id}"]`).click();
          } else await page.locator(`[data-subnav="${id}"]`).click();
          await wait(300);
        };
        for (const id of ['workers', 'appearance', 'language', 'visits', 'notifications', 'messaging', 'printing', 'ai', 'privacy', 'storage', 'setup', 'legal']) {
          await open(id);
          await shot(`14-settings-${id}`, true);
          await overflow(`settings ${id}`);
        }
        await open('appearance');
        await page.locator('[data-testid="text-size"] [data-value="large"]').click();
        const fs = await page.evaluate(() => document.documentElement.style.fontSize);
        if (fs !== '112.5%') throw new Error(`text size not applied (${fs})`);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="lock-screen"], [data-testid="settings"]', { timeout: 15000 });
        const fs2 = await page.evaluate(() => document.documentElement.style.fontSize);
        if (fs2 !== '112.5%') throw new Error('text size did not persist');
        await page.evaluate(() => {
          const p = JSON.parse(localStorage.getItem('gaskin.prefs.v1') || '{}');
          p.textSize = 'default';
          localStorage.setItem('gaskin.prefs.v1', JSON.stringify(p));
        });
      });
      await step(tag, 'lock screen after reload, wrong PIN, forgot PIN', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="lock-screen"]', { timeout: 15000 });
        await wait(200);
        await shot('15-lock');
        for (const k of '1111') await page.locator('[data-testid="lock-screen"]').getByRole('button', { name: k, exact: true }).click();
        await wait(1500);
        await shot('16-lock-wrong');
        await page.locator('[data-testid="forgot-pin-link"]').click();
        await page.waitForSelector('[data-testid="forgot-pin"]');
        await shot('17-forgot-pin');
        await page.locator('[data-testid="use-recovery"]').click();
        await page.waitForSelector('[data-testid="recovery-entry"]');
        await shot('18-recovery-entry');
        await page.getByRole('button', { name: 'Back' }).click();
        await page.getByRole('button', { name: 'Back' }).click();
        await page.waitForSelector('[data-testid="lock-screen"]');
        for (const k of '2580') await page.locator('[data-testid="lock-screen"]').getByRole('button', { name: k, exact: true }).click();
        await page.waitForSelector('[data-testid="settings"]', { timeout: 15000 });
      });
      await step(tag, 'about', async () => {
        await page.evaluate(() => {
          window.history.pushState({ route: { name: 'about' }, depth: 1 }, '', '#about');
          window.dispatchEvent(new PopStateEvent('popstate', { state: { route: { name: 'about' }, depth: 1 } }));
        });
        await page.waitForSelector('[data-testid="about"]', { timeout: 10000 });
        await wait(300);
        await shot('19-about');
        await shot('19-about-full', true);
        await overflow('about');
      });
      await step(tag, 'demo panel', async () => {
        await page.keyboard.press('d');
        await page.waitForSelector('[data-testid="demo-panel"]');
        await wait(300);
        await shot('20-demo-panel');
        await overflow('demo panel');
        await page.keyboard.press('Escape');
      });
      await ctx.close();

      // ---------- Personal branch and a reviewer persona ----------
      const ctx2 = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone });
      const p2 = await ctx2.newPage();
      p2.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      p2.on('console', (m) => m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text()) && problems.push(`[${tag}] console: ${m.text()}`));
      const shot2 = (n, full = false) => p2.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
      await p2.goto(url, { waitUntil: 'load' });
      await step(tag, 'personal: not a doctor, consent, clinic, emergency number', async () => {
        await p2.locator('[data-testid="who-personal"]').click();
        await p2.locator('[data-testid="country-GH"]').click();
        await p2.waitForSelector('[data-testid="step-place"]');
        await p2.locator('[data-testid="place-continue"]').click();
        await p2.waitForSelector('[data-testid="step-language"]');
        await p2.locator('[data-testid="lang-en"]').click();
        await p2.waitForSelector('[data-testid="step-not-doctor"]');
        await p2.waitForTimeout(200);
        await shot2('21-personal-not-doctor');
        await p2.getByRole('button', { name: 'I understand' }).click();
        await p2.waitForSelector('[data-testid="step-consent"]');
        for (const k of ['understand', 'emergency', 'store', 'age']) await p2.locator(`[data-testid="consent-${k}"]`).click();
        await shot2('22-personal-consent');
        await p2.locator('[data-testid="consent-agree"]').click();
        await p2.waitForSelector('[data-testid="step-clinic"]');
        const num = await p2.locator('[data-testid="emergency-card"]').innerText();
        if (!/112/.test(num)) throw new Error(`Ghana emergency card says ${num}`);
        await shot2('23-personal-clinic');
        await p2.getByRole('button', { name: 'Continue' }).click();
        await p2.waitForSelector('[data-testid="step-ready"]');
        await shot2('24-personal-ready');
        await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).then((o) => o > 1 && problems.push(`[${tag}] sideways scroll ${o}px on personal`));
      });
      await ctx2.close();

      const ctx3 = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone });
      const p3 = await ctx3.newPage();
      p3.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      await p3.goto(url, { waitUntil: 'load' });
      await step(tag, 'persona lands signed in with workers page', async () => {
        await p3.waitForSelector('[data-persona="lagos"]');
        await p3.screenshot({ path: `${OUT}/${tag}-25-personas.png`, fullPage: true });
        await p3.locator('[data-persona="lagos"]').click();
        await p3.waitForFunction(() => !document.querySelector('.setup-root'), null, { timeout: 20000 });
        await p3.waitForTimeout(600);
        if (await p3.locator('[data-testid="lock-screen"], [data-testid="new-worker-name"]').count()) throw new Error('persona did not sign in');
        await p3.screenshot({ path: `${OUT}/${tag}-26-persona-today.png` });
      });
      await ctx3.close();
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
console.log(`\nAll ${passed} steps passed, no console errors, no sideways scroll.`);
