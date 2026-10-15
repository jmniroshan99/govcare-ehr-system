import { Download, X } from "lucide-react";
import { Button } from "../ui/button";
import type { PatientDocument } from "../../types/document";

export function PdfPreviewModal({ document, url, onClose, onDownload }: { document: PatientDocument | null; url: string; onClose: () => void; onDownload: () => void }) {
  if (!document) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-surface p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-info-border bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">{document.title}</h2>
            <p className="truncate text-xs text-muted-foreground">{document.patientNo} · {document.originalFileName ?? document.fileName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDownload}><Download className="h-4 w-4" />Download</Button>
            <Button variant="ghost" className="text-foreground" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-surface p-2">
          {document.mimeType === "application/pdf" ? (
            <iframe className="h-full w-full rounded bg-surface" src={url} title={document.title} />
          ) : document.mimeType.startsWith("image/") ? (
            <div className="grid h-full place-items-center overflow-auto"><img src={url} alt={document.title} className="max-h-full max-w-full rounded" /></div>
          ) : (
            <div className="grid h-full place-items-center text-center text-foreground">
              <div><p className="font-bold">Preview is unavailable for this file type.</p><p className="mt-2 text-sm">Download the document to open it securely.</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
