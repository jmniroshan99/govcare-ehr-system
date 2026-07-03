import type { Role } from "../types/ehr";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  hospital_admin: "Hospital Admin",
  doctor: "Doctor",
  surgeon: "Surgeon",
  anesthetist: "Anesthetist",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  pathologist: "Pathologist",
  lab_manager: "Laboratory Manager",
  lab_technician: "Lab Technician",
  radiologist: "Radiologist",
  radiology_technician: "Radiology Technician",
  receptionist: "Receptionist",
  mortuary_officer: "Mortuary Officer",
  ict_admin: "ICT Admin",
  records_officer: "Records Officer",
  patient: "Patient",
};

export const permissions: Record<Role, string[]> = {
  super_admin: ["*"],
  hospital_admin: ["admin:*", "users:*", "roles:*", "departments:*", "wards:*", "beds:*", "reports:*", "patients:*", "appointments:*", "opd:*", "future-care:*", "mortuary:read", "lab:read", "radiology:read", "pharmacy:read", "media:*", "audit:read", "settings:*"],
  doctor: ["patients:read", "visits:*", "opd:*", "future-care:*", "theatre:read", "surgery:notes", "mortuary:confirm", "lab:request", "radiology:request", "prescriptions:create", "prescriptions:edit", "prescriptions:sign", "media:upload", "media:read"],
  surgeon: ["patients:read", "theatre:*", "surgery:*", "future-care:post-op", "lab:read", "radiology:read", "blood:request", "media:upload", "media:read"],
  anesthetist: ["patients:read", "theatre:read", "anesthesia:*", "surgery:notes", "lab:read", "radiology:read", "media:upload", "media:read"],
  nurse: [
    "patients:read",
    "wards:read",
    "nursing:notes",
    "nursing:assessments",
    "nursing:care-plans",
    "nursing:handover",
    "vitals:update",
    "mar:update",
    "iv-fluids:update",
    "wound-care:update",
    "intake-output:update",
    "glucose:update",
    "fall-risk:update",
    "pressure-risk:update",
    "allergy:verify",
    "nursing:checklists",
    "nursing:education",
    "vaccinations:update",
    "followups:remind",
    "future-care:update",
    "lab:read",
    "radiology:read",
    "alerts:read",
    "emergency:update",
    "nursing:reports",
    "patient:verify",
    "tasks:update",
    "messages:secure",
    "media:upload",
    "media:read",
  ],
  pharmacist: ["pharmacy:*", "prescriptions:read", "prescriptions:verify", "prescriptions:issue", "medicines:stock-update", "medicines:substitute", "media:upload", "media:read"],
  pathologist: ["lab:read", "lab:approve", "lab:sign", "patients:read", "media:upload", "media:read"],
  lab_manager: ["lab:*", "reports:lab", "patients:read", "media:upload", "media:read"],
  lab_technician: ["lab:*", "patients:read", "media:upload", "media:read"],
  radiologist: ["radiology:*", "patients:read", "media:upload", "media:read"],
  radiology_technician: ["radiology:queue", "radiology:schedule", "radiology:upload", "radiology:notes", "patients:read", "media:upload", "media:read"],
  receptionist: ["patients:create", "appointments:*", "opd:queue", "media:upload", "media:read"],
  mortuary_officer: ["mortuary:*", "patients:read", "documents:upload", "media:upload", "media:read"],
  ict_admin: ["system:*", "backups:*", "security:read", "app-check:read", "functions:read", "hosting:read", "notifications:*", "media:read", "audit:read", "settings:*"],
  records_officer: ["patients:*", "future-care:read", "mortuary:read", "reports:export", "media:upload", "media:read", "audit:read"],
  patient: ["portal:read", "profile:self", "reports:self", "appointments:self", "media:upload", "media:self"],
};

export const roleGroups = {
  staff: ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "mortuary_officer", "ict_admin", "records_officer"] as Role[],
  clinical: ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse"] as Role[],
  diagnostics: ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician"] as Role[],
  patientAdmin: ["super_admin", "hospital_admin", "receptionist", "records_officer"] as Role[],
  patientRead: ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "records_officer"] as Role[],
  admin: ["super_admin", "hospital_admin", "ict_admin"] as Role[],
  patient: ["patient"] as Role[],
};

export function can(role: Role | undefined, permission: string) {
  if (!role) return false;
  const allowed = permissions[role] ?? [];
  return allowed.includes("*") || allowed.includes(permission) || allowed.some((item) => item.endsWith(":*") && permission.startsWith(item.replace("*", "")));
}
