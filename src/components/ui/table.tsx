import type { TdHTMLAttributes, ThHTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="w-full min-w-0 overflow-x-auto"><table className={cn("gov-table w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm [&_tbody_tr]:table-row-motion", className)} {...props} /></div>;
}

export function Th(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("sticky top-0 z-10 border-b border-border bg-muted px-4 py-3 text-xs font-bold uppercase tracking-wide text-foreground", props.className)} {...props} />;
}

export function Td(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("align-top border-b border-border px-4 py-3 leading-6 text-foreground", props.className)} {...props} />;
}
