/**
 * Tabs Component - Tab navigation for content switching
 *
 * Horizontal or vertical tab list with active indicator.
 * Supports badges, disabled states, and overflow handling.
 */

import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../../utils/cn';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

const tabsListVariants = cva('flex items-center', {
  variants: {
    orientation: {
      horizontal: 'flex-row border-b border-ink-900/10',
      vertical: 'flex-col border-r border-ink-900/10',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

const tabsTriggerVariants = cva(
  'relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      orientation: {
        horizontal: 'border-b-2 border-transparent -mb-px rounded-t-sm',
        vertical: 'border-r-2 border-transparent -mr-px w-full justify-start rounded-l-sm',
      },
      isActive: {
        true: '',
        false: 'text-ink-500 hover:text-ink-700 hover:bg-surface-tertiary/50',
      },
      variant: {
        underline: '',
        pill: 'rounded-full mx-0.5 my-0.5',
      },
    },
    compoundVariants: [
      // Underline variant (default) - active has colored underline/border
      {
        variant: 'underline',
        orientation: 'horizontal',
        isActive: true,
        className: 'border-accent text-accent',
      },
      {
        variant: 'underline',
        orientation: 'vertical',
        isActive: true,
        className: 'border-accent text-accent bg-accent/5',
      },
      // Pill variant - active has filled background
      {
        variant: 'pill',
        isActive: true,
        className: 'bg-accent text-white',
      },
    ],
    defaultVariants: {
      orientation: 'horizontal',
      isActive: false,
      variant: 'underline',
    },
  }
);

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  variant: 'underline' | 'pill';
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Currently active tab value */
  value: string;

  /** Callback when tab changes */
  onValueChange: (value: string) => void;

  /** Tab layout orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Visual variant */
  variant?: 'underline' | 'pill';

  /** Tab children (TabsList + TabsContent) */
  children: React.ReactNode;
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab trigger items */
  children: React.ReactNode;
}

interface TabsTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Tab value (matches Tabs value prop) */
  value: string;

  /** Whether tab is disabled */
  disabled?: boolean;

  /** Optional badge/count display */
  badge?: number | string;
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab value that controls this content */
  value: string;
}

// ============================================================================
// 3. COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * Tabs - Tab container with context provider
 *
 * @example
 * // Basic horizontal tabs
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="general">General</TabsTrigger>
 *     <TabsTrigger value="advanced">Advanced</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="general">General settings...</TabsContent>
 *   <TabsContent value="advanced">Advanced settings...</TabsContent>
 * </Tabs>
 *
 * @example
 * // Vertical pill tabs
 * <Tabs value={tab} onValueChange={setTab} orientation="vertical" variant="pill">
 *   <TabsList>
 *     <TabsTrigger value="chat" badge={3}>Chat</TabsTrigger>
 *     <TabsTrigger value="memory">Memory</TabsTrigger>
 *   </TabsList>
 *   ...
 * </Tabs>
 */
const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value,
      onValueChange,
      orientation = 'horizontal',
      variant = 'underline',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const contextValue = React.useMemo(
      () => ({ value, onValueChange, orientation, variant }),
      [value, onValueChange, orientation, variant]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(
            'flex',
            orientation === 'horizontal' ? 'flex-col' : 'flex-row',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

/**
 * TabsList - Container for tab triggers
 */
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { orientation } = useTabsContext();

    return (
      <div
        ref={ref}
        className={cn(tabsListVariants({ orientation }), className)}
        role="tablist"
        aria-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

/**
 * TabsTrigger - Individual tab button
 */
const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, badge, children, ...props }, ref) => {
    const { value: selectedValue, onValueChange, orientation, variant } = useTabsContext();
    const isActive = selectedValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${value}`}
        disabled={disabled}
        className={cn(
          tabsTriggerVariants({ orientation, variant, isActive }),
          className
        )}
        onClick={() => onValueChange(value)}
        tabIndex={isActive ? 0 : -1}
        {...props}
      >
        <span className="flex items-center gap-2">{children}</span>
        {badge !== undefined && (
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-medium rounded-full',
              isActive && variant === 'pill'
                ? 'bg-white/20 text-white'
                : isActive
                  ? 'bg-accent/10 text-accent'
                  : 'bg-surface-tertiary text-ink-500'
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

/**
 * TabsContent - Tab panel content
 */
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: selectedValue } = useTabsContext();
    const isActive = selectedValue === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value}`}
        aria-labelledby={`tab-${value}`}
        className={cn('flex-1 focus:outline-none', className)}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'TabsContent';

// ============================================================================
// 4. EXPORTS
// ============================================================================

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
};
export default Tabs;
