/// <reference types="node" />
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolveTheme } from './theme';
import { ThemeProvider, useTheme } from './ThemeProvider';

describe('theme resolution', () => {
  it('the worker’s explicit choice wins over the host and the OS', () => {
    expect(resolveTheme('light', 'dark', true)).toBe('light');
    expect(resolveTheme('dark', 'light', false)).toBe('dark');
  });
  it('in system mode the claude.ai host stamp wins over the OS preference', () => {
    expect(resolveTheme('system', 'dark', false)).toBe('dark');
    expect(resolveTheme('system', 'light', true)).toBe('light');
  });
  it('in system mode with no host stamp, prefers-color-scheme decides', () => {
    expect(resolveTheme('system', null, true)).toBe('dark');
    expect(resolveTheme('system', null, false)).toBe('light');
  });
  it('the provider renders without a DOM (server render) and exposes the mode', () => {
    function Probe() {
      const t = useTheme();
      return <span>{`${t.mode}/${t.resolved}`}</span>;
    }
    expect(renderToStaticMarkup(<ThemeProvider initialMode="dark"><Probe /></ThemeProvider>)).toContain('dark/dark');
    expect(renderToStaticMarkup(<ThemeProvider initialMode="light"><Probe /></ThemeProvider>)).toContain('light/light');
  });
});

describe('dark-mode tokens', () => {
  const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf8');
  const light = css.slice(css.indexOf('@theme static'), css.indexOf('@layer base'));
  const dark = css.slice(css.indexOf('.dark-mode {'));
  const decl = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

  it('every text, background, border and foreground token is redefined for dark mode', () => {
    const names = [...light.matchAll(/(--color-(?:text|bg|border|fg)-[\w-]+):/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(60);
    const missing = names.filter((n) => !decl(dark, n) && !['--color-text-white', '--color-fg-white'].includes(n));
    expect(missing).toEqual([]);
  });
  it('surfaces are dark and text is light in dark mode', () => {
    expect(decl(dark, '--color-bg-primary')).toBe('var(--color-neutral-950)');
    expect(decl(dark, '--color-text-primary')).toBe('var(--color-neutral-50)');
    expect(decl(light, '--color-bg-primary')).toBe('var(--color-white)');
    expect(decl(light, '--color-text-primary')).toBe('var(--color-neutral-900)');
  });
  it('danger is the error scale, never brand', () => {
    expect(decl(light, '--color-bg-error-solid')).toContain('red');
    expect(decl(dark, '--color-bg-error-solid')).toContain('red');
    expect(decl(light, '--color-bg-brand-solid')).toContain('brand');
  });
  it('chart series are redefined for the dark surface', () => {
    for (let i = 1; i <= 6; i++) expect(decl(dark, `--color-chart-${i}`)).toBeTruthy();
  });
});
