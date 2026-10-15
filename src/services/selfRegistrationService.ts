import { apiRequest } from "./apiClient";

export const SELF_REGISTRATION_UPDATED_EVENT = "govcare:self-registration-updated";

export interface RegistrationTokenInfo {
  token?: string;
  id?: string;
  registrationUrl: string;
  hospitalId?: string;
  hospitalName: string;
  hospitalCity?: string;
  label?: string;
  expiresAt: string;
  usesCount?: number;
  maxUses?: number;
  status?: string;
}

export interface PatientSelfRegistrationInput {
  fullName: string;
  nic?: string;
  passportNo?: string;
  dateOfBirth: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say" | "";
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  province?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicDiseases?: string;
  languagePreference: "en" | "si" | "ta";
}

export interface PatientSelfRegistrationResult {
  submitted: boolean;
}

export interface SelfRegisteredPatient {
  id?: string;
  patient_no?: string;
  patientNo?: string;
  full_name?: string;
  fullName?: string;
  nic?: string;
  passport_no?: string;
  phone?: string;
  gender?: string;
  status?: string;
  created_at?: string;
}

function updated() {
  window.dispatchEvent(new CustomEvent(SELF_REGISTRATION_UPDATED_EVENT));
}

export async function createRegistrationQrToken(label = "Patient self-registration QR"): Promise<RegistrationTokenInfo> {
  const token = await apiRequest<RegistrationTokenInfo>("/api/self-registration/tokens", {
    method: "POST",
    body: JSON.stringify({ label, maxUses: 100 }),
  });
  updated();
  return token;
}

export async function getRegistrationQrTokens(): Promise<RegistrationTokenInfo[]> {
  const response = await apiRequest<{ items: Array<{ label?: string; hospital_name: string; expires_at: string; uses_count: number; max_uses: number; status: string }> }>("/api/self-registration/tokens");
  return response.items.map((item) => ({
    registrationUrl: "",
    hospitalName: item.hospital_name,
    label: item.label,
    expiresAt: item.expires_at,
    usesCount: item.uses_count,
    maxUses: item.max_uses,
    status: item.status,
  }));
}

export function verifyRegistrationToken(token: string): Promise<Omit<RegistrationTokenInfo, "registrationUrl">> {
  return apiRequest<Omit<RegistrationTokenInfo, "registrationUrl">>(`/api/self-registration/tokens/${encodeURIComponent(token)}`);
}

export async function submitPatientSelfRegistration(token: string, input: PatientSelfRegistrationInput): Promise<PatientSelfRegistrationResult> {
  const result = await apiRequest<PatientSelfRegistrationResult>(`/api/self-registration/tokens/${encodeURIComponent(token)}/register`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  updated();
  return result;
}

export async function getSelfRegisteredPatients(): Promise<SelfRegisteredPatient[]> {
  const response = await apiRequest<{ items: SelfRegisteredPatient[] }>("/api/self-registration/submissions");
  return response.items;
}

export async function approveSelfRegisteredPatient(patientId: string): Promise<SelfRegisteredPatient> {
  const patient = await apiRequest<SelfRegisteredPatient>(`/api/self-registration/submissions/${patientId}/approve`, { method: "POST" });
  updated();
  return patient;
}
