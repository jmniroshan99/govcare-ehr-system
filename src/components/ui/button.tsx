import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-teal-800",
    secondary: "bg-secondary text-white hover:bg-cyan-900",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    destructive: "bg-destructive text-white hover:bg-rose-800",
    outline: "border border-border bg-white text-slate-800 hover:bg-muted",
  };

  return (
    <button
      className={cn("interactive-control inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50", variants[variant], className)}
      type={type}
      {...props}
    />
  );
}
