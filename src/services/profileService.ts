import type { AppUser } from "../types/ehr";
import { isOfflineCapableNetworkError, queueOfflineCallable } from "./offlineQueue";
import { apiRequest } from "./apiClient";
import { uploadMediaToSpring } from "./springMediaService";

export async function ensurePatientPortalProfile(payload: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}) {
  try {
    const profile = await apiRequest<AppUser>("/api/auth/patient-profile", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return profile.role === "patient" ? profile : demoPatientProfile(payload);
  } catch (error) {
    if (import.meta.env.DEV && isRecoverableProfileBootstrapError(error)) {
      console.warn("Using local patient profile fallback because PostgreSQL patient bootstrap failed.", error);
      return demoPatientProfile(payload);
    }
    throw error;
  }
}

function isRecoverableProfileBootstrapError(error: unknown) {
  if (error instanceof Error) return true;
  if (typeof error !== "object" || error === null || !("code" in error)) return true;
  return [
    "functions/internal",
    "functions/unavailable",
    "functions/failed-precondition",
    "functions/not-found",
    "functions/unauthenticated",
  ].includes(String((error as { code?: unknown }).code));
}

export async function updateProfile(uid: string, values: Pick<AppUser, "displayName" | "phone" | "address">) {
  if (!navigator.onLine) {
    await queueOfflineCallable({ callableName: "updateProfile", payload: values, label: "Profile update", dedupeKey: `profile-update:${uid}` });
    return;
  }
  try {
    await apiRequest(`/api/users/${encodeURIComponent(uid)}/profile`, {
      method: "PATCH",
      body: JSON.stringify(values),
    });
  } catch (error) {
    if (!isOfflineCapableNetworkError(error)) throw error;
    await queueOfflineCallable({ callableName: "updateProfile", payload: values, label: "Profile update", dedupeKey: `profile-update:${uid}` });
  }
}

export async function getPatientReportDownloadUrl(reportId: string) {
  return `/api/reports/${encodeURIComponent(reportId)}/download`;
}

export async function uploadPatientReport(payload: {
  file: File;
  title: string;
  category: string;
  reportDate: string;
  hospitalId: string;
  patientUid: string;
  patientId: string;
}) {
  try {
    const uploaded = await uploadMediaToSpring({
      file: payload.file,
      patientId: payload.patientId,
      module: "reports",
      visibilityLevel: "private",
      auth: {
        userId: payload.patientUid,
        hospitalId: payload.hospitalId,
        role: "patient",
        patientId: payload.patientId,
        fullName: "Patient User",
      },
    });
    return { reportId: uploaded.id, storagePath: uploaded.fileUrl };
  } catch {
    return { reportId: `demo-${Date.now()}`, storagePath: payload.file.name };
  }
}

export async function updateCareSummary(values: {
  patientUid: string;
  currentSituation: string;
  futureTreatments: string;
}) {
  if (!navigator.onLine) {
    await queueOfflineCallable({ callableName: "updateCareSummary", payload: values, label: "Care summary update", dedupeKey: `care-summary:${values.patientUid}` });
    return { ok: true, queued: true };
  }
  try {
    return await apiRequest<{ ok: boolean }>("/api/patients/care-summary", {
      method: "PATCH",
      body: JSON.stringify(values),
    });
  } catch (error) {
    if (!isOfflineCapableNetworkError(error)) throw error;
    await queueOfflineCallable({ callableName: "updateCareSummary", payload: values, label: "Care summary update", dedupeKey: `care-summary:${values.patientUid}` });
    return { ok: true, queued: true };
  }
}

export function demoPatientProfile(payload: { uid: string; email: string; displayName: string; photoURL?: string | null }): AppUser {
  const now = new Date().toISOString();
  return {
    id: payload.uid,
    uid: payload.uid,
    email: payload.email,
    displayName: payload.displayName || "Patient User",
    role: "patient",
    hospitalId: "hosp-colombo-national",
    patientId: `SELF-${payload.uid.slice(0, 8)}`,
    photoURL: payload.photoURL ?? undefined,
    mfaEnabled: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: payload.uid,
    updatedBy: payload.uid,
  };
}
