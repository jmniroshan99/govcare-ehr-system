import type { Role } from "../types/ehr";
import { useAuthStore } from "../stores/authStore";
import { dashboardDefinitions } from "./dashboardDefinitions";
import { RoleDashboardPage } from "./RoleDashboardPage";

export function dashboardKeyForRole(role: Role) {
  switch (role) {
    case "super_admin": return "super_admin" as const;
    case "hospital_admin": return "hospital_admin" as const;
    case "doctor": case "surgeon": case "anesthetist": return "doctor" as const;
    case "nurse": return "nurse" as const;
    case "receptionist": return "front_desk" as const;
    case "opd_officer": return "opd" as const;
    case "ward_manager": return "ward" as const;
    case "lab_technician": case "lab_manager": case "pathologist": return "laboratory" as const;
    case "radiology_technician": case "radiologist": return "radiology" as const;
    case "pharmacist": return "pharmacy" as const;
    case "inventory_officer": return "inventory" as const;
    case "finance_officer": return "finance" as const;
    case "records_officer": return "records" as const;
    case "patient": return "patient" as const;
    case "guardian": return "guardian" as const;
    case "emergency_staff": return "emergency" as const;
    case "quality_officer": return "quality" as const;
    case "ict_admin": return "it" as const;
    case "mortuary_officer": return "mortuary" as const;
  }
}

export const SuperAdminIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.super_admin} />;
export const HospitalAdminIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.hospital_admin} />;
export const DoctorIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.doctor} />;
export const NurseIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.nurse} />;
export const FrontDeskIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.front_desk} />;
export const OpdIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.opd} />;
export const WardManagerIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.ward} />;
export const LaboratoryIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.laboratory} />;
export const RadiologyIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.radiology} />;
export const PharmacyIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.pharmacy} />;
export const InventoryIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.inventory} />;
export const FinanceIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.finance} />;
export const RecordsIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.records} />;
export const PatientIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.patient} />;
export const GuardianIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.guardian} />;
export const EmergencyIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.emergency} />;
export const QualityIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.quality} />;
export const ItIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.it} />;
export const MortuaryIntelligenceDashboard = () => <RoleDashboardPage definition={dashboardDefinitions.mortuary} />;

export function DashboardRouter() {
  const role = useAuthStore((state) => state.profile?.role);
  if (!role) return null;
  switch (role) {
    case "super_admin": return <SuperAdminIntelligenceDashboard />;
    case "hospital_admin": return <HospitalAdminIntelligenceDashboard />;
    case "doctor": case "surgeon": case "anesthetist": return <DoctorIntelligenceDashboard />;
    case "nurse": return <NurseIntelligenceDashboard />;
    case "receptionist": return <FrontDeskIntelligenceDashboard />;
    case "opd_officer": return <OpdIntelligenceDashboard />;
    case "ward_manager": return <WardManagerIntelligenceDashboard />;
    case "lab_technician": case "lab_manager": case "pathologist": return <LaboratoryIntelligenceDashboard />;
    case "radiology_technician": case "radiologist": return <RadiologyIntelligenceDashboard />;
    case "pharmacist": return <PharmacyIntelligenceDashboard />;
    case "inventory_officer": return <InventoryIntelligenceDashboard />;
    case "finance_officer": return <FinanceIntelligenceDashboard />;
    case "records_officer": return <RecordsIntelligenceDashboard />;
    case "patient": return <PatientIntelligenceDashboard />;
    case "guardian": return <GuardianIntelligenceDashboard />;
    case "emergency_staff": return <EmergencyIntelligenceDashboard />;
    case "quality_officer": return <QualityIntelligenceDashboard />;
    case "ict_admin": return <ItIntelligenceDashboard />;
    case "mortuary_officer": return <MortuaryIntelligenceDashboard />;
  }
}
