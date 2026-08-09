import type { ReactNode } from "react";

export interface FormFieldLabelProps {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  recommended?: boolean;
  className?: string;
}

/**
 * Keeps data-entry labels clean and readable in both light and dark themes.
 * Only mandatory fields receive an indicator. Non-mandatory fields are left
 * unbadged and can be completed later.
 */
export function FormFieldLabel({
  children,
  required = false,
  className = "",
}: FormFieldLabelProps) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`.trim()}>
      <span>{children}</span>
      {required ? <span className="font-bold text-rose-500 dark:text-rose-300" aria-label="required">*</span> : null}
    </span>
  );
}
