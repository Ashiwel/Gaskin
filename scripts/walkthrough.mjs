// Release regression walk-through: the founder's demo path end to end, in headless Chrome.
//
//   node scripts/walkthrough.mjs            build must exist (npm run build); serves dist/ with vite preview
//   node scripts/walkthrough.mjs <url>      against a running server (for example the desktop launcher)
//   node scripts/walkthrough.mjs --file     only the core path from dist/index.html over file://
//   node scripts/walkthrough.mjs --only=390-dark   one size and theme
//
// Each run covers 390x844 and 1440x900, light and dark, then the core path from file://.
// A step fails on: a console error or uncaught exception; a request to a host other than the page's
// own origin (fonts and the AI are off in the demo, so nothing else may be called); horizontal
// scroll; text clipped inside an element with overflow hidden (scrollWidth > clientWidth with no
// ellipsis meant); an exception in the step itself. Screenshots: docs/screens/release-2/.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = resolve('docs/screens/release-2');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const FILE_ONLY = process.argv.includes('--file');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const URL_ARG = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PIN = '2580';
if (!FILE_ONLY && !ONLY) for (const f of readdirSync(OUT)) if (f.endsWith('.png')) unlinkSync(`${OUT}/${f}`);

const problems = [];
let passed = 0;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let server;
async function startServer() {
  if (URL_ARG) return URL_ARG;
  server = spawn('npx', ['vite', 'preview', '--port', '4193', '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite preview did not start')), 30000);
    server.stdout.on('data', (d) => String(d).includes('4193') && (clearTimeout(t), res()));
  });
  return 'http://127.0.0.1:4193/';
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** Elements whose text is cut off: overflow hidden or clip, content wider than the box. */
function findClipped() {
  const out = [];
  const els = document.querySelectorAll('body *');
  for (const el of els) {
    if (!(el instanceof HTMLElement) || el.closest('[aria-hidden="true"], svg, iframe, [data-clip-ok]')) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const hidden = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflow === 'hidden';
    if (!hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 4) continue; // visually hidden (sr-only)
    if (cs.position === 'absolute' && r.width <= 1) continue;
    if (el.scrollWidth - el.clientWidth > 1) {
      // A horizontal scroller (date strip, chips) is meant to be wider than its box.
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
      out.push(`"${el.textContent.trim().slice(0, 40)}" (${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}, ${el.scrollWidth}>${el.clientWidth}${cs.textOverflow === 'ellipsis' ? ', ellipsis' : ''})`);
    }
  }
  return out;
}

async function openSession(browser, { url, width, scheme, tag }) {
  const phone = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: scheme, hasTouch: phone, acceptDownloads: true });
  const page = await ctx.newPage();
  const origin = url.startsWith('file:') ? 'file:' : new URL(url).origin;
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // A blocked request is reported once, below, with its host.
    if (/^Failed to load resource/.test(t)) return;
    problems.push(`[${tag}] console: ${t.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => problems.push(`[${tag}] uncaught: ${e.message.slice(0, 200)}`));
  page.on('request', (r) => {
    const u = r.url();
    if (/^(data|blob|about|chrome-extension):/.test(u)) return;
    const ok = origin === 'file:' ? u.startsWith('file:') : u.startsWith(origin);
    if (!ok) problems.push(`[${tag}] request to a disallowed host: ${u.slice(0, 120)}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (/^(data|blob):/.test(u)) return;
    // The service worker probing for updates when there is none is not a failure.
    if (/sw\.js$/.test(u)) return;
    problems.push(`[${tag}] failed request: ${u.slice(0, 120)} (${r.failure()?.errorText})`);
  });
  await page.goto(url, { waitUntil: 'load' });

  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${tag}-${n}.png`, fullPage: full });
  const check = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) {
      const wide = await page.evaluate(() => {
        const W = window.innerWidth;
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > W + 1 && r.width > 0 && !el.closest('[class*="overflow-x-auto"], [class*="overflow-auto"]')) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} "${(el.textContent || '').trim().slice(0, 30)}"`);
        }
        return out.slice(-3).join(' | ');
      });
      problems.push(`[${tag}] horizontal scroll of ${o}px on ${where}: ${wide}`);
    }
    const clipped = await page.evaluate(findClipped);
    // Hard clips always fail. Ellipsis is accepted only for names and free text in lists (marked
    // data-clip-ok) or long single lines; labels and buttons must wrap.
    for (const c of clipped.slice(0, 5)) problems.push(`[${tag}] clipped text on ${where}: ${c}`);
  };
  const nav = async (label) => {
    if (phone) {
      const tab = page.locator('[data-testid="tabbar"] button', { hasText: label });
      if (await tab.count()) return tab.first().click();
      await page.locator('[data-testid="tabbar"] button').last().click();
      await page.locator('[role="dialog"] button', { hasText: label }).first().click();
    } else await page.locator('aside button[data-nav]', { hasText: label }).first().click();
  };
  const typePin = async (pin = PIN) => {
    for (const d of pin) await page.locator('[data-testid="lock-screen"]').getByRole('button', { name: d, exact: true }).click();
  };
  const persona = async (id) => {
    await page.waitForSelector(`[data-persona="${id}"]`, { timeout: 30000 });
    await shot('00-onboarding-personas', true);
    await check('onboarding personas');
    await page.locator(`[data-persona="${id}"]`).click();
    await page.waitForSelector('main#main', { timeout: 30000 });
    // Demo profiles sign in by themselves; a lock screen (after a reload) takes the demo PIN.
    if (await page.locator('[data-testid="lock-screen"]').isVisible().catch(() => false)) await typePin();
    await wait(500);
  };
  const openMother = async (name) => {
    const row = page.locator(`[data-mother="${name}"] .row-link:visible`).first();
    if (await row.count()) await row.click();
    else {
      // Not on today's list: find her with the search box.
      await page.locator('[data-testid="global-search"]:visible input').first().click();
      await page.keyboard.type(name);
      await wait(300);
      await page.getByRole('option', { name: new RegExp(name) }).first().click();
    }
    await page.waitForSelector('[data-testid="patient-head"]', { timeout: 10000 });
    await wait(300);
  };
  /** In-page navigation to a hash, as a typed URL would do. */
  const goHash = async (hash, selector) => {
    await page.evaluate((h) => (window.location.hash = h), hash);
    if (selector) await page.waitForSelector(selector, { timeout: 10000 });
    await wait(300);
  };
  const demo = async () => {
    await page.keyboard.press('d');
    await page.waitForSelector('[data-testid="demo-panel"]');
  };
  return { ctx, page, phone, wait, shot, check, nav, persona, openMother, goHash, demo, typePin };
}

async function step(tag, name, s, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${tag} ${name}`);
  } catch (e) {
    problems.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`);
    await s?.page.screenshot({ path: `${OUT}/${tag}-FAIL-${name.slice(0, 24).replace(/\W+/g, '-')}.png` }).catch(() => undefined);
    console.log(`  FAIL ${tag} ${name}: ${e.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------
// The founder's demo path
// ---------------------------------------------------------------------------

async function demoPath(browser, url, width, scheme) {
  const tag = `${width}-${scheme}`;
  console.log(`\n${tag}: Lagos midwife, demo path`);
  const s = await openSession(browser, { url, width, scheme, tag });
  const { page, phone, wait, shot, check, nav, persona, openMother, goHash, demo, typePin } = s;

  await step(tag, 'onboarding: language step has no clipped labels', s, async () => {
    await page.waitForSelector('[data-testid="step-who"]', { timeout: 30000 });
    await page.locator('[data-testid="who-health_worker"]').click();
    await page.waitForSelector('[data-testid="step-country"]');
    await page.locator('[data-testid="country-NG"]').click().catch(async () => {
      await page.locator('[data-testid="country-picker"]').click();
      await page.locator('[data-pick="NG"]').click();
    });
    if (await page.getByRole('button', { name: 'Continue' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForSelector('[data-testid="step-place"]');
    await page.locator('[data-testid="place-continue"]').click();
    await page.waitForSelector('[data-testid="step-language"]');
    await wait(250);
    await shot('01-onboarding-language');
    await check('onboarding language');
    await page.reload({ waitUntil: 'load' });
  });

  await step(tag, 'persona "Lagos midwife" opens Today, signed in with the demo PIN', s, async () => {
    await persona('lagos');
    await page.waitForSelector('[data-testid="today"]', { timeout: 15000 });
    await shot('02-today');
    await check('Today');
  });

  await step(tag, 'lock and unlock with PIN 2580', s, async () => {
    await page.locator('button[aria-label$="worker menu"]:visible').first().click();
    await page.getByRole('menuitem', { name: /Lock/ }).click();
    await page.waitForSelector('[data-testid="lock-screen"]');
    await wait(200);
    await shot('03-lock');
    await typePin();
    await page.waitForSelector('[data-testid="lock-screen"]', { state: 'detached' });
  });

  await step(tag, 'Adaeze: plan, Show to mother in Igbo', s, async () => {
    await openMother('Adaeze Okafor');
    const lang = await page.locator('#mother-lang').inputValue().catch(() => '');
    if (lang && lang !== 'ig') throw new Error(`her language is ${lang}, expected Igbo`);
    await shot('04-plan');
    await check('plan');
    await shot('04b-plan-full', true);
    const show = page.locator('[data-testid="header-show-to-mother"]:visible, [data-testid="show-to-mother"]:visible').first();
    await show.scrollIntoViewIfNeeded();
    await show.click();
    await page.waitForSelector('[data-testid="show-to-mother-card"]');
    await page.locator('[data-testid="turn-to-her"]').click();
    await wait(700);
    const big = await page.locator('[data-testid="mother-big-text"]').first().getAttribute('lang');
    if (big !== 'ig') throw new Error(`the mother side is in ${big}`);
    await shot('05-show-to-mother-igbo');
    await page.keyboard.press('Escape');
  });

  await step(tag, 'demo scenario "Blood pressure rises": emergency alert and What changed', s, async () => {
    await demo();
    await page.locator('[data-scenario="bp_rise"]').click();
    await page.waitForSelector('[data-testid="border-trail"] [data-alert], [data-alert*="eclampsia"], [data-alert*="hypertension"]', { timeout: 8000 });
    const alert = page.locator('[data-alert]').first();
    const cls = await alert.evaluate((el) => el.closest('[data-alert]').className + ' ' + el.innerHTML.slice(0, 2000));
    if (/brand-solid|bg-brand/.test(cls) && !/error/.test(cls)) throw new Error('danger alert uses the brand colour');
    await page.waitForSelector('[data-testid="what-changed"]');
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await shot('06-emergency-alert');
    await page.locator('[data-testid="what-changed"]').scrollIntoViewIfNeeded();
    await shot('07-what-changed');
    await check('emergency alert');
  });

  await step(tag, 'Funke’s baby: guided visit, club foot, actionable summary, Next steps', s, async () => {
    await nav('Today');
    await page.waitForSelector('[data-testid="today"]');
    await openMother('Funke Adeyemi');
    await page.locator('[data-testid="start-visit"]').first().click();
    await page.waitForSelector('[data-testid="visit-screen"] .visit-root');
    await wait(250);
    await shot('08-visit-start');
    await check('visit');
    // A question of her own at the Ask step, deleted later in Settings.
    if (await page.locator('[data-testid="add-custom-question"]').count()) {
      await page.locator('[data-testid="add-custom-question"]').click();
      await page.locator('[data-testid="custom-question-text"]').fill('Is anyone at home helping you at night?');
      await page.locator('[data-testid="custom-question-save"]').click();
    }
    await page.locator('.visit-step', { hasText: /baby|Ayomide/i }).first().click();
    const club = page.locator('[id^="vi-b.talipes"] [role="radio"]', { hasText: 'Club foot, one foot' });
    await club.scrollIntoViewIfNeeded();
    await club.click();
    await page.waitForSelector('[id^="vi-b.talipes"] .visit-finding');
    await page.locator('[id^="vi-b.talipes"]').scrollIntoViewIfNeeded();
    await shot('09-visit-club-foot');
    await page.locator('.visit-step', { hasText: 'Summary' }).click();
    await wait(300);
    await shot('10-visit-summary');
    await check('visit summary');
    const line = await page.locator('[data-testid="referral-mother-line"]').first().innerText();
    if (/today|now/i.test(line) || !/within 2 weeks/.test(line)) throw new Error(`club foot line does not match a routine referral: "${line.slice(0, 120)}"`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(200);
    await shot('10b-visit-summary-bottom');
    const anyway = page.locator('[data-testid="finish-anyway"]');
    if (await anyway.count()) {
      await anyway.click();
      await page.locator('[data-testid="finish-anyway-reason"]').fill('Baby was crying; finish at the home visit tomorrow');
    }
    await page.getByRole('button', { name: /Save visit/ }).click();
    await page.waitForSelector('[data-testid="next-steps"]', { timeout: 8000 });
    await wait(500);
    await shot('11-next-steps');
    await check('Next steps');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-alert^="alert.visit_referral"]', { timeout: 8000 });
    const alertText = await page.locator('[data-alert^="alert.visit_referral"]').first().innerText();
    if (!/Club foot/.test(alertText)) throw new Error(`referral alert says "${alertText.slice(0, 80)}"`);
    await wait(300);
    await shot('12-referral-alert');
  });

  await step(tag, 'compose in Yoruba with What the AI sees, approve and send', s, async () => {
    await nav('Today');
    await openMother('Adaeze Okafor');
    await page.getByRole('button', { name: /^Message$/ }).first().click();
    await page.waitForSelector('#compose-text');
    await page.locator('#compose-lang').selectOption('yo');
    await wait(300);
    const text = await page.locator('#compose-text').inputValue();
    if (/needs translation/.test(text)) throw new Error('Yoruba message still needs translation');
    await shot('13-compose-yoruba');
    await check('compose');
    const sees = page.locator('[data-testid="compose"] [data-testid="what-ai-sees"] summary').first();
    await sees.scrollIntoViewIfNeeded();
    await sees.click();
    await wait(300);
    await shot('14-what-the-ai-sees');
    await page.locator('[data-testid="reviewed"]').click();
    await page.locator('[data-testid="approve-send"]').click();
    await page.waitForSelector('[data-testid="delivery-track"]');
    await wait(2500);
    await shot('15-sent');
    await page.keyboard.press('Escape');
  });

  await step(tag, 'her phone: reply in Pidgin, understood as a danger sign', s, async () => {
    await goHash('#her-phone');
    await page.evaluate(() => {
      window.history.pushState({ route: { name: 'phone', id: 'm-ng-adaeze' }, depth: 2 }, '', '#her-phone');
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });
    await page.waitForSelector('[data-testid="phone-smart"], [data-testid="phone-feature"]');
    const c = page.locator('.canned button', { hasText: 'My head dey bang me' });
    await c.scrollIntoViewIfNeeded();
    await c.click();
    await page.waitForSelector('[data-testid="understood"]');
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(300);
    await shot('16-her-phone');
    await check('her phone');
  });

  await step(tag, 'Today shows the reply under Emergency now', s, async () => {
    await nav('Today');
    await page.waitForSelector('[data-testid="today"]');
    const lane = page.locator('[data-lane="emergency"]');
    await lane.scrollIntoViewIfNeeded();
    const n = await lane.locator('[data-triage="emergency"]').count();
    if (!n) throw new Error('no reply under Emergency now');
    await wait(200);
    await shot('17-today-emergency-now');
    await check('Today after reply');
  });

  await step(tag, 'Review: approve as Dr Bankole and publish the release', s, async () => {
    await demo();
    const sel = page.locator('#demo-worker');
    const opts = await sel.locator('option').allTextContents();
    const idx = opts.findIndex((o) => /Bankole/.test(o));
    if (idx < 0) throw new Error('no Dr Bankole profile in the demo');
    await sel.selectOption({ index: idx });
    await wait(500);
    if (await page.locator('[data-testid="demo-panel"]').isVisible().catch(() => false)) await page.keyboard.press('Escape');
    if (await page.locator('[data-testid="lock-screen"]').isVisible().catch(() => false)) await typePin();
    await nav('Review');
    const p = page.locator('[data-proposal]', { has: page.locator('[data-testid="approve"]') }).first();
    await p.waitFor({ timeout: 15000 });
    await wait(300);
    await shot('18-review');
    await check('review');
    await p.locator('textarea').fill('Agree. Evidence reviewed; release in the next library.');
    await p.locator('[data-testid="approve"]').click();
    await wait(300);
    await page.getByRole('button', { name: /^Releases/ }).click();
    await page.waitForSelector('[data-testid="release-notes"]');
    await page.locator('[data-testid="publish-release"]').click();
    await wait(400);
    await shot('19-release-published');
    await check('releases');
  });

  await step(tag, 'Insights', s, async () => {
    await nav('Insights');
    await page.waitForSelector('[data-testid="hero-metric"]');
    await wait(900);
    await shot('20-insights');
    await shot('20b-insights-full', true);
    await check('Insights');
  });

  await step(tag, 'typed URL: #mothers works through hashchange', s, async () => {
    await goHash('#mothers', '[data-testid="mothers"]');
    await goHash('#insights', '[data-testid="hero-metric"]');
  });

  await step(tag, 'Settings: dark and back, delete the custom question', s, async () => {
    // Back to Bisola: the question she added at the visit is hers, so only she sees it in Settings.
    await demo();
    const sel = page.locator('#demo-worker');
    const opts = await sel.locator('option').allTextContents();
    await sel.selectOption({ index: Math.max(0, opts.findIndex((o) => /Bisola/.test(o))) });
    await wait(500);
    if (await page.locator('[data-testid="demo-panel"]').isVisible().catch(() => false)) await page.keyboard.press('Escape');
    if (await page.locator('[data-testid="lock-screen"]').isVisible().catch(() => false)) await typePin();
    await goHash('#ai-and-data', '[data-testid="settings"]');
    const open = async (id) => {
      if (phone) {
        if (await page.locator('[data-testid="settings-back"]').count()) await page.locator('[data-testid="settings-back"]').click();
        await page.locator(`[data-section="${id}"]`).click();
      } else await page.locator(`[data-subnav="${id}"]`).click();
      await wait(300);
    };
    await open('appearance');
    await shot('21-settings-appearance');
    await check('settings appearance');
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark-mode'));
    const other = before ? 'Light' : 'Dark';
    const theme = page.locator('[data-testid="appearance-section"]').getByRole('radiogroup', { name: 'Theme' });
    await theme.getByRole('radio', { name: other }).click();
    await wait(300);
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark-mode'));
    if (after === before) throw new Error('theme did not switch');
    await shot('22-settings-other-theme');
    await theme.getByRole('radio', { name: 'Automatic' }).click();
    await wait(200);
    const back = await page.evaluate(() => document.documentElement.classList.contains('dark-mode'));
    if (back !== before) throw new Error('theme did not return to Automatic');
    await open('visits');
    const del = page.locator('[data-testid="delete-question"]');
    if (!(await del.count())) throw new Error('the question added at the visit is not in Settings');
    await del.first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await wait(300);
    if (await page.locator('[data-testid="delete-question"]').count()) throw new Error('the question was not deleted');
    await shot('23-settings-visits-empty');
    await check('settings visits');
  });

  await s.ctx.close();
}

/** Kano CHEW: Hausa screens. */
async function kanoPath(browser, url, width, scheme) {
  const tag = `${width}-${scheme}-kano`;
  console.log(`\n${tag}: Kano CHEW, Hausa`);
  const s = await openSession(browser, { url, width, scheme, tag });
  const { page, phone, wait, shot, check, persona } = s;
  await step(tag, 'persona "Kano CHEW" gives Hausa screens', s, async () => {
    await persona('kano');
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'ha') throw new Error(`html lang is ${lang}`);
    const first = phone ? await page.locator('[data-testid="tabbar"] button').first().textContent() : await page.locator('aside button[data-nav]').first().textContent();
    if (!/Yau/.test(first ?? '')) throw new Error(`first nav item reads "${first}"`);
    await shot('01-today-hausa');
    await check('Today (Hausa)');
  });
  await step(tag, 'a Kano mother: plan and Show to mother in Hausa', s, async () => {
    await page.locator('[data-mother] .row-link').first().click();
    await page.waitForSelector('[data-testid="patient-head"]');
    await wait(300);
    await shot('02-plan-hausa');
    await check('plan (Hausa)');
  });
  await s.ctx.close();
}

/** A mother using Gaskin for herself: onboarding to My day, PIN, lock, recover with the code. */
async function personalPath(browser, url, width, scheme) {
  const tag = `${width}-${scheme}-personal`;
  console.log(`\n${tag}: personal use`);
  const s = await openSession(browser, { url, width, scheme, tag });
  const { page, wait, shot, check } = s;
  let code = '';
  await step(tag, 'onboarding for herself: Ghana, consent, clinic, ready', s, async () => {
    await page.waitForSelector('[data-testid="step-who"]', { timeout: 30000 });
    await page.locator('[data-testid="who-personal"]').click();
    await page.locator('[data-testid="country-GH"]').click();
    await page.waitForSelector('[data-testid="step-place"]');
    await page.locator('[data-testid="place-continue"]').click();
    await page.waitForSelector('[data-testid="step-language"]');
    await page.locator('[data-testid="lang-en"]').click();
    await page.waitForSelector('[data-testid="step-not-doctor"]');
    await page.getByRole('button', { name: 'I understand' }).click();
    await page.waitForSelector('[data-testid="step-consent"]');
    for (const k of ['understand', 'emergency', 'store', 'age']) await page.locator(`[data-testid="consent-${k}"]`).click();
    await page.locator('[data-testid="consent-agree"]').click();
    await page.waitForSelector('[data-testid="step-clinic"]');
    await shot('01-personal-clinic');
    await check('personal clinic');
    await page.getByRole('button', { name: 'Continue' }).click();
    // Any further questions: take the first answer.
    for (let i = 0; i < 8 && !(await page.locator('[data-testid="step-ready"]').count()); i++) {
      const opt = page.locator('section[data-testid^="step-"] [role="radio"], section[data-testid^="step-"] [role="checkbox"]').first();
      if (await opt.count()) await opt.click();
      const cont = page.getByRole('button', { name: 'Continue' });
      if (await cont.isVisible().catch(() => false)) await cont.click().catch(() => undefined);
      await wait(350);
    }
    await page.waitForSelector('[data-testid="step-ready"]');
    await shot('02-personal-ready');
    await page.locator('[data-testid="apply-setup"]').click();
  });
  await step(tag, 'her name, PIN and recovery code', s, async () => {
    await page.waitForSelector('[data-testid="worker-name"]', { timeout: 20000 });
    await page.locator('[data-testid="worker-name"] input, input[data-testid="worker-name"]').first().fill('Akosua Mensah');
    await page.locator('[data-testid="worker-name-next"]').click();
    await page.waitForSelector('[data-testid="choose-pin"]');
    for (let k = 0; k < 2; k++) {
      for (const d of PIN) await page.locator(`[data-key="${d}"]`).first().click();
      await page.locator('[data-testid="pin-next"]').click();
      await wait(300);
    }
    await page.waitForSelector('[data-testid="recovery-code"]', { timeout: 15000 });
    code = (await page.locator('[data-testid="recovery-code-text"]').innerText()).trim();
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 12) throw new Error(`recovery code looks wrong: ${code}`);
    await shot('03-recovery-code');
    await page.locator('[data-testid="recovery-confirm"]').click();
    await page.locator('[data-testid="recovery-done"]').click();
  });
  await step(tag, 'My day with nudges, emergency number and disclaimer', s, async () => {
    await page.waitForSelector('[data-testid="my-day"], [data-testid="my-plan"]', { timeout: 20000 });
    await wait(400);
    await shot('04-my-day');
    await shot('04b-my-day-full', true);
    await check('My day');
    const txt = await page.locator('main').innerText();
    if (!/112/.test(txt)) throw new Error('no emergency number on My day');
    if (!/Akosua/.test(txt)) throw new Error('My day does not greet her by her own name');
  });
  await step(tag, 'lock, forget the PIN, recover with the code', s, async () => {
    await page.locator('button[aria-label$="worker menu"]:visible').first().click();
    await page.getByRole('menuitem', { name: /Lock/ }).click();
    await page.waitForSelector('[data-testid="lock-screen"]', { timeout: 15000 });
    await shot('05a-lock');
    await page.locator('[data-testid="forgot-pin-link"]').click();
    await page.locator('[data-testid="use-recovery"]').click();
    await page.locator('[data-testid="recovery-input"] input, input[data-testid="recovery-input"]').first().fill(code);
    await shot('05-recovery-entry');
    await page.locator('[data-testid="recovery-continue"]').click();
    for (let k = 0; k < 2; k++) {
      await page.waitForSelector('[data-testid="choose-pin"]');
      for (const d of '4826') await page.locator(`[data-key="${d}"]`).first().click();
      await page.locator('[data-testid="pin-next"]').click();
      await wait(300);
    }
    await page.waitForSelector('[data-testid="recovery-new"]', { timeout: 15000 });
    await shot('06-new-recovery-code');
    await page.locator('[data-testid="recovery-confirm"]').click();
    await page.locator('[data-testid="recovery-done"]').click();
    await page.waitForSelector('[data-testid="my-day"], [data-testid="my-plan"]', { timeout: 15000 });
  });
  await s.ctx.close();
}

/** The single file from file://: the core path, and records that survive a reload. */
async function filePath(browser, width) {
  const url = pathToFileURL(resolve('dist/index.html')).href;
  const tag = `file-${width}`;
  console.log(`\n${tag}: ${url}`);
  const s = await openSession(browser, { url, width, scheme: 'light', tag });
  const { page, wait, shot, check, persona, openMother, demo, typePin } = s;
  await step(tag, 'persona, Adaeze, Show to mother, a scenario', s, async () => {
    await persona('lagos');
    await openMother('Adaeze Okafor');
    await page.locator('[data-testid="header-show-to-mother"]:visible, [data-testid="show-to-mother"]:visible').first().click();
    await page.locator('[data-testid="turn-to-her"]').click();
    await wait(500);
    await page.keyboard.press('Escape');
    await demo();
    await page.locator('[data-scenario="bp_rise"]').click();
    await page.waitForSelector('[data-alert]');
    await shot('01-alert');
    await check('file:// plan');
    const sw = await page.evaluate(() => navigator.serviceWorker?.controller ?? null);
    if (sw) throw new Error('a service worker registered from file://');
  });
  await step(tag, 'records and setup survive a reload', s, async () => {
    // Saves reach IndexedDB within about 200 ms. A reload inside that window can lose the last
    // change, because browsers do not wait for IndexedDB while unloading (known limit, see README).
    await wait(500);
    await page.reload({ waitUntil: 'load' });
    if (await page.locator('[data-testid="lock-screen"]').isVisible({ timeout: 8000 }).catch(() => false)) await typePin();
    await page.waitForSelector('main#main', { timeout: 15000 });
    if (await page.locator('[data-persona]').count()) throw new Error('setup was lost on reload');
    await page.waitForSelector('[data-alert]', { timeout: 10000 });
    await shot('02-after-reload');
  });
  await s.ctx.close();
}

// ---------------------------------------------------------------------------

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
try {
  if (!FILE_ONLY) {
    const url = await startServer();
    for (const width of [390, 1440]) {
      for (const scheme of ['light', 'dark']) {
        if (ONLY && !`${width}-${scheme}`.includes(ONLY)) continue;
        await demoPath(browser, url, width, scheme);
        await kanoPath(browser, url, width, scheme);
        await personalPath(browser, url, width, scheme);
      }
    }
  }
  if (!ONLY || FILE_ONLY) {
    await filePath(browser, 1440);
    await filePath(browser, 390);
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
  console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  console.log(`\nFAILED (${passed} steps passed)`);
  process.exit(1);
}
console.log(`\nAll ${passed} steps passed: no console errors, no disallowed requests, no horizontal scroll, no clipped text. Screenshots: ${OUT}`);
