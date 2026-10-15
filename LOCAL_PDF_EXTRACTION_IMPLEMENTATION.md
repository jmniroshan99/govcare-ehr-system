# Local PDF extraction

The API now exposes `POST /api/patients/{patientId}/documents/{documentId}/local-extract` for users with `DOCUMENT_VIEW`. It authorizes access through the existing document service, reads the immutable stored PDF locally, extracts text page by page with Apache PDFBox, and returns important lines containing critical, abnormal, pending, follow-up, review, or recommendation indicators.

Every returned detail includes its source page and a warning to verify the original report. No document content leaves the local server and no diagnosis is inferred.

Scanned PDFs with no selectable text are returned as `NEEDS_MANUAL_REVIEW` with a warning. OCR requires a locally installed OCR engine and should be enabled only through a controlled server configuration; it is not silently simulated by the text extractor.
