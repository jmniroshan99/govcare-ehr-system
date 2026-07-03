import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { isOfflineCapableNetworkError, queueOfflineCallable } from "./offlineQueue";

export async function saveConsultationDraft(payload: Record<string, string>) {
  const request = {
    patientId: "PAT-2026-000001",
    hospitalId: "hosp-colombo-national",
    ...payload,
  };
  if (!functions || !navigator.onLine) {
    await queueOfflineCallable({ callableName: "saveConsultationDraft", payload: request, label: "Consultation draft", dedupeKey: `consultation-draft:${request.patientId}` });
    return { ok: true, queued: true };
  }
  try {
    const callable = httpsCallable(functions, "saveConsultationDraft");
    const { data } = await callable(request);
    return data as { ok: boolean };
  } catch (error) {
    if (!isOfflineCapableNetworkError(error)) throw error;
    await queueOfflineCallable({ callableName: "saveConsultationDraft", payload: request, label: "Consultation draft", dedupeKey: `consultation-draft:${request.patientId}` });
    return { ok: true, queued: true };
  }
}

export async function submitDoctorApproval(payload: { type: string; patientId: string }) {
  if (!functions) return { ok: true };
  const callable = httpsCallable(functions, "submitDoctorApproval");
  const { data } = await callable({
    hospitalId: "hosp-colombo-national",
    ...payload,
  });
  return data as { ok: boolean };
}

export async function startDoctorConsultation(payload: { patientId: string; tokenNo: string; reason: string }) {
  if (!functions) return { ok: true, consultationId: `demo-consult-${Date.now()}` };
  const callable = httpsCallable(functions, "startDoctorConsultation");
  const { data } = await callable({
    hospitalId: "hosp-colombo-national",
    ...payload,
  });
  return data as { ok: boolean; consultationId: string };
}

export async function createTelemedicineSession(payload: { patientId: string; appointmentId: string; channel: string }) {
  if (!functions) return { ok: true, sessionId: `demo-telemed-${Date.now()}`, joinUrl: "https://meet.govcare.local/demo" };
  const callable = httpsCallable(functions, "createTelemedicineSession");
  const { data } = await callable({
    hospitalId: "hosp-colombo-national",
    ...payload,
  });
  return data as { ok: boolean; sessionId: string; joinUrl: string };
}

export async function sendSecureChatMessage(payload: { patientId: string; message: string; threadId?: string }) {
  const clientMessageId = crypto.randomUUID();
  const request = {
    hospitalId: "hosp-colombo-national",
    ...payload,
    clientMessageId,
  };
  if (!functions || !navigator.onLine) {
    await queueOfflineCallable({ callableName: "sendSecureChatMessage", payload: request, label: "Secure care message", dedupeKey: `secure-message:${clientMessageId}` });
    return { ok: true, threadId: payload.threadId ?? `offline-${clientMessageId}`, queued: true };
  }
  try {
    const callable = httpsCallable(functions, "sendSecureChatMessage");
    const { data } = await callable(request);
    return data as { ok: boolean; threadId: string };
  } catch (error) {
    if (!isOfflineCapableNetworkError(error)) throw error;
    await queueOfflineCallable({ callableName: "sendSecureChatMessage", payload: request, label: "Secure care message", dedupeKey: `secure-message:${clientMessageId}` });
    return { ok: true, threadId: payload.threadId ?? `offline-${clientMessageId}`, queued: true };
  }
}
