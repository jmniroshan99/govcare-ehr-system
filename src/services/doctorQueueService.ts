import { apiRequest } from "./apiClient";
import type { SelectedPatientContext } from "../stores/selectedPatientStore";

export type DoctorQueueRecord = {
  queue_id: string;
  token_no: string;
  queue_status: string;
  priority: "routine" | "urgent" | "stat" | "critical";
  estimated_wait_minutes?: number | null;
  called_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  no_show_at?: string | null;
  created_at: string;
  updated_at: string;
  department_id?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  patient_id: string;
  patient_no: string;
  full_name: string;
  nic?: string | null;
  date_of_birth?: string | null;
  age_years?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  phone?: string | null;
  profile_photo_url?: string | null;
  allergies?: string[];
  chronic_diseases?: string[];
  risk_flags?: string[];
  visit_id: string;
  visit_no?: string | null;
  visit_type?: string | null;
  reason?: string | null;
  appointment_id?: string | null;
  appointment_no?: string | null;
  scheduled_at?: string | null;
  consultation_id?: string | null;
  consultation_status?: string | null;
  hospital_id: string;
  verified: boolean;
};

export async function getDoctorQueue(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ items: DoctorQueueRecord[] }>(`/api/doctor-queue${suffix}`);
}

export async function startDoctorQueueCheck(queueUuid: string) {
  return apiRequest<{ queue: DoctorQueueRecord; consultationId: string }>(`/api/doctor-queue/${encodeURIComponent(queueUuid)}/start`, {
    method: "PATCH",
  });
}

export async function createDoctorQueueEntry(input: {
  identifier: string;
  departmentUuid?: string | null;
  departmentName?: string | null;
  doctorUuid?: string | null;
  appointmentUuid?: string | null;
  reason: string;
  priority?: "routine" | "urgent" | "critical";
  visitType?: "walk-in" | "appointment" | "follow-up" | "emergency";
}) {
  return apiRequest<{ queue: DoctorQueueRecord }>("/api/doctor-queue", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function queueRecordToSelectedPatient(queue: DoctorQueueRecord): SelectedPatientContext {
  return {
    patientUuid: queue.patient_id,
    patientNo: queue.patient_no,
    fullName: queue.full_name,
    nic: queue.nic,
    dateOfBirth: queue.date_of_birth,
    age: queue.age_years,
    gender: queue.gender,
    bloodGroup: queue.blood_group,
    phone: queue.phone,
    photoUrl: queue.profile_photo_url,
    allergies: Array.isArray(queue.allergies) ? queue.allergies : [],
    chronicDiseases: Array.isArray(queue.chronic_diseases) ? queue.chronic_diseases : [],
    riskFlags: Array.isArray(queue.risk_flags) ? queue.risk_flags : [],
    queueUuid: queue.queue_id,
    tokenNo: queue.token_no,
    visitUuid: queue.visit_id,
    consultationUuid: queue.consultation_id ?? undefined,
    appointmentUuid: queue.appointment_id ?? undefined,
    appointmentNo: queue.appointment_no ?? undefined,
    visitType: queue.visit_type ?? undefined,
    hospitalId: queue.hospital_id,
    departmentId: queue.department_id,
    departmentName: queue.department_name,
    reason: queue.reason,
    verified: queue.verified && Boolean(queue.patient_id),
  };
}
