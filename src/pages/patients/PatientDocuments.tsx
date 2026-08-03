import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileCheck2, FileClock, FileText, Filter, History, RefreshCw, Search, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { DocumentAuditModal } from "../../components/documents/DocumentAuditModal";
import { DocumentShareModal } from "../../components/documents/DocumentShareModal";
import { DocumentTable } from "../../components/documents/DocumentTable";
import { DocumentUploadModal } from "../../components/documents/DocumentUploadModal";
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
  getPatientDocuments,
  getPatientTimeline,
  rejectDocument,
  releaseDocumentToPatient,
  revokePatientRelease,
  shareDocumentWithDepartment,
  uploadPatientDocument,
  verifyDocument,
  viewDocument,
} from "../../services/documentService";
import { useAuthStore } from "../../stores/authStore";
import type { PatientDocument, PatientDocumentFilters, PatientTimelineEvent, UploadPatientDocumentInput } from "../../types/document";
import { formatDate } from "../../components/documents/DocumentCard";

const documentTypes = [
  "", "PATIENT_REGISTRATION", "PATIENT_ID_CARD", "CONSULTATION_REPORT", "PRESCRIPTION", "PHARMACY_DISPENSING_REPORT",
  "LABORATORY_REQUEST", "LABORATORY_RESULT", "RADIOLOGY_REQUEST", "RADIOLOGY_RESULT", "ADMISSION_REPORT",
  "DISCHARGE_SUMMARY", "NURSING_REPORT", "EMERGENCY_REPORT", "OPERATION_THEATRE_REPORT", "REFERRAL_LETTER",
  "CONSENT_FORM", "MEDICAL_CERTIFICATE", "OTHER_CLINICAL_DOCUMENT",
] as const;

export function PatientDocuments() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [timeline, setTimeline] = useState<PatientTimelineEvent[]>([]);
  const [filters, setFilters] = useState<PatientDocumentFilters>({ sort: "newest" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"documents" | "timeline">("documents");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareDocument, setShareDocument] = useState<PatientDocument | null>(null);
  const [auditDocument, setAuditDocument] = useState<PatientDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PatientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const canCreate = hasPermission(profile, "DOCUMENT_CREATE");
  const canShare = hasPermission(profile, "DOCUMENT_SHARE");
  const canAudit = hasPermission(profile, "DOCUMENT_AUDIT_VIEW");
  const canVerify = hasPermission(profile, "DOCUMENT_VERIFY");
  const canReject = hasPermission(profile, "DOCUMENT_REJECT");
  const canRelease = hasPermission(profile, "DOCUMENT_RELEASE_TO_PATIENT");
  const canPrint = hasPermission(profile, "DOCUMENT_PRINT");
  const canRevokeRelease = hasPermission(profile, "DOCUMENT_REVOKE_PATIENT_RELEASE");
  const canArchive = hasPermission(profile, "DOCUMENT_ARCHIVE");

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true); setError("");
    try {
      const [documentRows, timelineRows] = await Promise.all([
        getPatientDocuments(patientId, filters),
        getPatientTimeline(patientId).catch(() => []),
      ]);
      setDocuments(documentRows);
      setTimeline(timelineRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load patient documents.");
    } finally {
      setLoading(false);
    }
  }, [filters, patientId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const summary = useMemo(() => ({
    total: documents.length,
    verified: documents.filter((item) => item.documentStatus === "VERIFIED").length,
    pending: documents.filter((item) => ["DRAFT", "SUBMITTED", "REJECTED"].includes(item.documentStatus)).length,
    released: documents.filter((item) => item.patientReleaseStatus === "RELEASED_TO_PATIENT").length,
  }), [documents]);

  const departmentOptions = useMemo(() => {
    const unique = new Map<string, string>();
    documents.forEach((item) => {
      if (item.sourceDepartmentId) unique.set(item.sourceDepartmentId, item.sourceDepartmentName ?? "Department");
    });
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [documents]);

  async function openPreview(document: PatientDocument) {
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const result = await viewDocument(document.patientId, document.id);
      setPreviewUrl(URL.createObjectURL(result.blob));
      setPreviewDocument(document);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to preview document.", "danger");
    }
  }

  async function download(document: PatientDocument) {
    try {
      const result = await downloadDocument(document.patientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = result.filename; anchor.click();
      URL.revokeObjectURL(url);
      showToast("Document downloaded securely.", "success");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to download document.", "danger");
    }
  }

  async function upload(input: UploadPatientDocumentInput) {
    try {
      await uploadPatientDocument(input);
      showToast("Patient document uploaded successfully.", "success");
      await load();
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to upload document.", "danger");
      throw reason;
    }
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
    const reason = window.prompt("Reason for rejection or correction request:", "Correction required.");
    if (reason === null) return;
    try { await rejectDocument(document.patientId, document.id, reason); showToast("Document returned for correction.", "success"); await load(); }
    catch (failure) { showToast(failure instanceof Error ? failure.message : "Rejection failed.", "danger"); }
  }

  async function release(document: PatientDocument) {
    if (!window.confirm(`Release ${document.title} to the patient portal?`)) return;
    try { await releaseDocumentToPatient(document.patientId, document.id); showToast("Document released to the patient.", "success"); await load(); }
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
        <div>
          <Button variant="ghost" className="mb-2" onClick={() => navigate(`/patients/${patientId}`)}><ArrowLeft className="h-4 w-4" />Patient profile</Button>
          <h1 className="text-2xl font-bold">Patient Documents and PDFs</h1>
          <p className="text-sm text-muted-foreground">Central, permission-aware reports shared securely among authorized departments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          {canCreate && <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" />Upload document</Button>}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Authorized documents" value={summary.total} icon={<FileText className="h-5 w-5" />} />
        <SummaryCard title="Verified" value={summary.verified} icon={<FileCheck2 className="h-5 w-5" />} />
        <SummaryCard title="Awaiting action" value={summary.pending} icon={<FileClock className="h-5 w-5" />} />
        <SummaryCard title="Released to patient" value={summary.released} icon={<History className="h-5 w-5" />} />
      </section>

      <div className="flex gap-2 border-b border-border">
        <button className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "documents" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("documents")}>Documents and PDFs</button>
        <button className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "timeline" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setTab("timeline")}>Activity Timeline</button>
      </div>

      {tab === "documents" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Search and filters</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="relative md:col-span-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Title, patient, department, file..." /></label>
              <Select value={filters.documentType ?? ""} onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value as PatientDocumentFilters["documentType"] }))}>{documentTypes.map((type) => <option key={type || "all"} value={type}>{type ? type.replaceAll("_", " ") : "All document types"}</option>)}</Select>
              <Select value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as PatientDocumentFilters["status"] }))}><option value="">All verification statuses</option>{["DRAFT", "SUBMITTED", "VERIFIED", "REJECTED", "CANCELLED"].map((value) => <option key={value}>{value}</option>)}</Select>
              <Select value={filters.releaseStatus ?? ""} onChange={(event) => setFilters((current) => ({ ...current, releaseStatus: event.target.value as PatientDocumentFilters["releaseStatus"] }))}><option value="">All patient-release statuses</option>{["NOT_RELEASED", "RELEASED_TO_PATIENT", "WITHHELD", "REVOKED"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</Select>
              <Select value={filters.departmentId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value || undefined }))}><option value="">All source departments</option>{departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">From date<Input type="date" value={filters.from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))} /></label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">To date<Input type="date" value={filters.to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))} /></label>
              <Select value={filters.sort ?? "newest"} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as "newest" | "oldest" }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select>
              <Button variant="outline" onClick={() => setFilters({ sort: "newest" })}>Clear filters</Button>
            </CardContent>
          </Card>
          {error && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
          {loading ? <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">Loading authorized documents...</div> : (
            <DocumentTable documents={documents} actions={{ onPreview: openPreview, onDownload: download, onPrint: canPrint ? printSecure : undefined, onShare: canShare ? setShareDocument : undefined, onAudit: canAudit ? setAuditDocument : undefined, onVerify: canVerify ? verify : undefined, onReject: canReject ? reject : undefined, onRelease: canRelease ? release : undefined, onRevokeRelease: canRevokeRelease ? revokeRelease : undefined, onArchive: canArchive ? archive : undefined }} />
          )}
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle>Longitudinal patient activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {timeline.map((event, index) => <div key={`${event.eventAt}-${event.eventType}-${index}`} className="flex gap-3 rounded-lg border border-border p-3"><div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{event.title}</p><StatusBadge status={event.eventType} /></div><p className="mt-1 text-sm text-muted-foreground">{event.department ?? "Hospital"} · {event.staffName ?? "Hospital staff"} · {formatDate(event.eventAt)}</p>{event.documentId && <Button variant="outline" className="mt-2" onClick={() => { const document = documents.find((item) => item.id === event.documentId); if (document) void openPreview(document); }}>View related PDF</Button>}</div></div>)}
            {!timeline.length && <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No timeline events are available for your current access level.</p>}
          </CardContent>
        </Card>
      )}

      {uploadOpen && <DocumentUploadModal patientId={patientId} onClose={() => setUploadOpen(false)} onSubmit={upload} />}
      {shareDocument && profile && <DocumentShareModal document={shareDocument} onClose={() => setShareDocument(null)} onShare={async (departmentId, accessType, expiresAt) => { await shareDocumentWithDepartment(shareDocument.patientId, shareDocument.id, departmentId, accessType, expiresAt); showToast("Document shared with the department.", "success"); }} />}
      {auditDocument && <DocumentAuditModal document={auditDocument} onClose={() => setAuditDocument(null)} />}
      <PdfPreviewModal document={previewDocument} url={previewUrl} onClose={() => { setPreviewDocument(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(""); }} onDownload={() => { if (previewDocument) void download(previewDocument); }} />
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 text-3xl font-bold">{value}</p></div><div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{icon}</div></CardContent></Card>;
}
