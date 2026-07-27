export type Role =
  | "super_admin"
  | "hospital_admin"
  | "doctor"
  | "surgeon"
  | "anesthetist"
  | "nurse"
  | "pharmacist"
  | "pathologist"
  | "lab_manager"
  | "lab_technician"
  | "radiologist"
  | "radiology_technician"
  | "receptionist"
  | "mortuary_officer"
  | "ict_admin"
  | "records_officer"
  | "guardian"
  | "patient";

export type Status = "active" | "pending" | "completed" | "cancelled" | "archived" | "critical" | "inactive" | "suspended" | "blocked";

export interface BaseDocument {
  id: string;
  hospitalId: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface AppUser extends BaseDocument {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  departmentId?: string;
  departmentName?: string;
  hospitalName?: string;
  permissions?: string[];
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  hospitalCity?: string;
  preferredHospital?: string;
  preferredLanguage?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  patientId?: string;
  photoURL?: string;
  mfaEnabled: boolean;
}

export interface Patient extends BaseDocument {
  ownerUid?: string;
  patientId: string;
  nicOrPassport?: string;
  passportNumber?: string;
  birthCertificateNo?: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  sex?: string;
  maritalStatus?: string;
  phone: string;
  email?: string;
  address: string;
  district?: string;
  province?: string;
  postalCode?: string;
  gnDivision?: string;
  bloodGroup?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  allergies: string[];
  chronicDiseases: string[];
  currentMedications?: string[];
  pastSurgeries?: string[];
  familyHistory?: string;
  immunizationHistory?: string;
  pregnancyHistory?: string;
  disabilityStatus?: string;
  riskCategory?: "routine" | "moderate" | "high" | "critical";
  photoUrl?: string;
  guardian?: {
    guardianId?: string;
    name: string;
    relationship?: string;
    nic?: string;
    phone?: string;
  };
  consent?: {
    dataSharing: boolean;
    emergencyAccess: boolean;
    restrictedRecords: boolean;
    updatedAt: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  currentSituation?: string;
  futureTreatments?: string;
  selfReportedSituation?: string;
  occupation?: string;
  employer?: string;
  preferredLanguage?: string;
  smokingStatus?: string;
  alcoholUse?: string;
  organDonorStatus?: string;
  insuranceDetails?: string;
  socialHistory?: string;
  communicationPreferences?: string;
}

export type GuardianRelationship = "Father" | "Mother" | "Grandparent" | "Spouse" | "Sibling" | "Legal Guardian" | "Other";

export interface Guardian extends BaseDocument {
  guardianId: string;
  ownerUid?: string;
  nic: string;
  fullName: string;
  address?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  relationshipToPatient: GuardianRelationship;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dependentPatientIds: string[];
}

export interface PatientReport extends BaseDocument {
  patientUid: string;
  patientId: string;
  title: string;
  category: "laboratory" | "radiology" | "discharge" | "external" | "other";
  reportDate: string;
  storagePath: string;
  uploadedByRole: Role;
}

export type MediaModule =
  | "patient-profile"
  | "opd"
  | "consultation"
  | "pharmacy"
  | "laboratory"
  | "radiology"
  | "emergency"
  | "admissions"
  | "ward"
  | "reports"
  | "secure-chat"
  | "profile"
  | "other";

export type MediaVisibility = "private" | "care-team" | "patient-released" | "admin-only";

export interface GlobalMediaFile extends BaseDocument {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storagePath: string;
  uploadedBy: string;
  uploadedByName: string;
  role: Role;
  patientId?: string;
  module: MediaModule;
  visibilityLevel: MediaVisibility;
  description?: string;
  reviewStatus: "not-required" | "pending-review" | "approved" | "rejected";
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export interface QueueItem extends BaseDocument {
  tokenNo: string;
  patientId: string;
  patientName: string;
  department: string;
  assignedDoctor?: string;
  priority: "routine" | "urgent" | "emergency";
}

export interface Medicine extends BaseDocument {
  name: string;
  sku: string;
  stock: number;
  reorderLevel: number;
  expiryDate: string;
  unit: string;
}

export interface AuditLog {
  id: string;
  hospitalId: string;
  actorUid: string;
  actorRole: Role;
  action: "create" | "read" | "update" | "delete" | "export" | "login";
  collectionName: string;
  documentId: string;
  timestamp: string;
  ipAddress?: string;
  device?: string;
}

export type LoginActivityStatus = "success" | "failed";
export type LogoutActivityStatus = "active" | "logged_out" | "timed_out" | "unknown";
export type AuthenticationMethod = "email_password" | "google" | "demo" | "unknown";

export interface LoginActivity {
  id: string;
  sessionId: string;
  userId?: string;
  fullName: string;
  role?: Role;
  hospitalId: string;
  hospitalName?: string;
  departmentId?: string;
  departmentName?: string;
  email: string;
  loginStatus: LoginActivityStatus;
  logoutStatus: LogoutActivityStatus;
  loginTime: string;
  logoutTime?: string;
  sessionDurationSeconds?: number;
  ipAddress?: string;
  deviceBrowser: string;
  operatingSystem: string;
  location?: string;
  authenticationMethod: AuthenticationMethod;
  failureReason?: string;
  lastActivityTime: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  status: Status;
}
