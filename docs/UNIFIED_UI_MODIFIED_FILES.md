# Files changed for the unified clinical UI

Comparison: the previous `GovCare_EHR_Modern_Clinical_Intelligence_FULL_SOURCE.zip` delivered before this update. Build output, dependencies, private configuration and the regenerated archive hash list are excluded.

## Modified existing files

- `START_HERE_MODERN_UI.md`
- `docs/MODIFIED_FILES_MODERN_UI.md`
- `docs/PREDICTIVE_INTELLIGENCE_ARCHITECTURE.md`
- `docs/PREDICTIVE_INTELLIGENCE_TEST_REPORT.md`
- `package.json`
- `scripts/verify-predictive-browser.mjs`
- `src/app/providers.tsx`
- `src/components/ai/predictive-intelligence.css`
- `src/components/forms/AuthorizedPatientSelect.tsx`
- `src/components/forms/ClinicalEnumSelect.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/motion/PageTransition.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/table.tsx`
- `src/dashboard/DashboardChart.tsx`
- `src/dashboard/RoleDashboardPage.tsx`
- `src/index.css`
- `src/pages/AICDSSDashboard.tsx`
- `src/pages/AIIntelligenceCenter.tsx`
- `src/pages/AppointmentManagement.tsx`
- `src/pages/AuditLogs.tsx`
- `src/pages/BloodReports.tsx`
- `src/pages/CKDAICDSS.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/DoctorDashboard.tsx`
- `src/pages/EfficiencyCommandCenter.tsx`
- `src/pages/GuardianManagement.tsx`
- `src/pages/LaboratoryManagement.tsx`
- `src/pages/MediaCenter.tsx`
- `src/pages/MedicalReportVerification.tsx`
- `src/pages/ModulePage.tsx`
- `src/pages/NewAdmission.tsx`
- `src/pages/OPDQueueManagement.tsx`
- `src/pages/PatientFieldConfiguration.tsx`
- `src/pages/PatientProfile.tsx`
- `src/pages/PatientReports.tsx`
- `src/pages/PatientSelfRegistration.tsx`
- `src/pages/PatientWorkbench.tsx`
- `src/pages/PharmacyModule.tsx`
- `src/pages/PredictiveClinicalIntelligence.tsx`
- `src/pages/Profile.tsx`
- `src/pages/RadiologyManagement.tsx`
- `src/pages/admin/StaffManagement.tsx`
- `src/pages/departments/DepartmentDocuments.tsx`
- `src/pages/patients/PatientDocuments.tsx`
- `src/routes/AppRouter.tsx`
- `src/services/aiCdssService.ts`
- `src/services/documentService.ts`
- `src/services/draftService.ts`
- `src/theme/colors.ts`
- `src/theme/tokens.css`

## New files

- `START_HERE_UNIFIED_CLINICAL_UI.md`
- `docs/CKD_WORKSPACE_INTEGRATION.md`
- `docs/UNIFIED_THEME_SYSTEM.md`
- `docs/UNIFIED_UI_COVERAGE.md`
- `docs/UNIFIED_UI_TEST_REPORT.md`
- `scripts/ckd-workspace.test.cjs`
- `src/components/ai/CkdClinicalWorkspace.tsx`
- `src/components/ui/page-header.tsx`
- `src/components/ui/workspace-tabs.tsx`
- `src/lib/ckdWorkspace.ts`
- `src/lib/patientOperationScope.ts`
- `src/theme/components.css`
- `verification/modern-ui/system-theme-browser-blocker.log`
- `verification/modern-ui/system-theme-build.log`
- `verification/modern-ui/system-theme-ckd-workspace.log`
- `verification/modern-ui/system-theme-dashboard.log`
- `verification/modern-ui/system-theme-doctor-workspace.log`
- `verification/modern-ui/system-theme-maven.log`
- `verification/modern-ui/system-theme-patient-registration.log`
- `verification/modern-ui/system-theme-predictive-access.log`
- `verification/modern-ui/system-theme-predictive-migration.log`
- `verification/modern-ui/system-theme-predictive.log`
- `verification/modern-ui/system-theme-roles.log`
- `verification/modern-ui/system-theme-searchable-select.log`
- `verification/modern-ui/system-theme-theme.log`
- `docs/UNIFIED_UI_MODIFIED_FILES.md` (this inventory)

## Backend and dependency scope

All 147 Java source/test files are unchanged. No SQL migration, dependency version, authentication policy, role dashboard definition, FHIR contract or CKD model coefficient was changed. Existing API helper parameters were extended with optional AbortSignal support. The package script adds `test:ckd-workspace`.
