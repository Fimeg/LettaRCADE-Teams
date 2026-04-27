import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';

const labelVariants = cva(
  'block font-medium text-ink-700',
  {
    variants: {
      size: {
        sm: 'text-xs mb-1',
        md: 'text-sm mb-1.5',
      },
      isRequired: {
        true: 'after:content-["*"] after:ml-0.5 after:text-status-error',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      isRequired: false,
    },
  }
);

interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  helperText?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, size, isRequired, helperText, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ size, isRequired }), className)}
        {...props}
      >
        {children}
        {helperText && (
          <span className="ml-1.5 text-ink-400 font-normal">{helperText}</span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';

export { Label, labelVariants };
export type { LabelProps };
