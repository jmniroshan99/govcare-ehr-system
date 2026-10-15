import { apiDownload, apiRequest } from "./apiClient";
import type { InterHospitalTransfer } from "../types/transfer";

export async function getInterHospitalTransfers(direction: "all" | "incoming" | "outgoing" = "all", status?: string) {
  const path = direction === "all" ? "/api/transfers/inter-hospital" : `/api/transfers/inter-hospital/${direction}`;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return (await apiRequest<{ items: InterHospitalTransfer[] }>(`${path}${query}`)).items;
}

export function createInterHospitalTransfer(input: Record<string, unknown>) {
  return apiRequest<InterHospitalTransfer>("/api/transfers/inter-hospital", { method: "POST", body: JSON.stringify(input) });
}

export function interHospitalTransferAction(id: string, action: "submit" | "accept" | "depart" | "arrive" | "confirm-admission" | "complete") {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/${action}`, { method: "PATCH", body: "{}" });
}

export function rejectInterHospitalTransfer(id: string, reason: string) {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

export function requestTransferInformation(id: string, requestedInformation: string) {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/request-information`, { method: "PATCH", body: JSON.stringify({ requestedInformation }) });
}

export function reserveInterHospitalBed(id: string, bedId: string) {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/reserve-bed`, { method: "PATCH", body: JSON.stringify({ bedId, reservationMinutes: 180 }) });
}

export function scheduleTransferTransport(id: string, input: Record<string, unknown>) {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/schedule-transport`, { method: "PATCH", body: JSON.stringify(input) });
}

export function cancelInterHospitalTransfer(id: string, reason: string) {
  return apiRequest<InterHospitalTransfer>(`/api/transfers/inter-hospital/${id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) });
}

export function downloadTransferPackage(id: string) {
  return apiDownload(`/api/transfers/inter-hospital/${id}/transfer-package`);
}
