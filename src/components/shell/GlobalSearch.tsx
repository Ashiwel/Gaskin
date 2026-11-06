import { useEffect, useRef, useState } from 'react';
import { ComboBox as AriaComboBox, Input as AriaInput, ListBox as AriaListBox, ListBoxItem as AriaListBoxItem, Popover as AriaPopover } from 'react-aria-components';
import { SearchLg } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import type { SearchResult } from './types';

export interface GlobalSearchProps {
  /** Returns results for the query (mothers, children, places, pages). Called on every keystroke. */
  search: (query: string) => SearchResult[];
  placeholder?: string;
  className?: string;
  /** Focus with "/" or Ctrl/Cmd+K. */
  shortcut?: boolean;
}

/**
 * Search everything from the top bar: type a name, a community or a page. Arrow keys move, Enter
 * opens, Escape closes. "/" or Ctrl+K focuses it from anywhere.
 */
export function GlobalSearch({ search, placeholder = 'Search mothers, places, pages', className, shortcut = true }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const results = query.trim() ? search(query.trim()).slice(0, 12) : [];

  useEffect(() => {
    if (!shortcut) return undefined;
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [shortcut]);

  return (
    <AriaComboBox
      aria-label="Search"
      inputValue={query}
      onInputChange={setQuery}
      allowsEmptyCollection
      menuTrigger="input"
      onSelectionChange={(key) => {
        const r = results.find((x) => x.id === key);
        if (r) {
          r.onSelect();
          setQuery('');
          input.current?.blur();
        }
      }}
      className={cx('relative w-full', className)}
      data-testid="global-search"
    >
      <div className="relative flex items-center">
        <SearchLg aria-hidden="true" className="pointer-events-none absolute left-3 size-5 text-fg-quaternary" />
        <AriaInput
          ref={input}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg bg-primary pr-14 pl-10 text-md text-primary shadow-xs ring-1 ring-primary outline-hidden ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
        />
        {shortcut ? (
          <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 hidden rounded-sm px-1.5 py-px text-xs font-medium text-quaternary ring-1 ring-secondary ring-inset md:block">
            ⌘K
          </kbd>
        ) : null}
      </div>
      <AriaPopover placement="bottom start" offset={6} className="w-(--trigger-width) min-w-72 overflow-hidden rounded-xl bg-primary shadow-lg ring-1 ring-secondary_alt entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out">
        <AriaListBox
          items={results}
          className="max-h-96 overflow-y-auto p-1.5 outline-hidden"
          renderEmptyState={() => <p className="px-3 py-6 text-center text-sm text-tertiary">{query.trim() ? `Nothing found for “${query.trim()}”.` : 'Type a name or a place.'}</p>}
        >
          {(r) => (
            <AriaListBoxItem
              id={r.id}
              textValue={r.label}
              className={({ isFocused }) => cx('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 outline-hidden', isFocused && 'bg-primary_hover')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-primary">{r.label}</span>
                {r.detail ? <span className="block truncate text-xs text-tertiary">{r.detail}</span> : null}
              </span>
              {r.group ? <span className="shrink-0 text-xs text-quaternary">{r.group}</span> : null}
            </AriaListBoxItem>
          )}
        </AriaListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}
