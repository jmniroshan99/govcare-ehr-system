import { apiRequest } from "./apiClient";
import type { BedSuggestion, InternalTransfer, WardBed, WardDashboardResponse, WardSummary } from "../types/ward";

export function getWardDashboard(hospitalId?: string) {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiRequest<WardDashboardResponse>(`/api/wards/dashboard${query}`);
}

export async function getWards(hospitalId?: string) {
  const query = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return (await apiRequest<{ items: WardSummary[] }>(`/api/wards${query}`)).items;
}

export async function getBeds(filters: { hospitalId?: string; wardId?: string; roomId?: string; status?: string; bedType?: string; availableOnly?: boolean } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  });
  return (await apiRequest<{ items: WardBed[] }>(`/api/beds${params.size ? `?${params}` : ""}`)).items;
}

export function changeBedStatus(bedId: string, status: string, reason?: string) {
  return apiRequest<WardBed>(`/api/beds/${bedId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export async function getBedSuggestions(admissionId: string, requirements: Record<string, unknown>) {
  return (await apiRequest<{ items: BedSuggestion[] }>(`/api/admissions/${admissionId}/bed-suggestions`, {
    method: "POST",
    body: JSON.stringify(requirements),
  })).items;
}

export function reserveAdmissionBed(admissionId: string, bedId: string, priority = "ROUTINE", reservationMinutes = 30) {
  return apiRequest<Record<string, unknown>>(`/api/admissions/${admissionId}/reserve-bed`, {
    method: "POST",
    body: JSON.stringify({ bedId, priority, reservationMinutes }),
  });
}

export function allocateAdmissionBed(admissionId: string, bedId: string) {
  return apiRequest<Record<string, unknown>>(`/api/admissions/${admissionId}/allocate-bed`, {
    method: "POST",
    body: JSON.stringify({ bedId }),
  });
}

export async function getInternalTransfers(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return (await apiRequest<{ items: InternalTransfer[] }>(`/api/transfers/internal${query}`)).items;
}

export function createInternalTransfer(input: {
  admissionId: string;
  destinationWardId: string;
  destinationBedId?: string;
  transferReason: string;
  priority: string;
  clinicalNotes?: string;
  isolationRequired: boolean;
  transportAssistanceRequired: boolean;
}) {
  return apiRequest<InternalTransfer>("/api/transfers/internal", { method: "POST", body: JSON.stringify(input) });
}

export function internalTransferAction(id: string, action: "approve" | "accept" | "start" | "complete") {
  return apiRequest<InternalTransfer>(`/api/transfers/internal/${id}/${action}`, { method: "PATCH", body: "{}" });
}

export function reserveInternalTransferBed(id: string, bedId: string) {
  return apiRequest<InternalTransfer>(`/api/transfers/internal/${id}/reserve-bed`, {
    method: "PATCH",
    body: JSON.stringify({ bedId, reservationMinutes: 60 }),
  });
}

export function cancelInternalTransfer(id: string, reason: string) {
  return apiRequest<InternalTransfer>(`/api/transfers/internal/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}
