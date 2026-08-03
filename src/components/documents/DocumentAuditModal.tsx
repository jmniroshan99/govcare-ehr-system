import { useEffect, useState } from "react";
import { History, X } from "lucide-react";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/badge";
import { getDocumentAuditHistory } from "../../services/documentService";
import type { DocumentAuditEntry, PatientDocument } from "../../types/document";
import { formatDate } from "./DocumentCard";

export function DocumentAuditModal({ document, onClose }: { document: PatientDocument; onClose: () => void }) {
  const [items, setItems] = useState<DocumentAuditEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void getDocumentAuditHistory(document.patientId, document.id).then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load audit history.")); }, [document.id, document.patientId]);
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold"><History className="h-5 w-5" />Document audit history</h2><Button variant="ghost" className="text-white" onClick={onClose}><X className="h-5 w-5" /></Button></div>
        <p className="mt-2 text-sm text-slate-400">{document.title} · {document.patientNo}</p>
        {error && <p className="mt-4 rounded-md bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
        <div className="mt-4 space-y-3">
          {items.map((item) => <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{item.action.replaceAll("_", " ")}</p><StatusBadge status={item.result} /></div><p className="mt-1 text-sm text-slate-300">{item.userName ?? "Unknown user"} · {item.departmentName ?? item.role ?? "No department"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.accessedAt)} · {item.ipAddress ?? "No IP"}</p></div>)}
          {!items.length && !error && <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No audit events are recorded for this document.</p>}
        </div>
      </div>
    </div>
  );
}
