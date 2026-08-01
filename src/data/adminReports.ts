import type { Role } from "../types/ehr";

export type ReportCategory =
  | "patients" | "opd" | "appointments" | "consultations" | "prescriptions"
  | "pharmacy" | "medicine-stock" | "laboratory" | "radiology" | "admissions"
  | "beds" | "emergency" | "billing" | "inventory" | "staff" | "audit"
  | "system-activity";

export interface ReportDefinition {
  id: ReportCategory;
  label: string;
  module: string;
  collection: string;
  roles: Role[];
}

export const reportDefinitions: ReportDefinition[] = [
  { id: "patients", label: "Patient Registration", module: "Patient Management", collection: "patients", roles: ["super_admin", "hospital_admin", "records_officer", "receptionist"] },
  { id: "opd", label: "OPD Queue", module: "OPD", collection: "opdQueues", roles: ["super_admin", "hospital_admin", "records_officer", "receptionist", "doctor", "nurse"] },
  { id: "appointments", label: "Appointments", module: "Appointments", collection: "appointments", roles: ["super_admin", "hospital_admin", "records_officer", "receptionist", "doctor"] },
  { id: "consultations", label: "Doctor Consultations", module: "Doctor Center", collection: "consultations", roles: ["super_admin", "hospital_admin", "records_officer", "doctor"] },
  { id: "prescriptions", label: "Prescriptions", module: "E-Prescription", collection: "prescriptions", roles: ["super_admin", "hospital_admin", "records_officer", "doctor", "pharmacist"] },
  { id: "pharmacy", label: "Pharmacy Dispensing", module: "Pharmacy", collection: "medicineIssues", roles: ["super_admin", "hospital_admin", "records_officer", "pharmacist"] },
  { id: "medicine-stock", label: "Medicine Stock", module: "Pharmacy", collection: "medicineStock", roles: ["super_admin", "hospital_admin", "pharmacist"] },
  { id: "laboratory", label: "Laboratory Tests", module: "Laboratory", collection: "labRequests", roles: ["super_admin", "hospital_admin", "records_officer", "pathologist", "lab_manager", "lab_technician", "doctor"] },
  { id: "radiology", label: "Radiology Reports", module: "Radiology", collection: "radiologyRequests", roles: ["super_admin", "hospital_admin", "records_officer", "radiologist", "radiology_technician", "doctor"] },
  { id: "admissions", label: "Ward Admissions", module: "Admissions", collection: "admissions", roles: ["super_admin", "hospital_admin", "records_officer", "doctor", "nurse"] },
  { id: "beds", label: "Bed Occupancy", module: "Ward Management", collection: "beds", roles: ["super_admin", "hospital_admin", "records_officer", "doctor", "nurse"] },
  { id: "emergency", label: "Emergency Triage", module: "Emergency", collection: "emergencyCases", roles: ["super_admin", "hospital_admin", "records_officer", "doctor", "nurse"] },
  { id: "billing", label: "Billing and Payments", module: "Billing", collection: "billingRecords", roles: ["super_admin", "hospital_admin", "records_officer", "receptionist"] },
  { id: "inventory", label: "Inventory", module: "Inventory", collection: "inventoryItems", roles: ["super_admin", "hospital_admin", "records_officer", "pharmacist"] },
  { id: "staff", label: "Staff Performance", module: "Administration", collection: "users", roles: ["super_admin", "hospital_admin"] },
  { id: "audit", label: "Audit Logs", module: "Security", collection: "auditLogs", roles: ["super_admin", "hospital_admin", "records_officer", "ict_admin"] },
  { id: "system-activity", label: "Login and System Activity", module: "Security", collection: "auditLogs", roles: ["super_admin", "hospital_admin", "ict_admin"] },
];

export const reportRows = [
  { id: "RPT-2401", category: "patients", patientId: "PHR-000142", subject: "Fathima Rizna", department: "Antenatal", status: "active", owner: "Records Desk", date: "2026-06-21", value: 1 },
  { id: "RPT-2402", category: "opd", patientId: "PHR-000198", subject: "Medical OPD token 124", department: "Medical OPD", status: "completed", owner: "Dr. Perera", date: "2026-06-21", value: 42 },
  { id: "RPT-2403", category: "appointments", patientId: "PHR-000241", subject: "Diabetes clinic", department: "Medical Clinic", status: "confirmed", owner: "Dr. Fernando", date: "2026-06-20", value: 18 },
  { id: "RPT-2404", category: "consultations", patientId: "PHR-000142", subject: "Antenatal review", department: "Obstetrics", status: "completed", owner: "Dr. Anjali Perera", date: "2026-06-20", value: 26 },
  { id: "RPT-2405", category: "prescriptions", patientId: "PHR-000310", subject: "Metformin 500mg", department: "Medical OPD", status: "released", owner: "Dr. Perera", date: "2026-06-19", value: 64 },
  { id: "RPT-2406", category: "pharmacy", patientId: "PHR-000310", subject: "Prescription RX-443", department: "Pharmacy", status: "issued", owner: "Pharmacist Silva", date: "2026-06-19", value: 58 },
  { id: "RPT-2407", category: "medicine-stock", patientId: "-", subject: "Ceftriaxone 1g", department: "Pharmacy", status: "low-stock", owner: "Main Store", date: "2026-06-18", value: 12 },
  { id: "RPT-2408", category: "laboratory", patientId: "PHR-000402", subject: "Complete Blood Count", department: "Hematology", status: "approved", owner: "Lab Technician", date: "2026-06-18", value: 91 },
  { id: "RPT-2409", category: "radiology", patientId: "PHR-000511", subject: "CT Brain", department: "Radiology", status: "critical", owner: "Radiologist", date: "2026-06-17", value: 15 },
  { id: "RPT-2410", category: "admissions", patientId: "PHR-000602", subject: "Medical ward admission", department: "Medical Ward", status: "admitted", owner: "Admission Counter", date: "2026-06-17", value: 23 },
  { id: "RPT-2411", category: "beds", patientId: "-", subject: "Ward occupancy", department: "Medical Ward", status: "occupied", owner: "Ward 01", date: "2026-06-21", value: 84 },
  { id: "RPT-2412", category: "emergency", patientId: "PHR-000712", subject: "Emergency triage", department: "ETU", status: "urgent", owner: "Triage Nurse", date: "2026-06-21", value: 9 },
  { id: "RPT-2413", category: "billing", patientId: "PHR-000818", subject: "Service record", department: "Finance", status: "paid", owner: "Cashier", date: "2026-06-16", value: 34 },
  { id: "RPT-2414", category: "inventory", patientId: "-", subject: "Surgical gloves", department: "Stores", status: "reorder", owner: "Inventory Officer", date: "2026-06-16", value: 17 },
  { id: "RPT-2415", category: "staff", patientId: "-", subject: "Consultations completed", department: "Medical OPD", status: "on-target", owner: "Dr. Perera", date: "2026-06-15", value: 73 },
  { id: "RPT-2416", category: "audit", patientId: "PHR-000142", subject: "Patient record viewed", department: "ICT Unit", status: "recorded", owner: "admin@govcare.gov.lk", date: "2026-06-21", value: 128 },
  { id: "RPT-2417", category: "system-activity", patientId: "-", subject: "Successful staff logins", department: "ICT Unit", status: "healthy", owner: "Authentication", date: "2026-06-21", value: 246 },
] as const;
//