import { apiRequest } from "./apiClient";

const LOCAL_TOKEN_KEY = "govcare-local-self-registration-tokens";
const LOCAL_SUBMISSION_KEY = "govcare-local-self-registration-submissions";
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
  duplicate: boolean;
  patient: {
    id?: string;
    patient_no?: string;
    patientNo?: string;
    full_name?: string;
    fullName?: string;
    status?: string;
    created_at?: string;
  };
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(SELF_REGISTRATION_UPDATED_EVENT));
}

function localTokens() {
  return readJson<RegistrationTokenInfo[]>(LOCAL_TOKEN_KEY, []);
}

export async function createRegistrationQrToken(label = "Patient self-registration QR"): Promise<RegistrationTokenInfo> {
  try {
    return await apiRequest<RegistrationTokenInfo>("/api/self-registration/tokens", {
      method: "POST",
      body: JSON.stringify({ label, maxUses: 100 }),
    });
  } catch {
    const token = crypto.randomUUID().replaceAll("-", "");
    const info: RegistrationTokenInfo = {
      token,
      registrationUrl: `${window.location.origin}/self-register/${token}`,
      hospitalId: "hosp-colombo-national",
      hospitalName: "GovCare Demo Hospital",
      hospitalCity: "Colombo",
      label,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      usesCount: 0,
      maxUses: 100,
      status: "active",
    };
    writeJson(LOCAL_TOKEN_KEY, [info, ...localTokens()].slice(0, 20));
    return info;
  }
}

export async function getRegistrationQrTokens(): Promise<RegistrationTokenInfo[]> {
  try {
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
  } catch {
    return localTokens();
  }
}

export async function verifyRegistrationToken(token: string): Promise<Omit<RegistrationTokenInfo, "registrationUrl">> {
  try {
    return await apiRequest<Omit<RegistrationTokenInfo, "registrationUrl">>(`/api/self-registration/tokens/${encodeURIComponent(token)}`);
  } catch {
    const info = localTokens().find((item) => item.token === token || item.registrationUrl.endsWith(token));
    if (!info) throw new Error("Invalid registration QR code.");
    if (new Date(info.expiresAt).getTime() < Date.now()) throw new Error("Registration QR code has expired.");
    return info;
  }
}

export async function submitPatientSelfRegistration(token: string, input: PatientSelfRegistrationInput): Promise<PatientSelfRegistrationResult> {
  try {
    return await apiRequest<PatientSelfRegistrationResult>(`/api/self-registration/tokens/${encodeURIComponent(token)}/register`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch {
    const submissions = readJson<PatientSelfRegistrationResult[]>(LOCAL_SUBMISSION_KEY, []);
    const duplicate = submissions.find((item) => {
      const patient = item.patient;
      return patient.fullName?.toLowerCase() === input.fullName.toLowerCase() || patient.full_name?.toLowerCase() === input.fullName.toLowerCase();
    });
    if (duplicate) return { duplicate: true, patient: duplicate.patient };
    const patientNo = `PT-${String(submissions.length + 1).padStart(6, "0")}`;
    const result: PatientSelfRegistrationResult = {
      duplicate: false,
      patient: { patientNo, fullName: input.fullName, status: "pending", created_at: new Date().toISOString() },
    };
    writeJson(LOCAL_SUBMISSION_KEY, [result, ...submissions].slice(0, 100));
    return result;
  }
}

export async function getSelfRegisteredPatients(): Promise<SelfRegisteredPatient[]> {
  try {
    const response = await apiRequest<{ items: SelfRegisteredPatient[] }>("/api/self-registration/submissions");
    return response.items;
  } catch {
    return readJson<PatientSelfRegistrationResult[]>(LOCAL_SUBMISSION_KEY, []).map((item, index) => ({
      id: item.patient.id ?? `local-${index}`,
      patientNo: item.patient.patientNo,
      fullName: item.patient.fullName,
      status: item.patient.status,
      created_at: item.patient.created_at,
    }));
  }
}

export async function approveSelfRegisteredPatient(patientId: string): Promise<SelfRegisteredPatient> {
  try {
    return await apiRequest<SelfRegisteredPatient>(`/api/self-registration/submissions/${patientId}/approve`, { method: "POST" });
  } catch {
    const submissions = readJson<PatientSelfRegistrationResult[]>(LOCAL_SUBMISSION_KEY, []);
    const index = Number(patientId.replace("local-", ""));
    const current = submissions[index]?.patient ?? { patientNo: patientId, fullName: "Local patient" };
    current.status = "active";
    writeJson(LOCAL_SUBMISSION_KEY, submissions);
    return current;
  }
}
