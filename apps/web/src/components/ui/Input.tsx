import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "block w-full rounded-md border px-3 py-2 text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white",
            "placeholder:text-gray-400 focus:outline-none",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-700"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);
