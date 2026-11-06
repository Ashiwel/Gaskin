import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type PatientTab = 'plan' | 'timeline' | 'history' | 'baby' | 'messages';
export type Sheet = 'record' | 'compose' | 'handout' | null;

export type Route =
  | { name: 'today' }
  | { name: 'patient'; id: string; tab: PatientTab; sheet?: Sheet; itemIds?: string[] }
  | { name: 'phone'; id?: string }
  | { name: 'review' }
  | { name: 'insights' }
  | { name: 'mothers' }
  | { name: 'visits' }
  | { name: 'design' }
  | { name: 'library'; page?: 'practices' | 'how' | 'sources' }
  | { name: 'settings' }
  | { name: 'register' }
  | { name: 'visit'; id: string; childId?: string }
  | { name: 'about' };

const SECTIONS = ['today', 'mothers', 'visits', 'phone', 'review', 'insights', 'library', 'settings', 'about', 'register', 'design'] as const;

// claude.ai reserves some hash names (settings, downloads...), so sections get their own.
const HASH: Record<string, string> = {
  today: 'today',
  mothers: 'mothers',
  visits: 'visits',
  phone: 'her-phone',
  review: 'review',
  insights: 'insights',
  library: 'library',
  settings: 'ai-and-data',
  about: 'about',
  register: 'register',
  design: 'design',
};
/** Old links keep working. */
const HASH_ALIASES: Record<string, string> = { programme: 'insights', dashboard: 'insights' };

function hashFor(r: Route): string {
  if (r.name === 'patient' || r.name === 'visit') return `#mother-${r.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  return `#${HASH[r.name] ?? r.name}`;
}

function routeFromHash(motherIds: string[]): Route {
  let h = '';
  try {
    h = window.location.hash.replace(/^#/, '');
  } catch {
    /* ignore */
  }
  if (h.startsWith('mother-')) {
    const slug = h.slice(7);
    const id = motherIds.find((m) => m.replace(/[^a-zA-Z0-9-]/g, '-') === slug);
    if (id) return { name: 'patient', id, tab: 'plan' };
  }
  const hh = HASH_ALIASES[h] ?? h;
  const name = Object.keys(HASH).find((k) => HASH[k] === hh);
  if (name && (SECTIONS as readonly string[]).includes(name)) return { name } as Route;
  return { name: 'today' };
}

interface NavCtx {
  route: Route;
  go: (r: Route, opts?: { replace?: boolean }) => void;
  back: () => void;
}

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({ children, motherIds }: { children: ReactNode; motherIds: string[] }) {
  const [route, setRoute] = useState<Route>(() => {
    try {
      const st = window.history.state as { route?: Route } | null;
      if (st?.route) return st.route;
    } catch {
      /* ignore */
    }
    return routeFromHash(motherIds);
  });
  const lastDepth = useRef(0);

  // Mother ids change as records load; the listeners read the latest list.
  const idsRef = useRef(motherIds);
  idsRef.current = motherIds;

  useEffect(() => {
    // A typed or pasted URL (#insights, #mother-...) makes a new history entry with no state.
    // Chrome fires popstate and hashchange for it, some browsers and frames only hashchange.
    // Both resolve the route from the hash and stamp the entry so Back works from it.
    const fromHash = () => {
      const r = routeFromHash(idsRef.current);
      try {
        const prev = window.history.state as { route?: Route; depth?: number } | null;
        if (!prev?.route) window.history.replaceState({ route: r, depth: lastDepth.current + 1 }, '', hashFor(r));
      } catch {
        /* ignore */
      }
      setRoute((cur) => (hashFor(cur) === hashFor(r) && cur.name === r.name ? cur : r));
    };
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { route?: Route; depth?: number } | null;
      if (st?.route) {
        lastDepth.current = st.depth ?? 0;
        setRoute(st.route);
      } else fromHash();
    };
    const onHash = () => {
      const st = window.history.state as { route?: Route; depth?: number } | null;
      if (st?.route) {
        lastDepth.current = st.depth ?? 0;
        return; // already handled by popstate or by go()
      }
      fromHash();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    try {
      window.history.replaceState({ route, depth: 0 }, '', hashFor(route));
    } catch {
      /* sandboxed frames may refuse; navigation still works in memory */
    }
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((r: Route, opts?: { replace?: boolean }) => {
    setRoute(r);
    try {
      const depth = ((window.history.state as { depth?: number } | null)?.depth ?? 0) + (opts?.replace ? 0 : 1);
      lastDepth.current = depth;
      if (opts?.replace) window.history.replaceState({ route: r, depth }, '', hashFor(r));
      else window.history.pushState({ route: r, depth }, '', hashFor(r));
    } catch {
      /* ignore */
    }
    if (!(r.name === 'patient' && r.sheet)) {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const back = useCallback(() => {
    let depth = 0;
    try {
      depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
    } catch {
      /* ignore */
    }
    if (depth > 0) {
      window.history.back();
      return;
    }
    setRoute((cur) => {
      const next: Route = cur.name === 'patient' && cur.sheet ? { ...cur, sheet: null } : { name: 'today' };
      try {
        window.history.replaceState({ route: next, depth: 0 }, '', hashFor(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ route, go, back }), [route, go, back]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav outside NavProvider');
  return c;
}
