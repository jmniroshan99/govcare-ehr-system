const preloadedRoutes = new Set<string>();

const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../pages/Dashboard"),
  "/super-admin": () => import("../pages/SuperAdminDashboard"),
  "/efficiency": () => import("../pages/EfficiencyCommandCenter"),
  "/portal": () => import("../pages/PatientPortal"),
  "/portal/appointments": () => import("../pages/PatientAppointments"),
  "/portal/messages": () => import("../pages/PatientCommunication"),
  "/portal/reports": () => import("../pages/PatientReports"),
  "/portal/medical-reports": () => import("../pages/MedicalDecisionRequests"),
  "/portal/care-summary": () => import("../pages/CareSummary"),
  "/media": () => import("../pages/MediaCenter"),
  "/profile": () => import("../pages/Profile"),
  "/doctor": () => import("../pages/DoctorDashboard"),
  "/doctor/workspace": () => import("../pages/DoctorWorkspace"),
  "/patients/register": () => import("../pages/PatientRegistration"),
  "/admin/patient-fields": () => import("../pages/PatientFieldConfiguration"),
  "/patients/search": () => import("../pages/PatientWorkbench"),
  "/guardians": () => import("../pages/GuardianManagement"),
  "/opd": () => import("../pages/OPDQueueManagement"),
  "/nurse-notes": () => import("../pages/NurseModule"),
  "/admissions": () => import("../pages/AdmissionsManagement"),
  "/wards": () => import("../pages/WardManagement"),
  "/operation-theatre": () => import("../pages/OperationTheatre"),
  "/future-care": () => import("../pages/FutureCareWorkflow"),
  "/pharmacy": () => import("../pages/PharmacyModule"),
  "/e-prescription": () => import("../pages/EPrescription"),
  "/laboratory": () => import("../pages/LaboratoryManagement"),
  "/radiology": () => import("../pages/RadiologyManagement"),
  "/emergency": () => import("../pages/EmergencyManagement"),
  "/mortuary": () => import("../pages/MortuaryManagement"),
  "/reports": () => import("../pages/Reports"),
  "/medical-report-review": () => import("../pages/MedicalDecisionReview"),
  "/notifications": () => import("../pages/NotificationCenter"),
  "/admin/staff": () => import("../pages/admin/StaffManagement"),
  "/admin/users": () => import("../pages/admin/StaffManagement"),
  "/users": () => import("../pages/admin/StaffManagement"),
  "/user-management": () => import("../pages/admin/StaffManagement"),
  "/settings": () => import("../pages/Settings"),
  "/audit-logs": () => import("../pages/AuditLogs"),
  "/admin/login-activity": () => import("../pages/LoginActivityReport"),
};

export function preloadRoute(href: string) {
  const normalized = href.startsWith("/patients/") ? "/patients/search" : href;
  if (preloadedRoutes.has(normalized)) return;
  const preload = routePreloaders[normalized];
  if (!preload) return;
  preloadedRoutes.add(normalized);
  void preload().catch(() => preloadedRoutes.delete(normalized));
}

