import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      className={cn(
        'w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm',
        'focus:outline-none focus:ring-2 focus:ring-amber-400',
        'bg-gray-50 dark:bg-gray-700 dark:text-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export { Select };
