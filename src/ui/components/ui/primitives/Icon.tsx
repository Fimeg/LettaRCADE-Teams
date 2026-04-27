import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';

// Re-export all Lucide icons for tree-shaking
export * from 'lucide-react';

const iconVariants = cva('', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

interface IconProps
  extends React.SVGAttributes<SVGSVGElement>,
    VariantProps<typeof iconVariants> {
  icon: React.ComponentType<{ className?: string; ref?: React.Ref<SVGSVGElement> }>;
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComponent, className, size, ...props }, ref) => {
    return (
      <IconComponent
        ref={ref}
        className={cn(iconVariants({ size }), className)}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

export { Icon, iconVariants };
export type { IconProps };
