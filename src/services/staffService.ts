import { apiRequest } from "./apiClient";
import type {
  CreateStaffInput,
  DepartmentOption,
  StaffAuditRecord,
  StaffListResponse,
  StaffMember,
  StaffOptionsResponse,
  StaffRole,
} from "../types/staff";

export type StaffFilters = {
  search?: string;
  hospitalId?: string;
  departmentId?: string;
  role?: StaffRole | "";
  status?: string;
  page?: number;
  size?: number;
};

export async function listStaff(filters: StaffFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 0));
  params.set("size", String(filters.size ?? 20));
  return apiRequest<StaffListResponse>(`/api/admin/staff?${params.toString()}`);
}

export async function getStaffOptions() {
  return apiRequest<StaffOptionsResponse>("/api/admin/staff/options");
}

export async function getStaff(id: string) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}`);
}


export async function listHospitalDepartments(hospitalId: string) {
  return apiRequest<{ items: DepartmentOption[] }>(`/api/admin/hospitals/${encodeURIComponent(hospitalId)}/departments`);
}

export async function createStaff(input: CreateStaffInput) {
  return apiRequest<{ staff: StaffMember }>("/api/admin/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateStaff(id: string, input: Partial<CreateStaffInput> & { workStatus?: string }) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function changeStaffRole(id: string, roleCode: StaffRole) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleCode }),
  });
}

export async function changeStaffDepartment(id: string, departmentId: string | null) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}/department`, {
    method: "PATCH",
    body: JSON.stringify({ departmentId }),
  });
}

export async function changeStaffStatus(id: string, active: boolean) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function transferStaff(id: string, hospitalId: string, departmentId: string | null) {
  return apiRequest<{ staff: StaffMember }>(`/api/admin/staff/${encodeURIComponent(id)}/transfer`, {
    method: "PATCH",
    body: JSON.stringify({ hospitalId, departmentId }),
  });
}

export async function resetStaffPassword(id: string, temporaryPassword: string) {
  return apiRequest<{ staffId: string; temporaryPassword: string; passwordShownOnce: boolean }>(
    `/api/admin/staff/${encodeURIComponent(id)}/reset-password`,
    { method: "POST", body: JSON.stringify({ temporaryPassword }) },
  );
}

export async function getStaffAuditHistory(id: string) {
  return apiRequest<{ items: StaffAuditRecord[] }>(`/api/admin/staff/${encodeURIComponent(id)}/audit`);
}
