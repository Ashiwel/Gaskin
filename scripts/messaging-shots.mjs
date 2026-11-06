// Screenshots of Messages (her phone, the hub), Compose, the handout, Expert review, Insights and
// the Library at 390×844 and 1440×900, light and dark. Fails on console errors or horizontal scroll.
// Usage: npx vite build && node scripts/messaging-shots.mjs [url] [--only=390-light]
//        (OUTDIR=<folder> serves a build made with `npx vite build --outDir <folder>`)
// Writes docs/screens/v2/messaging/*.png.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens/v2/messaging');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const PORT = 4177;

let server;
async function start() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (arg) return arg;
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', ...(process.env.OUTDIR ? ['--outDir', process.env.OUTDIR] : [])], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => String(d).includes(String(PORT)) && (clearTimeout(t), res()));
  });
  return `http://localhost:${PORT}/`;
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
  if (persona) {
    await page.waitForSelector(`[data-persona="${persona}"]`, { timeout: 15000 });
    await page.locator(`[data-persona="${persona}"]`).first().click();
  } else {
    await page.waitForSelector('[data-testid="skip-all"]', { timeout: 15000 });
    await page.locator('[data-testid="skip-all"]').first().click();
  }
  await page.waitForTimeout(800);
  const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
  const overflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) problems.push(`[${tag}] horizontal scroll of ${o}px on ${where}`);
  };
  const PIN = '2580';
  const unlock = async () => {
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(300);
      const gate = page.locator('[data-testid="lock-screen"], [data-testid="worker-name"], [data-testid="recovery-code"], [data-profile]').first();
      if (!(await gate.isVisible().catch(() => false))) return;
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
    }
  };
  /** Navigate in the page (no reload, so the session is kept). */
  const go = async (route, hash) => {
    await unlock();
    await page.evaluate(
      ([r, h]) => {
        window.history.pushState({ route: r, depth: 1 }, '', h);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
        window.scrollTo(0, 0);
      },
      [route, hash],
    );
    await page.waitForTimeout(600);
  };
  return { ctx, page, shot, overflow, go, phone, tag, unlock };
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
      const { ctx, page, shot, overflow, go, phone, tag } = await session(width, scheme);

      await step(tag, 'messages hub', async () => {
        await go({ name: 'phone' }, '#her-phone');
        await page.waitForSelector(phone ? '[data-testid="threads"]' : '[data-testid="phone-smart"], [data-testid="phone-feature"]', { timeout: 10000 });
        await shot('01-messages');
        await overflow('messages hub');
      });
      await step(tag, 'smartphone, reply as her in Pidgin', async () => {
        await go({ name: 'phone', id: 'm-ng-adaeze' }, '#her-phone');
        await page.waitForSelector('[data-testid="phone-smart"]');
        const c = page.locator('.canned button', { hasText: 'My head dey bang me' });
        await c.scrollIntoViewIfNeeded();
        await c.click();
        await page.waitForSelector('[data-testid="understood"]');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await shot('02-smartphone-reply');
        await shot('02b-smartphone-full', true);
        await overflow('smartphone');
      });
      await step(tag, 'feature phone with SMS in Yoruba', async () => {
        await go({ name: 'phone', id: 'm-ng-funke' }, '#her-phone');
        await page.waitForSelector('[data-testid="phone-feature"]');
        await shot('03-feature-phone');
        await overflow('feature phone');
      });
      await step(tag, 'Arabic, right to left', async () => {
        await go({ name: 'phone', id: 'm-ng-kaltuma' }, '#her-phone');
        await page.waitForSelector('[data-testid="phone-feature"], [data-testid="phone-smart"]');
        const c = page.locator('.canned button').first();
        await c.scrollIntoViewIfNeeded();
        await c.click();
        await page.waitForTimeout(400);
        const dir = await page.locator('[data-testid="phone-feature"] p[dir="rtl"], [data-testid="phone-smart"] p[dir="rtl"]').count();
        if (!dir) throw new Error('no right-to-left message on her phone');
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot('04-arabic-rtl');
      });
      await step(tag, 'no phone: print or a call through her family', async () => {
        await go({ name: 'patient', id: 'm-gh-abiba', tab: 'messages', sheet: 'compose' }, '#mother-m-gh-abiba');
        await page.waitForSelector('[data-testid="compose"]');
        const chs = await page.locator('[data-testid="compose"] [data-channel]').evaluateAll((els) => els.map((e) => e.getAttribute('data-channel')));
        if (chs.some((c) => c === 'sms' || c === 'whatsapp')) throw new Error(`no-phone mother offered ${chs.join(', ')}`);
        await shot('05-compose-no-phone');
        await page.keyboard.press('Escape');
      });
      await step(tag, 'compose in Yoruba, AI panel, guardrails, send', async () => {
        await go({ name: 'patient', id: 'm-ng-adaeze', tab: 'messages', sheet: 'compose' }, '#mother-m-ng-adaeze');
        await page.waitForSelector('#compose-text');
        await page.locator('#compose-lang').selectOption('yo');
        await page.waitForTimeout(300);
        await shot('06-compose');
        const sees = page.locator('[data-testid="compose"] [data-testid="what-ai-sees"] summary');
        await sees.scrollIntoViewIfNeeded();
        await sees.click();
        await page.waitForTimeout(300);
        await shot('07-what-the-ai-sees');
        await page.locator('[data-testid="guardrails"]').scrollIntoViewIfNeeded();
        await shot('08-guardrails');
        await page.locator('[data-testid="reviewed"]').click();
        await page.locator('[data-testid="approve-send"]').click();
        await page.waitForSelector('[data-testid="delivery-track"]');
        await page.waitForTimeout(3400);
        await shot('09-sent-track');
        await overflow('compose');
        await page.keyboard.press('Escape');
      });
      await step(tag, 'messages tab on her record', async () => {
        await go({ name: 'patient', id: 'm-ng-adaeze', tab: 'messages' }, '#mother-m-ng-adaeze');
        await page.waitForTimeout(400);
        await shot('10-messages-tab', true);
      });
      await step(tag, 'handout A4 preview, sandboxed', async () => {
        await go({ name: 'patient', id: 'm-ng-adaeze', tab: 'plan', sheet: 'handout' }, '#mother-m-ng-adaeze');
        await page.waitForSelector('[data-testid="handout-frame"]');
        const sb = await page.locator('[data-testid="handout-frame"]').getAttribute('sandbox');
        if (sb !== '') throw new Error(`handout sandbox is "${sb}"`);
        await page.locator('[data-lang="ig"]').click();
        await page.waitForTimeout(700);
        await shot('11-handout');
        await overflow('handout');
        await page.keyboard.press('Escape');
      });
      await step(tag, 'expert review as a health worker (read only)', async () => {
        await go({ name: 'review' }, '#review');
        await page.waitForSelector('[data-proposal]');
        await page.waitForTimeout(500);
        await shot('12-review');
        await shot('13-review-full', true);
        await overflow('review');
      });
      await step(tag, 'insights', async () => {
        await go({ name: 'insights' }, '#insights');
        await page.waitForSelector('[data-testid="hero-metric"]');
        await page.waitForTimeout(900);
        await shot('16-insights');
        await shot('17-insights-full', true);
        await page.locator('[data-testid="public-table"]').scrollIntoViewIfNeeded();
        await shot('18-public-data');
        await overflow('insights');
      });
      await step(tag, 'library', async () => {
        await go({ name: 'library', page: 'practices' }, '#library');
        await page.waitForSelector('[data-testid="practice-grid"]');
        await shot('19-library');
        await page.locator('[data-practice] button[aria-expanded]').first().click();
        await page.waitForTimeout(200);
        await shot('20-library-open');
        await go({ name: 'library', page: 'how' }, '#library');
        await page.waitForSelector('[data-testid="how-diagram"]');
        await shot('21-how-diagram', true);
        await go({ name: 'library', page: 'sources' }, '#library');
        await page.waitForSelector('[data-testid="evidence-legend"]');
        await shot('22-sources');
        await overflow('library');
      });
      await ctx.close();

      // A clinical reviewer: start as the Lagos persona (demo profiles), then act as Dr Bankole.
      {
        const r = await session(width, scheme, 'lagos');
        await step(tag, 'expert review as the clinical reviewer: approve and publish', async () => {
          await r.unlock();
          await r.page.waitForSelector('main#main', { timeout: 15000 });
          await r.page.keyboard.press('d');
          const sel = r.page.locator('#demo-worker');
          await sel.waitFor({ timeout: 20000 }).catch(async (e) => {
            await r.shot('debug-reviewer');
            throw e;
          });
          const opts = await sel.locator('option').allTextContents();
          const idx = opts.findIndex((o) => /Bankole/.test(o));
          if (idx < 0) throw new Error('no reviewer profile in the demo');
          await sel.selectOption({ index: idx });
          await r.page.waitForTimeout(600);
          await r.page.keyboard.press('Escape');
          await r.unlock();
          await r.go({ name: 'review' }, '#review');
          const p = r.page.locator('[data-proposal]', { has: r.page.locator('[data-testid="approve"]') }).first();
          await p.waitFor({ timeout: 20000 });
          await r.shot('14-review-reviewer');
          await p.locator('textarea').fill('Agree. Evidence reviewed; release in the next library.');
          await p.locator('[data-testid="approve"]').click();
          await r.page.waitForTimeout(300);
          await r.page.getByRole('button', { name: /^Releases/ }).click();
          await r.page.waitForSelector('[data-testid="release-notes"]');
          await r.shot('15-release-pending');
          await r.page.locator('[data-testid="publish-release"]').click();
          await r.page.waitForTimeout(400);
          await r.shot('15b-release-published', true);
          await r.overflow('releases');
        });
        await r.ctx.close();
      }
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
console.log('\nAll messaging, review, Insights and library screens pass: no console errors, no horizontal scroll.');
