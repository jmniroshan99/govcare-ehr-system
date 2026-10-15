import { apiRequest } from "./apiClient";
import type { WardSummary } from "../types/ward";

export interface FacilityTotals {
  activeHospitals: number;
  activeWards: number;
  totalBeds: number;
  availableBeds: number;
}

export interface HospitalFacility {
  id: string;
  code: string;
  name: string;
  type: string;
  city?: string;
  district?: string;
  province?: string;
  address?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  status: string;
  createdAt: string;
  departmentCount: number;
  wardCount: number;
  bedCount: number;
  availableBedCount: number;
}

export interface FacilityOverview {
  totals: FacilityTotals;
  hospitals: HospitalFacility[];
}

export interface HospitalInput {
  code: string;
  name: string;
  type: string;
  city: string;
  district: string;
  province: string;
  address: string;
  phone: string;
  email: string;
  directorName: string;
  provisionCoreDepartments: boolean;
}

export interface WardInput {
  hospitalId: string;
  departmentId?: string;
  wardCode: string;
  wardName: string;
  wardType: string;
  building: string;
  floor: string;
  genderRestriction: string;
  ageRestriction: string;
  isolationCapable: boolean;
  status: "ACTIVE";
}

export interface BulkBedInput {
  roomId?: string;
  numberPrefix: string;
  codePrefix?: string;
  startNumber: number;
  count: number;
  padding: number;
  bedType: string;
  genderRestriction: string;
  ageRestriction: string;
  isolationSupport: boolean;
  oxygenSupport: boolean;
  ventilatorSupport: boolean;
  monitorSupport: boolean;
  electricBed: boolean;
  accessibleBed: boolean;
}

export interface WardRoom {
  id: string;
  roomNumber: string;
  roomName?: string;
  maximumBeds: number;
  bedCount: number;
  availableBeds: number;
  status: string;
}

export function getFacilityOverview(signal?: AbortSignal) {
  return apiRequest<FacilityOverview>("/api/admin/facilities", { signal });
}

export function createHospital(input: HospitalInput) {
  return apiRequest<{ hospital: HospitalFacility; coreDepartmentsCreated: number }>("/api/admin/facilities/hospitals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createFacilityWard(input: WardInput) {
  return apiRequest<{ ward: Pick<WardSummary, "id" | "wardCode" | "wardName" | "hospitalId"> }>("/api/wards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBulkBeds(wardId: string, input: BulkBedInput) {
  return apiRequest<{ wardId: string; createdCount: number; items: Array<{ id: string; bedNumber: string; bedCode: string; bedType: string; status: string }> }>(`/api/wards/${encodeURIComponent(wardId)}/beds/bulk`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getWardRooms(wardId: string) {
  return (await apiRequest<{ items: WardRoom[] }>(`/api/wards/${encodeURIComponent(wardId)}/rooms`)).items;
}
