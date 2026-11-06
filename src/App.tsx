import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp, useWorker } from './store';
import { loadDemoData, onBackendNote, signIn, useBridgeStatus } from './store/backend';
import { NavProvider, useNav, type Route } from './ui/nav';
import { ToastProvider, useToast } from './ui/components';
import { Today, useCaseload } from './ui/Today';
import { Patient } from './ui/Patient';
import { PhoneView } from './ui/PhoneView';
import { Review } from './ui/Review';
import { Insights } from './ui/insights/Insights';
import { Library } from './ui/Library';
import { Settings } from './ui/Settings';
import { About } from './ui/About';
import { Register } from './ui/Register';
import { Mothers } from './ui/mothers/Mothers';
import { Visits } from './ui/visits-list/Visits';
import { VisitScreen } from './ui/VisitScreen';
import { DemoPanel } from './ui/DemoPanel';
import { ManualAIHost } from './ui/ManualAISheet';
import { useAIStatus } from './ui/ai';
import { useT } from './ui/i18n';
import { IDemo, ICloudOff } from './ui/icons';
import { useSetup, setupStore } from './setup';
import { WorkerLanguageFromSetup } from './ui/setupFlow';
import { OnboardingScreen } from './ui/onboarding/Onboarding';
import { AccountGate, useShellWorker, useWorkerMenuActions } from './ui/accounts/Accounts';
import { personalLegal } from './ui/settings/legalInfo';
import { registerMessagePacks } from './ui/messagePacks';
import { AppShell, NAV_T_KEY, PERSONAL_NAV, WORKER_NAV, type NavEntry, type NavKey, type SearchResult, type ShellMode, type ShellNotification } from './components/shell';
import { ThemeProvider } from './theme';
import { DesignShowcase } from './design/DesignShowcase';

registerMessagePacks();

/** Which nav item a route belongs to. */
function sectionOf(r: Route): NavKey | null {
  switch (r.name) {
    case 'patient':
    case 'visit':
    case 'today':
      return 'today';
    case 'register':
      return 'mothers';
    case 'phone':
      return 'messages';
    case 'insights':
      return 'insights';
    case 'mothers':
    case 'visits':
    case 'review':
    case 'library':
    case 'settings':
    case 'about':
      return r.name;
    default:
      return null;
  }
}

function routeFor(k: NavKey): Route {
  switch (k) {
    case 'messages':
      return { name: 'phone' };
    case 'my-plan':
    case 'my-baby':
      return { name: 'today' };
    default:
      return { name: k } as Route;
  }
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
    case 'insights':
      return <Insights />;
    case 'mothers':
      return <Mothers />;
    case 'visits':
      return <Visits />;
    case 'design':
      return <DesignShowcase />;
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

/** Sign-in and "Load demo data" when needed (the sync line itself is on the worker card). */
function StatusActions() {
  const s = useBridgeStatus();
  const [open, setOpen] = useState(false);
  if (!s.ready || (!s.needsLogin && !s.empty && !open)) return null;
  return (
    <>
      {s.needsLogin ? (
        <button className="font-semibold underline underline-offset-2" onClick={() => setOpen(true)} data-testid="sign-in">
          Sign in
        </button>
      ) : null}
      {s.empty ? (
        <button className="font-semibold underline underline-offset-2" onClick={() => void loadDemoData()} data-testid="load-demo">
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

/** Personal mode (a mother using Gaskin for herself) is chosen at setup; the auth module will own it. */
function useShellMode(): ShellMode {
  const saved = useSetup();
  const a = saved?.answers as { role?: string; audience?: string } | undefined;
  return a?.audience === 'personal' || a?.role === 'personal' || a?.role === 'mother' ? 'personal' : 'worker';
}

function Shell() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { route, go, back } = useNav();
  const toast = useToast();
  const ai = useAIStatus();
  const bridge = useBridgeStatus();
  const mode = useShellMode();
  const menuActions = useWorkerMenuActions();
  const [demo, setDemo] = useState(false);
  const rows = useCaseload();
  const urgent = rows.filter((r) => r.urgency === 'emergency' || r.urgency === 'urgent').length;
  const openProposals = state.proposals.filter((p) => p.status === 'pending').length;
  const queued = state.outbound.filter((o) => o.status === 'queued').length;
  const unreadReplies = state.mothers.filter((m) => state.inbound.some((i) => i.motherId === m.id && (!state.readInbound[m.id] || i.receivedAt > state.readInbound[m.id]))).length;
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

  const nav: NavEntry[] = (mode === 'personal' ? PERSONAL_NAV : WORKER_NAV)
    .filter((n) => n.key !== 'review' || worker?.isClinicalReviewer || openProposals > 0)
    .map((n) => ({
      ...n,
      label: NAV_T_KEY[n.key] ? t(NAV_T_KEY[n.key]!, n.label) : n.label,
      badge: n.key === 'today' ? urgent : n.key === 'review' ? openProposals : n.key === 'messages' ? unreadReplies : undefined,
      badgeTone: n.key === 'today' ? 'error' : 'gray',
    }));

  const mother = route.name === 'patient' || route.name === 'visit' ? state.mothers.find((m) => m.id === route.id) : undefined;
  const facility = state.facilities.find((f) => f.id === worker?.facilityId)?.name;
  const shellWorker = useShellWorker(
    worker ? { id: worker.id, name: worker.name, role: worker.isClinicalReviewer ? 'Clinical reviewer' : t('common.health_worker', 'Health worker'), subtitle: facility } : undefined,
  );

  const search = (q: string): SearchResult[] => {
    const needle = q.toLowerCase();
    const mothers = state.mothers
      .filter((m) => m.name.toLowerCase().includes(needle) || m.community?.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((m) => ({ id: `m-${m.id}`, label: m.name, detail: m.community, group: 'Mother', onSelect: () => go({ name: 'patient', id: m.id, tab: 'plan' }) }));
    const pages = nav
      .filter((n) => n.label.toLowerCase().includes(needle))
      .map((n) => ({ id: `p-${n.key}`, label: n.label, group: 'Page', onSelect: () => go(routeFor(n.key)) }));
    return [...mothers, ...pages];
  };

  const notifications: ShellNotification[] = [
    ...rows
      .filter((r) => r.urgency === 'emergency' || r.urgency === 'urgent')
      .slice(0, 5)
      .map((r) => ({ id: `u-${r.mother.id}`, title: r.mother.name, body: r.reason, tone: 'error' as const, unread: true, onOpen: () => go({ name: 'patient', id: r.mother.id, tab: 'plan' }) })),
    ...(openProposals ? [{ id: 'review', title: `${openProposals} change${openProposals === 1 ? '' : 's'} waiting for review`, tone: 'brand' as const, unread: true, onOpen: () => go({ name: 'review' }) }] : []),
  ];

  if (route.name === 'visit') {
    return (
      <>
        <Screen />
        <ManualAIHost />
      </>
    );
  }

  const notice = state.offline ? (
    <div role="note" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning-primary px-4 py-2 text-center text-sm text-warning-primary ring-1 ring-border-warning_subtle">
      <ICloudOff width={16} height={16} aria-hidden="true" />
      <span>
        Offline. {queued ? `${queued} message${queued === 1 ? '' : 's'} waiting to sync.` : 'Changes are saved on this phone.'} Danger-sign alerts still go out by SMS.
      </span>
      <button className="font-semibold underline underline-offset-2" onClick={() => dispatch({ type: 'setOffline', offline: false, now: new Date(state.clock).toISOString() })}>
        Reconnect
      </button>
    </div>
  ) : (
    <div role="note" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-secondary px-4 py-1.5 text-center text-xs text-tertiary">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-fg-brand-secondary" />
        {t('banner.demo', 'Demo with synthetic data')}
      </span>
      <StatusActions />
    </div>
  );

  return (
    <>
      <AppShell
        mode={mode}
        nav={nav}
        current={sectionOf(route)}
        onNavigate={(k) => go(routeFor(k))}
        title={mother ? mother.name : undefined}
        onBack={route.name === 'patient' || route.name === 'register' ? () => back() : undefined}
        worker={shellWorker}
        workerActions={{ ...menuActions, onOpenSettings: () => go({ name: 'settings' }) }}
        sync={{
          line: bridge.ready ? bridge.line : 'Opening your records…',
          state: !bridge.ready ? 'syncing' : state.offline ? 'offline' : bridge.localOnly ? 'local' : 'ok',
          detail: bridge.status?.fallbackReason ?? bridge.status?.label,
        }}
        ai={{
          label: ai.label || (ai.live ? 'Live AI' : 'Templates'),
          state: ai.provider === 'none' ? 'off' : ai.live ? 'live' : ai.lastError ? 'error' : 'templates',
          detail: ai.lastError ? `Last live attempt failed: ${ai.lastError}` : undefined,
          onClick: () => go({ name: 'settings' }),
        }}
        notifications={notifications}
        search={search}
        legal={mode === 'personal' ? { ...personalLegal(), onMore: () => go({ name: 'about' }) } : undefined}
        topNotice={notice}
        actions={
          <button
            type="button"
            className="inline-flex size-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-secondary ring-1 ring-secondary ring-inset hover:bg-primary_hover sm:h-8 sm:w-auto sm:px-2.5"
            onClick={() => setDemo(true)}
            aria-label="Open demo controls"
            data-testid="demo-open"
          >
            <IDemo width={14} height={14} aria-hidden="true" /> <span className="hidden sm:inline">Demo</span>
            <kbd className="hidden rounded-sm px-1 text-[10px] text-quaternary ring-1 ring-secondary lg:inline">D</kbd>
          </button>
        }
      >
        <Screen />
      </AppShell>
      {demo ? <DemoPanel onClose={() => setDemo(false)} /> : null}
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
  const done = Boolean(saved || skipped);
  useEffect(() => {
    // Setup can also finish outside onDone (a persona saves the setup itself): reset the scroll then too.
    if (done) {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        /* ignore */
      }
    }
  }, [done]);
  if (done) return <>{children}</>;
  return <Onboarding onSkip={() => setSkipped(true)} />;
}

function Onboarding({ onSkip }: { onSkip: () => void }) {
  const land = () => {
    try {
      window.history.replaceState({ route: { name: 'today' }, depth: 0 }, '', '#today');
      // The persona list is a long page: start Today at the top, not where onboarding was scrolled.
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  };
  return (
    <OnboardingScreen
      onDone={land}
      onSkip={() => {
        onSkip();
        land();
      }}
    />
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
    <ThemeProvider>
    <ErrorBoundary>
      <AppProvider>
        <WorkerLanguageFromSetup>
          <SetupGate>
            <AccountGate>
              <WithNav />
            </AccountGate>
          </SetupGate>
        </WorkerLanguageFromSetup>
      </AppProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}

export { setupStore };
