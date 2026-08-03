import type { AppUser, Role } from "../types/ehr";
import { apiRequest } from "./apiClient";

export type UserAccountFilters = {
  search?: string;
  role?: Role | "";
  status?: string;
  limit?: number;
};

export type UserRecordSummary = {
  loginCount: number;
  auditCount: number;
  visitCount: number;
  appointmentCount: number;
  prescriptionCount: number;
  labRequestCount: number;
  radiologyRequestCount: number;
  admissionCount: number;
};

export type UserActivityRecord = {
  id: string;
  type: "audit" | "login";
  title: string;
  detail?: string;
  createdAt: string;
};

export type UserAccountDetail = {
  user: AppUser & { lastLoginAt?: string | null };
  summary: UserRecordSummary;
  activity: UserActivityRecord[];
};

export type DepartmentOption = {
  id: string;
  code: string;
  name: string;
  type?: string;
  status: string;
};

export type UpdateUserAccountInput = {
  fullName?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
  phone?: string | null;
  address?: string | null;
  permissions?: string[];
  mfaEnabled?: boolean;
  status?: "active" | "inactive" | "pending" | "completed" | "cancelled" | "suspended" | "blocked" | "archived";
};

export type CreateUserAccountInput = Required<Pick<UpdateUserAccountInput, "fullName" | "email" | "role">> & UpdateUserAccountInput;

export async function listUserAccounts(filters: UserAccountFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  params.set("limit", String(filters.limit ?? 100));
  return apiRequest<{ items: AppUser[] }>(`/api/users?${params.toString()}`);
}

export async function getUserAccount(id: string) {
  return apiRequest<UserAccountDetail>(`/api/users/${encodeURIComponent(id)}`);
}

export async function updateUserAccount(id: string, input: UpdateUserAccountInput) {
  return apiRequest<{ user: AppUser }>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function createUserAccount(input: CreateUserAccountInput) {
  return apiRequest<{ user: AppUser }>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDepartments() {
  return apiRequest<{ items: DepartmentOption[] }>("/api/users/departments");
}
