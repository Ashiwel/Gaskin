// Renders every pictogram and a sample handout to HTML and PNG for visual review.
// Usage: node scripts/contact-sheet.mjs [outDir]   (defaults to docs/)
import { createServer } from 'vite';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.argv[2] ?? 'docs');
mkdirSync(outDir, { recursive: true });

const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const lib = await server.ssrLoadModule('/src/illustrations/index.ts');
const { sampleHandoutInput } = await server.ssrLoadModule('/src/illustrations/sample.ts');
await server.close();

const { ILLUSTRATION_KEYS, ILLUSTRATION_LABELS, renderIllustration, renderHandoutHTML } = lib;

const cells = ILLUSTRATION_KEYS.map(
  (k) => `<figure>${renderIllustration(k, { size: 150 })}<div class="sm">${renderIllustration(k, { size: 64 })}<div class="bw">${renderIllustration(k, { size: 64 })}</div></div><figcaption><b>${k}</b><br>${ILLUSTRATION_LABELS[k]}</figcaption></figure>`,
).join('');
const sheet = `<!doctype html><meta charset="utf-8"><title>Gaskin pictograms</title>
<style>body{margin:0;padding:24px;background:#fff;font:13px system-ui,sans-serif;color:#2A1C15}
h1{font-size:20px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
figure{margin:0;border:1px solid #e6dccb;border-radius:10px;padding:10px;display:grid;grid-template-columns:150px 64px;gap:8px;align-items:start}
.sm{display:grid;gap:8px}.bw{filter:grayscale(1)}figcaption{grid-column:1/-1;line-height:1.3}</style>
<h1>Gaskin pictograms: ${ILLUSTRATION_KEYS.length} keys (150 px, 64 px, 64 px grayscale)</h1><div class="grid">${cells}</div>`;
writeFileSync(resolve(outDir, 'illustrations-contact-sheet.html'), sheet);

const handout = renderHandoutHTML(sampleHandoutInput());
writeFileSync(resolve(outDir, 'handout-sample.html'), handout);

const chromePaths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = chromePaths.find((p) => existsSync(p));
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.log('playwright-core not available; HTML written only.');
  process.exit(0);
}
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(sheet);
await page.screenshot({ path: resolve(outDir, 'illustrations-contact-sheet.png'), fullPage: true });

// The handout, as printed: emulate print media at A4 width (210 mm ~ 794 css px).
const hp = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
await hp.emulateMedia({ media: 'print' });
await hp.setContent(handout);
await hp.screenshot({ path: resolve(outDir, 'handout-sample.png'), fullPage: true });
const pdfPath = resolve(outDir, 'handout-sample.pdf');
await hp.pdf({ path: pdfPath, format: 'A4', preferCSSPageSize: true, printBackground: true });

// If poppler is installed, replace the screen capture with the real printed pages side by side.
try {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, readdirSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(resolve(tmpdir(), 'gaskin-pages-'));
  execFileSync('pdftoppm', ['-r', '90', '-png', pdfPath, resolve(dir, 'p')]);
  const imgs = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
    .map((f) => `<img src="data:image/png;base64,${readFileSync(resolve(dir, f)).toString('base64')}">`).join('');
  const pp = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await pp.setContent(`<body style="margin:0;padding:20px;background:#8a8a8a;display:flex;gap:20px;align-items:flex-start;width:max-content">${imgs.replace(/<img /g, '<img style="box-shadow:0 2px 8px rgba(0,0,0,.4)" ')}</body>`);
  await pp.screenshot({ path: resolve(outDir, 'handout-sample.png'), fullPage: true });
} catch (e) {
  console.log('pdftoppm unavailable, kept screen capture:', e.message);
}
await browser.close();
console.log('wrote', outDir);
