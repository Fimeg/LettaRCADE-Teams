import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 flex gap-3',
  {
    variants: {
      variant: {
        info: 'bg-status-info-light border-status-info/20 text-status-info',
        success: 'bg-status-success-light border-status-success/20 text-status-success',
        warning: 'bg-status-warning-light border-status-warning/20 text-status-warning',
        error: 'bg-status-error-light border-status-error/20 text-status-error',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

const iconMap: Record<string, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = 'info', title, dismissible, onDismiss, children, ...props },
    ref
  ) => {
    const Icon = iconMap[variant || 'info'];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className="font-medium text-sm mb-1">{title}</h5>
          )}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded p-1 hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
export type { AlertProps };
