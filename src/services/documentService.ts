import { apiDownload, apiRequest } from "./apiClient";
import type {
  DepartmentDocumentAccess,
  DepartmentRequest,
  DocumentAuditEntry,
  GeneratePatientDocumentInput,
  PatientDocument,
  PatientDocumentFilters,
  PatientTimelineEvent,
  UploadPatientDocumentInput,
} from "../types/document";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";
const API_TOKEN_KEY = "govcare-api-token";

function filterParams(filters: PatientDocumentFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.documentType) params.set("documentType", filters.documentType);
  if (filters.status) params.set("status", filters.status);
  if (filters.releaseStatus) params.set("releaseStatus", filters.releaseStatus);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort) params.set("sort", filters.sort);
  return params.toString();
}

export async function getPatientDocuments(patientId: string, filters: PatientDocumentFilters = {}) {
  const query = filterParams(filters);
  return apiRequest<PatientDocument[]>(`/api/patients/${encodeURIComponent(patientId)}/documents${query ? `?${query}` : ""}`);
}

export async function getDepartmentDocuments(departmentId: string, filters: PatientDocumentFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.documentType) params.set("documentType", filters.documentType);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort) params.set("sort", filters.sort);
  const query = params.toString();
  return apiRequest<PatientDocument[]>(`/api/departments/${encodeURIComponent(departmentId)}/documents${query ? `?${query}` : ""}`);
}

export async function getDepartmentRequests(departmentId: string) {
  return apiRequest<DepartmentRequest[]>(`/api/departments/${encodeURIComponent(departmentId)}/requests`);
}

export async function getShareableDepartments() {
  return apiRequest<Array<{ id: string; code: string; name: string; type?: string }>>(`/api/documents/shareable-departments`);
}

export async function uploadPatientDocument(input: UploadPatientDocumentInput) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("documentType", input.documentType);
  if (input.title?.trim()) form.append("title", input.title.trim());
  if (input.description?.trim()) form.append("description", input.description.trim());
  form.append("status", input.status ?? "DRAFT");
  form.append("visibilityLevel", input.visibilityLevel ?? "DEPARTMENT");
  const links: Array<[string, string | undefined]> = [
    ["encounterId", input.encounterId],
    ["consultationId", input.consultationId],
    ["prescriptionId", input.prescriptionId],
    ["laboratoryRequestId", input.laboratoryRequestId],
    ["radiologyRequestId", input.radiologyRequestId],
    ["admissionId", input.admissionId],
  ];
  links.forEach(([name, value]) => {
    if (value) form.append(name, value);
  });

  const token = window.localStorage.getItem(API_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/api/patients/${encodeURIComponent(input.patientId)}/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<PatientDocument>;
}

export async function generatePatientPdf(patientId: string, input: GeneratePatientDocumentInput) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/generate`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function viewDocument(patientId: string, documentId: string) {
  return apiDownload(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/content?download=false`);
}

export async function downloadDocument(patientId: string, documentId: string) {
  return apiDownload(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/content?download=true`);
}

export async function printDocument(patientId: string, documentId: string) {
  return apiDownload(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/content?print=true`);
}

export async function verifyDocument(patientId: string, documentId: string) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/verify`, { method: "PATCH" });
}

export async function rejectDocument(patientId: string, documentId: string, reason: string) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function releaseDocumentToPatient(patientId: string, documentId: string) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/release`, { method: "PATCH" });
}

export async function revokePatientRelease(patientId: string, documentId: string) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/revoke-release`, { method: "PATCH" });
}

export async function archiveDocument(patientId: string, documentId: string) {
  return apiRequest<PatientDocument>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/archive`, { method: "PATCH" });
}

export async function shareDocumentWithDepartment(patientId: string, documentId: string, departmentId: string, accessType = "VIEW", expiresAt?: string) {
  return apiRequest<DepartmentDocumentAccess[]>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/share`, {
    method: "POST",
    body: JSON.stringify({ departmentId, accessType, expiresAt: expiresAt || null }),
  });
}

export async function revokeDepartmentShare(patientId: string, documentId: string, departmentId: string) {
  return apiRequest<void>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/share/${encodeURIComponent(departmentId)}`, { method: "DELETE" });
}

export async function getDocumentShares(patientId: string, documentId: string) {
  return apiRequest<DepartmentDocumentAccess[]>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/shares`);
}

export async function getDocumentAuditHistory(patientId: string, documentId: string) {
  return apiRequest<DocumentAuditEntry[]>(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/audit`);
}

export async function getPatientTimeline(patientId: string) {
  return apiRequest<PatientTimelineEvent[]>(`/api/patients/${encodeURIComponent(patientId)}/timeline`);
}

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? `Document API failed with status ${response.status}`;
  } catch {
    return `Document API failed with status ${response.status}`;
  }
}
