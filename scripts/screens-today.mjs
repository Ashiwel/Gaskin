// Screenshots of the redesigned Today, Mothers, Register and Visits screens at 390 and 1440 px,
// light and dark, plus personal mode ("My day").
// Usage: node scripts/screens-today.mjs [url]   (default: vite dev server on 4187)
//        --only=<substring of tag>   e.g. --only=390-light
// Writes docs/screens/v2/today/*.png. Exits non-zero on console errors, failed steps or
// horizontal scroll.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens/v2/today');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const SCREENS = process.argv.find((a) => a.startsWith('--screens='))?.slice(10)?.split(',');

let server;
async function start() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', '--port', '4187', '--strictPort'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('dev server did not start')), 30000);
    server.stdout.on('data', (d) => String(d).includes('4187') && (clearTimeout(t), res()));
  });
  return 'http://localhost:4187/';
}

const problems = [];
const want = (s) => !SCREENS || SCREENS.includes(s);
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
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/net::ERR|Failed to load resource|fonts\.(googleapis|gstatic)/.test(t)) return;
        problems.push(`[${tag}] ${t}`);
      });
      page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      const overflow = async (where) => {
        const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (o > 1) problems.push(`[${tag}] horizontal scroll of ${o}px on ${where}`);
      };
      const step = async (name, fn) => {
        try {
          await fn();
        } catch (e) {
          problems.push(`[${tag}] ${name}: ${String(e.message).split('\n')[0]}`);
        }
      };
      const nav = async (label) => {
        if (phone) {
          const tab = page.locator('[data-testid="tabbar"] button', { hasText: label });
          if (await tab.count()) await tab.first().click();
          else {
            await page.locator('[data-testid="tabbar"] button').last().click();
            await page.locator('[role="dialog"] button', { hasText: label }).first().click();
          }
        } else await page.locator('aside button[data-nav]', { hasText: label }).first().click();
        await page.waitForTimeout(350);
      };
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('[data-persona="lagos"]', { timeout: 30000 });
      await page.locator('[data-persona="lagos"]').click();
      // Several workers share a device: pass the account gate as the demo midwife. The PIN is
      // public (1234); demoSwitch is the same path the demo panel uses.
      const passGate = async (want = '[data-testid="today"]') => {
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
          if (await page.locator(want).count()) return;
          await page.waitForTimeout(400);
          if (await page.locator(want).count()) return;
          await page.evaluate(async () => {
            // Dev server only. Work around the demo PIN clash (accounts uses 1234, which src/auth
            // rejects as a run of digits): give the half-made demo profile a valid PIN, sign in.
            try {
              const a = await import('/src/auth/index.ts');
              const st = a.getAuthStore();
              if (st.current()) return;
              const w = st.getWorker('w-ng-bisola');
              if (!w) return;
              const raw = JSON.parse(localStorage.getItem('gaskin.kv.gaskin.auth.v1') || 'null');
              if (!raw || !raw.credentials?.['w-ng-bisola']) {
                const fresh = new a.AuthStore();
                await fresh.addWorker({ ...w, active: undefined, createdAt: undefined, createdBy: undefined }, '2580');
                const data = fresh['data'];
                localStorage.setItem('gaskin.kv.gaskin.auth.v1', JSON.stringify(data));
                await st.load();
              }
              await st.login('w-ng-bisola', '2580');
            } catch (e) {
              console.warn('gate helper', String(e));
            }
          });
          const pick = page.locator('[data-profile="w-ng-bisola"]');
          if (!(await page.locator(want).count()) && (await pick.count())) {
            await pick.first().click().catch(() => undefined);
            const one = page.locator('[data-testid="lock-screen"] button[aria-label="1"]');
            if (await one.count()) for (const d of '1234') await page.locator('[data-testid="lock-screen"] button[aria-label="' + d + '"]').first().click({ timeout: 2000 }).catch(() => undefined);
          }
          await page.waitForTimeout(500);
        }
        await page.screenshot({ path: `${OUT}/${tag}-gate-failed.png` });
        const text = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n/g, ' | '));
        throw new Error(`gate not passed (waiting for ${want}): ${text}`);
      };
      await passGate();
      await page.waitForTimeout(600);

      if (want('today'))
        await step('today', async () => {
          await page.screenshot({ path: `${OUT}/${tag}-today.png` });
          await page.screenshot({ path: `${OUT}/${tag}-today-full.png`, fullPage: true });
          await overflow('Today');
          // A busier morning: her facility's caseload, and Adaeze's blood pressure rising (demo scenario).
          await step('today busy', async () => {
            await nav('Mothers');
            const fac = page.locator('[data-testid="scope-switch"] [role="radio"]', { hasText: 'Facility' });
            if (await fac.count()) await fac.click();
            await page.locator('.row-link', { hasText: 'Adaeze Okafor' }).first().click();
            await page.waitForTimeout(500);
            await page.keyboard.press('d');
            await page.locator('[data-scenario="bp_rise"]').click({ timeout: 8000 });
            await page.waitForTimeout(400);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
            if (await page.locator('[role="dialog"] button[aria-label="Close"]').count()) await page.locator('[role="dialog"] button[aria-label="Close"]').first().click();
            await nav('Today');
            await page.waitForSelector('[data-testid="today"]');
            await page.waitForTimeout(3000); // let the scenario toast go
            await page.screenshot({ path: `${OUT}/${tag}-today-busy.png` });
            await page.screenshot({ path: `${OUT}/${tag}-today-busy-full.png`, fullPage: true });
            await overflow('Today (busy)');
          });
        });

      if (want('mothers'))
        await step('mothers', async () => {
          await nav('Mothers');
          await page.waitForSelector('[data-testid="mothers"]', { timeout: 8000 });
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT}/${tag}-mothers.png` });
          await page.screenshot({ path: `${OUT}/${tag}-mothers-full.png`, fullPage: true });
          await overflow('Mothers');
          const grid = page.locator('[data-testid="view-grid"]');
          if (await grid.count()) {
            await grid.click();
            await page.waitForTimeout(250);
            await page.screenshot({ path: `${OUT}/${tag}-mothers-grid.png` });
            await overflow('Mothers grid');
          }
        });

      if (want('visits'))
        await step('visits', async () => {
          await nav('Visits');
          await page.waitForSelector('[data-testid="visits"]', { timeout: 8000 });
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT}/${tag}-visits.png` });
          await page.screenshot({ path: `${OUT}/${tag}-visits-full.png`, fullPage: true });
          await overflow('Visits');
        });

      if (want('register'))
        await step('register', async () => {
          await page.evaluate(() => {
            window.location.hash = '#register';
          });
          await page.reload({ waitUntil: 'load' });
          await passGate('[data-testid="register"]');
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT}/${tag}-register-1.png`, fullPage: true });
          await overflow('Register');
          await page.locator('input#reg-name, #reg-name input').first().fill('Temitope Ajayi');
          await page.locator('input#reg-age, #reg-age input').first().fill('16');
          await page.locator('input#reg-community, #reg-community input').first().fill('Aguda');
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${OUT}/${tag}-register-2.png`, fullPage: true });
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.locator('input#reg-phone, #reg-phone input').first().fill('08031234567');
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${OUT}/${tag}-register-guardian.png`, fullPage: true });
          await page.locator('input#reg-guardian-name, #reg-guardian-name input').first().fill('Funmilayo Ajayi');
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.locator('input#reg-weeks, #reg-weeks input').first().fill('22');
          const addChild = page.locator('[data-testid="reg-add-child"]');
          if (await addChild.count()) {
            await addChild.click();
            await page.locator('input[id^="reg-child-name-"], [id^="reg-child-name-"] input').first().fill('Ayo');
            await page.locator('input[id^="reg-child-dob-"], [id^="reg-child-dob-"] input').first().fill('2025-12-01');
            await page.locator('input[id^="reg-child-weight-"], [id^="reg-child-weight-"] input').first().fill('3.1');
          }
          await page.waitForTimeout(200);
          await page.screenshot({ path: `${OUT}/${tag}-register-3.png`, fullPage: true });
          await overflow('Register step 3');
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(200);
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${OUT}/${tag}-register-5.png`, fullPage: true });
          await page.getByText('She agrees to her record being kept').click();
          await page.getByText('was involved, as she is under 18').click();
          await page.locator('[data-testid="reg-next"]').click();
          await page.waitForFunction(() => location.hash.startsWith('#mother-'), null, { timeout: 8000 });
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${OUT}/${tag}-register-done.png` });
        });

      if (want('personal'))
        await step('personal', async () => {
          await page.evaluate(() => {
            const k = 'gaskin.setup.v1';
            const s = JSON.parse(localStorage.getItem(k) || '{}');
            s.answers = { ...(s.answers || {}), role: 'personal' };
            localStorage.setItem(k, JSON.stringify(s));
            window.location.hash = '#today';
          });
          await page.reload({ waitUntil: 'load' });
          await passGate('[data-testid="my-day"]');
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${OUT}/${tag}-my-day.png`, fullPage: true });
          await overflow('My day');
        });

      await ctx.close();
      console.log(`  done ${tag}`);
    }
  }
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
}
if (problems.length) {
  console.log('\nProblems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nAll screens captured, no console errors, no horizontal scroll.');
