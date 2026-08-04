import type { AppUser, Role } from "../types/ehr";

export const defaultRouteByRole: Record<Role, string> = {
  super_admin: "/super-admin", hospital_admin: "/admin/staff", records_officer: "/patients/register",
  receptionist: "/opd", doctor: "/doctor", surgeon: "/operation-theatre", anesthetist: "/operation-theatre",
  nurse: "/nurse-notes", pharmacist: "/pharmacy", lab_technician: "/laboratory", lab_manager: "/laboratory",
  pathologist: "/laboratory", radiology_technician: "/radiology", radiologist: "/radiology",
  mortuary_officer: "/mortuary", ict_admin: "/settings", guardian: "/portal", patient: "/portal",
};

const restrictedPrefixes: Partial<Record<Role, string[]>> = {
  records_officer: ["/patients/register", "/patients/search", "/patients/"],
  lab_technician: ["/laboratory", "/patients/", "/media", "/notifications", "/reports"],
  lab_manager: ["/laboratory", "/patients/", "/media", "/notifications", "/reports"],
  pathologist: ["/laboratory", "/patients/", "/media", "/notifications", "/reports"],
  pharmacist: ["/pharmacy", "/patients/", "/media", "/notifications", "/reports"],
  radiology_technician: ["/radiology", "/patients/", "/media", "/notifications", "/reports"],
  radiologist: ["/radiology", "/patients/", "/media", "/notifications", "/reports"],
  receptionist: ["/opd", "/appointments", "/patients/register", "/patients/search", "/patients/", "/media", "/notifications"],
  patient: ["/portal", "/patients/", "/media"],
  guardian: ["/portal", "/patients/", "/media"],
};

const pathPermission: Array<[string, string]> = [
  ["/patients/register", "PATIENT_CREATE"], ["/patients/search", "PATIENT_VIEW"], ["/patients/", "PATIENT_VIEW"],
  ["/appointments", "APPOINTMENT_VIEW"], ["/opd", "QUEUE_VIEW"], ["/doctor/workspace", "CONSULTATION_VIEW"],
  ["/doctor", "CONSULTATION_VIEW"], ["/pharmacy", "PRESCRIPTION_VIEW"], ["/laboratory", "LAB_REQUEST_VIEW"],
  ["/radiology", "RADIOLOGY_REQUEST_VIEW"], ["/admin/staff", "USER_MANAGE"], ["/audit-logs", "AUDIT_VIEW"],
  ["/admin/login-activity", "LOGIN_ACTIVITY_VIEW"], ["/settings", "SETTINGS_MANAGE"], ["/reports", "REPORT_VIEW"],
  ["/media", "MEDIA_VIEW"],
  ["/wards/bed-board", "BED_VIEW"], ["/admin/wards", "WARD_MANAGE"], ["/wards", "WARD_VIEW"],
  ["/admissions/bed-allocation", "BED_ALLOCATE"], ["/transfers/internal", "WARD_VIEW"],
  ["/transfers/inter-hospital/incoming", "INTER_HOSPITAL_TRANSFER_REVIEW"],
  ["/transfers/inter-hospital/outgoing", "INTER_HOSPITAL_TRANSFER_CREATE"],
  ["/transfers/inter-hospital", "INTER_HOSPITAL_TRANSFER_CREATE"],
];

export function canAccessPath(profile: AppUser | null | undefined, path: string): boolean {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  const limited = restrictedPrefixes[profile.role];
  if (limited && !limited.some((prefix) => path === prefix || path.startsWith(prefix))) return false;
  if (/^\/patients\/[^/]+\/documents(?:\/|$)/.test(path)) {
    const permissions = profile.permissions ?? [];
    return permissions.includes("*") || permissions.includes("DOCUMENT_VIEW");
  }
  const match = pathPermission.find(([prefix]) => path === prefix || path.startsWith(prefix));
  if (!match) return true;
  const permissions = profile.permissions ?? [];
  return permissions.includes("*") || permissions.includes(match[1]);
}
