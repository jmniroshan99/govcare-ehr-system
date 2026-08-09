import { resolveAgeYears } from "../utils/age";
import { apiRequest } from "./apiClient";

export type CreatePatientRecordInput = {
  patientId?: string;
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
  profilePhotoUrl?: string;
  languagePreference?: string;
  emergencyContact?: Record<string, unknown>;
  allergies?: string[];
  chronicDiseases?: string[];
  disabilities?: string[];
  familyHistory?: string[];
  riskFlags?: string[];
};

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
  profile_photo_url?: string | null;
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
  ward_id?: string | null;
  ward_code?: string | null;
  ward_name?: string | null;
  bed_id?: string | null;
  bed_code?: string | null;
  admission_id?: string | null;
  admission_no?: string | null;
  admitted_at?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type PatientIdentificationWard = {
  id: string;
  wardCode: string;
  wardName: string;
  wardType: string;
  activePatientCount: number;
  availableBeds: number;
  status: string;
};

export type DuplicatePatientCheckInput = {
  nic?: string;
  passportNo?: string;
  birthCertificateNo?: string;
  phone?: string;
  fullName?: string;
  dateOfBirth?: string;
  email?: string;
};

export type DuplicatePatientCheckResult = {
  duplicate: boolean;
  possibleMatch: boolean;
  matchedBy: string[];
  patient: PatientRecord | null;
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

function normalizePatientRecord(patient: PatientRecord): PatientRecord {
  const calculatedAge = resolveAgeYears(patient.date_of_birth, patient.age_years);
  return { ...patient, age_years: calculatedAge ?? null };
}

export async function checkPatientDuplicate(input: DuplicatePatientCheckInput) {
  const result = await apiRequest<DuplicatePatientCheckResult>("/api/patients/duplicate-check", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { ...result, patient: result.patient ? normalizePatientRecord(result.patient) : null };
}

export async function createPatientRecord(input: CreatePatientRecordInput) {
  const result = await apiRequest<CreatePatientRecordResult>("/api/patients", {
    method: "POST",
    body: JSON.stringify({ ...input, gender: normalizeGender(input.gender) }),
  });
  return { ...result, patient: normalizePatientRecord(result.patient) };
}

export async function getPatientRecord(id: string) {
  const result = await apiRequest<{ patient: PatientRecord }>(`/api/patients/${encodeURIComponent(id)}`);
  return { patient: normalizePatientRecord(result.patient) };
}

export async function updatePatientRecord(id: string, input: UpdatePatientRecordInput) {
  const body: Record<string, unknown> = { ...input };
  if (input.gender !== undefined) body.gender = normalizeGender(input.gender);
  const result = await apiRequest<UpdatePatientRecordResult>(`/api/patients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return {
    patient: normalizePatientRecord(result.patient),
    previous: normalizePatientRecord(result.previous),
  };
}

export async function deletePatientRecord(id: string) {
  return apiRequest<void>(`/api/patients/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getPatientIdentificationWards() {
  const result = await apiRequest<{ items: PatientIdentificationWard[] }>("/api/patients/identification-wards");
  return result.items;
}

/** Searches all patients, or only active patients in the selected ward. */
export async function searchPatientRecords(search = "", wardId?: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (wardId) params.set("wardId", wardId);
  const result = await apiRequest<{ items: PatientRecord[] }>(`/api/patients${params.size ? `?${params}` : ""}`);
  return { items: result.items.map(normalizePatientRecord) };
}
