/**
 * Hand-authored pictograms, one per IllustrationKey. Each function returns the
 * SVG body (no <svg> wrapper) for a 120 x 120 canvas. The cream disc, default
 * stroke and the <title> are added by frame() in index.ts.
 */
import type { IllustrationKey } from '../types';
import { PALETTE as P } from './palette';
import {
  alertBadge,
  at,
  babyHead,
  bowl,
  checkBadge,
  dots,
  drop,
  limb,
  line,
  pregnantStanding,
  standingFront,
  swaddledBaby,
  womanBust,
  womanHeadFront,
} from './parts';

const ground = (cx = 60, cy = 106, rx = 34) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4" fill="${P.discShade}" stroke="none"/>`;

/** Simple face for front heads; coordinates relative to face centre, radius r. */
function face(r: number, mood: 'calm' | 'pain' | 'closed' | 'open' = 'calm'): string {
  const ex = r * 0.38;
  const ey = r * 0.12;
  const my = r * 0.5;
  if (mood === 'pain')
    return (
      `<path d="M${-ex - 2.5} ${ey - 2} L${-ex + 2} ${ey} L${-ex - 2.5} ${ey + 2} M${ex + 2.5} ${ey - 2} L${ex - 2} ${ey} L${ex + 2.5} ${ey + 2}" fill="none" stroke-width="1.8"/>` +
      `<path d="M${-r * 0.25} ${my + 2} Q0 ${my - 2} ${r * 0.25} ${my + 2}" fill="none" stroke-width="1.8"/>`
    );
  const eyes =
    mood === 'closed'
      ? `<path d="M${-ex - 2} ${ey} q2 2 4 0 M${ex - 2} ${ey} q2 2 4 0" fill="none" stroke-width="1.7"/>`
      : `<circle cx="${-ex}" cy="${ey}" r="1.5" fill="${P.ink}" stroke="none"/><circle cx="${ex}" cy="${ey}" r="1.5" fill="${P.ink}" stroke="none"/>`;
  const mouth =
    mood === 'open'
      ? `<ellipse cx="0" cy="${my}" rx="2.4" ry="3" fill="${P.ink}" stroke="none"/>`
      : `<path d="M${-r * 0.22} ${my - 1} Q0 ${my + 2} ${r * 0.22} ${my - 1}" fill="none" stroke-width="1.7"/>`;
  return eyes + mouth;
}

/** Thermometer standing upright. Origin = bulb centre. level 0..1 */
function thermometer(level: number, colour: string): string {
  const top = -42;
  const fillTop = -6 + (top + 6) * level;
  return (
    `<rect x="-5" y="${top}" width="10" height="${-top}" rx="5" fill="${P.paper}"/>` +
    `<rect x="-2" y="${fillTop}" width="4" height="${-fillTop}" fill="${colour}" stroke="none"/>` +
    `<circle cx="0" cy="0" r="8" fill="${colour}"/>` +
    line(`M5 -34 L9 -34 M5 -26 L9 -26 M5 -18 L9 -18`, P.ink, 1.6)
  );
}

function arrow(x1: number, y1: number, x2: number, y2: number, colour: string = P.ink, w = 3): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 5;
  const p1 = `${x2 - h * Math.cos(a - 0.6)} ${y2 - h * Math.sin(a - 0.6)}`;
  const p2 = `${x2 - h * Math.cos(a + 0.6)} ${y2 - h * Math.sin(a + 0.6)}`;
  return `<path d="M${x1} ${y1} L${x2} ${y2} M${p1} L${x2} ${y2} L${p2}" fill="none" stroke="${colour}" stroke-width="${w}"/>`;
}

function heart(colour: string = P.clay, s = 1): string {
  return `<path transform="scale(${s})" d="M0 7 C-11 0 -9 -10 0 -5 C9 -10 11 0 0 7 Z" fill="${colour}"/>`;
}

function sparkle(s = 1, colour: string = P.gold): string {
  return `<path transform="scale(${s})" d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z" fill="${colour}" stroke-width="1.4"/>`;
}

function sun(r = 9): string {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays += `M${(r + 3) * Math.cos(a)} ${(r + 3) * Math.sin(a)} L${(r + 7) * Math.cos(a)} ${(r + 7) * Math.sin(a)} `;
  }
  return `<path d="${rays}" stroke="${P.gold}" stroke-width="3"/><circle cx="0" cy="0" r="${r}" fill="${P.gold}"/>`;
}

/** Seated woman in profile facing right. Origin = hip on the seat. */
function seatedProfile(skin: string, top: string, wrap: string, gele: string, armTo = '16 -12'): string {
  return (
    `<path d="M-10 -6 L18 -6 C23 -6 25 -3 24 1 L27 26 L13 26 L13 5 L-10 5 Z" fill="${wrap}"/>` +
    dots('M-5 0 L18 0', P.paper, 2.6, 6) +
    `<ellipse cx="20" cy="27" rx="7" ry="2.4" fill="${P.ink}"/>` +
    `<path d="M-9 -6 C-11 -20 -9 -32 -4 -38 C1 -40 7 -38 8 -34 C10 -24 9 -14 8 -6 Z" fill="${top}"/>` +
    `<path d="M-2 -46 L-2 -38 L4 -38 L4 -46 Z" fill="${skin}"/>` +
    `<circle cx="1" cy="-50" r="8" fill="${skin}"/>` +
    `<circle cx="5" cy="-51" r="1.2" fill="${P.ink}" stroke="none"/>` +
    `<path d="M-8 -47 C-12 -57 -5 -64 3 -62 C9 -61 12 -57 10 -54 C4 -57 -2 -55 -8 -47 Z" fill="${gele}"/>` +
    `<path d="M-6 -58 C-13 -64 -8 -71 0 -65 Z" fill="${gele}"/>` +
    limb(`M0 -33 C2 -22 8 -14 ${armTo}`, skin, 5)
  );
}

function mirror(body: string): string {
  return `<g transform="scale(-1 1)">${body}</g>`;
}

/** Child silhouette, front view. Origin = feet. */
function childFigure(skin: string, cloth: string, h: number): string {
  const k = h / 60;
  return (
    `<g transform="scale(${k})">` +
    limb('M-5 -20 L-6 -2', skin, 5) +
    limb('M5 -20 L6 -2', skin, 5) +
    `<path d="M-12 -44 C-6 -48 6 -48 12 -44 L14 -18 L-14 -18 Z" fill="${cloth}"/>` +
    `<circle cx="0" cy="-54" r="9" fill="${skin}"/>` +
    `<path d="M-9 -55 C-9 -64 9 -64 9 -55 C5 -59 -5 -59 -9 -55 Z" fill="${P.hair}"/>` +
    `</g>`
  );
}

/** Small calendar page. Origin = centre. */
function calendarPage(w: number, h: number, marked: [number, number] | null, cols = 4, rows = 3): string {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const head = h * 0.24;
  let cells = '';
  const gx = (w - 8) / cols;
  const gy = (h - head - 8) / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = x0 + 4 + gx * c + gx / 2;
      const cy = y0 + head + 4 + gy * r + gy / 2;
      const isMarked = marked && marked[0] === c && marked[1] === r;
      cells += isMarked
        ? `<circle cx="${cx}" cy="${cy}" r="${Math.min(gx, gy) * 0.55}" fill="${P.gold}" stroke="${P.green}" stroke-width="3"/>`
        : `<rect x="${cx - gx * 0.28}" y="${cy - gy * 0.25}" width="${gx * 0.56}" height="${gy * 0.5}" rx="1.5" fill="${P.discShade}" stroke="none"/>`;
    }
  return (
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="${P.paper}"/>` +
    `<path d="M${x0} ${y0 + head} L${x0} ${y0 + 5} Q${x0} ${y0} ${x0 + 5} ${y0} L${-x0 - 5} ${y0} Q${-x0} ${y0} ${-x0} ${y0 + 5} L${-x0} ${y0 + head} Z" fill="${P.clay}"/>` +
    `<rect x="${x0 + w * 0.25 - 2}" y="${y0 - 5}" width="4" height="10" rx="2" fill="${P.ink}" stroke="none"/>` +
    `<rect x="${x0 + w * 0.75 - 2}" y="${y0 - 5}" width="4" height="10" rx="2" fill="${P.ink}" stroke="none"/>` +
    cells
  );
}

function pillStrip(cols: number, rows: number, colour: string, empty: number[] = []): string {
  const pw = 13;
  const w = cols * pw + 6;
  const h = rows * pw + 6;
  let pills = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cx = -w / 2 + 3 + pw * c + pw / 2;
      const cy = -h / 2 + 3 + pw * r + pw / 2;
      pills += empty.includes(i)
        ? `<circle cx="${cx}" cy="${cy}" r="4.6" fill="${P.discShade}" stroke-width="1.5" stroke-dasharray="2 2"/>`
        : `<circle cx="${cx}" cy="${cy}" r="4.6" fill="${colour}" stroke-width="2"/>` +
          `<path d="M${cx - 2} ${cy - 1.6} q1.5 -1.4 3.2 -.6" fill="none" stroke="${P.paper}" stroke-width="1.3"/>`;
    }
  return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="${P.silver}"/>` + pills;
}

function bedSide(x1: number, x2: number, y: number, sheet: string): string {
  return (
    `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="9" rx="3" fill="${P.green}"/>` +
    `<path d="M${x1 + 4} ${y + 9} L${x1 + 4} ${y + 18} M${x2 - 4} ${y + 9} L${x2 - 4} ${y + 18}" stroke-width="4"/>` +
    `<rect x="${x1 + 2}" y="${y - 7}" width="${x2 - x1 - 4}" height="8" rx="3" fill="${sheet}"/>`
  );
}

function leaf(colour: string, rot: number, len = 18): string {
  return at(
    0,
    0,
    `<path d="M0 0 C${len * 0.3} ${-len * 0.35} ${len * 0.8} ${-len * 0.3} ${len} 0 C${len * 0.8} ${len * 0.3} ${len * 0.3} ${len * 0.35} 0 0 Z" fill="${colour}"/>` +
      line(`M2 0 L${len - 4} 0`, P.ink, 1.3),
    1,
    rot,
  );
}

function greensBunch(): string {
  return (
    at(0, 0, leaf(P.green, -110, 30)) +
    at(0, 0, leaf(P.greenLight, -140, 28)) +
    at(0, 0, leaf(P.greenLight, -70, 28)) +
    at(0, 0, leaf(P.green, -40, 24)) +
    at(0, 0, leaf(P.green, -165, 22)) +
    `<path d="M-3 0 L3 0 L2 10 L-2 10 Z" fill="${P.greenLight}"/>` +
    `<rect x="-5" y="1" width="10" height="4" rx="1.5" fill="${P.clay}" stroke-width="1.6"/>`
  );
}

function beansBowl(w = 40): string {
  let beans = '';
  const n = Math.round(w / 9);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 7 + (i * (w - 14)) / (n - 1);
    const y = -4 - (i % 2) * 3 - (i > 0 && i < n - 1 ? 2 : 0);
    beans += `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.8" fill="${P.clay}" stroke-width="1.5" transform="rotate(${(i * 37) % 60 - 30} ${x} ${y})"/>`;
  }
  return beans + `<path d="M${-w / 2} 0 L${w / 2} 0 C${w / 2 - 2} ${w * 0.45} ${-w / 2 + 2} ${w * 0.45} ${-w / 2} 0 Z" fill="${P.green}"/>` + dots(`M${-w / 2 + 6} 6 L${w / 2 - 6} 6`, P.goldLight, 2.6, 6);
}

function fish(len = 50, colour: string = P.silver): string {
  const h = len * 0.32;
  return (
    `<path d="M${len / 2 - 6} 0 L${len / 2 + 6} ${-h * 0.6} L${len / 2 + 4} 0 L${len / 2 + 6} ${h * 0.6} Z" fill="${P.clay}"/>` +
    `<path d="M${-len / 2} 0 C${-len / 4} ${-h} ${len / 4} ${-h} ${len / 2 - 4} 0 C${len / 4} ${h} ${-len / 4} ${h} ${-len / 2} 0 Z" fill="${colour}"/>` +
    `<circle cx="${-len / 2 + 8}" cy="-2" r="1.8" fill="${P.ink}" stroke="none"/>` +
    line(`M${-len / 2 + 14} ${-h * 0.45} Q${-len / 2 + 10} 0 ${-len / 2 + 14} ${h * 0.45}`, P.ink, 1.6) +
    line(`M${-len / 8} -2 L${len / 4} -2`, P.clayLight, 2)
  );
}

function egg(rot = 0, s = 1): string {
  return at(0, 0, `<path d="M0 -11 C7 -11 9 1 8 4 C7 10 -7 10 -8 4 C-9 1 -7 -11 0 -11 Z" fill="${P.paper}"/>`, s, rot);
}

function eggHalf(s = 1): string {
  return at(0, 0, `<ellipse cx="0" cy="0" rx="9" ry="11" fill="${P.paper}"/><circle cx="0" cy="1" r="5" fill="${P.gold}" stroke-width="1.6"/>`, s);
}

/** Open hand, palm facing out, fingers up. Origin = wrist. */
function HAND(skin: string): string {
  return `<path d="M-8 0 L-9 -18 C-14 -22 -16 -28 -13 -30 C-11 -31 -9 -29 -8 -27 L-8 -40 C-8 -44 -3 -44 -3 -40 L-3 -44 C-3 -48 2 -48 2 -44 L2 -41 C2 -45 7 -45 7 -41 L7 -37 C7 -40 11 -40 11 -36 L10 -16 L9 0 Z" fill="${skin}"/>` +
    line('M-3 -40 L-3 -30 M2 -41 L2 -30 M7 -37 L7 -29', P.ink, 1.2);
}

// ------------------------------------------------------------------ drawings

export const DRAWINGS: Record<IllustrationKey, () => string> = {
  danger_bleeding: () =>
    ground(50, 104, 26) +
    at(44, 104, pregnantStanding(P.skin2, P.gold, P.green, P.clay, 'belly'), 0.92) +
    at(80, 76, drop(P.alert, 1.15)) +
    at(70, 99, drop(P.alert, 0.55)) +
    at(87, 99, drop(P.alert, 0.45)) +
    alertBadge(),

  danger_headache: () =>
    at(54, 60, womanBust(P.skin3, P.green, P.clay)) +
    at(54, 60, face(14, 'pain')) +
    at(54, 60, limb('M-22 30 C-30 16 -26 2 -16 -2', P.skin3, 6) + limb('M22 30 C30 16 26 2 16 -2', P.skin3, 6)) +
    `<path d="M22 30 L16 36 L24 40 L16 46" fill="none" stroke="${P.alert}" stroke-width="3.5"/>` +
    `<path d="M88 46 L94 52 L86 56 L94 62" fill="none" stroke="${P.alert}" stroke-width="3.5"/>` +
    alertBadge(),

  danger_fever: () =>
    at(48, 60, womanBust(P.skin2, P.gold, P.green)) +
    at(48, 60, face(14, 'closed')) +
    at(64, 46, drop(P.water, 0.38)) +
    at(31, 50, drop(P.water, 0.32)) +
    at(92, 94, thermometer(0.9, P.alert), 1.05, 12) +
    alertBadge(),

  danger_convulsion: () =>
    ground(60, 92, 46) +
    at(
      102,
      88,
      standingFront({
        skin: P.skin2,
        top: P.gold,
        bottom: P.clay,
        head: 'gele',
        wrap: P.green,
        armL: 'M-13 -64 C-22 -60 -26 -52 -30 -58',
        armR: 'M13 -64 C22 -60 26 -54 32 -60',
      }),
      0.82,
      -90,
    ) +
    `<path d="M30 42 L35 36 L40 42 L45 36 M60 40 L65 34 L70 40 L75 34" fill="none" stroke="${P.alert}" stroke-width="3.2"/>` +
    `<path d="M40 112 L45 106 L50 112 L55 106 M66 112 L71 106 L76 112" fill="none" stroke="${P.alert}" stroke-width="3.2"/>` +
    line('M12 70 Q8 78 12 86 M106 70 Q110 78 106 86', P.ink, 2.4) +
    alertBadge(),

  danger_baby_movement: () =>
    // close crop of a pregnant body, front view, clipped to the disc
    `<g clip-path="url(#__CLIP__)">` +
    `<path d="M14 0 L106 0 L104 34 L16 34 Z" fill="${P.gold}"/>` +
    dots('M22 22 L98 22', P.clay, 3, 7) +
    `<path d="M10 92 L110 92 L112 120 L8 120 Z" fill="${P.green}"/>` +
    dots('M16 104 L104 104', P.goldLight, 3, 7) +
    `</g>` +
    `<ellipse cx="60" cy="64" rx="36" ry="33" fill="${P.skin3}"/>` +
    // womb window with a curled baby
    `<ellipse cx="60" cy="64" rx="19" ry="18" fill="${P.disc}" stroke-width="2"/>` +
    `<path d="M51 70 C47 60 54 53 62 55 C71 57 73 68 69 73 C65 78 55 78 51 70 Z" fill="${P.skin4}" stroke-width="2"/>` +
    `<circle cx="58" cy="55" r="7" fill="${P.skin4}" stroke-width="2"/>` +
    `<path d="M55 56 q2 2 4 0" fill="none" stroke-width="1.5"/>` +
    // movement arcs, crossed out
    line('M14 50 Q8 64 14 78', P.ink, 3.2) +
    line('M106 50 Q112 64 106 78', P.ink, 3.2) +
    `<path d="M34 88 L86 40" stroke="${P.ink}" stroke-width="10"/>` +
    `<path d="M34 88 L86 40" stroke="${P.alert}" stroke-width="5.5"/>` +
    alertBadge(98, 22),

  danger_swelling: () =>
    at(52, 56, womanBust(P.skin2, P.gold, P.green)) +
    // puffier face
    `<ellipse cx="52" cy="58" rx="16.5" ry="14" fill="${P.skin2}"/>` +
    at(52, 56, womanHeadFront(P.skin2, P.green, P.goldLight, 14).replace(/<circle cx="0" cy="1" r="11"[^>]*\/>/, '')) +
    at(52, 56, face(14, 'calm')) +
    arrow(30, 58, 19, 58, P.alert, 3.2) +
    arrow(74, 58, 85, 58, P.alert, 3.2) +
    // puffy hand
    at(
      88,
      94,
      `<path d="M-12 12 L-12 -4 C-16 -6 -18 -12 -14 -14 C-12 -15 -10 -12 -9 -10 L-9 -17 C-9 -22 -3 -22 -3 -17 L-3 -19 C-3 -24 3 -24 3 -19 L3 -17 C3 -22 9 -22 9 -16 L9 -12 C9 -16 15 -16 15 -11 L14 4 C13 10 10 12 8 14 Z" fill="${P.skin2}"/>`,
      1,
      0,
    ) +
    alertBadge(98, 22),

  danger_breathing: () =>
    at(50, 60, womanBust(P.skin1, P.clay, P.gold, P.paper)) +
    at(50, 60, face(14, 'open')) +
    at(50, 60, limb('M24 34 C20 24 10 22 2 26', P.skin1, 6)) +
    `<path d="M72 54 q4 -4 8 0 t8 0 t8 0" fill="none" stroke="${P.green}" stroke-width="3.2"/>` +
    `<path d="M72 64 q4 -4 8 0 t8 0 t8 0 t8 0" fill="none" stroke="${P.green}" stroke-width="3.2"/>` +
    `<path d="M72 74 q4 -4 8 0 t8 0" fill="none" stroke="${P.green}" stroke-width="3.2"/>` +
    alertBadge(),

  baby_danger: () =>
    ground(56, 98, 36) +
    at(54, 76, swaddledBaby(P.skin3, P.paper, P.clay), 1.6) +
    `<path d="M70 52 q-3 -5 0 -10 t0 -10 M82 54 q-3 -5 0 -10 t0 -10" fill="none" stroke="${P.alert}" stroke-width="3"/>` +
    at(26, 50, thermometer(0.85, P.alert), 0.7, -10) +
    alertBadge(),

  clinic_visit: () =>
    ground(62, 104, 46) +
    `<path d="M48 54 L100 54 L100 104 L48 104 Z" fill="${P.paper}"/>` +
    `<path d="M42 56 L74 32 L106 56 Z" fill="${P.clay}"/>` +
    dots('M56 50 L92 50', P.goldLight, 3, 6) +
    `<rect x="66" y="80" width="16" height="24" rx="2" fill="${P.green}"/>` +
    `<rect x="53" y="64" width="10" height="10" rx="1.5" fill="${P.water}"/>` +
    `<rect x="86" y="64" width="10" height="10" rx="1.5" fill="${P.water}"/>` +
    `<circle cx="74" cy="66" r="8" fill="${P.green}"/>` +
    at(74, 66, heart(P.paper, 0.62), 1) +
    at(28, 104, pregnantStanding(P.skin3, P.clay, P.gold, P.green, 'forward', true), 0.66),

  iron_tablet: () =>
    at(48, 64, pillStrip(3, 4, P.meat, [0]), 1.05, -8) +
    at(94, 32, sun(8)) +
    at(
      94,
      90,
      `<path d="M-11 -18 L11 -18 L9 14 L-9 14 Z" fill="${P.paper}"/>` +
        `<path d="M-10 -6 L10 -6 L9 13 L-9 13 Z" fill="${P.water}" stroke="none"/>` +
        `<path d="M-11 -18 L11 -18 L9 14 L-9 14 Z" fill="none"/>`,
    ),

  medicine: () =>
    ground(60, 104, 38) +
    // bottle
    `<rect x="34" y="34" width="22" height="10" rx="2" fill="${P.green}"/>` +
    `<path d="M30 48 C30 44 34 42 38 42 L52 42 C56 42 60 44 60 48 L60 100 C60 103 58 104 56 104 L34 104 C32 104 30 103 30 100 Z" fill="${P.clay}"/>` +
    `<rect x="35" y="60" width="20" height="26" rx="2" fill="${P.paper}"/>` +
    at(45, 73, leaf(P.green, -90, 14)) +
    // spoon
    at(
      84,
      74,
      `<path d="M0 -8 L0 30" stroke="${P.ink}" stroke-width="7"/><path d="M0 -8 L0 30" stroke="${P.silver}" stroke-width="3"/>` +
        `<ellipse cx="0" cy="-16" rx="11" ry="9" fill="${P.silver}"/>` +
        `<ellipse cx="0" cy="-16" rx="7" ry="5" fill="${P.clayLight}" stroke="none"/>`,
      1,
      20,
    ) +
    // capsule
    at(
      92,
      34,
      `<path d="M-12 -5 L0 -5 L0 5 L-12 5 A5 5 0 0 1 -12 -5 Z" fill="${P.gold}"/><path d="M0 -5 L12 -5 A5 5 0 0 1 12 5 L0 5 Z" fill="${P.paper}"/>`,
      1,
      -30,
    ),

  mosquito_net: () =>
    ground(60, 106, 46) +
    bedSide(16, 104, 82, P.paper) +
    // sleeper under a wrapper
    `<ellipse cx="30" cy="72" rx="9" ry="6" fill="${P.paper}"/>` +
    `<circle cx="34" cy="68" r="7" fill="${P.skin2}"/>` +
    `<path d="M34 61 C42 61 44 66 41 70" fill="${P.clay}"/>` +
    `<path d="M40 76 C46 66 84 64 96 74 L96 78 L40 78 Z" fill="${P.gold}"/>` +
    dots('M50 72 L90 72', P.clay, 3, 6) +
    // net
    `<path d="M60 14 L18 90 L102 90 Z" fill="${P.water}" fill-opacity="0.35" stroke="none"/>` +
    `<path d="M60 14 L40 90 M60 14 L50 90 M60 14 L60 90 M60 14 L70 90 M60 14 L80 90 M60 14 L30 90 M60 14 L90 90 M38 50 L82 50 M28 68 L92 68" stroke="${P.green}" stroke-width="1.2" fill="none"/>` +
    `<path d="M60 14 L18 92 M60 14 L102 92" stroke="${P.green}" stroke-width="3" fill="none"/>` +
    `<path d="M18 92 Q60 98 102 92" stroke="${P.green}" stroke-width="3" fill="none"/>` +
    `<circle cx="60" cy="12" r="4" fill="${P.paper}" stroke="${P.green}"/>`,

  balanced_plate: () =>
    `<circle cx="60" cy="62" r="44" fill="${P.paper}"/>` +
    `<circle cx="60" cy="62" r="36" fill="none" stroke="${P.discShade}" stroke-width="2.5"/>` +
    // half: leafy greens
    at(42, 66, leaf(P.green, -120, 22)) +
    at(40, 72, leaf(P.greenLight, -160, 20)) +
    at(44, 70, leaf(P.green, 160, 20)) +
    at(42, 66, leaf(P.greenLight, -80, 22)) +
    at(42, 72, leaf(P.green, 110, 18)) +
    // quarter: beans
    [
      [68, 40],
      [76, 44],
      [70, 50],
      [80, 52],
      [84, 44],
      [64, 56],
      [74, 58],
      [88, 56],
    ]
      .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="3" fill="${P.clay}" stroke-width="1.6" transform="rotate(${(i * 41) % 70 - 30} ${x} ${y})"/>`)
      .join('') +
    // quarter: plantain slices and fish
    [
      [70, 74],
      [80, 70],
      [88, 78],
    ]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="${P.gold}" stroke-width="1.8"/>`)
      .join('') +
    at(76, 88, fish(26), 1, -10) +
    line('M60 22 L60 102 M60 64 L98 64', P.discShade, 2.5) +
    `<circle cx="60" cy="62" r="44" fill="none"/>`,

  protein_foods: () =>
    at(60, 36, fish(56), 1, -6) +
    at(42, 80, beansBowl(44)) +
    at(80, 86, egg(-12)) +
    at(94, 78, egg(14)) +
    at(90, 92, eggHalf(0.85)),

  iron_foods: () =>
    at(38, 82, greensBunch(), 1.25) +
    at(84, 90, beansBowl(40)) +
    at(
      84,
      48,
      `<path d="M-20 -6 C-20 -16 -4 -20 8 -16 C20 -12 22 -2 16 6 C10 14 -8 14 -16 8 C-20 5 -20 0 -20 -6 Z" fill="${P.meat}"/>` +
        line('M-10 -6 Q0 -10 10 -4', P.clayLight, 2.2),
    ),

  water: () =>
    ground(60, 104, 40) +
    // clay water pot
    at(
      44,
      76,
      `<path d="M-10 -24 L10 -24 L8 -18 C24 -14 28 2 22 14 C16 26 -16 26 -22 14 C-28 2 -24 -14 -8 -18 Z" fill="${P.clay}"/>` +
        `<rect x="-12" y="-28" width="24" height="6" rx="3" fill="${P.clay}"/>` +
        dots('M-18 0 L18 0', P.goldLight, 3, 6),
    ) +
    // cup of water
    at(
      88,
      88,
      `<path d="M-12 -18 L12 -18 L10 14 L-10 14 Z" fill="${P.paper}"/>` +
        `<path d="M-11 -8 q5.5 -3 11 0 t11 0 L10 13 L-10 13 Z" fill="${P.water}" stroke="none"/>` +
        `<path d="M-12 -18 L12 -18 L10 14 L-10 14 Z" fill="none"/>`,
    ) +
    at(88, 42, drop(P.water, 1.1)),

  sleep_left_side: () =>
    // bed from above. She lies on her LEFT side: head on the pillow (right), back to the top edge,
    // belly and bent knees toward the bottom edge.
    `<rect x="6" y="24" width="108" height="74" rx="10" fill="${P.green}"/>` +
    `<rect x="11" y="29" width="98" height="64" rx="7" fill="${P.paper}"/>` +
    `<rect x="90" y="34" width="15" height="54" rx="7" fill="${P.goldLight}"/>` +
    // shin, then thigh (wrapper)
    limb('M30 80 L16 64', P.clay, 12) +
    limb('M50 56 L30 80', P.clay, 16) +
    `<ellipse cx="15" cy="60" rx="4" ry="6" fill="${P.skin2}" transform="rotate(-40 15 60)"/>` +
    // torso with belly bump downward
    `<path d="M88 52 C84 42 66 40 52 44 C44 46 42 54 44 62 C48 78 58 86 70 86 C80 86 84 78 82 70 C88 66 90 60 88 52 Z" fill="${P.gold}"/>` +
    dots('M54 50 L80 48', P.clay, 3, 6) +
    `<path d="M50 70 C56 82 70 86 78 76" fill="none" stroke="${P.goldLight}" stroke-width="2.4"/>` +
    // head on pillow, face toward the bottom
    `<circle cx="94" cy="60" r="9.5" fill="${P.skin2}"/>` +
    `<path d="M85 57 C84 46 100 44 103 55 C97 52 91 52 85 57 Z" fill="${P.green}"/>` +
    `<path d="M100 48 C106 42 112 48 106 52 Z" fill="${P.green}"/>` +
    `<path d="M90 64 q2.2 2 4.4 0" fill="none" stroke-width="1.6"/>` +
    limb('M82 58 C78 68 74 72 66 72', P.skin2, 5.5) +
    at(22, 24, checkBadge(11)),

  rest: () =>
    ground(60, 104, 44) +
    // chair
    `<path d="M20 50 L28 98 M60 98 L60 104 M24 104 L26 96" stroke-width="4"/>` +
    `<rect x="18" y="86" width="46" height="8" rx="3" fill="${P.green}"/>` +
    `<path d="M14 48 L22 46 L32 88 L24 90 Z" fill="${P.green}"/>` +
    // stool
    `<rect x="84" y="80" width="22" height="7" rx="3" fill="${P.clay}"/>` +
    `<path d="M88 87 L86 104 M102 87 L104 104" stroke-width="4"/>` +
    // woman reclining, legs up
    `<path d="M30 86 L56 86 C62 86 64 80 72 80 L94 78 L94 72 L60 74 C54 74 50 76 44 76 Z" fill="${P.gold}"/>` +
    dots('M58 78 L90 76', P.clay, 2.6, 6) +
    `<path d="M22 54 C26 46 34 46 40 52 C48 58 54 66 52 74 C48 84 36 86 30 86 Z" fill="${P.clay}"/>` +
    `<ellipse cx="96" cy="75" rx="4" ry="6" fill="${P.skin2}"/>` +
    `<circle cx="26" cy="40" r="8" fill="${P.skin2}"/>` +
    `<path d="M18 38 C16 30 24 26 30 28 C34 30 34 34 32 36 C28 32 22 34 18 38 Z" fill="${P.green}"/>` +
    `<path d="M20 30 C14 24 20 18 26 24 Z" fill="${P.green}"/>` +
    limb('M34 56 C40 66 48 70 56 70', P.skin2, 5) +
    // moon and Z
    `<path d="M98 18 A13 13 0 1 0 108 40 A10 10 0 1 1 98 18 Z" fill="${P.gold}"/>` +
    `<path d="M70 26 L78 26 L70 34 L78 34" fill="none" stroke-width="2.6"/>`,

  walking: () =>
    `<path d="M10 104 Q60 98 110 104" fill="none" stroke="${P.discShade}" stroke-width="6"/>` +
    at(52, 104, pregnantStanding(P.skin1, P.green, P.clay, P.gold, 'down', true), 0.92) +
    at(92, 30, sun(9)) +
    arrow(78, 76, 100, 76, P.green, 3.2) +
    arrow(78, 88, 94, 88, P.green, 3.2),

  breastfeeding: () =>
    at(60, 46, womanBust(P.skin2, P.clay, P.green)) +
    at(60, 46, face(14, 'closed')) +
    // wrapper sling over the shoulder
    `<path d="M74 66 L46 104 L58 104 L84 72 Z" fill="${P.green}"/>` +
    // baby, head at mother's breast on the left
    `<g transform="translate(62 82) scale(-1.25 1.25)">${swaddledBaby(P.skin3, P.gold, P.clay)}</g>` +
    limb('M30 72 C26 84 34 92 52 90', P.skin2, 6) +
    limb('M90 72 C96 86 86 94 72 90', P.skin2, 6),

  breastfeeding_latch: () =>
    `<g clip-path="url(#__CLIP__)">` +
    // breast on the right, upper part covered by her blouse
    `<circle cx="100" cy="74" r="30" fill="${P.skin2}"/>` +
    `<path d="M62 0 L130 0 L130 64 C116 54 96 50 70 54 Z" fill="${P.gold}"/>` +
    dots('M74 46 C94 42 108 46 124 54', P.clay, 3, 7) +
    // baby wrap at bottom-left
    `<path d="M0 120 L0 96 C14 90 30 92 44 98 C54 104 60 112 62 120 Z" fill="${P.green}"/>` +
    dots('M8 104 C20 100 34 102 46 108', P.goldLight, 3, 7) +
    `</g>` +
    // baby head in profile facing right, mouth wide on the breast
    `<path d="M44 34 C26 34 14 48 14 64 C14 80 26 94 42 94 C54 94 62 88 66 82 L72 80 L72 64 L68 60 C70 56 70 52 66 48 C62 40 54 34 44 34 Z" fill="${P.skin4}"/>` +
    `<path d="M66 60 C70 58 74 60 74 64 M66 82 C70 84 74 82 74 78" fill="none" stroke="${P.clay}" stroke-width="3.2"/>` +
    `<path d="M50 54 q4 3 8 0" fill="none" stroke-width="1.8"/>` +
    `<path d="M48 48 q5 -3 10 0" fill="none" stroke-width="1.5"/>` +
    `<path d="M28 60 C22 60 22 72 28 72 C30 70 30 62 28 60 Z" fill="${P.skin3}" stroke-width="2"/>` +
    `<path d="M36 34 C36 28 44 26 46 30" fill="none" stroke-width="2"/>` +
    `<circle cx="58" cy="70" r="4" fill="${P.clayLight}" stroke="none" opacity="0.6"/>` +
    // baby's hand on the breast
    `<path d="M74 96 C72 90 78 86 84 88 C88 90 88 96 84 98 C80 100 76 100 74 96 Z" fill="${P.skin4}"/>` +
    at(98, 100, checkBadge(10)),

  skin_to_skin: () =>
    // mother reclining, wrapper tied above the bust, baby bare on her chest
    `<path d="M12 112 C12 82 28 70 44 66 L76 66 C92 70 108 82 108 112 Z" fill="${P.skin2}"/>` +
    `<path d="M20 112 C22 96 30 88 40 86 L80 86 C90 88 98 96 100 112 Z" fill="${P.green}"/>` +
    dots('M30 98 L90 98', P.goldLight, 3, 7) +
    `<path d="M54 52 L54 66 L66 66 L66 52 Z" fill="${P.skin2}"/>` +
    at(60, 38, womanHeadFront(P.skin2, P.clay, P.goldLight, 14)) +
    at(60, 38, face(14, 'closed')) +
    // baby
    limb('M50 76 C42 78 40 84 42 88', P.skin4, 5) +
    limb('M70 76 C78 78 80 84 78 88', P.skin4, 5) +
    `<ellipse cx="60" cy="84" rx="12" ry="14" fill="${P.skin4}"/>` +
    at(60, 66, babyHead(P.skin4, 9, true)) +
    // mother's hands on the baby's back
    limb('M24 84 C34 90 42 94 50 92', P.skin2, 6) +
    limb('M96 84 C86 90 78 94 70 92', P.skin2, 6) +
    at(96, 30, heart(P.clay, 1.1)),

  cord_care: () =>
    // newborn on its back: arms up, frog legs, nappy, clean dry cord stump
    limb('M40 50 C30 46 26 38 28 30', P.skin4, 7) +
    limb('M80 50 C90 46 94 38 92 30', P.skin4, 7) +
    limb('M44 86 C32 90 28 98 34 106', P.skin4, 8) +
    limb('M76 86 C88 90 92 98 86 106', P.skin4, 8) +
    `<ellipse cx="60" cy="68" rx="22" ry="26" fill="${P.skin4}"/>` +
    `<path d="M38 80 C48 86 72 86 82 80 L80 94 C72 102 48 102 40 94 Z" fill="${P.paper}"/>` +
    dots('M46 90 L74 90', P.water, 3, 6) +
    at(60, 28, babyHead(P.skin4, 14)) +
    `<path d="M54 34 Q60 38 66 34" fill="none" stroke-width="1.6"/>` +
    // cord stump with clamp
    `<path d="M60 70 C60 64 63 60 68 58" fill="none" stroke="${P.ink}" stroke-width="7"/>` +
    `<path d="M60 70 C60 64 63 60 68 58" fill="none" stroke="${P.clayLight}" stroke-width="3.5"/>` +
    `<rect x="63" y="52" width="12" height="7" rx="2" fill="${P.gold}" transform="rotate(-25 69 55)"/>` +
    `<circle cx="60" cy="71" r="2.6" fill="${P.skin3}" stroke-width="1.8"/>` +
    at(44, 62, sparkle(0.75)) +
    at(80, 72, sparkle(0.6)) +
    at(96, 24, checkBadge(11)),

  vaccination: () =>
    ground(54, 104, 40) +
    // mother seated, profile facing right
    at(34, 80, seatedProfile(P.skin2, P.clay, P.green, P.gold, '30 -10'), 1.05) +
    // baby on her lap
    `<path d="M50 60 C48 52 54 48 60 48 C66 48 70 54 68 62 L68 74 L52 74 Z" fill="${P.paper}"/>` +
    limb('M64 72 C72 72 80 72 86 70', P.skin3, 7) +
    at(60, 40, babyHead(P.skin3, 9, true)) +
    limb('M62 56 C68 60 70 62 72 60', P.skin3, 4.5) +
    // syringe pointing at the thigh
    at(
      96,
      54,
      `<rect x="-5" y="-14" width="10" height="24" rx="2" fill="${P.paper}"/>` +
        `<rect x="-3" y="-6" width="6" height="14" fill="${P.water}" stroke="none"/>` +
        `<path d="M-7 -14 L7 -14 M0 -14 L0 -22 M-5 -22 L5 -22" stroke-width="3"/>` +
        `<path d="M0 10 L0 20" stroke-width="2"/>`,
      1,
      -150,
    ),

  complementary_food: () =>
    ground(60, 104, 36) +
    at(58, 70, bowl(70, P.clay, P.gold)) +
    dots('M30 79 L86 79', P.goldLight, 3, 7) +
    // mash texture
    `<path d="M36 62 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="${P.clay}" stroke-width="2"/>` +
    `<circle cx="44" cy="58" r="2" fill="${P.green}" stroke="none"/><circle cx="62" cy="56" r="2" fill="${P.green}" stroke="none"/><circle cx="76" cy="60" r="2" fill="${P.green}" stroke="none"/>` +
    // spoon with food
    at(
      84,
      40,
      `<path d="M0 0 L26 -16" stroke="${P.ink}" stroke-width="8"/><path d="M0 0 L26 -16" stroke="${P.silver}" stroke-width="3.5"/>` +
        `<ellipse cx="-4" cy="2" rx="12" ry="8" fill="${P.silver}" transform="rotate(-32 -4 2)"/>` +
        `<ellipse cx="-5" cy="1" rx="7" ry="4.5" fill="${P.gold}" stroke-width="1.6" transform="rotate(-32 -5 1)"/>`,
    ) +
    `<path d="M50 30 q-3 -5 0 -10 M60 28 q-3 -5 0 -10" fill="none" stroke="${P.discShade}" stroke-width="3"/>`,

  handwashing: () =>
    // kettle (buta) pouring water over two hands
    at(
      30,
      28,
      `<path d="M-14 -10 L12 -10 L16 14 L-18 14 Z" fill="${P.green}"/>` +
        `<path d="M-14 -10 C-10 -20 8 -20 12 -10 Z" fill="${P.green}"/>` +
        `<path d="M14 4 L30 12 L32 8 L16 -2" fill="${P.green}"/>` +
        `<path d="M-15 -4 C-26 -4 -26 10 -16 10" fill="none" stroke-width="3"/>` +
        dots('M-14 4 L12 4', P.goldLight, 3, 6),
    ) +
    `<path d="M62 40 C63 46 62 50 61 54" fill="none" stroke="${P.water}" stroke-width="5"/>` +
    at(52, 98, HAND(P.skin2), 1.3, 18) +
    at(70, 98, mirror(HAND(P.skin3)), 1.3, -18) +
    `<circle cx="40" cy="56" r="4.5" fill="${P.paper}" stroke-width="1.8"/><circle cx="84" cy="58" r="3.5" fill="${P.paper}" stroke-width="1.8"/><circle cx="90" cy="46" r="2.6" fill="${P.paper}" stroke-width="1.6"/><circle cx="32" cy="70" r="2.6" fill="${P.paper}" stroke-width="1.6"/>` +
    at(96, 92, `<rect x="-10" y="-6" width="20" height="12" rx="5" fill="${P.goldLight}"/>` + line('M-5 -1 L5 -1', P.paper, 2)),

  family_support: () =>
    ground(60, 106, 48) +
    // older woman on the left, hand on the mother's back
    at(24, 106, standingFront({ skin: P.skin1, top: P.green, bottom: P.gold, head: 'old', wrap: P.silver, armR: 'M13 -64 C20 -60 26 -56 32 -56' }), 0.8) +
    // pregnant mother in the middle, facing right
    at(56, 106, pregnantStanding(P.skin3, P.gold, P.clay, P.green, 'belly'), 0.84) +
    // partner on the right offering a bowl of food
    at(
      94,
      106,
      standingFront({
        skin: P.skin2,
        top: P.paper,
        bottom: P.green,
        head: 'cap',
        wrap: P.clay,
        trousers: true,
        armL: 'M-13 -64 C-18 -56 -22 -54 -26 -56',
        armR: 'M13 -64 C10 -56 -10 -54 -22 -58',
      }),
      0.84,
    ) +
    at(74, 56, bowl(18, P.green, P.gold)),

  talk_to_someone: () =>
    `<rect x="14" y="88" width="92" height="7" rx="3" fill="${P.green}"/>` +
    `<path d="M20 95 L20 108 M100 95 L100 108" stroke-width="4"/>` +
    at(34, 88, seatedProfile(P.skin2, P.gold, P.clay, P.green, '18 -14'), 0.8) +
    at(86, 88, mirror(seatedProfile(P.skin4, P.clay, P.green, P.gold, '16 -10')), 0.8) +
    // speech bubbles above the heads
    `<path d="M28 12 L54 12 C58 12 60 14 60 18 L60 26 C60 30 58 32 54 32 L46 32 L42 37 L40 32 L28 32 C24 32 22 30 22 26 L22 18 C22 14 24 12 28 12 Z" fill="${P.paper}"/>` +
    `<circle cx="33" cy="22" r="2.2" fill="${P.ink}" stroke="none"/><circle cx="41" cy="22" r="2.2" fill="${P.ink}" stroke="none"/><circle cx="49" cy="22" r="2.2" fill="${P.ink}" stroke="none"/>` +
    `<path d="M68 16 L92 16 C96 16 98 18 98 22 L98 30 C98 34 96 36 92 36 L82 36 L80 41 L76 36 L68 36 C64 36 62 34 62 30 L62 22 C62 18 64 16 68 16 Z" fill="${P.goldLight}"/>` +
    at(80, 26, heart(P.clay, 0.62)),

  birth_bag: () =>
    ground(60, 104, 42) +
    // handles
    `<path d="M40 50 C40 30 56 30 56 50 M64 50 C64 30 80 30 80 50" fill="none" stroke="${P.ink}" stroke-width="7"/>` +
    `<path d="M40 50 C40 30 56 30 56 50 M64 50 C64 30 80 30 80 50" fill="none" stroke="${P.clayLight}" stroke-width="3"/>` +
    // folded wrapper poking out
    `<path d="M24 52 L30 38 L54 40 L52 54 Z" fill="${P.gold}"/>` +
    dots('M32 46 L50 47', P.clay, 3, 6) +
    // baby vest
    `<path d="M58 40 L64 36 C66 40 72 40 74 36 L80 40 L84 48 L78 50 L78 56 L60 56 L60 50 L54 48 Z" fill="${P.paper}"/>` +
    // cap
    `<path d="M84 50 C84 38 100 38 100 50 Z" fill="${P.green}"/>` +
    `<circle cx="92" cy="38" r="3" fill="${P.goldLight}" stroke-width="1.8"/>` +
    // bag body
    `<path d="M18 52 L102 52 L98 102 C98 104 96 105 94 105 L26 105 C24 105 22 104 22 102 Z" fill="${P.clay}"/>` +
    line('M20 68 L100 68 M21 84 L99 84 M42 52 L44 105 M60 52 L60 105 M78 52 L76 105', P.clayLight, 2) +
    `<path d="M18 52 L102 52 L98 102 C98 104 96 105 94 105 L26 105 C24 105 22 104 22 102 Z" fill="none"/>`,

  blood_pressure: () =>
    // upper arm with cuff
    `<path d="M6 70 L74 64 C82 64 86 70 86 78 C86 86 82 90 74 90 L8 94 Z" fill="${P.skin2}"/>` +
    `<path d="M22 60 L54 58 L56 96 L22 98 Z" fill="${P.green}"/>` +
    line('M28 64 L28 92 M48 62 L48 92', P.greenLight, 2.2) +
    `<path d="M54 78 C64 70 70 54 78 46" fill="none" stroke-width="3"/>` +
    // gauge
    `<circle cx="86" cy="36" r="17" fill="${P.paper}"/>` +
    line('M86 22 L86 26 M100 36 L96 36 M72 36 L76 36 M76 26 L78.5 28.5 M96 26 L93.5 28.5', P.ink, 2) +
    `<path d="M86 36 L95 28" stroke="${P.clay}" stroke-width="3"/>` +
    `<circle cx="86" cy="36" r="2.6" fill="${P.ink}" stroke="none"/>` +
    // bulb
    `<path d="M40 96 C44 104 50 106 56 104" fill="none" stroke-width="3"/>` +
    `<ellipse cx="66" cy="104" rx="11" ry="7.5" fill="${P.clay}"/>`,

  test_tube: () =>
    ground(60, 104, 36) +
    // rack
    `<rect x="26" y="66" width="68" height="10" rx="3" fill="${P.green}"/>` +
    `<path d="M30 76 L30 104 M90 76 L90 104 M28 104 L92 104" stroke-width="4"/>` +
    // tube 1: blood
    `<path d="M40 30 L52 30 L52 92 A6 6 0 0 1 40 92 Z" fill="${P.paper}"/>` +
    `<path d="M41 60 L51 60 L51 92 A5 5 0 0 1 41 92 Z" fill="${P.meat}" stroke="none"/>` +
    `<path d="M40 30 L52 30 L52 92 A6 6 0 0 1 40 92 Z" fill="none"/>` +
    `<rect x="37" y="22" width="18" height="10" rx="2" fill="${P.clay}"/>` +
    // tube 2: urine
    `<path d="M68 30 L80 30 L80 92 A6 6 0 0 1 68 92 Z" fill="${P.paper}"/>` +
    `<path d="M69 64 L79 64 L79 92 A5 5 0 0 1 69 92 Z" fill="${P.gold}" stroke="none"/>` +
    `<path d="M68 30 L80 30 L80 92 A6 6 0 0 1 68 92 Z" fill="none"/>` +
    `<rect x="65" y="22" width="18" height="10" rx="2" fill="${P.green}"/>` +
    `<rect x="26" y="66" width="68" height="10" rx="3" fill="${P.green}"/>` +
    at(100, 46, drop(P.meat, 0.6)),

  calendar: () => at(60, 64, calendarPage(76, 70, [2, 1], 4, 3)),

  phone_call: () =>
    at(
      52,
      62,
      `<rect x="-17" y="-38" width="34" height="76" rx="9" fill="${P.green}"/>` +
        `<rect x="-11" y="-30" width="22" height="20" rx="3" fill="${P.goldLight}"/>` +
        [-4, 5, 14, 23].map((y) => [-7, 0, 7].map((x) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${P.paper}" stroke="none"/>`).join('')).join('') +
        `<rect x="-8" y="30" width="16" height="3" rx="1.5" fill="${P.paper}" stroke="none"/>`,
      1,
      -12,
    ) +
    `<path d="M80 40 Q88 50 80 60 M88 32 Q102 50 88 68 M96 24 Q116 50 96 76" fill="none" stroke="${P.clay}" stroke-width="3.5"/>`,

  family_planning: () =>
    at(38, 38, calendarPage(42, 38, [1, 1], 3, 2)) +
    at(86, 38, pillStrip(3, 2, P.gold, [0, 1]), 0.95, 8) +
    ground(60, 104, 44) +
    at(28, 104, childFigure(P.skin2, P.clay, 44)) +
    at(92, 104, `<path d="M-10 -2 C-14 -14 -8 -22 0 -22 C8 -22 14 -14 10 -2 Z" fill="${P.gold}"/>` + at(0, -28, babyHead(P.skin3, 8, true))) +
    `<path d="M44 82 L76 82" stroke="${P.green}" stroke-width="3" stroke-dasharray="4 4"/>` +
    arrow(52, 82, 42, 82, P.green, 3) +
    arrow(68, 82, 78, 82, P.green, 3),

  warm_baby: () =>
    `<path d="M12 112 C12 80 28 64 44 60 L76 60 C92 64 108 80 108 112 Z" fill="${P.skin1}"/>` +
    `<path d="M54 48 L54 61 L66 61 L66 48 Z" fill="${P.skin1}"/>` +
    at(60, 36, womanHeadFront(P.skin1, P.green, P.goldLight, 14)) +
    at(60, 36, face(14, 'closed')) +
    // baby on her chest, head out, wrapper tied over both
    at(60, 80, babyHead(P.skin3, 10, true)) +
    `<path d="M50 77 C49 64 71 64 70 77 C64 73 56 73 50 77 Z" fill="${P.gold}"/>` +
    `<circle cx="60" cy="67" r="2.8" fill="${P.goldLight}" stroke-width="1.6"/>` +
    `<path d="M14 112 C16 96 26 86 42 86 C50 90 70 90 78 86 C94 86 104 96 106 112 Z" fill="${P.clay}"/>` +
    dots('M26 100 L94 100', P.goldLight, 3, 7) +
    // her hand on the baby's back
    limb('M30 96 C38 94 44 92 48 92', P.skin1, 6) +
    // warmth
    `<path d="M90 30 q-3 -5 0 -10 t0 -10 M100 36 q-3 -5 0 -10 t0 -10 M22 36 q-3 -5 0 -10 t0 -10" fill="none" stroke="${P.gold}" stroke-width="3.2"/>`,

  growth_chart: () =>
    `<rect x="18" y="22" width="84" height="80" rx="6" fill="${P.paper}"/>` +
    line('M30 34 L30 90 L94 90', P.ink, 3) +
    `<path d="M30 88 C46 84 52 64 66 56 C76 50 84 48 92 46" fill="none" stroke="${P.greenLight}" stroke-width="10" stroke-opacity="0.6"/>` +
    `<path d="M30 88 C46 84 52 64 66 56 C76 50 84 48 92 46" fill="none" stroke="${P.green}" stroke-width="3.5"/>` +
    [
      [40, 84],
      [52, 70],
      [66, 56],
      [80, 50],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${P.gold}" stroke-width="2"/>`)
      .join('') +
    at(88, 30, babyHead(P.skin3, 8, true)),
};
