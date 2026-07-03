import { permissions, roleLabels } from "./rbac";
import type { AppUser, Role } from "../types/ehr";

export const activeAccountStatuses = ["active"] as const;
export const inactiveAccountStatuses = ["inactive", "suspended", "blocked", "archived", "cancelled"] as const;

export const roleHome: Record<Role, string> = {
  super_admin: "/super-admin",
  hospital_admin: "/admin/users",
  doctor: "/doctor",
  surgeon: "/operation-theatre",
  anesthetist: "/operation-theatre",
  nurse: "/nurse-notes",
  pharmacist: "/pharmacy",
  pathologist: "/laboratory",
  lab_manager: "/laboratory",
  lab_technician: "/laboratory",
  radiologist: "/radiology",
  radiology_technician: "/radiology",
  receptionist: "/opd",
  mortuary_officer: "/mortuary",
  ict_admin: "/settings",
  records_officer: "/reports",
  patient: "/portal",
};

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
  ict_admin: ["App Check", "Hosting", "Functions", "Backups", "Security status"],
  records_officer: ["Patient records", "Reports", "Exports", "Audit read"],
  patient: ["Profile", "Appointments", "Prescriptions", "Lab results", "Radiology reports", "Telemedicine", "Secure chat"],
};

export function isActiveAccount(profile: AppUser | null | undefined) {
  return Boolean(profile && activeAccountStatuses.includes(profile.status as "active"));
}

export function defaultHomeForRole(role: Role) {
  return roleHome[role] ?? "/";
}

export function permissionListFor(profile: AppUser | null | undefined) {
  if (!profile) return [];
  return profile.permissions?.length ? profile.permissions : permissions[profile.role] ?? [];
}

export function hasPermission(profile: AppUser | null | undefined, permission: string) {
  const allowed = permissionListFor(profile);
  return allowed.includes("*") || allowed.includes(permission) || allowed.some((item) => item.endsWith(":*") && permission.startsWith(item.replace("*", "")));
}

export function roleDisplay(profile: AppUser | null | undefined) {
  return profile ? roleLabels[profile.role] : "No role";
}
