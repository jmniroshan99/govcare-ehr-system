import type { ReactNode, KeyboardEvent } from "react";

export type WorkspaceTab<T extends string> = { value: T; label: string; description?: string; icon?: ReactNode; panelId: string };

/** Native buttons with the WAI-ARIA tab keyboard pattern; no PHI is persisted. */
export function WorkspaceTabs<T extends string>({ label, tabs, value, onValueChange }: {
  label: string; tabs: WorkspaceTab<T>[]; value: T; onValueChange: (value: T) => void;
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    onValueChange(tabs[next].value);
  }
  return <div role="tablist" aria-label={label} aria-orientation="horizontal" className="gov-workspace-tabs">
    {tabs.map((tab, index) => <button type="button" role="tab" key={tab.value} id={`${tab.panelId}-tab`}
      aria-selected={value === tab.value} aria-controls={tab.panelId} tabIndex={value === tab.value ? 0 : -1}
      onClick={() => onValueChange(tab.value)} onKeyDown={event => move(event, index)}>
      {tab.icon && <span className="gov-tab-icon" aria-hidden="true">{tab.icon}</span>}
      <span><strong>{tab.label}</strong>{tab.description && <small>{tab.description}</small>}</span>
    </button>)}
  </div>;
}
