/// <reference types="node" />
/**
 * Dark mode stays correct only if every colour comes from a theme token. This test fails when a
 * .ts, .tsx or .css file outside the theme contains a colour literal: hex (#fff, #a3482a), rgb(),
 * rgba(), hsl(), hsla(), or a fixed-colour Tailwind class (text-black, bg-white, border-white/12,
 * bg-gray-100 and so on).
 *
 * Fix a failure by using a semantic token (bg-primary, text-secondary, border-secondary, fg-*,
 * bg-error-primary, text-on-fill, var(--color-...)) instead. Files that must carry fixed colours
 * are listed below, each with its reason; keep the list short.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files allowed to contain literals, with the reason. Paths are relative to src/. */
const ALLOWLIST: Record<string, string> = {
  'styles/theme.css': 'the token definitions themselves',
  'styles/fonts.css': 'embedded font data (base64 can look like hex)',
  'illustrations/palette.ts': 'the pictograms’ fixed palette, printed on paper and shown to mothers',
  'illustrations/handout.ts': 'printable handout HTML, always black on white paper',
  'illustrations/illustrations.test.ts': 'tests the illustration palette',
  'styles/no-hardcoded-colours.test.ts': 'this test',
  // Untitled UI (MIT) internals: fixed white text on solid brand or error fills, and decorative
  // glass highlights that look the same in both themes. Reviewed: none puts dark text on a dark
  // surface or light text on a light one.
  'components/base/buttons/button.tsx': 'Untitled UI: white text on solid primary and destructive fills',
  'components/base/buttons/close-button.tsx': 'Untitled UI: translucent white hover on the dark overlay',
  'components/base/tooltip/tooltip.tsx': 'Untitled UI: white text on the dark tooltip',
  'components/base/avatar/avatar.tsx': 'Untitled UI: hairline glass edge on photos',
  'components/base/avatar/base-components/avatar-count.tsx': 'Untitled UI: white count on a solid fill',
  'components/base/avatar/base-components/avatar-online-indicator.tsx': 'Untitled UI: glass highlight',
  'components/foundations/featured-icon/featured-icon.tsx': 'Untitled UI: modern-neue bevel shadow',
  'components/application/date-picker/cell.tsx': 'Untitled UI: white text on the selected brand day',
  'components/base/input/input-date.tsx': 'Untitled UI: white text on the selected segment',
};

const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FUNC = /\b(?:rgba?|hsla?)\(/;
const NAMED_CLASS =
  /(?:^|[\s"'`:])(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|outline|from|to|via|divide|decoration|placeholder|caret|accent|shadow)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/\d+)?(?=$|[\s"'`])/;

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** Every source file as text, keyed by its path relative to src/. */
const SOURCES: Record<string, string> = Object.fromEntries(walk(ROOT).map((f) => [relative(ROOT, f).split('\\').join('/'), readFileSync(f, 'utf8')]));

/** Remove comments so documentation can mention colours. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function findColourLiterals(src: string): string[] {
  const hits: string[] = [];
  stripComments(src)
    .split('\n')
    .forEach((line, i) => {
      if (HEX.test(line) || FUNC.test(line) || NAMED_CLASS.test(line)) hits.push(`${i + 1}: ${line.trim().slice(0, 140)}`);
    });
  return hits;
}

describe('no hard-coded colours outside the theme', () => {
  it('detects the literals it is meant to catch', () => {
    expect(findColourLiterals('color: #a3482a;')).toHaveLength(1);
    expect(findColourLiterals("style={{ background: 'rgba(0,0,0,.4)' }}")).toHaveLength(1);
    expect(findColourLiterals('<p className="text-black">')).toHaveLength(1);
    expect(findColourLiterals('<div className="hover:bg-white/20 p-2">')).toHaveLength(1);
    expect(findColourLiterals('<div className="bg-gray-100">')).toHaveLength(1);
    expect(findColourLiterals('<div className="bg-primary text-secondary border-secondary">')).toHaveLength(0);
    expect(findColourLiterals('white-space: nowrap; // #fff in a comment')).toHaveLength(0);
    expect(findColourLiterals('<a href="#main">&#8230;</a>')).toHaveLength(0);
  });

  it('finds none in source files outside the allowlist', () => {
    const offenders: string[] = [];
    for (const [rel, src] of Object.entries(SOURCES)) {
      if (rel in ALLOWLIST) continue;
      const hits = findColourLiterals(src);
      if (hits.length) offenders.push(`${rel}\n    ${hits.slice(0, 5).join('\n    ')}`);
    }
    expect(offenders, `Use theme tokens instead of colour literals:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('keeps the allowlist honest: every entry exists', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    expect(Object.keys(ALLOWLIST).filter((k) => !(k in SOURCES))).toEqual([]);
  });
});
