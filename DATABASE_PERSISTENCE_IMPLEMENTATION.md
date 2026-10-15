# GovCare clinical-report and CKD AI persistence implementation

This build adds durable database persistence for the CKD AI-CDSS workflow requested in the supplied implementation specification. The database is now the authoritative store for uploaded source reports, extracted observations, AI input snapshots, predictions, explainability factors, recommendations, FHIR projections and generated CKD PDF reports.

## Added
- Flyway `V27__clinical_report_ai_assessment_persistence.sql` with `clinical_reports`, `clinical_observations`, `ai_assessments`, `ai_assessment_inputs`, `ai_assessment_factors`, `ai_assessment_recommendations`, and `generated_reports`.
- Uploaded CKD PDFs are first stored in GovCare's secure patient document storage, then extraction results are persisted with provenance and LOINC where available.
- SHA-256 duplicate detection prevents the same clinical PDF from being silently saved again for the same patient.
- Manual/model inputs are snapshot at assessment time. Historical predictions therefore do not depend on later observations.
- Manual overrides are stored as separate observations and can reference the original imported observation.
- CKD prediction, factors, recommendations and model version are persisted transactionally alongside the existing `ai_ckd_predictions` record.
- FHIR Patient projection is resolved/created as needed; extracted coded observations create FHIR Observation projections; CKD predictions create RiskAssessment and ClinicalImpression projections.
- CKD PDF generation is server-side from saved assessment data. Generated PDFs are securely stored, registered in `patient_documents` and `generated_reports`, and projected as FHIR DocumentReference.
- APIs added for report history, extracted observations, saved assessment retrieval, generated report creation/listing/download.
- CKD dashboard PDF button now requests a server-generated, persisted report instead of generating the authoritative report only in browser memory.

## Persistence behavior
Uploaded PDF -> secure patient document -> clinical report -> extracted observations -> reviewed feature snapshot -> saved prediction -> FHIR projection -> persisted generated PDF.

Missing values are not replaced with dummy values. Multiple legitimate observations are preserved. Historical AI snapshots are immutable records of the values supplied to that prediction.

## Build note
This package does not include `node_modules`. The execution environment used to prepare the package did not have a working Maven installation and the frontend dependencies were absent, so a complete Maven/Vite compile could not be executed here. Run the normal project dependency installation and build/test commands on the development machine before deployment.
