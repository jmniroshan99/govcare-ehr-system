import { apiRequest } from "./apiClient";

export type CompleteConsultationInput = {
  patientUuid: string;
  visitUuid: string;
  queueUuid?: string;
  chiefComplaint?: string;
  history?: string;
  examination?: string;
  diagnosis: string;
  icd10Code?: string;
  soapNotes?: Record<string, unknown>;
  treatmentPlan?: string;
  followUpDate?: string;
};

export type ConsultationRecord = {
  id: string;
  patient_id: string;
  visit_id: string;
  diagnosis: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function completePostgresConsultation(input: CompleteConsultationInput) {
  return apiRequest<{ consultation: ConsultationRecord }>("/api/consultations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
