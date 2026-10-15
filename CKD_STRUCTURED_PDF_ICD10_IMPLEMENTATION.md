# GovCare CKD Structured PDF + ICD Coding Assistance

Implemented from the supplied CKD report redesign specification.

## Changes
- Added one centralized `CkdStageClassificationService` for eGFR-based G-category coding assistance.
- Added migration `V28__ckd_stage_coding_report.sql` to snapshot suggested G category/stage/code/system/display/basis in `ai_assessments`.
- Added explicit ICD-10-CM terminology rows for the supplied CKD catalogue while preserving the older terminology rows for migration compatibility.
- CKD prediction responses now include suggested stage, G category, ICD coding suggestion, basis, coding status and confirmation status.
- FHIR `ClinicalImpression` now carries the AI-assisted coding suggestion as a finding while remaining explicitly non-diagnostic.
- Rebuilt `CkdAssessmentReportService` so the PDF no longer renders raw Map/List dumps. It renders structured patient/report details, risk summary, CKD classification/coding, G-category indicator, renal findings, complete input table with provenance/coding, model factors, recommendations, clinician review and page footer metadata.
- Added the CKD classification/coding card and G1-G5 indicator to the web result dashboard.

## Clinical safety behavior
- A single eGFR is used only for G-category/coding assistance; it does not establish CKD chronicity or a confirmed diagnosis.
- N18.6 ESRD is not inferred from eGFR alone.
- AI coding suggestions are not automatically persisted as confirmed FHIR `Condition` resources.
- Existing patient identity, PDF extraction, model execution, persistence, FHIR projection and authorization flows are preserved.

## Migration
On startup, Flyway must apply V28 after the existing V27 migration.
