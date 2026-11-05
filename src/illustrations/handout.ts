/**
 * Printable A4 handout for a mother. Fully self-contained: no external fonts,
 * images or scripts. Every user-provided string is escaped.
 */
import type { CarePlan, IllustrationKey, LanguageCode, Mother, PlanCategory, PlanItem } from '../types';
import { ILLUSTRATION_LABELS, renderIllustration } from './render';

export interface HandoutInput {
  mother: Mother;
  plan: CarePlan;
  items: PlanItem[];
  language: LanguageCode;
  translated?: Record<string, string>;
  brandName: string;
  workerName?: string;
  facilityName?: string;
  emergencyLine?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

const CATEGORY_ILLUSTRATION: Record<PlanCategory, IllustrationKey> = {
  danger_signs: 'clinic_visit',
  visits: 'clinic_visit',
  tests: 'test_tube',
  medication: 'medicine',
  nutrition: 'balanced_plate',
  rest_and_sleep: 'rest',
  activity: 'walking',
  breastfeeding: 'breastfeeding',
  baby_care: 'warm_baby',
  immunisation: 'vaccination',
  mental_health: 'talk_to_someone',
  family_support: 'family_support',
  birth_preparedness: 'birth_bag',
  family_planning: 'family_planning',
  traditional_practice: 'family_support',
  education: 'talk_to_someone',
};

const DANGER_KEYS: IllustrationKey[] = [
  'danger_bleeding',
  'danger_headache',
  'danger_fever',
  'danger_convulsion',
  'danger_baby_movement',
  'danger_swelling',
  'danger_breathing',
  'baby_danger',
];

function illustrationFor(item: PlanItem): IllustrationKey {
  return item.illustration ?? CATEGORY_ILLUSTRATION[item.category];
}

/** Short 3-8 word label for a card. */
function shortLabel(item: PlanItem): string {
  const words = item.title.trim().split(/\s+/);
  if (words.length >= 1 && words.length <= 8) return item.title.trim();
  if (item.illustration) return ILLUSTRATION_LABELS[item.illustration];
  return words.slice(0, 8).join(' ') + '…';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function stageLine(plan: CarePlan): string {
  const s = plan.state;
  if (s.stage === 'pregnancy' && s.gestationalWeeks != null) return `${plural(Math.floor(s.gestationalWeeks), 'week', 'weeks')} pregnant`;
  if (s.stage === 'pregnancy') return 'Pregnant';
  const days = s.infantAgeDays ?? s.daysPostpartum;
  if ((s.stage === 'postpartum' || s.stage === 'infant') && days != null) {
    if (days < 14) return `Baby is ${plural(days, 'day', 'days')} old`;
    if (days < 61) return `Baby is ${plural(Math.floor(days / 7), 'week', 'weeks')} old`;
    if (days < 730) return `Baby is ${plural(Math.floor(days / 30.44), 'month', 'months')} old`;
    return `Child is ${plural(Math.floor(days / 365.25), 'year', 'years')} old`;
  }
  if (s.stage === 'preconception') return 'Planning a pregnancy';
  return '';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Danger-sign icons for the emergency band: from danger items, then alerts, then stage defaults. */
function dangerKeys(plan: CarePlan, items: PlanItem[]): IllustrationKey[] {
  const keys: IllustrationKey[] = [];
  const add = (k: IllustrationKey | undefined) => {
    if (k && DANGER_KEYS.includes(k) && !keys.includes(k)) keys.push(k);
  };
  for (const it of [...items, ...plan.items]) if (it.category === 'danger_signs' && it.status !== 'removed') add(it.illustration);
  const text = plan.alerts.map((a) => `${a.title} ${a.reason}`.toLowerCase()).join(' ');
  if (/bleed|haemorrhage|hemorrhage|pph/.test(text)) add('danger_bleeding');
  if (/headache|pre-?eclampsia|blood pressure|vision/.test(text)) add('danger_headache');
  if (/convuls|fit|eclampsia|seizure/.test(text)) add('danger_convulsion');
  if (/fever|sepsis|malaria/.test(text)) add('danger_fever');
  if (/movement/.test(text)) add('danger_baby_movement');
  if (/breath/.test(text)) add('danger_breathing');
  if (plan.alerts.some((a) => a.subject === 'child')) add('baby_danger');
  const defaults: IllustrationKey[] =
    plan.state.stage === 'pregnancy'
      ? ['danger_bleeding', 'danger_headache', 'danger_fever', 'danger_baby_movement']
      : plan.state.stage === 'preconception'
        ? []
        : ['danger_bleeding', 'danger_fever', 'baby_danger', 'danger_breathing'];
  for (const k of defaults) {
    if (keys.length >= 4) break;
    add(k);
  }
  return keys.slice(0, 6);
}

const CSS = `
@page { size: A4; margin: 12mm 12mm 14mm 12mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; background: #FFFFFF; color: #1B120D;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 13pt; line-height: 1.35;
}
.sheet { width: 186mm; margin: 0 auto; }
@media screen { body { background: #EDE6DA; padding: 10mm 0; } .sheet { background: #FFFFFF; padding: 10mm; width: 210mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
header.top { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; padding-bottom: 2.5mm; border-bottom: 1.2mm solid #1B120D; }
.brand { font-size: 11pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #2E6A4D; }
.name { font-size: 24pt; font-weight: 800; line-height: 1.05; margin: 1mm 0 0; }
.stage { font-size: 15pt; font-weight: 600; margin-top: 1mm; }
.meta { text-align: right; font-size: 11pt; line-height: 1.45; }
.meta b { font-weight: 700; }
.emergency { margin-top: 3mm; border: .9mm solid #1B120D; border-radius: 3mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
.emergency .head { background: #1B120D; color: #FFFFFF; display: flex; align-items: center; justify-content: space-between; gap: 4mm; padding: 1.5mm 4mm; font-weight: 800; font-size: 14pt; }
.emergency .head .bang { display: inline-flex; width: 8mm; height: 8mm; border-radius: 50%; background: #E0442A; color: #FFFFFF; align-items: center; justify-content: center; font-size: 15pt; margin-right: 2mm; border: .5mm solid #FFFFFF; }
.emergency .line { font-size: 16pt; white-space: nowrap; }
.emergency .signs { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 1mm 2mm; padding: 2mm 2mm 1mm; background: #FFF4EC; }
.emergency .sign { width: 40mm; display: flex; align-items: center; gap: 2mm; text-align: left; font-size: 11pt; font-weight: 700; line-height: 1.15; }
.emergency .sign svg { width: 19mm; height: 19mm; flex: none; display: block; }
.emergency .go { padding: 0 4mm 2mm; background: #FFF4EC; font-size: 12pt; font-weight: 600; text-align: center; }
.grid { margin-top: 3mm; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; break-inside: avoid; page-break-inside: avoid; }
.card { border: .6mm solid #1B120D; border-radius: 3mm; padding: 2.5mm 3mm; display: grid; grid-template-columns: 38mm 1fr; grid-template-rows: auto 1fr; column-gap: 3mm; align-items: start; min-height: 44mm; break-inside: avoid; page-break-inside: avoid; }
.card svg { width: 38mm; height: 38mm; display: block; grid-row: 1 / span 2; }
.card.danger { border-width: .9mm; }
.card h2 { font-size: 14pt; line-height: 1.15; margin: .5mm 0 1mm; font-weight: 800; }
.card p { margin: 0; font-size: 13pt; line-height: 1.28; }
.card .when { margin-top: 1mm; font-size: 11pt; font-weight: 700; color: #2E6A4D; }
.card .num { display: inline-block; min-width: 6.5mm; height: 6.5mm; line-height: 6.5mm; text-align: center; border-radius: 50%; background: #1B120D; color: #FFFFFF; font-size: 10pt; margin-right: 1.5mm; vertical-align: 1px; }
.next { display: grid; grid-template-columns: 26mm 1fr; gap: 4mm; align-items: center; border: .9mm solid #2E6A4D; border-radius: 3mm; padding: 3mm 4mm; background: #F2F7F3; break-inside: avoid; page-break-inside: avoid; }
.next svg { width: 26mm; height: 26mm; display: block; }
.next .k { font-size: 12pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #2E6A4D; }
.next .d { font-size: 19pt; font-weight: 800; line-height: 1.15; margin-top: 1mm; }
.next .l { font-size: 12pt; margin-top: 1mm; }
footer { margin-top: 4mm; padding-top: 3mm; border-top: .4mm solid #1B120D; font-size: 12pt; font-weight: 600; text-align: center; break-inside: avoid; }
`;

/**
 * Builds a complete, standalone, printable A4 HTML document for the mother.
 * Cards are laid out two per row; each row is unbreakable so a printed page
 * holds three rows (six cards) without splitting a card.
 */
export function renderHandoutHTML(input: HandoutInput): string {
  const { mother, plan, items, translated, brandName } = input;
  const first = firstName(mother.name);
  const stage = stageLine(plan);

  const hasDanger = items.some((i) => i.category === 'danger_signs') || plan.items.some((i) => i.category === 'danger_signs' && i.status !== 'removed') || plan.alerts.length > 0;
  const dKeys = hasDanger ? dangerKeys(plan, items) : [];
  const emergencyLine = input.emergencyLine?.trim();

  const emergency = hasDanger
    ? `<section class="emergency" aria-label="Danger signs">
  <div class="head"><span><span class="bang" aria-hidden="true">!</span>Danger signs: go to the clinic now</span>${
    emergencyLine ? `<span class="line">Call ${escapeHtml(emergencyLine)}</span>` : ''
  }</div>
  <div class="signs">${dKeys
    .map((k) => `<div class="sign">${renderIllustration(k, { size: 84 })}${escapeHtml(ILLUSTRATION_LABELS[k])}</div>`)
    .join('')}</div>
  <div class="go">If you see any of these, do not wait. Go to ${escapeHtml(input.facilityName ?? 'the clinic')} or the nearest hospital.</div>
</section>`
    : '';

  const cards = items.map((item, i) => {
    const key = illustrationFor(item);
    const label = shortLabel(item);
    const text = translated?.[item.id] ?? item.motherText;
    const danger = item.category === 'danger_signs';
    return `<article class="card${danger ? ' danger' : ''}">${renderIllustration(key, { size: 144, title: label })}<div><h2><span class="num">${i + 1}</span>${escapeHtml(label)}</h2><p>${escapeHtml(text)}</p>${
      item.timing ? `<div class="when">${escapeHtml(item.timing)}</div>` : ''
    }</div></article>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(`<div class="row">${cards[i]}${cards[i + 1] ?? ''}</div>`);

  const nc = plan.nextContact;
  const next = nc
    ? `<section class="next" aria-label="Next visit">${renderIllustration('calendar', { size: 112, title: 'Next visit' })}<div><div class="k">Next visit</div><div class="d">${escapeHtml(formatDate(nc.date))}</div><div class="l">${escapeHtml(nc.label)}${
        input.facilityName ? ` at ${escapeHtml(input.facilityName)}` : ''
      }</div></div></section>`
    : '';

  const meta = [
    input.facilityName ? `<div><b>Clinic:</b> ${escapeHtml(input.facilityName)}</div>` : '',
    input.workerName ? `<div><b>Health worker:</b> ${escapeHtml(input.workerName)}</div>` : '',
    `<div><b>Date:</b> ${escapeHtml(formatDate(plan.generatedAt))}</div>`,
  ].join('');

  return `<!doctype html>
<html lang="${escapeHtml(input.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brandName)} – ${escapeHtml(first)}</title>
<style>${CSS}</style>
</head>
<body>
<main class="sheet">
<header class="top">
  <div><div class="brand">${escapeHtml(brandName)}</div><h1 class="name">${escapeHtml(first)}</h1>${stage ? `<div class="stage">${escapeHtml(stage)}</div>` : ''}</div>
  <div class="meta">${meta}</div>
</header>
${emergency}
<section class="grid">
${rows.join('\n')}
</section>
${next}
<footer>Prepared with ${escapeHtml(brandName)}. Bring this sheet to your next visit.</footer>
</main>
</body>
</html>`;
}
