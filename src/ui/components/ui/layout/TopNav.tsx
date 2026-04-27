/**
 * TopNav Component - Header navigation bar
 *
 * Page header with breadcrumb navigation, title, subtitle, and action buttons.
 * Used for page-level navigation and actions.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronRight, ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

const topNavVariants = cva(
  'flex items-center justify-between gap-4 px-4 py-3 bg-surface border-b border-ink-900/10',
  {
    variants: {
      variant: {
        default: '',
        transparent: 'bg-transparent border-transparent',
        sticky: 'sticky top-0 z-30',
      },
      size: {
        sm: 'h-12 py-2',
        md: 'h-14',
        lg: 'h-16',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const breadcrumbItemVariants = cva(
  'flex items-center text-sm',
  {
    variants: {
      isActive: {
        true: 'font-medium text-ink-900',
        false: 'text-ink-500 hover:text-ink-700',
      },
    },
    defaultVariants: {
      isActive: false,
    },
  }
);

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

interface BreadcrumbItem {
  /** Display label */
  label: string;

  /** Navigation href */
  href?: string;

  /** Optional icon */
  icon?: LucideIcon;

  /** Click handler (if no href) */
  onClick?: () => void;
}

interface TopNavProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof topNavVariants> {
  /** Page title */
  title?: string;

  /** Subtitle or description */
  subtitle?: string;

  /** Breadcrumb items for navigation */
  breadcrumbs?: BreadcrumbItem[];

  /** Back button handler (shows back arrow when provided) */
  onBack?: () => void;

  /** Back button label (default: "Back") */
  backLabel?: string;

  /** Actions displayed on the right side */
  actions?: React.ReactNode;

  /** Whether to show a border bottom */
  bordered?: boolean;
}

interface TopNavBreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /** Breadcrumb items */
  items: BreadcrumbItem[];

  /** Separator element (default: chevron) */
  separator?: React.ReactNode;
}

interface TopNavTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Main title */
  title: string;

  /** Subtitle text */
  subtitle?: string;

  /** Icon displayed before title */
  icon?: LucideIcon;
}

interface TopNavActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Action buttons or elements */
  children: React.ReactNode;

  /** Gap size between actions */
  gap?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// 3. COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * TopNav - Header navigation bar
 *
 * @example
 * // Basic usage
 * <TopNav title="Settings" subtitle="Configure your agent" />
 *
 * @example
 * // With breadcrumbs and actions
 * <TopNav
 *   breadcrumbs={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Agents', href: '/agents' },
 *     { label: 'My Agent', isActive: true }
 *   ]}
 *   actions={
 *     <>
 *       <Button variant="secondary">Cancel</Button>
 *       <Button>Save</Button>
 *     </>
 *   }
 * />
 *
 * @example
 * // With back button
 * <TopNav
 *   title="Agent Details"
 *   onBack={() => navigate('/agents')}
 *   backLabel="All Agents"
 * />
 */
const TopNav = React.forwardRef<HTMLElement, TopNavProps>(
  (
    {
      className,
      variant,
      size,
      title,
      subtitle,
      breadcrumbs,
      onBack,
      backLabel = 'Back',
      actions,
      bordered = true,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={cn(
          topNavVariants({ variant, size }),
          !bordered && 'border-transparent',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="shrink-0 -ml-2"
            >
              <Icon icon={ArrowLeft} size="sm" className="mr-1" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Button>
          )}

          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <TopNavBreadcrumb items={breadcrumbs} />
          )}

          {/* Title area (if no breadcrumbs) */}
          {(title || children) && !breadcrumbs && (
            <div className="min-w-0">
              {children || (
                <>
                  {title && (
                    <h1 className="text-base font-semibold text-ink-900 truncate">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs text-ink-500 truncate">{subtitle}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </header>
    );
  }
);

TopNav.displayName = 'TopNav';

/**
 * TopNavBreadcrumb - Breadcrumb navigation
 */
const TopNavBreadcrumb = React.forwardRef<HTMLElement, TopNavBreadcrumbProps>(
  ({ className, items, separator, ...props }, ref) => {
    const defaultSeparator = (
      <Icon icon={ChevronRight} size="sm" className="text-ink-300 mx-1" />
    );

    return (
      <nav
        ref={ref}
        className={cn('flex items-center min-w-0', className)}
        aria-label="Breadcrumb"
        {...props}
      >
        <ol className="flex items-center flex-wrap gap-y-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isActive = isLast || item.onClick === undefined;

            return (
              <li key={index} className="flex items-center">
                {index > 0 && (separator ?? defaultSeparator)}

                {item.href ? (
                  <a
                    href={item.href}
                    className={cn(
                      breadcrumbItemVariants({ isActive }),
                      'hover:underline'
                    )}
                  >
                    {item.icon && (
                      <Icon icon={item.icon} size="sm" className="mr-1.5" />
                    )}
                    <span className={cn('truncate', isLast && 'max-w-[200px]')}>
                      {item.label}
                    </span>
                  </a>
                ) : (
                  <span
                    className={cn(
                      breadcrumbItemVariants({ isActive }),
                      !isActive && item.onClick && 'cursor-pointer',
                      isLast && 'max-w-[200px] truncate'
                    )}
                    onClick={item.onClick}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.icon && (
                      <Icon icon={item.icon} size="sm" className="mr-1.5" />
                    )}
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
);

TopNavBreadcrumb.displayName = 'TopNavBreadcrumb';

/**
 * TopNavTitle - Title area with optional icon and subtitle
 */
const TopNavTitle = React.forwardRef<HTMLDivElement, TopNavTitleProps>(
  ({ className, title, subtitle, icon, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center gap-2 min-w-0', className)} {...props}>
        {icon && <Icon icon={icon} size="md" className="text-ink-500 shrink-0" />}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-ink-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
        </div>
      </div>
    );
  }
);

TopNavTitle.displayName = 'TopNavTitle';

/**
 * TopNavActions - Action button container
 */
const TopNavActions = React.forwardRef<HTMLDivElement, TopNavActionsProps>(
  ({ className, children, gap = 'md', ...props }, ref) => {
    const gapClasses = {
      sm: 'gap-1',
      md: 'gap-2',
      lg: 'gap-3',
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center shrink-0', gapClasses[gap], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TopNavActions.displayName = 'TopNavActions';

// ============================================================================
// 4. EXPORTS
// ============================================================================

export { TopNav, TopNavBreadcrumb, TopNavTitle, TopNavActions };
export type {
  TopNavProps,
  TopNavBreadcrumbProps,
  TopNavTitleProps,
  TopNavActionsProps,
  BreadcrumbItem,
};
export default TopNav;
