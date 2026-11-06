/**
 * Plain data the shell renders. The shell owns no state: App.tsx (and later src/auth and
 * src/legal) fill these in. Keeping the contract here lets the shell and the auth module be
 * built in parallel.
 */
import type { FC, ReactNode } from 'react';

export type NavKey =
  // Health-worker mode
  | 'today'
  | 'mothers'
  | 'visits'
  | 'messages'
  | 'review'
  | 'insights'
  | 'library'
  | 'settings'
  | 'about'
  // Personal mode (a mother using Gaskin for herself)
  | 'my-plan'
  | 'my-baby';

export interface NavEntry {
  key: NavKey;
  label: string;
  icon: FC<{ className?: string }>;
  /** Count shown on the item (e.g. urgent mothers). */
  badge?: number;
  /** 'error' for danger counts; 'brand' or 'gray' otherwise. */
  badgeTone?: 'error' | 'brand' | 'gray';
  /** Shown in the mobile tab bar (at most four; the rest go under More). */
  mobile?: boolean;
  /** Below the divider in the sidebar (Settings, About). */
  footer?: boolean;
}

/** A worker profile on this device, as src/auth will provide it. */
export interface ShellWorker {
  id: string;
  name: string;
  /** e.g. "Midwife, Surulere PHC". */
  subtitle?: string;
  /** Role badge, e.g. "Clinical reviewer". */
  role?: string;
  avatarUrl?: string;
}

/** Actions for the worker menu. Each is optional: the item is hidden if its action is missing. */
export interface WorkerMenuActions {
  /** Other profiles on this device, for "Switch worker". */
  others?: ShellWorker[];
  onSwitch?: (workerId: string) => void;
  /** Add a worker to this device. */
  onAddWorker?: () => void;
  /** Lock now: shows the PIN screen, keeps the session. */
  onLock?: () => void;
  /** End the session on this device. */
  onLogOut?: () => void;
  onOpenSettings?: () => void;
}

export interface SyncStatus {
  /** One short line, e.g. "Saved on this phone" or "Synced 2 min ago". */
  line: string;
  state: 'ok' | 'local' | 'syncing' | 'offline' | 'error';
  /** Longer explanation for the tooltip. */
  detail?: string;
  /** Storage used, 0..1, when known. */
  storageUsed?: number;
  storageLabel?: string;
}

export interface AIStatusPill {
  label: string;
  state: 'live' | 'templates' | 'off' | 'error';
  detail?: string;
  onClick?: () => void;
}

export interface ShellNotification {
  id: string;
  title: string;
  body?: string;
  time?: string;
  tone?: 'error' | 'warning' | 'brand' | 'gray';
  unread?: boolean;
  onOpen?: () => void;
}

export interface SearchResult {
  id: string;
  label: string;
  /** Second line, e.g. "36 weeks, Surulere". */
  detail?: string;
  group?: string;
  onSelect: () => void;
}

export type ShellMode = 'worker' | 'personal';

export interface LegalFooterInfo {
  /** One sentence, e.g. "Gaskin does not replace a health worker." */
  disclaimer: string;
  /** e.g. "112". */
  emergencyNumber?: string;
  /** e.g. "Emergency". */
  emergencyLabel?: string;
  onMore?: () => void;
}

export interface ShellSlots {
  /** Content above the page in the main column (e.g. the offline notice). */
  banner?: ReactNode;
}
