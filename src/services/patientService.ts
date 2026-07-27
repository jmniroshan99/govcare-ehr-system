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

export type CreatePatientRecordResult = {
  duplicate: boolean;
  patient: {
    id: string;
    patient_no: string;
    full_name: string;
    created_at?: string;
  };
};

function normalizeGender(value?: string) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "male" || normalized === "female" || normalized === "other" || normalized === "prefer_not_to_say") return normalized;
  return undefined;
}

export async function createPatientRecord(input: CreatePatientRecordInput) {
  return apiRequest<CreatePatientRecordResult>("/api/patients", {
    method: "POST",
    body: JSON.stringify({ ...input, gender: normalizeGender(input.gender) }),
  });
}
