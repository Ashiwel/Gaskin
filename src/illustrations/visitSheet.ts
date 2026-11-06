/**
 * "Next steps" after a visit: one printable page for the mother, led by pictures for low
 * literacy. A daily medicine calendar with pill icons, foods with servings, how-to steps, danger
 * signs with the emergency number, tests to do and where, the next visit date and place, and who
 * saw her. Self-contained: no external fonts, images or scripts (its own CSP forbids them), every
 * string escaped, grayscale-safe (meaning never rests on colour: icons, words and borders carry
 * it), and laid out for A4 or US Letter.
 */
import type { IllustrationKey } from '../types';
import { escapeHtml, HANDOUT_CSP } from './handout';
import { ILLUSTRATION_LABELS, renderIllustration } from './render';

export interface VisitSheetMedicine {
  name: string;
  /** e.g. "1 tablet" */
  dose?: string;
  /** Plain timing, e.g. "every night with food" */
  when?: string;
  /** Times a day, for the calendar (1 to 4) */
  perDay?: number;
  /** Days to show on the calendar (default 7) */
  days?: number;
  illustration?: IllustrationKey;
}

export interface VisitSheetInput {
  /** Her first name */
  name: string;
  /** Child names this visit covered */
  children?: string[];
  /** e.g. "26 weeks pregnant", "Baby is 6 weeks old" */
  stage?: string;
  /** BCP-47-ish language code for <html lang> */
  language: string;
  dir?: 'ltr' | 'rtl';
  /** Section headings and fixed words, already in her language (English defaults) */
  labels?: Partial<VisitSheetLabels>;
  visitDate: string;
  medicines: VisitSheetMedicine[];
  foods: Array<{ name: string; serving?: string; note?: string }>;
  /** Things to do, each with optional steps and a picture */
  todo: Array<{ title: string; steps?: string[]; illustration?: IllustrationKey }>;
  dangerSigns: Array<{ label: string; illustration?: IllustrationKey }>;
  tests: Array<{ name: string; where?: string; when?: string }>;
  nextVisit?: { date: string; label?: string; place?: string };
  emergencyNumber?: string;
  workerName?: string;
  facilityName?: string;
  brandName?: string;
  paper?: 'A4' | 'Letter';
}

export interface VisitSheetLabels {
  title: string;
  everyDay: string;
  eat: string;
  howTo: string;
  danger: string;
  dangerGo: string;
  call: string;
  tests: string;
  nextVisit: string;
  seenBy: string;
  bring: string;
  days: string[];
  morning: string;
  evening: string;
}

export const VISIT_SHEET_LABELS: VisitSheetLabels = {
  title: 'Your next steps',
  everyDay: 'Every day',
  eat: 'Eat these foods',
  howTo: 'How to do it',
  danger: 'Danger signs',
  dangerGo: 'If you see any of these, go to the clinic now. Do not wait.',
  call: 'Call',
  tests: 'Tests to do',
  nextVisit: 'Your next visit',
  seenBy: 'Seen by',
  bring: 'Bring this paper to your next visit.',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  morning: 'Morning',
  evening: 'Night',
};

const DANGER_FALLBACK: IllustrationKey = 'baby_danger';

function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** A small pill drawn in black outline, filled grey so it prints in grayscale; ticked boxes are left empty for her to mark. */
function pill(): string {
  return '<svg class="pill" viewBox="0 0 24 12" aria-hidden="true"><rect x="1" y="1" width="22" height="10" rx="5" fill="white" stroke="black" stroke-width="1.5"/><path d="M12 1h6a5 5 0 0 1 0 10h-6z" fill="gray"/><line x1="12" y1="1" x2="12" y2="11" stroke="black" stroke-width="1.2"/></svg>';
}

function medCalendar(m: VisitSheetMedicine, L: VisitSheetLabels): string {
  const perDay = Math.max(1, Math.min(4, m.perDay ?? 1));
  const days = Math.max(1, Math.min(7, m.days ?? 7));
  const head = L.days.slice(0, days).map((d) => `<th>${escapeHtml(d)}</th>`).join('');
  const rows = Array.from({ length: perDay }, (_, r) => {
    const label = perDay === 1 ? '' : r === 0 ? L.morning : r === perDay - 1 ? L.evening : '';
    return `<tr><th class="slot">${escapeHtml(label)}</th>${Array.from({ length: days }, () => `<td><span class="box">${pill()}</span></td>`).join('')}</tr>`;
  }).join('');
  return `<div class="med">
  <div class="med-head">${renderIllustration(m.illustration ?? 'iron_tablet', { size: 72, title: m.name })}<div><div class="med-name">${escapeHtml(m.name)}</div><div class="med-dose">${escapeHtml([m.dose, m.when].filter(Boolean).join(', '))}</div></div></div>
  <table class="cal"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
</div>`;
}

const CSS = (paper: 'A4' | 'Letter') => `
@page { size: ${paper === 'Letter' ? 'letter' : 'A4'}; margin: 11mm 11mm 12mm 11mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: white; color: black; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif; font-size: 13pt; line-height: 1.35; }
.sheet { max-width: ${paper === 'Letter' ? '193mm' : '188mm'}; margin: 0 auto; }
@media screen { body { background: gainsboro; padding: 8mm 0; } .sheet { background: white; padding: 10mm; outline: 1px solid silver; } }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; padding-bottom: 3mm; border-bottom: 1mm solid black; }
.brand { font-size: 10pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
h1 { font-size: 24pt; line-height: 1.05; margin: 1mm 0 0; font-weight: 800; }
.stage { font-size: 13pt; font-weight: 600; margin-top: 1mm; }
.meta { text-align: right; font-size: 10.5pt; line-height: 1.45; }
h2 { display: flex; align-items: center; gap: 2.5mm; font-size: 15pt; margin: 0 0 2mm; font-weight: 800; }
h2 .n { display: inline-grid; place-items: center; width: 8mm; height: 8mm; border-radius: 50%; background: black; color: white; font-size: 11pt; }
section { margin-top: 4.5mm; break-inside: avoid; page-break-inside: avoid; }
.danger { border: 1.2mm solid black; border-radius: 3mm; overflow: hidden; }
.danger .head { display: flex; justify-content: space-between; align-items: center; gap: 4mm; background: black; color: white; padding: 2mm 4mm; font-weight: 800; font-size: 14pt; }
.danger .head .call { font-size: 17pt; white-space: nowrap; }
.danger .signs { display: flex; flex-wrap: wrap; gap: 2mm 4mm; padding: 3mm; }
.danger .sign { width: 40mm; display: flex; align-items: center; gap: 2mm; font-size: 11pt; font-weight: 700; line-height: 1.15; }
.danger .sign svg { width: 17mm; height: 17mm; flex: none; filter: grayscale(1) contrast(1.15); }
.danger .go { padding: 0 4mm 3mm; font-weight: 600; font-size: 12pt; }
.med { border: .5mm solid black; border-radius: 3mm; padding: 3mm; margin-bottom: 3mm; break-inside: avoid; }
.med-head { display: flex; gap: 3mm; align-items: center; }
.med-head svg { width: 19mm; height: 19mm; flex: none; }
.med-name { font-size: 14pt; font-weight: 800; }
.med-dose { font-size: 12pt; }
.cal { width: 100%; border-collapse: collapse; margin-top: 2mm; table-layout: fixed; }
.cal th { font-size: 10pt; font-weight: 700; padding: 1mm 0; }
.cal th.slot { width: 18mm; text-align: left; font-weight: 600; }
.cal td { text-align: center; padding: 1mm 0; }
.box { display: inline-grid; place-items: center; width: 11mm; height: 9mm; border: .45mm solid black; border-radius: 1.5mm; }
.pill { width: 7mm; height: 3.5mm; }
.foods { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 4mm; margin: 0; padding: 0; list-style: none; }
.foods li { border: .4mm solid black; border-radius: 2.5mm; padding: 2mm 3mm; }
.foods b { font-size: 13pt; }
.foods .serve { display: block; font-size: 11.5pt; }
.foods .note { display: block; font-size: 10pt; color: dimgray; }
.todo { display: grid; grid-template-columns: 30mm 1fr; gap: 3mm; align-items: start; border: .4mm solid black; border-radius: 3mm; padding: 3mm; margin-bottom: 3mm; break-inside: avoid; }
.todo svg { width: 30mm; height: 30mm; }
.todo h3 { margin: 0 0 1.5mm; font-size: 13.5pt; }
.todo ol { margin: 0; padding-left: 5mm; }
.todo li { margin: .8mm 0; }
.tests { margin: 0; padding: 0; list-style: none; }
.tests li { display: flex; gap: 3mm; align-items: baseline; padding: 1.8mm 0; border-bottom: .3mm solid gray; }
.tests li::before { content: ""; display: inline-block; width: 5mm; height: 5mm; border: .45mm solid black; border-radius: 1mm; flex: none; transform: translateY(1mm); }
.tests b { font-size: 13pt; }
.next { display: grid; grid-template-columns: 26mm 1fr; gap: 4mm; align-items: center; border: 1mm solid black; border-radius: 3mm; padding: 3mm 4mm; }
.next svg { width: 26mm; height: 26mm; }
.next .k { font-size: 11pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.next .d { font-size: 20pt; font-weight: 800; line-height: 1.1; margin-top: 1mm; }
footer { margin-top: 5mm; padding-top: 3mm; border-top: .4mm solid black; font-size: 11.5pt; font-weight: 600; text-align: center; }
`;

/** A complete, standalone, printable HTML page. */
export function renderVisitSheetHTML(input: VisitSheetInput): string {
  const L: VisitSheetLabels = { ...VISIT_SHEET_LABELS, ...(input.labels ?? {}) };
  const brand = input.brandName ?? 'Gaskin';
  const paper = input.paper ?? 'A4';
  let n = 0;
  const num = () => `<span class="n">${++n}</span>`;

  const danger = input.dangerSigns.length
    ? `<section class="danger" aria-label="${escapeHtml(L.danger)}">
  <div class="head"><span>! ${escapeHtml(L.danger)}</span>${input.emergencyNumber ? `<span class="call">${escapeHtml(L.call)} ${escapeHtml(input.emergencyNumber)}</span>` : ''}</div>
  <div class="signs">${input.dangerSigns
    .slice(0, 8)
    .map((d) => `<div class="sign">${renderIllustration(d.illustration ?? DANGER_FALLBACK, { size: 64 })}<span>${escapeHtml(d.label || ILLUSTRATION_LABELS[d.illustration ?? DANGER_FALLBACK])}</span></div>`)
    .join('')}</div>
  <div class="go">${escapeHtml(L.dangerGo)}${input.facilityName ? ` ${escapeHtml(input.facilityName)}.` : ''}</div>
</section>`
    : '';

  const meds = input.medicines.length ? `<section aria-label="${escapeHtml(L.everyDay)}"><h2>${num()}${escapeHtml(L.everyDay)}</h2>${input.medicines.map((m) => medCalendar(m, L)).join('')}</section>` : '';

  const foods = input.foods.length
    ? `<section aria-label="${escapeHtml(L.eat)}"><h2>${num()}${escapeHtml(L.eat)}</h2><ul class="foods">${input.foods
        .map((f) => `<li><b>${escapeHtml(f.name)}</b>${f.serving ? `<span class="serve">${escapeHtml(f.serving)}</span>` : ''}${f.note ? `<span class="note">${escapeHtml(f.note)}</span>` : ''}</li>`)
        .join('')}</ul></section>`
    : '';

  const todo = input.todo.length
    ? `<section aria-label="${escapeHtml(L.howTo)}"><h2>${num()}${escapeHtml(L.howTo)}</h2>${input.todo
        .map((t) => `<div class="todo">${renderIllustration(t.illustration ?? 'talk_to_someone', { size: 112, title: t.title })}<div><h3>${escapeHtml(t.title)}</h3>${t.steps?.length ? `<ol>${t.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}</div></div>`)
        .join('')}</section>`
    : '';

  const tests = input.tests.length
    ? `<section aria-label="${escapeHtml(L.tests)}"><h2>${num()}${escapeHtml(L.tests)}</h2><ul class="tests">${input.tests
        .map((t) => `<li><span><b>${escapeHtml(t.name)}</b>${t.when ? `, ${escapeHtml(t.when)}` : ''}${t.where ? `. ${escapeHtml(t.where)}` : ''}</span></li>`)
        .join('')}</ul></section>`
    : '';

  const next = input.nextVisit
    ? `<section class="next" aria-label="${escapeHtml(L.nextVisit)}">${renderIllustration('calendar', { size: 104, title: L.nextVisit })}<div><div class="k">${escapeHtml(L.nextVisit)}</div><div class="d">${escapeHtml(fmtDate(input.nextVisit.date))}</div><div>${escapeHtml(
        [input.nextVisit.label, input.nextVisit.place].filter(Boolean).join(', '),
      )}</div></div></section>`
    : '';

  const meta = [`<div>${escapeHtml(fmtDate(input.visitDate))}</div>`, input.workerName ? `<div><b>${escapeHtml(L.seenBy)}:</b> ${escapeHtml(input.workerName)}</div>` : '', input.facilityName ? `<div>${escapeHtml(input.facilityName)}</div>` : ''].join('');
  const who = [input.name, ...(input.children ?? [])].filter(Boolean).join(', ');

  return `<!doctype html>
<html lang="${escapeHtml(input.language)}" dir="${input.dir === 'rtl' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${HANDOUT_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brand)}: ${escapeHtml(L.title)}</title>
<style>${CSS(paper)}</style>
</head>
<body>
<main class="sheet">
<header>
  <div><div class="brand">${escapeHtml(brand)} · ${escapeHtml(L.title)}</div><h1>${escapeHtml(who)}</h1>${input.stage ? `<div class="stage">${escapeHtml(input.stage)}</div>` : ''}</div>
  <div class="meta">${meta}</div>
</header>
${danger}
${meds}
${foods}
${todo}
${tests}
${next ? `<section>${next}</section>` : ''}
<footer>${escapeHtml(L.bring)}</footer>
</main>
</body>
</html>`;
}

/** The short version for SMS or WhatsApp. */
export function visitSheetText(input: VisitSheetInput, maxChars = 480): string {
  const L: VisitSheetLabels = { ...VISIT_SHEET_LABELS, ...(input.labels ?? {}) };
  const parts: string[] = [`${input.name}: ${L.title}.`];
  if (input.medicines.length) parts.push(`${L.everyDay}: ${input.medicines.map((m) => [m.name, m.when].filter(Boolean).join(' ')).join('; ')}.`);
  if (input.foods.length) parts.push(`${L.eat}: ${input.foods.slice(0, 4).map((f) => f.name).join(', ')}.`);
  if (input.tests.length) parts.push(`${L.tests}: ${input.tests.map((t) => t.name).join(', ')}.`);
  if (input.nextVisit) parts.push(`${L.nextVisit}: ${fmtDate(input.nextVisit.date)}${input.nextVisit.place ? `, ${input.nextVisit.place}` : ''}.`);
  if (input.emergencyNumber) parts.push(`${L.danger}: ${L.call} ${input.emergencyNumber}.`);
  const out = parts.join(' ');
  return out.length > maxChars ? `${out.slice(0, maxChars - 1)}…` : out;
}
