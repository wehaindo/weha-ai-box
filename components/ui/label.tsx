import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
