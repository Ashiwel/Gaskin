import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, hostTheme, readMode, resolveTheme, systemPrefersDark, writeMode, type ResolvedTheme, type ThemeMode } from './theme';

interface ThemeCtx {
  /** The worker's setting. */
  mode: ThemeMode;
  /** What is on screen now. */
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
  /** Flip between light and dark (sets an explicit mode). */
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: 'system', resolved: 'light', setMode: () => {}, toggle: () => {} });

/**
 * Keeps <html> in step with the worker's theme setting, the OS preference and, inside the
 * claude.ai Artifact viewer, the host's `data-theme` stamp (watched with a MutationObserver).
 */
export function ThemeProvider({ children, initialMode }: { children: ReactNode; initialMode?: ThemeMode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => initialMode ?? readMode());
  const [host, setHost] = useState<ResolvedTheme | null>(() => hostTheme());
  const [prefersDark, setPrefersDark] = useState<boolean>(() => systemPrefersDark());

  useEffect(() => {
    let mq: MediaQueryList | undefined;
    try {
      mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    } catch {
      mq = undefined;
    }
    const onMq = () => setPrefersDark(!!mq?.matches);
    mq?.addEventListener?.('change', onMq);

    let obs: MutationObserver | undefined;
    try {
      obs = new MutationObserver(() => setHost(hostTheme()));
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch {
      obs = undefined;
    }
    return () => {
      mq?.removeEventListener?.('change', onMq);
      obs?.disconnect();
    };
  }, []);

  const resolved = resolveTheme(mode, host, prefersDark);
  useEffect(() => applyTheme(resolved), [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    writeMode(m);
    setModeState(m);
  }, []);
  const toggle = useCallback(() => setMode(resolved === 'dark' ? 'light' : 'dark'), [resolved, setMode]);

  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
