import type { AppUser, Role } from "../types/ehr";
import { allRoles, roleGroups } from "./rbac";

export const defaultRouteByRole: Record<Role, string> = Object.fromEntries(
  allRoles.map((role) => [role, role === "super_admin" ? "/super-admin" : roleGroups.patient.includes(role) ? "/portal" : "/"]),
) as Record<Role, string>;

type RoutePolicy = { pattern: RegExp; roles: Role[]; permissions?: string[] };
const admins: Role[] = ["super_admin", "hospital_admin"];
const clinicians: Role[] = [...admins, "doctor", "surgeon", "anesthetist"];
const wards: Role[] = [...clinicians, "nurse", "ward_manager", "emergency_staff"];
const registration: Role[] = [...admins, "receptionist", "opd_officer", "records_officer"];
const patientReaders: Role[] = [...wards, "receptionist", "opd_officer", "records_officer", "pharmacist", "lab_technician", "lab_manager", "pathologist", "radiologist", "radiology_technician", "patient", "guardian"];
const lab: Role[] = [...clinicians, "nurse", "lab_technician", "lab_manager", "pathologist"];
const radiology: Role[] = [...clinicians, "nurse", "radiologist", "radiology_technician"];
const governance: Role[] = [...admins, "ict_admin"];

// One policy drives route guards, sidebar links, search links and dashboard actions.
// Roles select workflows; permissions always come from the authenticated API profile.
// A route that has no policy is denied, including prefix lookalikes.
export const routePolicies: RoutePolicy[] = [
  { pattern: /^\/$/, roles: allRoles, permissions: ["DASHBOARD_VIEW"] },
  { pattern: /^\/super-admin$/, roles: ["super_admin"], permissions: ["DASHBOARD_VIEW"] },
  { pattern: /^\/portal$/, roles: roleGroups.patient, permissions: ["DASHBOARD_VIEW"] },
  { pattern: /^\/(profile|change-temporary-password)$/, roles: allRoles },
  { pattern: /^\/notifications$/, roles: allRoles },
  { pattern: /^\/portal\/(appointments|reports|medical-reports)$/, roles: ["patient"], permissions: ["PATIENT_VIEW_SELF"] },
  { pattern: /^\/portal\/(messages|care-summary)$/, roles: ["doctor", "nurse", "patient"], permissions: ["PATIENT_VIEW_CLINICAL", "PATIENT_VIEW_SELF"] },
  { pattern: /^\/(admin\/(staff|users)|users|user-management)$/, roles: admins, permissions: ["USER_MANAGE"] },
  { pattern: /^\/admin\/facilities$/, roles: ["super_admin"], permissions: ["HOSPITAL_MANAGE"] },
  { pattern: /^\/admin\/patient-fields$/, roles: governance, permissions: ["SETTINGS_MANAGE"] },
  { pattern: /^\/patients\/register$/, roles: registration, permissions: ["PATIENT_CREATE"] },
  { pattern: /^\/patients\/search$/, roles: [...wards, "receptionist", "opd_officer", "records_officer"], permissions: ["PATIENT_VIEW"] },
  { pattern: /^\/patients\/[^/]+\/documents$/, roles: patientReaders, permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/patients\/[^/]+$/, roles: patientReaders, permissions: ["PATIENT_VIEW", "PATIENT_VIEW_SELF"] },
  { pattern: /^\/guardians$/, roles: [...clinicians, "nurse", "receptionist", "records_officer", "patient"], permissions: ["PATIENT_VIEW", "PATIENT_VIEW_SELF"] },
  { pattern: /^\/doctor\/documents$/, roles: [...admins, "doctor", "surgeon", "anesthetist"], permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/doctor(?:\/workspace(?:\/[^/]+)?)?$/, roles: clinicians, permissions: ["CONSULTATION_VIEW"] },
  { pattern: /^\/(consultation|e-prescription)$/, roles: clinicians, permissions: ["CONSULTATION_VIEW"] },
  { pattern: /^\/opd$/, roles: [...clinicians, "nurse", "receptionist", "opd_officer", "emergency_staff"], permissions: ["QUEUE_VIEW"] },
  { pattern: /^\/appointments$/, roles: [...clinicians, "nurse", "receptionist", "opd_officer"], permissions: ["APPOINTMENT_VIEW"] },
  { pattern: /^\/nurse-notes$/, roles: [...admins, "nurse"], permissions: ["WARD_VIEW", "ADMISSION_VIEW"] },
  { pattern: /^\/admin\/wards$/, roles: [...admins, "ward_manager"], permissions: ["WARD_MANAGE"] },
  { pattern: /^\/wards\/bed-board$/, roles: wards, permissions: ["BED_VIEW"] },
  { pattern: /^\/wards$/, roles: wards, permissions: ["WARD_VIEW"] },
  { pattern: /^\/admissions\/new$/, roles: [...clinicians, "nurse", "receptionist", "emergency_staff"], permissions: ["ADMISSION_CREATE"] },
  { pattern: /^\/admissions\/bed-allocation$/, roles: wards, permissions: ["BED_ALLOCATE"] },
  { pattern: /^\/admissions$/, roles: [...wards, "receptionist", "records_officer"], permissions: ["ADMISSION_VIEW"] },
  { pattern: /^\/transfers\/internal$/, roles: wards, permissions: ["WARD_VIEW"] },
  { pattern: /^\/transfers\/inter-hospital\/incoming$/, roles: wards, permissions: ["INTER_HOSPITAL_TRANSFER_REVIEW"] },
  { pattern: /^\/transfers\/inter-hospital(?:\/outgoing)?$/, roles: wards, permissions: ["INTER_HOSPITAL_TRANSFER_CREATE"] },
  { pattern: /^\/ward\/documents$/, roles: [...admins, "doctor", "surgeon", "nurse"], permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/operation-theatre$/, roles: [...clinicians, "nurse"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/future-care$/, roles: [...clinicians, "nurse", "records_officer"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/pharmacy\/documents$/, roles: [...admins, "pharmacist"], permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/pharmacy$/, roles: [...clinicians, "pharmacist"], permissions: ["PRESCRIPTION_VIEW"] },
  { pattern: /^\/laboratory\/documents$/, roles: [...admins, "lab_technician", "lab_manager", "pathologist"], permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/laboratory(?:\/blood-reports)?$/, roles: lab, permissions: ["LAB_REQUEST_VIEW"] },
  { pattern: /^\/radiology\/documents$/, roles: [...admins, "radiologist", "radiology_technician"], permissions: ["DOCUMENT_VIEW"] },
  { pattern: /^\/radiology$/, roles: radiology, permissions: ["RADIOLOGY_REQUEST_VIEW"] },
  { pattern: /^\/emergency$/, roles: [...clinicians, "nurse", "receptionist", "emergency_staff"], permissions: ["EMERGENCY_VIEW", "QUEUE_VIEW"] },
  { pattern: /^\/mortuary$/, roles: [...clinicians, "mortuary_officer", "records_officer"], permissions: ["PATIENT_VIEW"] },
  { pattern: /^\/media$/, roles: [...roleGroups.staff, "patient"], permissions: ["MEDIA_VIEW"] },
  { pattern: /^\/reports$/, roles: roleGroups.staff, permissions: ["REPORT_VIEW"] },
  { pattern: /^\/medical-report-review$/, roles: [...clinicians, "records_officer"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/audit-logs$/, roles: [...governance, "quality_officer"], permissions: ["AUDIT_VIEW"] },
  { pattern: /^\/admin\/login-activity$/, roles: governance, permissions: ["LOGIN_ACTIVITY_VIEW"] },
  { pattern: /^\/settings$/, roles: governance, permissions: ["SETTINGS_MANAGE"] },
  { pattern: /^\/ai-cdss\/ckd\/predictive-intelligence$/, roles: ["super_admin", "doctor", "surgeon", "anesthetist"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/ai-dashboard$/, roles: [...clinicians, "pathologist"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/ai-cdss(?:\/ckd)?$/, roles: [...clinicians, "pathologist"], permissions: ["PATIENT_VIEW_CLINICAL"] },
  { pattern: /^\/efficiency$/, roles: roleGroups.staff, permissions: ["DASHBOARD_VIEW"] },
];

function policyForPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return undefined;
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return routePolicies.find((policy) => policy.pattern.test(pathname));
}

export function rolesForPath(path: string): Role[] {
  return policyForPath(path)?.roles ?? [];
}

export function canAccessPath(profile: AppUser | null | undefined, path: string): boolean {
  if (!profile || profile.status !== "active") return false;
  const policy = policyForPath(path);
  if (!policy || !policy.roles.includes(profile.role)) return false;
  const permissions = profile.permissions ?? [];
  return !policy.permissions || permissions.includes("*") || policy.permissions.some((permission) => permissions.includes(permission));
}
