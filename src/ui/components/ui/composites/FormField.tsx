import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import { Label } from '../primitives/Label';

const formFieldVariants = cva('', {
  variants: {
    layout: {
      vertical: 'flex flex-col',
      horizontal: 'grid grid-cols-[120px_1fr] items-center gap-4',
    },
  },
  defaultVariants: {
    layout: 'vertical',
  },
});

interface FormFieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof formFieldVariants> {
  label: string;
  htmlFor?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      layout,
      label,
      htmlFor,
      error,
      helperText,
      isRequired,
      children,
      ...props
    },
    ref
  ) => {
    const errorId = error ? `${htmlFor}-error` : undefined;
    const helperId = helperText ? `${htmlFor}-helper` : undefined;

    return (
      <div ref={ref} className={cn(formFieldVariants({ layout }), className)} {...props}>
        <Label
          htmlFor={htmlFor}
          isRequired={isRequired}
          size={layout === 'horizontal' ? 'sm' : 'md'}
        >
          {label}
        </Label>
        <div className="flex-1">
          {children}
          {error && (
            <p id={errorId} className="mt-1.5 text-xs text-status-error" role="alert">
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={helperId} className="mt-1.5 text-xs text-ink-500">
              {helperText}
            </p>
          )}
        </div>
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export { FormField, formFieldVariants };
export type { FormFieldProps };
