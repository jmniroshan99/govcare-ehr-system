import { apiDownload, apiRequest } from "./apiClient";

export type CbcReferenceRange = {
  id: string;
  test_code: string;
  test_name: string;
  category: string;
  min_value?: number | null;
  max_value?: number | null;
  critical_min?: number | null;
  critical_max?: number | null;
  unit?: string | null;
  gender?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  display_order: number;
};

export type CbcResult = {
  id?: string;
  test_code: string;
  test_name: string;
  category: string;
  result_value?: number | null;
  min_reference?: number | null;
  max_reference?: number | null;
  critical_min?: number | null;
  critical_max?: number | null;
  unit?: string | null;
  abnormal_flag?: "N" | "L" | "H" | "C" | null;
  manually_overridden?: boolean;
  display_order: number;
};

export type BloodReportRecord = {
  id: string;
  report_number: string;
  patient_id: string;
  patient_no: string;
  patient_name: string;
  nic?: string | null;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  age_years?: number | null;
  gender?: string | null;
  lab_request_id?: string | null;
  test_type?: string | null;
  test_code?: string | null;
  clinical_reason?: string | null;
  referred_by?: string | null;
  specimen_type: string;
  sample_number?: string | null;
  collected_at?: string | null;
  collected_by_name?: string | null;
  received_at?: string | null;
  reported_at?: string | null;
  status: "DRAFT" | "COMPLETED" | "VERIFIED" | "RELEASED" | "CANCELLED";
  interpretation?: string | null;
  prepared_by_name?: string | null;
  technician_name?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  released_by_name?: string | null;
  released_at?: string | null;
  ward_name?: string | null;
  ward_code?: string | null;
  bed_code?: string | null;
  admission_no?: string | null;
  created_at: string;
  updated_at: string;
  results?: CbcResult[];
};

export type BloodReportInput = {
  patientUuid: string;
  labRequestUuid?: string | null;
  specimenType?: string;
  sampleNumber?: string | null;
  collectedAt?: string | null;
  receivedAt?: string | null;
  interpretation?: string | null;
  results: Array<{ testCode: string; value: number | null; manuallyOverridden?: boolean }>;
};

export async function getCbcReferenceRanges(patientUuid?: string) {
  const params = new URLSearchParams();
  if (patientUuid) params.set("patientUuid", patientUuid);
  return apiRequest<{ items: CbcReferenceRange[] }>(`/api/laboratory/reference-ranges/cbc${params.size ? `?${params}` : ""}`);
}

export async function getBloodReports(filters: { search?: string; status?: string; patientUuid?: string; from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.patientUuid) params.set("patientUuid", filters.patientUuid);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return apiRequest<{ items: BloodReportRecord[] }>(`/api/laboratory/blood-reports${params.size ? `?${params}` : ""}`);
}

export async function getBloodReport(id: string) {
  return apiRequest<{ report: BloodReportRecord }>(`/api/laboratory/blood-reports/${encodeURIComponent(id)}`);
}

export async function createBloodReport(input: BloodReportInput) {
  return apiRequest<{ report: BloodReportRecord }>("/api/laboratory/blood-reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBloodReport(id: string, input: Omit<BloodReportInput, "patientUuid"> & { labRequestUuid?: string | null }) {
  return apiRequest<{ report: BloodReportRecord }>(`/api/laboratory/blood-reports/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function completeBloodReport(id: string) {
  return apiRequest<{ report: BloodReportRecord }>(`/api/laboratory/blood-reports/${encodeURIComponent(id)}/complete`, { method: "POST" });
}

export async function verifyBloodReport(id: string) {
  return apiRequest<{ report: BloodReportRecord }>(`/api/laboratory/blood-reports/${encodeURIComponent(id)}/verify`, { method: "POST" });
}

export async function releaseBloodReport(id: string) {
  return apiRequest<{ report: BloodReportRecord }>(`/api/laboratory/blood-reports/${encodeURIComponent(id)}/release`, { method: "POST" });
}

async function downloadBloodReportFile(id: string) {
  return apiDownload(`/api/laboratory/blood-reports/${encodeURIComponent(id)}/pdf`);
}

export async function downloadBloodReportPdf(id: string) {
  const { blob, filename } = await downloadBloodReportFile(id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return filename;
}

export async function printBloodReportPdf(id: string) {
  const { blob } = await downloadBloodReportFile(id);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  frame.onload = () => window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  }, 250);
}
