import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import { Spinner } from './Spinner';
import type { LucideIcon } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'bg-surface-tertiary text-ink-700 hover:bg-ink-900/10 border border-ink-900/10',
        ghost: 'text-ink-700 hover:bg-ink-900/5',
        danger: 'bg-status-error text-white hover:bg-status-error/90',
        link: 'text-accent hover:underline underline-offset-4 p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-2',
        'icon-sm': 'h-8 w-8 p-1.5',
        'icon-lg': 'h-12 w-12 p-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  as?: React.ElementType;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      children,
      disabled,
      as: Component = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    // Icon size mapping based on button size
    const iconSize = size === 'sm' || size === 'icon-sm' ? 'sm' :
                     size === 'lg' || size === 'icon-lg' ? 'lg' : 'md';

    const iconClass = iconSize === 'sm' ? 'h-3.5 w-3.5' :
                      iconSize === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <Spinner
            size={iconSize}
            variant={variant === 'primary' || variant === 'danger' ? 'white' : 'primary'}
          />
        ) : (
          LeftIcon && <LeftIcon className={iconClass} />
        )}
        {children}
        {!isLoading && RightIcon && <RightIcon className={iconClass} />}
      </Component>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
