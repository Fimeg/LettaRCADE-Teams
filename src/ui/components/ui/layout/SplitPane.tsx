/**
 * SplitPane Component - Layout primitive for resizable panels
 *
 * Re-exports react-resizable-panels with design system styling applied.
 * See AgentWorkspace.tsx for usage examples.
 */

import * as React from 'react';
import {
  Panel,
  Group,
  Separator,
  type PanelProps,
} from 'react-resizable-panels';
import { GripVertical, GripHorizontal } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Icon } from '../primitives/Icon';

// ============================================================================
// 1. STYLED COMPONENTS
// ============================================================================

/**
 * SplitPanePanel - Panel with design system classes
 */
interface SplitPanePanelProps extends PanelProps {
  className?: string;
}

function SplitPanePanel({ className, children, ...props }: SplitPanePanelProps) {
  return (
    <Panel className={cn('h-full overflow-hidden', className)} {...props}>
      {children}
    </Panel>
  );
}

/**
 * SplitPaneDivider - Separator with design system styling
 */
interface SplitPaneDividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

function SplitPaneDivider({
  className,
  orientation = 'horizontal',
  disabled,
}: SplitPaneDividerProps) {
  const gripIcon = orientation === 'horizontal' ? GripVertical : GripHorizontal;

  return (
    <Separator
      className={cn(
        'relative flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        orientation === 'horizontal'
          ? 'w-2 cursor-col-resize'
          : 'h-2 cursor-row-resize',
        'bg-ink-900/5 hover:bg-accent/10',
        className
      )}
      disabled={disabled}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-surface shadow-sm border border-ink-900/10',
          orientation === 'horizontal' ? 'w-4 h-8' : 'w-8 h-4'
        )}
      >
        <Icon
          icon={gripIcon}
          className={cn(
            'w-3 h-3 text-ink-400',
            orientation === 'vertical' && 'rotate-90'
          )}
        />
      </div>
    </Separator>
  );
}

/**
 * SplitPaneGroup - Group container with design system classes
 */
interface SplitPaneGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  defaultLayout?: number[];
  storageKey?: string;
}

function SplitPaneGroup({
  children,
  className,
  orientation = 'horizontal',
  defaultLayout: propDefaultLayout,
  storageKey,
}: SplitPaneGroupProps) {
  // Load saved layout
  const savedLayout = React.useMemo(() => {
    if (!storageKey || typeof window === 'undefined') return undefined;
    try {
      const saved = localStorage.getItem(`splitpane:${storageKey}`);
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  }, [storageKey]);

  const defaultLayout = savedLayout ?? propDefaultLayout;

  return (
    <Group
      orientation={orientation}
      className={cn('flex h-full w-full', className)}
      defaultLayout={defaultLayout}
    >
      {children}
    </Group>
  );
}

// ============================================================================
// 2. UTILITY FUNCTIONS
// ============================================================================

/**
 * Utility to clear saved layout for a storage key
 */
function clearSplitPaneLayout(storageKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`splitpane:${storageKey}`);
}

/**
 * Utility to get saved layout for a storage key
 */
function getSplitPaneLayout(storageKey: string): number[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const saved = localStorage.getItem(`splitpane:${storageKey}`);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// 3. EXPORTS
// ============================================================================

export {
  SplitPanePanel,
  SplitPaneDivider,
  SplitPaneGroup,
  clearSplitPaneLayout,
  getSplitPaneLayout,
};

export type {
  SplitPanePanelProps,
  SplitPaneDividerProps,
  SplitPaneGroupProps,
};

// Re-export original components for advanced use cases
export { Panel, Group, Separator, type PanelProps };
