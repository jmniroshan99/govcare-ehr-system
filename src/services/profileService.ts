import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { auth, db, functions, storage } from "../lib/firebase";
import type { AppUser } from "../types/ehr";
import { isOfflineCapableNetworkError, queueOfflineCallable } from "./offlineQueue";

export async function ensurePatientPortalProfile(payload: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}) {
  if (!functions) {
    return demoPatientProfile(payload);
  }
  const callable = httpsCallable(functions, "ensurePatientPortalProfile");
  try {
    const { data } = await callable(payload);
    await auth?.currentUser?.getIdToken(true);
    return data as AppUser;
  } catch (error) {
    if (import.meta.env.DEV && isRecoverableProfileBootstrapError(error)) {
      console.warn("Using local patient profile fallback because ensurePatientPortalProfile failed.", error);
      return demoPatientProfile(payload);
    }
    throw error;
  }
}

function isRecoverableProfileBootstrapError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return [
    "functions/internal",
    "functions/unavailable",
    "functions/failed-precondition",
    "functions/not-found",
    "functions/unauthenticated",
  ].includes(String((error as { code?: unknown }).code));
}

export async function updateProfile(uid: string, values: Pick<AppUser, "displayName" | "phone" | "address">) {
  if (functions) {
    if (!navigator.onLine) {
      await queueOfflineCallable({ callableName: "updateProfile", payload: values, label: "Profile update", dedupeKey: `profile-update:${uid}` });
      return;
    }
    try {
      const callable = httpsCallable(functions, "updateProfile");
      await callable(values);
    } catch (error) {
      if (!isOfflineCapableNetworkError(error)) throw error;
      await queueOfflineCallable({ callableName: "updateProfile", payload: values, label: "Profile update", dedupeKey: `profile-update:${uid}` });
    }
    return;
  }
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    ...values,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function getPatientReportDownloadUrl(reportId: string) {
  if (!functions) return `/sample-report-${reportId}.pdf`;
  const callable = httpsCallable(functions, "getPatientReportDownloadUrl");
  const { data } = await callable({ reportId });
  return (data as { url: string }).url;
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
  if (!storage || !functions) {
    return { reportId: `demo-${Date.now()}`, storagePath: payload.file.name };
  }
  const cleanName = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `hospitals/${payload.hospitalId}/patients/${payload.patientUid}/uploads/${Date.now()}-${cleanName}`;
  await uploadBytes(ref(storage, storagePath), payload.file, {
    contentType: payload.file.type || "application/octet-stream",
    customMetadata: {
      patientUid: payload.patientUid,
      patientId: payload.patientId,
      category: payload.category,
    },
  });
  const callable = httpsCallable(functions, "registerPatientUploadedReport");
  const { data } = await callable({
    title: payload.title,
    category: payload.category,
    reportDate: payload.reportDate,
    hospitalId: payload.hospitalId,
    patientUid: payload.patientUid,
    patientId: payload.patientId,
    storagePath,
  });
  return data as { reportId: string; storagePath: string };
}

export async function updateCareSummary(values: {
  patientUid: string;
  currentSituation: string;
  futureTreatments: string;
}) {
  if (!functions || !navigator.onLine) {
    await queueOfflineCallable({ callableName: "updateCareSummary", payload: values, label: "Care summary update", dedupeKey: `care-summary:${values.patientUid}` });
    return { ok: true, queued: true };
  }
  try {
    const callable = httpsCallable(functions, "updateCareSummary");
    const { data } = await callable(values);
    return data as { ok: boolean };
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
