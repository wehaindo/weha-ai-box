import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm',
        'focus:outline-none focus:ring-2 focus:ring-amber-400',
        'bg-gray-50 dark:bg-gray-700 dark:text-white',
        'placeholder:text-gray-400 dark:placeholder:text-gray-500',
        'resize-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
