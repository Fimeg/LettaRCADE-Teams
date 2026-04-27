/**
 * Component Template - Copy this file when creating new components
 *
 * This template establishes the standard patterns for the Letta component library:
 * - cva (class-variance-authority) for variant management
 * - forwardRef for ref forwarding
 * - Polymorphic `as` prop for flexible rendering
 * - Accessibility-first attributes
 * - Comprehensive TypeScript types
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

/**
 * Define all visual variants using class-variance-authority.
 * This creates type-safe, composable class names.
 */
const componentVariants = cva(
  // Base classes applied to all variants
  'base-class-another',
  {
    variants: {
      // Primary variant dimension (visual style)
      variant: {
        default: 'variant-default-classes',
        primary: 'variant-primary-classes',
        secondary: 'variant-secondary-classes',
        ghost: 'variant-ghost-classes',
        danger: 'variant-danger-classes',
      },
      // Size dimension
      size: {
        sm: 'size-sm-classes',
        md: 'size-md-classes',
        lg: 'size-lg-classes',
      },
      // State dimensions
      isDisabled: {
        true: 'disabled:opacity-50 disabled:cursor-not-allowed',
        false: '',
      },
    },
    // Default values when props are not provided
    defaultVariants: {
      variant: 'default',
      size: 'md',
      isDisabled: false,
    },
  }
);

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

/**
 * Props interface extending VariantProps from cva.
 * Add custom props beyond the variant types.
 */
interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  /** Custom description of what this prop does */
  customProp?: string;

  /** Icon rendered before content */
  leftIcon?: React.ComponentType<{ className?: string }>;

  /** Icon rendered after content */
  rightIcon?: React.ComponentType<{ className?: string }>;

  /** Polymorphic render as different element */
  as?: React.ElementType;
}

// ============================================================================
// 3. COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * ComponentName - Brief description of what this component does.
 *
 * @example
 * // Basic usage
 * <ComponentName>Content</ComponentName>
 *
 * @example
 * // With variants
 * <ComponentName variant="primary" size="lg">Primary Large</ComponentName>
 *
 * @example
 * // Polymorphic (render as different element)
 * <ComponentName as="a" href="/path">Link styled as component</ComponentName>
 */
const ComponentName = React.forwardRef<HTMLElement, ComponentProps>(
  (
    {
      className,
      variant,
      size,
      isDisabled,
      customProp,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      as: Component = 'div',
      children,
      ...props
    },
    ref
  ) => {
    // Compute final class names using cva + cn
    const classes = cn(
      componentVariants({ variant, size, isDisabled }),
      className
    );

    return (
      <Component
        ref={ref}
        className={classes}
        data-custom={customProp}
        {...props}
      >
        {LeftIcon && <LeftIcon className="mr-2 h-4 w-4" />}
        {children}
        {RightIcon && <RightIcon className="ml-2 h-4 w-4" />}
      </Component>
    );
  }
);

ComponentName.displayName = 'ComponentName';

// ============================================================================
// 4. EXPORTS
// ============================================================================

export { ComponentName, componentVariants };
export type { ComponentProps };

// Default export for convenience
export default ComponentName;
