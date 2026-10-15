# CKD Run Button / Validation Fix

Target: `/ai-cdss/ckd`

## Fixed
- The CKD assessment button is no longer disabled merely because model inputs are missing. Clicking it now produces visible validation feedback.
- Added field-level validation errors and a validation summary.
- The page scrolls/focuses the first invalid numeric field.
- Unresolved multi-PDF conflicts produce a visible review message and scroll to the conflict resolver.
- Added explicit validating, prediction, API-error, and success paths.
- Successful predictions scroll to the result panel.
- Preserved the existing `/api/ai-cdss/ckd/predict` endpoint and the exact existing model feature names.
- Preserved all 17 features required by `GOVCARE-CKD-LOGISTIC-1.0`; no fake optional model contract was introduced.
- Added broad technical/model-input guardrails to catch obvious unit/typing errors such as hemoglobin `232 g/dL` and potassium `123 mmol/L`. These are data-quality guardrails, not diagnostic thresholds.
- Tightened PDF hemoglobin matching so HbA1c/glycated-hemoglobin labels are not treated as ordinary hemoglobin.
- Manual/PDF provenance and manual override behavior are preserved.

## Important
The current backend model (`CkdPredictionService`) explicitly rejects a request when any of its 17 configured model features are missing. Therefore the frontend continues to require those same 17 model features rather than pretending missing values are optional or filling them with dummy values.

## Local build
The uploaded ZIP did not include installed `node_modules`, so TypeScript/Vite compilation could not be executed in this sandbox. Run `npm install` and then `npm run build` / `npm run dev:full` on the development machine.
