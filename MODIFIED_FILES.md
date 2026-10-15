# Modified and added files — V41

Compared by SHA-256 with the original supplied GovCare V40 ZIP. All other packaged original source files retain their original bytes. Installed dependencies, build intermediates, local environment files, operational credentials/storage and the private HMAC key are excluded.

## Modified existing files

- `README.md`
- `package.json`
- `scripts/verify-predictive-migration.mjs`
- `spring-api/.env.example`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/CkdAssessmentReportService.java`
- `spring-api/src/main/resources/application.yml`
- `src/components/layout/AppShell.tsx`
- `src/pages/PredictiveClinicalIntelligence.tsx`

## Added files

- `ML_Server/.env.example`
- `ML_Server/manage.py`
- `ML_Server/ml_server/__init__.py`
- `ML_Server/ml_server/settings.py`
- `ML_Server/ml_server/urls.py`
- `ML_Server/ml_server/wsgi.py`
- `ML_Server/renal_service/__init__.py`
- `ML_Server/renal_service/auth.py`
- `ML_Server/renal_service/inference.py`
- `ML_Server/renal_service/tests.py`
- `ML_Server/renal_service/views.py`
- `ML_Server/requirements.txt`
- `MODEL_RESULTS_OVERVIEW.md`
- `PROJECT_ANALYSIS_AND_CHANGES.md`
- `RUN_SRI_LANKAN_RENAL.md`
- `TESTING_AND_ACCEPTANCE_REPORT.md`
- `WINDOWS_STARTUP_FIX.md`
- `ml-training/artifacts/dry-weight/metadata.json`
- `ml-training/artifacts/hb-risk/metadata.json`
- `ml-training/artifacts/hb-risk/metrics.json`
- `ml-training/artifacts/hb-risk/model.joblib`
- `ml-training/artifacts/hb-risk/preprocessor.joblib`
- `ml-training/artifacts/hb-risk/research_classifier.joblib`
- `ml-training/artifacts/urr-risk/metadata.json`
- `ml-training/artifacts/urr-risk/metrics.json`
- `ml-training/artifacts/urr-risk/model.joblib`
- `ml-training/artifacts/urr-risk/preprocessor.joblib`
- `ml-training/artifacts/urr-risk/research_classifier.joblib`
- `ml-training/data/deidentified_monthly.csv`
- `ml-training/evaluation/__init__.py`
- `ml-training/evaluation/metrics.py`
- `ml-training/explainability/__init__.py`
- `ml-training/explainability/xai.py`
- `ml-training/preprocessing/__init__.py`
- `ml-training/preprocessing/clean_data.py`
- `ml-training/preprocessing/load_data.py`
- `ml-training/preprocessing/longitudinal_features.py`
- `ml-training/preprocessing/normalize_units.py`
- `ml-training/preprocessing/validate_data.py`
- `ml-training/reports/DATASET_AUDIT_REPORT.md`
- `ml-training/reports/LEAKAGE_AUDIT_REPORT.md`
- `ml-training/reports/SRI_LANKAN_RENAL_MODEL_TRAINING_REPORT.md`
- `ml-training/reports/classification_comparison.csv`
- `ml-training/reports/dataset_audit.json`
- `ml-training/reports/dry_weight_audit.json`
- `ml-training/reports/feature_definitions.json`
- `ml-training/reports/hb-risk/classification_curves.png`
- `ml-training/reports/hb-risk/patientwise_test_metrics.csv`
- `ml-training/reports/hb-risk/shap_summary.png`
- `ml-training/reports/hb-risk/test_predictions.csv`
- `ml-training/reports/hb-risk/top_features.csv`
- `ml-training/reports/hb-risk/train_predictions.csv`
- `ml-training/reports/hb-risk/validation_predictions.csv`
- `ml-training/reports/idh_audit.json`
- `ml-training/reports/model_comparison.csv`
- `ml-training/reports/patient_cohort.csv`
- `ml-training/reports/patient_split_manifest.json`
- `ml-training/reports/quality_flags.csv`
- `ml-training/reports/training_summary.json`
- `ml-training/reports/urr-risk/classification_curves.png`
- `ml-training/reports/urr-risk/patientwise_test_metrics.csv`
- `ml-training/reports/urr-risk/shap_summary.png`
- `ml-training/reports/urr-risk/test_predictions.csv`
- `ml-training/reports/urr-risk/top_features.csv`
- `ml-training/reports/urr-risk/train_predictions.csv`
- `ml-training/reports/urr-risk/validation_predictions.csv`
- `ml-training/reproduce_packaged_evaluation.py`
- `ml-training/requirements.txt`
- `ml-training/run_training.py`
- `ml-training/tests/test_pipeline.py`
- `ml-training/training/__init__.py`
- `scripts/configure-renal-local.cjs`
- `scripts/renal-local-config.test.cjs`
- `scripts/renal-measurement-units.test.mjs`
- `scripts/run-renal-ml.cjs`
- `scripts/run-renal-stack.cjs`
- `scripts/verify-renal-api.mjs`
- `scripts/verify-renal-browser.mjs`
- `scripts/verify-renal-migration.mjs`
- `setup-renal-ml-windows.bat`
- `spring-api/logs/govcare-spring-api.log.2026-10-08.0.gz`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/RenalPredictionJsonSerializer.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/SriLankanRenalIntelligenceController.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/SriLankanRenalIntelligenceService.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/SriLankanRenalMlClient.java`
- `spring-api/src/main/resources/db/migration/V41__sri_lankan_renal_intelligence.sql`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalIntelligenceServiceTest.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalMlClientTest.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalReportTest.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalSerializationTest.java`
- `src/components/ai/SriLankanRenalPanel.tsx`
- `src/components/ai/sri-lankan-renal.css`
- `src/lib/renalMeasurementUnits.ts`
- `src/services/renalIntelligenceService.ts`
- `start-renal-fullstack-windows.bat`
- `verification/renal-api-report.json`
- `verification/renal-chart-sizing.json`
- `verification/renal-execution-summary.json`
- `verification/renal-final-checkpoint.json`
- `verification/renal-pdf-report.json`
- `verification/renal-persistence-report.json`
- `verification/renal-responsive-regression.json`
- `verification/renal-screenshots/browser-report.json`
- `verification/renal-screenshots/doctor-renal-dark-1366.png`
- `verification/renal-screenshots/doctor-renal-dark-375.png`
- `verification/renal-screenshots/doctor-renal-light-1366.png`
- `verification/renal-screenshots/doctor-renal-light-375.png`
- `verification/renal-timestamp-regression.json`
- `verification/renal-windows-startup-fix.json`
- `MODIFIED_FILES.md`
- `PACKAGE_MANIFEST.json`

8 original files modified; 111 files added (source, artifacts, reports, verification evidence).

The 2026-10-10 startup follow-up modifies only the two new renal Windows launchers and their documentation, adds the startup note/evidence, and refreshes this inventory and the package manifest. The 54 existing research files are unchanged from the completed integration checkpoint.

## CKD clinical risk graphics integration

- `src/components/ai/SriLankanRenalPanel.tsx`
  - Added patient-scoped visual intelligence map for anemia/Hb deterioration, hyperkalemia monitoring, dialysis adequacy/URR and renal clinical deterioration.
  - Added live sparklines from dated renal observations and safe display of existing Hb/URR research forecasts.
  - Added current renal context centre panel and research workflow strip.
  - Added conceptual infographic disclosure with explicit non-patient-specific labelling.
- `src/components/ai/sri-lankan-renal.css`
  - Added responsive infographic-style visual map, cards, kidney graphic, mini trend charts and mobile layouts.
- `public/research/ckd-risk-predictive-intelligence-dashboard.png`
  - Added the generated conceptual CKD clinical-risk infographic.
- `scripts/renal-clinical-risk-graphics.test.cjs`
  - Added static regression checks for module presence, data binding, safety language, asset packaging and responsive CSS.
- `package.json`
  - Added `test:renal:graphics` command.
- `CKD_CLINICAL_RISK_GRAPHICS_INTEGRATION.md`
  - Added implementation, safety, validation and limitation notes.


## V43 hyperkalemia, deterioration composite and CKD PDF

Modified or added in this update:

- `ml-training/train_hyperkalemia_from_packaged.py`
- `ml-training/artifacts/hyperkalemia-risk/model.joblib`
- `ml-training/artifacts/hyperkalemia-risk/metadata.json`
- `ml-training/artifacts/hyperkalemia-risk/metrics.json`
- `ml-training/reports/hyperkalemia-risk/*`
- `ML_Server/renal_service/inference.py`
- `ML_Server/renal_service/tests.py`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/SriLankanRenalMlClient.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/SriLankanRenalIntelligenceService.java`
- `spring-api/src/main/java/lk/gov/health/govcare/ai/CkdAssessmentReportService.java`
- `spring-api/src/main/resources/db/migration/V42__sri_lankan_hyperkalemia_and_composite.sql`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalMlClientTest.java`
- `spring-api/src/test/java/lk/gov/health/govcare/ai/SriLankanRenalReportTest.java`
- `src/services/renalIntelligenceService.ts`
- `src/components/ai/SriLankanRenalPanel.tsx`
- `src/components/ai/sri-lankan-renal.css`
- `scripts/verify-renal-migration.mjs`
- `scripts/verify-renal-api.mjs`
- `scripts/verify-renal-browser.mjs`
- `scripts/renal-clinical-risk-graphics.test.cjs`
- `package.json`
- `README.md`
- `RUN_SRI_LANKAN_RENAL.md`
- `MODEL_RESULTS_OVERVIEW.md`
- `SRI_LANKAN_HYPERKALEMIA_COMPOSITE_PDF_INTEGRATION.md`
- `V43_VALIDATION_REPORT.md`

No existing data structure is deleted. V42 is additive except for replacing V41 check constraints with equivalent extended constraints that admit the new governed hyperkalemia output.
