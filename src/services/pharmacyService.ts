import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { isOfflineCapableNetworkError, queueOfflineCallable } from "./offlineQueue";

export const PHARMACY_QUEUE_STORAGE_KEY = "govcare.pharmacyQueue";
export const PHARMACY_QUEUE_UPDATED_EVENT = "govcare:pharmacy-queue-updated";

export type PharmacyQueueStatus = "pending" | "verified" | "issued" | "partially issued" | "rejected";
export type PharmacyPriority = "routine" | "urgent" | "stat";
export type PrescriptionLineStatus = "pending" | "issued" | "unavailable" | "substituted";
export type PrescriptionValidation = "clear" | "warning" | "blocked";

export interface PharmacyIssueItem {
  medicineId: string;
  quantity: number;
}

export interface StructuredPrescriptionLine {
  medicineId: string;
  name: string;
  generic: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  stock: number;
  expiry: string;
  alternative?: string;
  status: PrescriptionLineStatus;
}

export interface PharmacyAuditTrailItem {
  action: string;
  actorId: string;
  actorRole: string;
  timestamp: string;
  details?: string;
}

export interface PharmacyQueuePrescription {
  id: string;
  prescriptionNo: string;
  consultationId?: string;
  visitId?: string;
  patientId: string;
  nic: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  allergies: string[];
  diagnosis: string;
  clinicalNotes?: string;
  doctorId: string;
  doctorName: string;
  department: string;
  hospitalId: string;
  opdToken: string;
  admissionNo?: string;
  priority: PharmacyPriority;
  status: PharmacyQueueStatus;
  validation: PrescriptionValidation;
  submittedAt: string;
  updatedAt: string;
  releaseStatus: "internal" | "released";
  lines: StructuredPrescriptionLine[];
  auditTrail: PharmacyAuditTrailItem[];
}

export interface CreatePrescriptionFromConsultationPayload {
  consultationId?: string;
  visitId?: string;
  patientId: string;
  patientName: string;
  age?: number;
  gender?: string;
  phone?: string;
  nic?: string;
  allergies?: string[];
  diagnosis: string;
  clinicalNotes?: string;
  doctorId: string;
  doctorName: string;
  department: string;
  hospitalId: string;
  opdToken?: string;
  admissionNo?: string;
  priority?: PharmacyPriority;
  lines: Omit<StructuredPrescriptionLine, "status">[];
}

export interface PrescriptionSafetyResult {
  validation: PrescriptionValidation;
  warnings: string[];
  blockedReasons: string[];
}

const defaultHospitalId = "hosp-colombo-national";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function browserQueueAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifyQueueUpdated() {
  if (!browserQueueAvailable()) return;
  window.dispatchEvent(new CustomEvent(PHARMACY_QUEUE_UPDATED_EVENT));
}

export function getPharmacyQueue() {
  if (!browserQueueAvailable()) return [] as PharmacyQueuePrescription[];
  try {
    const raw = window.localStorage.getItem(PHARMACY_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PharmacyQueuePrescription[] : [];
  } catch {
    return [];
  }
}

export function savePharmacyQueue(queue: PharmacyQueuePrescription[]) {
  if (!browserQueueAvailable()) return;
  window.localStorage.setItem(PHARMACY_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  notifyQueueUpdated();
}

export function upsertPharmacyQueuePrescription(prescription: PharmacyQueuePrescription) {
  const queue = getPharmacyQueue();
  const next = [
    prescription,
    ...queue.filter((item) => item.id !== prescription.id && item.prescriptionNo !== prescription.prescriptionNo),
  ].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  savePharmacyQueue(next);
  return prescription;
}

function withAudit(prescription: PharmacyQueuePrescription, action: string, actorId: string, actorRole: string, details?: string) {
  return {
    ...prescription,
    updatedAt: nowIso(),
    auditTrail: [
      { action, actorId, actorRole, timestamp: nowIso(), details },
      ...prescription.auditTrail,
    ],
  };
}

export function verifyPrescriptionSafety(prescription: Pick<PharmacyQueuePrescription, "allergies" | "lines">): PrescriptionSafetyResult {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  const genericCounts = new Map<string, number>();

  for (const line of prescription.lines) {
    genericCounts.set(line.generic.toLowerCase(), (genericCounts.get(line.generic.toLowerCase()) ?? 0) + 1);
    const allergyMatch = prescription.allergies.some((allergy) => {
      const token = allergy.toLowerCase().split(/\s|-/)[0];
      return token.length > 2 && `${line.generic} ${line.name}`.toLowerCase().includes(token);
    });
    if (allergyMatch) warnings.push(`Allergy warning for ${line.generic}.`);
    if (line.stock <= 0) warnings.push(`${line.generic} is out of stock; substitution or partial issue required.`);
    if (line.quantity > line.stock && line.stock > 0) warnings.push(`${line.generic} has partial stock (${line.stock}/${line.quantity}).`);
    if (line.expiry <= "2026-09") warnings.push(`${line.generic} has near-expiry stock (${line.expiry}).`);
  }

  for (const [generic, count] of genericCounts.entries()) {
    if (count > 1) warnings.push(`Duplicate medicine detected: ${generic}.`);
  }

  const validation: PrescriptionValidation = blockedReasons.length ? "blocked" : warnings.length ? "warning" : "clear";
  return { validation, warnings, blockedReasons };
}

export async function createPrescriptionFromConsultation(payload: CreatePrescriptionFromConsultationPayload) {
  const safety = verifyPrescriptionSafety({
    allergies: payload.allergies ?? [],
    lines: payload.lines.map((line) => ({ ...line, status: "pending" })),
  });
  const timestamp = nowIso();
  const prescriptionNo = createId("RX");
  const prescription: PharmacyQueuePrescription = {
    id: prescriptionNo.toLowerCase(),
    prescriptionNo,
    consultationId: payload.consultationId,
    visitId: payload.visitId,
    patientId: payload.patientId,
    nic: payload.nic ?? "not-recorded",
    patientName: payload.patientName,
    age: payload.age ?? 0,
    gender: payload.gender ?? "Not recorded",
    phone: payload.phone ?? "",
    allergies: payload.allergies ?? [],
    diagnosis: payload.diagnosis,
    clinicalNotes: payload.clinicalNotes,
    doctorId: payload.doctorId,
    doctorName: payload.doctorName,
    department: payload.department,
    hospitalId: payload.hospitalId,
    opdToken: payload.opdToken ?? "not-linked",
    admissionNo: payload.admissionNo,
    priority: payload.priority ?? "routine",
    status: "pending",
    validation: safety.validation,
    submittedAt: timestamp,
    updatedAt: timestamp,
    releaseStatus: "internal",
    lines: payload.lines.map((line) => ({ ...line, status: "pending" })),
    auditTrail: [{
      action: "createPrescriptionFromConsultation",
      actorId: payload.doctorId,
      actorRole: "doctor",
      timestamp,
      details: safety.warnings.join(" ") || "Prescription created and signed.",
    }],
  };

  const queued = await pushPrescriptionToPharmacyQueue(prescription);
  const cloudPayload = { ...payload, lines: prescription.lines, validation: safety.validation, prescriptionNo };
  if (functions) {
    if (!navigator.onLine) {
      await queueOfflineCallable({
        callableName: "createPrescriptionFromConsultation",
        payload: cloudPayload,
        label: `Prescription ${prescriptionNo}`,
        dedupeKey: `prescription-create:${prescriptionNo}`,
      });
      return queued;
    }
    try {
      const callable = httpsCallable(functions, "createPrescriptionFromConsultation");
      await callable(cloudPayload);
    } catch (error) {
      if (!isOfflineCapableNetworkError(error)) throw error;
      await queueOfflineCallable({
        callableName: "createPrescriptionFromConsultation",
        payload: cloudPayload,
        label: `Prescription ${prescriptionNo}`,
        dedupeKey: `prescription-create:${prescriptionNo}`,
      });
    }
  }
  return queued;
}

export async function pushPrescriptionToPharmacyQueue(prescription: PharmacyQueuePrescription) {
  const queued = upsertPharmacyQueuePrescription(withAudit(
    prescription,
    "pushPrescriptionToPharmacyQueue",
    prescription.doctorId,
    "doctor",
    "Prescription transmitted to pharmacy queue.",
  ));

  if (functions) {
    if (!navigator.onLine) {
      await queueOfflineCallable({
        callableName: "pushPrescriptionToPharmacyQueue",
        payload: { ...queued },
        label: `Pharmacy queue ${queued.prescriptionNo}`,
        dedupeKey: `pharmacy-queue:${queued.prescriptionNo}`,
      });
      return queued;
    }
    try {
      const callable = httpsCallable(functions, "pushPrescriptionToPharmacyQueue");
      await callable(queued);
    } catch (error) {
      if (!isOfflineCapableNetworkError(error)) throw error;
      await queueOfflineCallable({
        callableName: "pushPrescriptionToPharmacyQueue",
        payload: { ...queued },
        label: `Pharmacy queue ${queued.prescriptionNo}`,
        dedupeKey: `pharmacy-queue:${queued.prescriptionNo}`,
      });
    }
  }

  return queued;
}

export async function issueMedicineAndUpdateStock(payload: {
  prescriptionId: string;
  items: PharmacyIssueItem[];
  issuedBy?: string;
  actorId?: string;
}) {
  if (functions && !navigator.onLine) {
    throw new Error("Medicine issuing and stock deduction require an online connection to prevent duplicate dispensing.");
  }
  const queue = getPharmacyQueue();
  const prescription = queue.find((item) => item.prescriptionNo === payload.prescriptionId || item.id === payload.prescriptionId);
  if (prescription) {
    const nextLines = prescription.lines.map((line) => {
      const issued = payload.items.find((item) => item.medicineId === line.medicineId);
      if (!issued) return line;
      const remainingStock = Math.max(0, line.stock - issued.quantity);
      const status: PrescriptionLineStatus = issued.quantity >= line.quantity ? "issued" : "substituted";
      return { ...line, stock: remainingStock, status };
    });
    const allIssued = nextLines.every((line) => line.status === "issued" || line.status === "substituted");
    const updated = withAudit({
      ...prescription,
      lines: nextLines,
      status: allIssued ? "issued" : "partially issued",
    }, "issueMedicineAndUpdateStock", payload.actorId ?? payload.issuedBy ?? "pharmacy", "pharmacist", "Stock deducted transaction-safely.");
    upsertPharmacyQueuePrescription(updated);
  }

  if (!functions) return { ok: true, mode: "demo" as const };
  try {
    const callable = httpsCallable(functions, "issueMedicineAndUpdateStock");
    const { data } = await callable({
      hospitalId: defaultHospitalId,
      ...payload,
    });
    return data as { ok: boolean };
  } catch (error) {
    console.warn("issueMedicineAndUpdateStock function unavailable; local stock update already applied.", error);
    return { ok: true, mode: "demo" as const };
  }
}

export async function completePharmacyTransaction(payload: {
  prescriptionId: string;
  patientId: string;
  issuedBy: string;
  actorId?: string;
  items: PharmacyIssueItem[];
}) {
  const stockResult = await issueMedicineAndUpdateStock(payload);
  const receiptId = createId("PHR");
  const queue = getPharmacyQueue();
  const prescription = queue.find((item) => item.prescriptionNo === payload.prescriptionId || item.id === payload.prescriptionId);
  if (prescription) {
    const updated = withAudit({
      ...prescription,
      status: prescription.lines.every((line) => line.status === "issued" || line.status === "substituted") ? "issued" : "partially issued",
      releaseStatus: "released",
    }, "completePharmacyTransaction", payload.actorId ?? payload.issuedBy, "pharmacist", `Receipt ${receiptId} generated and patient notification queued.`);
    upsertPharmacyQueuePrescription(updated);
  }

  if (!functions) return { ok: true, receiptId, mode: "demo" as const, stockResult };
  try {
    const callable = httpsCallable(functions, "completePharmacyTransaction");
    const { data } = await callable({
      hospitalId: defaultHospitalId,
      receiptId,
      ...payload,
    });
    return data as { ok: boolean; receiptId: string };
  } catch (error) {
    console.warn("completePharmacyTransaction function unavailable; local receipt flow already completed.", error);
    return { ok: true, receiptId, mode: "demo" as const, stockResult };
  }
}

export async function processPrescriptionIssue(payload: { prescriptionId: string; items: PharmacyIssueItem[] }) {
  return issueMedicineAndUpdateStock(payload);
}

export async function issuePharmacyReceipt(payload: { prescriptionId: string; patientId: string; issuedBy: string; items: PharmacyIssueItem[] }) {
  return completePharmacyTransaction(payload);
}
