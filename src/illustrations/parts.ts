/**
 * Shared drawing parts for the pictogram set. Every part is drawn around a
 * local origin and placed with translate(), so figures stay consistent.
 * Default stroke (ink, 2.5) is inherited from the wrapping group in frame().
 */
import { PALETTE as P } from './palette';

export const SW = 2.5;

/** Translate (and optionally scale / rotate) a fragment. */
export function at(x: number, y: number, body: string, scale = 1, rotate = 0): string {
  const t = [`translate(${x} ${y})`];
  if (rotate) t.push(`rotate(${rotate})`);
  if (scale !== 1) t.push(`scale(${scale})`);
  return `<g transform="${t.join(' ')}">${body}</g>`;
}

/** A limb or stroke-shape with an ink outline: ink underneath, colour on top. */
export function limb(d: string, colour: string, width = 6): string {
  return (
    `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="${width + SW * 2 - 1}"/>` +
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}"/>`
  );
}

/** Ankara-like dotted accent along a path (no defs/ids needed). */
export function dots(d: string, colour: string = P.paper, r = 3, gap = 6): string {
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${r}" stroke-dasharray="0 ${gap}"/>`;
}

/** Thin accent line with no outline. */
export function line(d: string, colour: string = P.ink, w = SW): string {
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}"/>`;
}

/** Danger badge: a rounded red-orange triangle with a white exclamation mark. */
export function alertBadge(x = 95, y = 24): string {
  return at(
    x,
    y,
    `<path d="M0 -15 L15 11 L-15 11 Z" fill="${P.alert}" stroke="${P.ink}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M0 -6 L0 3" stroke="${P.paper}" stroke-width="4"/>` +
      `<circle cx="0" cy="7.6" r="1.6" fill="${P.paper}" stroke="none"/>`,
  );
}

/** Woman's head, front view, with gele (head-tie). Origin = face centre. */
export function womanHeadFront(skin: string, wrap: string, accent: string = P.goldLight, r = 11): string {
  const k = r / 11;
  return (
    `<g transform="scale(${k})">` +
    // fan of the gele behind the head
    `<path d="M2 -14 C8 -26 20 -26 21 -16 C21 -10 15 -8 10 -9 Z" fill="${wrap}"/>` +
    `<circle cx="0" cy="1" r="11" fill="${skin}"/>` +
    // ear-ring
    `<circle cx="-11" cy="5" r="1.8" fill="${P.gold}" stroke-width="1.2"/>` +
    // head-tie band
    `<path d="M-13 -1 C-15 -14 -6 -20 2 -19 C10 -19 15 -13 13 -1 C8 -7 -8 -7 -13 -1 Z" fill="${wrap}"/>` +
    dots('M-10 -9 C-4 -13 4 -13 10 -9', accent, 2.6, 5) +
    `</g>`
  );
}

/** Man's head, front view, with a short kufi-style cap. Origin = face centre. */
export function manHeadFront(skin: string, cap: string): string {
  return (
    `<circle cx="0" cy="1" r="11" fill="${skin}"/>` +
    `<path d="M-11 -2 C-11 -12 -5 -15 0 -15 C5 -15 11 -12 11 -2 Z" fill="${cap}"/>` +
    line('M-10 -6 L10 -6', P.paper, 2)
  );
}

/** Baby head, front view. Origin = face centre. Eyes closed, calm. */
export function babyHead(skin: string, r = 8, eyes = true): string {
  return (
    `<circle cx="0" cy="0" r="${r}" fill="${skin}"/>` +
    `<path d="M-2 ${-r + 0.5} C-1 ${-r - 3} 3 ${-r - 2} 2 ${-r + 1}" fill="none" stroke-width="1.8"/>` +
    (eyes
      ? `<path d="M${-r * 0.45 - 1.6} ${r * 0.05} q1.6 1.6 3.2 0 M${r * 0.45 - 1.6} ${r * 0.05} q1.6 1.6 3.2 0" fill="none" stroke-width="1.6"/>`
      : '')
  );
}

/** Bust (head + shoulders) of a woman, front view. Origin = face centre. */
export function womanBust(skin: string, top: string, wrap: string, accent: string = P.goldLight): string {
  return (
    `<path d="M-30 46 C-30 26 -20 18 0 18 C20 18 30 26 30 46 Z" fill="${top}"/>` +
    dots('M-22 30 C-10 26 10 26 22 30', accent, 3, 7) +
    `<path d="M-5 10 L-5 19 C-3 22 3 22 5 19 L5 10 Z" fill="${skin}"/>` +
    womanHeadFront(skin, wrap, accent, 14)
  );
}

/**
 * Standing pregnant woman in profile facing right. Origin = between the feet.
 * Height about 92. arm: 'belly' | 'down' | 'forward'.
 */
export function pregnantStanding(
  skin: string,
  top: string,
  wrap: string,
  gele: string,
  arm: 'belly' | 'down' | 'forward' = 'belly',
  stride = false,
): string {
  const legs = stride
    ? limb('M-4 -18 L-12 -2', skin, 6) + limb('M4 -18 L12 -2', skin, 6) +
      `<path d="M-17 0 L-8 0" stroke-width="5"/><path d="M10 0 L19 0" stroke-width="5"/>`
    : `<ellipse cx="-4" cy="0" rx="6" ry="2.5" fill="${P.ink}"/><ellipse cx="9" cy="0" rx="6" ry="2.5" fill="${P.ink}"/>`;
  const wrapper = stride
    ? `<path d="M-12 -45 L11 -47 C27 -43 30 -24 15 -19 L13 -12 C4 -10 -6 -10 -14 -12 L-13 -24 C-15 -32 -15 -39 -12 -45 Z" fill="${wrap}"/>` +
      dots('M-12 -16 L12 -16', P.paper, 3, 6)
    : `<path d="M-12 -45 L11 -47 C27 -43 30 -24 15 -19 L17 -2 C6 0 -6 0 -15 -2 L-13 -24 C-15 -32 -15 -39 -12 -45 Z" fill="${wrap}"/>` +
      dots('M-13 -8 L15 -8', P.paper, 3, 6) +
      line('M-14 -13 L16 -13', P.paper, 1.6);
  const armPath =
    arm === 'belly'
      ? 'M0 -58 C-2 -48 4 -40 16 -37'
      : arm === 'forward'
        ? 'M0 -58 C2 -50 10 -48 20 -52'
        : 'M0 -58 C-2 -50 -2 -44 -1 -36';
  return (
    legs +
    wrapper +
    // blouse
    `<path d="M-10 -62 C-6 -66 6 -66 9 -62 L12 -45 L-13 -43 C-14 -50 -13 -57 -10 -62 Z" fill="${top}"/>` +
    // neck + head
    `<path d="M-1 -70 L-1 -63 L5 -63 L5 -70 Z" fill="${skin}"/>` +
    `<circle cx="3" cy="-75" r="9" fill="${skin}"/>` +
    // gele, profile: wraps back of head with a fan
    `<path d="M-7 -72 C-12 -82 -5 -91 4 -89 C11 -88 14 -83 12 -79 C6 -82 -1 -81 -7 -72 Z" fill="${gele}"/>` +
    `<path d="M-6 -85 C-14 -92 -9 -99 -1 -93 Z" fill="${gele}"/>` +
    `<circle cx="1" cy="-72" r="1.5" fill="${P.gold}" stroke-width="1"/>` +
    limb(armPath, skin, 5.5)
  );
}

/** Swaddled baby lying horizontally, head to the right. Origin = body centre. */
export function swaddledBaby(skin: string, wrap: string, accent: string = P.goldLight): string {
  return (
    // swaddled body plus a hood that frames the face
    `<rect x="-24" y="-10" width="38" height="20" rx="10" fill="${wrap}"/>` +
    line('M-8 -9 L-2 9 M-16 -8 L-10 9', P.ink, 1.4) +
    dots('M-20 0 L-12 0', accent, 2.6, 5) +
    `<circle cx="16" cy="0" r="13" fill="${wrap}"/>` +
    at(16, 0, babyHead(skin, 9))
  );
}

/**
 * Standing person, front view. Origin = between the feet; height about 88.
 * head: 'gele' (woman), 'old' (older woman, soft wrap), 'cap' (man).
 */
export function standingFront(o: {
  skin: string;
  top: string;
  bottom: string;
  head: 'gele' | 'old' | 'cap';
  wrap?: string;
  armL?: string;
  armR?: string;
  trousers?: boolean;
}): string {
  const wrap = o.wrap ?? P.clay;
  const lower = o.trousers
    ? `<path d="M-12 -40 L12 -40 L11 -2 L2 -2 L0 -26 L-2 -2 L-11 -2 Z" fill="${o.bottom}"/>`
    : `<path d="M-13 -40 L13 -40 L15 -3 L-15 -3 Z" fill="${o.bottom}"/>` + dots('M-12 -10 L12 -10', P.paper, 3, 6);
  const head =
    o.head === 'cap'
      ? manHeadFront(o.skin, wrap)
      : o.head === 'old'
        ? `<circle cx="0" cy="1" r="11" fill="${o.skin}"/>` +
          `<path d="M-12 1 C-14 -12 -6 -16 0 -16 C6 -16 14 -12 12 1 C8 -5 -8 -5 -12 1 Z" fill="${wrap}"/>` +
          `<path d="M10 -6 C15 -6 17 -2 15 2" fill="none" stroke-width="2"/>`
        : womanHeadFront(o.skin, wrap);
  const armL = o.armL ?? 'M-13 -64 C-17 -56 -18 -48 -17 -40';
  const armR = o.armR ?? 'M13 -64 C17 -56 18 -48 17 -40';
  return (
    `<ellipse cx="-6" cy="0" rx="5" ry="2.5" fill="${P.ink}"/><ellipse cx="6" cy="0" rx="5" ry="2.5" fill="${P.ink}"/>` +
    lower +
    `<path d="M-14 -66 C-8 -70 8 -70 14 -66 L13 -38 L-13 -38 Z" fill="${o.top}"/>` +
    `<path d="M-3 -72 L-3 -67 L3 -67 L3 -72 Z" fill="${o.skin}"/>` +
    at(0, -81, head, 0.85) +
    limb(armL, o.skin, 5) +
    limb(armR, o.skin, 5)
  );
}

/** Drop shape pointing up. Origin = drop centre. */
export function drop(colour: string, s = 1): string {
  return `<path transform="scale(${s})" d="M0 -14 C5 -6 10 -1 10 5 A10 10 0 0 1 -10 5 C-10 -1 -5 -6 0 -14 Z" fill="${colour}"/>`;
}

/** Green check mark in a circle, used for "do this" emphasis. Origin = centre. */
export function checkBadge(r = 11): string {
  return (
    `<circle cx="0" cy="0" r="${r}" fill="${P.green}" stroke-width="2.5"/>` +
    `<path d="M${-r * 0.45} 0 L${-r * 0.1} ${r * 0.38} L${r * 0.48} ${-r * 0.35}" fill="none" stroke="${P.paper}" stroke-width="3.2"/>`
  );
}

/** A simple bowl seen from the side. Origin = rim centre. */
export function bowl(w: number, fill: string, food: string): string {
  const h = w * 0.5;
  return (
    `<path d="M${-w / 2 + 2} -2 C${-w / 2 + 2} -${h * 0.35} ${w / 2 - 2} -${h * 0.35} ${w / 2 - 2} -2 Z" fill="${food}"/>` +
    `<path d="M${-w / 2} 0 L${w / 2} 0 C${w / 2 - 2} ${h} ${-w / 2 + 2} ${h} ${-w / 2} 0 Z" fill="${fill}"/>`
  );
}
