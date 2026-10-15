# CKD module recovery + PDF/report fix

- Added a CKD-specific authorized-patient endpoint that does not depend on optional ward/admission enrichment. This prevents the CKD selector from being taken down by a ward-context query failure.
- PatientService ward enrichment is now non-fatal: core authorized patient records remain available if supplementary ward context cannot be loaded.
- CKD result dashboard now exports a real PDF report from the actual prediction, selected patient, clinical values, source metadata, model factors, recommendations and disclaimer. It also supports browser print.
- The general AI-CDSS PDF reader now automatically reads a newly uploaded/selected text PDF and maps only recognized deterioration-model labels (RR, SpO2, SBP, pulse/HR, temperature, WBC, haemoglobin, platelets). It does not insert unrelated numbers.
- Image-only/scanned PDFs are explicitly reported as requiring OCR/manual verification. This package does not pretend OCR exists when no OCR engine is configured.
- Existing CKD multi-PDF extraction, provenance, validation, FHIR flow and prediction logic are preserved.
