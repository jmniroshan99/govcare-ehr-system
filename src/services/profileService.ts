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
  const profile = await apiRequest<AppUser>("/api/auth/patient-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (profile.role !== "patient" && profile.role !== "guardian") {
    throw new Error("This account does not have patient portal access.");
  }
  return profile;
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
