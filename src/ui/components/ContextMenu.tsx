import { useEffect, useRef, useState, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface MenuState {
  x: number;
  y: number;
  hasSelection: boolean;
  isTextInput: boolean;
}

/**
 * Global right-click context menu.
 * Intercepts the native contextmenu event and renders a Radix dropdown
 * at cursor position with actions appropriate for the target element.
 */
export function GlobalContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const isTextInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
    // Check if there's a text selection anywhere
    const hasSelection = window.getSelection()?.toString().trim().length ? true : false;

    setMenu({
      x: e.clientX,
      y: e.clientY,
      hasSelection: !!hasSelection,
      isTextInput,
    });
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    // Close on any click outside the menu
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenu(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleContextMenu, handleClickOutside]);

  // Close on Escape
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  const exec = (cmd: string) => {
    document.execCommand(cmd);
    setMenu(null);
  };

  if (!menu) return null;

  return (
    <DropdownMenu.Root open={!!menu} onOpenChange={(o) => { if (!o) setMenu(null); }}>
      <DropdownMenu.Trigger asChild>
        {/* Invisible anchor at cursor position */}
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menu.x, top: menu.y, width: 0, height: 0 }}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-[200] min-w-[160px] rounded-xl border border-ink-900/10 bg-surface p-1 shadow-lg"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenu.Item
            className="flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-accent/10 hover:text-accent data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
            disabled={!menu.hasSelection}
            onSelect={() => exec('copy')}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            Copy
            <span className="ml-auto text-xs text-ink-400">Ctrl+C</span>
          </DropdownMenu.Item>

          {menu.isTextInput && (
            <>
              <DropdownMenu.Item
                className="flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-accent/10 hover:text-accent"
                onSelect={() => exec('cut')}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5M6 23l-3-3 3-3M17 6l-5 5M14 3l3 3-3 3M8 3l-3 3 3 3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /></svg>
                Cut
                <span className="ml-auto text-xs text-ink-400">Ctrl+X</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-accent/10 hover:text-accent"
                onSelect={() => {
                  navigator.clipboard.readText().then((text) => {
                    const active = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
                    if (active) {
                      const start = active.selectionStart ?? 0;
                      const end = active.selectionEnd ?? 0;
                      active.value = active.value.substring(0, start) + text + active.value.substring(end);
                      active.selectionStart = active.selectionEnd = start + text.length;
                      active.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  });
                  setMenu(null);
                }}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                Paste
                <span className="ml-auto text-xs text-ink-400">Ctrl+V</span>
              </DropdownMenu.Item>
            </>
          )}

          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-ink-900/10" />

          <DropdownMenu.Item
            className="flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-accent/10 hover:text-accent"
            onSelect={() => exec('selectAll')}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M21 9H3M21 15H3" /></svg>
            Select All
            <span className="ml-auto text-xs text-ink-400">Ctrl+A</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
