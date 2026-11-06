// Screenshots of the patient record, plan, record sheet, Children tab and guided visit at
// 390×844 and 1440×900, light and dark. Fails on console errors or horizontal scroll.
// Usage: npx vite build && node scripts/patient-shots.mjs [url] [--only=390-light]
// Writes docs/screens/v2/patient/*.png.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens/v2/patient');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

let server;
async function start() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort', ...(process.env.OUTDIR ? ['--outDir', process.env.OUTDIR] : [])], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => String(d).includes('4175') && (clearTimeout(t), res()));
  });
  return 'http://localhost:4175/';
}

const problems = [];
const url = await start();
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function session(width, scheme, persona) {
  const phone = width < 600;
  const tag = `${width}-${scheme}`;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/net::ERR|Failed to load resource|fonts\.g/.test(t)) return;
    problems.push(`[${tag}] ${t}`);
  });
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  // Skip the setup questions: the demo opens on Today with the seed workers, no PIN gate. The
  // persona only picks the acting worker (Lagos or Kano) through the demo's worker switch.
  await page.waitForSelector('[data-testid="skip-all"]', { timeout: 15000 });
  await page.locator('[data-testid="skip-all"]').first().click();
  await page.waitForSelector('[data-testid="today"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
  const overflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) problems.push(`[${tag}] horizontal scroll of ${o}px on ${where}`);
  };
  // Get past the accounts gate: the first-worker flow (name, PIN twice, recovery code), or a
  // demo profile's PIN screen (the persona seeds demo profiles whose PIN is 1234).
  const PIN = '2580';
  const unlock = async () => {
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(300);
      if (await page.locator('[data-testid="patient-head"], [data-testid="today"], main#main').first().isVisible().catch(() => false)) {
        if (!(await page.locator('[data-testid="lock-screen"], [data-testid="worker-name"], [data-testid="recovery-code"], [data-profile]').first().isVisible().catch(() => false))) return;
      }
      const name = page.locator('[data-testid="worker-name"] input, input[data-testid="worker-name"]').first();
      if (await name.isVisible().catch(() => false)) {
        await name.fill('Bisola Adebayo');
        await page.locator('[data-testid="worker-name-next"]').click();
        await page.waitForTimeout(300);
        const role = page.locator('[data-testid="role-worker"]');
        if (await role.isVisible().catch(() => false)) await role.click();
        for (let k = 0; k < 2; k++) {
          await page.waitForTimeout(250);
          for (const d of PIN) await page.locator(`[data-key="${d}"]`).first().click();
          await page.locator('[data-testid="pin-next"]').click();
        }
        continue;
      }
      if (await page.locator('[data-testid="recovery-code"]').isVisible().catch(() => false)) {
        await page.locator('[data-testid="recovery-confirm"]').click();
        await page.locator('[data-testid="recovery-done"]').click();
        continue;
      }
      const pick = page.locator('[data-profile]').first();
      if (await pick.isVisible().catch(() => false)) {
        await pick.click();
        continue;
      }
      if (await page.locator('[data-testid="lock-screen"]').isVisible().catch(() => false)) {
        for (const d of '1234') await page.locator(`[data-testid="lock-screen"] button[aria-label="${d}"]`).first().click();
        continue;
      }
      return;
    }
  };
  // Navigate in the page (no reload, so the signed-in session is kept): push the route and fire popstate.
  const openMother = async (id, tab = 'plan') => {
    await unlock();
    await page.evaluate(
      ([mid, t]) => {
        window.history.pushState({ route: { name: 'patient', id: mid, tab: t }, depth: 1 }, '', `#mother-${mid}`);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
        window.scrollTo(0, 0);
      },
      [id, tab],
    );
    await page.waitForSelector('[data-testid="patient-head"]', { timeout: 15000 });
    await page.waitForTimeout(500);
  };
  return { ctx, page, shot, overflow, openMother, phone, tag };
}

const step = async (tag, name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${tag} ${name}`);
  } catch (e) {
    problems.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`);
    console.log(`  FAIL ${tag} ${name}: ${e.message.split('\n')[0]}`);
  }
};

try {
  for (const width of [390, 1440]) {
    for (const scheme of ['light', 'dark']) {
      const tag0 = `${width}-${scheme}`;
      if (ONLY && !tag0.includes(ONLY)) continue;
      // Lagos midwife: Adaeze (pregnant, with a toddler) and Funke (newborn).
      const s = await session(width, scheme, 'lagos');
      const { page, shot, overflow, openMother, phone, tag } = s;
      await step(tag, 'Adaeze: header, journey and plan', async () => {
        await openMother('m-ng-adaeze');
        await shot('01-plan-top');
        await overflow('plan');
        await shot('02-plan-full', true);
      });
      await step(tag, 'item menu and why', async () => {
        const card = page.locator('[data-item]').first();
        await card.scrollIntoViewIfNeeded();
        await card.getByRole('button', { name: 'Why' }).click();
        await page.waitForTimeout(150);
        await shot('03-item-why');
      });
      await step(tag, 'Show to mother flip card', async () => {
        const show = page.locator('[data-item] [data-testid="show-to-mother"]').first();
        await show.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(200);
        await show.click({ force: true });
        await page.waitForSelector('[data-testid="show-to-mother-card"]');
        await page.waitForTimeout(250);
        await shot('04-show-front');
        await page.locator('[data-testid="turn-to-her"]').click();
        await page.waitForTimeout(700);
        await shot('05-show-back');
        await page.keyboard.press('Escape');
      });
      await step(tag, 'timeline', async () => {
        await openMother('m-ng-adaeze', 'timeline');
        await shot('06-timeline');
        await overflow('timeline');
      });
      await step(tag, 'history', async () => {
        await openMother('m-ng-adaeze', 'history');
        await shot('07-history', true);
        await overflow('history');
      });
      await step(tag, 'record sheet with EPDS', async () => {
        await openMother('m-ng-adaeze');
        if (phone) await page.getByRole('button', { name: 'More actions' }).click();
        else await page.getByRole('button', { name: 'More actions' }).click();
        await page.getByRole('menuitem', { name: 'Record new information' }).click();
        await page.waitForSelector('[data-testid="record-sheet"]');
        await page.waitForTimeout(250);
        await page.locator('#rec-sys').fill('150');
        await page.locator('#rec-dia').fill('96');
        await shot('08-record');
        await page.locator('#rec-epds').scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: /Ask the 10 questions/ }).click();
        await page.locator('[data-testid="epds-stepper"] [role="radio"]').nth(1).click();
        await page.waitForTimeout(400);
        await page.locator('[data-testid="epds-stepper"]').scrollIntoViewIfNeeded();
        await shot('09-record-epds');
        await overflow('record sheet');
        await page.keyboard.press('Escape');
      });
      await step(tag, 'Funke: children tab', async () => {
        await openMother('m-ng-funke', 'baby');
        await shot('10-children', true);
        await overflow('children');
      });
      await step(tag, 'Funke: guided visit', async () => {
        await openMother('m-ng-funke');
        await page.locator('[data-testid="start-visit"]').click();
        await page.waitForSelector('[data-testid="visit-screen"] .visit-root');
        await page.waitForTimeout(300);
        await shot('11-visit-ask');
        await overflow('visit');
        await page.locator('[data-testid="add-custom-question"]').click();
        await page.locator('[data-testid="custom-question-text"]').fill('Is anyone at home helping you at night?');
        await page.locator('[data-testid="custom-question-save"]').click();
        await page.waitForTimeout(200);
        await shot('12-visit-custom-question', true);
        await page.locator('.visit-step', { hasText: /baby/i }).first().click();
        const club = page.locator('[id^="vi-b.talipes"] [role="radio"]', { hasText: 'Club foot, one foot' });
        await club.scrollIntoViewIfNeeded();
        await club.click();
        await page.waitForTimeout(200);
        await page.locator('[id^="vi-b.talipes"]').scrollIntoViewIfNeeded();
        await shot('13-visit-abnormal');
        const tell = page.locator('.visit-step', { hasText: /Tell/ });
        if (await tell.count()) {
          await tell.first().click();
          await page.waitForTimeout(200);
          await shot('14-visit-tell');
        }
        await page.locator('.visit-step', { hasText: 'Summary' }).click();
        await page.waitForTimeout(200);
        // Viewport shots: a full-page capture draws the fixed footer mid-page, which misleads.
        await shot('15-visit-summary-top');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(200);
        await shot('15b-visit-summary-bottom');
        const anyway = page.locator('[data-testid="finish-anyway"]');
        if (await anyway.count()) {
          await anyway.click();
          await page.locator('[data-testid="finish-anyway-reason"]').fill('Baby was crying; finish at the home visit tomorrow');
        }
        await page.getByRole('button', { name: /Save visit/ }).click();
        await page.waitForSelector('[data-testid="next-steps"]', { timeout: 5000 });
        await page.waitForTimeout(500);
        await shot('16-next-steps');
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-alert^="alert.visit_referral"]', { timeout: 5000 });
        await page.waitForTimeout(300);
        await shot('17-referral-alert');
        await overflow('referral alert');
      });
      await s.ctx.close();

      // Kano: Halima Musa has two children under 2 (and a separate session for twins in Kenya).
      const k = await session(width, scheme, 'kano');
      await step(k.tag, 'Halima Musa: siblings on the journey', async () => {
        await k.openMother('m-ng-halimam');
        await k.shot('18-siblings-header');
        await k.openMother('m-ng-halimam', 'baby');
        await k.shot('19-siblings-children', true);
        await k.overflow('siblings');
      });
      await step(k.tag, 'Wanjiku: twins and an older sibling', async () => {
        await k.openMother('m-ke-wanjiku');
        await k.shot('20-twins-header');
        await k.openMother('m-ke-wanjiku', 'baby');
        await k.shot('21-twins-children', true);
      });
      await k.ctx.close();
    }
  }
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\nScreenshots in ${OUT}`);
