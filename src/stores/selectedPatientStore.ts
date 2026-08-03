import { useSyncExternalStore } from "react";

export type SelectedPatientContext = {
  patientUuid: string;
  patientNo: string;
  fullName: string;
  nic?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  allergies: string[];
  chronicDiseases: string[];
  riskFlags: string[];
  queueUuid?: string;
  tokenNo?: string;
  visitUuid?: string;
  consultationUuid?: string;
  appointmentUuid?: string;
  appointmentNo?: string;
  visitType?: string;
  hospitalId: string;
  departmentId?: string | null;
  departmentName?: string | null;
  reason?: string | null;
  verified: boolean;
};

type SelectedPatientState = {
  selectedPatient: SelectedPatientContext | null;
  setSelectedPatient: (patient: SelectedPatientContext) => void;
  clearSelectedPatient: () => void;
};

const STORAGE_KEY = "govcare-selected-patient";
const listeners = new Set<() => void>();

function loadSelectedPatient(): SelectedPatientContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelectedPatientContext) : null;
  } catch {
    return null;
  }
}

let state: SelectedPatientState;

function emit() {
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<SelectedPatientState>) {
  state = { ...state, ...next };
  emit();
}

state = {
  selectedPatient: loadSelectedPatient(),
  setSelectedPatient: (patient) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(patient));
    }
    patch({ selectedPatient: patient });
  },
  clearSelectedPatient: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    patch({ selectedPatient: null });
  },
};

export function useSelectedPatientStore<T>(selector: (current: SelectedPatientState) => T): T {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(state),
    () => selector(state),
  );
}

export function getSelectedPatient() {
  return state.selectedPatient;
}
