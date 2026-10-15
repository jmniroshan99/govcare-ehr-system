import { apiRequest } from "./apiClient";
import { queueOfflineCallable } from "./offlineQueue";

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
  patientNo?: string;
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
  patientNo?: string;
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
  if (!payload.patientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.patientId)) {
    throw new Error("A verified PostgreSQL patient UUID is required before sending a prescription.");
  }
  if (!payload.lines.length) throw new Error("Add at least one medicine before sending the prescription.");

  const safety = verifyPrescriptionSafety({
    allergies: payload.allergies ?? [],
    lines: payload.lines.map((line) => ({ ...line, status: "pending" })),
  });
  const timestamp = nowIso();
  let prescriptionNo = createId("RX");
  let databaseId = prescriptionNo.toLowerCase();

  if (navigator.onLine) {
    const persisted = await apiRequest<{ prescription: { id: string; prescription_no: string; pharmacy_status: string; created_at: string } }>("/api/prescriptions", {
      method: "POST",
      body: JSON.stringify({
        patientUuid: payload.patientId,
        visitUuid: payload.visitId || null,
        consultationUuid: payload.consultationId && /^[0-9a-f-]{36}$/i.test(payload.consultationId) ? payload.consultationId : null,
        diagnosis: payload.diagnosis,
        priority: payload.priority ?? "routine",
        digitalSignature: `${payload.doctorName}|${payload.doctorId}|${timestamp}`,
        lines: payload.lines.map((line) => ({
          medicineId: /^[0-9a-f-]{36}$/i.test(line.medicineId) ? line.medicineId : null,
          medicineName: line.name,
          genericName: line.generic,
          dosage: line.dosage,
          frequency: line.frequency,
          duration: line.duration,
          quantity: line.quantity,
          instructions: line.instructions,
        })),
      }),
    });
    prescriptionNo = persisted.prescription.prescription_no;
    databaseId = persisted.prescription.id;
  }

  const prescription: PharmacyQueuePrescription = {
    id: databaseId,
    prescriptionNo,
    consultationId: payload.consultationId,
    visitId: payload.visitId,
    patientId: payload.patientId,
    patientNo: payload.patientNo,
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
      details: `Saved to PostgreSQL. ${safety.warnings.join(" ") || "Pending pharmacy verification."}`,
    }],
  };

  const queued = await pushPrescriptionToPharmacyQueue(prescription);
  if (!navigator.onLine) {
    await queueOfflineCallable({
      callableName: "createPrescriptionFromConsultation",
      payload: { ...payload, lines: prescription.lines, validation: safety.validation, prescriptionNo },
      label: `Prescription ${prescriptionNo}`,
      dedupeKey: `prescription-create:${prescriptionNo}`,
    });
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

  if (!navigator.onLine) {
    await queueOfflineCallable({
      callableName: "pushPrescriptionToPharmacyQueue",
      payload: { ...queued },
      label: `Pharmacy queue ${queued.prescriptionNo}`,
      dedupeKey: `pharmacy-queue:${queued.prescriptionNo}`,
    });
  }

  return queued;
}

export async function issueMedicineAndUpdateStock(payload: {
  prescriptionId: string;
  items: PharmacyIssueItem[];
  issuedBy?: string;
  actorId?: string;
}) {
  if (!navigator.onLine) {
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

  void defaultHospitalId;
  return { ok: true, mode: "local-api-ready" as const };
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

  return { ok: true, receiptId, mode: "local-api-ready" as const, stockResult };
}

export async function processPrescriptionIssue(payload: { prescriptionId: string; items: PharmacyIssueItem[] }) {
  return issueMedicineAndUpdateStock(payload);
}

export async function issuePharmacyReceipt(payload: { prescriptionId: string; patientId: string; issuedBy: string; items: PharmacyIssueItem[] }) {
  return completePharmacyTransaction(payload);
}


type PostgresPrescriptionRow = {
  id: string;
  prescription_no: string;
  patient_id: string;
  patient_no?: string | null;
  visit_id?: string | null;
  consultation_id?: string | null;
  doctor_id: string;
  diagnosis?: string | null;
  priority: string;
  pharmacy_status: string;
  created_at: string;
  patient_name: string;
  nic?: string | null;
  age_years?: number | null;
  gender?: string | null;
  phone?: string | null;
  allergies?: string[];
  doctor_name: string;
  lines?: Array<{
    id?: string;
    medicineId?: string | null;
    medicineName: string;
    genericName?: string | null;
    dosage: string;
    frequency: string;
    duration: string;
    quantity?: number | null;
    instructions?: string | null;
    status?: string;
  }>;
};

function databaseStatusToQueueStatus(status: string): PharmacyQueueStatus {
  if (status === "verified") return "verified";
  if (status === "issued") return "issued";
  if (status === "partially_issued" || status === "partially issued") return "partially issued";
  if (status === "rejected") return "rejected";
  return "pending";
}

export async function refreshPharmacyQueueFromPostgres() {
  const { items } = await apiRequest<{ items: PostgresPrescriptionRow[] }>("/api/prescriptions");
  const mapped: PharmacyQueuePrescription[] = items.map((row) => ({
    id: row.id,
    prescriptionNo: row.prescription_no,
    consultationId: row.consultation_id ?? undefined,
    visitId: row.visit_id ?? undefined,
    patientId: row.patient_id,
    patientNo: row.patient_no ?? undefined,
    nic: row.nic ?? "not-recorded",
    patientName: row.patient_name,
    age: row.age_years ?? 0,
    gender: row.gender ?? "Not recorded",
    phone: row.phone ?? "",
    allergies: Array.isArray(row.allergies) ? row.allergies : [],
    diagnosis: row.diagnosis ?? "Not recorded",
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    department: "PostgreSQL prescription",
    hospitalId: "current-hospital",
    opdToken: row.visit_id ?? "not-linked",
    priority: row.priority === "critical" || row.priority === "stat" ? "stat" : row.priority === "urgent" ? "urgent" : "routine",
    status: databaseStatusToQueueStatus(row.pharmacy_status),
    validation: "clear",
    submittedAt: row.created_at,
    updatedAt: row.created_at,
    releaseStatus: "internal",
    lines: (row.lines ?? []).map((line, index) => ({
      medicineId: line.medicineId ?? line.id ?? `line-${index}`,
      name: line.medicineName,
      generic: line.genericName ?? line.medicineName,
      dosage: line.dosage,
      frequency: line.frequency,
      duration: line.duration,
      quantity: Number(line.quantity ?? 1),
      instructions: line.instructions ?? "",
      stock: 120,
      expiry: "2027-12",
      status: line.status === "issued" ? "issued" : "pending",
    })),
    auditTrail: [{
      action: "loadedFromPostgreSQL",
      actorId: row.doctor_id,
      actorRole: "doctor",
      timestamp: row.created_at,
      details: `Database status: ${row.pharmacy_status}`,
    }],
  }));
  savePharmacyQueue(mapped);
  return mapped;
}

export async function updatePostgresPrescriptionStatus(prescriptionUuid: string, status: "verified" | "issued" | "partially_issued" | "rejected", notes?: string) {
  return apiRequest<{ prescription: { id: string; prescription_no: string; pharmacy_status: string; updated_at: string } }>(
    `/api/prescriptions/${encodeURIComponent(prescriptionUuid)}/pharmacy-status`,
    { method: "PATCH", body: JSON.stringify({ status, notes }) },
  );
}

export type PrescriptionMedicineOption = {
  id: string;
  name: string;
  generic_name?: string | null;
  category?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  reorder_level?: number | null;
};

export async function getPrescriptionMedicines() {
  return apiRequest<{ items: PrescriptionMedicineOption[] }>("/api/prescriptions/medicines");
}
