/**
 * Gaskin theme: 'system' | 'light' | 'dark', saved per device in browser storage.
 *
 * Resolution order:
 *   1. The worker's own choice of 'light' or 'dark' always wins.
 *   2. In 'system' mode inside the claude.ai Artifact viewer, the host's explicit
 *      `data-theme="dark" | "light"` on <html> wins (it is the viewer's own claude.ai setting).
 *   3. Otherwise `prefers-color-scheme`.
 *
 * The resolved theme is applied as Untitled UI's `.dark-mode` class on <html>, plus
 * `data-gaskin-theme` and `color-scheme`, so native form controls and scrollbars follow.
 * No React here: this module is also used before React mounts, to avoid a light flash.
 */
import { safeLocalStorage } from '../storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'gaskin.theme.v1';
const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function readMode(): ThemeMode {
  try {
    const v = safeLocalStorage()?.getItem(THEME_KEY);
    return v && (MODES as string[]).includes(v) ? (v as ThemeMode) : 'system';
  } catch {
    return 'system';
  }
}

export function writeMode(mode: ThemeMode): void {
  try {
    const ls = safeLocalStorage();
    if (!ls) return;
    if (mode === 'system') ls.removeItem(THEME_KEY);
    else ls.setItem(THEME_KEY, mode);
  } catch {
    /* private window or blocked storage: the choice lasts for this session only */
  }
}

/** The host's explicit theme stamp (claude.ai sets data-theme on the root element). */
export function hostTheme(root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): ResolvedTheme | null {
  const v = root?.getAttribute('data-theme');
  return v === 'dark' || v === 'light' ? v : null;
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveTheme(mode: ThemeMode, host: ResolvedTheme | null, prefersDark: boolean): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (host) return host;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(resolved: ResolvedTheme, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return;
  root.classList.toggle('dark-mode', resolved === 'dark');
  root.setAttribute('data-gaskin-theme', resolved);
  root.style.colorScheme = resolved;
}

/** Apply the saved theme at once (call before React renders). */
export function bootTheme(): ResolvedTheme {
  const r = resolveTheme(readMode(), hostTheme(), systemPrefersDark());
  applyTheme(r);
  return r;
}
