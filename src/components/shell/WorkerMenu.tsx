import type { ReactNode } from 'react';
import { Button as AriaButton, MenuTrigger as AriaMenuTrigger } from 'react-aria-components';
import { ChevronSelectorVertical, Lock01, LogOut01, Settings01, UserPlus01 } from '@untitledui/icons';
import { Avatar } from '../base/avatar/avatar';
import { Dropdown } from '../base/dropdown/dropdown';
import { cx } from '../../utils/cx';
import type { ShellWorker, SyncStatus, WorkerMenuActions } from './types';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const SYNC_DOT: Record<SyncStatus['state'], string> = {
  ok: 'bg-fg-success-secondary',
  syncing: 'bg-fg-brand-secondary animate-pulse',
  local: 'bg-fg-warning-secondary',
  offline: 'bg-fg-warning-secondary',
  error: 'bg-fg-error-secondary',
};

export function SyncDot({ state, className }: { state: SyncStatus['state']; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block size-2 shrink-0 rounded-full', SYNC_DOT[state], className)} />;
}

function MenuItems({ worker, actions }: { worker: ShellWorker; actions: WorkerMenuActions }) {
  // At most six other profiles: a shared device rarely has more, and the list must not fill the screen.
  const others = (actions.others?.filter((o) => o.id !== worker.id) ?? []).slice(0, 6);
  return (
    <Dropdown.Menu aria-label="Worker menu" className="w-full">
      <Dropdown.Section>
        <Dropdown.SectionHeader className="flex items-center gap-3 border-b border-secondary px-4 py-3">
          <Avatar size="md" initials={initials(worker.name)} src={worker.avatarUrl} alt={worker.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{worker.name}</p>
            {worker.subtitle ? <p className="truncate text-xs text-tertiary">{worker.subtitle}</p> : null}
          </div>
        </Dropdown.SectionHeader>
      </Dropdown.Section>
      {others.length && actions.onSwitch ? (
        <Dropdown.Section>
          <Dropdown.SectionHeader className="px-4 pt-2 pb-1 text-xs font-semibold text-tertiary">Switch worker</Dropdown.SectionHeader>
          {others.map((o) => (
            <Dropdown.Item key={o.id} id={`switch-${o.id}`} onAction={() => actions.onSwitch?.(o.id)} textValue={o.name}>
              <span className="flex items-center gap-2">
                <Avatar size="xs" initials={initials(o.name)} src={o.avatarUrl} alt="" />
                <span className="truncate">{o.name}</span>
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Section>
      ) : null}
      <Dropdown.Section>
        {actions.onAddWorker ? <Dropdown.Item id="add" icon={UserPlus01} label="Add a worker to this device" onAction={actions.onAddWorker} /> : null}
        {actions.onOpenSettings ? <Dropdown.Item id="settings" icon={Settings01} label="Settings" onAction={actions.onOpenSettings} /> : null}
      </Dropdown.Section>
      {actions.onLock || actions.onLogOut ? <Dropdown.Separator /> : null}
      <Dropdown.Section>
        {actions.onLock ? <Dropdown.Item id="lock" icon={Lock01} label="Lock" addon="PIN to return" onAction={actions.onLock} /> : null}
        {actions.onLogOut ? <Dropdown.Item id="logout" icon={LogOut01} label="Log out" onAction={actions.onLogOut} /> : null}
      </Dropdown.Section>
    </Dropdown.Menu>
  );
}

/**
 * The worker's card at the foot of the sidebar: avatar, name, role, and sync and storage status.
 * Pressing it opens the worker menu (switch worker, add worker, lock, log out). In a collapsed
 * sidebar only the avatar shows.
 */
export function WorkerCard({ worker, sync, actions = {}, collapsed, extra }: { worker: ShellWorker; sync?: SyncStatus; actions?: WorkerMenuActions; collapsed?: boolean; extra?: ReactNode }) {
  return (
    <AriaMenuTrigger>
      <AriaButton
        aria-label={`${worker.name}, worker menu`}
        data-testid="worker-card"
        className={cx(
          'group flex w-full cursor-pointer items-center gap-3 rounded-xl text-left outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2',
          collapsed ? 'justify-center p-1' : 'bg-primary p-3 ring-1 ring-secondary ring-inset hover:bg-primary_hover',
        )}
      >
        <span className="relative shrink-0">
          <Avatar size="md" initials={initials(worker.name)} src={worker.avatarUrl} alt="" />
          {sync ? <SyncDot state={sync.state} className="absolute -right-0.5 -bottom-0.5 size-3 ring-2 ring-bg-primary" /> : null}
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-primary">{worker.name}</span>
            <span className="block truncate text-xs text-tertiary">{worker.role ?? worker.subtitle}</span>
            {sync ? (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-tertiary" data-testid="storage-status" title={sync.detail}>
                {sync.line}
              </span>
            ) : null}
            {sync?.storageUsed != null ? (
              <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-tertiary" title={sync.storageLabel}>
                <span className={cx('block h-full rounded-full', sync.storageUsed > 0.9 ? 'bg-error-solid' : 'bg-brand-solid')} style={{ width: `${Math.round(sync.storageUsed * 100)}%` }} />
              </span>
            ) : null}
            {extra}
          </span>
        ) : null}
        {!collapsed ? <ChevronSelectorVertical aria-hidden="true" className="size-4 shrink-0 text-fg-quaternary" /> : null}
      </AriaButton>
      <Dropdown.Popover placement={collapsed ? 'right bottom' : 'top'} className="w-64">
        <MenuItems worker={worker} actions={actions} />
      </Dropdown.Popover>
    </AriaMenuTrigger>
  );
}

/** The compact avatar button for the mobile top bar, opening the same menu. */
export function WorkerAvatarButton({ worker, sync, actions = {} }: { worker: ShellWorker; sync?: SyncStatus; actions?: WorkerMenuActions }) {
  return (
    <AriaMenuTrigger>
      <AriaButton aria-label={`${worker.name}, worker menu`} className="relative rounded-full outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <Avatar size="sm" initials={initials(worker.name)} src={worker.avatarUrl} alt="" />
        {sync ? <SyncDot state={sync.state} className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-bg-primary" /> : null}
      </AriaButton>
      <Dropdown.Popover placement="bottom end" className="w-64">
        <MenuItems worker={worker} actions={actions} />
      </Dropdown.Popover>
    </AriaMenuTrigger>
  );
}
