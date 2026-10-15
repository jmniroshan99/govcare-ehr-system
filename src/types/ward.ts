export type BedStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "CLEANING"
  | "BLOCKED"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE"
  | "INFECTION_CONTROL"
  | "PENDING_DISCHARGE";

export interface WardSummary {
  id: string;
  hospitalId: string;
  hospitalName?: string;
  departmentId?: string;
  departmentName?: string;
  wardCode: string;
  wardName: string;
  wardType: string;
  category?: string;
  building?: string;
  floor?: string;
  genderRestriction?: string;
  ageRestriction?: string;
  isolationCapable: boolean;
  nurseStation?: string;
  phone?: string;
  status: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  cleaningBeds: number;
  blockedBeds: number;
  maintenanceBeds: number;
  isolationBeds?: number;
  occupancyPercent: number;
}

export interface BedBoardSummary {
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  cleaningBeds: number;
  blockedBeds: number;
  maintenanceBeds: number;
  isolationBeds?: number;
  occupancyPercent: number;
}

export interface WardDashboardResponse {
  hospitalId: string;
  summary: BedBoardSummary;
  wards: WardSummary[];
}

export interface WardBed {
  id: string;
  hospitalId: string;
  wardId: string;
  roomId?: string;
  bedNumber: string;
  bedCode: string;
  bedType: string;
  status: BedStatus;
  genderRestriction?: string;
  ageRestriction?: string;
  isolationSupport: boolean;
  oxygenSupport: boolean;
  ventilatorSupport: boolean;
  monitorSupport: boolean;
  electricBed: boolean;
  accessibleBed: boolean;
  currentPatientId?: string;
  currentAdmissionId?: string;
  reservedPatientId?: string;
  reservedUntil?: string;
  blockedReason?: string;
  wardName: string;
  wardCode: string;
  roomNumber?: string;
  roomName?: string;
  patientNumber?: string;
  patientName?: string;
  patientGender?: string;
  patientDateOfBirth?: string;
  admissionNumber?: string;
  admittedAt?: string;
  responsibleDoctor?: string;
}

export interface BedSuggestion extends WardBed {
  score: number;
  suitable: boolean;
  reasons: string[];
  warnings: string[];
}

export interface InternalTransfer {
  id: string;
  hospitalId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  admissionId: string;
  admissionNumber: string;
  sourceWardId: string;
  sourceWardName: string;
  sourceBedId: string;
  sourceBedCode: string;
  destinationWardId: string;
  destinationWardName: string;
  destinationBedId?: string;
  destinationBedCode?: string;
  transferReason: string;
  priority: string;
  clinicalNotes?: string;
  isolationRequired: boolean;
  transportAssistanceRequired: boolean;
  status: string;
  requestedByName?: string;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancellationReason?: string;
}
