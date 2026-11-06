import { Button as AriaButton, MenuTrigger as AriaMenuTrigger } from 'react-aria-components';
import { Monitor01, Moon01, Sun } from '@untitledui/icons';
import { Dropdown } from '../base/dropdown/dropdown';
import { ButtonGroup, ButtonGroupItem } from '../base/button-group/button-group';
import { useTheme, type ThemeMode } from '../../theme';
import { cx } from '../../utils/cx';

const OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'system', label: 'Match this device', icon: Monitor01 },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon01 },
];

/** Top-bar icon button: shows the current theme and opens Light, Dark, Match this device. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolved, setMode } = useTheme();
  const Icon = resolved === 'dark' ? Moon01 : Sun;
  return (
    <AriaMenuTrigger>
      <AriaButton
        aria-label={`Theme: ${OPTIONS.find((o) => o.id === mode)?.label}`}
        data-testid="theme-toggle"
        className={cx('grid size-10 cursor-pointer place-items-center rounded-lg text-fg-quaternary outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2', className)}
      >
        <Icon aria-hidden="true" className="size-5" />
      </AriaButton>
      <Dropdown.Popover placement="bottom end" className="w-56">
        <Dropdown.Menu aria-label="Theme" selectionMode="single" selectedKeys={[mode]} onSelectionChange={(k) => setMode([...(k as Set<ThemeMode>)][0] ?? 'system')}>
          {OPTIONS.map((o) => (
            <Dropdown.Item key={o.id} id={o.id} icon={o.icon} label={o.label} />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </AriaMenuTrigger>
  );
}

/** The same choice as a segmented control, for the Settings screen. */
export function ThemeSegmented({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <ButtonGroup aria-label="Theme" selectionMode="single" selectedKeys={[mode]} disallowEmptySelection onSelectionChange={(k) => setMode(([...k][0] as ThemeMode) ?? 'system')} className={className}>
      {OPTIONS.map((o) => (
        <ButtonGroupItem key={o.id} id={o.id} iconLeading={o.icon}>
          {o.id === 'system' ? 'Automatic' : o.label}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
}
