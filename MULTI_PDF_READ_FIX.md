# CKD PDF Read Fix

Fixed the clinical PDF import so the CKD page can read **one or more PDFs**. Previously the UI required at least two total reports before enabling the read button, so a single selected report (as shown in the reported screen) could not be processed.

Changes:
- One PDF now enables `Read Report Automatically`.
- Two or more reports use `Read All Reports Automatically`.
- Selecting files again appends reports instead of replacing the previous selection (up to 10).
- The multi-PDF backend endpoint now accepts one or more PDFs for API consistency.
- Existing independent extraction, merge, conflict handling, provenance, manual review, and CKD model flow are preserved.
