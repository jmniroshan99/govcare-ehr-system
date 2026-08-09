import { apiRequest } from "./apiClient";
import type { PatientRecord } from "./patientService";
import type { WardBed, WardSummary } from "../types/ward";

export type AdmissionPriority = "routine" | "urgent" | "emergency" | "critical";
export type AdmissionType = "EMERGENCY" | "ELECTIVE" | "TRANSFER" | "OBSERVATION" | "MATERNITY" | "ICU";

export type AdmissionReference = {
  hospital: { id: string; code: string; name: string; city?: string; district?: string };
  departments: Array<{ id: string; code: string; name: string; type?: string; floor?: string }>;
  doctors: Array<{ id: string; fullName: string; role: string; departmentId?: string; departmentName?: string }>;
};

export type ActiveAdmission = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  profilePhotoUrl?: string | null;
  nic?: string | null;
  passportNumber?: string | null;
  dateOfBirth?: string | null;
  ageYears?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  allergies?: string[];
  riskFlags?: string[];
  admissionNumber: string;
  admissionType: AdmissionType;
  reason: string;
  presentingComplaint?: string | null;
  provisionalDiagnosis?: string | null;
  priority: string;
  isolationRequired: boolean;
  specialNursingRequirement?: string | null;
  admissionNotes?: string | null;
  status: string;
  admittedAt: string;
  dischargedAt?: string | null;
  dischargeReason?: string | null;
  wardId?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  wardType?: string | null;
  bedId?: string | null;
  bedCode?: string | null;
  bedNumber?: string | null;
  roomNumber?: string | null;
  roomName?: string | null;
  admittingDoctorId?: string | null;
  admittingDoctor?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  identityConfirmedAt?: string | null;
  identityConfirmedBy?: string | null;
};

export type IdentityConfirmation = {
  confirmed: boolean;
  confirmationId: string;
  expiresAt: string;
  confirmedAt: string;
  confirmedBy: string;
  patient: PatientRecord & {
    patientNumber?: string;
    fullName?: string;
    dateOfBirth?: string;
    ageYears?: number;
    bloodGroup?: string;
    profilePhotoUrl?: string;
    riskFlags?: string[];
  };
  activeAdmission: ActiveAdmission | null;
};

export type WardPatient = {
  id: string;
  patientNumber: string;
  patientName: string;
  profilePhotoUrl?: string | null;
  dateOfBirth?: string | null;
  ageYears?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  allergies?: string[];
  riskFlags?: string[];
  chronicDiseases?: string[];
  admissionId: string;
  admissionNumber: string;
  admittedAt: string;
  priority: string;
  admissionReason?: string;
  provisionalDiagnosis?: string;
  isolationRequired: boolean;
  wardId: string;
  wardCode: string;
  wardName: string;
  bedId: string;
  bedCode: string;
  bedNumber: string;
  roomNumber?: string | null;
  responsibleDoctor?: string | null;
  latestVitalStatus?: string;
  latestVitals?: Record<string, unknown>;
};

export async function getAdmissionReference() {
  return apiRequest<AdmissionReference>("/api/admissions/reference");
}

export async function getAdmissions(filters: { status?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  return apiRequest<{ items: ActiveAdmission[] }>(`/api/admissions${params.size ? `?${params}` : ""}`);
}

export async function getAdmission(admissionId: string) {
  return apiRequest<{ admission: ActiveAdmission }>(`/api/admissions/${encodeURIComponent(admissionId)}`);
}

export async function getActiveAdmission(patientIdentifier: string) {
  return apiRequest<{ active: boolean; admission: ActiveAdmission | null }>(`/api/patients/${encodeURIComponent(patientIdentifier)}/active-admission`);
}

export async function confirmPatientIdentity(patientIdentifier: string, expectedWardId?: string, expectedBedId?: string) {
  return apiRequest<IdentityConfirmation>("/api/patients/confirm-identity", {
    method: "POST",
    body: JSON.stringify({ patientIdentifier, expectedWardId: expectedWardId || null, expectedBedId: expectedBedId || null }),
  });
}

export async function getAdmissionWards() {
  const response = await apiRequest<{ items: WardSummary[] }>("/api/wards");
  return response.items;
}

export async function getAvailableWardBeds(wardId: string, filters: { bedType?: string; isolationRequired?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.bedType) params.set("bedType", filters.bedType);
  if (filters.isolationRequired) params.set("isolationRequired", "true");
  const response = await apiRequest<{ items: WardBed[] }>(`/api/wards/${encodeURIComponent(wardId)}/available-beds${params.size ? `?${params}` : ""}`);
  return response.items;
}

export async function getWardAdmittedPatients(wardId: string) {
  const response = await apiRequest<{ items: WardPatient[] }>(`/api/wards/${encodeURIComponent(wardId)}/admitted-patients`);
  return response.items;
}

export async function createAdmission(input: {
  patientId: string;
  identityConfirmationId: string;
  wardId: string;
  bedId: string;
  visitId?: string | null;
  referringDepartmentId?: string | null;
  admittingDoctorId?: string | null;
  admissionType: AdmissionType;
  admissionReason: string;
  presentingComplaint?: string;
  provisionalDiagnosis?: string;
  priority: AdmissionPriority;
  isolationRequired: boolean;
  specialNursingRequirement?: string;
  admissionNotes?: string;
}) {
  return apiRequest<{ admission: ActiveAdmission }>("/api/admissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function transferAdmission(admissionId: string, input: { wardId: string; bedId: string; reason: string; isolationRequired: boolean }) {
  return apiRequest<{ admission: ActiveAdmission }>(`/api/admissions/${encodeURIComponent(admissionId)}/transfer`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function dischargeAdmission(admissionId: string, reason: string, notes?: string) {
  return apiRequest<{ admission: ActiveAdmission }>(`/api/admissions/${encodeURIComponent(admissionId)}/discharge`, {
    method: "POST",
    body: JSON.stringify({ reason, notes }),
  });
}
