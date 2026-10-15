import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    secondary: "bg-secondary text-on-solid hover:bg-info-solid",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    destructive: "bg-destructive text-on-solid hover:bg-danger-solid",
    outline: "border border-control-border bg-surface text-foreground hover:bg-muted",
  };

  return (
    <button
      className={cn("gov-button interactive-control inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-disabled", variants[variant], className)}
      type={type}
      {...props}
    />
  );
}
