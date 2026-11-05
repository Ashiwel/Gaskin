import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp, useWorker } from './store';
import { loadDemoData, onBackendNote, signIn, useBridgeStatus } from './store/backend';
import { NavProvider, useNav, type Route } from './ui/nav';
import { ToastProvider, useToast } from './ui/components';
import { Today, useCaseload } from './ui/Today';
import { Patient } from './ui/Patient';
import { PhoneView } from './ui/PhoneView';
import { Review } from './ui/Review';
import { Dashboard } from './ui/Dashboard';
import { Library } from './ui/Library';
import { Settings } from './ui/Settings';
import { About } from './ui/About';
import { Register } from './ui/Register';
import { VisitScreen } from './ui/VisitScreen';
import { DemoPanel } from './ui/DemoPanel';
import { ManualAIHost } from './ui/ManualAISheet';
import { AIBadge } from './ui/ai';
import { useT } from './ui/i18n';
import { IBack, IBook, IChart, IDemo, IInfo, IPhone, IReview, ISettings, IToday, ICloudOff } from './ui/icons';
import { OnboardingWizard, useSetup, setupStore } from './setup';
import { WorkerLanguageFromSetup, PERSONAS, applyPersona } from './ui/setupFlow';
import { registerMessagePacks } from './ui/messagePacks';
import { artifactRuntime } from './hosted/runtime';
import SiblingFocusNav, { siblingFocusItem } from './ui/animata/SiblingFocusNav';
import { cn } from './ui/animata/cn';

registerMessagePacks();

type NavKey = 'today' | 'phone' | 'review' | 'dashboard' | 'library' | 'settings' | 'about';

const NAV: Array<{ key: NavKey; label: string; tKey: string; icon: ReactNode; mobile?: boolean }> = [
  { key: 'today', label: 'Today', tKey: 'nav.today', icon: <IToday />, mobile: true },
  { key: 'phone', label: 'Her phone', tKey: 'nav.messages', icon: <IPhone />, mobile: true },
  { key: 'review', label: 'Expert review', tKey: 'nav.review', icon: <IReview />, mobile: true },
  { key: 'dashboard', label: 'Programme', tKey: 'nav.dashboard', icon: <IChart />, mobile: true },
  { key: 'library', label: 'Library', tKey: 'nav.library', icon: <IBook /> },
  { key: 'settings', label: 'Settings', tKey: 'nav.settings', icon: <ISettings /> },
  { key: 'about', label: 'About', tKey: 'nav.about', icon: <IInfo /> },
];

function sectionOf(r: Route): NavKey {
  return r.name === 'patient' || r.name === 'register' || r.name === 'visit' ? 'today' : (r.name as NavKey);
}

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <button className="wordmark" onClick={onClick} aria-label="Gaskin, go to Today">
      Gaskin<i aria-hidden="true" />
    </button>
  );
}

function Screen() {
  const { route } = useNav();
  switch (route.name) {
    case 'today':
      return <Today />;
    case 'patient':
      return <Patient id={route.id} tab={route.tab} sheet={route.sheet} itemIds={route.itemIds} />;
    case 'visit':
      return <VisitScreen id={route.id} childId={route.childId} />;
    case 'phone':
      return <PhoneView id={route.id} />;
    case 'review':
      return <Review />;
    case 'dashboard':
      return <Dashboard />;
    case 'library':
      return <Library page={route.page} />;
    case 'settings':
      return <Settings />;
    case 'about':
      return <About />;
    case 'register':
      return <Register />;
    default:
      return <Today />;
  }
}

function MoreMenu({ go, onClose }: { go: (r: Route) => void; onClose: () => void }) {
  const t = useT();
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" style={{ top: 'auto', height: 'auto', width: '100%', borderRadius: '16px 16px 0 0' }} role="dialog" aria-label="More">
        <div className="sheet-body" style={{ gap: 4 }}>
          {NAV.filter((n) => !n.mobile).map((n) => (
            <button
              key={n.key}
              className="nav-item"
              onClick={() => {
                go({ name: n.key } as Route);
                onClose();
              }}
            >
              {n.icon}
              {t(n.tKey, n.label)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Storage and sync status, with sign-in and "Load demo data" when needed */
function StatusLine() {
  const s = useBridgeStatus();
  const [open, setOpen] = useState(false);
  if (!s.ready) return null;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 opacity-85" data-testid="storage-status" title={s.status?.fallbackReason ?? s.status?.label}>
        <span aria-hidden="true" className={cn('inline-block size-1.5 rounded-full', s.localOnly ? 'bg-amber' : 'bg-green')} />
        {s.line}
      </span>
      {s.needsLogin ? (
        <button onClick={() => setOpen(true)} data-testid="sign-in">
          Sign in
        </button>
      ) : null}
      {s.empty ? (
        <button onClick={() => void loadDemoData()} data-testid="load-demo">
          Load demo data
        </button>
      ) : null}
      {open ? <SignIn onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SignIn({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form
        className="sheet"
        role="dialog"
        aria-label="Sign in"
        style={{ top: 'auto', height: 'auto' }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await signIn(phone.trim(), pin.trim());
          setBusy(false);
          if (r) setErr(r);
          else onClose();
        }}
      >
        <div className="sheet-head">
          <h2>Sign in to the Gaskin server</h2>
        </div>
        <div className="sheet-body">
          <p className="small soft">Use the phone number and PIN your supervisor gave you. Until you sign in, your work is kept on this phone.</p>
          <label className="field">
            <span>Phone number</span>
            <input className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="field">
            <span>PIN</span>
            <input className="input" inputMode="numeric" type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </label>
          {err ? <p className="note amber">{err}</p> : null}
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Later
          </button>
          <button className="btn primary" disabled={busy || !phone || pin.length < 4}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </>
  );
}

function Shell() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { route, go, back } = useNav();
  const toast = useToast();
  const [demo, setDemo] = useState(false);
  const [more, setMore] = useState(false);
  const rows = useCaseload();
  const urgent = rows.filter((r) => (r.urgency === 'emergency' || r.urgency === 'urgent') && (state.country === 'ALL' || r.mother.country === state.country)).length;
  const openProposals = state.proposals.filter((p) => p.status === 'pending').length;
  const queued = state.outbound.filter((o) => o.status === 'queued').length;
  const current = sectionOf(route);
  const t = useT();

  useEffect(() => onBackendNote((n) => toast(n.text)), [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setDemo((d) => !d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mother = route.name === 'patient' || route.name === 'visit' ? state.mothers.find((m) => m.id === route.id) : undefined;
  const navItem = NAV.find((n) => n.key === current);
  const title = mother ? mother.name : navItem ? t(navItem.tKey, navItem.label) : '';

  if (route.name === 'visit') {
    return (
      <>
        <Screen />
        <ManualAIHost />
      </>
    );
  }

  return (
    <>
      <div className={`demo-banner${state.offline ? ' offline' : ''}`} role="note">
        {state.offline ? (
          <>
            <ICloudOff width={14} height={14} />
            <span>
              Offline. {queued ? `${queued} message${queued === 1 ? '' : 's'} waiting to sync.` : 'Changes are saved on this phone.'} Danger-sign alerts still go out by SMS.
            </span>
            <button onClick={() => dispatch({ type: 'setOffline', offline: false, now: new Date(state.clock).toISOString() })}>Reconnect</button>
          </>
        ) : (
          <>
            <span className="dot" />
            <span>{t('banner.demo', 'Demo with synthetic data')}</span>
            <span aria-hidden="true" className="opacity-50">
              ·
            </span>
            <StatusLine />
          </>
        )}
      </div>

      <div className="shell">
        <nav className="rail" aria-label="Main">
          <Wordmark onClick={() => go({ name: 'today' })} />
          <p className="rail-sub">Continuity of care, conception to day 1,000</p>
          <SiblingFocusNav className="gap-1">
            {NAV.map((n) => (
              <button key={n.key} className={cn('nav-item', siblingFocusItem)} aria-current={current === n.key ? 'page' : undefined} onClick={() => go({ name: n.key } as Route)}>
                {n.icon}
                {t(n.tKey, n.label)}
                {n.key === 'today' && urgent ? <span className="count hot">{urgent}</span> : null}
                {n.key === 'review' && openProposals ? <span className="count">{openProposals}</span> : null}
              </button>
            ))}
          </SiblingFocusNav>
          <div className="rail-foot">
            <div className="worker-card">
              <strong>{worker?.name}</strong>
              <span className="muted small">
                {worker?.isClinicalReviewer ? 'Clinical reviewer' : t('common.health_worker', 'Health worker')}
                {worker ? `, ${state.facilities.find((f) => f.id === worker.facilityId)?.name ?? ''}` : ''}
              </span>
            </div>
            <AIBadge />
          </div>
        </nav>

        <header className="topbar">
          {route.name === 'patient' ? (
            <button className="btn icon ghost" onClick={() => back()} aria-label={t('nav.back', 'Back')}>
              <IBack />
            </button>
          ) : (
            <Wordmark onClick={() => go({ name: 'today' })} />
          )}
          <span className="grow topbar-title">{route.name === 'patient' || current !== 'today' ? title : ''}</span>
          <AIBadge />
        </header>

        <main className="main" id="main">
          <Screen />
        </main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => n.mobile).map((n) => (
          <button key={n.key} aria-current={current === n.key ? 'page' : undefined} onClick={() => go({ name: n.key } as Route)}>
            {n.icon}
            {n.key === 'phone' ? t('nav.messages', 'Her phone') : n.key === 'review' ? t('nav.review', 'Review') : t(n.tKey, n.label)}
            {n.key === 'today' && urgent ? <span className="pip">{urgent}</span> : null}
            {n.key === 'review' && openProposals ? <span className="pip" style={{ background: 'var(--clay)' }}>{openProposals}</span> : null}
          </button>
        ))}
        <button aria-current={['library', 'settings', 'about'].includes(current) ? 'page' : undefined} onClick={() => setMore(true)}>
          <IBook />
          {t('common.more', 'More')}
        </button>
      </nav>

      <button className="demo-fab" onClick={() => setDemo(true)} aria-label="Open demo controls">
        <IDemo /> Demo <kbd>D</kbd>
      </button>

      {demo ? <DemoPanel onClose={() => setDemo(false)} /> : null}
      {more ? <MoreMenu go={(r) => go(r)} onClose={() => setMore(false)} /> : null}
      <ManualAIHost />
    </>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page narrow" style={{ padding: '64px 16px' }}>
          <h1 className="t-title">Something went wrong on this screen</h1>
          <p className="soft" style={{ margin: '12px 0 20px' }}>
            Your records are safe on this device. Reset the demo to start again.
          </p>
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => {
                try {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('gaskin.'))
                    .forEach((k) => localStorage.removeItem(k));
                } catch {
                  /* ignore */
                }
                window.location.hash = '';
                window.location.reload();
              }}
            >
              Reset demo
            </button>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** First launch: the onboarding wizard, with three presets a reviewer can pick instead. */
function SetupGate({ children }: { children: ReactNode }) {
  const saved = useSetup();
  const [skipped, setSkipped] = useState(false);
  if (saved || skipped) return <>{children}</>;
  return <Onboarding onSkip={() => setSkipped(true)} />;
}

function Onboarding({ onSkip }: { onSkip: () => void }) {
  const { dispatch } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const land = (workerId?: string) => {
    if (workerId) dispatch({ type: 'setWorker', workerId });
    dispatch({ type: 'setCountry', country: 'ALL' });
    try {
      window.history.replaceState({ route: { name: 'today' }, depth: 0 }, '', '#today');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="min-h-dvh bg-paper">
      <section aria-label="Quick start" className="mx-auto max-w-[760px] px-4 pt-8 sm:pt-12">
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink-3">For reviewers: skip the questions</p>
        <h1 className="mt-2 mb-1 font-serif text-[1.6rem] leading-tight font-medium text-ink">Start as one of three health workers</h1>
        <p className="m-0 max-w-[60ch] text-[0.95rem] text-ink-2">Each applies the setup Gaskin would recommend for her, at once. Or answer the questions below for your own.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              data-persona={p.id}
              disabled={Boolean(busy)}
              className="flex min-h-[44px] cursor-pointer flex-col gap-1.5 rounded-[var(--r-l)] border border-line bg-card p-4 text-left text-ink transition-colors duration-200 hover:border-clay focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60 motion-reduce:transition-none"
              onClick={async () => {
                setBusy(p.id);
                try {
                  await applyPersona(p, Boolean(artifactRuntime()));
                } catch {
                  /* applySetupPlan never throws; this is belt and braces */
                }
                land(p.workerId);
                setBusy(null);
              }}
            >
              <strong className="font-serif text-[1.08rem] leading-snug font-medium">{p.title}</strong>
              <span className="text-[0.84rem] leading-snug text-ink-2">{p.blurb}</span>
              <span className="mt-auto pt-1 text-[0.8rem] font-semibold text-clay-ink">{busy === p.id ? 'Setting up…' : 'Use this setup'}</span>
            </button>
          ))}
        </div>
      </section>
      <OnboardingWizard
        onComplete={() => land()}
        onSkipAll={() => {
          onSkip();
          land();
        }}
      />
    </div>
  );
}

function WithNav() {
  const { state } = useApp();
  return (
    <NavProvider motherIds={state.mothers.map((m) => m.id)}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </NavProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <WorkerLanguageFromSetup>
          <SetupGate>
            <WithNav />
          </SetupGate>
        </WorkerLanguageFromSetup>
      </AppProvider>
    </ErrorBoundary>
  );
}

export { setupStore };
