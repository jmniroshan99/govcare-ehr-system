import { getGuardianProfiles, getSavedPatientsForDoctors } from "./patientRegistry";

export type SmartSearchCategory =
  | "Patient"
  | "Doctor"
  | "Appointment"
  | "Prescription"
  | "Laboratory"
  | "Radiology"
  | "Admission"
  | "Ward"
  | "User"
  | "Module"
  | "Notification"
  | "Report";

export interface SmartSearchSuggestion {
  id: string;
  label: string;
  description: string;
  category: SmartSearchCategory;
  href?: string;
  keywords?: string[];
}

const moduleSuggestions: SmartSearchSuggestion[] = ([
  ["dashboard", "Dashboard", "Hospital command overview", "Module", "/"],
  ["patients-register", "Patient Registration", "Register adult, child, guardian, QR profile", "Module", "/patients/register"],
  ["patients-search", "Patient Identification", "Search patient by NIC, QR, barcode, phone", "Module", "/patients/search"],
  ["opd", "OPD Queue", "Tokens, queue status, doctor assignment", "Module", "/opd"],
  ["appointments", "Appointments", "Doctor booking, queue ticket, reminders", "Appointment", "/appointments"],
  ["doctor", "Doctor Center", "Consultation, telemedicine, prescriptions", "Doctor", "/doctor"],
  ["doctor-workspace", "Consult Workspace", "SOAP notes, diagnosis, orders", "Doctor", "/doctor/workspace"],
  ["wards", "Ward Management", "Bed allocation, male/female/children wards", "Ward", "/wards"],
  ["admissions", "Admissions", "Admission requests, approval, discharge", "Admission", "/admissions"],
  ["pharmacy", "Pharmacy", "Prescription verification, stock, receipts", "Prescription", "/pharmacy"],
  ["laboratory", "Laboratory", "Lab requests, samples, reports, alerts", "Laboratory", "/laboratory"],
  ["radiology", "Radiology", "Imaging requests, reports, DICOM-ready viewer", "Radiology", "/radiology"],
  ["emergency", "Emergency Department", "ETU triage, critical alerts, transfers", "Module", "/emergency"],
  ["reports", "Reports and Analytics", "Admin reports, charts, exports", "Report", "/reports"],
  ["notifications", "Notifications", "Real-time popup and notification center", "Notification", "/notifications"],
  ["admin-users", "User Management", "Roles, permissions, account status", "User", "/admin/users"],
  ["super-admin", "Super Admin", "Multi-hospital control center", "User", "/super-admin"],
  ["login-activity", "Login Activity", "User sessions, failed logins, exports", "Report", "/admin/login-activity"],
  ["media", "Media Center", "Images, documents, patient timeline files", "Module", "/media"],
  ["guardians", "Guardian Management", "Parent/dependent family records", "Patient", "/guardians"],
  ["patient-portal", "Patient Portal", "Own appointments, reports, chat, documents", "Patient", "/portal"],
] satisfies Array<[string, string, string, SmartSearchCategory, string]>).map(([id, label, description, category, href]) => ({
  id,
  label,
  description,
  category,
  href,
}));

const demoClinicalSuggestions: SmartSearchSuggestion[] = [
  { id: "demo-patient-1", label: "PAT-2026-000001 - Nimal Silva", description: "Patient | Male | Diabetes follow-up | Colombo", category: "Patient", href: "/patients/PAT-2026-000001", keywords: ["nic", "diabetes", "opd"] },
  { id: "demo-patient-2", label: "PAT-2026-000002 - Fathima Rizna", description: "Patient | Female | Antenatal review | Galle", category: "Patient", href: "/patients/PAT-2026-000002", keywords: ["pregnancy", "antenatal", "ward"] },
  { id: "demo-patient-3", label: "PAT-2026-000003 - Kumar Rajan", description: "Patient | Child under guardian | Pediatric clinic", category: "Patient", href: "/patients/PAT-2026-000003", keywords: ["guardian", "child", "birth certificate"] },
  { id: "demo-doctor-1", label: "Dr. Anjali Perera", description: "Doctor | Medical clinic | hosp-colombo-national", category: "Doctor", href: "/doctor", keywords: ["consultation", "opd"] },
  { id: "demo-rx-1", label: "RX-2026-000118", description: "Prescription | Pending pharmacy issue | PAT-2026-000001", category: "Prescription", href: "/pharmacy", keywords: ["medicine", "receipt"] },
  { id: "demo-lab-1", label: "LAB-2026-000076 - CBC/FBC", description: "Laboratory | Critical result review pending", category: "Laboratory", href: "/laboratory", keywords: ["hematology", "blood"] },
  { id: "demo-rad-1", label: "RAD-2026-000044 - Chest X-Ray", description: "Radiology | Report released to doctor", category: "Radiology", href: "/radiology", keywords: ["xray", "imaging"] },
  { id: "demo-admission-1", label: "ADM-2026-000034", description: "Admission | Bed allocation required | Female ward", category: "Admission", href: "/admissions", keywords: ["bed", "ward"] },
  { id: "demo-appointment-1", label: "APT-2026-000219", description: "Appointment | Diabetes clinic | Queue ticket ready", category: "Appointment", href: "/appointments", keywords: ["booking", "doctor"] },
];

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function scoreSuggestion(suggestion: SmartSearchSuggestion, query: string) {
  const normalizedQuery = normalize(query);
  const haystack = normalize([
    suggestion.label,
    suggestion.description,
    suggestion.category,
    ...(suggestion.keywords ?? []),
  ].join(" "));
  const label = normalize(suggestion.label);

  if (!normalizedQuery) return 0;
  if (label === normalizedQuery) return 100;
  if (label.startsWith(normalizedQuery)) return 80;
  if (haystack.includes(normalizedQuery)) return 55;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
  return tokenHits ? 20 + tokenHits * 8 : 0;
}

export function getLocalSmartSearchSuggestions(query: string, limit = 8): SmartSearchSuggestion[] {
  const savedPatients = getSavedPatientsForDoctors().map<SmartSearchSuggestion>((patient) => ({
    id: `patient-${patient.patientId}`,
    label: `${patient.patientId} - ${patient.name}`,
    description: `Patient | ${patient.sex || "Gender not set"} | ${patient.phone || "No phone"} | ${patient.visitReason || "Clinical profile"}`,
    category: "Patient",
    href: `/patients/${patient.patientId}`,
    keywords: [
      patient.nicOrPassport,
      patient.passportNumber,
      patient.birthCertificateNo,
      patient.guardianName,
      patient.guardianNic,
      patient.assignedDoctor,
      patient.district,
      patient.bloodGroup,
    ].filter(Boolean) as string[],
  }));

  const guardians = getGuardianProfiles().map<SmartSearchSuggestion>((guardian) => ({
    id: `guardian-${guardian.guardianId}`,
    label: `${guardian.guardianId} - ${guardian.fullName}`,
    description: `Guardian | ${guardian.relationshipToPatient} | ${guardian.phone} | ${guardian.dependentPatientIds.length} dependents`,
    category: "Patient",
    href: "/guardians",
    keywords: [guardian.nic, guardian.email, guardian.emergencyContactName].filter(Boolean) as string[],
  }));

  const suggestions = [...savedPatients, ...guardians, ...demoClinicalSuggestions, ...moduleSuggestions];
  return suggestions
    .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.suggestion.label.localeCompare(b.suggestion.label))
    .slice(0, limit)
    .map((item) => item.suggestion);
}
