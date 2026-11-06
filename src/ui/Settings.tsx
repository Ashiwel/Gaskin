/**
 * Settings: a left sub-navigation on desktop and a grouped list on phones (tap a row to open the
 * section, Back to return). The open section is kept for the session, so a reload lands on it
 * and openSettingsAt('ai') can open a section from elsewhere. Every setting persists: device preferences in src/ui/settings/prefs,
 * place and languages in the saved setup, AI through src/ai, workers and locks through src/auth,
 * storage through src/storage.
 */
import { useEffect, useMemo, useState, type FC } from 'react';
import { ArrowLeft, Bell01, ClipboardCheck, Contrast01, Database02, Printer, RefreshCw01, Scale01, Send01, Shield02, Stars02, Translate01, User01, Users03 } from '@untitledui/icons';
import { configure } from './ai';
import { loadAISettings } from '../ai';
import { useNav } from './nav';
import { useAccounts, can } from './accounts/auth';
import { AppearanceSection, LanguageRegionSection, ProfileSection, WorkersSection } from './settings/SectionsA';
import { AISection, LegalSection, MessagingSection, NotificationsSection, PrintingSection, PrivacySection, SetupAgainSection, StorageSection, VisitsSection } from './settings/SectionsB';
import { cx } from '../utils/cx';
import { useBreakpoint } from '../hooks/use-breakpoint';

/** Restore saved AI settings on start (the key from wherever she chose to keep it). */
export function restoreAISettings() {
  try {
    const s = loadAISettings();
    if (s) configure(s as unknown as Record<string, unknown>);
  } catch {
    /* settings invalid: keep defaults */
  }
}

type SectionId = 'profile' | 'workers' | 'appearance' | 'language' | 'visits' | 'notifications' | 'messaging' | 'printing' | 'ai' | 'privacy' | 'storage' | 'setup' | 'legal';

interface SectionDef {
  id: SectionId;
  label: string;
  hint: string;
  icon: FC<{ className?: string }>;
  group: 'You' | 'Work' | 'Data and privacy' | 'Gaskin';
}

const ALL: SectionDef[] = [
  { id: 'profile', label: 'Profile and facility', hint: 'Name, PIN', icon: User01, group: 'You' },
  { id: 'workers', label: 'Workers', hint: 'Add, reset PIN, caseloads', icon: Users03, group: 'You' },
  { id: 'appearance', label: 'Appearance', hint: 'Theme, text size', icon: Contrast01, group: 'You' },
  { id: 'language', label: 'Language and region', hint: 'Languages, place, units', icon: Translate01, group: 'You' },
  { id: 'visits', label: 'Visits', hint: 'Your questions, reminders', icon: ClipboardCheck, group: 'Work' },
  { id: 'notifications', label: 'Notifications', hint: 'Due contacts, quiet hours', icon: Bell01, group: 'Work' },
  { id: 'messaging', label: 'Messaging', hint: 'Channels, sender, SMS length', icon: Send01, group: 'Work' },
  { id: 'printing', label: 'Printing', hint: 'Paper, handout language', icon: Printer, group: 'Work' },
  { id: 'ai', label: 'AI assistant', hint: 'Mode, privacy, audit log', icon: Stars02, group: 'Data and privacy' },
  { id: 'privacy', label: 'Privacy and security', hint: 'Lock, passphrase, your data', icon: Shield02, group: 'Data and privacy' },
  { id: 'storage', label: 'Storage and backup', hint: 'Folder, USB, import', icon: Database02, group: 'Data and privacy' },
  { id: 'setup', label: 'Run setup again', hint: 'New phone or new place', icon: RefreshCw01, group: 'Gaskin' },
  { id: 'legal', label: 'About and legal', hint: 'Licences, version', icon: Scale01, group: 'Gaskin' },
];

const PERSONAL_HIDE: SectionId[] = ['workers', 'visits', 'messaging', 'printing'];

const SECTION_KEY = 'gaskin.settings.section';

function readSection(): SectionId | null {
  try {
    return (globalThis.sessionStorage?.getItem(SECTION_KEY) as SectionId | null) ?? null;
  } catch {
    return null;
  }
}

function writeSection(id: SectionId | null) {
  try {
    if (id) globalThis.sessionStorage?.setItem(SECTION_KEY, id);
    else globalThis.sessionStorage?.removeItem(SECTION_KEY);
  } catch {
    /* ignore */
  }
}

/** Open Settings at a section (e.g. the AI pill opens 'ai'). Call before navigating to Settings. */
export function openSettingsAt(id: SectionId): void {
  writeSection(id);
}

export function Settings() {
  const { current } = useAccounts();
  const { go } = useNav();
  const personal = Boolean(current?.personal);
  const sections = useMemo(
    () => ALL.filter((s) => (s.id === 'workers' ? can(current, 'manage_workers') : true)).filter((s) => !(personal && PERSONAL_HIDE.includes(s.id))),
    [current, personal],
  );
  const [open, setOpen] = useState<SectionId | null>(() => readSection());
  const valid = open && sections.some((s) => s.id === open) ? open : null;
  const desktopSel = valid ?? 'profile';
  const wide = useBreakpoint('lg');
  useEffect(() => writeSection(open), [open]);

  const body = (id: SectionId) => {
    switch (id) {
      case 'profile':
        return <ProfileSection />;
      case 'workers':
        return <WorkersSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'language':
        return <LanguageRegionSection />;
      case 'visits':
        return <VisitsSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'messaging':
        return <MessagingSection />;
      case 'printing':
        return <PrintingSection />;
      case 'ai':
        return <AISection />;
      case 'privacy':
        return <PrivacySection />;
      case 'storage':
        return <StorageSection />;
      case 'setup':
        return <SetupAgainSection />;
      case 'legal':
        return <LegalSection onOpenAbout={() => go({ name: 'about' })} />;
    }
  };
  const groups = [...new Set(sections.map((s) => s.group))];

  return (
    <div className="mx-auto w-full max-w-[1280px]" data-testid="settings">
      {/* Phone: grouped list, or one section with Back */}
      {!wide ? (
      <div>
        {valid ? (
          <div className="grid gap-4">
            <button type="button" onClick={() => setOpen(null)} className="-ml-2 inline-flex h-11 w-max cursor-pointer items-center gap-1.5 rounded-lg px-2 text-md font-semibold text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2" data-testid="settings-back">
              <ArrowLeft aria-hidden="true" className="size-5" />
              Settings
            </button>
            {body(valid)}
          </div>
        ) : (
          <div className="grid gap-6">
            <h1 className="text-display-xs font-semibold text-primary">Settings</h1>
            {groups.map((g) => (
              <section key={g} aria-label={g}>
                <h2 className="mb-2 px-1 text-sm font-semibold text-tertiary">{g}</h2>
                <ul className="divide-y divide-border-secondary overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary ring-inset">
                  {sections
                    .filter((s) => s.group === g)
                    .map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => (setOpen(s.id), window.scrollTo({ top: 0 }))} data-section={s.id} className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-fg-secondary">
                            <s.icon aria-hidden="true" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-md font-medium text-primary">{s.label}</span>
                            <span className="block truncate text-sm text-tertiary">{s.hint}</span>
                          </span>
                          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-fg-quaternary">
                            <path d="M7.5 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      ) : (
      /* Desktop: sub-navigation and the open section */
      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-10">
        <nav aria-label="Settings" className="sticky top-24 self-start">
          <h1 className="mb-6 text-display-sm font-semibold text-primary">Settings</h1>
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-quaternary uppercase">{g}</p>
              <ul className="grid gap-0.5">
                {sections
                  .filter((s) => s.group === g)
                  .map((s) => {
                    const on = desktopSel === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setOpen(s.id)}
                          aria-current={on ? 'page' : undefined}
                          data-subnav={s.id}
                          className={cx('flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold outline-focus-ring focus-visible:outline-2', on ? 'bg-active text-primary' : 'text-secondary hover:bg-primary_hover')}
                        >
                          <s.icon aria-hidden="true" className={cx('size-5 shrink-0', on ? 'text-fg-brand-primary' : 'text-fg-quaternary')} />
                          <span className="truncate">{s.label}</span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="max-w-3xl min-w-0 pb-16">{body(desktopSel)}</div>
      </div>
      )}
    </div>
  );
}
