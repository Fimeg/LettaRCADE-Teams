/**
 * Sidebar Component - Navigation sidebar for desktop layouts
 *
 * Provides collapsible navigation with logo, sections, items, and footer.
 * Supports "rail" mode (icon-only collapsed state) for space-constrained layouts.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

const sidebarVariants = cva(
  'flex flex-col h-full bg-surface border-r border-ink-900/10 transition-all duration-200',
  {
    variants: {
      variant: {
        default: '',
        bordered: 'border-l border-ink-900/10',
      },
      size: {
        sm: 'w-56',
        md: 'w-64',
        lg: 'w-72',
        xl: 'w-80',
      },
      isCollapsed: {
        true: 'w-14',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      isCollapsed: false,
    },
  }
);

const sidebarItemVariants = cva(
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer select-none',
  {
    variants: {
      isActive: {
        true: 'bg-accent text-white',
        false: 'text-ink-700 hover:bg-surface-tertiary hover:text-ink-900',
      },
      isDisabled: {
        true: 'opacity-50 cursor-not-allowed pointer-events-none',
        false: '',
      },
    },
    defaultVariants: {
      isActive: false,
      isDisabled: false,
    },
  }
);

const sidebarSectionVariants = cva(
  'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-500',
  {
    variants: {
      isCollapsed: {
        true: 'sr-only',
        false: '',
      },
    },
    defaultVariants: {
      isCollapsed: false,
    },
  }
);

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

interface SidebarContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(
  undefined
);

function useSidebarContext() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('Sidebar sub-components must be used within a Sidebar');
  }
  return context;
}

interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  /** Controlled collapsed state */
  collapsed?: boolean;

  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;

  /** Storage key for persisting collapsed state */
  storageKey?: string;

  /** Whether to show collapse toggle button */
  showCollapseButton?: boolean;

  /** Collapsed width in pixels (default: 56px / 3.5rem) */
  collapsedWidth?: number;
}

interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Logo or brand element */
  logo?: React.ReactNode;

  /** Title text (hidden when collapsed) */
  title?: string;

  /** Subtitle text (hidden when collapsed) */
  subtitle?: string;
}

interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section label */
  label?: string;
}

interface SidebarItemProps
  extends VariantProps<typeof sidebarItemVariants> {
  /** Icon displayed before label */
  icon: LucideIcon;

  /** Display label */
  label: string;

  /** Whether this item is currently active */
  isActive?: boolean;

  /** Whether item is disabled */
  isDisabled?: boolean;

  /** Keyboard shortcut displayed after label */
  shortcut?: string;

  /** Badge/count displayed after label */
  badge?: number | string;

  /** Callback when item is selected */
  onSelect?: () => void;

  /** Navigation href (renders as anchor if provided) */
  href?: string;

  /** Additional className */
  className?: string;

  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement | HTMLAnchorElement>;
}

interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** User avatar or icon */
  avatar?: React.ReactNode;

  /** User name (hidden when collapsed) */
  userName?: string;

  /** User email/role (hidden when collapsed) */
  userInfo?: string;
}

// ============================================================================
// 3. COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * Sidebar - Navigation sidebar container
 *
 * @example
 * // Basic usage
 * <Sidebar>
 *   <SidebarHeader logo={<Logo />} title="Letta" />
 *   <SidebarSection label="Navigation">
 *     <SidebarItem icon={Home} label="Home" isActive />
 *     <SidebarItem icon={Settings} label="Settings" />
 *   </SidebarSection>
 *   <SidebarFooter avatar={<Avatar />} userName="John" />
 * </Sidebar>
 *
 * @example
 * // Controlled collapsed state
 * <Sidebar collapsed={isCollapsed} onCollapsedChange={setIsCollapsed}>
 *   ...
 * </Sidebar>
 */
const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      className,
      variant,
      size,
      collapsed: controlledCollapsed,
      onCollapsedChange,
      storageKey,
      showCollapseButton = true,
      children,
      ...props
    },
    ref
  ) => {
    // Initialize from storage if available
    const [internalCollapsed, setInternalCollapsed] = React.useState(() => {
      if (storageKey && typeof window !== 'undefined') {
        try {
          return localStorage.getItem(`sidebar:${storageKey}`) === 'true';
        } catch {
          return false;
        }
      }
      return false;
    });

    const isCollapsed = controlledCollapsed ?? internalCollapsed;

    const setIsCollapsed = React.useCallback(
      (value: boolean) => {
        if (controlledCollapsed === undefined) {
          setInternalCollapsed(value);
          if (storageKey && typeof window !== 'undefined') {
            localStorage.setItem(`sidebar:${storageKey}`, String(value));
          }
        }
        onCollapsedChange?.(value);
      },
      [controlledCollapsed, onCollapsedChange, storageKey]
    );

    const toggleCollapsed = React.useCallback(() => {
      setIsCollapsed(!isCollapsed);
    }, [isCollapsed, setIsCollapsed]);

    const contextValue = React.useMemo(
      () => ({ isCollapsed, setIsCollapsed, toggleCollapsed }),
      [isCollapsed, setIsCollapsed, toggleCollapsed]
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <aside
          ref={ref}
          className={cn(sidebarVariants({ variant, size, isCollapsed }), className)}
          data-collapsed={isCollapsed}
          {...props}
        >
          {children}

          {showCollapseButton && (
            <div className="mt-auto p-2 border-t border-ink-900/10">
              <Button
                variant="ghost"
                size={isCollapsed ? 'icon-sm' : 'sm'}
                onClick={toggleCollapsed}
                className={cn(
                  'w-full justify-center',
                  !isCollapsed && 'justify-start gap-2'
                )}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Icon
                  icon={isCollapsed ? ChevronRight : ChevronLeft}
                  size="sm"
                />
                {!isCollapsed && <span className="text-xs">Collapse</span>}
              </Button>
            </div>
          )}
        </aside>
      </SidebarContext.Provider>
    );
  }
);

Sidebar.displayName = 'Sidebar';

/**
 * SidebarHeader - Header area with logo and title
 */
const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps>(
  ({ className, logo, title, subtitle, ...props }, ref) => {
    const { isCollapsed } = useSidebarContext();

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 p-4 border-b border-ink-900/10',
          isCollapsed && 'justify-center p-3',
          className
        )}
        {...props}
      >
        {logo && <div className="shrink-0">{logo}</div>}
        {!isCollapsed && (title || subtitle) && (
          <div className="min-w-0">
            {title && (
              <h2 className="font-semibold text-ink-900 truncate">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-ink-500 truncate">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

SidebarHeader.displayName = 'SidebarHeader';

/**
 * SidebarSection - Grouped navigation section
 */
const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, label, children, ...props }, ref) => {
    const { isCollapsed } = useSidebarContext();

    return (
      <div ref={ref} className={cn('py-2', className)} {...props}>
        {label && (
          <div className={cn(sidebarSectionVariants({ isCollapsed }))}>
            {label}
          </div>
        )}
        <nav className="px-2 space-y-0.5">{children}</nav>
      </div>
    );
  }
);

SidebarSection.displayName = 'SidebarSection';

/**
 * SidebarItem - Individual navigation item
 */
function SidebarItem({
  className,
  icon: IconComponent,
  label,
  isActive,
  isDisabled,
  shortcut,
  badge,
  onSelect,
  href,
}: SidebarItemProps) {
  const { isCollapsed } = useSidebarContext();

  const content = (
    <>
      <Icon icon={IconComponent} size="sm" className="shrink-0" />
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {shortcut && (
            <kbd className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-surface-tertiary rounded text-ink-500">
              {shortcut}
            </kbd>
          )}
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-medium bg-accent/10 text-accent rounded-full">
              {badge}
            </span>
          )}
        </>
      )}
    </>
  );

  const baseClasses = cn(
    sidebarItemVariants({ isActive, isDisabled }),
    isCollapsed && 'justify-center px-2',
    className
  );

  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {content}
      </a>
    );
  }

  return (
    <div
      className={baseClasses}
      onClick={isDisabled ? undefined : onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !isDisabled ? 0 : undefined}
      onKeyDown={
        onSelect && !isDisabled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  );
}

/**
 * SidebarFooter - Footer area with user info
 */
const SidebarFooter = React.forwardRef<HTMLDivElement, SidebarFooterProps>(
  ({ className, avatar, userName, userInfo, children, ...props }, ref) => {
    const { isCollapsed } = useSidebarContext();

    return (
      <div
        ref={ref}
        className={cn(
          'mt-auto p-3 border-t border-ink-900/10',
          isCollapsed && 'flex justify-center',
          className
        )}
        {...props}
      >
        {children || (
          <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
            {avatar && <div className="shrink-0">{avatar}</div>}
            {!isCollapsed && (userName || userInfo) && (
              <div className="min-w-0 overflow-hidden">
                {userName && (
                  <p className="text-sm font-medium text-ink-900 truncate">{userName}</p>
                )}
                {userInfo && (
                  <p className="text-xs text-ink-500 truncate">{userInfo}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

SidebarFooter.displayName = 'SidebarFooter';

// ============================================================================
// 4. UTILITY EXPORTS
// ============================================================================

/**
 * Utility to clear saved collapsed state for a storage key
 */
export function clearSidebarState(storageKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`sidebar:${storageKey}`);
}

/**
 * Hook to access sidebar context (for custom components)
 */
export function useSidebar(): SidebarContextValue {
  return useSidebarContext();
}

// ============================================================================
// 5. EXPORTS
// ============================================================================

export {
  Sidebar,
  SidebarHeader,
  SidebarSection,
  SidebarItem,
  SidebarFooter,
};

export type {
  SidebarProps,
  SidebarHeaderProps,
  SidebarSectionProps,
  SidebarItemProps,
  SidebarFooterProps,
};

export default Sidebar;
