import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, FileCheck2, FileText, RefreshCw, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DocumentAuditModal } from "../../components/documents/DocumentAuditModal";
import { DocumentShareModal } from "../../components/documents/DocumentShareModal";
import { DocumentTable } from "../../components/documents/DocumentTable";
import { PdfPreviewModal } from "../../components/documents/PdfPreviewModal";
import { StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast-context";
import { hasPermission } from "../../lib/accessControl";
import {
  archiveDocument,
  downloadDocument,
  printDocument,
  getDepartmentDocuments,
  getDepartmentRequests,
  rejectDocument,
  releaseDocumentToPatient,
  revokePatientRelease,
  shareDocumentWithDepartment,
  verifyDocument,
  viewDocument,
} from "../../services/documentService";
import { useAuthStore } from "../../stores/authStore";
import type { DepartmentRequest, PatientDocument, PatientDocumentFilters } from "../../types/document";
import { formatDate } from "../../components/documents/DocumentCard";

export function DepartmentDocuments() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [requests, setRequests] = useState<DepartmentRequest[]>([]);
  const [filters, setFilters] = useState<PatientDocumentFilters>({ sort: "newest" });
  const [tab, setTab] = useState<"documents" | "requests">("documents");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewDocument, setPreviewDocument] = useState<PatientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [shareDocument, setShareDocument] = useState<PatientDocument | null>(null);
  const [auditDocument, setAuditDocument] = useState<PatientDocument | null>(null);

  const moduleName = useMemo(() => {
    if (location.pathname.startsWith("/laboratory")) return "Laboratory";
    if (location.pathname.startsWith("/radiology")) return "Radiology";
    if (location.pathname.startsWith("/pharmacy")) return "Pharmacy";
    if (location.pathname.startsWith("/ward")) return "Ward";
    if (location.pathname.startsWith("/doctor")) return "Doctor";
    return "Clinical Department";
  }, [location.pathname]);

  const documentTypeOptions = useMemo(() => {
    if (moduleName === "Laboratory") return ["LABORATORY_REQUEST", "LABORATORY_RESULT"];
    if (moduleName === "Radiology") return ["RADIOLOGY_REQUEST", "RADIOLOGY_RESULT"];
    if (moduleName === "Pharmacy") return ["PRESCRIPTION", "PHARMACY_DISPENSING_REPORT"];
    if (moduleName === "Ward") return ["ADMISSION_REPORT", "DISCHARGE_SUMMARY", "NURSING_REPORT", "LABORATORY_RESULT", "RADIOLOGY_RESULT", "PRESCRIPTION", "EMERGENCY_REPORT"];
    return ["CONSULTATION_REPORT", "PRESCRIPTION", "LABORATORY_REQUEST", "LABORATORY_RESULT", "RADIOLOGY_REQUEST", "RADIOLOGY_RESULT", "ADMISSION_REPORT", "DISCHARGE_SUMMARY", "NURSING_REPORT", "EMERGENCY_REPORT", "OPERATION_THEATRE_REPORT", "REFERRAL_LETTER", "MEDICAL_CERTIFICATE"];
  }, [moduleName]);

  const load = useCallback(async () => {
    if (!profile?.departmentId) {
      setError("Your staff profile does not have an assigned department.");
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      const [documentRows, requestRows] = await Promise.all([
        getDepartmentDocuments(profile.departmentId, filters),
        getDepartmentRequests(profile.departmentId).catch(() => []),
      ]);
      setDocuments(documentRows);
      setRequests(requestRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load department documents.");
    } finally {
      setLoading(false);
    }
  }, [filters, profile?.departmentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const canShare = hasPermission(profile, "DOCUMENT_SHARE");
  const canAudit = hasPermission(profile, "DOCUMENT_AUDIT_VIEW");
  const canVerify = hasPermission(profile, "DOCUMENT_VERIFY");
  const canReject = hasPermission(profile, "DOCUMENT_REJECT");
  const canRelease = hasPermission(profile, "DOCUMENT_RELEASE_TO_PATIENT");
  const canPrint = hasPermission(profile, "DOCUMENT_PRINT");
  const canRevokeRelease = hasPermission(profile, "DOCUMENT_REVOKE_PATIENT_RELEASE");
  const canArchive = hasPermission(profile, "DOCUMENT_ARCHIVE");

  async function preview(document: PatientDocument) {
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const result = await viewDocument(document.patientId, document.id);
      setPreviewUrl(URL.createObjectURL(result.blob)); setPreviewDocument(document);
    } catch (reason) { showToast(reason instanceof Error ? reason.message : "Preview failed.", "danger"); }
  }

  async function download(document: PatientDocument) {
    try {
      const result = await downloadDocument(document.patientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
      showToast("Document downloaded securely.", "success");
    } catch (reason) { showToast(reason instanceof Error ? reason.message : "Download failed.", "danger"); }
  }

  async function printSecure(document: PatientDocument) {
    try {
      const result = await printDocument(document.patientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const frame = window.document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.border = "0";
      frame.setAttribute("aria-hidden", "true");
      frame.src = url;
      window.document.body.appendChild(frame);
      frame.onload = () => {
        window.setTimeout(() => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          window.setTimeout(() => {
            frame.remove();
            URL.revokeObjectURL(url);
          }, 60_000);
        }, 300);
      };
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Print failed.", "danger");
    }
  }

  async function verify(document: PatientDocument) {
    if (!window.confirm(`Verify ${document.title}?`)) return;
    try { await verifyDocument(document.patientId, document.id); showToast("Document verified.", "success"); await load(); }
    catch (reason) { showToast(reason instanceof Error ? reason.message : "Verification failed.", "danger"); }
  }

  async function reject(document: PatientDocument) {
    const reason = window.prompt("Correction or rejection reason:", "Correction required.");
    if (reason === null) return;
    try { await rejectDocument(document.patientId, document.id, reason); showToast("Document returned for correction.", "success"); await load(); }
    catch (failure) { showToast(failure instanceof Error ? failure.message : "Rejection failed.", "danger"); }
  }

  async function release(document: PatientDocument) {
    if (!window.confirm(`Release ${document.title} to the patient portal?`)) return;
    try { await releaseDocumentToPatient(document.patientId, document.id); showToast("Document released to patient.", "success"); await load(); }
    catch (reason) { showToast(reason instanceof Error ? reason.message : "Release failed.", "danger"); }
  }

  async function revokeRelease(document: PatientDocument) {
    if (!window.confirm(`Revoke patient access to ${document.title}?`)) return;
    try {
      await revokePatientRelease(document.patientId, document.id);
      showToast("Patient access was revoked.", "success");
      await load();
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to revoke patient access.", "danger");
    }
  }

  async function archive(document: PatientDocument) {
    if (!window.confirm(`Archive ${document.title}?`)) return;
    try {
      await archiveDocument(document.patientId, document.id);
      showToast("Document archived.", "success");
      await load();
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to archive document.", "danger");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{moduleName} Documents</h1><p className="text-sm text-muted-foreground">Verified patient reports, assigned requests and securely shared PDFs for this department.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric title="Authorized PDFs" value={documents.length} icon={<FileText className="h-5 w-5" />} />
        <Metric title="Verified reports" value={documents.filter((item) => item.documentStatus === "VERIFIED").length} icon={<FileCheck2 className="h-5 w-5" />} />
        <Metric title="Open requests" value={requests.filter((item) => !["completed", "verified", "dispensed"].includes(item.workflowStatus.toLowerCase())).length} icon={<ClipboardList className="h-5 w-5" />} />
      </section>

      <div className="flex gap-2 border-b border-border"><button className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "documents" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("documents")}>Documents and PDFs</button><button className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("requests")}>Department Requests</button></div>

      {error && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
      {tab === "documents" ? (
        <>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />Document filters</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Input className="xl:col-span-2" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Patient, report, document..." /><Select value={filters.documentType ?? ""} onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value as PatientDocumentFilters["documentType"] }))}><option value="">All document types</option>{documentTypeOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select><Select value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as PatientDocumentFilters["status"] }))}><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></Select><Select value={filters.sort ?? "newest"} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as "newest" | "oldest" }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select></CardContent></Card>
          {loading ? <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">Loading department documents...</div> : <DocumentTable documents={documents} actions={{ onPreview: preview, onDownload: download, onPrint: canPrint ? printSecure : undefined, onShare: canShare ? setShareDocument : undefined, onAudit: canAudit ? setAuditDocument : undefined, onVerify: canVerify ? verify : undefined, onReject: canReject ? reject : undefined, onRelease: canRelease ? release : undefined, onRevokeRelease: canRevokeRelease ? revokeRelease : undefined, onArchive: canArchive ? archive : undefined }} />}
        </>
      ) : (
        <Card><CardHeader><CardTitle>Requests sent to {moduleName}</CardTitle></CardHeader><CardContent className="space-y-3">{requests.map((request) => <button key={request.id} type="button" className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted" onClick={() => navigate(`/patients/${request.patientId}/documents`)}><div><p className="font-bold">{request.requestType}</p><p className="text-sm text-muted-foreground">{request.patientNo} · {request.patientName} · Requested by {request.requestedByName ?? "Doctor"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(request.createdAt)}</p></div><div className="flex items-center gap-2"><StatusBadge status={request.priority} /><StatusBadge status={request.workflowStatus} /></div></button>)}{!requests.length && <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No requests are currently assigned to this department.</p>}</CardContent></Card>
      )}

      {shareDocument && profile && <DocumentShareModal document={shareDocument} onClose={() => setShareDocument(null)} onShare={async (departmentId, accessType, expiresAt) => { await shareDocumentWithDepartment(shareDocument.patientId, shareDocument.id, departmentId, accessType, expiresAt); showToast("Document shared with the department.", "success"); }} />}
      {auditDocument && <DocumentAuditModal document={auditDocument} onClose={() => setAuditDocument(null)} />}
      <PdfPreviewModal document={previewDocument} url={previewUrl} onClose={() => { setPreviewDocument(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(""); }} onDownload={() => { if (previewDocument) void download(previewDocument); }} />
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 text-3xl font-bold">{value}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{icon}</div></CardContent></Card>;
}
