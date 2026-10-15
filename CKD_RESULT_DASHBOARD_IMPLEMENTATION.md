# GovCare CKD AI Result Dashboard

Implemented the requested presentation-only redesign for `/ai-cdss/ckd`.

## Changed
- Replaced plain-text prediction output with a responsive clinical dashboard.
- Added risk gauge driven by backend `riskCategory` and `probability`.
- Separated AI confidence from patient risk.
- Added patient identity/photo header and assessment/model metadata.
- Converted internal feature names to clinician-facing labels without changing model keys.
- Separated increasing/decreasing model contributions and explicitly avoids equating contribution direction with clinical normality.
- Added backend-derived recommended-action cards.
- Added collapsible clinical input provenance with source/LOINC/extraction confidence.
- Added prediction traceability and print-focused CSS.
- Preserved the existing AI endpoint, model, PDF workflow, validation, authorization and input values.

## Important
No risk thresholds, prediction coefficients, confidence calculation, model input contract, PDF extraction logic, or backend prediction endpoint were changed. No mock result data was added.
