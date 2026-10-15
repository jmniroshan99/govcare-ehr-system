import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Skeleton } from "../components/ui/skeleton";
import { authorizationContextKey, defaultHomeForProfile, isActiveAccount } from "../lib/accessControl";
import { canAccessPath } from "../lib/roleAccess";
import { getStoredAuthenticatedUser, identifyAuthenticatedUser, logout, watchAuth } from "../services/authService";
import { useAuthStore } from "../stores/authStore";

const lazyPage = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const Login = lazyPage(() => import("../pages/Login"), "Login");
const ResetPassword = lazyPage(() => import("../pages/ResetPassword"), "ResetPassword");
const ChangeTemporaryPassword = lazyPage(() => import("../pages/ChangeTemporaryPassword"), "ChangeTemporaryPassword");
const AdmissionsManagement = lazyPage(() => import("../pages/AdmissionsManagement"), "AdmissionsManagement");
const NewAdmission = lazyPage(() => import("../pages/NewAdmission"), "NewAdmission");
const AppointmentManagement = lazyPage(() => import("../pages/AppointmentManagement"), "AppointmentManagement");
const AuditLogs = lazy(() => import("../pages/AuditLogs"));
const CareSummary = lazyPage(() => import("../pages/CareSummary"), "CareSummary");
const DashboardRouter = lazy(async () => ({ default: (await import("../dashboard/DashboardRouter")).DashboardRouter }));
const DoctorDashboard = lazyPage(() => import("../pages/DoctorDashboard"), "DoctorDashboard");
const DoctorWorkspace = lazyPage(() => import("../pages/DoctorWorkspace"), "DoctorWorkspace");
const EmergencyManagement = lazyPage(() => import("../pages/EmergencyManagement"), "EmergencyManagement");
const FutureCareWorkflow = lazyPage(() => import("../pages/FutureCareWorkflow"), "FutureCareWorkflow");
const GuardianManagement = lazyPage(() => import("../pages/GuardianManagement"), "GuardianManagement");
const LaboratoryManagement = lazyPage(() => import("../pages/LaboratoryManagement"), "LaboratoryManagement");
const BloodReports = lazyPage(() => import("../pages/BloodReports"), "BloodReports");
const AIIntelligenceCenter = lazyPage(() => import("../pages/AIIntelligenceCenter"), "AIIntelligenceCenter");
const AICDSSDashboard = lazyPage(() => import("../pages/AICDSSDashboard"), "AICDSSDashboard");
const CKDAICDSS = lazyPage(() => import("../pages/CKDAICDSS"), "CKDAICDSS");
const PredictiveClinicalIntelligence = lazy(async () => ({ default: (await import("../pages/PredictiveClinicalIntelligence")).PredictiveClinicalIntelligence }));
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
const StaffManagement = lazyPage(() => import("../pages/admin/StaffManagement"), "StaffManagement");
const FacilityAdministration = lazyPage(() => import("../pages/admin/FacilityAdministration"), "FacilityAdministration");
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

function Protected({ children }: { children: React.ReactNode }) {
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
  if (!canAccessPath(profile, location.pathname)) {
    return <AppShell key={authorizationContextKey(profile)}><div className="mx-auto mt-16 max-w-xl rounded-2xl border border-danger-border bg-danger-surface p-8 text-center dark:border-danger-border dark:bg-danger-surface"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-3 text-sm">Your account does not have permission to access this module.</p><a className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" href={defaultHomeForProfile(profile)}>Return to your dashboard</a></div></AppShell>;
  }
  return <AppShell key={authorizationContextKey(profile)}>{children}</AppShell>;
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
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    const resolveSession = async (user: ReturnType<typeof getStoredAuthenticatedUser>) => {
      const currentRevision = ++revision;
      if (!user) {
        clearAuth();
        setSessionReady(true);
        return;
      }
      // The login form owns the authenticated profile during an interactive sign-in.
      if (window.sessionStorage.getItem("govcare-login-intent")) {
        setSessionReady(true);
        return;
      }
      try {
        const profile = await identifyAuthenticatedUser(user);
        if (disposed || revision !== currentRevision) return;
        setProfile(profile);
      } catch {
        if (disposed || revision !== currentRevision) return;
        await logout();
        clearAuth();
      } finally {
        if (!disposed && revision === currentRevision) setSessionReady(true);
      }
    };
    const unsubscribe = watchAuth(resolveSession);
    const refresh = () => {
      if (document.visibilityState !== "hidden") void resolveSession(getStoredAuthenticatedUser());
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      revision++;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [clearAuth, storedProfile?.uid, setProfile]);

  if (!sessionReady) return <Loading />;

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
          <Route path="/super-admin" element={<Protected><DashboardRouter /></Protected>} />
          <Route path="/ai-dashboard" element={<Protected><AIIntelligenceCenter /></Protected>} />
          <Route path="/ai-cdss" element={<Protected><AICDSSDashboard /></Protected>} />
          <Route path="/ai-cdss/ckd" element={<Protected><CKDAICDSS /></Protected>} />
          <Route path="/ai-cdss/ckd/predictive-intelligence" element={<Protected><PredictiveClinicalIntelligence /></Protected>} />
          <Route path="/efficiency" element={<Protected><DashboardRouter /></Protected>} />
          <Route path="/" element={<Protected><DashboardRouter /></Protected>} />
          <Route path="/portal" element={<Protected><DashboardRouter /></Protected>} />
          <Route path="/portal/appointments" element={<Protected><PatientAppointments /></Protected>} />
          <Route path="/portal/messages" element={<Protected><PatientCommunication /></Protected>} />
          <Route path="/portal/reports" element={<Protected><PatientReports /></Protected>} />
          <Route path="/portal/medical-reports" element={<Protected><MedicalDecisionRequests /></Protected>} />
          <Route path="/media" element={<Protected><MediaCenter /></Protected>} />
          <Route path="/portal/care-summary" element={<Protected><CareSummary /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/doctor" element={<Protected><DoctorDashboard /></Protected>} />
          <Route path="/doctor/workspace" element={<Protected><DoctorWorkspace /></Protected>} />
          <Route path="/doctor/workspace/:patientUuid" element={<Protected><DoctorWorkspace /></Protected>} />
          <Route path="/patients/register" element={<Protected><PatientRegistration /></Protected>} />
          <Route path="/admin/patient-fields" element={<Protected><PatientFieldConfiguration /></Protected>} />
          <Route path="/patients/search" element={<Protected><PatientWorkbench /></Protected>} />
          <Route path="/guardians" element={<Protected><GuardianManagement /></Protected>} />
          <Route path="/patients/:id" element={<Protected><PatientProfile /></Protected>} />
          <Route path="/patients/:patientId/documents" element={<Protected><PatientDocuments /></Protected>} />
          <Route path="/laboratory/documents" element={<Protected><DepartmentDocuments /></Protected>} />
          <Route path="/radiology/documents" element={<Protected><DepartmentDocuments /></Protected>} />
          <Route path="/pharmacy/documents" element={<Protected><DepartmentDocuments /></Protected>} />
          <Route path="/doctor/documents" element={<Protected><DepartmentDocuments /></Protected>} />
          <Route path="/ward/documents" element={<Protected><DepartmentDocuments /></Protected>} />
          <Route path="/opd" element={<Protected><OPDQueueManagement /></Protected>} />
          <Route path="/consultation" element={<Protected><Navigate to="/doctor/workspace" replace /></Protected>} />
          <Route path="/nurse-notes" element={<Protected><NurseModule /></Protected>} />
          <Route path="/admissions" element={<Protected><AdmissionsManagement /></Protected>} />
          <Route path="/admissions/new" element={<Protected><NewAdmission /></Protected>} />
          <Route path="/wards" element={<Protected><WardDashboard /></Protected>} />
          <Route path="/admin/wards" element={<Protected><WardAdministration /></Protected>} />
          <Route path="/wards/bed-board" element={<Protected><BedBoard /></Protected>} />
          <Route path="/admissions/bed-allocation" element={<Protected><BedAllocation /></Protected>} />
          <Route path="/transfers/internal" element={<Protected><InternalTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital" element={<Protected><InterHospitalTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital/incoming" element={<Protected><IncomingTransfers /></Protected>} />
          <Route path="/transfers/inter-hospital/outgoing" element={<Protected><OutgoingTransfers /></Protected>} />
          <Route path="/operation-theatre" element={<Protected><OperationTheatre /></Protected>} />
          <Route path="/future-care" element={<Protected><FutureCareWorkflow /></Protected>} />
          <Route path="/pharmacy" element={<Protected><PharmacyModule /></Protected>} />
          <Route path="/e-prescription" element={<Protected><Navigate to="/doctor/workspace" replace /></Protected>} />
          <Route path="/laboratory" element={<Protected><LaboratoryManagement /></Protected>} />
          <Route path="/laboratory/blood-reports" element={<Protected><BloodReports /></Protected>} />
          <Route path="/radiology" element={<Protected><RadiologyManagement /></Protected>} />
          <Route path="/emergency" element={<Protected><EmergencyManagement /></Protected>} />
          <Route path="/mortuary" element={<Protected><MortuaryManagement /></Protected>} />
          <Route path="/appointments" element={<Protected><AppointmentManagement /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/medical-report-review" element={<Protected><MedicalDecisionReview /></Protected>} />
          <Route path="/notifications" element={<Protected><NotificationCenter /></Protected>} />
          <Route path="/admin/staff" element={<Protected><StaffManagement /></Protected>} />
          <Route path="/admin/facilities" element={<Protected><FacilityAdministration /></Protected>} />
          <Route path="/admin/users" element={<LegacyStaffManagementRedirect />} />
          <Route path="/users" element={<LegacyStaffManagementRedirect />} />
          <Route path="/user-management" element={<LegacyStaffManagementRedirect />} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/audit-logs" element={<Protected><AuditLogs /></Protected>} />
          <Route path="/admin/login-activity" element={<Protected><LoginActivityReport /></Protected>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
