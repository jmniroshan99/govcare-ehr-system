import { Archive, Download, Eye, FileText, History, Printer, RotateCcw, Share2 } from "lucide-react";
import { Badge, StatusBadge } from "../ui/badge";
import { Button } from "../ui/button";
import type { PatientDocument } from "../../types/document";

export type DocumentActions = {
  onPreview: (document: PatientDocument) => void;
  onDownload: (document: PatientDocument) => void;
  onPrint?: (document: PatientDocument) => void;
  onShare?: (document: PatientDocument) => void;
  onAudit?: (document: PatientDocument) => void;
  onVerify?: (document: PatientDocument) => void;
  onReject?: (document: PatientDocument) => void;
  onRelease?: (document: PatientDocument) => void;
  onRevokeRelease?: (document: PatientDocument) => void;
  onArchive?: (document: PatientDocument) => void;
};

export function DocumentCard({ document, actions }: { document: PatientDocument; actions: DocumentActions }) {
  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold">{document.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{document.patientNo} · {document.patientName}</p>
          </div>
        </div>
        <StatusBadge status={document.documentStatus} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge tone="info">{document.documentType.replaceAll("_", " ")}</Badge>
        <Badge>{document.sourceDepartmentName ?? "No department"}</Badge>
        <Badge tone={document.patientReleaseStatus === "RELEASED_TO_PATIENT" ? "success" : "neutral"}>
          {document.patientReleaseStatus.replaceAll("_", " ")}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div><dt>Created</dt><dd className="font-semibold text-foreground">{formatDate(document.createdAt)}</dd></div>
        <div><dt>Created by</dt><dd className="font-semibold text-foreground">{document.createdByName ?? "Hospital staff"}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => actions.onPreview(document)}><Eye className="h-4 w-4" />View</Button>
        <Button variant="outline" onClick={() => actions.onDownload(document)}><Download className="h-4 w-4" />Download</Button>
        {actions.onPrint && <Button variant="outline" onClick={() => actions.onPrint?.(document)}><Printer className="h-4 w-4" />Print</Button>}
        {actions.onShare && <Button variant="outline" onClick={() => actions.onShare?.(document)}><Share2 className="h-4 w-4" />Share</Button>}
        {actions.onAudit && <Button variant="outline" onClick={() => actions.onAudit?.(document)}><History className="h-4 w-4" />Audit</Button>}
        {actions.onVerify && document.documentStatus !== "VERIFIED" && <Button onClick={() => actions.onVerify?.(document)}>Verify</Button>}
        {actions.onReject && !["VERIFIED", "ARCHIVED"].includes(document.documentStatus) && <Button variant="destructive" onClick={() => actions.onReject?.(document)}>Reject</Button>}
        {actions.onRelease && document.documentStatus === "VERIFIED" && document.patientReleaseStatus !== "RELEASED_TO_PATIENT" && (
          <Button onClick={() => actions.onRelease?.(document)}>Release to patient</Button>
        )}
        {actions.onRevokeRelease && document.patientReleaseStatus === "RELEASED_TO_PATIENT" && (
          <Button variant="outline" onClick={() => actions.onRevokeRelease?.(document)}><RotateCcw className="h-4 w-4" />Revoke release</Button>
        )}
        {actions.onArchive && document.documentStatus !== "ARCHIVED" && (
          <Button variant="outline" onClick={() => actions.onArchive?.(document)}><Archive className="h-4 w-4" />Archive</Button>
        )}
      </div>
    </article>
  );
}

export function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
