import type { ReactNode } from "react";

export interface FormFieldLabelProps {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  recommended?: boolean;
  className?: string;
}

/**
 * Keeps mandatory fields explicit without relying on a low-contrast asterisk.
 * The text badge remains understandable for colour-blind users and screen
 * readers in both light and dark themes.
 */
export function FormFieldLabel({
  children,
  required = false,
  className = "",
}: FormFieldLabelProps) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      <span>{children}</span>
      {required ? (
        <span className="inline-flex min-h-5 items-center rounded-full border border-danger-border bg-danger-surface px-2 text-[11px] font-bold leading-none text-danger" aria-label="Required field">
          Required
        </span>
      ) : null}
    </span>
  );
}
