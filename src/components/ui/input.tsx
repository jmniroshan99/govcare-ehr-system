import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "gov-control min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm font-medium text-foreground shadow-sm dark:border-control-border dark:bg-surface dark:text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-accent-border disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger-border aria-invalid:ring-2 aria-invalid:ring-danger-border",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
