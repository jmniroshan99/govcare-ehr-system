import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm focus:border-primary focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-rose-400 aria-invalid:ring-2 aria-invalid:ring-rose-500/20", className)} {...props} />;
}
