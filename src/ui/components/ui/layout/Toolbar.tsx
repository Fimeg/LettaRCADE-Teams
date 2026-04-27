/**
 * Toolbar Component - Action button group with separators
 *
 * Groups related actions with visual separators.
 * Used for page and panel-level action bars.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button, type ButtonProps } from '../primitives/Button';
import { Icon } from '../primitives/Icon';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

const toolbarVariants = cva(
  'flex items-center bg-surface',
  {
    variants: {
      variant: {
        default: '',
        bordered: 'border border-ink-900/10 rounded-lg px-1',
        raised: 'shadow-card rounded-lg px-1 border border-ink-900/5',
      },
      size: {
        sm: 'h-8 gap-0.5',
        md: 'h-10 gap-1',
        lg: 'h-12 gap-1.5 px-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const toolbarGroupVariants = cva('flex items-center', {
  variants: {
    separator: {
      true: 'border-r border-ink-900/10 pr-1 mr-1',
      false: '',
    },
  },
  defaultVariants: {
    separator: false,
  },
});

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

interface ToolbarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toolbarVariants> {
  /** Toolbar action groups */
  children: React.ReactNode;
}

interface ToolbarGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toolbarGroupVariants> {
  /** Group label (for accessibility) */
  'aria-label'?: string;
}

interface ToolbarButtonProps extends ButtonProps {
  /** Icon displayed before label */
  icon?: LucideIcon;

  /** Whether to show only the icon (tooltip for label) */
  iconOnly?: boolean;

  /** Tooltip text (defaults to children/label) */
  tooltip?: string;

  /** Shortcut hint displayed in tooltip */
  shortcut?: string;
}

// ============================================================================
// 3. COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * Toolbar - Action button container
 *
 * @example
 * // Basic usage
 * <Toolbar>
 *   <ToolbarGroup>
 *     <ToolbarButton icon={Plus} label="Add" onClick={handleAdd} />
 *     <ToolbarButton icon={Edit} label="Edit" onClick={handleEdit} />
 *   </ToolbarGroup>
 *   <ToolbarGroup separator>
 *     <ToolbarButton icon={Trash} variant="danger" label="Delete" onClick={handleDelete} />
 *   </ToolbarGroup>
 * </Toolbar>
 *
 * @example
 * // Bordered variant with primary action
 * <Toolbar variant="bordered">
 *   <ToolbarGroup>
 *     <ToolbarButton icon={Save} variant="primary" label="Save" />
 *     <ToolbarButton icon={X} label="Cancel" />
 *   </ToolbarGroup>
 * </Toolbar>
 */
const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  (
    { className, variant, size, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(toolbarVariants({ variant, size }), className)}
        role="toolbar"
        {...props}
      >
        {children}
      </div>
    );
  }
);

Toolbar.displayName = 'Toolbar';

/**
 * ToolbarGroup - Group of related actions
 */
const ToolbarGroup = React.forwardRef<HTMLDivElement, ToolbarGroupProps>(
  ({ className, separator, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toolbarGroupVariants({ separator }), className)}
        role="group"
        {...props}
      >
        {children}
      </div>
    );
  }
);

ToolbarGroup.displayName = 'ToolbarGroup';

/**
 * ToolbarButton - Individual toolbar action button
 */
const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      className,
      icon: IconComponent,
      iconOnly,
      children,
      tooltip,
      shortcut,
      ...props
    },
    ref
  ) => {
    const displayLabel = children;
    const buttonContent = (
      <>
        {IconComponent && <Icon icon={IconComponent} size="sm" />}
        {!iconOnly && displayLabel && <span>{displayLabel}</span>}
      </>
    );

    const tooltipText = tooltip || (iconOnly ? String(displayLabel) : undefined);
    const shortcutText = shortcut ? ` (${shortcut})` : '';

    return (
      <Button
        ref={ref}
        variant="ghost"
        size={iconOnly ? 'icon-sm' : 'sm'}
        className={cn(
          iconOnly && 'text-ink-600 hover:text-ink-900',
          className
        )}
        title={tooltipText ? `${tooltipText}${shortcutText}` : undefined}
        {...props}
      >
        {buttonContent}
      </Button>
    );
  }
);

ToolbarButton.displayName = 'ToolbarButton';

/**
 * ToolbarSeparator - Visual divider between groups
 */
const ToolbarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-px h-4 bg-ink-900/10 mx-1', className)}
        role="separator"
        {...props}
      />
    );
  }
);

ToolbarSeparator.displayName = 'ToolbarSeparator';

// ============================================================================
// 4. EXPORTS
// ============================================================================

export {
  Toolbar,
  ToolbarGroup,
  ToolbarButton,
  ToolbarSeparator,
};

export type {
  ToolbarProps,
  ToolbarGroupProps,
  ToolbarButtonProps,
};

export default Toolbar;
