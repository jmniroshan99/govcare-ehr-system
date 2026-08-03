import type { Role } from "../types/ehr";

export type EcosystemModuleId =
  | "authentication"
  | "dashboard"
  | "patient-management"
  | "laboratory"
  | "pharmacy"
  | "analytics"
  | "offline"
  | "multi-centre";

export interface EcosystemModule {
  id: EcosystemModuleId;
  title: string;
  purpose: string;
  capabilities: string[];
  roles: Role[];
  onlineMode: string;
  offlineMode: string;
}

export interface LabDomainDefinition {
  id: string;
  title: string;
  examples: string[];
  referenceRangeMode: "numeric" | "qualitative" | "pathologist-review";
  criticalRules: string[];
}

export interface HealthcareCentre {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "laboratory" | "pharmacy";
  city: string;
  shareScope: string[];
  status: "active" | "restricted";
}

export const ecosystemModules: EcosystemModule[] = [
  {
    id: "authentication",
    title: "Authentication and RBAC",
    purpose: "Identify users, enforce roles, and protect each clinical workflow.",
    capabilities: ["PostgreSQL-backed authentication", "JWT role claims", "Protected routes", "Session timeout", "Audit-ready login events"],
    roles: ["super_admin", "hospital_admin", "doctor", "nurse", "pharmacist", "lab_technician", "receptionist", "patient"],
    onlineMode: "PostgreSQL API Auth verifies identity and role profile before dashboard access.",
    offlineMode: "Read-only cached role context can keep non-sensitive dashboards visible until reconnection.",
  },
  {
    id: "patient-management",
    title: "Patient Lifecycle Management",
    purpose: "Create, identify, update, and link patient records across OPD, laboratory, pharmacy, and hospitals.",
    capabilities: ["Patient demographics", "Profile image", "QR/barcode identity", "Guardian links", "Duplicate prevention"],
    roles: ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer", "patient"],
    onlineMode: "Patient records sync through PostgreSQL using patientId and hospitalId.",
    offlineMode: "QR-based patient retrieval and cached profiles support safe lookup during connectivity loss.",
  },
  {
    id: "laboratory",
    title: "Laboratory Information System",
    purpose: "Process diagnostic results and convert them into structured clinical intelligence.",
    capabilities: ["Structured test entry", "Reference range validation", "Abnormal/critical flags", "Trend charts", "Doctor notifications"],
    roles: ["super_admin", "hospital_admin", "pathologist", "lab_manager", "lab_technician", "doctor", "nurse"],
    onlineMode: "Lab requests and results update patient EHR profiles in real time after approval.",
    offlineMode: "Local result drafts can be queued and synchronized after lab network recovery.",
  },
  {
    id: "pharmacy",
    title: "Pharmacy Integration",
    purpose: "Connect prescriptions with medicine safety, stock, dispensing, and patient records.",
    capabilities: ["Prescription queue", "Stock monitoring", "Drug interaction alerts", "Allergy warnings", "Digital prescription records"],
    roles: ["super_admin", "hospital_admin", "doctor", "pharmacist", "patient"],
    onlineMode: "Doctor prescriptions flow into the pharmacy queue and update stock through transactions.",
    offlineMode: "Dispensing actions can be queued with deterministic receipt IDs for later reconciliation.",
  },
  {
    id: "analytics",
    title: "Analytics and Reporting",
    purpose: "Support decision-making with patient statistics, disease trends, outcomes, and exports.",
    capabilities: ["Real-time dashboards", "PDF reports", "Excel CSV exports", "Predictive risk cards", "Treatment outcomes"],
    roles: ["super_admin", "hospital_admin", "records_officer"],
    onlineMode: "Aggregated PostgreSQL queries and Spring Boot services generate validated reports.",
    offlineMode: "Cached dashboards preserve the latest approved reports for read-only review.",
  },
  {
    id: "multi-centre",
    title: "Multi-Hospital Network",
    purpose: "Operate across hospitals, clinics, laboratories, and pharmacies with controlled data sharing.",
    capabilities: ["hospitalId isolation", "Centre dashboards", "Referral sharing", "Lab/pharmacy network", "Inter-facility audit logs"],
    roles: ["super_admin", "hospital_admin", "doctor", "pharmacist", "lab_technician", "records_officer"],
    onlineMode: "Authorized cross-centre sharing requires role, hospitalId, patient scope, and release status.",
    offlineMode: "LAN sync concepts allow local branch work queues to reconcile once the primary service returns.",
  },
];

export const labDomains: LabDomainDefinition[] = [
  { id: "hematology", title: "Hematology", examples: ["CBC/FBC", "ESR", "Hemoglobin"], referenceRangeMode: "numeric", criticalRules: ["Very low hemoglobin", "Critical WBC", "Platelet danger range"] },
  { id: "chemistry", title: "Clinical Chemistry", examples: ["Blood Glucose", "HbA1c", "Urea", "Creatinine"], referenceRangeMode: "numeric", criticalRules: ["Critical glucose", "Renal failure markers", "Cardiac marker elevation"] },
  { id: "microbiology", title: "Microbiology", examples: ["Urine culture", "Blood culture", "Stool culture"], referenceRangeMode: "qualitative", criticalRules: ["Positive blood culture", "Resistant organism", "Sepsis risk"] },
  { id: "parasitology", title: "Parasitology", examples: ["Malaria parasite", "Filaria", "Stool ova/cysts"], referenceRangeMode: "qualitative", criticalRules: ["Positive malaria parasite", "High parasite load"] },
  { id: "virology", title: "Virology", examples: ["Dengue NS1", "Viral PCR", "COVID-19 PCR"], referenceRangeMode: "qualitative", criticalRules: ["Dengue warning pattern", "Positive high-risk PCR"] },
  { id: "toxicology", title: "Toxicology", examples: ["Drug screen", "Poison detection", "Alcohol level"], referenceRangeMode: "numeric", criticalRules: ["Poison detected", "Dangerous alcohol level", "Toxic drug concentration"] },
  { id: "endocrinology", title: "Endocrinology", examples: ["TSH", "T3/T4", "Cortisol"], referenceRangeMode: "numeric", criticalRules: ["Severe thyroid abnormality", "Adrenal crisis signal"] },
  { id: "serology", title: "Serology and Immunology", examples: ["HIV", "Hepatitis B/C", "CRP"], referenceRangeMode: "qualitative", criticalRules: ["Restricted positive result", "High inflammatory marker"] },
  { id: "histopathology", title: "Histopathology", examples: ["Biopsy", "Cytology", "Pap smear"], referenceRangeMode: "pathologist-review", criticalRules: ["Malignancy suspected", "Urgent pathologist review"] },
  { id: "molecular", title: "Molecular Biology", examples: ["PCR", "DNA", "RNA analysis"], referenceRangeMode: "pathologist-review", criticalRules: ["High-risk molecular finding", "Restricted genetic result"] },
  { id: "blood-bank", title: "Blood Bank", examples: ["Blood grouping", "Cross match", "Component tracking"], referenceRangeMode: "qualitative", criticalRules: ["Incompatible cross-match", "Emergency low stock"] },
];

export const healthcareCentres: HealthcareCentre[] = [
  { id: "hosp-colombo-national", name: "National Hospital Colombo", type: "hospital", city: "Colombo", shareScope: ["referrals", "released reports", "prescriptions"], status: "active" },
  { id: "clinic-kandy-central", name: "Kandy Central Clinic", type: "clinic", city: "Kandy", shareScope: ["appointments", "follow-ups"], status: "active" },
  { id: "lab-western-regional", name: "Regional Diagnostic Laboratory", type: "laboratory", city: "Colombo", shareScope: ["approved lab results"], status: "restricted" },
  { id: "pharm-colombo-hub", name: "Government Pharmacy Hub", type: "pharmacy", city: "Colombo", shareScope: ["prescriptions", "dispensing receipts"], status: "active" },
];

