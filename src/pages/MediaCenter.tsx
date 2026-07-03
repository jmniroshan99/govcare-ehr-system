import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileImage, FileText, ImageUp, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Td, Th } from "../components/ui/table";
import { useToast } from "../components/ui/toast-context";
import { can } from "../lib/rbac";
import { cn } from "../lib/utils";
import { uploadGlobalMedia, formatFileSize } from "../services/mediaService";
import { useAuthStore } from "../stores/authStore";
import type { GlobalMediaFile, MediaModule, MediaVisibility } from "../types/ehr";

const modules: Array<{ value: MediaModule; label: string }> = [
  { value: "patient-profile", label: "Patient profile" },
  { value: "opd", label: "OPD queue" },
  { value: "consultation", label: "Consultation" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "laboratory", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "emergency", label: "Emergency" },
  { value: "admissions", label: "Admissions" },
  { value: "ward", label: "Ward" },
  { value: "reports", label: "Reports" },
  { value: "secure-chat", label: "Secure chat" },
  { value: "profile", label: "Profile image" },
  { value: "other", label: "Other" },
];

const visibilityOptions: Array<{ value: MediaVisibility; label: string; help: string }> = [
  { value: "private", label: "Private staff record", help: "Visible only to authorized hospital staff." },
  { value: "care-team", label: "Care team", help: "Visible to authorized clinical team members." },
  { value: "patient-released", label: "Released to patient", help: "Visible in patient portal after approval." },
  { value: "admin-only", label: "Admin only", help: "Visible to hospital/admin governance roles." },
];

const demoMedia: GlobalMediaFile[] = [
  {
    id: "media-demo-1",
    hospitalId: "hosp-colombo-national",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
    updatedBy: "system",
    fileName: "injury-photo-triage.png",
    fileType: "image/png",
    fileSize: 842120,
    fileUrl: "",
    storagePath: "hospitals/hosp-colombo-national/media/emergency/PAT-2026-0001/injury-photo-triage.png",
    uploadedBy: "demo-doctor",
    uploadedByName: "Dr. Perera",
    role: "doctor",
    patientId: "PAT-2026-0001",
    module: "emergency",
    visibilityLevel: "care-team",
    description: "Emergency injury documentation",
    reviewStatus: "not-required",
  },
  {
    id: "media-demo-2",
    hospitalId: "hosp-colombo-national",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
    updatedBy: "system",
    fileName: "lab-report-scan.pdf",
    fileType: "application/pdf",
    fileSize: 512000,
    fileUrl: "",
    storagePath: "hospitals/hosp-colombo-national/media/laboratory/PAT-2026-0001/lab-report-scan.pdf",
    uploadedBy: "demo-lab",
    uploadedByName: "Lab Technician",
    role: "lab_technician",
    patientId: "PAT-2026-0001",
    module: "laboratory",
    visibilityLevel: "patient-released",
    description: "Approved lab scan ready for patient portal",
    reviewStatus: "approved",
  },
];

function fileKind(fileType: string) {
  return fileType.startsWith("image/") ? "image" : "document";
}

function reviewTone(status: GlobalMediaFile["reviewStatus"]) {
  if (status === "approved" || status === "not-required") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export function MediaCenter() {
  const profile = useAuthStore((state) => state.profile);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [patientId, setPatientId] = useState(profile?.patientId ?? "");
  const [module, setModule] = useState<MediaModule>(profile?.role === "patient" ? "profile" : "patient-profile");
  const [visibilityLevel, setVisibilityLevel] = useState<MediaVisibility>(profile?.role === "patient" ? "private" : "care-team");
  const [description, setDescription] = useState("");
  const [requiresReview, setRequiresReview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState<GlobalMediaFile[]>(demoMedia);

  const canUpload = useMemo(() => can(profile?.role, "media:upload") || profile?.role === "patient", [profile?.role]);
  const selectedVisibility = visibilityOptions.find((item) => item.value === visibilityLevel);

  function selectFile(file?: File) {
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function submitUpload() {
    if (!profile || !selectedFile) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadGlobalMedia({
        file: selectedFile,
        hospitalId: profile.hospitalId,
        uploadedBy: profile.uid,
        uploadedByName: profile.displayName,
        role: profile.role,
        patientId: patientId || profile.patientId,
        module,
        visibilityLevel,
        description,
        requiresReview,
      });
      setMediaItems((current) => [uploaded, ...current]);
      setSelectedFile(null);
      setPreviewUrl("");
      setDescription("");
      setRequiresReview(false);
      showToast("Media uploaded and audit metadata prepared.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed.", "danger");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-lg border border-cyan-200 bg-gradient-to-br from-sky-950 via-teal-900 to-slate-950 p-6 text-white shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Badge tone="info">Global Secure Media</Badge>
            <h1 className="mt-4 text-3xl font-bold text-white">Medical image and document upload center</h1>
            <p className="mt-3 text-sm leading-6 text-cyan-50">
              Upload patient photos, injury documentation, lab scans, prescriptions, radiology files, ward condition images, emergency evidence, profile pictures, and released patient documents with hospital-level isolation.
            </p>
          </div>
          <div className="grid min-w-64 gap-2 rounded-md border border-white/20 bg-white/10 p-4 text-sm backdrop-blur">
            <span className="inline-flex items-center gap-2 font-semibold text-cyan-50"><ShieldCheck className="h-4 w-4" /> RBAC protected</span>
            <span className="inline-flex items-center gap-2 font-semibold text-cyan-50"><LockKeyhole className="h-4 w-4" /> hospitalId isolated</span>
            <span className="inline-flex items-center gap-2 font-semibold text-cyan-50"><CheckCircle2 className="h-4 w-4" /> audit-ready metadata</span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <Card className="border-cyan-200 bg-white dark:border-cyan-900 dark:bg-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" />Upload clinical media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition",
                isDragging ? "border-primary bg-teal-50 dark:bg-teal-950/40" : "border-cyan-200 bg-slate-50 dark:border-cyan-900 dark:bg-slate-900",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,text/plain"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-primary dark:bg-teal-950 dark:text-teal-200">
                <ImageUp className="h-7 w-7" />
              </div>
              <p className="mt-3 text-base font-bold text-slate-950 dark:text-slate-50">Drop image or document here</p>
              <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WEBP, GIF, PDF, or TXT up to 20 MB.</p>
              <Button type="button" className="mt-4" onClick={() => fileInputRef.current?.click()} disabled={!canUpload}>
                Choose file
              </Button>
              {!canUpload && <p className="mt-3 text-sm text-rose-700">Your role cannot upload media.</p>}
            </div>

            {selectedFile && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 rounded-lg border border-border bg-white p-4 dark:bg-slate-900 md:grid-cols-[180px_1fr]">
                <div className="grid min-h-36 place-items-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  {selectedFile.type.startsWith("image/") ? (
                    <img src={previewUrl} alt={selectedFile.name} className="h-full max-h-48 w-full object-cover" />
                  ) : (
                    <FileText className="h-12 w-12 text-primary" />
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-bold text-slate-950 dark:text-slate-50">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedFile.type || "Unknown type"} | {formatFileSize(selectedFile.size)}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-semibold">
                      Patient ID
                      <Input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="PAT-2026-0001" />
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                      Module
                      <Select value={module} onChange={(event) => setModule(event.target.value as MediaModule)}>
                        {modules.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </Select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                      Visibility
                      <Select value={visibilityLevel} onChange={(event) => setVisibilityLevel(event.target.value as MediaVisibility)}>
                        {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </Select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                      Review engine
                      <Select value={requiresReview ? "review" : "direct"} onChange={(event) => setRequiresReview(event.target.value === "review")}>
                        <option value="direct">Direct upload</option>
                        <option value="review">Send to review queue</option>
                      </Select>
                    </label>
                  </div>
                  <label className="space-y-1 text-sm font-semibold">
                    Description
                    <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short clinical context" />
                  </label>
                  {selectedVisibility && <p className="rounded-md bg-cyan-50 p-3 text-sm text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">{selectedVisibility.help}</p>}
                  <Button type="button" onClick={submitUpload} disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Upload securely"}
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <CardHeader>
            <CardTitle>Workflow and security path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["1", "Validate file", "Type, size, module, patient ID, role, and hospital scope are checked before upload."],
              ["2", "Store in cloud storage", "Files are saved under hospital-scoped paths with custom metadata."],
              ["3", "Write metadata", "globalMedia records include hospitalId, uploadedBy, role, module, visibility, timestamps, and review status."],
              ["4", "Review if critical", "Critical or patient-released media can enter a review queue before release."],
              ["5", "Audit and notify", "Production Cloud Functions should append audit logs and notify care teams or patients."],
            ].map((step) => (
              <div key={step[0]} className="flex gap-3 rounded-md border border-border bg-slate-50 p-3 dark:bg-slate-900">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{step[0]}</span>
                <div>
                  <p className="font-bold text-slate-950 dark:text-slate-50">{step[1]}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{step[2]}</p>
                </div>
              </div>
            ))}
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Patient privacy rule</p>
              <p className="mt-1">Patients only see their own released files. Staff access is limited by role, hospitalId, patient assignment, and visibility level.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient media timeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Patient</Th>
                <Th>Module</Th>
                <Th>Visibility</Th>
                <Th>Uploaded by</Th>
                <Th>Review</Th>
              </tr>
            </thead>
            <tbody>
              {mediaItems.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {fileKind(item.fileType) === "image" ? <FileImage className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                      <div>
                        <p className="font-semibold">{item.fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{item.patientId || "General"}</Td>
                  <Td>{modules.find((moduleItem) => moduleItem.value === item.module)?.label ?? item.module}</Td>
                  <Td><Badge tone={item.visibilityLevel === "patient-released" ? "success" : item.visibilityLevel === "admin-only" ? "warning" : "info"}>{item.visibilityLevel}</Badge></Td>
                  <Td>{item.uploadedByName}</Td>
                  <Td><Badge tone={reviewTone(item.reviewStatus)}>{item.reviewStatus}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
