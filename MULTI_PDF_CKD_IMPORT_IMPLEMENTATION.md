# GovCare CKD AI-CDSS Multi-PDF Import

Implemented for `/ai-cdss/ckd` from the supplied multi-PDF specification.

## Added
- Multiple local PDF selection (up to 10 client-side/backend limit).
- Multiple authorized EHR PDF selection.
- Mixed local + authorized EHR report processing.
- `POST /api/ai-cdss/pdf/extract-multiple` for independently parsing multiple uploaded PDFs.
- `MultiReportClinicalExtractionService` for report classification, safe merge, and conflict detection.
- Report categories: URINE, RENAL_FUNCTION, DIABETES, CBC, OTHER.
- One shared CKD clinical review form populated from all non-conflicting extracted results.
- Per-value source report provenance in the review form.
- Conflict UI: different values for the same feature are not silently overwritten; clinician must select one.
- Partial extraction results remain available; no Observations are persisted merely by parsing PDFs.
- Existing manual entry, draft workflow, real CKD prediction call, and patient profile photo were preserved.

## Important behavior
- Two or more reports are required for the multi-report workflow.
- Text-layer PDFs use the existing local PDF extraction service.
- Image-only PDFs retain the existing OCR_REQUIRED behavior when OCR is not configured.
- ACR continues to avoid an invented LOINC mapping when specimen/method semantics are insufficient.
- Conflicts block CKD prediction until resolved.

## Build validation
A full frontend dependency install could not be completed in the sandbox because `npm install` timed out. Run `npm install` on the target workstation before `npm run build` / `npm run dev:full`. Maven was not available in the sandbox for a full Spring build.
