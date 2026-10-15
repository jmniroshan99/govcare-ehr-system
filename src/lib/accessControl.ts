import { roleLabels } from "./rbac";
import { canAccessPath, defaultRouteByRole } from "./roleAccess";
import type { AppUser, Role } from "../types/ehr";

export const activeAccountStatuses = ["active"] as const;
export const inactiveAccountStatuses = ["inactive", "suspended", "blocked", "archived", "cancelled"] as const;

export const roleHome = defaultRouteByRole;

export const roleModuleSummary: Record<Role, string[]> = {
  super_admin: ["All hospitals", "Users", "Roles", "Security", "Audit logs", "Backups"],
  hospital_admin: ["Users", "Departments", "Reports", "Settings", "Hospital operations"],
  doctor: ["Doctor Center", "Consultations", "Prescriptions", "Lab/Radiology requests", "Assigned patients"],
  surgeon: ["Operation Theatre", "Surgery notes", "Blood requests", "Post-op care"],
  anesthetist: ["Theatre list", "Anesthesia notes", "Patient safety", "Approvals"],
  nurse: ["Ward patients", "Vitals", "Nursing notes", "MAR", "Care tasks"],
  pharmacist: ["Prescriptions", "Medicine issue", "Stock", "Expiry alerts"],
  pathologist: ["Lab approvals", "Signed reports", "Critical results"],
  lab_manager: ["LIMS dashboard", "Work queues", "Lab reports", "Productivity"],
  lab_technician: ["Lab requests", "Sample collection", "Result entry"],
  radiologist: ["Radiology dashboard", "Reports", "DICOM review", "Critical findings"],
  radiology_technician: ["Scan queue", "Scheduling", "Uploads", "Technician notes"],
  receptionist: ["Patient registration", "OPD queue", "Appointments", "QR tickets"],
  mortuary_officer: ["Mortuary cases", "Body release", "Certificates"],
  ict_admin: ["API health", "Deployments", "Background jobs", "Backups", "Security status"],
  records_officer: ["Patient registration", "Patient search", "Patient profiles", "QR and barcode printing"],
  opd_officer: ["OPD intelligence", "Live queue", "Waiting-time analytics", "Appointments"],
  ward_manager: ["Ward intelligence", "Bed capacity", "Admissions", "Transfers"],
  inventory_officer: ["Inventory intelligence", "Stock status", "Expiry risk", "Reorder exposure"],
  finance_officer: ["Finance intelligence", "Reports", "Source readiness"],
  emergency_staff: ["Emergency intelligence", "Critical queue", "Emergency admissions", "ICU/HDU capacity"],
  quality_officer: ["Quality intelligence", "Wait-time indicators", "Critical results", "Audit trends"],
  guardian: ["Linked patients", "Appointments", "Reports", "Secure communication"],
  patient: ["Profile", "Appointments", "Prescriptions", "Lab results", "Radiology reports", "Telemedicine", "Secure chat"],
};

export function isActiveAccount(profile: AppUser | null | undefined) {
  return Boolean(profile && activeAccountStatuses.includes(profile.status as "active"));
}

export function defaultHomeForRole(role: Role) {
  return roleHome[role] ?? "/";
}

export function defaultHomeForProfile(profile: AppUser) {
  const requested = profile.defaultRoute?.trim();
  if (requested && canAccessPath(profile, requested)) return requested;
  const roleDefault = defaultHomeForRole(profile.role);
  // A stale database default must never send a user to an inaccessible page.
  return canAccessPath(profile, roleDefault) ? roleDefault : "/profile";
}

export function loginDestinationForProfile(profile: AppUser) {
  return profile.mustChangePassword ? "/change-temporary-password" : defaultHomeForProfile(profile);
}

export function authorizationContextKey(profile: AppUser | null | undefined) {
  if (!profile) return "signed-out";
  return JSON.stringify([profile.uid, profile.role, profile.hospitalId, profile.departmentId, profile.patientId,
    profile.status, profile.mustChangePassword, [...(profile.permissions ?? [])].sort()]);
}

export function permissionListFor(profile: AppUser | null | undefined) {
  if (!profile) return [];
  // Permissions are issued by the Spring Boot API from PostgreSQL role_permissions.
  // Do not grant frontend fallback permissions when the backend returns none.
  return profile.permissions ?? [];
}

export function hasPermission(profile: AppUser | null | undefined, permission: string) {
  const allowed = permissionListFor(profile);
  return allowed.includes("*") || allowed.includes(permission);
}

export function roleDisplay(profile: AppUser | null | undefined) {
  return profile ? roleLabels[profile.role] : "No role";
}
