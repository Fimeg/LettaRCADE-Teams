import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import type { LucideIcon } from 'lucide-react';

const inputVariants = cva(
  'w-full bg-surface border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-ink-400 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-2.5 text-base',
      },
      variant: {
        default: 'border-ink-900/10',
        error: 'border-status-error focus:ring-status-error/50',
      },
      hasLeftIcon: {
        true: 'pl-9',
        false: '',
      },
      hasRightIcon: {
        true: 'pr-9',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
      hasLeftIcon: false,
      hasRightIcon: false,
    },
  }
);

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, size, variant, leftIcon: LeftIcon, rightIcon: RightIcon, ...props },
    ref
  ) => {
    return (
      <div className="relative w-full">
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <LeftIcon className="h-4 w-4 text-ink-500" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            inputVariants({
              size,
              variant,
              hasLeftIcon: !!LeftIcon,
              hasRightIcon: !!RightIcon,
            }),
            className
          )}
          {...props}
        />
        {RightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <RightIcon className="h-4 w-4 text-ink-500" />
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
export type { InputProps };
