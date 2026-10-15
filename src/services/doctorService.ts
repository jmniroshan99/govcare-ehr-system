import { queueOfflineCallable } from "./offlineQueue";

export type DoctorSessionActionType = "referral" | "discharge_approval" | "follow_up";
export type DoctorSessionActionStatus = "sent" | "approved" | "scheduled" | "queued";

export interface DoctorSessionActionPayload {
  visitId: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  department: string;
  doctorId: string;
  doctorName: string;
  diagnosis: string;
  treatmentPlan: string;
  notes: string;
  followUpDate?: string;
  destination?: string;
  completionStatus?: string;
  actionReason?: string;
  actorRole?: string;
}

export interface DoctorSessionActionRecord extends DoctorSessionActionPayload {
  id: string;
  type: DoctorSessionActionType;
  status: DoctorSessionActionStatus;
  createdAt: string;
  updatedAt: string;
}

const SESSION_ACTIONS_KEY = "govcare-doctor-session-actions";

function readSessionActions() {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SESSION_ACTIONS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is DoctorSessionActionRecord => Boolean(item && typeof item === "object" && "id" in item)) : [];
  } catch {
    return [];
  }
}

function saveSessionAction(action: DoctorSessionActionRecord) {
  if (typeof window === "undefined") return action;
  const current = readSessionActions();
  window.localStorage.setItem(SESSION_ACTIONS_KEY, JSON.stringify([action, ...current].slice(0, 200)));
  window.dispatchEvent(new CustomEvent("govcare:doctor-session-actions-updated", { detail: action }));
  return action;
}

async function persistDoctorSessionAction(input: {
  type: DoctorSessionActionType;
  status: DoctorSessionActionStatus;
  callableName: "sendDoctorReferral" | "approveDoctorDischarge" | "scheduleDoctorFollowUp";
  label: string;
  payload: DoctorSessionActionPayload;
}) {
  const action: DoctorSessionActionRecord = {
    ...input.payload,
    id: `${input.type}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    type: input.type,
    status: navigator.onLine ? input.status : "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveSessionAction(action);
  if (!navigator.onLine) {
    await queueOfflineCallable({
      callableName: input.callableName,
      payload: action as unknown as Record<string, unknown>,
      label: input.label,
      dedupeKey: `${input.callableName}:${input.payload.visitId}:${input.payload.patientId}`,
    });
  }
  return action;
}

export async function saveConsultationDraft(payload: Record<string, string>) {
  const request = {
    patientId: "PAT-2026-000001",
    hospitalId: "hosp-colombo-national",
    ...payload,
  };
  if (!navigator.onLine) {
    await queueOfflineCallable({ callableName: "saveConsultationDraft", payload: request, label: "Consultation draft", dedupeKey: `consultation-draft:${request.patientId}` });
    return { ok: true, queued: true };
  }
  return { ok: true };
}

export async function submitDoctorApproval(payload: { type: string; patientId: string }) {
  void payload;
  return { ok: true };
}

export async function sendDoctorReferral(payload: DoctorSessionActionPayload) {
  return persistDoctorSessionAction({
    type: "referral",
    status: "sent",
    callableName: "sendDoctorReferral",
    label: "Doctor referral",
    payload,
  });
}

export async function approveDoctorDischarge(payload: DoctorSessionActionPayload) {
  return persistDoctorSessionAction({
    type: "discharge_approval",
    status: "approved",
    callableName: "approveDoctorDischarge",
    label: "Doctor discharge approval",
    payload,
  });
}

export async function scheduleDoctorFollowUp(payload: DoctorSessionActionPayload) {
  return persistDoctorSessionAction({
    type: "follow_up",
    status: "scheduled",
    callableName: "scheduleDoctorFollowUp",
    label: "Doctor follow-up appointment",
    payload,
  });
}

export function getDoctorSessionActions(patientId?: string) {
  const actions = readSessionActions();
  return patientId ? actions.filter((action) => action.patientId === patientId) : actions;
}

export async function startDoctorConsultation(payload: { patientId: string; tokenNo: string; reason: string }) {
  void payload;
  return { ok: true, consultationId: `api-consult-${Date.now()}` };
}

export async function createTelemedicineSession(payload: { patientId: string; appointmentId: string; channel: string }) {
  void payload;
  return { ok: true, sessionId: `api-telemed-${Date.now()}`, joinUrl: "https://meet.govcare.local/demo" };
}

export async function sendSecureChatMessage(payload: { patientId: string; message: string; threadId?: string }) {
  const clientMessageId = crypto.randomUUID();
  const request = {
    hospitalId: "hosp-colombo-national",
    ...payload,
    clientMessageId,
  };
  if (!navigator.onLine) {
    await queueOfflineCallable({ callableName: "sendSecureChatMessage", payload: request, label: "Secure care message", dedupeKey: `secure-message:${clientMessageId}` });
    return { ok: true, threadId: payload.threadId ?? `offline-${clientMessageId}`, queued: true };
  }
  return { ok: true, threadId: payload.threadId ?? `thread-${clientMessageId}` };
}
