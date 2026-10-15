# Modified files — modern clinical workspace

> Latest UI update (2026-10-05): CKD assessment and predictive intelligence now share one patient workspace, and the modern theme is applied across the application. See `START_HERE_UNIFIED_CLINICAL_UI.md`, `docs/UNIFIED_THEME_SYSTEM.md`, `docs/CKD_WORKSPACE_INTEGRATION.md` and `docs/UNIFIED_UI_TEST_REPORT.md` for the current UI and verification status. The backend architecture and prior evidence below remain preserved.


Baseline: current patient-registration/doctor-workspace source. 20 existing files modified; 51 files added. No existing application source was deleted.

## Latest startup correction relative to the compiler-fixed ZIP

Java, frontend application source, SQL migrations and dependencies are unchanged. The local launchers select and share available ports; startup tests, guides and verification evidence are updated.

- `package.json`
- `run-windows.bat`
- `scripts/api-port.cjs`
- `scripts/api-port.test.cjs`
- `scripts/run-full-stack.cjs`
- `scripts/run-full-stack.test.cjs`
- `scripts/run-spring.mjs`
- `scripts/run-spring.test.mjs`
- `scripts/start-full-dev.cjs`

## Earlier compiler correction

`PredictiveIntelligenceService.java` uses explicit FHIR imports and a qualified `ClinicalIntelligenceEngine.Observation` declaration. Clinical algorithms and API contracts are preserved.

## Existing files modified from the baseline

- `README.md`
- `package.json`
- `run-windows.bat`
- `scripts/run-full-stack.cjs`
- `scripts/run-full-stack.test.cjs`
- `scripts/run-spring.mjs`
- `scripts/run-spring.test.mjs`
- `scripts/start-full-dev.cjs`
- `scripts/test-superadmin-java.mjs`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/CkdPredictionService.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalPersistenceService.java`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/navItems.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/si.json`
- `src/i18n/locales/ta.json`
- `src/lib/roleAccess.ts`
- `src/pages/CKDAICDSS.tsx`
- `src/routes/AppRouter.tsx`
- `src/routes/routePreload.ts`

## New files from the baseline

- `BUILD_FIX_OBSERVATION_AMBIGUITY.md`
- `STARTUP_PORT_CONFLICT_FIX.md`
- `START_HERE_MODERN_UI.md`
- `docs/MODIFIED_FILES_MODERN_UI.md`
- `docs/PREDICTIVE_INTELLIGENCE_API_DATABASE.md`
- `docs/PREDICTIVE_INTELLIGENCE_ARCHITECTURE.md`
- `docs/PREDICTIVE_INTELLIGENCE_AUDIT.md`
- `docs/PREDICTIVE_INTELLIGENCE_BUILD.md`
- `docs/PREDICTIVE_INTELLIGENCE_PERMISSIONS.md`
- `docs/PREDICTIVE_INTELLIGENCE_TEST_REPORT.md`
- `scripts/api-port.cjs`
- `scripts/api-port.test.cjs`
- `scripts/predictive-access.test.cjs`
- `scripts/test-predictive-domain.mjs`
- `scripts/verify-predictive-browser.mjs`
- `scripts/verify-predictive-migration.mjs`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalIntelligenceEngine.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalMeasurementDates.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/PredictiveIntelligenceController.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/PredictiveIntelligenceService.java`
- `spring-api/src/main/resources/db/migration/V35__predictive_clinical_intelligence.sql`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/ClinicalIntelligenceChecks.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/ClinicalIntelligenceEngineTest.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/PredictiveIntelligenceSecurityTest.java`
- `src/components/ai/KidneyTrendChart.tsx`
- `src/components/ai/predictive-intelligence.css`
- `src/pages/PredictiveClinicalIntelligence.tsx`
- `src/services/predictiveIntelligenceService.ts`
- `verification/modern-ui/README.md`
- `verification/modern-ui/api-port-frontend-build.log`
- `verification/modern-ui/api-port-frontend-url-evidence.txt`
- `verification/modern-ui/api-port-regression-before.log`
- `verification/modern-ui/api-port-startup-final.log`
- `verification/modern-ui/browser-install.log`
- `verification/modern-ui/dashboard-test.log`
- `verification/modern-ui/doctor-workspace-test.log`
- `verification/modern-ui/frontend-build.log`
- `verification/modern-ui/java-syntax.log`
- `verification/modern-ui/maven-clean-test.log`
- `verification/modern-ui/observation-build-fix-maven.log`
- `verification/modern-ui/observation-build-fix-predictive.log`
- `verification/modern-ui/observation-build-fix-syntax.log`
- `verification/modern-ui/predictive-access-final.log`
- `verification/modern-ui/predictive-domain-final.log`
- `verification/modern-ui/predictive-migration-final.log`
- `verification/modern-ui/predictive-tests-final.log`
- `verification/modern-ui/registration-test.log`
- `verification/modern-ui/roles-test.log`
- `verification/modern-ui/superadmin-test.log`
- `verification/modern-ui/theme-test.log`
- `verification/modern-ui/windows-maven-and-startup-supplied.log`

## Prior verification logs omitted from this copy

These older generated logs remain in the unchanged baseline. Current delivery evidence is under `verification/modern-ui/`.

- `verification/superadmin-facility/maven-clean-test.log`
- `verification/theme/clinical-access-and-compilation.log`
- `verification/theme/dashboard-tests.log`
- `verification/theme/frontend-build.log`
- `verification/theme/java-syntax.log`
- `verification/theme/maven-clean-test.log`
- `verification/theme/role-tests.log`
- `verification/theme/startup-tests.log`
- `verification/theme/theme-tests.log`
