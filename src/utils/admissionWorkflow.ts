export type AdmissionStatus = "pending" | "approved" | "admitted" | "transfer-requested" | "discharge-ready" | "discharged" | "cancelled";
export type AdmissionPriority = "routine" | "urgent" | "emergency" | "critical";
export type AdmissionReferralSource = "OPD" | "Emergency" | "Clinic" | "Doctor Center";

export interface AdmissionCounterRequest {
  id: string;
  admissionNo?: string;
  patientId: string;
  patientName: string;
  referralSource: AdmissionReferralSource;
  reason: string;
  provisionalDiagnosis: string;
  priority: AdmissionPriority;
  department: string;
  wardType: string;
  consultant: string;
  bedType: string;
  allergies: string[];
  chronicDiseases: string[];
  emergencyStatus: boolean;
  notes: string;
  status: AdmissionStatus;
  wardId?: string;
  bedId?: string;
  createdAt: string;
  updatedAt: string;
  sourceToken?: string;
  counterStatus?: "new" | "verified" | "sent-to-ward" | "bed-assigned";
}

export const ADMISSION_WORKFLOW_UPDATED_EVENT = "govcare:admission-workflow-updated";

const STORAGE_KEY = "govcare.admissionCounterRequests";

function isBrowser() {
  return typeof window !== "undefined";
}

function emitUpdate() {
  if (isBrowser()) window.dispatchEvent(new Event(ADMISSION_WORKFLOW_UPDATED_EVENT));
}

export function getAdmissionCounterRequests(): AdmissionCounterRequest[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAdmissionCounterRequests(requests: AdmissionCounterRequest[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  emitUpdate();
}

export function addAdmissionCounterRequest(request: AdmissionCounterRequest) {
  const existing = getAdmissionCounterRequests();
  const duplicate = existing.find((item) => item.patientId === request.patientId && !["discharged", "cancelled"].includes(item.status));
  const next = duplicate
    ? existing.map((item) => item.id === duplicate.id ? { ...item, ...request, id: duplicate.id, updatedAt: new Date().toISOString() } : item)
    : [request, ...existing];
  saveAdmissionCounterRequests(next);
  return duplicate ? duplicate.id : request.id;
}

export function updateAdmissionCounterRequest(id: string, patch: Partial<AdmissionCounterRequest>) {
  const now = new Date().toISOString();
  saveAdmissionCounterRequests(getAdmissionCounterRequests().map((item) => item.id === id ? { ...item, ...patch, updatedAt: now } : item));
}
