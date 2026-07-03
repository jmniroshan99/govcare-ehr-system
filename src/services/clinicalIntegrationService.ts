import { addDoc, collection, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Role } from "../types/ehr";
import { addNotification } from "../utils/notifications";

export const CLINICAL_INTEGRATION_STORAGE_KEY = "govcare.clinicalIntegration";
export const CLINICAL_INTEGRATION_UPDATED_EVENT = "govcare:clinical-integration-updated";

export type VisitSource = "registration" | "opd" | "clinic" | "emergency" | "ward" | "telemedicine";
export type VisitWorkflowStatus = "registered" | "queued" | "assigned" | "in-consultation" | "completed" | "cancelled";
export type OrderPriority = "routine" | "urgent" | "stat" | "critical";
export type OrderStatus = "requested" | "accepted" | "in-progress" | "resulted" | "approved" | "released" | "cancelled";
export type BillingStatus = "pending" | "paid" | "refunded" | "waived";

export interface PatientIdentitySnapshot {
  patientId: string;
  patientName: string;
  nic?: string;
  qrReference?: string;
  age?: number;
  gender?: string;
  phone?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  hospitalId: string;
}

export interface IntegratedVisit {
  id: string;
  visitId: string;
  patientId: string;
  hospitalId: string;
  source: VisitSource;
  department: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  tokenNo?: string;
  reason: string;
  priority: OrderPriority;
  status: VisitWorkflowStatus;
  billingInvoiceId?: string;
  patient: PatientIdentitySnapshot;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface IntegratedDiagnosticOrder {
  id: string;
  orderId: string;
  visitId: string;
  patientId: string;
  hospitalId: string;
  kind: "laboratory" | "radiology";
  department: string;
  testOrProcedure: string;
  clinicalReason: string;
  priority: OrderPriority;
  status: OrderStatus;
  releaseStatus: "internal" | "approved" | "released";
  requestedBy: string;
  requestedByName: string;
  patient: PatientIdentitySnapshot;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface IntegratedBillingInvoice {
  id: string;
  invoiceNo: string;
  visitId?: string;
  patientId: string;
  hospitalId: string;
  sourceModule: "opd" | "pharmacy" | "laboratory" | "radiology" | "ward" | "emergency";
  description: string;
  amount: number;
  status: BillingStatus;
  releaseStatus: "internal" | "released";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface IntegratedAuditLog {
  id: string;
  hospitalId: string;
  patientId?: string;
  visitId?: string;
  actorUid: string;
  actorRole: Role;
  action: "create" | "update" | "dispense" | "approve" | "cancel" | "discharge" | "billing" | "release";
  collectionName: string;
  documentId: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

export interface ClinicalIntegrationState {
  visits: IntegratedVisit[];
  labOrders: IntegratedDiagnosticOrder[];
  radiologyOrders: IntegratedDiagnosticOrder[];
  billingInvoices: IntegratedBillingInvoice[];
  auditLogs: IntegratedAuditLog[];
}

const defaultState: ClinicalIntegrationState = {
  visits: [],
  labOrders: [],
  radiologyOrders: [],
  billingInvoices: [],
  auditLogs: [],
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitUpdate() {
  if (!canUseBrowserStorage()) return;
  window.dispatchEvent(new CustomEvent(CLINICAL_INTEGRATION_UPDATED_EVENT));
}

export function getClinicalIntegrationState(): ClinicalIntegrationState {
  if (!canUseBrowserStorage()) return defaultState;
  try {
    const raw = window.localStorage.getItem(CLINICAL_INTEGRATION_STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } as ClinicalIntegrationState : defaultState;
  } catch {
    return defaultState;
  }
}

function saveClinicalIntegrationState(state: ClinicalIntegrationState) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(CLINICAL_INTEGRATION_STORAGE_KEY, JSON.stringify(state));
  emitUpdate();
}

async function mirrorToFirestore(collectionName: string, id: string, payload: Record<string, unknown>) {
  if (!db || !navigator.onLine || import.meta.env.DEV) return;
  await setDoc(doc(db, collectionName, id), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function addFirestoreAuditLog(log: IntegratedAuditLog) {
  if (!db || !navigator.onLine || import.meta.env.DEV) return;
  await addDoc(collection(db, "auditLogs"), {
    ...log,
    timestamp: serverTimestamp(),
  });
}

export async function recordIntegrationAudit(log: Omit<IntegratedAuditLog, "id" | "timestamp">) {
  const entry: IntegratedAuditLog = { ...log, id: createId("AUD"), timestamp: nowIso() };
  const state = getClinicalIntegrationState();
  state.auditLogs.unshift(entry);
  saveClinicalIntegrationState(state);
  await addFirestoreAuditLog(entry);
  return entry;
}

export async function createIntegratedOpdVisit(payload: {
  patient: PatientIdentitySnapshot;
  department: string;
  doctorId: string;
  doctorName: string;
  tokenNo: string;
  reason: string;
  priority: OrderPriority;
  createdBy: string;
  actorRole: Role;
}) {
  const timestamp = nowIso();
  const visitId = createId("VIS");
  const invoiceNo = createId("INV");
  const visit: IntegratedVisit = {
    id: visitId,
    visitId,
    patientId: payload.patient.patientId,
    hospitalId: payload.patient.hospitalId,
    source: "opd",
    department: payload.department,
    assignedDoctorId: payload.doctorId,
    assignedDoctorName: payload.doctorName,
    tokenNo: payload.tokenNo,
    reason: payload.reason,
    priority: payload.priority,
    status: "queued",
    billingInvoiceId: invoiceNo,
    patient: payload.patient,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: payload.createdBy,
    updatedBy: payload.createdBy,
  };
  const invoice: IntegratedBillingInvoice = {
    id: invoiceNo,
    invoiceNo,
    visitId,
    patientId: payload.patient.patientId,
    hospitalId: payload.patient.hospitalId,
    sourceModule: "opd",
    description: `OPD registration and queue token ${payload.tokenNo}`,
    amount: 0,
    status: "waived",
    releaseStatus: "released",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: payload.createdBy,
    updatedBy: payload.createdBy,
  };
  const state = getClinicalIntegrationState();
  state.visits.unshift(visit);
  state.billingInvoices.unshift(invoice);
  saveClinicalIntegrationState(state);
  await mirrorToFirestore("visits", visitId, visit as unknown as Record<string, unknown>);
  await mirrorToFirestore("billingInvoices", invoiceNo, invoice as unknown as Record<string, unknown>);
  await recordIntegrationAudit({
    hospitalId: payload.patient.hospitalId,
    patientId: payload.patient.patientId,
    visitId,
    actorUid: payload.createdBy,
    actorRole: payload.actorRole,
    action: "create",
    collectionName: "visits",
    documentId: visitId,
    after: visit,
  });
  addNotification({
    title: "OPD visit created",
    message: `${payload.tokenNo} linked to ${payload.patient.patientName} and sent to Doctor Center.`,
    module: "OPD",
    priority: payload.priority === "critical" ? "critical" : payload.priority === "urgent" ? "urgent" : "information",
    roles: ["doctor", "nurse", "receptionist", "hospital_admin"],
    channels: ["in-app", "push"],
    group: "OPD Queue",
    actionHref: "/doctor",
  });
  return { visit, invoice };
}

export async function createDiagnosticOrdersFromConsultation(payload: {
  visitId: string;
  patient: PatientIdentitySnapshot;
  labRequests: string;
  radiologyRequests: string;
  clinicalReason: string;
  labPriority: OrderPriority;
  radiologyPriority: OrderPriority;
  doctorId: string;
  doctorName: string;
  department: string;
}) {
  const timestamp = nowIso();
  const makeOrder = (kind: "laboratory" | "radiology", request: string, priority: OrderPriority): IntegratedDiagnosticOrder => {
    const orderId = createId(kind === "laboratory" ? "LAB" : "RAD");
    return {
      id: orderId,
      orderId,
      visitId: payload.visitId,
      patientId: payload.patient.patientId,
      hospitalId: payload.patient.hospitalId,
      kind,
      department: payload.department,
      testOrProcedure: request,
      clinicalReason: payload.clinicalReason,
      priority,
      status: "requested",
      releaseStatus: "internal",
      requestedBy: payload.doctorId,
      requestedByName: payload.doctorName,
      patient: payload.patient,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: payload.doctorId,
      updatedBy: payload.doctorId,
    };
  };

  const labOrders = payload.labRequests.split(",").map((item) => item.trim()).filter(Boolean).map((item) => makeOrder("laboratory", item, payload.labPriority));
  const radiologyOrders = payload.radiologyRequests.split(",").map((item) => item.trim()).filter(Boolean).map((item) => makeOrder("radiology", item, payload.radiologyPriority));
  const state = getClinicalIntegrationState();
  state.labOrders.unshift(...labOrders);
  state.radiologyOrders.unshift(...radiologyOrders);
  saveClinicalIntegrationState(state);

  for (const order of labOrders) await mirrorToFirestore("labOrders", order.orderId, order as unknown as Record<string, unknown>);
  for (const order of radiologyOrders) await mirrorToFirestore("radiologyOrders", order.orderId, order as unknown as Record<string, unknown>);
  for (const order of [...labOrders, ...radiologyOrders]) {
    await recordIntegrationAudit({
      hospitalId: order.hospitalId,
      patientId: order.patientId,
      visitId: order.visitId,
      actorUid: payload.doctorId,
      actorRole: "doctor",
      action: "create",
      collectionName: order.kind === "laboratory" ? "labOrders" : "radiologyOrders",
      documentId: order.orderId,
      after: order,
    });
  }

  if (labOrders.length) {
    addNotification({
      title: "New laboratory request",
      message: `${labOrders.length} lab order(s) received for ${payload.patient.patientName}.`,
      module: "Laboratory",
      priority: payload.labPriority === "critical" || payload.labPriority === "stat" ? "critical" : "information",
      roles: ["pathologist", "lab_manager", "lab_technician", "doctor"],
      channels: ["in-app", "push"],
      group: "Laboratory",
      actionHref: "/laboratory",
    });
  }
  if (radiologyOrders.length) {
    addNotification({
      title: "New radiology request",
      message: `${radiologyOrders.length} imaging order(s) received for ${payload.patient.patientName}.`,
      module: "Radiology",
      priority: payload.radiologyPriority === "critical" || payload.radiologyPriority === "stat" ? "critical" : "information",
      roles: ["radiologist", "radiology_technician", "doctor"],
      channels: ["in-app", "push"],
      group: "Radiology",
      actionHref: "/radiology",
    });
  }

  return { labOrders, radiologyOrders };
}

export async function updateDiagnosticOrderStatus(orderId: string, kind: "laboratory" | "radiology", update: Partial<Pick<IntegratedDiagnosticOrder, "status" | "releaseStatus" | "resultSummary">>, actorUid: string, actorRole: Role) {
  const state = getClinicalIntegrationState();
  const bucket = kind === "laboratory" ? state.labOrders : state.radiologyOrders;
  const previous = bucket.find((order) => order.orderId === orderId);
  if (!previous) return null;
  const next = { ...previous, ...update, updatedAt: nowIso(), updatedBy: actorUid };
  const index = bucket.findIndex((order) => order.orderId === orderId);
  bucket[index] = next;
  saveClinicalIntegrationState(state);
  await mirrorToFirestore(kind === "laboratory" ? "labOrders" : "radiologyOrders", orderId, next as unknown as Record<string, unknown>);
  await recordIntegrationAudit({
    hospitalId: next.hospitalId,
    patientId: next.patientId,
    visitId: next.visitId,
    actorUid,
    actorRole,
    action: update.releaseStatus === "released" ? "release" : "update",
    collectionName: kind === "laboratory" ? "labOrders" : "radiologyOrders",
    documentId: orderId,
    before: previous,
    after: next,
  });
  return next;
}

export function getIntegratedPatientTimeline(patientId: string) {
  const state = getClinicalIntegrationState();
  return [
    ...state.visits.filter((item) => item.patientId === patientId).map((item) => ({ date: item.createdAt, type: "Visit", title: item.reason, status: item.status })),
    ...state.labOrders.filter((item) => item.patientId === patientId).map((item) => ({ date: item.createdAt, type: "Lab", title: item.testOrProcedure, status: item.status })),
    ...state.radiologyOrders.filter((item) => item.patientId === patientId).map((item) => ({ date: item.createdAt, type: "Radiology", title: item.testOrProcedure, status: item.status })),
    ...state.billingInvoices.filter((item) => item.patientId === patientId).map((item) => ({ date: item.createdAt, type: "Billing", title: item.description, status: item.status })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

