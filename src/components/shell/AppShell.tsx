import { useEffect, useState, type ReactNode } from 'react';
import { Button as AriaButton, Dialog as AriaDialog, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from 'react-aria-components';
import { ArrowLeft, ChevronLeftDouble, ChevronRightDouble, DotsHorizontal, XClose } from '@untitledui/icons';
import { safeLocalStorage } from '../../storage';
import { cx } from '../../utils/cx';
import { LegalFooter } from './LegalFooter';
import { GlobalSearch } from './GlobalSearch';
import { AIPill, NotificationsButton } from './StatusPills';
import { ThemeToggle } from './ThemeToggle';
import { WorkerAvatarButton, WorkerCard } from './WorkerMenu';
import type { AIStatusPill, LegalFooterInfo, NavEntry, NavKey, SearchResult, ShellMode, ShellNotification, ShellWorker, SyncStatus, WorkerMenuActions } from './types';

export interface AppShellProps {
  mode?: ShellMode;
  nav: NavEntry[];
  current: NavKey | null;
  onNavigate: (key: NavKey) => void;
  /** Title in the mobile top bar (e.g. the open mother's name). */
  title?: string;
  /** Shows a back arrow in the mobile top bar instead of the logo. */
  onBack?: () => void;
  worker?: ShellWorker;
  workerActions?: WorkerMenuActions;
  sync?: SyncStatus;
  ai?: AIStatusPill;
  notifications?: ShellNotification[];
  onSeeAllNotifications?: () => void;
  search?: (q: string) => SearchResult[];
  /** Personal mode shows this footer on every page. */
  legal?: LegalFooterInfo;
  /** A thin strip above everything (demo notice, offline notice). */
  topNotice?: ReactNode;
  /** Extra items at the top bar's right (e.g. the Demo button). */
  actions?: ReactNode;
  children: ReactNode;
}

const COLLAPSE_KEY = 'gaskin.sidebar.collapsed.v1';

function readCollapsed(): boolean {
  try {
    return safeLocalStorage()?.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The Gaskin mark: a teal tile with a soft "G" arc, and the word in Inter semibold. */
export function GaskinLogo({ collapsed, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Gaskin, go to the first page" className="flex cursor-pointer items-center gap-2.5 rounded-lg outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--color-bg-brand-solid)" />
        <path d="M22 11.5a7.5 7.5 0 1 0 1.2 7.5H16.5" fill="none" stroke="var(--color-text-primary_on-brand)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="22.6" cy="11.2" r="1.7" fill="var(--color-text-primary_on-brand)" />
      </svg>
      {!collapsed ? <span className="text-lg font-semibold tracking-tight text-primary">Gaskin</span> : null}
    </button>
  );
}

function Badge({ n, tone = 'gray' }: { n: number; tone?: NavEntry['badgeTone'] }) {
  return (
    <span
      className={cx(
        'ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-xs font-medium tnum ring-1 ring-inset',
        tone === 'error' && 'bg-utility-red-50 text-utility-red-700 ring-utility-red-200',
        tone === 'brand' && 'bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200',
        (tone === 'gray' || !tone) && 'bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200',
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

function SideItem({ item, current, collapsed, onNavigate }: { item: NavEntry; current: boolean; collapsed: boolean; onNavigate: (k: NavKey) => void }) {
  const Icon = item.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(item.key)}
        aria-current={current ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        data-nav={item.key}
        className={cx(
          'group relative flex h-10 w-full cursor-pointer items-center gap-3 rounded-md text-left text-md font-semibold outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2',
          collapsed ? 'justify-center px-0' : 'px-3',
          current ? 'bg-active text-secondary_hover' : 'text-secondary hover:bg-primary_hover hover:text-secondary_hover',
        )}
      >
        <Icon aria-hidden="true" className={cx('size-5 shrink-0', current ? 'text-fg-brand-primary' : 'text-fg-quaternary group-hover:text-fg-quaternary_hover')} />
        {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
        {item.badge ? collapsed ? <span aria-label={`${item.badge}`} className={cx('absolute top-1.5 right-2 size-2 rounded-full', item.badgeTone === 'error' ? 'bg-error-solid' : 'bg-brand-solid')} /> : <Badge n={item.badge} tone={item.badgeTone} /> : null}
      </button>
    </li>
  );
}

function Sidebar(p: AppShellProps & { collapsed: boolean; setCollapsed: (c: boolean) => void }) {
  const main = p.nav.filter((n) => !n.footer);
  const foot = p.nav.filter((n) => n.footer);
  return (
    <aside
      aria-label="Main"
      className={cx(
        'sticky top-0 hidden h-dvh shrink-0 flex-col self-start border-r border-secondary bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex',
        p.collapsed ? 'w-[76px]' : 'w-[272px]',
      )}
    >
      <div className={cx('flex items-center pt-6 pb-4', p.collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <GaskinLogo collapsed={p.collapsed} onClick={() => p.onNavigate(main[0]?.key ?? 'today')} />
        {!p.collapsed ? (
          <AriaButton aria-label="Collapse sidebar" onPress={() => p.setCollapsed(true)} className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2">
            <ChevronLeftDouble aria-hidden="true" className="size-4" />
          </AriaButton>
        ) : null}
      </div>
      {p.collapsed ? (
        <div className="flex justify-center pb-2">
          <AriaButton aria-label="Expand sidebar" onPress={() => p.setCollapsed(false)} className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-quaternary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
            <ChevronRightDouble aria-hidden="true" className="size-4" />
          </AriaButton>
        </div>
      ) : null}
      <nav aria-label="Sections" className={cx('flex-1 overflow-y-auto', p.collapsed ? 'px-3' : 'px-4')}>
        <ul className="flex flex-col gap-0.5">
          {main.map((n) => (
            <SideItem key={n.key} item={n} current={p.current === n.key} collapsed={p.collapsed} onNavigate={p.onNavigate} />
          ))}
        </ul>
      </nav>
      <div className={cx('flex flex-col gap-4 pt-4 pb-5', p.collapsed ? 'px-3' : 'px-4')}>
        {foot.length ? (
          <ul className="flex flex-col gap-0.5">
            {foot.map((n) => (
              <SideItem key={n.key} item={n} current={p.current === n.key} collapsed={p.collapsed} onNavigate={p.onNavigate} />
            ))}
          </ul>
        ) : null}
        {p.worker ? <WorkerCard worker={p.worker} sync={p.sync} actions={p.workerActions} collapsed={p.collapsed} /> : null}
      </div>
    </aside>
  );
}

function TopBar(p: AppShellProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-secondary bg-primary/90 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-primary">
      <div className="flex h-14 items-center gap-2 pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] lg:h-16 lg:gap-3 lg:px-8">
        {/* mobile: back or logo, then title */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
          {p.onBack ? (
            <AriaButton aria-label="Back" onPress={p.onBack} className="-ml-2 grid size-10 cursor-pointer place-items-center rounded-lg text-fg-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </AriaButton>
          ) : (
            <GaskinLogo collapsed={Boolean(p.title)} onClick={() => p.onNavigate(p.nav[0]?.key ?? 'today')} />
          )}
          {p.title ? <span className="truncate text-md font-semibold text-primary" data-clip-ok title={p.title}>{p.title}</span> : null}
        </div>
        {/* desktop: search */}
        {p.search ? (
          <div className="hidden max-w-md flex-1 lg:block">
            <GlobalSearch search={p.search} />
          </div>
        ) : (
          <div className="hidden flex-1 lg:block" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:gap-2">
          {p.ai ? <AIPill status={p.ai} compact className="sm:hidden" /> : null}
          {p.ai ? <AIPill status={p.ai} className="hidden sm:inline-flex" /> : null}
          {p.actions}
          <ThemeToggle />
          {p.notifications ? <NotificationsButton items={p.notifications} onSeeAll={p.onSeeAllNotifications} /> : null}
          {p.worker ? (
            <span className="lg:hidden">
              <WorkerAvatarButton worker={p.worker} sync={p.sync} actions={p.workerActions} />
            </span>
          ) : null}
        </div>
      </div>
      {p.search ? (
        <div className="px-4 pb-3 lg:hidden">
          <GlobalSearch search={p.search} shortcut={false} placeholder="Search" />
        </div>
      ) : null}
    </header>
  );
}

function TabBar(p: AppShellProps & { onMore: () => void; moreActive: boolean }) {
  const tabs = p.nav.filter((n) => n.mobile).slice(0, 4);
  const hasMore = p.nav.some((n) => !tabs.includes(n));
  return (
    <nav aria-label="Main" data-testid="tabbar" className="fixed inset-x-0 bottom-0 z-30 border-t border-secondary bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-primary lg:hidden">
      <ul className="mx-auto flex max-w-xl pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {tabs.map((n) => {
          const Icon = n.icon;
          const cur = p.current === n.key;
          return (
            <li key={n.key} className="flex-1">
              <button
                type="button"
                onClick={() => p.onNavigate(n.key)}
                aria-current={cur ? 'page' : undefined}
                data-nav={n.key}
                className={cx('relative flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2', cur ? 'text-brand-secondary' : 'text-tertiary')}
              >
                <Icon aria-hidden="true" className={cx('size-6', cur ? 'text-fg-brand-primary' : 'text-fg-quaternary')} />
                <span className="max-w-full truncate px-1">{n.label}</span>
                {n.badge ? (
                  <span className={cx('absolute top-2 left-[calc(50%+6px)] min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-on-fill tnum', n.badgeTone === 'error' ? 'bg-error-solid' : 'bg-brand-solid')}>{n.badge}</span>
                ) : null}
              </button>
            </li>
          );
        })}
        {hasMore ? (
          <li className="flex-1">
            <button
              type="button"
              onClick={p.onMore}
              aria-current={p.moreActive ? 'page' : undefined}
              aria-haspopup="dialog"
              className={cx('flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2', p.moreActive ? 'text-brand-secondary' : 'text-tertiary')}
            >
              <DotsHorizontal aria-hidden="true" className={cx('size-6', p.moreActive ? 'text-fg-brand-primary' : 'text-fg-quaternary')} />
              More
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function MoreSheet(p: AppShellProps & { open: boolean; onClose: () => void }) {
  const tabs = p.nav.filter((n) => n.mobile).slice(0, 4);
  const rest = p.nav.filter((n) => !tabs.includes(n));
  return (
    <AriaModalOverlay isOpen={p.open} onOpenChange={(o) => !o && p.onClose()} isDismissable className="fixed inset-0 z-50 bg-overlay/60 entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out lg:hidden">
      <AriaModal className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-primary pb-[max(16px,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-secondary entering:animate-in entering:slide-in-from-bottom exiting:animate-out exiting:slide-out-to-bottom">
        <AriaDialog aria-label="More" className="outline-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-md font-semibold text-primary">More</h2>
            <AriaButton aria-label="Close" onPress={p.onClose} className="grid size-9 cursor-pointer place-items-center rounded-md text-fg-quaternary hover:bg-primary_hover">
              <XClose aria-hidden="true" className="size-5" />
            </AriaButton>
          </div>
          <ul className="grid gap-0.5 px-2">
            {rest.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.key}>
                  <button
                    type="button"
                    data-nav={n.key}
                    onClick={() => {
                      p.onNavigate(n.key);
                      p.onClose();
                    }}
                    aria-current={p.current === n.key ? 'page' : undefined}
                    className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-md font-semibold text-secondary hover:bg-primary_hover aria-[current=page]:bg-active"
                  >
                    <Icon aria-hidden="true" className="size-5 text-fg-quaternary" />
                    {n.label}
                    {n.badge ? <Badge n={n.badge} tone={n.badgeTone} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  );
}

/**
 * The app frame. Desktop (1024px and wider): a collapsible sidebar with the worker card, and a top
 * bar with search, AI status, theme and notifications. Phone and tablet: a top bar with the title
 * and the worker's avatar, search under it, and a bottom tab bar (four items plus More) with
 * safe-area padding. Personal mode adds the legal footer on every page.
 */
export function AppShell(p: AppShellProps) {
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const [more, setMore] = useState(false);
  const setCollapsed = (c: boolean) => {
    setCollapsedState(c);
    try {
      safeLocalStorage()?.setItem(COLLAPSE_KEY, c ? '1' : '0');
    } catch {
      /* per-device convenience only */
    }
  };
  const tabs = p.nav.filter((n) => n.mobile).slice(0, 4);
  const moreActive = p.current != null && !tabs.some((t) => t.key === p.current);
  useEffect(() => setMore(false), [p.current]);

  return (
    <div className="min-h-dvh bg-primary text-primary" data-shell-mode={p.mode ?? 'worker'}>
      <div className="flex">
        <Sidebar {...p} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          {p.topNotice}
          <TopBar {...p} />
          <main id="main" className="min-w-0 flex-1 px-[max(16px,env(safe-area-inset-left))] pt-6 pb-32 lg:px-8 lg:pt-8 lg:pb-16">
            {p.children}
          </main>
          {p.legal ? <LegalFooter info={p.legal} className="mb-[calc(64px+env(safe-area-inset-bottom))] border-t border-secondary lg:mb-0" /> : null}
        </div>
      </div>
      <TabBar {...p} onMore={() => setMore(true)} moreActive={moreActive} />
      <MoreSheet {...p} open={more} onClose={() => setMore(false)} />
    </div>
  );
}
