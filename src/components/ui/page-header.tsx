import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Shared page hierarchy. Clinical warnings remain separate semantic alerts. */
export function PageHeader({ title, description, eyebrow, icon, actions, children, className }: {
  title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; icon?: ReactNode;
  actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return <header className={cn("gov-page-header", className)}>
    <div className="gov-page-header-main">
      {eyebrow && <div className="gov-eyebrow">{icon && <span className="gov-icon-tile" aria-hidden="true">{icon}</span>}{eyebrow}</div>}
      <h1>{title}</h1>
      {description && <p className="gov-page-description">{description}</p>}
    </div>
    {actions && <div className="gov-page-actions">{actions}</div>}
    {children && <div className="gov-page-header-footer">{children}</div>}
  </header>;
}
