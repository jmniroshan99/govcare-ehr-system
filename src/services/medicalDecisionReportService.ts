import type { MedicalDecisionRequest } from "../types/medicalDecisionReport";
import { queueOfflineCallable } from "./offlineQueue";

const STORAGE_KEY = "govcare-medical-decision-requests";

const seedRequests: MedicalDecisionRequest[] = [
  {
    id: "MDRQ-2026-0012",
    reportNumber: "MDR-2026-000012",
    patientUid: "demo-patient",
    patientId: "PHR-000142",
    patientName: "Fathima Rizna",
    hospitalId: "hosp-colombo-national",
    purpose: "university-clearance",
    institutionName: "University of Colombo",
    institutionType: "University",
    requestedInformation: ["Diagnoses", "Laboratory results", "Immunization records", "Vital signs"],
    additionalDetails: "Medical clearance requested for university enrollment.",
    assignedDoctorId: "demo-doctor",
    assignedDoctorName: "Dr. Anjali Perera",
    consent: {
      accepted: true,
      recipient: "University of Colombo",
      purpose: "University medical clearance",
      dataCategories: ["Diagnoses", "Laboratory results", "Immunization records", "Vital signs"],
      acceptedAt: "2026-06-20T09:15:00+05:30",
    },
    status: "released",
    clinicalSummary: "No active communicable disease. Vaccination record reviewed. Latest observations are stable.",
    medicalRemarks: "Patient is medically suitable to commence university studies.",
    recommendations: "Continue routine follow-up and maintain vaccination schedule.",
    restrictions: "None.",
    fitnessStatus: "fit",
    issueDate: "2026-06-21",
    expiryDate: "2026-12-21",
    verificationToken: "GOVCARE-MDR-0012-VALID",
    digitalSignature: "Dr. Anjali Perera / Authorized Medical Officer",
    releaseStatus: "released",
    createdAt: "2026-06-20T09:15:00+05:30",
    updatedAt: "2026-06-21T11:30:00+05:30",
    timeline: [
      { action: "Request submitted with consent", actor: "Fathima Rizna", timestamp: "2026-06-20T09:15:00+05:30" },
      { action: "Clinical records reviewed", actor: "Dr. Anjali Perera", timestamp: "2026-06-20T14:10:00+05:30" },
      { action: "Approved and digitally signed", actor: "Authorized Medical Officer", timestamp: "2026-06-21T10:45:00+05:30" },
      { action: "Released to patient", actor: "GovCare EHR", timestamp: "2026-06-21T11:30:00+05:30" },
    ],
  },
  {
    id: "MDRQ-2026-0013",
    patientUid: "demo-patient",
    patientId: "PHR-000310",
    patientName: "Nimal Silva",
    hospitalId: "hosp-colombo-national",
    purpose: "workplace-fitness",
    institutionName: "National Water Supply Board",
    institutionType: "Workplace",
    requestedInformation: ["OPD visits", "Diagnoses", "Laboratory results", "Vital signs"],
    additionalDetails: "Return-to-work assessment after medical leave.",
    assignedDoctorId: "demo-doctor",
    assignedDoctorName: "Dr. Anjali Perera",
    consent: {
      accepted: true,
      recipient: "National Water Supply Board",
      purpose: "Workplace fitness certificate",
      dataCategories: ["OPD visits", "Diagnoses", "Laboratory results", "Vital signs"],
      acceptedAt: "2026-06-21T08:40:00+05:30",
    },
    status: "doctor-review",
    releaseStatus: "internal",
    createdAt: "2026-06-21T08:40:00+05:30",
    updatedAt: "2026-06-21T08:40:00+05:30",
    timeline: [{ action: "Request submitted with consent", actor: "Nimal Silva", timestamp: "2026-06-21T08:40:00+05:30" }],
  },
];

function readLocalRequests() {
  if (typeof window === "undefined") return seedRequests;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedRequests));
      return seedRequests;
    }
    return JSON.parse(saved) as MedicalDecisionRequest[];
  } catch {
    return seedRequests;
  }
}

function writeLocalRequests(requests: MedicalDecisionRequest[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export async function listMedicalDecisionRequests() {
  return readLocalRequests();
}

export async function submitMedicalDecisionRequest(input: Omit<MedicalDecisionRequest, "id" | "status" | "releaseStatus" | "createdAt" | "updatedAt" | "timeline">) {
  const clientRequestId = crypto.randomUUID();
  const cloudPayload = { ...input, clientRequestId };
  const now = new Date().toISOString();
  const request: MedicalDecisionRequest = {
    ...input,
    id: `MDRQ-${clientRequestId}`,
    status: "doctor-review",
    releaseStatus: "internal",
    createdAt: now,
    updatedAt: now,
    timeline: [{ action: "Request submitted with consent", actor: input.patientName, timestamp: now }],
  };
  writeLocalRequests([request, ...readLocalRequests()]);
  await queueOfflineCallable({
    callableName: "submitMedicalDecisionRequest",
    payload: cloudPayload,
    label: "Medical decision report request",
    dedupeKey: `medical-report-request:${clientRequestId}`,
  });
  return { requestId: request.id };
}

export async function saveMedicalDecisionReview(requestId: string, updates: Partial<MedicalDecisionRequest>, action: "save-draft" | "approve" | "release" | "reject") {
  if (!navigator.onLine && action !== "save-draft") {
    throw new Error("Medical report approval, rejection, digital signing, and release require an online connection.");
  }
  if (!navigator.onLine && action === "save-draft") {
    await queueOfflineCallable({
      callableName: "reviewMedicalDecisionRequest",
      payload: { requestId, updates, action },
      label: `Medical report draft ${requestId}`,
      dedupeKey: `medical-report-draft:${requestId}`,
    });
  }
  const requests = readLocalRequests();
  const index = requests.findIndex((request) => request.id === requestId);
  if (index < 0) throw new Error("Medical report request not found.");
  const now = new Date().toISOString();
  const current = requests[index];
  const reportNumber = current.reportNumber ?? `MDR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const verificationToken = current.verificationToken ?? `GOVCARE-${crypto.randomUUID()}`;
  const status = action === "save-draft" ? "drafted" : action === "approve" ? "approved" : action === "release" ? "released" : "rejected";
  requests[index] = {
    ...current,
    ...updates,
    reportNumber,
    verificationToken,
    status,
    releaseStatus: action === "release" ? "released" : current.releaseStatus,
    updatedAt: now,
    timeline: [{ action: action.replace("-", " "), actor: updates.digitalSignature || "Authorized clinical user", timestamp: now }, ...current.timeline],
  };
  writeLocalRequests(requests);
  return { ok: true, reportNumber, verificationToken };
}

export async function verifyMedicalDecisionReport(reportNumber: string, token?: string) {
  const report = readLocalRequests().find((item) =>
    item.reportNumber?.toLowerCase() === reportNumber.trim().toLowerCase()
    && (!token || item.verificationToken === token),
  );
  if (!report || report.status !== "released") return { valid: false, message: "No valid released report was found." };
  return {
    valid: true,
    reportNumber: report.reportNumber,
    patientName: report.patientName,
    issueDate: report.issueDate,
    expiryDate: report.expiryDate,
    purpose: report.purpose,
    hospital: "National Hospital of Sri Lanka",
    doctorName: report.assignedDoctorName,
    message: "This report is genuine and currently valid.",
  };
}

export interface VerificationResult {
  valid: boolean;
  reportNumber?: string;
  patientName?: string;
  issueDate?: string;
  expiryDate?: string;
  purpose?: string;
  hospital?: string;
  doctorName?: string;
  message: string;
}
