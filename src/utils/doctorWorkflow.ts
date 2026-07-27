import type { Role } from "../types/ehr";
import { addNotification } from "./notifications";

export type VisitStatus = "Waiting" | "Currently Checking" | "Checked" | "Consulted" | "Completed";

export interface DoctorQueueVisit {
  visitId: string;
  tokenNo: string;
  patientId: string;
  patientName: string;
  patientGender?: string;
  patientAge?: number;
  reason: string;
  department: string;
  assignedDoctorId: string;
  assignedDoctorName: string;
  hospitalId: string;
  priority: "routine" | "urgent" | "critical" | "follow-up";
  status: VisitStatus;
  arrivalTime: string;
  updatedAt: string;
  followUpDate?: string;
  checkedAt?: string;
}

export interface CompletedConsultation {
  id: string;
  visitId: string;
  tokenNo: string;
  patientId: string;
  patientName: string;
  patientGender?: string;
  patientAge?: number;
  status: Extract<VisitStatus, "Checked" | "Consulted" | "Completed">;
  consultationNotes: string;
  symptoms: string;
  examination: string;
  diagnosis: string;
  prescription: string;
  labRequests: string;
  radiologyRequests: string;
  treatmentPlan: string;
  followUpDate: string;
  doctorId: string;
  doctorName: string;
  department: string;
  hospitalId: string;
  timestamp: string;
}

interface WorkflowState {
  activeQueue: DoctorQueueVisit[];
  completedConsultations: CompletedConsultation[];
  auditLogs: Array<{ id: string; action: string; actorRole: Role; actorId: string; visitId: string; timestamp: string }>;
}

const STORAGE_KEY = "govcare-doctor-check-workflow";
export const DOCTOR_WORKFLOW_UPDATED_EVENT = "govcare:doctor-workflow-updated";

const seedQueue: DoctorQueueVisit[] = [
  { visitId: "VIS-OPD-126", tokenNo: "OPD-126", patientId: "PAT-2026-000001", patientName: "Nimal Silva", patientGender: "Male", patientAge: 44, reason: "Fever, cough", department: "Medical OPD", assignedDoctorId: "demo-doctor", assignedDoctorName: "Dr. Anjali Perera", hospitalId: "hosp-colombo-national", priority: "urgent", status: "Waiting", arrivalTime: "2026-06-14T08:30:00+05:30", updatedAt: "2026-06-14T08:30:00+05:30" },
  { visitId: "VIS-OPD-127", tokenNo: "OPD-127", patientId: "PAT-2026-000142", patientName: "Fathima Rizna", patientGender: "Female", patientAge: 33, reason: "Antenatal review", department: "Antenatal", assignedDoctorId: "demo-doctor", assignedDoctorName: "Dr. Anjali Perera", hospitalId: "hosp-colombo-national", priority: "critical", status: "Waiting", arrivalTime: "2026-06-14T08:42:00+05:30", updatedAt: "2026-06-14T08:42:00+05:30" },
  { visitId: "VIS-ED-034", tokenNo: "ED-034", patientId: "PAT-2026-000233", patientName: "K. Thevarajah", patientGender: "Male", patientAge: 54, reason: "Chest pain", department: "Emergency", assignedDoctorId: "demo-doctor", assignedDoctorName: "Dr. Anjali Perera", hospitalId: "hosp-colombo-national", priority: "critical", status: "Currently Checking", arrivalTime: "2026-06-14T08:48:00+05:30", updatedAt: "2026-06-14T08:55:00+05:30" },
  { visitId: "VIS-FUP-011", tokenNo: "FUP-011", patientId: "PAT-2026-000310", patientName: "R. Kumar", patientGender: "Male", patientAge: 51, reason: "Diabetes clinic follow-up", department: "Medical Clinic", assignedDoctorId: "demo-doctor", assignedDoctorName: "Dr. Anjali Perera", hospitalId: "hosp-colombo-national", priority: "follow-up", status: "Waiting", arrivalTime: "2026-06-14T09:05:00+05:30", updatedAt: "2026-06-14T09:05:00+05:30", followUpDate: "2026-06-21" },
];

function initialState(): WorkflowState {
  return { activeQueue: seedQueue, completedConsultations: [], auditLogs: [] };
}

function emitUpdate() {
  window.dispatchEvent(new CustomEvent(DOCTOR_WORKFLOW_UPDATED_EVENT));
}

export function getDoctorWorkflowState(): WorkflowState {
  if (typeof window === "undefined") return initialState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? { ...initialState(), ...JSON.parse(stored) } as WorkflowState : initialState();
  } catch {
    return initialState();
  }
}

function saveDoctorWorkflowState(state: WorkflowState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emitUpdate();
}

export function getDoctorVisitBuckets() {
  const state = getDoctorWorkflowState();
  return {
    waiting: state.activeQueue.filter((visit) => visit.status === "Waiting" && visit.priority !== "follow-up"),
    checking: state.activeQueue.filter((visit) => visit.status === "Currently Checking"),
    checked: state.completedConsultations,
    followUps: [
      ...state.activeQueue.filter((visit) => visit.priority === "follow-up"),
      ...state.completedConsultations.filter((visit) => visit.followUpDate),
    ],
  };
}

export function startCheckingVisit(visitId: string, doctorId: string, doctorName: string) {
  const state = getDoctorWorkflowState();
  const visit = state.activeQueue.find((item) => item.visitId === visitId);
  if (!visit) throw new Error("Visit was not found in the active OPD queue.");
  if (visit.status === "Currently Checking") throw new Error("This patient is already being checked. Duplicate consultation prevented.");
  const now = new Date().toISOString();
  visit.status = "Currently Checking";
  visit.assignedDoctorId = doctorId;
  visit.assignedDoctorName = doctorName;
  visit.updatedAt = now;
  state.auditLogs.unshift({ id: crypto.randomUUID(), action: "start_consultation", actorRole: "doctor", actorId: doctorId, visitId, timestamp: now });
  saveDoctorWorkflowState(state);
  return visit;
}

export function enqueueDoctorVisit(visit: DoctorQueueVisit) {
  const state = getDoctorWorkflowState();
  const existingIndex = state.activeQueue.findIndex((item) => item.visitId === visit.visitId || item.tokenNo === visit.tokenNo);
  const now = new Date().toISOString();
  const nextVisit = { ...visit, updatedAt: visit.updatedAt || now };

  if (existingIndex >= 0) {
    state.activeQueue[existingIndex] = { ...state.activeQueue[existingIndex], ...nextVisit };
  } else {
    state.activeQueue.unshift(nextVisit);
  }

  state.auditLogs.unshift({
    id: crypto.randomUUID(),
    action: "opd_visit_created",
    actorRole: "receptionist",
    actorId: "opd-reception",
    visitId: visit.visitId,
    timestamp: now,
  });
  saveDoctorWorkflowState(state);
  addNotification({
    title: "New OPD visit assigned",
    message: `${visit.tokenNo} ${visit.patientName} is ready for ${visit.assignedDoctorName}.`,
    module: "OPD",
    priority: visit.priority === "critical" ? "critical" : visit.priority === "urgent" ? "urgent" : "information",
    roles: ["doctor", "nurse", "receptionist", "hospital_admin"],
    channels: ["in-app", "push"],
    group: "OPD Queue",
    actionHref: "/doctor",
  });
  return nextVisit;
}

export function completeDoctorConsultation(payload: Omit<CompletedConsultation, "id" | "timestamp"> & { actorRole: Role }) {
  const state = getDoctorWorkflowState();
  const previousState = structuredClone(state);
  try {
    if (state.completedConsultations.some((item) => item.visitId === payload.visitId)) {
      throw new Error("This visit already has a completed consultation. Duplicate save prevented.");
    }
    const visit = state.activeQueue.find((item) => item.visitId === payload.visitId);
    if (!visit) throw new Error("Active OPD queue record was not found. Refresh and try again.");
    const now = new Date().toISOString();
    const completed: CompletedConsultation = { ...payload, id: `CON-${Date.now()}`, timestamp: now };
    state.activeQueue = state.activeQueue.filter((item) => item.visitId !== payload.visitId);
    state.completedConsultations.unshift(completed);
    state.auditLogs.unshift({ id: crypto.randomUUID(), action: "complete_consultation", actorRole: payload.actorRole, actorId: payload.doctorId, visitId: payload.visitId, timestamp: now });
    saveDoctorWorkflowState(state);
    addNotification({
      title: "Patient consultation completed",
      message: `${payload.tokenNo} ${payload.patientName} marked as ${payload.status} by ${payload.doctorName}.`,
      module: "Doctor Center",
      priority: "information",
      roles: ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer", "patient"],
      channels: ["in-app", "push"],
      group: "Consultations",
      actionHref: "/doctor",
    });
    return completed;
  } catch (error) {
    saveDoctorWorkflowState(previousState);
    throw error;
  }
}
