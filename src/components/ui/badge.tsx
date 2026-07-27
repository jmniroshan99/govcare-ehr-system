import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-100 text-amber-800 ring-amber-200",
    danger: "bg-rose-100 text-rose-800 ring-rose-200",
    info: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1", tones[tone], className)} {...props} />;
}

function statusToneFor(status: string): BadgeTone {
  const normalized = status.toLowerCase();
  if (/(critical|emergency|cancelled|failed|blocked|rejected|panic)/.test(normalized)) return "danger";
  if (/(called|consultation|progress|transferred|pending|urgent|review|processing|scheduled)/.test(normalized)) return "warning";
  if (/(completed|checked|issued|released|approved|active|available|success|admitted)/.test(normalized)) return "success";
  if (/(skipped|draft|waiting|requested|new)/.test(normalized)) return "info";
  return "neutral";
}

export function StatusBadge({ status, className, ...props }: Omit<HTMLAttributes<HTMLSpanElement>, "children"> & { status: string }) {
  return (
    <Badge
      tone={statusToneFor(status)}
      className={cn("queue-status-badge capitalize", className)}
      aria-label={`Status: ${status.replaceAll("-", " ")}`}
      {...props}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current opacity-70" />
      {status.replaceAll("-", " ")}
    </Badge>
  );
}
