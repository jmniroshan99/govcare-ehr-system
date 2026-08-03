import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import type { PatientDocumentType, UploadPatientDocumentInput } from "../../types/document";

const documentTypes: Array<{ value: PatientDocumentType; label: string }> = [
  ["PATIENT_REGISTRATION", "Patient registration"], ["PATIENT_ID_CARD", "Patient ID card"],
  ["CONSULTATION_REPORT", "Consultation report"], ["PRESCRIPTION", "Prescription"],
  ["PHARMACY_DISPENSING_REPORT", "Pharmacy dispensing report"], ["LABORATORY_REQUEST", "Laboratory request"],
  ["LABORATORY_RESULT", "Laboratory result"], ["RADIOLOGY_REQUEST", "Radiology request"],
  ["RADIOLOGY_RESULT", "Radiology result"], ["ADMISSION_REPORT", "Admission report"],
  ["DISCHARGE_SUMMARY", "Discharge summary"], ["NURSING_REPORT", "Nursing report"],
  ["EMERGENCY_REPORT", "Emergency report"], ["OPERATION_THEATRE_REPORT", "Operation theatre report"],
  ["REFERRAL_LETTER", "Referral letter"], ["CONSENT_FORM", "Consent form"],
  ["MEDICAL_CERTIFICATE", "Medical certificate"], ["OTHER_CLINICAL_DOCUMENT", "Other clinical document"],
].map(([value, label]) => ({ value: value as PatientDocumentType, label }));

export function DocumentUploadModal({ patientId, onClose, onSubmit }: { patientId: string; onClose: () => void; onSubmit: (input: UploadPatientDocumentInput) => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<PatientDocumentType>("OTHER_CLINICAL_DOCUMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SUBMITTED">("DRAFT");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file) return;
    setSaving(true);
    try {
      await onSubmit({ patientId, file, documentType, title, description, status, visibilityLevel: "DEPARTMENT" });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Upload patient document</h2><Button variant="ghost" className="text-white" onClick={onClose}><X className="h-5 w-5" /></Button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold sm:col-span-2">File
            <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileInput.current?.click()} className="mt-1 flex min-h-24 w-full items-center justify-center gap-3 rounded-lg border border-dashed border-cyan-700 bg-slate-900 px-4 text-cyan-100">
              <FileUp className="h-6 w-6" />{file ? file.name : "Choose PDF, image, or DOCX"}
            </button>
          </label>
          <label className="space-y-1 text-sm font-semibold">Document type
            <Select value={documentType} onChange={(event) => setDocumentType(event.target.value as PatientDocumentType)}>
              {documentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-semibold">Workflow status
            <Select value={status} onChange={(event) => setStatus(event.target.value as "DRAFT" | "SUBMITTED")}>
              <option value="DRAFT">Draft</option><option value="SUBMITTED">Submit for verification</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm font-semibold sm:col-span-2">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Document title" /></label>
          <label className="space-y-1 text-sm font-semibold sm:col-span-2">Description<textarea className="min-h-24 w-full rounded-md border border-border bg-slate-900 px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        <p className="mt-4 text-xs text-slate-400">Files are uploaded through an authenticated request. Internal storage paths are never exposed.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} disabled={!file || saving}>{saving ? "Uploading..." : "Upload document"}</Button></div>
      </div>
    </div>
  );
}
