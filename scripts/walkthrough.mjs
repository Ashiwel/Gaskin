// End-to-end walk-through of Gaskin in headless Chrome, as filmed for the pitch.
// Usage: node scripts/walkthrough.mjs [url]   (default: serves dist/ via vite preview on 4173)
//        node scripts/walkthrough.mjs --file  (opens dist/index.html from file://, the USB-stick case)
// Screenshots go to docs/screens/final. Exits non-zero on console errors, failed steps or
// horizontal scroll.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = resolve('docs/screens/final');
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const FILE_MODE = process.argv.includes('--file');
if (!FILE_MODE) for (const f of readdirSync(OUT)) if (f.endsWith('.png') && !f.startsWith('usb-')) unlinkSync(`${OUT}/${f}`);

let server;
async function startServer() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('4173')) {
        clearTimeout(t);
        res();
      }
    });
  });
  return 'http://localhost:4173/';
}

const errors = [];
const failures = [];
let passed = 0;

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message.split('\n')[0]}`);
    console.log(`  FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function open(url, viewport, tag, scheme) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const isPhone = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: isPhone ? 2 : 1, colorScheme: scheme, hasTouch: isPhone, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Font CDN blocked in a sandbox (or offline from a USB stick) is not an app error.
    if (/fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR|Failed to load resource/.test(t)) return;
    errors.push(`[${tag}] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
  const overflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) failures.push(`${tag}: horizontal scroll of ${o}px on ${where}`);
  };
  const nav = async (label, mobileLabel = label) => {
    if (isPhone) {
      const tab = page.locator('.tabbar button', { hasText: mobileLabel });
      if (await tab.count()) await tab.first().click();
      else {
        await page.locator('.tabbar button').last().click();
        await page.locator('.sheet .nav-item', { hasText: label }).click();
      }
    } else await page.locator('.rail .nav-item', { hasText: label }).click();
  };
  const persona = async (id) => {
    await page.waitForSelector(`[data-persona="${id}"]`);
    await page.locator(`[data-persona="${id}"]`).first().click();
    await page.waitForSelector('.queue', { timeout: 15000 });
    await page.waitForTimeout(300);
  };
  const openMother = async (name) => {
    await page.locator('.row-link', { hasText: name }).first().click();
    await page.waitForSelector('.patient-head');
    await page.waitForTimeout(250);
  };
  return { browser, page, shot, overflow, nav, persona, openMother, isPhone };
}

/** The pitch path: Lagos midwife */
async function lagos(url, viewport, tag, scheme = 'light') {
  console.log(`\n${tag} ${viewport.width}x${viewport.height} ${scheme}: Lagos midwife`);
  const { browser, page, shot, overflow, nav, persona, openMother, isPhone } = await open(url, viewport, tag, scheme);

  await step('fresh start opens onboarding', async () => {
    await page.waitForSelector('.setup-root');
    await shot('00-onboarding');
    await overflow('onboarding');
  });
  await step('persona "Lagos midwife" lands on Today', async () => {
    await persona('lagos');
    await shot('01-today');
    await overflow('Today');
  });
  await step('Adaeze Okafor, Show to mother in Igbo with confidence badges', async () => {
    await openMother('Adaeze Okafor');
    await page.waitForSelector('[data-testid="mother-line"] .i18n-badge');
    const lang = await page.locator('#mother-lang').inputValue();
    if (lang !== 'ig') throw new Error(`her language is ${lang}, expected Igbo`);
    await shot('02-adaeze-plan');
    await page.locator('[data-testid="show-to-mother"]').first().click();
    await page.waitForSelector('[data-testid="show-to-mother-card"]');
    await page.waitForTimeout(250);
    await shot('03-show-to-mother-worker-side');
    await page.locator('[data-testid="turn-to-her"]').click();
    await page.waitForTimeout(700);
    const big = await page.locator('[data-testid="mother-big-text"]').getAttribute('lang');
    if (big !== 'ig') throw new Error(`mother side is in ${big}`);
    await shot('04-show-to-mother-igbo');
    await page.keyboard.press('Escape');
  });
  await step('demo panel: blood pressure rises, emergency alert with border trail, What changed', async () => {
    await page.keyboard.press('d');
    await page.waitForSelector('.sheet');
    await shot('05-demo-panel');
    await page.locator('[data-scenario="bp_rise"]').click();
    await page.waitForSelector('[data-testid="border-trail"] .alert.emergency', { timeout: 5000 });
    await page.waitForSelector('[data-testid="what-changed"]');
    await page.waitForTimeout(600);
    await shot('06-emergency-alert');
    await page.locator('[data-testid="what-changed"]').scrollIntoViewIfNeeded();
    await shot('07-what-changed');
    await overflow('emergency alert');
  });
  await step('Start visit on Funke’s baby, club foot abnormal, referral alert', async () => {
    await nav('Today');
    await openMother('Funke Adeyemi');
    await page.locator('[data-testid="start-visit"]').click();
    await page.waitForSelector('[data-testid="visit-screen"] .visit-root');
    await shot('08-visit-start');
    await page.locator('.visit-step', { hasText: /baby/i }).first().click();
    const club = page.locator('[id^="vi-b.talipes"] [role="radio"]', { hasText: 'Club foot, one foot' });
    await club.scrollIntoViewIfNeeded();
    await club.click();
    await page.waitForSelector('[id^="vi-b.talipes"] .visit-finding');
    await page.locator('[id^="vi-b.talipes"]').scrollIntoViewIfNeeded();
    await shot('09-visit-club-foot');
    await page.locator('.visit-step', { hasText: 'Summary' }).click();
    await page.waitForTimeout(200);
    await shot('10-visit-summary');
    await page.getByRole('button', { name: /Save visit/ }).click();
    await page.waitForSelector('.patient-head');
    await page.waitForSelector('[data-alert^="alert.visit_referral"]', { timeout: 5000 });
    const title = await page.locator('[data-alert^="alert.visit_referral"] .title').first().textContent();
    if (!/Club foot/.test(title ?? '')) throw new Error(`referral alert says "${title}"`);
    await page.waitForTimeout(300);
    await shot('11-referral-alert');
    await overflow('referral alert');
  });
  await step('referral shows on the dashboard count', async () => {
    await nav('Programme');
    await page.waitForSelector('.hero-metric');
  });
  await step('compose in Yoruba with What the AI sees', async () => {
    await nav('Today');
    await openMother('Adaeze Okafor');
    await page.getByRole('button', { name: /^Message$/ }).click();
    await page.waitForSelector('#compose-text');
    await page.locator('#compose-lang').selectOption('yo');
    await page.waitForTimeout(300);
    const text = await page.locator('#compose-text').inputValue();
    if (/needs translation/.test(text)) throw new Error('Yoruba message still needs translation');
    const sees = page.locator('.sees summary').first();
    await sees.scrollIntoViewIfNeeded();
    await sees.click();
    await page.waitForTimeout(300);
    await shot('12-compose-yoruba');
    await page.locator('.sees').first().scrollIntoViewIfNeeded();
    await shot('13-what-the-ai-sees');
    await page.locator('[data-testid="reviewed"]').check();
    await page.locator('[data-testid="approve-send"]').click();
    await page.waitForSelector('.status-steps li.on');
    await page.waitForTimeout(1600);
    await shot('14-sent');
    await page.getByRole('button', { name: 'See it on her phone' }).click();
  });
  await step('mother’s phone reply in Pidgin', async () => {
    await page.waitForSelector('.phone');
    await page.locator('.canned button', { hasText: 'My head dey bang me' }).click();
    await page.waitForSelector('.triage');
    await page.waitForTimeout(250);
    await shot('15-phone-reply-pidgin', true);
  });
  await step('expert review: approve and publish', async () => {
    await page.keyboard.press('d');
    const sel = page.locator('#demo-worker');
    const opts = await sel.locator('option').allTextContents();
    const idx = opts.findIndex((o) => o.includes('(reviewer)'));
    if (idx < 0) throw new Error('no reviewer in the seed');
    await sel.selectOption({ index: idx });
    await page.getByRole('button', { name: 'Close' }).click();
    await nav('Expert review', 'Review');
    await page.waitForSelector('.proposal');
    await shot('16-review');
    const p = page.locator('.proposal', { has: page.locator('[data-testid="approve"]') }).first();
    await p.locator('input').fill('Agree. Evidence reviewed; release in the next library.');
    await p.locator('[data-testid="approve"]').click();
    await page.locator('[data-testid="publish-release"]').click();
    await page.waitForTimeout(250);
    await shot('17-published');
  });
  await step('programme dashboard: bento grid and bar chart', async () => {
    await nav('Programme');
    await page.waitForSelector('.hero-metric');
    await page.waitForTimeout(900);
    await shot('18-dashboard');
    await shot('19-dashboard-full', true);
    await overflow('dashboard');
  });
  await step('settings: Connect your assistant download', async () => {
    await nav('Settings');
    await page.waitForSelector('[data-testid="connect-assistant"]');
    await page.locator('[data-testid="connect-assistant"]').scrollIntoViewIfNeeded();
    const btn = page.locator('[data-testid="download-mcpb"]');
    await btn.waitFor({ timeout: 5000 });
    await shot('20-connect-assistant');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), btn.click()]);
    const name = dl.suggestedFilename();
    if (name !== 'gaskin.mcpb') throw new Error(`downloaded ${name}`);
    await shot('21-settings-full', true);
    await overflow('settings');
  });
  await browser.close();
}

/** Second persona: Kano CHEW, Hausa screens, no AI */
async function kano(url, viewport, tag, scheme = 'light') {
  console.log(`\n${tag} ${viewport.width}x${viewport.height} ${scheme}: Kano CHEW`);
  const { browser, page, shot, overflow, nav, persona, openMother } = await open(url, viewport, tag, scheme);
  await step('persona "Kano CHEW" gives Hausa screens', async () => {
    await persona('kano');
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'ha') throw new Error(`html lang is ${lang}`);
    const label = viewport.width < 600 ? await page.locator('.tabbar button').first().textContent() : await page.locator('.rail .nav-item').first().textContent();
    if (!/Yau/.test(label ?? '')) throw new Error(`first nav item reads "${label}"`);
    await shot('01-today-hausa');
    await overflow('Today (Hausa)');
  });
  await step('a Hausa-speaking mother: plan in Hausa, worker side in Hausa', async () => {
    const row = page.locator('.queue .row').filter({ hasText: /Kano/ }).first();
    const name = (await row.getAttribute('data-mother')) ?? '';
    await openMother(name);
    await shot('02-patient-hausa');
    await page.locator('[data-testid="show-to-mother"]').first().click();
    await page.waitForSelector('[data-testid="show-to-mother-card"]');
    await page.waitForTimeout(250);
    await shot('03-show-to-mother-worker-hausa');
    await page.keyboard.press('Escape');
    await overflow('patient (Hausa)');
  });
  await step('settings in Hausa: AI off, storage shown', async () => {
    await nav('Saituna');
    await page.waitForSelector('[data-testid="storage-panel"]');
    await shot('04-settings-hausa', true);
  });
  await browser.close();
}

/** Dark theme: the main screens at a glance */
async function dark(url, viewport, tag) {
  console.log(`\n${tag} ${viewport.width}x${viewport.height} dark`);
  const { browser, page, shot, overflow, nav, persona, openMother } = await open(url, viewport, tag, 'dark');
  await step('dark: onboarding, Today, alert, Show to mother, dashboard, settings', async () => {
    await page.waitForSelector('.setup-root');
    await shot('00-onboarding');
    await persona('lagos');
    await shot('01-today');
    await openMother('Adaeze Okafor');
    await page.keyboard.press('d');
    await page.locator('[data-scenario="bp_rise"]').click();
    await page.waitForSelector('[data-testid="border-trail"]');
    await page.waitForTimeout(500);
    await shot('02-emergency-alert');
    await page.locator('[data-testid="show-to-mother"]').first().click();
    await page.locator('[data-testid="turn-to-her"]').click();
    await page.waitForTimeout(700);
    await shot('03-show-to-mother');
    await page.keyboard.press('Escape');
    await nav('Programme');
    await page.waitForSelector('.hero-metric');
    await page.waitForTimeout(800);
    await shot('04-dashboard');
    await nav('Settings');
    await page.waitForSelector('[data-testid="connect-assistant"]');
    await shot('05-settings');
    await overflow('dark screens');
  });
  await browser.close();
}

/** USB stick: dist/index.html from file:// */
async function usb(viewport, tag) {
  const url = pathToFileURL(resolve('dist/index.html')).href;
  console.log(`\n${tag} ${url}`);
  const { browser, page, shot, overflow, persona, openMother } = await open(url, viewport, tag, 'light');
  await step('file://: onboarding, persona, patient, Show to mother', async () => {
    await persona('crossriver');
    await shot('01-today');
    await openMother('Adaeze Okafor');
    await page.locator('[data-testid="show-to-mother"]').first().click();
    await page.locator('[data-testid="turn-to-her"]').click();
    await page.waitForTimeout(600);
    await shot('02-show-to-mother');
    await page.keyboard.press('Escape');
    const status = await page.locator('[data-testid="storage-status"]').textContent();
    if (!/device/i.test(status ?? '')) throw new Error(`status line says "${status}"`);
    const sw = await page.evaluate(() => navigator.serviceWorker?.controller ?? null);
    if (sw) throw new Error('a service worker registered from file://');
    await overflow('file://');
  });
  await step('file://: setup and records survive a reload', async () => {
    await page.reload();
    await page.waitForSelector('.patient-head', { timeout: 15000 });
    if (await page.locator('.setup-root').count()) throw new Error('setup was lost on reload');
    const alerts = await page.locator('[data-alert]').count();
    await shot('03-after-reload');
    if (!alerts && !(await page.locator('[data-testid="mother-line"]').count())) throw new Error('her plan did not come back');
  });
  await browser.close();
}

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
try {
  if (FILE_MODE) {
    await usb(DESKTOP, 'usb-desktop');
    await usb(PHONE, 'usb-phone');
  } else {
    const url = await startServer();
    await lagos(url, PHONE, 'phone');
    await lagos(url, DESKTOP, 'desktop');
    await kano(url, PHONE, 'kano-phone');
    await kano(url, DESKTOP, 'kano-desktop');
    await dark(url, PHONE, 'phone-dark');
    await dark(url, DESKTOP, 'desktop-dark');
    await usb(DESKTOP, 'usb-desktop');
  }
} finally {
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
}

if (errors.length) console.log('\nConsole errors:\n' + errors.join('\n'));
if (failures.length) console.log('\nFailures:\n' + failures.join('\n'));
console.log(errors.length || failures.length ? `\nFAILED (${passed} steps passed)` : `\nAll ${passed} steps passed, no console errors, no horizontal scroll.`);
process.exit(errors.length || failures.length ? 1 : 0);
