import { Archive, Download, Eye, History, Printer, RotateCcw, Share2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge, StatusBadge } from "../ui/badge";
import { Table, Td, Th } from "../ui/table";
import { DocumentCard, formatDate, type DocumentActions } from "./DocumentCard";
import type { PatientDocument } from "../../types/document";

export function DocumentTable({ documents, actions }: { documents: PatientDocument[]; actions: DocumentActions }) {
  if (!documents.length) {
    return <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No patient documents are available for your current access level.</div>;
  }

  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {documents.map((document) => <DocumentCard key={document.id} document={document} actions={actions} />)}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <thead>
            <tr>
              <Th>Document</Th><Th>Patient</Th><Th>Department</Th><Th>Status</Th><Th>Release</Th><Th>Created</Th><Th>Verified by</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <Td>
                  <div className="min-w-52">
                    <p className="font-bold">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.documentType.replaceAll("_", " ")} · {formatBytes(document.fileSizeBytes)}</p>
                  </div>
                </Td>
                <Td><p className="font-semibold">{document.patientName}</p><p className="text-xs text-muted-foreground">{document.patientNo}</p></Td>
                <Td><Badge tone="info">{document.sourceDepartmentName ?? "Unassigned"}</Badge></Td>
                <Td><StatusBadge status={document.documentStatus} /></Td>
                <Td><Badge tone={document.patientReleaseStatus === "RELEASED_TO_PATIENT" ? "success" : "neutral"}>{document.patientReleaseStatus.replaceAll("_", " ")}</Badge></Td>
                <Td><p>{formatDate(document.createdAt)}</p><p className="text-xs text-muted-foreground">{document.createdByName ?? "Hospital staff"}</p></Td>
                <Td>{document.verifiedByName ?? "—"}</Td>
                <Td>
                  <div className="flex min-w-72 flex-wrap gap-2">
                    <Button variant="outline" onClick={() => actions.onPreview(document)}><Eye className="h-4 w-4" />View</Button>
                    <Button variant="outline" onClick={() => actions.onDownload(document)}><Download className="h-4 w-4" /></Button>
                    {actions.onPrint && <Button variant="outline" onClick={() => actions.onPrint?.(document)}><Printer className="h-4 w-4" /></Button>}
                    {actions.onShare && <Button variant="outline" onClick={() => actions.onShare?.(document)}><Share2 className="h-4 w-4" /></Button>}
                    {actions.onAudit && <Button variant="outline" onClick={() => actions.onAudit?.(document)}><History className="h-4 w-4" /></Button>}
                    {actions.onVerify && document.documentStatus !== "VERIFIED" && <Button onClick={() => actions.onVerify?.(document)}>Verify</Button>}
                    {actions.onReject && !["VERIFIED", "ARCHIVED"].includes(document.documentStatus) && <Button variant="destructive" onClick={() => actions.onReject?.(document)}>Reject</Button>}
                    {actions.onRelease && document.documentStatus === "VERIFIED" && document.patientReleaseStatus !== "RELEASED_TO_PATIENT" && <Button onClick={() => actions.onRelease?.(document)}>Release</Button>}
                    {actions.onRevokeRelease && document.patientReleaseStatus === "RELEASED_TO_PATIENT" && <Button variant="outline" onClick={() => actions.onRevokeRelease?.(document)}><RotateCcw className="h-4 w-4" /></Button>}
                    {actions.onArchive && document.documentStatus !== "ARCHIVED" && <Button variant="outline" onClick={() => actions.onArchive?.(document)}><Archive className="h-4 w-4" /></Button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
