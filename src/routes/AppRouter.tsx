import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Skeleton } from "../components/ui/skeleton";
import { roleGroups } from "../lib/rbac";
import { defaultHomeForProfile, isActiveAccount } from "../lib/accessControl";
import { canAccessPath } from "../lib/roleAccess";
import { identifyAuthenticatedUser, logout, watchAuth } from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import type { Role } from "../types/ehr";

const lazyPage = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const Login = lazyPage(() => import("../pages/Login"), "Login");
const ResetPassword = lazyPage(() => import("../pages/ResetPassword"), "ResetPassword");
const ChangeTemporaryPassword = lazyPage(() => import("../pages/ChangeTemporaryPassword"), "ChangeTemporaryPassword");
const AdmissionsManagement = lazyPage(() => import("../pages/AdmissionsManagement"), "AdmissionsManagement");
const AppointmentManagement = lazyPage(() => import("../pages/AppointmentManagement"), "AppointmentManagement");
const AuditLogs = lazy(() => import("../pages/AuditLogs"));
const CareSummary = lazyPage(() => import("../pages/CareSummary"), "CareSummary");
const Dashboard = lazyPage(() => import("../pages/Dashboard"), "Dashboard");
const DoctorDashboard = lazyPage(() => import("../pages/DoctorDashboard"), "DoctorDashboard");
const DoctorWorkspace = lazyPage(() => import("../pages/DoctorWorkspace"), "DoctorWorkspace");
const EfficiencyCommandCenter = lazyPage(() => import("../pages/EfficiencyCommandCenter"), "EfficiencyCommandCenter");
const EmergencyManagement = lazyPage(() => import("../pages/EmergencyManagement"), "EmergencyManagement");
const FutureCareWorkflow = lazyPage(() => import("../pages/FutureCareWorkflow"), "FutureCareWorkflow");
const GuardianManagement = lazyPage(() => import("../pages/GuardianManagement"), "GuardianManagement");
const LaboratoryManagement = lazyPage(() => import("../pages/LaboratoryManagement"), "LaboratoryManagement");
const LoginActivityReport = lazyPage(() => import("../pages/LoginActivityReport"), "LoginActivityReport");
const MediaCenter = lazyPage(() => import("../pages/MediaCenter"), "MediaCenter");
const MedicalDecisionRequests = lazyPage(() => import("../pages/MedicalDecisionRequests"), "MedicalDecisionRequests");
const MedicalDecisionReview = lazyPage(() => import("../pages/MedicalDecisionReview"), "MedicalDecisionReview");
const MedicalReportVerification = lazyPage(() => import("../pages/MedicalReportVerification"), "MedicalReportVerification");
const MortuaryManagement = lazyPage(() => import("../pages/MortuaryManagement"), "MortuaryManagement");
const NurseModule = lazyPage(() => import("../pages/NurseModule"), "NurseModule");
const NotificationCenter = lazyPage(() => import("../pages/NotificationCenter"), "NotificationCenter");
const OperationTheatre = lazyPage(() => import("../pages/OperationTheatre"), "OperationTheatre");
const OPDQueueManagement = lazyPage(() => import("../pages/OPDQueueManagement"), "OPDQueueManagement");
const PatientAppointments = lazyPage(() => import("../pages/PatientAppointments"), "PatientAppointments");
const PatientCommunication = lazyPage(() => import("../pages/PatientCommunication"), "PatientCommunication");
const PatientFieldConfiguration = lazyPage(() => import("../pages/PatientFieldConfiguration"), "PatientFieldConfiguration");
const PatientPortal = lazyPage(() => import("../pages/PatientPortal"), "PatientPortal");
const PatientProfile = lazyPage(() => import("../pages/PatientProfile"), "PatientProfile");
const PatientDocuments = lazyPage(() => import("../pages/patients/PatientDocuments"), "PatientDocuments");
const DepartmentDocuments = lazyPage(() => import("../pages/departments/DepartmentDocuments"), "DepartmentDocuments");
const PatientRegistration = lazyPage(() => import("../pages/PatientRegistration"), "PatientRegistration");
const PatientReports = lazyPage(() => import("../pages/PatientReports"), "PatientReports");
const PatientSelfRegistration = lazyPage(() => import("../pages/PatientSelfRegistration"), "PatientSelfRegistration");
const PatientWorkbench = lazyPage(() => import("../pages/PatientWorkbench"), "PatientWorkbench");
const PharmacyModule = lazyPage(() => import("../pages/PharmacyModule"), "PharmacyModule");
const Profile = lazyPage(() => import("../pages/Profile"), "Profile");
const RadiologyManagement = lazyPage(() => import("../pages/RadiologyManagement"), "RadiologyManagement");
const Reports = lazyPage(() => import("../pages/Reports"), "Reports");
const Settings = lazyPage(() => import("../pages/Settings"), "Settings");
const SuperAdminDashboard = lazyPage(() => import("../pages/SuperAdminDashboard"), "SuperAdminDashboard");
const StaffManagement = lazyPage(() => import("../pages/admin/StaffManagement"), "StaffManagement");
const WardDashboard = lazyPage(() => import("../pages/wards/WardDashboard"), "WardDashboard");
const WardAdministration = lazyPage(() => import("../pages/wards/WardManagement"), "WardManagement");
const BedBoard = lazyPage(() => import("../pages/wards/BedBoard"), "BedBoard");
const BedAllocation = lazyPage(() => import("../pages/wards/BedAllocation"), "BedAllocation");
const InternalTransfers = lazyPage(() => import("../pages/transfers/InternalTransfers"), "InternalTransfers");
const InterHospitalTransfers = lazyPage(() => import("../pages/transfers/InterHospitalTransfers"), "InterHospitalTransfers");
const IncomingTransfers = lazyPage(() => import("../pages/transfers/InterHospitalTransfers"), "IncomingTransfers");
const OutgoingTransfers = lazyPage(() => import("../pages/transfers/InterHospitalTransfers"), "OutgoingTransfers");

function Loading() {
  return <div className="space-y-3"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>;
}

function Protected({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const profile = useAuthStore((state) => state.profile);
  const clearAuth = useAuthStore((state) => state.clear);
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt);
  const location = useLocation();
  useEffect(() => {
    if (!profile) return;
    const expired = Boolean(sessionExpiresAt && Date.now() > sessionExpiresAt);
    if (!isActiveAccount(profile) || expired) {
      void logout(expired ? "timed_out" : "logged_out");
      clearAuth();
    }
  }, [clearAuth, profile, sessionExpiresAt]);
  if (!profile) return <Navigate to="/login" replace />;
  if (!isActiveAccount(profile)) return <Navigate to="/login" replace />;
  if (profile.mustChangePassword && location.pathname !== "/change-temporary-password") {
    return <Navigate to="/change-temporary-password" replace />;
  }
  if (!roles.includes(profile.role) || !canAccessPath(profile, location.pathname)) {
    return <AppShell><div className="mx-auto mt-16 max-w-xl rounded-2xl border border-rose-300 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/30"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-3 text-sm">Your account does not have permission to access this module.</p><a className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" href={defaultHomeForProfile(profile)}>Return to your dashboard</a></div></AppShell>;
  }
  return <AppShell>{children}</AppShell>;
}

function AuthenticatedOnly({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile);
  if (!profile || !isActiveAccount(profile)) return <Navigate to="/login" replace />;
  if (!profile.mustChangePassword) return <Navigate to={defaultHomeForProfile(profile)} replace />;
  return children;
}

function LegacyStaffManagementRedirect() {
  const location = useLocation();
  return <Navigate to={`/admin/staff${location.search}`} replace />;
}

function MainMenuRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    function redirectToMainMenu(event: Event) {
      const targetPath = event instanceof CustomEvent && typeof event.detail?.targetPath === "string" ? event.detail.targetPath : "/";
      navigate(targetPath, { replace: true });
    }

    window.addEventListener("govcare:redirect-main-menu", redirectToMainMenu);
    return () => window.removeEventListener("govcare:redirect-main-menu", redirectToMainMenu);
  }, [navigate]);

  return null;
}


export function AppRouter() {
  const storedProfile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const clearAuth = useAuthStore((state) => state.clear);

  useEffect(() => watchAuth(async (user) => {
    if (!user) {
      if (window.sessionStorage.getItem("govcare-auth-mode") === "demo" || storedProfile?.uid.startsWith("demo-")) return;
      clearAuth();
      return;
    }
    const loginIntent = window.sessionStorage.getItem("govcare-login-intent");
    // Login.tsx owns profile resolution while an interactive login is in progress.
    // Resolving here at the same time can sign a new Google patient out before the
    // patient bootstrap function has created their PostgreSQL profile.
    if (loginIntent === "staff" || loginIntent === "patient") return;
    let resolvedProfile;
    try {
      resolvedProfile = await identifyAuthenticatedUser(user);
    } catch {
      await logout();
      clearAuth();
      return;
    }
    if (loginIntent === "patient" && resolvedProfile.role !== "patient") {
      await logout();
      clearAuth();
      return;
    }
    setProfile(resolvedProfile);
    window.sessionStorage.removeItem("govcare-login-intent");
  }), [clearAuth, storedProfile?.uid, setProfile]);

  return (
    <BrowserRouter>
      <MainMenuRedirectListener />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-temporary-password" element={<AuthenticatedOnly><ChangeTemporaryPassword /></AuthenticatedOnly>} />
          <Route path="/self-register" element={<PatientSelfRegistration />} />
          <Route path="/self-register/:token" element={<PatientSelfRegistration />} />
          <Route path="/verify-medical-report" element={<MedicalReportVerification />} />
          <Route path="/super-admin" element={<Protected roles={["super_admin"]}><SuperAdminDashboard /></Protected>} />
          <Route path="/efficiency" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "ict_admin", "records_officer"]}><EfficiencyCommandCenter /></Protected>} />
          <Route path="/" element={<Protected roles={roleGroups.staff}><Dashboard /></Protected>} />
          <Route path="/portal" element={<Protected roles={roleGroups.patient}><PatientPortal /></Protected>} />
          <Route path="/portal/appointments" element={<Protected roles={roleGroups.patient}><PatientAppointments /></Protected>} />
          <Route path="/portal/messages" element={<Protected roles={["doctor", "nurse", "patient"]}><PatientCommunication /></Protected>} />
          <Route path="/portal/reports" element={<Protected roles={roleGroups.patient}><PatientReports /></Protected>} />
          <Route path="/portal/medical-reports" element={<Protected roles={roleGroups.patient}><MedicalDecisionRequests /></Protected>} />
          <Route path="/media" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "mortuary_officer", "ict_admin", "records_officer", "patient"]}><MediaCenter /></Protected>} />
          <Route path="/portal/care-summary" element={<Protected roles={["doctor", "nurse", "patient"]}><CareSummary /></Protected>} />
          <Route path="/profile" element={<Protected roles={["doctor", "nurse", "patient"]}><Profile /></Protected>} />
          <Route path="/doctor" element={<Protected roles={["super_admin", "hospital_admin", "doctor"]}><DoctorDashboard /></Protected>} />
          <Route path="/doctor/workspace" element={<Protected roles={["super_admin", "hospital_admin", "doctor"]}><DoctorWorkspace /></Protected>} />
          <Route path="/doctor/workspace/:patientUuid" element={<Protected roles={["super_admin", "hospital_admin", "doctor"]}><DoctorWorkspace /></Protected>} />
          <Route path="/patients/register" element={<Protected roles={roleGroups.patientAdmin}><PatientRegistration /></Protected>} />
          <Route path="/admin/patient-fields" element={<Protected roles={roleGroups.admin}><PatientFieldConfiguration /></Protected>} />
          <Route path="/patients/search" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer"]}><PatientWorkbench /></Protected>} />
          <Route path="/guardians" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer", "patient"]}><GuardianManagement /></Protected>} />
          <Route path="/patients/:id" element={<Protected roles={roleGroups.patientRead}><PatientProfile /></Protected>} />
          <Route path="/patients/:patientId/documents" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "records_officer", "patient", "guardian"]}><PatientDocuments /></Protected>} />
          <Route path="/laboratory/documents" element={<Protected roles={["pathologist", "lab_manager", "lab_technician"]}><DepartmentDocuments /></Protected>} />
          <Route path="/radiology/documents" element={<Protected roles={["radiologist", "radiology_technician"]}><DepartmentDocuments /></Protected>} />
          <Route path="/pharmacy/documents" element={<Protected roles={["pharmacist"]}><DepartmentDocuments /></Protected>} />
          <Route path="/doctor/documents" element={<Protected roles={["doctor", "surgeon", "anesthetist"]}><DepartmentDocuments /></Protected>} />
          <Route path="/ward/documents" element={<Protected roles={["doctor", "surgeon", "nurse"]}><DepartmentDocuments /></Protected>} />
          <Route path="/opd" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer"]}><OPDQueueManagement /></Protected>} />
          <Route path="/consultation" element={<Protected roles={["super_admin", "hospital_admin", "doctor"]}><Navigate to="/doctor/workspace" replace /></Protected>} />
          <Route path="/nurse-notes" element={<Protected roles={["super_admin", "hospital_admin", "nurse"]}><NurseModule /></Protected>} />
          <Route path="/admissions" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "records_officer"]}><AdmissionsManagement /></Protected>} />
          <Route path="/wards" element={<Protected roles={roleGroups.clinical}><WardDashboard /></Protected>} />
          <Route path="/admin/wards" element={<Protected roles={["super_admin", "hospital_admin"]}><WardAdministration /></Protected>} />
          <Route path="/wards/bed-board" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse"]}><BedBoard /></Protected>} />
          <Route path="/admissions/bed-allocation" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse"]}><BedAllocation /></Protected>} />
          <Route path="/transfers/internal" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse"]}><InternalTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse"]}><InterHospitalTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital/incoming" element={<Protected roles={["super_admin", "hospital_admin", "nurse"]}><IncomingTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital/outgoing" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse"]}><OutgoingTransfers /></Protected>} />
          <Route path="/operation-theatre" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse"]}><OperationTheatre /></Protected>} />
          <Route path="/future-care" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "surgeon", "nurse", "records_officer"]}><FutureCareWorkflow /></Protected>} />
          <Route path="/pharmacy" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "pharmacist"]}><PharmacyModule /></Protected>} />
          <Route path="/e-prescription" element={<Protected roles={["super_admin", "hospital_admin", "doctor"]}><Navigate to="/doctor/workspace" replace /></Protected>} />
          <Route path="/laboratory" element={<Protected roles={["super_admin", "hospital_admin", "pathologist", "lab_manager", "lab_technician", "doctor", "nurse"]}><LaboratoryManagement /></Protected>} />
          <Route path="/radiology" element={<Protected roles={["super_admin", "hospital_admin", "radiologist", "radiology_technician", "doctor", "nurse"]}><RadiologyManagement /></Protected>} />
          <Route path="/emergency" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "nurse", "receptionist"]}><EmergencyManagement /></Protected>} />
          <Route path="/mortuary" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "mortuary_officer", "records_officer"]}><MortuaryManagement /></Protected>} />
          <Route path="/appointments" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "receptionist"]}><AppointmentManagement /></Protected>} />
          <Route path="/reports" element={<Protected roles={["super_admin", "hospital_admin", "records_officer", "ict_admin", "receptionist", "doctor", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician"]}><Reports /></Protected>} />
          <Route path="/medical-report-review" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "records_officer"]}><MedicalDecisionReview /></Protected>} />
          <Route path="/notifications" element={<Protected roles={["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "records_officer", "patient"]}><NotificationCenter /></Protected>} />
          <Route path="/admin/staff" element={<Protected roles={["super_admin", "hospital_admin"]}><StaffManagement /></Protected>} />
          <Route path="/admin/users" element={<LegacyStaffManagementRedirect />} />
          <Route path="/users" element={<LegacyStaffManagementRedirect />} />
          <Route path="/user-management" element={<LegacyStaffManagementRedirect />} />
          <Route path="/settings" element={<Protected roles={roleGroups.admin}><Settings /></Protected>} />
          <Route path="/audit-logs" element={<Protected roles={["super_admin", "hospital_admin", "records_officer"]}><AuditLogs /></Protected>} />
          <Route path="/admin/login-activity" element={<Protected roles={["super_admin", "hospital_admin", "ict_admin"]}><LoginActivityReport /></Protected>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
