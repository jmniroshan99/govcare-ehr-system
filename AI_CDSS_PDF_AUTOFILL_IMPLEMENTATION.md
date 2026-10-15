# AI-CDSS PDF auto-fill implementation

Implemented on `/ai-cdss`:
- one shared CKD clinical data state for PDF/EHR/manual values;
- local PDF upload and authorized patient-document selection;
- server-side PDF signature/size/MIME validation and PDFBox text extraction;
- CKD lab parsing, unit normalization, LOINC mapping where semantics are known;
- creatinine µmol/L -> mg/dL normalization while retaining original value/unit;
- auto-population of the editable clinical form with PDF/EHR source metadata;
- MANUAL_OVERRIDE provenance in the UI when an imported value is corrected;
- extraction summary, confidence, warnings, reset-imported-values, loading/error states;
- no persistence on PDF read, preventing duplicate Observations from repeated parsing;
- existing real GOVCARE-CKD-LOGISTIC-1.0 prediction endpoint remains the prediction source.

## OCR behavior
The existing GovCare local PDF extraction layer uses PDFBox. Image-only PDFs are detected and returned as `OCR_REQUIRED`; values are never fabricated. A native OCR engine is intentionally not bundled into this patch because the project currently has no configured OCR runtime/language-data dependency. Manual entry remains available. A production OCR adapter can be connected to this explicit state without changing the shared-form workflow.

## Build validation
`npm run build` could not run to TypeScript compilation in this container because the uploaded ZIP does not contain `node_modules`; TypeScript reports missing `vite/client` and `node` type definitions. Run `npm install` (or `npm ci`) in the extracted project before `npm run build`. Maven is not installed in this execution environment, so run the normal `npm run dev:full` / Maven build on the development machine.
