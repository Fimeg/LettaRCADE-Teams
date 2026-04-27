import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
        xl: 'h-8 w-8',
      },
      variant: {
        inherit: '',
        primary: 'text-accent',
        white: 'text-white',
        muted: 'text-ink-400',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'inherit',
    },
  }
);

interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size, variant, label = 'Loading...', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(spinnerVariants({ size, variant }), className)}
        role="status"
        aria-label={label}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </span>
    );
  }
);

Spinner.displayName = 'Spinner';

export { Spinner, spinnerVariants };
export type { SpinnerProps };
