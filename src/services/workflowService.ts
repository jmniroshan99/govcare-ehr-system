import { apiRequest } from "./apiClient";
import type { DoctorQueueRecord } from "./doctorQueueService";
import { normalizeJsonArray, normalizeStringList } from "../utils/dataNormalization";

export type AppointmentReference = {
  departments: Array<{ id: string; code: string; name: string }>;
  doctors: Array<{ id: string; full_name: string; department_id?: string | null; role: string }>;
};

export type AppointmentRecord = {
  id: string;
  appointment_no?: string | null;
  patient_id: string;
  patient_no: string;
  patient_name: string;
  nic?: string | null;
  age_years?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  appointment_type: string;
  scheduled_at: string;
  reason?: string | null;
  priority: "routine" | "urgent" | "stat" | "critical";
  mode?: string | null;
  location?: string | null;
  workflow_status: string;
  checked_in_at?: string | null;
  queue_id?: string | null;
  token_no?: string | null;
  created_at: string;
};

export async function getAppointmentReference() {
  return apiRequest<AppointmentReference>("/api/appointments/reference");
}

export async function getAppointments(filters: { status?: string; date?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.date) params.set("date", filters.date);
  if (filters.search) params.set("search", filters.search);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: AppointmentRecord[] }>(`/api/appointments${suffix}`);
}

export async function createAppointment(input: {
  patientIdentifier: string;
  departmentUuid?: string | null;
  departmentName?: string | null;
  doctorUuid?: string | null;
  scheduledAt: string;
  reason: string;
  appointmentType: string;
  priority: "routine" | "urgent" | "critical";
  mode: "physical" | "video" | "telephone";
  location?: string | null;
}) {
  return apiRequest<{ appointment: AppointmentRecord }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function checkInAppointment(appointmentUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord; reused: boolean }>(`/api/appointments/${encodeURIComponent(appointmentUuid)}/check-in`, {
    method: "PATCH",
  });
}

export async function updateAppointmentStatus(appointmentUuid: string, status: "scheduled" | "confirmed" | "cancelled" | "no_show", reason?: string) {
  return apiRequest<{ appointment: AppointmentRecord }>(`/api/appointments/${encodeURIComponent(appointmentUuid)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export async function callQueuePatient(queueUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/call`, { method: "PATCH" });
}

export async function recallQueuePatient(queueUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/recall`, { method: "PATCH" });
}

export async function markQueueNoShow(queueUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/no-show`, { method: "PATCH" });
}

export async function returnQueueToWaiting(queueUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/return-waiting`, { method: "PATCH" });
}

export async function assignQueueDoctor(queueUuid: string, doctorUuid: string | null) {
  return apiRequest<{ queue: DoctorQueueRecord }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ doctorUuid }),
  });
}

export type ConsultationRecord = {
  id: string;
  hospital_id: string;
  patient_id: string;
  visit_id: string;
  doctor_id: string;
  chief_complaint?: string | null;
  symptoms?: string | null;
  history?: string | null;
  presenting_history?: string | null;
  past_medical_history?: string | null;
  surgical_history?: string | null;
  family_history?: string | null;
  social_history?: string | null;
  allergy_review?: string | null;
  current_medications?: string | null;
  vital_signs?: Record<string, unknown>;
  examination?: string | null;
  diagnosis?: string | null;
  differential_diagnosis?: string | null;
  icd10_code?: string | null;
  soap_notes?: Record<string, unknown>;
  clinical_notes?: string | null;
  treatment_plan?: string | null;
  follow_up_instructions?: string | null;
  follow_up_date?: string | null;
  workflow_status: string;
  started_at?: string | null;
  completed_at?: string | null;
  completion_override_reason?: string | null;
  patient_no: string;
  patient_name: string;
  doctor_name: string;
  visit_no: string;
  created_at: string;
  updated_at: string;
};

export type ConsultationPayload = {
  patientUuid: string;
  visitUuid: string;
  queueUuid?: string;
  consultationUuid?: string;
  chiefComplaint?: string;
  symptoms?: string;
  history?: string;
  presentingHistory?: string;
  pastMedicalHistory?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  socialHistory?: string;
  allergyReview?: string;
  currentMedications?: string;
  vitalSigns?: Record<string, unknown>;
  examination?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  icd10Code?: string;
  soapNotes?: Record<string, unknown>;
  clinicalNotes?: string;
  treatmentPlan?: string;
  followUpInstructions?: string;
  followUpDate?: string;
  completionOverrideReason?: string;
  workflowStatus?: "draft" | "active" | "awaiting_results" | "ready_for_review" | "completed" | "cancelled";
};

export async function getConsultation(consultationUuid: string) {
  return apiRequest<{ consultation: ConsultationRecord }>(`/api/consultations/${encodeURIComponent(consultationUuid)}`);
}

export async function getConsultationByVisit(visitUuid: string) {
  return apiRequest<{ consultation: ConsultationRecord }>(`/api/consultations/visit/${encodeURIComponent(visitUuid)}`);
}

export async function saveConsultation(input: ConsultationPayload) {
  if (input.consultationUuid) {
    const body: Record<string, unknown> = { ...input };
    delete body.consultationUuid;
    delete body.patientUuid;
    delete body.visitUuid;
    return apiRequest<{ consultation: ConsultationRecord }>(`/api/consultations/${encodeURIComponent(input.consultationUuid)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
  return apiRequest<{ consultation: ConsultationRecord }>("/api/consultations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeConsultation(consultationUuid: string, input: Omit<ConsultationPayload, "patientUuid" | "visitUuid" | "consultationUuid" | "workflowStatus">) {
  return apiRequest<{ consultation: ConsultationRecord }>(`/api/consultations/${encodeURIComponent(consultationUuid)}/complete`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}


export type MedicineOption = {
  id: string;
  name: string;
  generic_name?: string | null;
  category?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  available_stock?: string | number | null;
};

export async function getWorkflowMedicines() {
  return apiRequest<{ items: MedicineOption[] }>("/api/prescriptions/medicines");
}

export type PrescriptionLineInput = {
  medicineId?: string | null;
  medicineName: string;
  genericName?: string;
  strength?: string;
  dosage: string;
  route?: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions?: string;
  substitutionAllowed?: boolean;
  notes?: string;
};

export type PrescriptionRecord = {
  id: string;
  prescription_no: string;
  patient_id: string;
  patient_no: string;
  patient_name: string;
  nic?: string | null;
  date_of_birth?: string | null;
  age_years?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  allergies?: string[];
  doctor_id: string;
  doctor_name: string;
  diagnosis?: string | null;
  priority: string;
  digital_signature?: string | null;
  workflow_status: string;
  pharmacy_status: string;
  pharmacist_name?: string | null;
  pharmacy_verified_at?: string | null;
  pharmacy_verification_notes?: string | null;
  dispensed_at?: string | null;
  consultation_id?: string | null;
  visit_id?: string | null;
  lines: Array<PrescriptionLineInput & { id: string; status?: string }>;
  created_at: string;
};

function normalizePrescriptionRecord(record: PrescriptionRecord): PrescriptionRecord {
  return {
    ...record,
    allergies: normalizeStringList(record.allergies),
    lines: normalizeJsonArray<PrescriptionRecord["lines"][number]>(record.lines),
  };
}

export async function createWorkflowPrescription(input: {
  patientUuid: string;
  visitUuid?: string | null;
  consultationUuid?: string | null;
  diagnosis: string;
  priority?: "routine" | "urgent" | "stat" | "critical";
  digitalSignature?: string;
  submitToPharmacy?: boolean;
  lines: PrescriptionLineInput[];
}) {
  const result = await apiRequest<{ prescription: PrescriptionRecord }>("/api/prescriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { ...result, prescription: normalizePrescriptionRecord(result.prescription) };
}

export async function getWorkflowPrescriptions(filters: { status?: string; patientUuid?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.patientUuid) params.set("patientUuid", filters.patientUuid);
  const suffix = params.size ? `?${params.toString()}` : "";
  const result = await apiRequest<{ items: PrescriptionRecord[] }>(`/api/prescriptions${suffix}`);
  return { ...result, items: normalizeJsonArray<PrescriptionRecord>(result.items).map(normalizePrescriptionRecord) };
}

export async function getPharmacyPrescriptions(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await apiRequest<{ items: PrescriptionRecord[] }>(`/api/pharmacy/prescriptions${suffix}`);
  return { ...result, items: normalizeJsonArray<PrescriptionRecord>(result.items).map(normalizePrescriptionRecord) };
}

export async function verifyPharmacyPrescription(prescriptionUuid: string, status: "verified" | "rejected", notes?: string) {
  const result = await apiRequest<{ prescription: PrescriptionRecord }>(`/api/pharmacy/prescriptions/${encodeURIComponent(prescriptionUuid)}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
  return { ...result, prescription: normalizePrescriptionRecord(result.prescription) };
}

export async function dispensePharmacyPrescription(prescriptionUuid: string, items: Array<{ prescriptionItemUuid: string; medicineUuid?: string | null; quantity: number }>, notes?: string) {
  const result = await apiRequest<{ prescription: PrescriptionRecord; receipt: { id: string; receiptNo: string } }>(`/api/pharmacy/prescriptions/${encodeURIComponent(prescriptionUuid)}/dispense`, {
    method: "PATCH",
    body: JSON.stringify({ items, notes }),
  });
  return { ...result, prescription: normalizePrescriptionRecord(result.prescription) };
}

export type LaboratoryOrderRecord = {
  id: string;
  patient_id: string;
  visit_id?: string | null;
  consultation_id?: string | null;
  patient_no: string;
  patient_name: string;
  test_type: string;
  test_code?: string | null;
  specimen?: string | null;
  priority: string;
  clinical_reason?: string | null;
  instructions?: string | null;
  workflow_status: string;
  requested_by_name?: string | null;
  result_id?: string | null;
  numeric_result?: number | null;
  text_result?: string | null;
  unit?: string | null;
  reference_range?: string | null;
  classification?: string | null;
  abnormal_flag?: boolean | null;
  critical_flag?: boolean | null;
  created_at: string;
};

export async function createLaboratoryOrders(input: {
  patientUuid: string;
  visitUuid?: string | null;
  consultationUuid?: string | null;
  priority: "routine" | "urgent" | "stat" | "critical";
  clinicalIndication: string;
  items: Array<{ testCatalogId?: string; testName: string; testCode?: string; specimen?: string; instructions?: string }>;
}) {
  return apiRequest<{ items: LaboratoryOrderRecord[] }>("/api/laboratory/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getLaboratoryOrders(filters: { status?: string; patientUuid?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.patientUuid) params.set("patientUuid", filters.patientUuid);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: LaboratoryOrderRecord[] }>(`/api/laboratory/orders${suffix}`);
}

export async function updateLaboratoryOrderStatus(orderUuid: string, status: string, notes?: string) {
  return apiRequest<{ order: LaboratoryOrderRecord }>(`/api/laboratory/orders/${encodeURIComponent(orderUuid)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export async function enterLaboratoryResult(orderUuid: string, input: {
  numericResult?: number | null;
  textResult?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  classification: "normal" | "abnormal" | "critical";
  resultData?: Record<string, unknown>;
  reportUrl?: string | null;
}) {
  return apiRequest<{ result: { id: string } }>(`/api/laboratory/orders/${encodeURIComponent(orderUuid)}/results`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyLaboratoryResult(resultUuid: string, release = true, notes?: string) {
  return apiRequest<{ result: { id: string } }>(`/api/laboratory/results/${encodeURIComponent(resultUuid)}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ release, notes }),
  });
}

export async function reviewLaboratoryResult(resultUuid: string) {
  return apiRequest<{ result: { id: string } }>(`/api/laboratory/results/${encodeURIComponent(resultUuid)}/review`, { method: "PATCH" });
}

export type RadiologyOrderRecord = {
  id: string;
  patient_id: string;
  visit_id?: string | null;
  consultation_id?: string | null;
  patient_no: string;
  patient_name: string;
  imaging_type: string;
  body_area?: string | null;
  priority: string;
  clinical_reason?: string | null;
  contrast_required?: boolean;
  pregnancy_warning?: boolean;
  instructions?: string | null;
  workflow_status: string;
  requested_by_name?: string | null;
  report_id?: string | null;
  findings?: string | null;
  impression?: string | null;
  classification?: string | null;
  created_at: string;
};

export async function createRadiologyOrders(input: {
  patientUuid: string;
  visitUuid?: string | null;
  consultationUuid?: string | null;
  priority: "routine" | "urgent" | "stat" | "critical";
  clinicalIndication: string;
  items: Array<{ studyCatalogId?: string; imagingType: string; bodyArea?: string; contrastRequired?: boolean; pregnancyWarning?: boolean; instructions?: string }>;
}) {
  return apiRequest<{ items: RadiologyOrderRecord[] }>("/api/radiology/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getRadiologyOrders(filters: { status?: string; patientUuid?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.patientUuid) params.set("patientUuid", filters.patientUuid);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<{ items: RadiologyOrderRecord[] }>(`/api/radiology/orders${suffix}`);
}

export async function updateRadiologyOrderStatus(orderUuid: string, status: string, options: { scheduledAt?: string; room?: string; notes?: string } = {}) {
  return apiRequest<{ order: RadiologyOrderRecord }>(`/api/radiology/orders/${encodeURIComponent(orderUuid)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...options }),
  });
}

export async function enterRadiologyReport(orderUuid: string, input: {
  findings: string;
  impression: string;
  classification: "normal" | "abnormal" | "critical";
  imageUrls?: string[];
  reportUrl?: string | null;
}) {
  return apiRequest<{ report: { id: string } }>(`/api/radiology/orders/${encodeURIComponent(orderUuid)}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyRadiologyReport(reportUuid: string, release = true, notes?: string) {
  return apiRequest<{ report: { id: string } }>(`/api/radiology/reports/${encodeURIComponent(reportUuid)}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ release, notes }),
  });
}

export async function reviewRadiologyReport(reportUuid: string) {
  return apiRequest<{ report: { id: string } }>(`/api/radiology/reports/${encodeURIComponent(reportUuid)}/review`, { method: "PATCH" });
}

export type DoctorCommandCenterData = {
  stats: {
    waiting?: number;
    called?: number;
    checking?: number;
    completed_today?: number;
    appointments_today?: number;
    pending_lab_review?: number;
    pending_radiology_review?: number;
    pharmacy_pending?: number;
  };
  queue: DoctorQueueRecord[];
  appointments: AppointmentRecord[];
  pendingLabResults: LaboratoryOrderRecord[];
  pendingRadiologyReports: RadiologyOrderRecord[];
  pharmacyPrescriptions: PrescriptionRecord[];
};

export async function getDoctorCommandCenter() {
  return apiRequest<DoctorCommandCenterData>("/api/doctor-command-center");
}
