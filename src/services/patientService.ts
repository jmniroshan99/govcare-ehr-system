import { apiRequest } from "./apiClient";

export type CreatePatientRecordInput = {
  patientId: string;
  title?: string;
  fullName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender?: string;
  nic?: string;
  passportNo?: string;
  birthCertificateNo?: string;
  bloodGroup?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  province?: string;
  languagePreference?: string;
  emergencyContact?: Record<string, unknown>;
  allergies?: string[];
  chronicDiseases?: string[];
  disabilities?: string[];
  familyHistory?: string[];
  riskFlags?: string[];
};

// Same shape as create, minus the immutable patientId. Only send fields that actually changed.
export type UpdatePatientRecordInput = Partial<Omit<CreatePatientRecordInput, "patientId">>;

export type PatientRecord = {
  id: string;
  hospital_id: string;
  patient_no: string;
  guardian_id?: string | null;
  nic?: string | null;
  passport_no?: string | null;
  birth_certificate_no?: string | null;
  title?: string | null;
  full_name: string;
  preferred_name?: string | null;
  date_of_birth: string;
  age_years?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  district?: string | null;
  province?: string | null;
  emergency_contact?: Record<string, unknown>;
  language_preference?: string | null;
  allergies?: string[];
  chronic_diseases?: string[];
  disabilities?: string[];
  family_history?: string[];
  risk_flags?: string[];
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreatePatientRecordResult = {
  duplicate: boolean;
  patient: PatientRecord;
};

export type UpdatePatientRecordResult = {
  patient: PatientRecord;
  previous: PatientRecord;
};

function normalizeGender(value?: string) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "male" || normalized === "female" || normalized === "other" || normalized === "prefer_not_to_say") return normalized;
  return undefined;
}

/** Creates a new patient record in PostgreSQL. Used by the patient registration form. */
export async function createPatientRecord(input: CreatePatientRecordInput) {
  return apiRequest<CreatePatientRecordResult>("/api/patients", {
    method: "POST",
    body: JSON.stringify({ ...input, gender: normalizeGender(input.gender) }),
  });
}

/** Fetches one patient's full record by id, e.g. to prefill an edit form. */
export async function getPatientRecord(id: string) {
  return apiRequest<{ patient: PatientRecord }>(`/api/patients/${encodeURIComponent(id)}`);
}

/**
 * Updates an existing patient's details. Only send the fields that changed - the server
 * merges them in. Returns both the updated record and the previous state so the caller can
 * show a diff or generate a "changed details" PDF.
 */
export async function updatePatientRecord(id: string, input: UpdatePatientRecordInput) {
  const body: Record<string, unknown> = { ...input };
  if (input.gender !== undefined) body.gender = normalizeGender(input.gender);
  return apiRequest<UpdatePatientRecordResult>(`/api/patients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Soft-deletes a patient (marks as deleted, keeps the row and audit history). */
export async function deletePatientRecord(id: string) {
  return apiRequest<void>(`/api/patients/${encodeURIComponent(id)}`, { method: "DELETE" });
}
