import {
  Ambulance,
  BedDouble,
  Building2,
  ClipboardCheck,
  FlaskConical,
  HeartPulse,
  Hospital,
  MonitorCog,
  PackageSearch,
  Pill,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { IntelligenceDashboardKey } from "../services/dashboardService";

export type DashboardDefinition = {
  key: IntelligenceDashboardKey;
  eyebrow: string;
  icon: LucideIcon;
  accent: string;
  glow: string;
  quickActions: Array<{ label: string; href: string }>;
};

export const dashboardDefinitions: Record<IntelligenceDashboardKey, DashboardDefinition> = {
  super_admin: {
    key: "super_admin", eyebrow: "Network command", icon: Building2, accent: "from-success-solid to-info-solid", glow: "bg-success-surface",
    quickActions: [{ label: "Add hospitals, wards and beds", href: "/admin/facilities" }, { label: "Staff management", href: "/admin/staff" }, { label: "Audit logs", href: "/audit-logs" }],
  },
  hospital_admin: {
    key: "hospital_admin", eyebrow: "Hospital command", icon: Hospital, accent: "from-accent-solid to-info-solid", glow: "bg-accent-surface",
    quickActions: [{ label: "Staff management", href: "/admin/staff" }, { label: "Ward administration", href: "/admin/wards" }, { label: "Reports", href: "/reports" }],
  },
  doctor: {
    key: "doctor", eyebrow: "Clinical intelligence", icon: Stethoscope, accent: "from-info-solid to-info-solid", glow: "bg-info-surface",
    quickActions: [{ label: "Doctor workspace", href: "/doctor/workspace" }, { label: "CKD AI-CDSS", href: "/ai-cdss/ckd" }, { label: "Laboratory", href: "/laboratory" }],
  },
  nurse: {
    key: "nurse", eyebrow: "Care coordination", icon: HeartPulse, accent: "from-success-solid to-accent-solid", glow: "bg-success-surface",
    quickActions: [{ label: "Nursing module", href: "/nurse-notes" }, { label: "Ward dashboard", href: "/wards" }, { label: "Admissions", href: "/admissions" }],
  },
  front_desk: {
    key: "front_desk", eyebrow: "Arrival and access", icon: UserRoundCheck, accent: "from-info-solid to-accent-solid", glow: "bg-info-surface",
    quickActions: [{ label: "Live OPD queue", href: "/opd" }, { label: "Register patient", href: "/patients/register" }, { label: "Appointments", href: "/appointments" }],
  },
  opd: {
    key: "opd", eyebrow: "Patient flow control", icon: UsersRound, accent: "from-accent-solid to-success-solid", glow: "bg-accent-surface",
    quickActions: [{ label: "Manage queue", href: "/opd" }, { label: "Appointments", href: "/appointments" }, { label: "Patient search", href: "/patients/search" }],
  },
  ward: {
    key: "ward", eyebrow: "Capacity and movement", icon: BedDouble, accent: "from-violet-solid to-info-solid", glow: "bg-violet-surface",
    quickActions: [{ label: "Ward dashboard", href: "/wards" }, { label: "Bed board", href: "/wards/bed-board" }, { label: "Admissions", href: "/admissions" }],
  },
  laboratory: {
    key: "laboratory", eyebrow: "Diagnostic operations", icon: FlaskConical, accent: "from-violet-solid to-info-solid", glow: "bg-violet-surface",
    quickActions: [{ label: "Laboratory", href: "/laboratory" }, { label: "Blood reports", href: "/laboratory/blood-reports" }, { label: "Department documents", href: "/laboratory/documents" }],
  },
  radiology: {
    key: "radiology", eyebrow: "Imaging operations", icon: ScanLine, accent: "from-info-solid to-violet-solid", glow: "bg-info-surface",
    quickActions: [{ label: "Radiology", href: "/radiology" }, { label: "Department documents", href: "/radiology/documents" }, { label: "Reports", href: "/reports" }],
  },
  pharmacy: {
    key: "pharmacy", eyebrow: "Medication operations", icon: Pill, accent: "from-success-solid to-success-solid", glow: "bg-success-surface",
    quickActions: [{ label: "Pharmacy", href: "/pharmacy" }, { label: "Department documents", href: "/pharmacy/documents" }, { label: "Reports", href: "/reports" }],
  },
  inventory: {
    key: "inventory", eyebrow: "Supply intelligence", icon: Warehouse, accent: "from-warning-solid to-success-solid", glow: "bg-warning-surface",
    quickActions: [{ label: "Reports", href: "/reports" }],
  },
  finance: {
    key: "finance", eyebrow: "Financial source readiness", icon: WalletCards, accent: "from-warning-solid to-orange-solid", glow: "bg-warning-surface",
    quickActions: [{ label: "Reports", href: "/reports" }],
  },
  records: {
    key: "records", eyebrow: "Record integrity", icon: ClipboardCheck, accent: "from-accent-solid to-info-solid", glow: "bg-accent-surface",
    quickActions: [{ label: "Register patient", href: "/patients/register" }, { label: "Patient search", href: "/patients/search" }, { label: "Reports", href: "/reports" }],
  },
  patient: {
    key: "patient", eyebrow: "Personal health", icon: HeartPulse, accent: "from-accent-solid to-info-solid", glow: "bg-accent-surface",
    quickActions: [{ label: "My appointments", href: "/portal/appointments" }, { label: "My reports", href: "/portal/reports" }, { label: "Care summary", href: "/portal/care-summary" }],
  },
  guardian: {
    key: "guardian", eyebrow: "Dependent care", icon: UsersRound, accent: "from-info-solid to-violet-solid", glow: "bg-info-surface",
    quickActions: [{ label: "Guardian management", href: "/guardians" }, { label: "Released reports", href: "/portal/reports" }],
  },
  emergency: {
    key: "emergency", eyebrow: "Acute care command", icon: Ambulance, accent: "from-danger-solid to-warning-solid", glow: "bg-danger-surface",
    quickActions: [{ label: "Emergency module", href: "/emergency" }, { label: "Critical OPD queue", href: "/opd" }, { label: "Admissions", href: "/admissions" }],
  },
  quality: {
    key: "quality", eyebrow: "Quality and safety", icon: ShieldCheck, accent: "from-violet-solid to-accent-solid", glow: "bg-violet-surface",
    quickActions: [{ label: "Reports", href: "/reports" }, { label: "Audit logs", href: "/audit-logs" }],
  },
  it: {
    key: "it", eyebrow: "Platform assurance", icon: MonitorCog, accent: "from-surface to-accent-solid", glow: "bg-muted",
    quickActions: [{ label: "Login activity", href: "/admin/login-activity" }, { label: "Audit logs", href: "/audit-logs" }, { label: "Settings", href: "/settings" }],
  },
  mortuary: {
    key: "mortuary", eyebrow: "Mortuary operations", icon: PackageSearch, accent: "from-surface to-violet-solid", glow: "bg-muted",
    quickActions: [{ label: "Mortuary module", href: "/mortuary" }, { label: "Reports", href: "/reports" }],
  },
};
