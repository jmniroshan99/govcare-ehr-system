# GovCare EHR Firestore Database Design

This document defines the production-ready Firestore collection structure for GovCare EHR. All clinical and operational records must be scoped by `hospitalId` for multi-hospital isolation and must include audit metadata.

## Required Base Fields

Every operational document should include these fields unless explicitly noted:

```ts
{
  hospitalId: string;
  status: "active" | "pending" | "completed" | "cancelled" | "archived" | string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Patient-facing clinical records should also include:

```ts
{
  patientId: string;
  releaseStatus: "draft" | "pending_review" | "released" | "restricted" | "revoked";
  releasedAt?: Timestamp;
  releasedBy?: string;
}
```

## Collection Overview

Use top-level collections for high-traffic workflows. Use subcollections only where the child records are always read inside a parent context.

| Collection | Purpose | Primary Users |
|---|---|---|
| `hospitals` | Hospital tenant records and settings | Super Admin, Hospital Admin |
| `departments` | Departments, clinics, labs, wards, service units | Admins, Reception |
| `users` | Staff and patient portal user profiles linked to Firebase Auth UID | All roles |
| `patients` | Patient master index and health profile | Reception, Doctors, Nurses, Patient |
| `guardians` | Guardian/parent accounts and linked dependents | Reception, Patient/Guardian |
| `appointments` | Clinic, OPD, follow-up, and telemedicine bookings | Reception, Doctors, Patients |
| `opdQueues` | Daily active OPD queues and token state | Reception, Doctors, Nurses |
| `consultations` | Doctor consultation records | Doctors, Nurses, Patients if released |
| `prescriptions` | E-prescriptions and issue state | Doctors, Pharmacists, Patients if released |
| `pharmacyStock` | Medicine inventory and stock batches | Pharmacists, Admins |
| `labRequests` | Lab requests from consultation, ward, emergency | Doctors, Lab, Nurses |
| `labResults` | Lab results, approval, release status | Lab, Doctors, Patients if released |
| `radiologyRequests` | Imaging requests and scan workflow | Doctors, Radiology |
| `radiologyReports` | Imaging report metadata and released reports | Radiology, Doctors, Patients if released |
| `admissions` | Inpatient admission records | Doctors, Nurses, Admins |
| `wards` | Ward master data | Admins, Nurses |
| `beds` | Bed state and allocation | Admins, Nurses, Admissions |
| `notifications` | In-app/push notification records | All roles |
| `auditLogs` | Immutable audit trail | Super Admin, Auditors |

## `hospitals`

Document ID: `hospitalId`, for example `hosp-colombo-national`

```ts
{
  name: string;
  code: string;
  type: "national" | "teaching" | "district_general" | "base" | "divisional" | "specialized";
  address: {
    line1: string;
    city: string;
    district: string;
    province: string;
    postalCode?: string;
  };
  contact: {
    phone: string;
    email?: string;
    website?: string;
  };
  settings: {
    defaultLanguage: "en" | "si" | "ta";
    timezone: string;
    patientIdPrefix: string;
    requireGuardianUnderAge: number;
    enableAppCheck: boolean;
  };
  status: "active" | "suspended";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

## `departments`

Document ID: auto ID or stable department code.

```ts
{
  hospitalId: string;
  name: string;
  code: string;
  type: "administration" | "opd" | "clinic" | "ward" | "pharmacy" | "laboratory" | "radiology" | "emergency" | "theatre" | "records";
  parentDepartmentId?: string;
  location?: string;
  serviceDays?: string[];
  headUserId?: string;
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, type ASC, status ASC`
- `hospitalId ASC, code ASC`

## `users`

Document ID: Firebase Auth UID.

```ts
{
  hospitalId: string;
  departmentId?: string;
  role: "super_admin" | "hospital_admin" | "doctor" | "nurse" | "pharmacist" | "lab_technician" | "radiologist" | "receptionist" | "records_officer" | "patient" | "guardian";
  permissions: string[];
  status: "pending" | "active" | "suspended" | "deactivated";
  email: string;
  displayName: string;
  phone?: string;
  profilePhotoUrl?: string;
  staffId?: string;
  patientId?: string;
  guardianId?: string;
  lastLoginAt?: Timestamp;
  mfaEnabled: boolean;
  language: "en" | "si" | "ta";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Security rule principle:

- Users may read their own profile.
- Admin roles may manage users in the same `hospitalId`.
- Role and permission changes must go through Cloud Functions.

## `patients`

Document ID: generated patient ID, for example `PAT-2026-000142`.

```ts
{
  hospitalId: string;
  patientId: string;
  guardianIds?: string[];
  type: "adult" | "child" | "dependent" | "temporary_emergency";
  identifiers: {
    nic?: string;
    passport?: string;
    birthCertificate?: string;
    hospitalNumber?: string;
    temporaryId?: string;
  };
  demographics: {
    title?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    preferredName?: string;
    fullName: string;
    dateOfBirth: string;
    age: number;
    gender?: string;
    bloodGroup?: string;
    nationality?: string;
    ethnicity?: string;
    religion?: string;
    maritalStatus?: string;
    language: "en" | "si" | "ta";
  };
  contact: {
    address?: string;
    district?: string;
    province?: string;
    phone?: string;
    email?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
  };
  clinicalSummary: {
    allergies: string[];
    chronicDiseases: string[];
    disabilities: string[];
    familyHistory: string[];
    currentMedications: string[];
    pregnancyStatus?: string;
    riskCategory?: "low" | "medium" | "high" | "critical";
  };
  media: {
    profilePhotoUrl?: string;
    qrCodeValue: string;
    barcodeValue: string;
  };
  registrationSource: "reception" | "patient_portal" | "emergency" | "migration";
  duplicateCheck: {
    normalizedName: string;
    normalizedPhone?: string;
    possibleDuplicateIds: string[];
    verifiedUnique: boolean;
  };
  releaseStatus: "restricted";
  status: "active" | "merged" | "deceased" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, patientId ASC`
- `hospitalId ASC, identifiers.nic ASC`
- `hospitalId ASC, identifiers.birthCertificate ASC`
- `hospitalId ASC, contact.phone ASC`
- `hospitalId ASC, demographics.normalizedName ASC`
- `hospitalId ASC, status ASC, updatedAt DESC`

## `guardians`

Document ID: generated guardian ID, for example `GRD-2026-000041`.

```ts
{
  hospitalId: string;
  guardianId: string;
  userId?: string;
  nic: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  relationshipToPatients: Array<{
    patientId: string;
    relationship: "father" | "mother" | "grandparent" | "spouse" | "sibling" | "legal_guardian" | "other";
    legalAuthorityVerified: boolean;
  }>;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  status: "active" | "suspended" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, nic ASC`
- `hospitalId ASC, phone ASC`
- `hospitalId ASC, status ASC`

## `appointments`

Document ID: auto ID or `APT-{date}-{sequence}`.

```ts
{
  hospitalId: string;
  patientId: string;
  guardianId?: string;
  departmentId: string;
  doctorId?: string;
  appointmentType: "physical" | "telemedicine" | "follow_up" | "emergency";
  date: string;
  startTime: string;
  endTime?: string;
  queueNumber?: string;
  estimatedWaitingMinutes?: number;
  location?: string;
  reason?: string;
  symptoms?: string[];
  releaseStatus: "released";
  status: "booked" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show" | "rescheduled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, patientId ASC, date DESC`
- `hospitalId ASC, doctorId ASC, date ASC, status ASC`
- `hospitalId ASC, departmentId ASC, date ASC, status ASC`

## `opdQueues`

Use one document per queue token. Keep only active/recent queue records here; archive older queue records to reports if needed.

```ts
{
  hospitalId: string;
  queueDate: string;
  patientId: string;
  visitId: string;
  tokenNumber: string;
  departmentId: string;
  doctorId?: string;
  priority: "routine" | "elderly" | "pregnancy" | "disability" | "urgent" | "emergency";
  source: "walk_in" | "appointment" | "emergency" | "clinic";
  checkedInAt: Timestamp;
  calledAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  status: "waiting" | "called" | "in_consultation" | "checked" | "completed" | "skipped" | "transferred" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, queueDate ASC, departmentId ASC, status ASC, priority DESC, checkedInAt ASC`
- `hospitalId ASC, doctorId ASC, queueDate ASC, status ASC`
- `hospitalId ASC, patientId ASC, queueDate DESC`

## `consultations`

Document ID: generated consultation ID.

```ts
{
  hospitalId: string;
  patientId: string;
  visitId: string;
  opdQueueId?: string;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  consultationType: "opd" | "clinic" | "emergency" | "inpatient" | "telemedicine";
  chiefComplaint: string;
  symptoms: string[];
  history?: string;
  examinationFindings?: string;
  diagnosis: Array<{
    code?: string;
    system?: "ICD-10" | "SNOMED" | "local";
    label: string;
    type: "provisional" | "confirmed" | "differential";
  }>;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  treatmentPlan?: string;
  followUpDate?: string;
  linkedPrescriptionIds: string[];
  linkedLabRequestIds: string[];
  linkedRadiologyRequestIds: string[];
  releaseStatus: "draft" | "released" | "restricted";
  status: "draft" | "signed" | "completed" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, doctorId ASC, createdAt DESC`
- `hospitalId ASC, visitId ASC`

## `prescriptions`

```ts
{
  hospitalId: string;
  patientId: string;
  consultationId: string;
  doctorId: string;
  pharmacyId?: string;
  diagnosisSummary?: string;
  priority: "routine" | "urgent" | "emergency" | "discharge";
  medicines: Array<{
    medicineId?: string;
    genericName: string;
    brandName?: string;
    strength?: string;
    dosageForm?: string;
    route: string;
    dose: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
    mealTiming?: "before_meals" | "after_meals" | "with_meals" | "not_applicable";
    issueStatus: "pending" | "issued" | "partial" | "unavailable" | "substituted";
  }>;
  safetyChecks: {
    allergyWarning: boolean;
    duplicateWarning: boolean;
    interactionWarning: boolean;
    pregnancyWarning: boolean;
    pediatricDoseWarning: boolean;
    renalDoseWarning: boolean;
  };
  signedBy?: string;
  signedAt?: Timestamp;
  qrCodeValue?: string;
  receiptId?: string;
  releaseStatus: "draft" | "released" | "restricted";
  status: "draft" | "sent_to_pharmacy" | "verified" | "issued" | "partial" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, status ASC, priority DESC, createdAt ASC`
- `hospitalId ASC, doctorId ASC, createdAt DESC`

## `pharmacyStock`

```ts
{
  hospitalId: string;
  medicineId: string;
  genericName: string;
  brandName?: string;
  category: string;
  dosageForm: string;
  strength: string;
  batches: Array<{
    batchNo: string;
    expiryDate: string;
    quantityAvailable: number;
    supplier?: string;
  }>;
  reorderLevel: number;
  totalQuantity: number;
  stockStatus: "available" | "low_stock" | "out_of_stock" | "expired" | "inactive";
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, genericName ASC`
- `hospitalId ASC, category ASC, stockStatus ASC`
- `hospitalId ASC, status ASC, totalQuantity ASC`

## `labRequests`

```ts
{
  hospitalId: string;
  patientId: string;
  consultationId?: string;
  admissionId?: string;
  requestedBy: string;
  departmentId: string;
  tests: Array<{
    testCode: string;
    testName: string;
    specimenType: string;
  }>;
  priority: "routine" | "urgent" | "stat";
  clinicalReason?: string;
  sample: {
    barcodeValue?: string;
    collectedAt?: Timestamp;
    collectedBy?: string;
    receivedAt?: Timestamp;
    rejectedAt?: Timestamp;
    rejectionReason?: string;
  };
  releaseStatus: "restricted";
  status: "requested" | "sample_collected" | "received" | "processing" | "result_entered" | "approved" | "released" | "rejected" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

## `labResults`

```ts
{
  hospitalId: string;
  patientId: string;
  labRequestId: string;
  consultationId?: string;
  results: Array<{
    testCode: string;
    testName: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    flag: "normal" | "abnormal" | "critical" | "panic";
  }>;
  summary?: string;
  attachments: Array<{
    fileUrl: string;
    fileName: string;
    contentType: string;
    uploadedBy: string;
    uploadedAt: Timestamp;
  }>;
  approvedBy?: string;
  approvedAt?: Timestamp;
  releasedBy?: string;
  releasedAt?: Timestamp;
  releaseStatus: "draft" | "pending_review" | "released" | "restricted" | "revoked";
  status: "draft" | "pending_review" | "approved" | "released" | "amended" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes for lab:

- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, status ASC, priority DESC, createdAt ASC`
- `hospitalId ASC, labRequestId ASC`
- `hospitalId ASC, releaseStatus ASC, releasedAt DESC`

## `radiologyRequests`

```ts
{
  hospitalId: string;
  patientId: string;
  consultationId?: string;
  admissionId?: string;
  requestedBy: string;
  modality: "xray" | "ct" | "mri" | "ultrasound" | "ecg" | "echo" | "other";
  bodyPart?: string;
  clinicalReason: string;
  priority: "routine" | "urgent" | "stat" | "emergency";
  scheduledAt?: Timestamp;
  scanRoomId?: string;
  portableRequired: boolean;
  radiationTracking?: {
    dose?: number;
    unit?: string;
  };
  releaseStatus: "restricted";
  status: "requested" | "scheduled" | "in_progress" | "completed" | "reported" | "approved" | "released" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

## `radiologyReports`

```ts
{
  hospitalId: string;
  patientId: string;
  radiologyRequestId: string;
  radiologistId: string;
  modality: string;
  findings: string;
  impression: string;
  resultFlag: "normal" | "abnormal" | "critical";
  attachments: Array<{
    fileUrl: string;
    fileName: string;
    contentType: string;
    kind: "dicom" | "image" | "pdf" | "document";
    uploadedBy: string;
    uploadedAt: Timestamp;
  }>;
  digitalSignature?: {
    signedBy: string;
    signedAt: Timestamp;
    signatureHash: string;
  };
  qrCodeValue?: string;
  releaseStatus: "draft" | "pending_review" | "released" | "restricted" | "revoked";
  status: "draft" | "approved" | "released" | "amended" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes for radiology:

- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, status ASC, priority DESC, createdAt ASC`
- `hospitalId ASC, radiologyRequestId ASC`
- `hospitalId ASC, releaseStatus ASC, releasedAt DESC`

## `admissions`

```ts
{
  hospitalId: string;
  patientId: string;
  admissionNo: string;
  referralSource: "opd" | "emergency" | "clinic" | "transfer";
  admissionReason: string;
  provisionalDiagnosis?: string;
  departmentId: string;
  consultantDoctorId?: string;
  wardId?: string;
  bedId?: string;
  priority: "routine" | "urgent" | "emergency";
  admittedAt?: Timestamp;
  dischargedAt?: Timestamp;
  allergies: string[];
  chronicDiseases: string[];
  notes?: string;
  dischargeSummaryId?: string;
  releaseStatus: "restricted" | "released";
  status: "requested" | "approved" | "admitted" | "transfer_requested" | "discharge_ready" | "discharged" | "cancelled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, wardId ASC, status ASC`
- `hospitalId ASC, status ASC, priority DESC, createdAt ASC`

## `wards`

```ts
{
  hospitalId: string;
  wardId: string;
  name: string;
  departmentId: string;
  type: "medical" | "surgical" | "pediatric" | "obstetrics" | "icu" | "hdu" | "isolation" | "other";
  floor?: string;
  nurseLeadId?: string;
  capacity: number;
  currentOccupancy: number;
  status: "active" | "maintenance" | "closed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

## `beds`

```ts
{
  hospitalId: string;
  wardId: string;
  bedId: string;
  bedNo: string;
  bedType: "standard" | "icu" | "hdu" | "isolation" | "pediatric" | "maternity";
  patientId?: string;
  admissionId?: string;
  assignedAt?: Timestamp;
  assignedBy?: string;
  status: "available" | "reserved" | "occupied" | "cleaning" | "maintenance" | "critical";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes for wards/beds:

- `hospitalId ASC, wardId ASC, status ASC`
- `hospitalId ASC, status ASC, bedType ASC`
- `hospitalId ASC, patientId ASC`

## `notifications`

```ts
{
  hospitalId: string;
  recipientUserIds: string[];
  recipientRoles: string[];
  patientId?: string;
  module: "opd" | "consultation" | "pharmacy" | "laboratory" | "radiology" | "admissions" | "ward" | "emergency" | "appointments" | "admin" | "system";
  title: string;
  message: string;
  priority: "info" | "warning" | "urgent" | "critical";
  channels: Array<"in_app" | "push" | "email" | "sms_ready">;
  actionHref?: string;
  readBy: Record<string, Timestamp>;
  archivedBy: Record<string, Timestamp>;
  releaseStatus: "released";
  status: "active" | "archived" | "expired";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

Required indexes:

- `hospitalId ASC, recipientRoles ARRAY_CONTAINS, status ASC, createdAt DESC`
- `hospitalId ASC, recipientUserIds ARRAY_CONTAINS, status ASC, createdAt DESC`
- `hospitalId ASC, patientId ASC, createdAt DESC`

## `auditLogs`

Audit logs are append-only. Never allow normal client update/delete.

```ts
{
  hospitalId: string;
  actorUserId: string;
  actorRole: string;
  action: "create" | "read" | "update" | "delete" | "login" | "logout" | "approve" | "release" | "export" | "download";
  module: string;
  collection: string;
  documentId: string;
  patientId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  device?: {
    userAgent?: string;
    platform?: string;
  };
  status: "success" | "failed" | "blocked";
  createdAt: Timestamp;
  createdBy: string;
}
```

Required indexes:

- `hospitalId ASC, createdAt DESC`
- `hospitalId ASC, actorUserId ASC, createdAt DESC`
- `hospitalId ASC, patientId ASC, createdAt DESC`
- `hospitalId ASC, collection ASC, documentId ASC, createdAt DESC`

## Patient Portal Release Rules

Patients and guardians should only see released patient-facing records:

- `appointments` with matching `patientId`
- `consultations` where `releaseStatus == "released"`
- `prescriptions` where `releaseStatus == "released"`
- `labResults` where `releaseStatus == "released"`
- `radiologyReports` where `releaseStatus == "released"`
- `admissions` or discharge summaries where `releaseStatus == "released"`
- `notifications` addressed to the user or patient

Patients must never read:

- Other patient records
- Doctor private notes
- Internal lab/radiology technician notes
- Pharmacy stock
- Staff schedules
- Audit logs
- Security settings

## Recommended Write Pattern

Sensitive workflows should use Cloud Functions:

1. Validate Firebase Auth and custom claims.
2. Validate payload with Zod.
3. Verify `hospitalId` and role permission.
4. Run Firestore transaction.
5. Write/update operational document.
6. Create immutable `auditLogs` record.
7. Create `notifications` for affected roles/users.
8. Return only safe client fields.

Use direct client writes only for low-risk drafts and profile/contact updates permitted by security rules.

## Naming Conventions

- Store canonical IDs in document body as well as document ID: `patientId`, `wardId`, `bedId`.
- Use lower camelCase field names.
- Use enum-like strings in lowercase snake case.
- Keep `releaseStatus` separate from workflow `status`.
- Do not store Firebase Admin SDK secrets or encryption keys in Firestore client-readable documents.
