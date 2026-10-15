import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Independent of workspace transforms/styles; native dialog supplies modal semantics and a real backdrop. */
export function RenalSideDrawer({ title, subtitle, busy = false, onClose, children }: {
  title: string; subtitle: string; busy?: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null), closing = useRef(false), id = useId();
  useEffect(() => {
    const opener = document.activeElement, element = dialog.current, overflow = document.body.style.overflow;
    closing.current = false; document.body.style.overflow = "hidden"; element?.showModal();
    return () => { closing.current = true; if (element?.open) element.close(); document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  const close = () => { if (busy || closing.current) return; closing.current = true; dialog.current?.close(); onClose(); };
  return createPortal(<dialog ref={dialog} className="renal-side-drawer" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); close(); }}
    onClose={event => { if (!event.currentTarget.open && !closing.current && event.currentTarget.isConnected) close(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]")).filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0);
      const first = items[0], last = items.at(-1), active = document.activeElement;
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && (active === first || active === event.currentTarget)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || active === event.currentTarget)) { event.preventDefault(); first.focus(); }
    }}>
    <header className="renal-drawer-header"><div><span>Clinical workflow</span><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{subtitle}</p></div><button type="button" aria-label="Close renal drawer" disabled={busy} onClick={close}><X size={20} /></button></header>
    <div className="renal-drawer-body">{children}</div>
  </dialog>, document.body);
}
