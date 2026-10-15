export type PatientDocumentType =
  | "PATIENT_REGISTRATION"
  | "PATIENT_ID_CARD"
  | "CONSULTATION_REPORT"
  | "PRESCRIPTION"
  | "PHARMACY_DISPENSING_REPORT"
  | "LABORATORY_REQUEST"
  | "LABORATORY_RESULT"
  | "RADIOLOGY_REQUEST"
  | "RADIOLOGY_RESULT"
  | "ADMISSION_REPORT"
  | "DISCHARGE_SUMMARY"
  | "NURSING_REPORT"
  | "EMERGENCY_REPORT"
  | "OPERATION_THEATRE_REPORT"
  | "REFERRAL_LETTER"
  | "CONSENT_FORM"
  | "MEDICAL_CERTIFICATE"
  | "OTHER_CLINICAL_DOCUMENT";

export type PatientDocumentStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "CANCELLED" | "ARCHIVED";
export type PatientReleaseStatus = "NOT_RELEASED" | "RELEASED_TO_PATIENT" | "WITHHELD" | "REVOKED";
export type DocumentVisibility = "PRIVATE" | "DEPARTMENT" | "CARE_TEAM" | "ADMINISTRATIVE" | "PATIENT_RELEASED";

export interface PatientDocument {
  id: string;
  hospitalId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  encounterId?: string;
  consultationId?: string;
  prescriptionId?: string;
  laboratoryRequestId?: string;
  radiologyRequestId?: string;
  admissionId?: string;
  sourceDepartmentId?: string;
  sourceDepartmentName?: string;
  documentType: PatientDocumentType;
  title: string;
  description?: string;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum?: string;
  documentStatus: PatientDocumentStatus;
  patientReleaseStatus: PatientReleaseStatus;
  visibilityLevel: DocumentVisibility;
  createdBy: string;
  createdByName?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  releasedAt?: string;
  archivedAt?: string;
}

export interface DocumentAuditEntry {
  id: string;
  action: string;
  result: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  accessedAt: string;
  userName?: string;
  departmentName?: string;
}

export interface DepartmentDocumentAccess {
  id: string;
  departmentId: string;
  departmentName: string;
  accessType: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  grantedByName?: string;
}

export interface PatientTimelineEvent {
  eventAt: string;
  eventType: string;
  department?: string;
  staffName?: string;
  title: string;
  documentId?: string;
}

export interface DepartmentRequest {
  id: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  requestModule: string;
  requestType: string;
  priority: string;
  workflowStatus: string;
  createdAt: string;
  requestedByName?: string;
}

export interface PatientDocumentFilters {
  search?: string;
  documentType?: PatientDocumentType | "";
  status?: PatientDocumentStatus | "";
  releaseStatus?: PatientReleaseStatus | "";
  departmentId?: string;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
}

export interface UploadPatientDocumentInput {
  patientId: string;
  file: File;
  documentType: PatientDocumentType;
  title?: string;
  description?: string;
  status?: "DRAFT" | "SUBMITTED";
  visibilityLevel?: Exclude<DocumentVisibility, "PATIENT_RELEASED">;
  encounterId?: string;
  consultationId?: string;
  prescriptionId?: string;
  laboratoryRequestId?: string;
  radiologyRequestId?: string;
  admissionId?: string;
}

export interface GeneratePatientDocumentInput {
  documentType: PatientDocumentType;
  title?: string;
  description?: string;
  sourceKind?: "patients" | "consultations" | "pharmacy" | "laboratory" | "radiology";
  sourceId: string;
  encounterId?: string;
  consultationId?: string;
  prescriptionId?: string;
  laboratoryRequestId?: string;
  radiologyRequestId?: string;
  admissionId?: string;
}
