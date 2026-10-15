export type MedicalReportPurpose =
  | "university-clearance"
  | "workplace-fitness"
  | "service-area"
  | "legal-court"
  | "insurance"
  | "government-confirmation"
  | "disability-confirmation"
  | "treatment-history"
  | "fitness-work-study";

export type MedicalReportStatus =
  | "submitted"
  | "doctor-review"
  | "drafted"
  | "department-review"
  | "approved"
  | "signed"
  | "released"
  | "rejected";

export interface MedicalDecisionRequest {
  id: string;
  reportNumber?: string;
  patientUid: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  purpose: MedicalReportPurpose;
  institutionName: string;
  institutionType: string;
  requestedInformation: string[];
  additionalDetails: string;
  assignedDoctorId: string;
  assignedDoctorName: string;
  consent: {
    accepted: boolean;
    recipient: string;
    purpose: string;
    dataCategories: string[];
    acceptedAt: string;
  };
  status: MedicalReportStatus;
  clinicalSummary?: string;
  medicalRemarks?: string;
  recommendations?: string;
  restrictions?: string;
  fitnessStatus?: "fit" | "fit-with-restrictions" | "temporarily-unfit" | "unfit" | "not-applicable";
  followUpRequirements?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationToken?: string;
  digitalSignature?: string;
  releaseStatus: "internal" | "released";
  createdAt: string;
  updatedAt: string;
  timeline: Array<{ action: string; actor: string; timestamp: string; note?: string }>;
}

export const medicalReportPurposes: Array<{ value: MedicalReportPurpose; label: string; description: string }> = [
  { value: "university-clearance", label: "University medical clearance", description: "Health and fitness confirmation for admission or study." },
  { value: "workplace-fitness", label: "Workplace fitness certificate", description: "Fitness assessment for employment or return to work." },
  { value: "service-area", label: "Service area medical report", description: "Official medical report for a service organization." },
  { value: "legal-court", label: "Legal or court-related report", description: "Authorized medical confirmation for legal proceedings." },
  { value: "insurance", label: "Insurance medical report", description: "Verified treatment and health information for an insurer." },
  { value: "government-confirmation", label: "Government office confirmation", description: "Medical confirmation for a government department." },
  { value: "disability-confirmation", label: "Disability or long-term illness", description: "Clinical confirmation of disability or chronic illness." },
  { value: "treatment-history", label: "Treatment history summary", description: "Verified summary of relevant hospital treatment." },
  { value: "fitness-work-study", label: "Fitness to work or study", description: "Medical decision with recommendations and restrictions." },
];

export const ehrEvidenceOptions = [
  "OPD visits", "Consultation notes", "Diagnoses", "Prescriptions", "Laboratory results",
  "Radiology reports", "Ward admissions", "Discharge summaries", "Emergency records",
  "Allergies", "Immunization records", "Vital signs", "Previous medical certificates", "Care messages",
];
