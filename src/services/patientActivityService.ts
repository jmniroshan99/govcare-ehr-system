export type PatientActivityType =
  | "Registration"
  | "OPD"
  | "Consultation"
  | "Prescription"
  | "Laboratory"
  | "Radiology"
  | "Admission"
  | "Appointment"
  | "Discharge"
  | "Referral"
  | "Document";

export interface PatientActivityRecord {
  id: string;
  patientId: string;
  hospitalId: string;
  type: PatientActivityType;
  date: string;
  unit: string;
  note: string;
  sourceModule: string;
  createdBy: string;
  createdAt: string;
  status: "active" | "pending" | "completed" | "cancelled";
  linkedRecordId?: string;
}

const STORAGE_KEY = "govcare-patient-activities";
export const PATIENT_ACTIVITIES_UPDATED_EVENT = "govcare:patient-activities-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isActivity(value: unknown): value is PatientActivityRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PatientActivityRecord>;
  return typeof item.id === "string" && typeof item.patientId === "string" && typeof item.type === "string";
}

function readActivities() {
  if (!canUseStorage()) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isActivity) : [];
  } catch {
    return [];
  }
}

function writeActivities(items: PatientActivityRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 1000)));
}

export function addPatientActivity(input: Omit<PatientActivityRecord, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const activity: PatientActivityRecord = {
    ...input,
    id: input.id ?? `ACT-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    createdAt,
    date: input.date || createdAt.slice(0, 10),
  };
  const current = readActivities();
  const next = [activity, ...current.filter((item) => item.id !== activity.id)];
  writeActivities(next);
  window.dispatchEvent(new CustomEvent(PATIENT_ACTIVITIES_UPDATED_EVENT, { detail: { patientId: activity.patientId, activityId: activity.id } }));
  return activity;
}

export function getPatientActivities(patientId: string) {
  return readActivities()
    .filter((item) => item.patientId.trim().toUpperCase() === patientId.trim().toUpperCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
