# UI coverage audit

Audit date: 2026-10-05. This table records how each of the 60 page source files receives the shared visual system. It does not assert live screenshot verification. Protected routes also inherit the shared shell, raw form/table theme rules and navigation styles.

| Page source | Shared design coverage |
| --- | --- |
| `src/pages/AICDSSDashboard.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/AIIntelligenceCenter.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/AdmissionsManagement.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/AppointmentManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/AuditLogs.tsx` | Modern page header; Shared cards |
| `src/pages/BloodReports.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/CKDAICDSS.tsx` | Integrated clinical workspace and patient-bound assessment; Shared cards; Shared controls |
| `src/pages/CareSummary.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/ChangeTemporaryPassword.tsx` | Shared cards; Shared controls |
| `src/pages/Dashboard.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/DoctorDashboard.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/DoctorWorkspace.tsx` | Shared cards; Shared controls; Clinical task panels; existing compact-note workflow retained |
| `src/pages/EPrescription.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/EfficiencyCommandCenter.tsx` | Modern page header; Shared cards |
| `src/pages/EmergencyManagement.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/FutureCareWorkflow.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/GuardianManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/LaboratoryManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/Login.tsx` | Shared cards; Shared controls |
| `src/pages/LoginActivityReport.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/MediaCenter.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/MedicalDecisionRequests.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/MedicalDecisionReview.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/MedicalReportVerification.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/ModulePage.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/MortuaryManagement.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/NewAdmission.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/NotificationCenter.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/NurseModule.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/OPDQueueManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/OperationTheatre.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/PatientAppointments.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/PatientCommunication.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/PatientFieldConfiguration.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PatientPortal.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/PatientProfile.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PatientRegistration.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/PatientReports.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PatientSelfRegistration.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PatientWorkbench.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PharmacyModule.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/PredictiveClinicalIntelligence.tsx` | Guarded route alias and embedded clinical panels using shared tokens; Shared controls |
| `src/pages/Profile.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/RadiologyManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/Reports.tsx` | Role-specific DashboardRouter and shared dashboard header/charts |
| `src/pages/ResetPassword.tsx` | Shared cards; Shared controls |
| `src/pages/Settings.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/SuperAdminDashboard.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/UserManagement.tsx` | Compatibility export of modern StaffManagement |
| `src/pages/WardManagement.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/admin/FacilityAdministration.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/admin/StaffManagement.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/departments/DepartmentDocuments.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/patients/PatientDocuments.tsx` | Modern page header; Shared cards; Shared controls |
| `src/pages/transfers/InterHospitalTransfers.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/transfers/InternalTransfers.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/wards/BedAllocation.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/wards/BedBoard.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/wards/WardDashboard.tsx` | Shared hero styling; Shared cards; Shared controls |
| `src/pages/wards/WardManagement.tsx` | Shared hero styling; Shared cards; Shared controls |

## Role dashboard coverage

The unchanged `src/dashboard/DashboardRouter.tsx` and `dashboardDefinitions.ts` continue to resolve distinct dashboards for all 18 requested access roles, plus existing clinical-role aliases and the mortuary role. `RoleDashboardPage.tsx` now uses the shared modern PageHeader, and its metrics, scoped worklists and lazy charts inherit the common theme. Server role selection, unavailable-value handling, hospital selection and permission-filtered quick actions remain intact.

## Source color audit

No hard-coded display color was found in TS/TSX/CSS outside `colors.ts` and generated `tokens.css`. The only regular-expression match elsewhere was the HTML escape entity `&#039;` in patient registration; it is not a color. Fixed logo/SVG assets and printed-document palettes remain separate from display-theme decisions.
