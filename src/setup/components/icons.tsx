/**
 * Simple line pictograms for the onboarding answers. 48px viewBox, stroke uses currentColor
 * so the theme decides the colour. Each is drawn to read without words.
 */
import type { ReactElement } from 'react';
import type { IconKey } from '../questions';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const person = (x = 24, y = 14, r = 6) => (
  <>
    <circle cx={x} cy={y} r={r} {...S} />
    <path d={`M${x - 11} ${y + 26}c0-7 5-12 11-12s11 5 11 12`} {...S} />
  </>
);
const phone = (fillScreen = true) => (
  <>
    <rect x="15" y="5" width="18" height="38" rx="4" {...S} />
    {fillScreen ? <rect x="18" y="10" width="12" height="24" rx="1.5" fill="currentColor" opacity=".18" /> : null}
    <circle cx="24" cy="38.5" r="1.6" fill="currentColor" />
  </>
);
const basic = (
  <>
    <rect x="16" y="5" width="16" height="38" rx="4" {...S} />
    <rect x="19" y="9" width="10" height="9" rx="1" {...S} />
    {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={20 + c * 4} cy={24 + r * 5} r="1.3" fill="currentColor" />))}
  </>
);
const signal = (n: number) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={9 + i * 8} y={36 - i * 8} width="5" height={6 + i * 8} rx="1.5" fill={i < n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
    ))}
  </>
);
const coins = (n: number) => (
  <>
    {Array.from({ length: n }).map((_, i) => (
      <ellipse key={i} cx={24} cy={36 - i * 6} rx="12" ry="4" {...S} fill="var(--card)" />
    ))}
  </>
);
const bulb = (fillLevel: number) => (
  <>
    <path d="M24 6a12 12 0 0 0-7 21.7V33h14v-5.3A12 12 0 0 0 24 6z" {...S} />
    {fillLevel > 0 ? <path d={fillLevel > 1 ? 'M24 9a9 9 0 0 0-5 16.4V30h10v-4.6A9 9 0 0 0 24 9z' : 'M19 22h10v8H19z'} fill="currentColor" opacity=".35" /> : null}
    <path d="M19 38h10M21 42h6" {...S} />
    {fillLevel === 0 ? <path d="M8 8l32 32" {...S} /> : null}
  </>
);
const people = (n: number) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const x = 24 + (i - (n - 1) / 2) * 9;
      return (
        <g key={i}>
          <circle cx={x} cy={18} r="4" {...S} />
          <path d={`M${x - 6} 34c0-4 3-7 6-7s6 3 6 7`} {...S} />
        </g>
      );
    })}
  </>
);
const stars = (n: number) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M${8 + i * 10.5} 20l2 4.3 4.7.6-3.4 3.2.9 4.7-4.2-2.3-4.2 2.3.9-4.7-3.4-3.2 4.7-.6z`} fill={i < n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    ))}
  </>
);
const speech = (
  <>
    <path d="M8 10h32v20H22l-8 7v-7H8z" {...S} />
    <path d="M14 18h20M14 23h12" {...S} />
  </>
);

const ICONS: Record<IconKey, ReactElement> = {
  midwife: (
    <>
      {person(20, 13, 6)}
      <circle cx="35" cy="30" r="4" {...S} />
      <path d="M30 40c0-3 2-6 5-6" {...S} />
    </>
  ),
  nurse: (
    <>
      {person()}
      <path d="M21 4h6M24 1v6" {...S} />
    </>
  ),
  chw: (
    <>
      {person(18, 13, 5.5)}
      <path d="M30 20h12v16H30z" {...S} />
      <path d="M36 24v8M32 28h8" {...S} />
    </>
  ),
  doctor: (
    <>
      {person()}
      <path d="M17 28v6a4 4 0 0 0 8 0" {...S} />
      <circle cx="25" cy="34" r="2" fill="currentColor" />
    </>
  ),
  supervisor: (
    <>
      {person(24, 12, 5)}
      <path d="M8 44h32M12 44V36h24v8" {...S} />
    </>
  ),
  person: person(),
  question: (
    <>
      <circle cx="24" cy="24" r="18" {...S} />
      <path d="M18.5 19a5.5 5.5 0 1 1 7.5 5.1c-1.3.6-2 1.6-2 3V29" {...S} />
      <circle cx="24" cy="34.5" r="1.8" fill="currentColor" />
    </>
  ),
  flag: (
    <>
      <path d="M12 44V6" {...S} />
      <path d="M12 8h24l-5 7 5 7H12" {...S} />
    </>
  ),
  map: (
    <>
      <path d="M6 12l11-5 14 5 11-5v29l-11 5-14-5-11 5z" {...S} />
      <path d="M17 7v29M31 12v29" {...S} />
    </>
  ),
  pin: (
    <>
      <path d="M24 44s-13-13-13-23a13 13 0 0 1 26 0c0 10-13 23-13 23z" {...S} />
      <circle cx="24" cy="21" r="4.5" {...S} />
    </>
  ),
  globe: (
    <>
      <circle cx="24" cy="24" r="18" {...S} />
      <path d="M6 24h36M24 6c6 6 6 30 0 36M24 6c-6 6-6 30 0 36" {...S} />
    </>
  ),
  speech,
  speech_many: (
    <>
      <path d="M5 8h24v15H16l-6 5v-5H5z" {...S} />
      <path d="M33 18h10v15h-4v5l-6-5H20v-6" {...S} />
    </>
  ),
  phone_smart: phone(true),
  phone_basic: basic,
  phone_shared: (
    <>
      <g transform="translate(-6 0)">{basic}</g>
      <circle cx="38" cy="16" r="4" {...S} />
      <path d="M32 30c0-4 3-7 6-7s6 3 6 7" {...S} />
    </>
  ),
  laptop: (
    <>
      <rect x="9" y="10" width="30" height="20" rx="2" {...S} />
      <path d="M4 36h40l-3 4H7z" {...S} />
    </>
  ),
  tablet: (
    <>
      <rect x="9" y="5" width="30" height="38" rx="4" {...S} />
      <circle cx="24" cy="38.5" r="1.6" fill="currentColor" />
    </>
  ),
  computer_shared: (
    <>
      <rect x="6" y="7" width="36" height="24" rx="2" {...S} />
      <path d="M18 38h12M24 31v7" {...S} />
      <path d="M33 12h4v4" {...S} />
    </>
  ),
  iphone: (
    <>
      <rect x="15" y="5" width="18" height="38" rx="5" {...S} />
      <path d="M21 8h6" {...S} />
    </>
  ),
  none: (
    <>
      <circle cx="24" cy="24" r="17" {...S} />
      <path d="M12 36L36 12" {...S} />
    </>
  ),
  windows: (
    <>
      <path d="M8 11l13-2v14H8zM24 8.5l16-2.5v17H24zM8 26h13v14l-13-2zM24 26h16v17l-16-2.5z" {...S} />
    </>
  ),
  apple: (
    <>
      <path d="M24 14c-3-3-12-3-13 7s5 21 9 21c2 0 2.5-1 4-1s2 1 4 1c4 0 10-11 9-21s-10-10-13-7z" {...S} />
      <path d="M24 13c0-4 3-7 6-7" {...S} />
    </>
  ),
  linux: (
    <>
      <ellipse cx="24" cy="27" rx="11" ry="14" {...S} />
      <circle cx="20" cy="20" r="1.6" fill="currentColor" />
      <circle cx="28" cy="20" r="1.6" fill="currentColor" />
      <path d="M21 25l3 2 3-2M16 42h-4M32 42h4" {...S} />
    </>
  ),
  chromebook: (
    <>
      <circle cx="24" cy="24" r="17" {...S} />
      <circle cx="24" cy="24" r="6.5" {...S} />
      <path d="M24 17.5h16M18.4 27.2L10.3 13M29.6 27.2L21.5 41" {...S} />
    </>
  ),
  signal_none: (
    <>
      {signal(0)}
      <path d="M8 8l32 32" {...S} />
    </>
  ),
  signal_low: signal(2),
  signal_mid: signal(4),
  wifi: (
    <>
      <path d="M6 18a26 26 0 0 1 36 0M12 25a17 17 0 0 1 24 0M18 32a8 8 0 0 1 12 0" {...S} />
      <circle cx="24" cy="38" r="2.4" fill="currentColor" />
    </>
  ),
  coins_1: coins(1),
  coins_2: coins(2),
  coins_3: coins(3),
  coins_4: coins(4),
  bulb_on: (
    <>
      {bulb(2)}
      <path d="M6 18h3M39 18h3M10 7l2 2M38 7l-2 2" {...S} />
    </>
  ),
  bulb_half: bulb(1),
  bulb_off: bulb(0),
  printer: (
    <>
      <path d="M14 18V6h20v12" {...S} />
      <rect x="6" y="18" width="36" height="16" rx="3" {...S} />
      <path d="M14 30h20v12H14z" {...S} />
    </>
  ),
  building: (
    <>
      <path d="M8 42V14l16-8 16 8v28z" {...S} />
      <path d="M21 42v-9h6v9M24 16v8M20 20h8" {...S} />
    </>
  ),
  office: (
    <>
      <path d="M6 42h36M10 42V18h28v24M8 18l16-11 16 11" {...S} />
      <path d="M16 24v12M24 24v12M32 24v12" {...S} />
    </>
  ),
  spark: (
    <>
      <path d="M24 5l4 13 13 4-13 4-4 13-4-13-13-4 13-4z" {...S} />
    </>
  ),
  chat: (
    <>
      <path d="M24 7c10 0 18 6.5 18 15s-8 15-18 15c-2 0-4-.3-6-.8L9 40l2-7c-3-3-5-6.6-5-11 0-8.5 8-15 18-15z" {...S} />
      <circle cx="17" cy="22" r="1.8" fill="currentColor" />
      <circle cx="24" cy="22" r="1.8" fill="currentColor" />
      <circle cx="31" cy="22" r="1.8" fill="currentColor" />
    </>
  ),
  wallet: (
    <>
      <rect x="6" y="12" width="36" height="26" rx="4" {...S} />
      <path d="M30 22h12v8H30a4 4 0 0 1 0-8z" {...S} />
    </>
  ),
  gift: (
    <>
      <rect x="8" y="18" width="32" height="24" rx="2" {...S} />
      <path d="M6 18h36v-6H6zM24 12v30M24 12c-3-6-11-6-10 0M24 12c3-6 11-6 10 0" {...S} />
    </>
  ),
  people_few: people(1),
  people_some: people(2),
  people_many: people(3),
  people_crowd: people(4),
  hand: (
    <>
      <path d="M16 26V12a3 3 0 0 1 6 0v10M22 22V9a3 3 0 0 1 6 0v13M28 22V12a3 3 0 0 1 6 0v16c0 9-5 15-12 15s-11-4-14-10l-3-6a3 3 0 0 1 5-3l4 5" {...S} />
    </>
  ),
  team: (
    <>
      {people(3)}
      <path d="M8 42h32" {...S} />
    </>
  ),
  star_1: stars(1),
  star_2: stars(2),
  star_3: stars(3),
  star_4: stars(4),
  check: (
    <>
      <circle cx="24" cy="24" r="18" {...S} />
      <path d="M15 24l6 6 12-13" {...S} />
    </>
  ),
};

export function SetupIcon({ name, size = 48 }: { name: IconKey; size?: number }) {
  return (
    <svg className="setup-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {ICONS[name] ?? ICONS.question}
    </svg>
  );
}
